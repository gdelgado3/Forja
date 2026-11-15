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
    '<section class="card card-pad"><h2>Começa pelo primeiro pedido</h2><p>Junta o pedido e o desenho. Revê os dados e guarda o orçamento nesta oficina.</p><button data-action="new">Criar primeiro orçamento</button></section>'}`;
  };
  $('#app').innerHTML=`<div class="pilot-office"><header class="pilot-header no-print"><div class="pilot-brand"><span>f</span> Forja</div>
    <strong>${esc(state.settings.company)}</strong><div class="pilot-header-actions">
    ${isDetail?'<button data-action="nav" data-view="projects">Orçamentos anteriores</button>':''}
    <button data-action="export">Exportar cópia</button><button data-pilot-action="logout">Sair</button></div></header>
    <main class="pilot-content"><div class="pilot-sync no-print" id="pilot-save-status" role="status">${esc(window.forjaPilot.status())}</div>
    <section id="pilot-responses" class="no-print"></section>${isDetail?detail(project()):projectsHtml()}</main></div>`;
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
  const waiting=current && !list.length && (current.files.length || current.request);
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
