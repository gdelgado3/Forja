import http from 'node:http';
import { DatabaseSync } from 'node:sqlite';
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
  database=resolve('dados-piloto','forja.sqlite'), origin, secure=false, setupCode='', trustProxy=false, maxStorage=350*1024*1024}={}) {
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
  const attempts = new Map();
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
    const ip = (trustProxy && String(req.headers['x-forwarded-for']||'').split(',')[0].trim()) || req.socket.remoteAddress || 'local';
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
  const server = http.createServer(async (req,res) => {
    res.setHeader('X-Content-Type-Options','nosniff');
    res.setHeader('Referrer-Policy','no-referrer');
    res.setHeader('X-Frame-Options','DENY');
    try {
      const url = new URL(req.url,'http://localhost');
      const path = url.pathname;
      if (!path.startsWith('/api/')) {
        requireValue(req.method==='GET' || req.method==='HEAD','Método inválido.',405);
        const asset = path==='/' ? '/pilot.html' : decodeURIComponent(path);
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
            if(Object.hasOwn(checks,p.priceCheck)) {
              checks[p.priceCheck]++;
              checked.push({workshop:o.name,demo:!!o.demo,project:String(p.code)+' · '+String(p.name),example:!!p.demo,check:p.priceCheck});
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
                project:{id:p.id,code:p.code,name:p.name,priceCheck:Object.hasOwn({under:1,ok:1,over:1},p.priceCheck)?p.priceCheck:'',client:p.client||'',channel:p.channel||'',request:String(p.request||'').slice(0,6000),created:p.created||'',fields:p.fields},
                files:p.files.map(f=>({id:f.id,name:String(f.name||'anexo'),type:String(f.type||''),size:Number(f.size)||0,created:f.created||''})),
                responses,last});
            }
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
          requireValue(office && JSON.parse(office.state).projects.some(p=>p.id===respond[2]),'Pedido não encontrado.',404);
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
          state.settings=priceSettings(office.name,input);
          db.prepare('UPDATE workshops SET state=?,revision=revision+1 WHERE id=?').run(JSON.stringify(state),office.id);
          return reply(res,{ok:true});
        }
        throw new HttpError(404,'Operação não encontrada.');
      }
      requireValue(auth.role==='workshop' && auth.workshop,'Entra com a conta de uma oficina.',403);
      if(path==='/api/pilot/workspace' && req.method==='GET') {
        const office=workshopLookup.get(auth.workshop);
        db.prepare('UPDATE workshops SET last_use=? WHERE id=?').run(time(),auth.workshop);
        return reply(res,{state:JSON.parse(office.state),revision:office.revision});
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
  server.on('close',()=>db.close());
  return {server,setupToken};
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href===import.meta.url) {
  const port=Number(process.env.FORJA_PILOT_PORT || 8001);
  const origin=process.env.FORJA_PILOT_ORIGIN;
  if(origin && !/^https:\/\/[^/?#]+$/.test(origin)) throw Error('FORJA_PILOT_ORIGIN deve ser a origem HTTPS completa.');
  const hosted=!!process.env.PORT;
  const setupCode=process.env.FORJA_SETUP_CODE||'';
  if(setupCode && setupCode.length<24) throw Error('FORJA_SETUP_CODE deve ter pelo menos 24 caracteres.');
  const {server,setupToken}=await createPilotServer({origin,secure:!!origin,setupCode,trustProxy:hosted,
    database:process.env.FORJA_PILOT_DB||undefined});
  server.listen(hosted?Number(process.env.PORT):port,hosted?'0.0.0.0':'127.0.0.1',()=>{
    console.log(hosted?`Forja Piloto a escutar na porta ${process.env.PORT}`:`Forja Piloto: http://127.0.0.1:${port}`);
    if(setupToken && !setupCode) console.log(`Código inicial de administrador (15 minutos): ${setupToken}`);
  });
}
