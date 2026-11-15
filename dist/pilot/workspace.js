'use strict';
function renderPilotWorkspace() {
  if(view==='detail'&&!project())view='projects';
  const isDetail=view==='detail';
  const projectsHtml=()=>{
    const filtered=state.projects.filter(p=>(p.name+' '+p.client+' '+p.code).toLowerCase().includes(query.toLowerCase()));
    const drawings=state.projects.filter(p=>p.kind==='desenho').length;
    const icon=d=>`<svg class="pilot-menu-icon" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    return `<div class="heading"><div><h1>A tua oficina</h1><p>Do pedido do cliente ao orçamento. Escolhe por onde começar.</p></div></div>
    ${window.forjaPilot.demo&&!state.projects.some(p=>p.id==='exemplo')?`<button type="button" class="pilot-try-example" data-pilot-example><span class="pilot-try-badge">Começa aqui</span><strong>Experimentar com um pedido de exemplo</strong><small>Abre um pedido já lido pela Forja, com o rascunho do orçamento pronto. Demora 10 segundos.</small><span class="pilot-try-arrow" aria-hidden="true">→</span></button>`:''}
    <div class="pilot-menu">
      <button type="button" class="pilot-menu-card pilot-menu-main" data-action="new">${icon('<path d="M12 5v14M5 12h14"/>')}<strong>Novo orçamento</strong><small>Cola o pedido ou junta o desenho e monta o rascunho.</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-history>${icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}<strong>Histórico</strong><small>${state.projects.length?state.projects.length+' orçamento(s) guardado(s) nesta oficina.':'Os teus orçamentos ficam guardados aqui.'}</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-catalog>${icon('<path d="M4 6h16M4 12h16M4 18h10"/>')}<strong>Catálogo da empresa</strong><small>${(state.settings.catalog||[]).length?(state.settings.catalog.length+' artigo(s). Os custos do orçamento vêm daqui.'):'Mete os teus artigos e custos. A Forja preenche o orçamento com eles.'}</small></button>
      ${window.forjaPilot.demo?`<button type="button" class="pilot-menu-card" data-pilot-feedback-go>${icon('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>')}<strong>Dar feedback</strong><small>Diz-nos o que achaste e o que mudavas. Demora um minuto.</small></button>`:
      `<button type="button" class="pilot-menu-card" data-pilot-drawing>${icon('<path d="M3 17l14-14 4 4L7 21H3z"/><path d="M14 6l4 4M5 15l2 2M8 12l2 2M11 9l2 2"/>')}<strong>Pedir desenho técnico</strong><small>${drawings?drawings+' pedido(s) de desenho enviado(s).':'Envia a folha de medidas e as fotos e recebe o alçado cotado.'}</small></button>`}
    </div>
    <section id="pilot-history"><h2>Histórico</h2>
    ${state.projects.length?`<div class="toolbar"><input class="field search" id="project-search" placeholder="Procurar projeto ou cliente…" value="${esc(query)}" aria-label="Procurar orçamentos"></div>
    <div class="card table-scroll"><table class="project-list"><thead><tr><th>Projeto / Cliente</th><th>Estado</th><th>Valor sem IVA</th><th>Memória</th><th></th></tr></thead><tbody id="project-rows">${projectRows(filtered)}</tbody></table></div>`:
    '<div class="card card-pad"><p>Ainda não há orçamentos. Os que criares ficam guardados aqui, com as versões e a memória de cada obra.</p></div>'}
    ${window.forjaPilot.demo||state.projects.some(p=>p.id==='exemplo')?'':'<p class="pilot-example-link"><button type="button" class="small" data-pilot-example>Experimentar com um pedido de exemplo</button></p>'}</section>`;
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
  const draft=calc(p).subtotal, actual=Number(p.actualPrice);
  const diff=actual>0?Math.round((draft-actual)/actual*100):null;
  const diffText=diff===null?'':`<p class="pilot-diff ${diff<-2?'pilot-under':diff>2?'pilot-over':'pilot-ok'}">Rascunho ${euro(draft)} · preço final ${euro(actual)} · <strong>${diff>0?'+':''}${diff}%</strong> (${diff<-2?'abaixo':diff>2?'acima':'certo'})</p>`;
  return `<section class="card card-pad pilot-check no-print"><h2>Avaliar orçamento</h2>
    <p class="smalltext muted">O rascunho da Forja ficou…</p>
    <div class="pilot-check-options" role="group" aria-label="Avaliar o preço do rascunho">${options.map(([key,label,title])=>
      `<button type="button" data-price-check="${key}" title="${title}" aria-pressed="${p.priceCheck===key}" class="${p.priceCheck===key?'chosen pilot-'+key:''}">${p.priceCheck===key?'✓ ':''}${label}</button>`).join('')}</div>
    <div class="field-grid pilot-check-fields">
      <label>Preço final do orçamento (€, sem IVA)<input class="field" id="pilot-actual" type="number" min="0" step="0.01" inputmode="decimal" value="${p.actualPrice??''}" placeholder="O valor que enviaste ao cliente"></label>
      <label>O que falhou?<textarea class="field" id="pilot-failed" rows="3" maxlength="2000" placeholder="Ex.: faltou o tubo de reforço; a montagem leva mais horas…">${esc(p.checkNote||'')}</textarea></label>
    </div>
    ${diffText}
    <button type="button" class="primary" data-price-save>Guardar avaliação</button>
    ${p.checkSaved?`<span class="smalltext muted"> Guardada a ${new Date(p.checkSaved).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}.</span>`:''}
    <p class="smalltext muted">${p.priceCheck==='under'?'Abaixo do preço certo: é o erro mais caro para a oficina. A Forja aprende a arredondar para cima.':'Ajuda a Forja a nunca orçar abaixo do custo.'}</p></section>`;
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
      {id:uid(),desc:'Acabamento escovado',qty:1.04,unit:'m²',price:15,source:'Uma face · 1,04 m²'},
      {id:uid(),desc:'Montagem na parede',qty:1.5,unit:'h',price:0,source:''}],
    markup:state.settings.markup,vat:state.settings.vat,versions:[],files:[],
    memory:[
      {id:uid(),text:'Espessura não indicada no pedido. Proposta: 2 mm.',kind:'Pendente',source:'Pedido inicial · email (exemplo)',created:t},
      {id:uid(),text:'Fixação à parede não indicada. Perguntar se leva suportes ou furos.',kind:'Pendente',source:'Pedido inicial · email (exemplo)',created:t},
      {id:uid(),text:'Quantidade assumida: uma prateleira de cada comprimento.',kind:'Hipótese',source:'Pedido inicial · sem confirmação',created:t}],
    events:[{id:uid(),text:'Projeto de exemplo criado com pedido e custos fictícios.',source:'Forja · demonstração',created:t}]};
}
document.addEventListener('input',event=>{
  if(event.target.id==='pilot-feedback-text')pilotFeedback.text=event.target.value;
  const p=view==='detail'?project():null;
  if(p && event.target.id==='pilot-actual'){const v=event.target.value.replace(',','.');p.actualPrice=v===''?null:Number(v);}
  if(p && event.target.id==='pilot-failed')p.checkNote=event.target.value;
});
document.addEventListener('click',async ev=>{
  const target=ev.target.closest('[data-pilot-example],[data-price-check],[data-feedback-rating],[data-feedback-send],[data-feedback-again],[data-price-save],[data-pilot-catalog],[data-pilot-catalog-save],[data-pilot-autoprice],[data-pilot-history],[data-pilot-drawing],[data-pilot-drawing-send],[data-pilot-feedback-go]');
  if(!target)return;
  if(target.hasAttribute('data-pilot-feedback-go')) {document.querySelector('.pilot-feedback')?.scrollIntoView({behavior:'smooth'});document.querySelector('#pilot-feedback-text')?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-pilot-catalog')) {
    const rows=(state.settings.catalog||[]).map(x=>`${x.label};${x.unit};${String(x.price).replace('.',',')}`).join('\n');
    modal(`${modalHead('Catálogo da empresa','Um artigo por linha: nome; unidade; custo. A Forja usa estes custos para preencher o orçamento e diz a confiança de cada correspondência.')}
      <div class="pilot-drawing">
      <label>Artigos<textarea class="field pilot-catalog-text" id="pc-text" rows="12" placeholder="Chapa inox 2 mm;m²;78&#10;Tubo aço 40×40×2;m;4,50&#10;Montagem em obra;h;35">${esc(rows)}</textarea></label>
      <label>Ou importar um ficheiro CSV<input class="field" id="pc-file" type="file" accept=".csv,.txt,text/csv,text/plain"></label>
      <p class="smalltext muted">Unidades: un, m, m², m³, kg ou h. Separa com ponto e vírgula ou tabulação. Até 500 artigos.</p>
      <p id="pc-status" class="pilot-message" role="alert" hidden></p>
      <div class="pilot-start"><button type="button" class="primary" data-pilot-catalog-save>Guardar catálogo</button><button type="button" data-action="close">Cancelar</button></div></div>`);
    document.querySelector('#pc-file').addEventListener('change',async e=>{const f=e.target.files[0];if(f)document.querySelector('#pc-text').value=(await f.text()).slice(0,200000);});
    return;
  }
  if(target.hasAttribute('data-pilot-catalog-save')) {
    const status=document.querySelector('#pc-status'),say=t=>{status.hidden=!t;status.textContent=t;};
    let catalog;
    try {catalog=pilotParseCatalog(document.querySelector('#pc-text').value);} catch(e) {return say(e.message);}
    target.disabled=true;say('');
    try {
      state.settings.catalog=await window.forjaPilot.saveCatalog(catalog);
      closeModal();render();toast(`Catálogo guardado: ${state.settings.catalog.length} artigo(s).`);
    } catch(e) {say(e.message);target.disabled=false;}
    return;
  }
  if(target.hasAttribute('data-pilot-autoprice')) {
    const p=project();
    if(!(state.settings.catalog||[]).length){toast('Mete primeiro o catálogo da empresa no menu inicial.');return;}
    let filled=0,low=0;
    for(const l of p.lines){if(l.match?.manual)continue;const r=pilotAutoPrice(l,{withUnit:true});if(r==='applied')filled++;else if(r==='low')low++;}
    dirty(p);event(p,`Custos preenchidos com o catálogo: ${filled} linha(s)`+(low?`; ${low} sem correspondência`:''),'Catálogo da oficina');
    persist();render();toast(`${filled} linha(s) preenchida(s) com o catálogo.`+(low?` ${low} sem correspondência: revê à mão.`:''));
    return;
  }
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
    if(!state.projects.some(p=>p.id==='exemplo')){const ex=pilotExampleProject();ex.lines.forEach(l=>pilotAutoPrice(l,{withUnit:true,keepSource:!!l.source}));state.projects.push(ex);}
    selected='exemplo';view='detail';tab='orcamento';persist();render();
    window.forjaPilot.flush().then(()=>window.forjaPilot.refreshResponses());
  } else if(target.dataset.priceCheck) {
    const p=project();
    p.priceCheck=p.priceCheck===target.dataset.priceCheck?'':target.dataset.priceCheck;
    p.checkDraft=calc(p).subtotal;
    persist();render();
  } else if(target.hasAttribute('data-price-save')) {
    const p=project(),raw=document.querySelector('#pilot-actual').value.replace(',','.');
    const value=raw===''?null:Number(raw);
    if(value!==null && !(value>=0 && value<1e8)){toast('Indica um preço válido.');return;}
    p.actualPrice=value;p.checkNote=document.querySelector('#pilot-failed').value.trim().slice(0,2000);
    p.checkDraft=calc(p).subtotal;p.checkSaved=now();
    if(value>0 && !p.priceCheck){const d=(p.checkDraft-value)/value*100;p.priceCheck=d<-2?'under':d>2?'over':'ok';}
    event(p,'Avaliação do orçamento guardada'+(value!==null?' · preço final '+euro(value):''),'Oficina');
    persist();render();toast('Avaliação guardada. Obrigado!');
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

// ---- Correspondência com o catálogo (métrica tipo RapidFuzz: ratio, token_sort_ratio e token_set_ratio)
const pilotStop=new Set(['de','da','do','das','dos','a','o','as','os','e','em','na','no','nas','nos','com','para','por','c','p']);
function pilotNorm(text) {
  return String(text||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'')
    .replace(/\([^)]*\)/g,' ').replace(/(\d)\s*[x×*]\s*(?=\d)/g,'$1 x ').replace(/(\d),(\d)/g,'$1.$2').replace(/(\d)(mm|cm|m|kg|m2|m3)\b/g,'$1 $2')
    .replace(/[^a-z0-9.]+/g,' ').split(' ').filter(t=>t && !pilotStop.has(t));
}
function pilotLcs(a,b) {
  if(!a.length||!b.length)return 0;
  let prev=new Array(b.length+1).fill(0);
  for(let i=1;i<=a.length;i++){const cur=[0];for(let j=1;j<=b.length;j++)cur[j]=a[i-1]===b[j-1]?prev[j-1]+1:Math.max(prev[j],cur[j-1]);prev=cur;}
  return prev[b.length];
}
function pilotRatio(a,b) {return a.length+b.length?200*pilotLcs(a,b)/(a.length+b.length):0;}
function pilotScore(query,label) {
  const a=pilotNorm(query),b=pilotNorm(label);
  if(!a.length||!b.length)return 0;
  const sortA=[...a].sort().join(' '),sortB=[...b].sort().join(' ');
  const setA=new Set(a),setB=new Set(b);
  const inter=[...setA].filter(t=>setB.has(t)).sort(),onlyA=[...setA].filter(t=>!setB.has(t)).sort(),onlyB=[...setB].filter(t=>!setA.has(t)).sort();
  const sect=inter.join(' '),ab=[sect,...onlyA].filter(Boolean).join(' '),ba=[sect,...onlyB].filter(Boolean).join(' ');
  let tokenSet=0;
  if(inter.length && (!onlyA.length||!onlyB.length)) tokenSet=100;
  else tokenSet=Math.max(sect?pilotRatio(sect,ab):0,sect?pilotRatio(sect,ba):0,pilotRatio(ab,ba));
  // Números diferentes (ex.: 2 mm vs 3 mm) não podem dar correspondência alta.
  const numsA=a.filter(t=>/\d/.test(t)),numsB=b.filter(t=>/\d/.test(t));
  const clash=numsA.length&&numsB.length&&!numsA.some(n=>numsB.includes(n));
  const score=Math.max(pilotRatio(sortA,sortB),0.9*tokenSet);
  return Math.round(clash?Math.min(score*0.6,55):score);
}
function pilotBestMatch(desc) {
  const scored=(state.settings.catalog||[]).map((row,index)=>({row,index,score:pilotScore(desc,row.label)})).sort((x,y)=>y.score-x.score);
  const best=scored[0];
  // Dois artigos quase empatados: a escolha é incerta, por isso a confiança desce para média.
  if(best && scored[1] && best.score-scored[1].score<4 && best.score>=60) best.score=Math.min(best.score,70);
  return best||null;
}
function pilotAutoPrice(line,{withUnit=false,keepSource=false}={}) {
  const best=pilotBestMatch(line.desc);
  if(!best){line.match={label:'',score:0,manual:false,applied:false};return 'none';}
  if(best.score<60){
    // Se o custo vinha de outro artigo do catálogo, deixa de valer: fica por indicar.
    if(line.match?.applied && !line.match.manual){line.price=0;line.source='Por indicar · sem artigo correspondente no catálogo';}
    line.match={label:best.row.label,score:best.score,manual:false,applied:false};return 'low';
  }
  line.price=best.row.price;
  if(withUnit)line.unit=best.row.unit;
  if(!keepSource)line.source=`Catálogo da oficina · ${best.row.label}`;
  line.match={label:best.row.label,score:best.score,manual:false,applied:true};
  return 'applied';
}
function pilotConfidence(l) {
  const m=l.match;
  if(!m)return '<span class="pilot-conf pilot-conf-none" title="Linha sem correspondência calculada">—</span>';
  if(m.manual)return `<span class="pilot-conf pilot-conf-manual" title="Custo alterado à mão${m.label?' · catálogo: '+esc(m.label):''}">Manual</span>`;
  if(!m.applied)return `<span class="pilot-conf pilot-conf-low" title="${m.label?'Melhor artigo: '+esc(m.label):'Catálogo vazio'}">Sem corresp.${m.label?' · '+m.score+'%':''}</span>`;
  const level=m.score>=85?'high':'mid';
  return `<span class="pilot-conf pilot-conf-${level}" title="Artigo do catálogo: ${esc(m.label)}">${level==='high'?'Alta':'Média'} · ${m.score}%</span>`;
}
function pilotAfterEdit(p,l,k) {
  if(k==='price'||k==='unit'){if(l.match)l.match.manual=true;return false;}
  if(k==='desc' && !l.match?.manual && (state.settings.catalog||[]).length){
    pilotAutoPrice(l,{withUnit:true});dirty(p);event(p,'Linha «'+l.desc+'»: custo procurado no catálogo','Catálogo da oficina');persist();render();return true;
  }
  return false;
}
function pilotParseCatalog(text) {
  const units={'un':'un','un.':'un','uni':'un','unid':'un','unid.':'un','unidade':'un','unidades':'un','m':'m','ml':'m','m2':'m²','m²':'m²','m3':'m³','m³':'m³','kg':'kg','h':'h','hr':'h','hora':'h','horas':'h'};
  const rows=String(text).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(rows.length>500)throw new Error('O catálogo pode ter até 500 artigos.');
  return rows.filter((line,i)=>!(i===0 && /artigo|descri/i.test(line) && !/\d/.test(line))).map((line,i)=>{
    const cols=line.split(/\t|;/).map(c=>c.trim());
    if(cols.length<3)throw new Error(`Linha ${i+1}: escreve nome; unidade; custo.`);
    const unit=units[cols[1].toLowerCase()];
    if(!unit)throw new Error(`Linha ${i+1}: a unidade «${cols[1]}» não é un, m, m², m³, kg nem h.`);
    const price=Number(cols[2].replace(/[€\s]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'));
    if(!Number.isFinite(price)||price<0)throw new Error(`Linha ${i+1}: o custo «${cols[2]}» não é um número.`);
    if(!cols[0]||cols[0].length>180)throw new Error(`Linha ${i+1}: falta o nome do artigo.`);
    return {label:cols[0],unit,price};
  });
}
