import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(process.argv[2] || '.');
const files = await Promise.all(['dist/app.js','dist/interpret.js'].map(async path=>{
  const original = await readFile(resolve(root,path),'utf8');
  return {path,original,source:original};
}));
const [app,reader] = files;
function edit(file,before,after) {
  const parts = file.source.split(before);
  if(parts.length!==2) throw Error(`${file.path}: ponto de integração incompatível (${before.slice(0,80)}). Nenhum ficheiro foi escrito.`);
  file.source=parts.join(after);
}
if(app.original.includes('renderPilotWorkspace()')) {
  if(!reader.original.includes('pilotCatalogSelect(r.unit)')) throw Error('Integração parcial. Verifica os ficheiros antes de continuar.');
  console.log('O modo piloto já está integrado.');
} else {
  edit(app,"let state;try{","let state;if(globalThis.forjaPilot)state=globalThis.forjaPilot.initialState;else try{");
  edit(app,"let view='detail',tab=","let view=globalThis.forjaPilot?'projects':'detail',tab=");
  edit(app,"function persist(){","function persist(){if(globalThis.forjaPilot)return globalThis.forjaPilot.save(state);");
  edit(app,"function render(){","function render(){if(globalThis.forjaPilot){renderPilotWorkspace();return;}");
  edit(app,"async function filePut(id,blob){","async function filePut(id,blob){if(globalThis.forjaPilot)return globalThis.forjaPilot.putFile(id,blob);");
  edit(app,"async function fileGet(id){","async function fileGet(id){if(globalThis.forjaPilot)return globalThis.forjaPilot.getFile(id);");
  edit(app,"['pedido','Pedido e dados',''],['interpretar','Interpretar ficheiros',''],['orcamento','Orçamento',","['pedido',globalThis.forjaPilot?'1. Pedido':'Pedido e dados',''],['interpretar',globalThis.forjaPilot?'2. Medidas':'Interpretar ficheiros',''],['orcamento',globalThis.forjaPilot?'3. Orçamento':'Orçamento',");
  edit(app,"modalHead('Um novo projeto',","modalHead(globalThis.forjaPilot?'Novo orçamento':'Um novo projeto',");
  edit(app,"${buttons('Criar projeto →')}","${globalThis.forjaPilot?'<label>Desenho em PDF (opcional)<input class=\"field\" name=\"drawing\" type=\"file\" accept=\".pdf,application/pdf\"></label>':''}${buttons(globalThis.forjaPilot?'Criar orçamento':'Criar projeto →')}");
  edit(app,"name=\"request\" required placeholder=\"Cola o pedido","name=\"request\" ${globalThis.forjaPilot?'':'required'} placeholder=\"Cola o pedido");
  edit(app,"if(form.id==='new-form'){const np=","if(form.id==='new-form'){const drawing=globalThis.forjaPilot&&f.get('drawing');const np=");
  edit(app,"if(!np.name||!np.client||!np.request){toast('Preenche nome, cliente e pedido.');return}","if(!np.name||!np.client||(!np.request&&!drawing?.size)){toast(globalThis.forjaPilot?'Indica o nome, o cliente e o pedido ou desenho.':'Preenche nome, cliente e pedido.');return}");
  edit(app,"<form id=\"line-form\"><label>","<form id=\"line-form\">${globalThis.forjaPilot?pilotCatalogSelect():''}<label>");
  edit(app,"<option>m²</option><option>kg</option>","<option>m²</option><option>m³</option><option>kg</option>");
  edit(app,"addEventListener('submit',e=>{e.preventDefault();const form=e.target;","addEventListener('submit',async e=>{e.preventDefault();const form=e.target;");
  edit(app,"toast('Projeto criado. Podes extrair os dados do texto.');return}","if(drawing?.size){await runAnalysis(drawing)}else toast(globalThis.forjaPilot?'Orçamento criado. Podes rever o pedido e adicionar medidas.':'Projeto criado. Podes extrair os dados do texto.');return}");
  edit(app,"Anexos guardados localmente. Abre “Interpretar ficheiros” para analisar um anexo.","${globalThis.forjaPilot?'Anexos guardados na oficina. Abre “Medidas” para analisar um anexo.':'Anexos guardados localmente. Abre “Interpretar ficheiros” para analisar um anexo.'}");
  edit(reader,'name="description" value="${esc(r.label)}"></label>`', 'name="description" value="${esc(r.label)}"></label>${globalThis.forjaPilot?pilotCatalogSelect(r.unit):\'\'}`');
  edit(reader,'${r.source} · revisto: ${verification}`','${r.source} · revisto: ${verification}${destination===\'quote\'&&e.target.dataset.priceSource?\' · \'+e.target.dataset.priceSource:\'\'}`');
  if(reader.source.includes('await pdf.destroy()')) {
    edit(reader,'const pdf=await pdfjs.getDocument(', 'const loading=pdfjs.getDocument(');
    edit(reader,"wasmUrl:'/vendor/pdf/wasm/'}).promise;try{const out=", "wasmUrl:'/vendor/pdf/wasm/'});try{const pdf=await loading.promise;const out=");
    edit(reader,'await pdf.destroy()', 'await loading.destroy()');
  }
  await mkdir(resolve(root,'copia-antes-piloto'),{recursive:false});
  for(const f of files) await writeFile(resolve(root,'copia-antes-piloto',f.path.split('/').at(-1)),f.original,{flag:'wx'});
  for(const f of files) await writeFile(resolve(root,f.path),f.source);
  console.log('Modo piloto integrado. Os originais estão em copia-antes-piloto.');
}
