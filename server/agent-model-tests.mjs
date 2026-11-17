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
