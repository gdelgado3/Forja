import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPilotServer } from './pilot.mjs';

const code='codigo-inicial-de-teste-0123456789';
const {server}=await createPilotServer({database:':memory:',setupCode:code});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
async function call(path,{method='GET',cookie,json,bytes,type}={}) {
  const headers={Origin:base};
  if(cookie)headers.Cookie=cookie;
  if(json)headers['Content-Type']='application/json';
  if(type)headers['Content-Type']=type;
  const res=await fetch(base+'/api/pilot'+path,{method,headers,body:json?JSON.stringify(json):bytes});
  const set=res.headers.get('set-cookie');
  return {status:res.status,cookie:set?set.split(';')[0]:cookie,data:res.headers.get('content-type')?.includes('json')?await res.json():Buffer.from(await res.arrayBuffer())};
}
// O código fixo cria o administrador uma única vez.
assert.equal((await call('/setup',{method:'POST',json:{code:'errado',email:'a@b.pt',password:'palavra-passe-longa'}})).status,403);
const admin=await call('/setup',{method:'POST',json:{code,email:'a@b.pt',password:'palavra-passe-longa'}});
assert.equal(admin.status,201);
assert.equal((await call('/setup',{method:'POST',json:{code,email:'c@d.pt',password:'palavra-passe-longa'}})).status,409);
// Duas contas de demonstração, isoladas entre si.
const one=await call('/demo',{method:'POST',json:{}}),two=await call('/demo',{method:'POST',json:{}});
assert.equal(one.status,201);assert.equal(two.status,201);
const pdf=Buffer.from('%PDF-1.4 teste');
assert.equal((await call('/files/f1',{method:'PUT',cookie:one.cookie,bytes:pdf,type:'application/pdf'})).status,201);
const ws=await call('/workspace',{cookie:one.cookie});
const project={id:'p1',code:'PRJ-1',name:'Portão',client:'Cliente',request:'3 m x 1,8 m',created:'2026-11-15T10:00:00.000Z',demo:false,
  fields:{},files:[{id:'f1',name:'pedido.pdf',type:'application/pdf',size:pdf.length,created:'2026-11-15T10:01:00.000Z'}],events:[],memory:[],lines:[],versions:[]};
assert.equal((await call('/workspace',{method:'PUT',cookie:one.cookie,json:{revision:ws.data.revision,state:{...ws.data.state,projects:[project]}}})).status,200);
// O administrador vê o pedido e o anexo; a oficina não entra na área de administração.
assert.equal((await call('/admin/inbox',{cookie:one.cookie})).status,403);
const inbox=await call('/admin/inbox',{cookie:admin.cookie});
assert.equal(inbox.data.items.length,1);
const item=inbox.data.items[0];
assert.equal(item.files[0].name,'pedido.pdf');
assert.deepEqual((await call(`/admin/files/${item.workshop.id}/f1`,{cookie:admin.cookie})).data,pdf);
// Resposta com ficheiro e nota; só a oficina certa a recebe.
const sent=await call(`/admin/responses/${item.workshop.id}/p1?name=rascunho.pdf&note=Falta%20a%20espessura`,{method:'PUT',cookie:admin.cookie,bytes:pdf,type:'application/pdf'});
assert.equal(sent.status,201);
assert.equal((await call(`/admin/responses/${item.workshop.id}/nao-existe?note=x`,{method:'PUT',cookie:admin.cookie,bytes:Buffer.alloc(0)})).status,404);
const mine=await call('/responses',{cookie:one.cookie});
assert.equal(mine.data.length,1);assert.equal(mine.data[0].note,'Falta a espessura');
assert.deepEqual((await call('/responses/'+sent.data.id,{cookie:one.cookie})).data,pdf);
assert.equal((await call('/responses',{cookie:two.cookie})).data.length,0);
assert.equal((await call('/responses/'+sent.data.id,{cookie:two.cookie})).status,404);
assert.equal((await call('/admin/responses/'+sent.data.id,{method:'DELETE',cookie:admin.cookie})).status,200);
assert.equal((await call('/responses',{cookie:one.cookie})).data.length,0);
server.close();
console.log('PASS: código inicial, demonstração, caixa de pedidos, respostas e isolamento.');
