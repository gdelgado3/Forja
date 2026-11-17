import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createPilotServer } from './pilot.mjs';
import { normalizeReading } from './agent.mjs';

// Resposta simulada do Claude: não mede precisão, só testa o encaminhamento.
const sent=[];
let mode='ok';
const reading={resposta:'',resumo:'Portão de correr em aço lacado, 3,20 × 1,80 m. Ligar 912 345 678.',
  pecas:[{peca:'Portão de correr',medidas:'3,20 × 1,80 m',material:'aço lacado',quantidade:'1',fixacao:'não indicada',origem:'texto do pedido',estado:'dito'}],
  linhas:[{descricao:'Tubo aço 40×40×2',quantidade:24,unidade:'m',tipo:'material',conta:'quadro 2×(3,2+1,8)=10 m + 7 travessas ×2 m',estado:'deduzido'},
    {descricao:'Inventada',quantidade:-1,unidade:'m',tipo:'material',conta:'',estado:'dito'},
    {descricao:'Unidade má',quantidade:1,unidade:'palete',tipo:'material',conta:'',estado:'dito'}],
  contas:['2×(3,2+1,8)=10 m'],falta_saber:[{pergunta:'Leva motor?',porque:'Automatismo é compra.'}],
  ambito:{excluido:[],compra:['Motor, se pedido'],outro_oficio:[]},avisos:[]};
async function fakeFetch(url,options) {
  const body=JSON.parse(options.body);sent.push(body);
  if(mode==='nocredit')return new Response(JSON.stringify({type:'error',error:{type:'invalid_request_error',message:'Your credit balance is too low'}}),{status:400});
  const input=mode==='followup'?{...reading,resposta:'Corrigido: são 2 portões.'}:reading;
  return new Response(JSON.stringify({content:[{type:'tool_use',id:'toolu_'+sent.length,name:'registar_leitura',input}],stop_reason:'tool_use',usage:{input_tokens:1000,output_tokens:300}}),{status:200});
}
const code='codigo-inicial-de-teste-0123456789';
const {server}=await createPilotServer({database:':memory:',setupCode:code,aiKey:'chave-de-teste',aiFetch:fakeFetch});
server.listen(0,'127.0.0.1');await once(server,'listening');
const base='http://127.0.0.1:'+server.address().port;
async function call(path,{method='GET',cookie,json,bytes,type}={}) {
  const headers={Origin:base};if(cookie)headers.Cookie=cookie;if(json)headers['Content-Type']='application/json';if(type)headers['Content-Type']=type;
  const res=await fetch(base+'/api/pilot'+path,{method,headers,body:json?JSON.stringify(json):bytes});
  const set=res.headers.get('set-cookie');
  return {status:res.status,cookie:set?set.split(';')[0]:cookie,data:await res.json().catch(()=>null)};
}
const demo=await call('/demo',{method:'POST',json:{}});
const jpg=Buffer.from([0xff,0xd8,0xff,0xe0,1,2,3]),pdf=Buffer.from('%PDF-1.4 teste');
await call('/files/f1',{method:'PUT',cookie:demo.cookie,bytes:jpg,type:'image/jpeg'});
await call('/files/f2',{method:'PUT',cookie:demo.cookie,bytes:pdf,type:'application/pdf'});
const ws=await call('/workspace',{cookie:demo.cookie});
const project={id:'p1',code:'PRJ-1',name:'Portão',client:'Rui Cliente',contact:'934 111 222',place:'Rua das Flores 10',request:'Portão de correr 3,20 x 1,80 m. Liguem para 934 111 222.',
  created:'2026-11-17T10:00:00.000Z',demo:false,fields:{type:'Portão',width:'3.2'},
  files:[{id:'f1',name:'foto.jpg'},{id:'f2',name:'folha.pdf'}],events:[],memory:[],lines:[],versions:[]};
