import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPilotServer } from './pilot.mjs';

const code='codigo-inicial-de-teste-0123456789';
const {server}=await createPilotServer({database:':memory:',setupCode:code});
server.listen(0,'127.0.0.1');
await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
async function call(path,{method='GET',cookie,json,bytes,type,prefix='/api/pilot'}={}) {
  const headers={Origin:base};
  if(cookie)headers.Cookie=cookie;
  if(json)headers['Content-Type']='application/json';
  if(type)headers['Content-Type']=type;
  const res=await fetch(base+prefix+path,{method,headers,body:json?JSON.stringify(json):bytes});
  const set=res.headers.get('set-cookie');
  return {status:res.status,cookie:set?set.split(';')[0]:cookie,data:res.headers.get('content-type')?.includes('json')?await res.json():Buffer.from(await res.arrayBuffer())};
}
const pub=(path,opts={})=>call(path,{...opts,prefix:'/api/public'});
const admin=await call('/setup',{method:'POST',json:{code,email:'a@b.pt',password:'palavra-passe-longa'}});
const one=await call('/demo',{method:'POST',json:{}}),two=await call('/demo',{method:'POST',json:{}});
const ws=await call('/workspace',{cookie:one.cookie});
const formToken=ws.data.formToken;
assert.match(formToken,/^[a-f0-9]{24}$/);
assert.equal((await call('/workspace',{cookie:one.cookie})).data.formToken,formToken,'o link não muda');
// Página e nome da oficina.
const page=await fetch(base+'/pedido/'+formToken);
assert.equal(page.status,200);assert.match(await page.text(),/Pedir orçamento/);
assert.equal((await fetch(base+'/pedido/naoexiste')).status,404);
assert.equal((await pub('/oficina/'+formToken)).data.name,ws.data.state.settings.company);
assert.equal((await pub('/oficina/'+'0'.repeat(24))).status,404);
// Validação do pedido.
const good={name:'Ana Exemplo',phone:'+351 910 000 000',email:'',type:'Portão',place:'Sintra',measures:'3,20 x 1,80 m',description:'Portão de correr em aço lacado.',consent:true,website:''};
assert.equal((await pub('/pedido/'+formToken,{method:'POST',json:{...good,consent:false}})).status,400);
assert.equal((await pub('/pedido/'+formToken,{method:'POST',json:{...good,phone:'',email:''}})).status,400);
const noOrigin=await fetch(base+'/api/public/pedido/'+formToken,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(good)});
assert.equal(noOrigin.status,403,'só a partir da própria página');
// Honeypot: responde como se fosse válido, mas não guarda nada.
const bot=await pub('/pedido/'+formToken,{method:'POST',json:{...good,website:'http://spam'}});
assert.equal(bot.status,201);
const made=await pub('/pedido/'+formToken,{method:'POST',json:good});
assert.equal(made.status,201);
const {id,uploadKey}=made.data;
const jpg=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3]);
assert.equal((await pub(`/pedido/${formToken}/${id}/files?key=${'0'.repeat(64)}&name=a.jpg`,{method:'PUT',bytes:jpg,type:'image/jpeg'})).status,404,'chave errada');
assert.equal((await pub(`/pedido/${formToken}/${id}/files?key=${uploadKey}&name=a.exe`,{method:'PUT',bytes:jpg,type:'application/x-msdownload'})).status,415);
assert.equal((await pub(`/pedido/${formToken}/${id}/files?key=${uploadKey}&name=foto.jpg`,{method:'PUT',bytes:jpg,type:'image/jpeg'})).status,201);
// Antes de enviar, a oficina ainda não vê nada.
assert.equal((await call('/requests',{cookie:one.cookie})).data.length,0);
assert.equal((await pub(`/pedido/${formToken}/${id}/submit?key=${uploadKey}`,{method:'POST'})).status,200);
assert.equal((await pub(`/pedido/${formToken}/${id}/submit?key=${uploadKey}`,{method:'POST'})).status,409);
assert.equal((await pub(`/pedido/${formToken}/${id}/files?key=${uploadKey}&name=b.jpg`,{method:'PUT',bytes:jpg,type:'image/jpeg'})).status,409);
// Só a oficina certa recebe o pedido.
const list=await call('/requests',{cookie:one.cookie});
assert.equal(list.data.length,1);
const r=list.data[0];
assert.equal(r.id,'pub-'+id);assert.equal(r.client,'Ana Exemplo');assert.match(r.request,/Medidas indicadas pelo cliente: 3,20/);
assert.equal(r.files.length,1);
assert.equal((await call('/requests',{cookie:two.cookie})).data.length,0);
assert.equal((await call('/files/'+r.files[0].id,{cookie:two.cookie})).status,404);
assert.deepEqual((await call('/files/'+r.files[0].id,{cookie:one.cookie})).data,jpg);
// O administrador vê o pedido mesmo antes de a oficina o importar e pode responder.
const inbox=await call('/admin/inbox',{cookie:admin.cookie});
const item=inbox.data.items.find(x=>x.project.id==='pub-'+id);
assert.ok(item);assert.equal(item.files.length,1);
assert.equal((await call(`/admin/responses/${item.workshop.id}/pub-${id}?note=Recebido`,{method:'PUT',cookie:admin.cookie,bytes:Buffer.alloc(0)})).status,201);
// Importar: só depois de guardado no estado da oficina.
assert.equal((await call(`/requests/pub-${id}/imported`,{method:'POST',cookie:one.cookie,json:{}})).status,409);
const project={id:r.id,code:'PRJ-1',name:'Portão · Ana',client:r.client,contact:r.contact,request:r.request,created:r.created,demo:false,
  fields:{},files:r.files,events:[],memory:[],lines:[],versions:[]};
