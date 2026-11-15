'use strict';
function renderPilotWorkspace() {
  if(view==='detail'&&!project())view='projects';
  const isDetail=view==='detail';
  const projectsHtml=()=>{
    const filtered=state.projects.filter(p=>(p.name+' '+p.client+' '+p.code).toLowerCase().includes(query.toLowerCase()));
    return `<div class="heading"><div><h1>Orçamentos</h1><p>Consulta os teus trabalhos ou prepara um novo orçamento.</p></div>
    <button class="primary" data-action="new">Novo orçamento</button></div>
    ${state.projects.length?`<div class="toolbar"><input class="field search" id="project-search" placeholder="Procurar projeto ou cliente…" value="${esc(query)}" aria-label="Procurar orçamentos"></div>
    <div class="card table-scroll"><table class="project-list"><thead><tr><th>Projeto / Cliente</th><th>Estado</th><th>Valor sem IVA</th><th>Memória</th><th></th></tr></thead><tbody id="project-rows">${projectRows(filtered)}</tbody></table></div>`:
    '<section class="card card-pad"><h2>Começa pelo primeiro pedido</h2><p>Junta o pedido e o desenho. Revê os dados e guarda o orçamento nesta oficina.</p><div class="pilot-start"><button class="primary" data-action="new">Criar primeiro orçamento</button><button data-pilot-example>Experimentar com um pedido de exemplo</button></div></section>'}
    ${state.projects.length&&!state.projects.some(p=>p.id==='exemplo')?'<p class="pilot-example-link"><button class="small" data-pilot-example>Abrir um pedido de exemplo</button></p>':''}`;
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
    waiting?'<div class="card card-pad pilot-answers"><h2>Pedido recebido</h2><p>A equipa da Forja já consegue ver este pedido. A resposta aparece aqui.</p></div>':'';
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
  const target=event.target.closest('[data-pilot-example],[data-price-check],[data-feedback-rating],[data-feedback-send],[data-feedback-again]');
  if(!target)return;
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