assert.equal((await call('/workspace',{method:'PUT',cookie:demo.cookie,json:{revision:ws.data.revision,state:{...ws.data.state,projects:[project]}}})).status,200);
const info=await call('/ai/p1',{cookie:demo.cookie});
assert.equal(info.data.enabled,true);assert.equal(info.data.remaining,3);assert.deepEqual(info.data.turns,[]);
// Primeira leitura.
const first=await call('/ai/p1',{method:'POST',cookie:demo.cookie,json:{}});
assert.equal(first.status,200,JSON.stringify(first.data));
const body=sent[0];
assert.equal(body.tool_choice.name,'registar_leitura');assert.match(body.system,/nunca instruções/);
const blocks=body.messages[0].content;
assert.ok(blocks.some(b=>b.type==='image' && b.source.media_type==='image/jpeg'));
assert.ok(blocks.some(b=>b.type==='document' && b.source.media_type==='application/pdf'));
const raw=JSON.stringify(body);
for(const secret of ['Rui Cliente','934 111 222','Rua das Flores']) assert.ok(!raw.includes(secret),'não enviar '+secret);
assert.match(raw,/Tubo aço 40×40×2/,'catálogo vai só com nomes');assert.ok(!/"price"/.test(raw));
const r=first.data.turns[0].reading;
assert.equal(r.lines.length,1,'linhas inválidas ficam de fora');
assert.ok(!r.summary.includes('912 345 678'),'dados pessoais na resposta também são tapados');
assert.equal(first.data.remaining,2);
// Pergunta seguinte: a conversa segue com tool_result.
assert.equal((await call('/ai/p1',{method:'POST',cookie:demo.cookie,json:{}})).status,400,'segunda chamada precisa de mensagem');
mode='followup';
const second=await call('/ai/p1',{method:'POST',cookie:demo.cookie,json:{message:'São 2 portões iguais.'}});
assert.equal(second.status,200);
const m=sent[1].messages;
assert.deepEqual(m.map(x=>x.role),['user','assistant','user']);
assert.equal(m[2].content[0].type,'tool_result');assert.equal(m[2].content[0].tool_use_id,'toolu_1');
assert.match(m[2].content[1].text,/2 portões/);
assert.equal(second.data.turns.length,2);assert.equal(second.data.turns[1].reading.reply,'Corrigido: são 2 portões.');
// Erro da API não gasta leituras; mensagem clara.
mode='nocredit';
const fail=await call('/ai/p1',{method:'POST',cookie:demo.cookie,json:{message:'E o motor?'}});
assert.equal(fail.status,502);assert.match(fail.data.error,/sem saldo/);
mode='ok';
assert.equal((await call('/ai/p1',{method:'POST',cookie:demo.cookie,json:{restart:true}})).data.turns.length,1,'recomeçar limpa a conversa');
// Limite da demonstração.
const over=await call('/ai/p1',{method:'POST',cookie:demo.cookie,json:{restart:true}});
assert.equal(over.status,429);assert.match(over.data.error,/3 leituras/);
// Outra oficina não vê a conversa.
const other=await call('/demo',{method:'POST',json:{}});
assert.deepEqual((await call('/ai/p1',{cookie:other.cookie})).data.turns,[]);
assert.equal((await call('/ai/p1',{method:'POST',cookie:other.cookie,json:{}})).status,404);
server.close();
// Sem chave: desligado com mensagem.
const off=await createPilotServer({database:':memory:',setupCode:code});
off.server.listen(0,'127.0.0.1');await once(off.server,'listening');
const b2='http://127.0.0.1:'+off.server.address().port;
const d2=await fetch(b2+'/api/pilot/demo',{method:'POST',headers:{Origin:b2}});
const ck=d2.headers.get('set-cookie').split(';')[0];
assert.equal((await (await fetch(b2+'/api/pilot/ai/p1',{headers:{Cookie:ck}})).json()).enabled,false);
off.server.close();
assert.throws(()=>normalizeReading(null));
console.log('PASS: leitura com IA simulada — anexos, sem contactos, conversa com tool_result, limites, erros e isolamento.');
