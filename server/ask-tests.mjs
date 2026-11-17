import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPilotServer } from './pilot.mjs';
const {server}=await createPilotServer({database:':memory:',setupCode:'codigo-inicial-de-teste-0123456789'});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
async function call(path,{method='GET',cookie,json,prefix='/api/pilot'}={}) {
  const headers={Origin:base};if(cookie)headers.Cookie=cookie;if(json)headers['Content-Type']='application/json';
  const res=await fetch(base+prefix+path,{method,headers,body:json?JSON.stringify(json):undefined});
  const set=res.headers.get('set-cookie');
  return {status:res.status,cookie:set?set.split(';')[0]:cookie,data:await res.json().catch(()=>null)};
}
const a=await call('/demo',{method:'POST',json:{}}),b=await call('/demo',{method:'POST',json:{}});
assert.equal((await call('/ask/exemplo',{method:'POST',cookie:a.cookie,json:{questions:['Espessura?']}})).status,404,'só projetos guardados');
const ws=await call('/workspace',{cookie:a.cookie});
const p={id:'p1',code:'PRJ-1',name:'Portão',request:'x',created:'2026-11-17T10:00:00.000Z',demo:false,fields:{},files:[],events:[],memory:[],lines:[],versions:[]};
await call('/workspace',{method:'PUT',cookie:a.cookie,json:{revision:ws.data.revision,state:{...ws.data.state,projects:[p]}}});
assert.equal((await call('/ask/p1',{method:'POST',cookie:a.cookie,json:{questions:[]}})).status,400);
const made=await call('/ask/p1',{method:'POST',cookie:a.cookie,json:{questions:['Que espessura?','Leva motor?']}});
assert.equal(made.status,201);assert.match(made.data.url,/^\/responder\/[a-f0-9]{32}$/);
const tok=made.data.id;
const page=await fetch(base+'/responder/'+tok);assert.equal(page.status,200);assert.match(await page.text(),/Enviar respostas/);
const pub=await call('/perguntas/'+tok,{prefix:'/api/public'});
assert.deepEqual(pub.data.questions,['Que espessura?','Leva motor?']);assert.equal(pub.data.answers,null);assert.ok(pub.data.name);
assert.equal((await call('/perguntas/'+'0'.repeat(32),{prefix:'/api/public'})).status,404);
assert.equal((await call('/perguntas/'+tok,{method:'POST',prefix:'/api/public',json:{answers:['','']}})).status,400);
assert.equal((await call('/perguntas/'+tok,{method:'POST',prefix:'/api/public',json:{answers:['só uma']}})).status,400);
assert.equal((await call('/perguntas/'+tok,{method:'POST',prefix:'/api/public',json:{answers:['2 mm','']}})).status,200);
const list=await call('/ask/p1',{cookie:a.cookie});
assert.deepEqual(list.data[0].answers,['2 mm','']);assert.ok(list.data[0].answered);
assert.deepEqual((await call('/ask/p1',{cookie:b.cookie})).data,[],'outra oficina não vê');
// O cliente pode corrigir.
await call('/perguntas/'+tok,{method:'POST',prefix:'/api/public',json:{answers:['3 mm','Não']}});
assert.deepEqual((await call('/ask/p1',{cookie:a.cookie})).data[0].answers,['3 mm','Não']);
server.close();
console.log('PASS: perguntar ao cliente — link, página, respostas, correção e isolamento.');
