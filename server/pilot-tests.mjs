import assert from 'node:assert/strict';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPilotServer } from './pilot.mjs';

const folder=await mkdtemp(join(tmpdir(),'forja-pilot-'));
const database=join(folder,'test.sqlite');
const password='teste-local-forja-42';
const settings={hour:25,markup:10,vat:23,catalog:[{label:'Corte',unit:'h',price:25}]};
const pdf=await readFile(new URL('../dist/samples/portao-demo.pdf',import.meta.url));
let running,base;
async function start() {
  running=await createPilotServer({database});
  running.server.listen(0,'127.0.0.1');
  await once(running.server,'listening');
  base='http://127.0.0.1:'+running.server.address().port;
}
async function stop() {
  if(!running)return;
  const server=running.server;
  running=null;
  const closed=once(server,'close');
  server.close();
  await closed;
}
async function call(path,status,{method='GET',cookie,body,origin=base,bytes}={}) {
  const headers={Origin:origin};
  if(cookie)headers.Cookie=cookie;
  if(body!==undefined)headers['Content-Type']='application/json';
  if(bytes)headers['Content-Type']='application/pdf';
  const response=await fetch(base+'/api/pilot'+path,{method,headers,body:bytes??JSON.stringify(body)});
  const type=response.headers.get('content-type');
  const data=type?.startsWith('application/json') ? await response.json() : Buffer.from(await response.arrayBuffer());
  if(status!==null)assert.equal(response.status,status,`${method} ${path}: ${data?.error||response.status}`);
  return {data,status:response.status,cookie:response.headers.get('set-cookie')?.split(';')[0]};
}
const post=(path,status,body,cookie)=>call(path,status,{method:'POST',body,cookie});
const workspace=cookie=>call('/workspace',200,{cookie}).then(r=>r.data);
const save=(cookie,body,status=200)=>call('/workspace',status,{method:'PUT',body,cookie});
try {
  await start();
  const homepage=await fetch(base+'/');
  assert.match(await homepage.text(),/\/pilot\/start\.mjs/);
  assert.equal((await fetch(base+'/server/pilot.mjs')).status,404);
  await call('/workspace',401);
  await call('/setup',403,{method:'POST',body:{},origin:'http://outra-origem.invalid'});
  const admin=(await post('/setup',201,{email:'admin@example.test',password,code:running.setupToken})).cookie;
  assert.ok(admin);
  await post('/setup',409,{email:'outro@example.test',password,code:running.setupToken});
  await call('/workspace',403,{cookie:admin});

  const create=async name=>{
    const email=name.toLowerCase()+'@example.test';
    const {data}=await post('/admin/workshops',201,{name,email,settings},admin);
    const {cookie}=await post('/activate',200,{invite:data.invite,password});
    await post('/activate',400,{invite:data.invite,password});
    return {id:data.id,cookie,email};
  };
  const a=await create('OficinaA');
  const b=await create('OficinaB');
  await call('/admin/workshops',403,{cookie:a.cookie});
  const first=await workspace(a.cookie);
  assert.equal(first.state.settings.company,'OficinaA');
  const line={id:'linha',desc:'Corte',qty:2,unit:'h',price:25,source:'Tabela da oficina'};
  first.state.projects.push({id:'projeto',code:'PRJ-001',name:'Portão de demonstração',fields:{},
    files:[{id:'ficheiro'}],lines:[line],versions:[{id:'versao',lines:[line]}],events:[],memory:[]});
  await save(a.cookie,first,400);
  await call('/files/ficheiro',201,{method:'PUT',cookie:a.cookie,bytes:pdf});
  await call('/files/ficheiro',404,{cookie:b.cookie});
  await call('/files/ficheiro',403,{cookie:admin});
  assert.deepEqual((await call('/files/ficheiro',200,{cookie:a.cookie})).data,pdf);

  first.state.settings.hour=999;
  const attempts=await Promise.all([save(a.cookie,first,null),save(a.cookie,first,null)]);
  assert.deepEqual(attempts.map(a=>a.status).sort(),[200,409]);
  await save(a.cookie,first,409);
  assert.equal((await workspace(a.cookie)).state.settings.hour,25);
  assert.deepEqual((await workspace(b.cookie)).state.projects,[]);
  const other=await workspace(b.cookie);
  other.state.projects=first.state.projects;
  await save(b.cookie,other,400);
  const stats=(await call('/admin/workshops',200,{cookie:admin})).data;
  const counts=stats.find(x=>x.id===a.id);
  assert.deepEqual([counts.requests,counts.drafts,counts.savedQuotes,counts.accepted],[1,1,1,0]);
  assert.ok(counts.lastUse);
  assert.equal(stats.find(x=>x.id===b.id).requests,0);
  assert.equal(Object.hasOwn(counts,'projects'),false);

  const invite=(await post('/admin/workshops/'+a.id+'/invite',200,{},admin)).data.invite;
  const renewed=(await post('/activate',200,{invite,password})).cookie;
  await call('/workspace',401,{cookie:a.cookie});
  await stop();
  await start();
  assert.equal(running.setupToken,null);
  assert.equal((await workspace(renewed)).state.projects.length,1);
  await post('/logout',200,{},renewed);
  await call('/workspace',401,{cookie:renewed});
  const again=(await post('/login',200,{email:a.email,password})).cookie;
  assert.equal((await workspace(again)).state.projects.length,1);
  console.log('PASS: convites, sessões, duas oficinas, anexos, painel, concorrência e persistência após reinício.');
} finally {
  await stop();
  await rm(folder,{recursive:true,force:true});
}
