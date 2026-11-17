import assert from 'node:assert/strict';
import { callClaude, pickModel } from './agent.mjs';
assert.equal(pickModel(['claude-opus-9','claude-sonnet-9','claude-sonnet-8'],'nao-existe'),'claude-sonnet-9');
assert.equal(pickModel(['a','b'],'b'),'b');
const seen=[];
const fake=async(url,o)=>{
  if(url.includes('/v1/models'))return new Response(JSON.stringify({data:[{id:'claude-sonnet-9'},{id:'claude-haiku-9'}]}));
  const b=JSON.parse(o.body);seen.push(b.model);
  if(b.model!=='claude-sonnet-9')return new Response(JSON.stringify({type:'error',error:{type:'not_found_error',message:'model: nao-existe'}}),{status:404});
  return new Response(JSON.stringify({content:[{type:'tool_use',id:'t1',name:'registar_leitura',input:{resposta:'',resumo:'ok',pecas:[],linhas:[],contas:[],falta_saber:[],ambito:{excluido:[],compra:[],outro_oficio:[]},avisos:[]}}],stop_reason:'tool_use'}));
};
const r=await callClaude([{role:'user',content:'x'}],{apiKey:'k',model:'nao-existe',fetchImpl:fake});
assert.equal(r.model,'claude-sonnet-9');assert.deepEqual(seen,['nao-existe','claude-sonnet-9']);
await callClaude([{role:'user',content:'x'}],{apiKey:'k',model:'nao-existe',fetchImpl:fake});
assert.deepEqual(seen.slice(2),['claude-sonnet-9'],'lembra o modelo que funcionou');
console.log('PASS: modelo inexistente → escolhe um Sonnet disponível e lembra-o.');
// Streaming: a resposta chega em eventos SSE e a ferramenta vem em pedaços de JSON.
{
  const input={resposta:'',resumo:'Portão',pecas:[],linhas:[{descricao:'Tubo',quantidade:2,unidade:'m',tipo:'material',conta:'1+1',estado:'dito'}],contas:[],falta_saber:[],ambito:{excluido:[],compra:[],outro_oficio:[]},avisos:[]};
  const json=JSON.stringify(input),half=Math.floor(json.length/2);
  const events=[
    {type:'message_start',message:{usage:{input_tokens:10}}},
    {type:'content_block_start',index:0,content_block:{type:'thinking',thinking:''}},
    {type:'content_block_delta',index:0,delta:{type:'thinking_delta',thinking:'a pensar'}},
    {type:'content_block_delta',index:0,delta:{type:'signature_delta',signature:'sig'}},
    {type:'content_block_start',index:1,content_block:{type:'tool_use',id:'toolu_s',name:'registar_leitura',input:{}}},
    {type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:json.slice(0,half)}},
    {type:'content_block_delta',index:1,delta:{type:'input_json_delta',partial_json:json.slice(half)}},
    {type:'message_delta',delta:{stop_reason:'tool_use'},usage:{output_tokens:50}},
  ];
  const sse=events.map(e=>`event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
  let sentBody=[];
  const fake=async(url,o)=>{const b=JSON.parse(o.body);sentBody.push(b);
    if(b.thinking && sentBody.length===1)return new Response(JSON.stringify({type:'error',error:{type:'invalid_request_error',message:'thinking.budget_tokens: not supported'}}),{status:400});
    return new Response(sse,{headers:{'content-type':'text/event-stream'}});};
  const r=await callClaude([{role:'user',content:'x'}],{apiKey:'k',model:'claude-sonnet-9',fetchImpl:fake});
  assert.equal(r.reading.lines.length,1);assert.equal(r.usage.output_tokens,50);
  assert.deepEqual(r.content.map(b=>b.type),['thinking','tool_use']);assert.equal(r.content[0].signature,'sig');
  assert.equal(sentBody[0].stream,true);assert.ok(sentBody[0].thinking);assert.equal(sentBody[1].thinking,undefined,'sem raciocínio alargado na segunda tentativa');
  console.log('PASS: streaming com raciocínio e JSON em pedaços; recua quando o modelo não aceita o raciocínio.');
}