const ws2=await call('/workspace',{cookie:one.cookie});
assert.equal((await call('/workspace',{method:'PUT',cookie:one.cookie,json:{revision:ws2.data.revision,state:{...ws2.data.state,projects:[project]}}})).status,200);
assert.equal((await call(`/requests/pub-${id}/imported`,{method:'POST',cookie:one.cookie,json:{}})).status,200);
assert.equal((await call('/requests',{cookie:one.cookie})).data.length,0);
const inbox2=await call('/admin/inbox',{cookie:admin.cookie});
assert.equal(inbox2.data.items.filter(x=>x.project.id==='pub-'+id).length,1,'sem duplicados depois de importar');
assert.equal(inbox2.data.items.find(x=>x.project.id==='pub-'+id).responses.length,1);
// Zonas de proteção de dados.
assert.equal((await call('/privacy',{method:'PUT',cookie:one.cookie,json:{zones:[{x:0.5,y:0,w:0.6,h:0.1}]}})).status,400);
assert.equal((await call('/privacy',{method:'PUT',cookie:one.cookie,json:{zones:Array(6).fill({x:0,y:0,w:.1,h:.1})}})).status,400);
assert.equal((await call('/privacy',{method:'PUT',cookie:one.cookie,json:{zones:[{x:0.6,y:0,w:0.4,h:0.12}]}})).status,200);
const ws3=await call('/workspace',{cookie:one.cookie});
assert.deepEqual(ws3.data.state.settings.privacy.zones,[{x:0.6,y:0,w:0.4,h:0.12}]);
// Guardar a oficina não apaga as zonas; mudar preços no administrador também não.
assert.equal((await call('/workspace',{method:'PUT',cookie:one.cookie,json:{revision:ws3.data.revision,state:{...ws3.data.state,settings:{}}}})).status,200);
await call(`/admin/workshops/${item.workshop.id}/prices`,{method:'POST',cookie:admin.cookie,json:{hour:40,markup:20,vat:23,catalog:[]}});
assert.equal((await call('/workspace',{cookie:one.cookie})).data.state.settings.privacy.zones.length,1);
// Limite por IP.
let last;
for(let i=0;i<12;i++) last=await pub('/pedido/'+formToken,{method:'POST',json:good});
assert.equal(last.status,429);
server.close();
console.log('PASS: formulário público, anexos, importação, caixa do administrador, zonas e limites.');
