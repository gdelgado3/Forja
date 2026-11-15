'use strict';
function renderPilotWorkspace() {
  if(view==='detail'&&!project())view='projects';
  const isDetail=view==='detail';
  const projectsHtml=()=>{
    const filtered=state.projects.filter(p=>(p.name+' '+p.client+' '+p.code).toLowerCase().includes(query.toLowerCase()));
    const drawings=state.projects.filter(p=>p.kind==='desenho').length;
    const icon=d=>`<svg class="pilot-menu-icon" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    return `<div class="heading"><div><h1>A tua oficina</h1><p>Do pedido do cliente ao orçamento. Escolhe por onde começar.</p></div></div>
    <div class="pilot-menu">
      <button type="button" class="pilot-menu-card pilot-menu-main" data-action="new">${icon('<path d="M12 5v14M5 12h14"/>')}<strong>Novo orçamento</strong><small>Cola o pedido ou junta o desenho e monta o rascunho.</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-history>${icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}<strong>Histórico</strong><small>${state.projects.length?state.projects.length+' orçamento(s) guardado(s) nesta oficina.':'Os teus orçamentos ficam guardados aqui.'}</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-drawing>${icon('<path d="M3 17l14-14 4 4L7 21H3z"/><path d="M14 6l4 4M5 15l2 2M8 12l2 2M11 9l2 2"/>')}<strong>Pedir desenho técnico</strong><small>${drawings?drawings+' pedido(s) de desenho enviado(s).':'Envia a folha de medidas e as fotos e recebe o alçado cotado.'}</small></button>
    </div>
    <section id="pilot-history"><h2>Histórico</h2>
    ${state.projects.length?`<div class="toolbar"><input class="field search" id="project-search" placeholder="Procurar projeto ou cliente…" value="${esc(query)}" aria-label="Procurar orçamentos"></div>
    <div class="card table-scroll"><table class="project-list"><thead><tr><th>Projeto / Cliente</th><th>Estado</th><th>Valor sem IVA</th><th>Memória</th><th></th></tr></thead><tbody id="project-rows">${projectRows(filtered)}</tbody></table></div>`:
    '<div class="card card-pad"><p>Ainda não há orçamentos. Os que criares ficam guardados aqui, com as versões e a memória de cada obra.</p></div>'}
    ${state.projects.some(p=>p.id==='exemplo')?'':'<p class="pilot-example-link"><button type="button" class="small" data-pilot-example>Experimentar com um pedido de exemplo</button></p>'}</section>`;
  };
  $('#app').innerHTML=`<div class="pilot-office"><header class="pilot-header no-print"><div class="pilot-brand"><span>f</span> Forja</div>
    <strong>${esc(state.settings.company)}</strong><div class="pilot-header-actions">
    ${isDetail?'<button data-action="nav" data-view="projects">Orçamentos anteriores</button>':''}
    <button data-action="export">Exportar cópia</button><button data-pilot-action="logout">Sair</button></div></header>
    <main class="pilot-content"><div class="pilot-sync no-print" id="pilot-save-status" role="status">${esc(window.forjaPilot.status())}</div>
    <section id="pilot-responses" class="no-print"></section>${isDetail?detail(project()):projectsHtml()}${isDetail?pilotPriceCheck(project()):''}${pilotFeedbackHtml()}</main></div>`;
  renderPilotResponses();
}
function renderPilotResponses() {
  const box=document.querySelector('#pilot-responses');
  if(!box)return;
  const current=view==='detail'?project():null;
  const all=window.forjaPilot.responses||[];
  const list=current?all.filter(r=>r.project===current.id):all;
  const when=v=>new Date(v).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
  const label=r=>{const p=state.projects.find(x=>x.id===r.project);return p?esc(p.code+' · '+p.name):'';};
  const rows=list.slice().reverse().map(r=>`<li>${current?'':`<small>${label(r)}</small>`}
    ${r.note?`<p>${esc(r.note)}</p>`:''}
    ${r.name?`<button type="button" data-pilot-action="open-response" data-id="${r.id}" data-name="${esc(r.name)}">Abrir ${esc(r.name)}</button>`:''}
    <small>${when(r.created)}</small></li>`).join('');
  const waiting=current && !current.demo && !list.length && (current.files.length || current.request);
  box.innerHTML=rows?`<div class="card card-pad pilot-answers"><h2>Respostas da Forja</h2><ul>${rows}</ul></div>`:
    waiting?(current.kind==='desenho'?'<div class="card card-pad pilot-answers"><h2>Pedido de desenho recebido</h2><p>A equipa da Forja já tem as medidas e as fotos. O desenho técnico aparece aqui.</p></div>':'<div class="card card-pad pilot-answers"><h2>Pedido recebido</h2><p>A equipa da Forja já consegue ver este pedido. A resposta aparece aqui.</p></div>'):'';
}
window.renderPilotResponses=renderPilotResponses;
function pilotCatalogSelect(unit) {
  const catalog=state.settings.catalog||[];
  const options=catalog.map((row,index)=>({row,index})).filter(({row})=>unit===undefined||row.unit===unit);
  return options.length?`<label>Usar preço da oficina<select class="field" data-pilot-price><option value="">Escolher artigo</option>${options.map(({row:x,index})=>`<option value="${index}">${esc(x.label)} · ${euro(x.price)}/${esc(x.unit)}</option>`).join('')}</select></label>`:'';
}
document.addEventListener('change',event=>{
  const field=event.target;
  if(field.name==='unit' && field.form?.dataset.priceSource) {
    const form=field.form;
    form.querySelector('[data-pilot-price]').value='';
    delete form.dataset.priceSource;
    form.elements.price.value='';
    if(form.elements.source?.value.startsWith('Tabela de preços da oficina'))form.elements.source.value='';
  }
  if(!field.matches('[data-pilot-price]'))return;
  if(field.value==='') {
    const form=field.form;
    if(form.dataset.priceSource) {
      form.elements.price.value='';
      if(form.elements.source?.value===form.dataset.priceSource)form.elements.source.value='';
      delete form.dataset.priceSource;
    }
    return;
  }
  const row=state.settings.catalog[Number(field.value)];
  const form=field.form;
  form.elements.unit.value=row.unit;
  form.elements.price.value=row.price;
  const description=form.elements.description||form.elements.desc;
  if(description && form.id==='line-form')description.value=row.label;
  if(form.elements.source)form.elements.source.value='Tabela de preços da oficina · '+row.label;
  form.dataset.priceSource='Tabela de preços da oficina · '+row.label;
});
document.addEventListener('input',event=>{
  const form=event.target.form;
  if(event.target.name==='price' && form?.dataset.priceSource) {
    if(form.elements.source?.value===form.dataset.priceSource)form.elements.source.value='';
    form.querySelector('[data-pilot-price]').value='';
    delete form.dataset.priceSource;
  }
});

function pilotPriceCheck(p) {
  if(tab!=='orcamento' || !p.lines.length)return '';
  const options=[['under','Abaixo','O rascunho ficou abaixo do preço certo'],['ok','Certo','O rascunho bate com o preço certo'],['over','Acima','O rascunho ficou acima do preço certo']];
  return `<section class="card card-pad pilot-check no-print"><h2>Este rascunho ficou…</h2>
    <div class="pilot-check-options" role="group" aria-label="Avaliar o preço do rascunho">${options.map(([key,label,title])=>
      `<button type="button" data-price-check="${key}" title="${title}" aria-pressed="${p.priceCheck===key}" class="${p.priceCheck===key?'chosen pilot-'+key:''}">${p.priceCheck===key?'✓ ':''}${label}</button>`).join('')}</div>
    <p class="smalltext muted">${p.priceCheck==='under'?'Abaixo do preço certo: é o erro mais caro para a oficina. A Forja aprende a arredondar para cima.':'Marca como ficou face ao preço que darias. Ajuda a Forja a nunca orçar abaixo do custo.'}</p></section>`;
}
let pilotFeedback={rating:null,text:'',sent:false};
function pilotFeedbackHtml() {
  if(pilotFeedback.sent)return '<section class="card card-pad pilot-feedback no-print"><h2>Obrigado pelo feedback!</h2><p>A equipa da Forja vai ler.</p><button type="button" class="small" data-feedback-again>Enviar mais</button></section>';
  return `<section class="card card-pad pilot-feedback no-print"><h2>O que achaste da Forja?</h2>
    <div class="pilot-rating" role="group" aria-label="Nota de 1 a 5">${[1,2,3,4,5].map(n=>`<button type="button" data-feedback-rating="${n}" aria-pressed="${pilotFeedback.rating===n}" class="${pilotFeedback.rating===n?'chosen':''}">${n}</button>`).join('')}<small>1 = não usava · 5 = usava já</small></div>
    <textarea class="field" id="pilot-feedback-text" rows="3" maxlength="2000" placeholder="O que falta? O que não percebeste? O que mudavas?">${esc(pilotFeedback.text)}</textarea>
    <button type="button" class="primary" data-feedback-send>Enviar feedback</button></section>`;
}
function pilotExampleProject() {
  const t=now();
  return {id:'exemplo',code:nextCode(),name:'Prateleiras em inox (exemplo)',client:'Cliente de exemplo',channel:'Email',demo:true,status:'Rascunho',created:t,
    request:'Boa tarde, precisava de um orçamento para 3 prateleiras em inox para uma cozinha. São em L, com 250 mm de profundidade e uma aba de 150 mm. Comprimentos: 1200, 800 e 600 mm. Acabamento escovado. Podem propor a espessura. Obrigado!',
    fields:{type:'Prateleira em L',material:'Inox',width:'1.2',height:'0.25',quantity:'3',finish:'Escovado'},
    lines:[
      {id:uid(),desc:'Chapa inox 2 mm, planificada',qty:1.04,unit:'m²',price:78,source:'Aba 150 + profundidade 250 = 400 mm × (1,20 + 0,80 + 0,60) m · espessura proposta, por confirmar'},
      {id:uid(),desc:'Corte e quinagem',qty:2,unit:'h',price:35,source:'Estimativa de demonstração · validar horas'},
      {id:uid(),desc:'Acabamento escovado',qty:1.04,unit:'m²',price:15,source:'Uma face · 1,04 m²'}],
    markup:state.settings.markup,vat:state.settings.vat,versions:[],files:[],
    memory:[
      {id:uid(),text:'Espessura não indicada no pedido. Proposta: 2 mm.',kind:'Pendente',source:'Pedido inicial · email (exemplo)',created:t},
      {id:uid(),text:'Fixação à parede não indicada. Perguntar se leva suportes ou furos.',kind:'Pendente',source:'Pedido inicial · email (exemplo)',created:t},
      {id:uid(),text:'Quantidade assumida: uma prateleira de cada comprimento.',kind:'Hipótese',source:'Pedido inicial · sem confirmação',created:t}],
    events:[{id:uid(),text:'Projeto de exemplo criado com pedido e custos fictícios.',source:'Forja · demonstração',created:t}]};
}
document.addEventListener('input',event=>{
  if(event.target.id==='pilot-feedback-text')pilotFeedback.text=event.target.value;
});
document.addEventListener('click',async event=>{
  const target=event.target.closest('[data-pilot-example],[data-price-check],[data-feedback-rating],[data-feedback-send],[data-feedback-again],[data-pilot-history],[data-pilot-drawing],[data-pilot-drawing-send]');
  if(!target)return;
  if(target.hasAttribute('data-pilot-history')) {document.querySelector('#pilot-history')?.scrollIntoView({behavior:'smooth'});return;}
  if(target.hasAttribute('data-pilot-drawing')) {
    modal(`${modalHead('Pedir desenho técnico','Envia a folha de medidas e as fotos do local. A equipa da Forja devolve o alçado cotado nesta página.')}
      <div class="pilot-drawing">
      <label>Nome da obra<input class="field" id="pd-name" maxlength="80" placeholder="Ex.: Varanda do 2.º andar"></label>
      <label>Cliente<input class="field" id="pd-client" maxlength="80"></label>
      <label>Medidas e notas<textarea class="field" id="pd-notes" rows="4" maxlength="4000" placeholder="Ex.: vão de 4,57 m × 2,70 m, 7 folhas, recolha à direita…"></textarea></label>
      <label>Folha de medidas e fotos<input class="field" id="pd-files" type="file" multiple accept=".pdf,image/png,image/jpeg,image/webp"></label>
      <p class="smalltext muted">Até 6 ficheiros (PDF ou imagem), 10 MB cada. Tapa os dados pessoais do cliente.</p>
      <p id="pd-status" class="pilot-message" role="alert" hidden></p>
      <div class="pilot-start"><button type="button" class="primary" data-pilot-drawing-send>Pedir desenho</button><button type="button" data-action="close">Cancelar</button></div></div>`);
    return;
  }
  if(target.hasAttribute('data-pilot-drawing-send')) {
    const status=document.querySelector('#pd-status'),say=text=>{status.hidden=!text;status.textContent=text;};
    const name=document.querySelector('#pd-name').value.trim(),client=document.querySelector('#pd-client').value.trim();
    const notes=document.querySelector('#pd-notes').value.trim(),files=[...document.querySelector('#pd-files').files];
    if(!name||!client)return say('Indica o nome da obra e o cliente.');
    if(!notes&&!files.length)return say('Escreve as medidas ou junta a folha de medidas.');
    if(files.length>6)return say('Junta até 6 ficheiros.');
    if(files.some(f=>f.size>10*1024*1024))return say('Cada ficheiro tem de ter menos de 10 MB.');
    target.disabled=true;say('A enviar…');
    try {
      const saved=[];
      for(const f of files){const id=uid();await window.forjaPilot.putFile(id,f);saved.push({id,name:f.name,size:f.size,type:f.type,created:now()});}
      const np={id:uid(),code:nextCode(),name:'Desenho técnico · '+name,client,channel:'Outro',kind:'desenho',request:notes||'Medidas na folha em anexo.',created:now(),demo:false,status:'Rascunho',
        fields:{type:'Desenho técnico',material:'',width:'',height:'',quantity:'1',finish:''},lines:[],markup:state.settings.markup,vat:state.settings.vat,versions:[],files:saved,memory:[],
        events:[{id:uid(),text:'Pedido de desenho técnico enviado à Forja.',source:'Oficina',created:now()}]};
      state.projects.push(np);selected=np.id;view='detail';tab='pedido';closeModal();persist();render();toast('Pedido de desenho enviado.');
    } catch(e) {say(e.message);target.disabled=false;}
    return;
  }
  if(target.hasAttribute('data-pilot-example')) {
    if(!state.projects.some(p=>p.id==='exemplo'))state.projects.push(pilotExampleProject());
    selected='exemplo';view='detail';tab='orcamento';persist();render();
    window.forjaPilot.flush().then(()=>window.forjaPilot.refreshResponses());
  } else if(target.dataset.priceCheck) {
    const p=project();
    p.priceCheck=p.priceCheck===target.dataset.priceCheck?'':target.dataset.priceCheck;
    persist();render();
  } else if(target.dataset.feedbackRating) {
    const n=Number(target.dataset.feedbackRating);
    pilotFeedback.rating=pilotFeedback.rating===n?null:n;render();
  } else if(target.hasAttribute('data-feedback-again')) {
    pilotFeedback={rating:null,text:'',sent:false};render();
  } else {
    if(!pilotFeedback.rating && !pilotFeedback.text.trim()){toast('Escolhe uma nota ou escreve o teu feedback.');return;}
    target.disabled=true;
    try {await window.forjaPilot.sendFeedback({rating:pilotFeedback.rating,text:pilotFeedback.text});pilotFeedback={rating:null,text:'',sent:true};render();}
    catch(e) {toast(e.message);target.disabled=false;}
  }
});
