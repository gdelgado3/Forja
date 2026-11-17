import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
import { MODEL, firstMessage, callClaude } from './agent.mjs';
import { randomBytes, createHash, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdir, readFile } from 'node:fs/promises';
import { resolve, dirname, sep, extname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const derive = promisify(scrypt);
const token = () => randomBytes(32).toString('hex');
const digest = value => createHash('sha256').update(value).digest('hex');
const time = () => new Date().toISOString();
const cookieName = 'forja_piloto';
const day = 86400000;
const idPattern = /^[a-zA-Z0-9_-]{1,100}$/;
const units = new Set(['un','m','m²','m³','kg','h']);
const safeMime = new Set(['application/pdf','image/png','image/jpeg','image/webp']);
const contentTypes = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
  '.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.wasm':'application/wasm',
  '.png':'image/png','.pdf':'application/pdf','.jpg':'image/jpeg','.json':'application/json'};

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
function requireValue(condition, message, status = 400) {
  if (!condition) throw new HttpError(status, message);
}
function text(value, max) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max, 'Preenche os campos indicados.');
  return value.trim();
}
function emailAddress(value) {
  const email = text(value, 254).toLowerCase();
  requireValue(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email), 'Indica um email válido.');
  return email;
}
function amount(value, max) {
  requireValue(typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max, 'Confirma os valores da tabela de preços.');
  return value;
}
async function readBody(req, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of req) {
    length += chunk.length;
    if (length > limit) {
      // Drain an oversized request without retaining its remaining data.
      chunks.length = 0;
      continue;
    }
    chunks.push(chunk);
  }
  requireValue(length <= limit, 'O ficheiro ou pedido excede o limite.', 413);
  return Buffer.concat(chunks);
}
async function jsonBody(req, limit = 128 * 1024) {
  const raw = await readBody(req, limit);
  let data;
  try { data=JSON.parse(raw.toString('utf8')); }
  catch { throw new HttpError(400, 'Pedido inválido.'); }
  requireValue(data && typeof data==='object' && !Array.isArray(data), 'Pedido inválido.');
  return data;
}
function reply(res, data, status = 200) {
  res.writeHead(status, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
  res.end(JSON.stringify(data));
}
async function passwordRecord(password) {
  requireValue(typeof password === 'string' && password.length >= 12 && password.length <= 128,
    'Usa uma palavra-passe com 12 a 128 caracteres.');
  const salt = randomBytes(16).toString('hex');
  const hash = (await derive(password, salt, 64)).toString('hex');
  return `${salt}:${hash}`;
}
async function passwordMatches(password, record) {
  const [salt, hash] = (record || ('0'.repeat(32)+':'+ '0'.repeat(128))).split(':');
  const supplied = await derive(String(password).slice(0,128), salt, 64);
  return !!record && timingSafeEqual(supplied,Buffer.from(hash,'hex'));
}
function priceSettings(name, input) {
  requireValue(input && typeof input==='object', 'Indica os preços e as taxas da oficina.');
  const catalog = input.catalog ?? [];
  requireValue(Array.isArray(catalog) && catalog.length <= 500, 'A tabela pode ter até 500 artigos.');
  return {company:name, hour:amount(input.hour,100000), markup:amount(input.markup,1000), vat:amount(input.vat,100),
    catalog:catalog.map(row => {
      requireValue(units.has(row?.unit), 'Unidade inválida na tabela de preços.');
      return {label:text(row.label,180),unit:row.unit,price:amount(row.price,1000000)};
    })};
}
function validateWorkspace(state) {
  requireValue(state?.schema === 1 && Array.isArray(state.projects) && state.projects.length <= 1000, 'Dados da oficina inválidos.');
  const ids = new Set();
  for (const p of state.projects) {
    requireValue(idPattern.test(p?.id || '') && !ids.has(p.id) && /^PRJ-\d{1,12}$/.test(p.code || ''), 'Identificação de projeto inválida.');
    ids.add(p.id);
    text(p.name, 100);
    for (const key of ['files','events','memory','lines','versions'])
      requireValue(Array.isArray(p[key]), 'Dados do projeto incompletos.');
    for (const file of p.files) requireValue(idPattern.test(file?.id || ''), 'Identificação de anexo inválida.');
    for (const version of p.versions) requireValue(idPattern.test(version?.id || '') && Array.isArray(version.lines), 'Versão de orçamento inválida.');
    requireValue(p.fields && typeof p.fields === 'object', 'Campos do projeto inválidos.');
  }
}
function usage(state) {
  const projects = state.projects.filter(p=>!p.demo);
  return {
    requests:projects.length,
    drafts:projects.filter(p=>p.lines.length>0).length,
    savedQuotes:projects.filter(p=>p.versions.length>0).length,
    accepted:projects.filter(p=>p.versions.some(v=>v.accepted)).length
  };
}

export async function createPilotServer({root=resolve(dirname(fileURLToPath(import.meta.url)),'..','dist'),
  database=resolve('dados-piloto','forja.sqlite'), origin, secure=false, setupCode='', trustProxy=false, maxStorage=350*1024*1024,
  aiKey='', aiModel=MODEL, aiFetch=fetch, aiDemoLimit=3, aiDailyLimit=60, aiGlobalDaily=300}={}) {
  if (database !== ':memory:') await mkdir(dirname(database),{recursive:true,mode:0o700});
  const db = new DatabaseSync(database);
  db.exec(`PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS workshops(id TEXT PRIMARY KEY,name TEXT NOT NULL,state TEXT NOT NULL,revision INTEGER NOT NULL DEFAULT 0,last_use TEXT);
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,password TEXT,role TEXT NOT NULL,workshop TEXT REFERENCES workshops(id));
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS invites(hash TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id),expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS attachments(workshop TEXT REFERENCES workshops(id),id TEXT,mime TEXT,bytes BLOB,PRIMARY KEY(workshop,id));
    CREATE TABLE IF NOT EXISTS feedback(id TEXT PRIMARY KEY,workshop TEXT REFERENCES workshops(id),rating INTEGER,text TEXT,created TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY,workshop TEXT REFERENCES workshops(id),project TEXT NOT NULL,name TEXT,mime TEXT,bytes BLOB,note TEXT,created TEXT NOT NULL);`);
  try { db.exec('ALTER TABLE workshops ADD COLUMN demo INTEGER NOT NULL DEFAULT 0'); } catch { /* coluna já existe */ }
  try { db.exec('ALTER TABLE workshops ADD COLUMN form_token TEXT'); } catch { /* coluna já existe */ }
  db.exec(`CREATE TABLE IF NOT EXISTS public_requests(id TEXT PRIMARY KEY,workshop TEXT REFERENCES workshops(id),key TEXT NOT NULL,data TEXT NOT NULL,files TEXT NOT NULL DEFAULT '[]',created TEXT NOT NULL,submitted TEXT,imported TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS workshops_form ON workshops(form_token);
    CREATE TABLE IF NOT EXISTS ai_threads(workshop TEXT REFERENCES workshops(id),project TEXT NOT NULL,turns TEXT NOT NULL,updated TEXT NOT NULL,PRIMARY KEY(workshop,project));
    CREATE TABLE IF NOT EXISTS ai_calls(workshop TEXT,created TEXT NOT NULL,input INTEGER,output INTEGER,ok INTEGER NOT NULL);`);
  const aiBusy=new Set();
  const aiRemaining=office=>{
    const since=new Date(Date.now()-day).toISOString();
    const used=office.demo?db.prepare('SELECT COUNT(*) AS n FROM ai_calls WHERE workshop=? AND ok=1').get(office.id).n
      :db.prepare('SELECT COUNT(*) AS n FROM ai_calls WHERE workshop=? AND ok=1 AND created>?').get(office.id,since).n;
    return Math.max(0,(office.demo?aiDemoLimit:aiDailyLimit)-used);
  };
  const aiThread=(workshop,project)=>{
    const row=db.prepare('SELECT turns FROM ai_threads WHERE workshop=? AND project=?').get(workshop,project);
    return row?JSON.parse(row.turns):[];
  };
  const aiPublic=turns=>turns.map(t=>({ask:t.ask,at:t.at,reading:t.reading}));
  const setupToken = db.prepare("SELECT 1 FROM users WHERE role='admin'").get() ? null : (setupCode || token());
  const setupExpires = setupCode ? Infinity : Date.now()+15*60*1000;
  const demoStarts = [];
  const isHttps = req => secure || (trustProxy && req.headers['x-forwarded-proto']==='https');
  const storageUsed = () => db.prepare('SELECT (SELECT COALESCE(SUM(LENGTH(bytes)),0) FROM attachments)+(SELECT COALESCE(SUM(LENGTH(bytes)),0) FROM responses) AS total').get().total;
  const demoSettings = name => ({company:name,hour:35,markup:25,vat:23,catalog:[
    {label:'Tubo aço 40×40×2 (exemplo)',unit:'m',price:4.5},{label:'Chapa aço 2 mm (exemplo)',unit:'m²',price:28},
    {label:'Chapa inox 2 mm (exemplo)',unit:'m²',price:78},{label:'Acabamento escovado (exemplo)',unit:'m²',price:15},
    {label:'Lacagem (exemplo)',unit:'m²',price:18},{label:'Corte e quinagem (exemplo)',unit:'h',price:35},
    {label:'Montagem em obra (exemplo)',unit:'h',price:35}]});
  const attempts = new Map(), publicAttempts = new Map();
  const clientIp = req => (trustProxy && String(req.headers['x-forwarded-for']||'').split(',')[0].trim()) || req.socket.remoteAddress || 'local';
  function limitPublic(req, max=10) {
    const now=Date.now();
    for (const [key,entry] of publicAttempts) if (entry.until<=now) publicAttempts.delete(key);
    const ip=clientIp(req), entry=publicAttempts.get(ip)||{count:0,until:now+60*60*1000};
    requireValue(entry.count<max,'Já enviaste vários pedidos. Tenta de novo mais tarde ou contacta a oficina.',429);
    entry.count++;publicAttempts.set(ip,entry);
  }
  const formOffice = raw => {
    requireValue(/^[a-f0-9]{24}$/.test(raw),'Link inválido. Pede à oficina o link correto.',404);
    const office=db.prepare('SELECT id,name FROM workshops WHERE form_token=?').get(raw);
    requireValue(office,'Link inválido. Pede à oficina o link correto.',404);
    return office;
  };
  const pendingRequest = (office,id,key) => {
    const row=db.prepare('SELECT * FROM public_requests WHERE id=? AND workshop=?').get(id,office.id);
    requireValue(row && typeof key==='string' && key.length===64 && timingSafeEqual(Buffer.from(digest(key),'hex'),Buffer.from(row.key,'hex')),'Pedido não encontrado.',404);
    requireValue(!row.submitted,'Este pedido já foi enviado.',409);
    return row;
  };
  const publicProject = row => {
    const d=JSON.parse(row.data);
    return {id:'pub-'+row.id,client:d.name,contact:[d.phone,d.email].filter(Boolean).join(' · '),place:d.place,type:d.type,
      request:[d.description,d.measures?'Medidas indicadas pelo cliente: '+d.measures:''].filter(Boolean).join('\n\n'),
      created:row.submitted||row.created,files:JSON.parse(row.files)};
  };
  const sessionLookup = db.prepare(`SELECT u.id,u.email,u.role,u.workshop FROM sessions s JOIN users u ON s.user_id=u.id WHERE s.hash=? AND s.expires>?`);
  const workshopLookup = db.prepare('SELECT * FROM workshops WHERE id=?');
  const transaction = fn => {
    db.exec('BEGIN IMMEDIATE');
    try { const out=fn();db.exec('COMMIT');return out; }
    catch (e) { db.exec('ROLLBACK');throw e; }
  };
  const cookie = req => (req.headers.cookie||'').split(/;\s*/).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1) || '';
  function session(res, userId, req) {
    const raw = token();
    db.prepare('DELETE FROM sessions WHERE expires<=?').run(Date.now());
    db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(digest(raw),userId,Date.now()+7*day);
    res.setHeader('Set-Cookie',`${cookieName}=${raw}; Path=/; HttpOnly; SameSite=Strict; Max-Age=604800${isHttps(req)?'; Secure':''}`);
  }
  function limitAttempts(req) {
    const now = Date.now();
    for (const [key,entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const ip = clientIp(req);
    const entry = attempts.get(ip) || {count:0,until:now+15*60*1000};
    requireValue(entry.count < 30, 'Demasiadas tentativas. Tenta novamente dentro de alguns minutos.',429);
    entry.count++;
    attempts.set(ip,entry);
  }
  function issueInvite(userId) {
    const raw=token();
    db.prepare('DELETE FROM invites WHERE user_id=? OR expires<=?').run(userId,Date.now());
    db.prepare('INSERT INTO invites VALUES(?,?,?)').run(digest(raw),userId,Date.now()+3*day);
    return raw;
  }
  // Apagamento: pedidos do formulário abandonados (24 h) e não importados (90 dias), com os anexos.
  function cleanup() {
    const cut=ms=>new Date(Date.now()-ms).toISOString();
    const old=db.prepare('SELECT id,workshop,files FROM public_requests WHERE (submitted IS NULL AND created<?) OR (imported IS NULL AND submitted IS NOT NULL AND submitted<?)').all(cut(day),cut(90*day));
    for(const r of old) transaction(()=>{
      for(const f of JSON.parse(r.files)) db.prepare('DELETE FROM attachments WHERE workshop=? AND id=?').run(r.workshop,f.id);
      db.prepare('DELETE FROM public_requests WHERE id=?').run(r.id);
    });
    db.prepare("UPDATE public_requests SET data='{}' WHERE imported IS NOT NULL AND data!='{}'").run();
    return old.length;
  }
  cleanup();
  const cleanupTimer=setInterval(cleanup,6*60*60*1000);cleanupTimer.unref?.();
  const server = http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    try {
      const url = new URL(req.url,'http://localhost');
      const path = url.pathname;
      if (!path.startsWith('/api/')) {
        requireValue(req.method==='GET' || req.method==='HEAD','Método inválido.',405);
        const asset = path==='/' ? '/pilot.html' : /^\/pedido\/[a-f0-9]{24}$/.test(path) ? '/pilot/pedido.html' : decodeURIComponent(path);
        const allowed = /^\/(pilot\.html|app\.js|interpret\.js|style\.css|readers\.mjs|reader-worker\.mjs)$/.test(asset) ||
          /^\/(pilot|vendor|samples)\//.test(asset);
        requireValue(allowed, 'Página não encontrada.',404);
        const file = resolve(root,'.'+asset);
        requireValue(file.startsWith(resolve(root)+sep),'Página não encontrada.',404);
        const bytes = await readFile(file);
        res.writeHead(200,{'Content-Type':contentTypes[extname(file)]||'application/octet-stream','Cache-Control':'no-store'});
        return res.end(req.method==='HEAD'?undefined:bytes);
      }
      if (req.method!=='GET') {
        const permitted = origin || `${isHttps(req)?'https':'http'}://${req.headers.host}`;
        requireValue(req.headers.origin===permitted,'Abre a Forja na página de acesso da oficina.',403);
      }
      const pub=path.match(/^\/api\/public\/(oficina|pedido)\/([^/]+)(?:\/([a-f0-9]{32})\/(files|submit))?$/);
      if (pub) {
        const office=formOffice(pub[2]);
        if (pub[1]==='oficina' && !pub[3] && req.method==='GET') return reply(res,{name:office.name});
        requireValue(pub[1]==='pedido','Operação não encontrada.',404);
        if (!pub[3] && req.method==='POST') {
          limitPublic(req);
          const input=await jsonBody(req,32*1024);
          if (typeof input.website==='string' && input.website.trim()) return reply(res,{id:token().slice(0,32),uploadKey:token()},201);
          requireValue(input.consent===true,'Confirma que aceitas o tratamento dos dados para receberes o orçamento.');
          const opt=(v,max)=>v==null||v===''?'':text(v,max);
          const data={name:text(input.name,100),phone:opt(input.phone,30),email:input.email?emailAddress(input.email):'',
            type:opt(input.type,100),place:opt(input.place,150),measures:opt(input.measures,2000),description:text(input.description,4000)};
          requireValue(data.phone || data.email,'Indica um telefone ou um email para a oficina te responder.');
          requireValue(!data.phone || /^[+\d][\d\s().-]{5,}$/.test(data.phone),'Telefone inválido.');
          requireValue(db.prepare("SELECT COUNT(*) AS n FROM public_requests WHERE workshop=? AND created>?").get(office.id,new Date(Date.now()-day).toISOString()).n<50,
            'A oficina recebeu muitos pedidos hoje. Contacta-a diretamente.',429);
          const id=token().slice(0,32),key=token();
          db.prepare('INSERT INTO public_requests (id,workshop,key,data,created) VALUES(?,?,?,?,?)').run(id,office.id,digest(key),JSON.stringify(data),time());
          return reply(res,{id,uploadKey:key},201);
        }
        if (pub[4]==='files' && req.method==='PUT') {
          const row=pendingRequest(office,pub[3],url.searchParams.get('key'));
          const files=JSON.parse(row.files);
          requireValue(files.length<6,'Podes juntar até 6 ficheiros.',413);
          requireValue(safeMime.has(req.headers['content-type']),'Só aceitamos fotos (JPG, PNG, WebP) ou PDF.',415);
          const bytes=await readBody(req,10*1024*1024);
          requireValue(bytes.length>0,'O ficheiro está vazio.');
          requireValue(storageUsed()+bytes.length<=maxStorage,'Não foi possível guardar o ficheiro. Contacta a oficina.',507);
          const fileId=`pub-${row.id.slice(0,16)}-${files.length+1}`;
          const name=(url.searchParams.get('name')||'ficheiro').replace(/[\\/\u0000-\u001f]/g,'_').slice(0,180);
          transaction(()=>{
            db.prepare('INSERT INTO attachments VALUES(?,?,?,?)').run(office.id,fileId,req.headers['content-type'],bytes);
            files.push({id:fileId,name,type:req.headers['content-type'],size:bytes.length,created:time()});
            db.prepare('UPDATE public_requests SET files=? WHERE id=?').run(JSON.stringify(files),row.id);
          });
          return reply(res,{ok:true},201);
        }
        if (pub[4]==='submit' && req.method==='POST') {
          const row=pendingRequest(office,pub[3],url.searchParams.get('key'));
          db.prepare('UPDATE public_requests SET submitted=? WHERE id=?').run(time(),row.id);
          return reply(res,{ok:true});
        }
        throw new HttpError(404,'Operação não encontrada.');
      }
      const auth = sessionLookup.get(digest(cookie(req)),Date.now());
      if (path==='/api/pilot/me' && req.method==='GET') {
        const needsSetup = !db.prepare("SELECT 1 FROM users WHERE role='admin'").get();
        return reply(res,{user:auth||null,needsSetup});
      }
      if (path==='/api/pilot/setup' && req.method==='POST') {
        limitAttempts(req);
        const input=await jsonBody(req);
        requireValue(setupToken && Date.now()<setupExpires && typeof input.code==='string' &&
          timingSafeEqual(Buffer.from(digest(input.code),'hex'),Buffer.from(digest(setupToken),'hex')),
          'O código inicial é inválido ou expirou. Reinicia o servidor para obter outro.',403);
        const email=emailAddress(input.email),password=await passwordRecord(input.password),id=token();
        transaction(()=>{
          requireValue(!db.prepare("SELECT 1 FROM users WHERE role='admin'").get(),'O administrador já foi criado.',409);
          db.prepare("INSERT INTO users VALUES(?,?,?,'admin',NULL)").run(id,email,password);
        });
        session(res,id,req);
        return reply(res,{ok:true},201);
      }
      if (path==='/api/pilot/login' && req.method==='POST') {
        limitAttempts(req);
        const input=await jsonBody(req);
        const user=db.prepare('SELECT * FROM users WHERE email=?').get(emailAddress(input.email));
        requireValue(await passwordMatches(input.password,user?.password),'Email ou palavra-passe incorretos.',401);
        session(res,user.id,req);
        if(user.workshop) db.prepare('UPDATE workshops SET last_use=? WHERE id=?').run(time(),user.workshop);
        return reply(res,{ok:true});
      }
      if (path==='/api/pilot/activate' && req.method==='POST') {
        limitAttempts(req);
        const input=await jsonBody(req), hash=digest(text(input.invite,100));
        requireValue(db.prepare('SELECT 1 FROM invites WHERE hash=? AND expires>?').get(hash,Date.now()),'Convite inválido ou expirado.',400);
        const password=await passwordRecord(input.password);
        const userId=transaction(()=>{
          const invite=db.prepare('SELECT * FROM invites WHERE hash=? AND expires>?').get(hash,Date.now());
          requireValue(invite,'Convite inválido ou expirado.');
          db.prepare('DELETE FROM invites WHERE hash=?').run(hash);
          db.prepare('DELETE FROM sessions WHERE user_id=?').run(invite.user_id);
          db.prepare('UPDATE users SET password=? WHERE id=?').run(password,invite.user_id);
          db.prepare('UPDATE workshops SET last_use=? WHERE id=(SELECT workshop FROM users WHERE id=?)').run(time(),invite.user_id);
          return invite.user_id;
        });
        session(res,userId,req);
        return reply(res,{ok:true});
      }
      if (path==='/api/pilot/demo' && req.method==='POST') {
        requireValue(!auth,'Já tens uma sessão aberta.',409);
        const now=Date.now();
        while(demoStarts.length && demoStarts[0]<now-10*60*1000) demoStarts.shift();
        requireValue(demoStarts.length<80,'Há muita gente a experimentar agora. Tenta de novo dentro de minutos.',429);
        requireValue(db.prepare('SELECT COUNT(*) AS n FROM workshops WHERE demo=1').get().n<500,'As contas de demonstração estão esgotadas.',429);
        demoStarts.push(now);
        const id=token(),userId=token(),name='Oficina de demonstração '+id.slice(0,4).toUpperCase();
        transaction(()=>{
          db.prepare('INSERT INTO workshops (id,name,state,last_use,demo) VALUES(?,?,?,?,1)').run(id,name,JSON.stringify({schema:1,projects:[],settings:demoSettings(name)}),time());
          db.prepare("INSERT INTO users VALUES(?,?,NULL,'workshop',?)").run(userId,`demo-${id.slice(0,16)}@demo.invalid`,id);
        });
        session(res,userId,req);
        return reply(res,{ok:true},201);
      }
      requireValue(auth,'Entra na tua conta para continuar.',401);
      if(path==='/api/pilot/logout' && req.method==='POST') {
        db.prepare('DELETE FROM sessions WHERE hash=?').run(digest(cookie(req)));
        res.setHeader('Set-Cookie',`${cookieName}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${isHttps(req)?'; Secure':''}`);
        return reply(res,{ok:true});
      }
      if(path.startsWith('/api/pilot/admin/')) {
        requireValue(auth.role==='admin','Área de administração.',403);
        if(path==='/api/pilot/admin/workshops' && req.method==='GET') {
          const offices=db.prepare(`SELECT w.*,u.email,u.password IS NOT NULL AS active FROM workshops w JOIN users u ON u.workshop=w.id ORDER BY w.name`).all();
          return reply(res,offices.map(o=>{
            const state=JSON.parse(o.state);
            return {id:o.id,name:o.name,email:o.demo?'':o.email,demo:!!o.demo,active:!!o.active,lastUse:o.last_use,settings:state.settings,...usage(state)};
          }));
        }
        if(path==='/api/pilot/admin/workshops' && req.method==='POST') {
          const input=await jsonBody(req),name=text(input.name,100),email=emailAddress(input.email);
          const id=token(),userId=token(),settings=priceSettings(name,input.settings);
          requireValue(!db.prepare('SELECT 1 FROM users WHERE email=?').get(email),'Já existe uma conta com esse email.',409);
          const invite=transaction(()=>{
            db.prepare('INSERT INTO workshops (id,name,state) VALUES(?,?,?)').run(id,name,JSON.stringify({schema:1,projects:[],settings}));
            db.prepare("INSERT INTO users VALUES(?,?,NULL,'workshop',?)").run(userId,email,id);
            return issueInvite(userId);
          });
          return reply(res,{id,invite},201);
        }
        if(path==='/api/pilot/admin/feedback' && req.method==='GET') {
          const items=db.prepare('SELECT f.id,f.rating,f.text,f.created,w.name AS workshop,w.demo FROM feedback f JOIN workshops w ON w.id=f.workshop ORDER BY f.created DESC LIMIT 500').all()
            .map(f=>({...f,demo:!!f.demo}));
          const checks={under:0,ok:0,over:0},checked=[];
          for(const o of db.prepare('SELECT name,demo,state FROM workshops').all()) for(const p of JSON.parse(o.state).projects)
            if(Object.hasOwn(checks,p.priceCheck) || Number(p.actualPrice)>0 || (typeof p.checkNote==='string' && p.checkNote.trim())) {
              if(Object.hasOwn(checks,p.priceCheck)) checks[p.priceCheck]++;
              const num=v=>Number.isFinite(Number(v)) && v!==null && v!==''?Number(v):null;
              checked.push({workshop:o.name,demo:!!o.demo,project:String(p.code)+' · '+String(p.name),example:!!p.demo,check:Object.hasOwn(checks,p.priceCheck)?p.priceCheck:'',
                actual:num(p.actualPrice),draft:num(p.checkDraft),note:typeof p.checkNote==='string'?p.checkNote.slice(0,2000):'',saved:typeof p.checkSaved==='string'?p.checkSaved:''});
            }
          return reply(res,{items,checks,checked:checked.slice(0,500)});
        }
        if(path==='/api/pilot/admin/inbox' && req.method==='GET') {
          const sent=db.prepare('SELECT id,workshop,project,name,mime,LENGTH(bytes) AS size,note,created FROM responses ORDER BY created').all();
          const items=[];
          for(const o of db.prepare('SELECT id,name,demo,state FROM workshops').all()) {
            for(const p of JSON.parse(o.state).projects) {
              if(p.demo || (!p.files.length && !p.request)) continue;
              const responses=sent.filter(r=>r.workshop===o.id && r.project===p.id).map(({workshop,project,...r})=>r);
              const last=[p.created,...p.files.map(f=>f.created)].filter(Boolean).sort().pop()||'';
              items.push({workshop:{id:o.id,name:o.name,demo:!!o.demo},
                project:{id:p.id,code:p.code,name:p.name,kind:p.kind==='desenho'?'desenho':'',priceCheck:Object.hasOwn({under:1,ok:1,over:1},p.priceCheck)?p.priceCheck:'',client:p.client||'',channel:p.channel||'',request:String(p.request||'').slice(0,6000),created:p.created||'',fields:p.fields},
                files:p.files.map(f=>({id:f.id,name:String(f.name||'anexo'),type:String(f.type||''),size:Number(f.size)||0,created:f.created||''})),
                responses,last});
            }
          }
          for(const r of db.prepare('SELECT r.*,w.name,w.demo FROM public_requests r JOIN workshops w ON w.id=r.workshop WHERE r.submitted IS NOT NULL AND r.imported IS NULL').all()) {
            const p=publicProject(r);
            items.push({workshop:{id:r.workshop,name:r.name,demo:!!r.demo},
              project:{id:p.id,code:'Formulário',name:p.type||'Pedido pelo formulário',kind:'',priceCheck:'',client:p.client,channel:'Formulário (por importar)',request:p.request.slice(0,6000),created:p.created,fields:{}},
              files:p.files,responses:sent.filter(x=>x.workshop===r.workshop && x.project===p.id).map(({workshop,project,...x})=>x),last:p.created});
          }
          items.sort((a,b)=>a.last<b.last?1:-1);
          return reply(res,{items,storage:storageUsed(),maxStorage});
        }
        const adminFile=path.match(/^\/api\/pilot\/admin\/files\/([a-f0-9]{64})\/([a-zA-Z0-9_-]{1,100})$/);
        if(adminFile && req.method==='GET') {
          const attachment=db.prepare('SELECT * FROM attachments WHERE workshop=? AND id=?').get(adminFile[1],adminFile[2]);
          requireValue(attachment,'Anexo não encontrado.',404);
          res.writeHead(200,{'Content-Type':attachment.mime,'Cache-Control':'no-store','Content-Disposition':'attachment'});
          return res.end(attachment.bytes);
        }
        const respond=path.match(/^\/api\/pilot\/admin\/responses\/([a-f0-9]{64})\/([a-zA-Z0-9_-]{1,100})$/);
        if(respond && req.method==='PUT') {
          const office=workshopLookup.get(respond[1]);
          requireValue(office && (JSON.parse(office.state).projects.some(p=>p.id===respond[2]) ||
            (respond[2].startsWith('pub-') && db.prepare('SELECT 1 FROM public_requests WHERE workshop=? AND id=? AND submitted IS NOT NULL').get(office.id,respond[2].slice(4)))),'Pedido não encontrado.',404);
          const bytes=await readBody(req,20*1024*1024);
          const note=(url.searchParams.get('note')||'').trim().slice(0,4000);
          requireValue(bytes.length>0 || note,'Junta um ficheiro ou escreve uma nota.');
          requireValue(storageUsed()+bytes.length<=maxStorage,'O espaço do piloto está cheio. Apaga respostas antigas.',507);
          const mime=bytes.length?(safeMime.has(req.headers['content-type'])?req.headers['content-type']:'application/octet-stream'):null;
          const name=bytes.length?(url.searchParams.get('name')||'resposta').replace(/[\\/\u0000-\u001f]/g,'_').slice(0,180):null;
          const id=token().slice(0,32);
          db.prepare('INSERT INTO responses VALUES(?,?,?,?,?,?,?,?)').run(id,office.id,respond[2],name,mime,bytes.length?bytes:null,note||null,time());
          return reply(res,{id},201);
        }
        const removal=path.match(/^\/api\/pilot\/admin\/responses\/([a-f0-9]{32})$/);
        if(removal && req.method==='DELETE') {
          requireValue(db.prepare('DELETE FROM responses WHERE id=?').run(removal[1]).changes===1,'Resposta não encontrada.',404);
          return reply(res,{ok:true});
        }
        const match=path.match(/^\/api\/pilot\/admin\/workshops\/([a-f0-9]{64})\/(prices|invite)$/);
        if(match && req.method==='POST') {
          const office=workshopLookup.get(match[1]);
          requireValue(office,'Oficina não encontrada.',404);
          if(match[2]==='invite') {
            const user=db.prepare('SELECT id FROM users WHERE workshop=?').get(office.id);
            return reply(res,{invite:transaction(()=>issueInvite(user.id))});
          }
          const input=await jsonBody(req);
          const latest=workshopLookup.get(office.id),state=JSON.parse(latest.state);
          state.settings={...priceSettings(office.name,input),privacy:state.settings.privacy};
          db.prepare('UPDATE workshops SET state=?,revision=revision+1 WHERE id=?').run(JSON.stringify(state),office.id);
          return reply(res,{ok:true});
        }
        throw new HttpError(404,'Operação não encontrada.');
      }
      requireValue(auth.role==='workshop' && auth.workshop,'Entra com a conta de uma oficina.',403);
      if(path==='/api/pilot/workspace' && req.method==='GET') {
        const office=workshopLookup.get(auth.workshop);
        db.prepare('UPDATE workshops SET last_use=? WHERE id=?').run(time(),auth.workshop);
        let formToken=office.form_token;
        if(!formToken) {formToken=token().slice(0,24);db.prepare('UPDATE workshops SET form_token=? WHERE id=?').run(formToken,auth.workshop);}
        return reply(res,{state:JSON.parse(office.state),revision:office.revision,demo:!!office.demo,formToken});
      }
      if(path==='/api/pilot/workspace' && req.method==='PUT') {
        const input=await jsonBody(req,8*1024*1024);
        validateWorkspace(input.state);
        const office=workshopLookup.get(auth.workshop);
        requireValue(input.revision===office.revision,'A oficina tem alterações mais recentes. Exporta uma cópia do trabalho atual antes de recarregar.',409);
        input.state.settings=JSON.parse(office.state).settings;
        for(const p of input.state.projects) for(const f of p.files)
          requireValue(db.prepare('SELECT 1 FROM attachments WHERE workshop=? AND id=?').get(auth.workshop,f.id),'Há um anexo que ainda não foi guardado.');
        const update=db.prepare('UPDATE workshops SET state=?,revision=revision+1,last_use=? WHERE id=? AND revision=?')
          .run(JSON.stringify(input.state),time(),auth.workshop,office.revision);
        requireValue(update.changes===1,'A oficina tem alterações mais recentes.',409);
        if(input.state.projects.some(p=>p.id==='exemplo' && p.demo) && !db.prepare("SELECT 1 FROM responses WHERE workshop=? AND project='exemplo'").get(auth.workshop))
          db.prepare('INSERT INTO responses VALUES(?,?,?,NULL,NULL,NULL,?,?)').run(token().slice(0,32),auth.workshop,'exemplo',
            'Rascunho de exemplo pronto: 3 prateleiras em L, 1,04 m² de chapa inox de 2 mm. Falta saber a espessura e a fixação à parede. Vê o separador 3. Orçamento.',time());
        return reply(res,{revision:office.revision+1});
      }
      if(path==='/api/pilot/catalog' && req.method==='PUT') {
        const input=await jsonBody(req,512*1024);
        const office=workshopLookup.get(auth.workshop),state=JSON.parse(office.state);
        const settings=priceSettings(office.name,{...state.settings,catalog:input.catalog});
        state.settings={...state.settings,catalog:settings.catalog};
        db.prepare('UPDATE workshops SET state=?,last_use=? WHERE id=?').run(JSON.stringify(state),time(),office.id);
        return reply(res,{catalog:settings.catalog});
      }
      if(path==='/api/pilot/privacy' && req.method==='PUT') {
        const input=await jsonBody(req,16*1024);
        requireValue(Array.isArray(input.zones) && input.zones.length<=5,'Podes marcar até 5 zonas.');
        const zones=input.zones.map(z=>{
          const v=['x','y','w','h'].map(k=>Number(z?.[k]));
          requireValue(v.every(n=>Number.isFinite(n) && n>=0 && n<=1) && v[0]+v[2]<=1.0001 && v[1]+v[3]<=1.0001 && v[2]>0 && v[3]>0,'Zona inválida.');
          return {x:v[0],y:v[1],w:v[2],h:v[3]};
        });
        const office=workshopLookup.get(auth.workshop),state=JSON.parse(office.state);
        state.settings={...state.settings,privacy:{zones,updated:time()}};
        db.prepare('UPDATE workshops SET state=?,last_use=? WHERE id=?').run(JSON.stringify(state),time(),office.id);
        return reply(res,{zones});
      }
      const ai=path.match(/^\/api\/pilot\/ai\/([a-zA-Z0-9_-]{1,100})$/);
      if(ai && req.method==='GET') {
        const office=workshopLookup.get(auth.workshop);
        return reply(res,{enabled:!!aiKey,remaining:aiRemaining(office),demo:!!office.demo,turns:aiPublic(aiThread(office.id,ai[1]))});
      }
      if(ai && req.method==='POST') {
        requireValue(aiKey,'A leitura com IA ainda não está ligada neste servidor.',503);
        const input=await jsonBody(req,16*1024);
        const ask=typeof input.message==='string'?input.message.trim().slice(0,2000):'';
        const office=workshopLookup.get(auth.workshop),state=JSON.parse(office.state);
        const project=state.projects.find(p=>p.id===ai[1]);
        requireValue(project,'Guarda o pedido antes de o mandar ler.',404);
        requireValue(String(project.request||'').trim() || project.files.length,'Escreve o pedido ou junta um anexo antes de pedir a leitura.');
        requireValue(aiRemaining(office)>0,office.demo?`A demonstração permite ${aiDemoLimit} leituras com IA. Fala connosco para um piloto.`:'Chegaste ao limite diário de leituras com IA.',429);
        requireValue(db.prepare('SELECT COUNT(*) AS n FROM ai_calls WHERE created>?').get(new Date(Date.now()-day).toISOString()).n<aiGlobalDaily,'A leitura com IA está em pausa por hoje. Tenta amanhã.',429);
        const key=office.id+'/'+project.id;
        requireValue(!aiBusy.has(key),'Já há uma leitura em curso para este pedido.',409);
        let turns=input.restart?[]:aiThread(office.id,project.id);
        requireValue(turns.length<10,'Esta conversa já vai longa. Recomeça a leitura.',409);
        requireValue(!turns.length || ask,'Escreve a correção ou a pergunta.');
        aiBusy.add(key);
        try {
          const files=project.files.map(f=>({name:String(f.name||'anexo'),...(db.prepare('SELECT mime,bytes FROM attachments WHERE workshop=? AND id=?').get(office.id,f.id)||{})})).filter(f=>f.bytes);
          const messages=[firstMessage(project,files,state.settings?.catalog||[]).message];
          // Cada leitura anterior volta como resposta da ferramenta, seguida da mensagem da oficina que veio a seguir.
          turns.forEach((t,i)=>{
            messages.push({role:'assistant',content:[t.toolUse]});
            messages.push({role:'user',content:[{type:'tool_result',tool_use_id:t.toolUse.id,content:'Leitura recebida pela oficina.'},
              {type:'text',text:'Mensagem da oficina: '+(turns[i+1]?.ask ?? ask)}]});
          });
          let result;
          try { result=await callClaude(messages,{apiKey:aiKey,model:aiModel,fetchImpl:aiFetch}); }
          catch(e) { db.prepare('INSERT INTO ai_calls VALUES(?,?,?,?,0)').run(office.id,time(),0,0); throw new HttpError(e.status||502,e.message); }
          db.prepare('INSERT INTO ai_calls VALUES(?,?,?,?,1)').run(office.id,time(),result.usage.input_tokens||0,result.usage.output_tokens||0);
          const {id,name,input:toolInput}=result.toolUse;
          turns=[...turns,{ask:turns.length?ask:'',at:time(),reading:result.reading,toolUse:{type:'tool_use',id,name,input:toolInput}}];
          db.prepare('INSERT INTO ai_threads VALUES(?,?,?,?) ON CONFLICT(workshop,project) DO UPDATE SET turns=excluded.turns,updated=excluded.updated').run(office.id,project.id,JSON.stringify(turns),time());
          return reply(res,{remaining:aiRemaining(office),turns:aiPublic(turns)});
        } finally { aiBusy.delete(key); }
      }
      if(path==='/api/pilot/requests' && req.method==='GET') {
        return reply(res,db.prepare('SELECT * FROM public_requests WHERE workshop=? AND submitted IS NOT NULL AND imported IS NULL ORDER BY submitted').all(auth.workshop).map(publicProject));
      }
      const imported=path.match(/^\/api\/pilot\/requests\/pub-([a-f0-9]{32})\/imported$/);
      if(imported && req.method==='POST') {
        const state=JSON.parse(workshopLookup.get(auth.workshop).state);
        requireValue(state.projects.some(p=>p.id==='pub-'+imported[1]),'Guarda o pedido na oficina antes de o marcar.',409);
        db.prepare('UPDATE public_requests SET imported=? WHERE id=? AND workshop=?').run(time(),imported[1],auth.workshop);
        return reply(res,{ok:true});
      }
      if(path==='/api/pilot/feedback' && req.method==='POST') {
        const input=await jsonBody(req);
        const rating=input.rating==null?null:Number(input.rating);
        requireValue(rating===null || (Number.isInteger(rating) && rating>=1 && rating<=5),'Escolhe uma nota de 1 a 5.');
        const note=typeof input.text==='string'?input.text.trim().slice(0,2000):'';
        requireValue(rating!==null || note,'Escreve o teu feedback ou escolhe uma nota.');
        requireValue(db.prepare('SELECT COUNT(*) AS n FROM feedback WHERE workshop=?').get(auth.workshop).n<20,'Já recebemos muito feedback desta conta. Obrigado!',429);
        db.prepare('INSERT INTO feedback VALUES(?,?,?,?,?)').run(token().slice(0,32),auth.workshop,rating,note||null,time());
        return reply(res,{ok:true},201);
      }
      if(path==='/api/pilot/responses' && req.method==='GET') {
        return reply(res,db.prepare('SELECT id,project,name,mime,LENGTH(bytes) AS size,note,created FROM responses WHERE workshop=? ORDER BY created').all(auth.workshop));
      }
      const answer=path.match(/^\/api\/pilot\/responses\/([a-f0-9]{32})$/);
      if(answer && req.method==='GET') {
        const row=db.prepare('SELECT mime,bytes FROM responses WHERE workshop=? AND id=?').get(auth.workshop,answer[1]);
        requireValue(row && row.bytes,'Resposta não encontrada.',404);
        res.writeHead(200,{'Content-Type':row.mime,'Cache-Control':'no-store','Content-Disposition':'attachment'});
        return res.end(row.bytes);
      }
      const file=path.match(/^\/api\/pilot\/files\/([a-zA-Z0-9_-]{1,100})$/);
      if(file && req.method==='GET') {
        const attachment=db.prepare('SELECT * FROM attachments WHERE workshop=? AND id=?').get(auth.workshop,file[1]);
        requireValue(attachment,'Anexo não encontrado.',404);
        res.writeHead(200,{'Content-Type':attachment.mime,'Cache-Control':'no-store','Content-Disposition':'attachment'});
        return res.end(attachment.bytes);
      }
      if(file && req.method==='PUT') {
        const mime=safeMime.has(req.headers['content-type'])?req.headers['content-type']:'application/octet-stream';
        const isDemo=!!workshopLookup.get(auth.workshop).demo;
        const bytes=await readBody(req,(isDemo?10:20)*1024*1024);
        requireValue(bytes.length>0,'O anexo está vazio.');
        const saved=db.prepare('SELECT mime,bytes FROM attachments WHERE workshop=? AND id=?').get(auth.workshop,file[1]);
        if(saved) {
          requireValue(saved.mime===mime && Buffer.from(saved.bytes).equals(bytes),'Já existe um anexo com essa identificação.',409);
        } else {
          requireValue(!isDemo || db.prepare('SELECT COUNT(*) AS n FROM attachments WHERE workshop=?').get(auth.workshop).n<12,'A demonstração aceita até 12 anexos.',413);
          requireValue(storageUsed()+bytes.length<=maxStorage,'O espaço do piloto está cheio. Avisa a equipa da Forja.',507);
          db.prepare('INSERT INTO attachments VALUES(?,?,?,?)').run(auth.workshop,file[1],mime,bytes);
        }
        return reply(res,{ok:true},201);
      }
      throw new HttpError(404,'Operação não encontrada.');
    } catch(e) {
      if (e.code==='ENOENT') return reply(res,{error:'Ficheiro não encontrado.'},404);
      if (e instanceof HttpError) return reply(res,{error:e.message},e.status);
      console.error('Erro no piloto',e.name,e.code||'');
      return reply(res,{error:'A Forja não conseguiu concluir esta operação.'},500);
    }
  });
  server.on('close',()=>{clearInterval(cleanupTimer);db.close();});
  return {server,setupToken,cleanup};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  const port=Number(process.env.FORJA_PILOT_PORT || 8001);
  const origin=process.env.FORJA_PILOT_ORIGIN;
  if(origin && !/^https:\/\/[^/?#]+$/.test(origin)) throw Error('FORJA_PILOT_ORIGIN deve ser a origem HTTPS completa.');
  const hosted=!!process.env.PORT;
  const setupCode=process.env.FORJA_SETUP_CODE||'';
  if(setupCode && setupCode.length<24) throw Error('FORJA_SETUP_CODE deve ter pelo menos 24 caracteres.');
  const {server,setupToken}=await createPilotServer({origin,secure:!!origin,setupCode,trustProxy:hosted,aiKey:process.env.ANTHROPIC_API_KEY||'',
    database:process.env.FORJA_PILOT_DB||undefined});
  server.listen(hosted?Number(process.env.PORT):port,hosted?'0.0.0.0':'127.0.0.1',()=>{
    console.log(hosted?`Forja Piloto a escutar na porta ${process.env.PORT}`:`Forja Piloto: http://127.0.0.1:${port}`);
    if(setupToken && !setupCode) console.log(`Código inicial de administrador (15 minutos): ${setupToken}`);
  });
}
