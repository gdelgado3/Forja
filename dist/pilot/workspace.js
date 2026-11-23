'use strict';
function renderPilotWorkspace() {
  if(view==='detail'&&!project())view='projects';
  // O separador antigo de leitura de ficheiros já não existe no piloto: tudo vai para o pedido.
  if(tab==='interpretar')tab='pedido';
  const isDetail=view==='detail';
  const projectsHtml=()=>{
    const icon=d=>`<svg class="pilot-menu-icon" viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
    const back='<button type="button" class="pilot-back" data-pilot-page="home">← Voltar à página inicial</button>';
    const rated=state.projects.filter(p=>p.lines.length);
    if(pilotPage==='history'){
      const filtered=state.projects.filter(p=>(p.name+' '+p.client+' '+p.code).toLowerCase().includes(query.toLowerCase()));
      return `${back}<div class="heading"><div><h1>Histórico</h1><p>${state.projects.length} orçamento(s) guardado(s) nesta oficina.</p></div></div>
      ${state.projects.length?`<div class="toolbar"><input class="field search" id="project-search" placeholder="Procurar projeto ou cliente…" value="${esc(query)}" aria-label="Procurar orçamentos"></div>
      <div class="card table-scroll"><table class="project-list"><thead><tr><th>Projeto / Cliente</th><th>Estado</th><th>Valor sem IVA</th><th>Memória</th><th></th></tr></thead><tbody id="project-rows">${projectRows(filtered)}</tbody></table></div>`:'<div class="card card-pad"><p>Ainda não há orçamentos.</p></div>'}`;
    }
    if(pilotPage==='avaliar'){
      return `${back}<div class="heading"><div><h1>Avaliar orçamentos</h1><p>Compara o rascunho da Forja com o preço que enviaste ao cliente. É assim que a Forja aprende os teus preços.</p></div></div>
      ${rated.length?`<div class="pilot-rate-list">${rated.map(p=>`<button type="button" class="pilot-rate-row" data-pilot-rate="${p.id}"><span><strong>${esc(p.name)}</strong><small>${esc(p.client||'Sem cliente')}</small></span><span class="pilot-rate-val">${euro(calc(p).subtotal)}</span><span class="pilot-rate-state ${p.priceCheck?'done pilot-'+p.priceCheck:''}">${p.priceCheck==='ok'?'Certo':p.priceCheck==='under'?'Abaixo':p.priceCheck==='over'?'Acima':'Por avaliar'}</span></button>`).join('')}</div>`:'<div class="card card-pad"><p>Ainda não há orçamentos com linhas para avaliar.</p></div>'}`;
    }
    if(pilotPage==='feedback')return `${back}${pilotFeedbackHtml()}`;
    const recent=state.projects.slice(0,3);
    return `<div class="heading"><div><h1>A tua oficina</h1><p>Do pedido do cliente ao orçamento. Escolhe por onde começar.</p></div></div>
    ${window.forjaPilot.demo&&!state.projects.some(p=>p.id==='exemplo')?`<button type="button" class="pilot-try-example" data-pilot-example><span class="pilot-try-badge">Começa aqui</span><strong>Simular com um pedido de exemplo</strong><small>Vê a Forja ler um pedido de prateleiras em inox e montar o orçamento, com as contas. Demora 10 segundos.</small><span class="pilot-try-arrow" aria-hidden="true">→</span></button>`:''}
    <div class="pilot-menu">
      <button type="button" class="pilot-menu-card pilot-menu-main" data-action="new">${icon('<path d="M12 5v14M5 12h14"/>')}<strong>Novo orçamento</strong><small>Cola o pedido ou junta o desenho e monta o rascunho.</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-page="history">${icon('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>')}<strong>Histórico</strong><small>${state.projects.length?state.projects.length+' orçamento(s) guardado(s).':'Os teus orçamentos ficam guardados aqui.'}</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-catalog>${icon('<path d="M4 6h16M4 12h16M4 18h10"/>')}<strong>Preços e catálogo</strong><small>${String(state.settings.hour).replace('.',',')} €/h, acréscimo ${String(state.settings.markup).replace('.',',')} %, ${(state.settings.catalog||[]).length} artigo(s).</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-page="avaliar">${icon('<path d="M4 20h16"/><path d="M7 16l3-4 3 2 4-6"/>')}<strong>Avaliar orçamentos</strong><small>${rated.filter(p=>p.priceCheck).length} de ${rated.length} avaliado(s). Compara o rascunho com o preço final.</small></button>
      <button type="button" class="pilot-menu-card" data-pilot-page="feedback">${icon('<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>')}<strong>Dar feedback</strong><small>Diz-nos o que achaste e o que mudavas. Demora um minuto.</small></button>
    </div>
    ${pilotToolsHtml()}
    <section id="pilot-history"><div class="pilot-history-head"><h2>Últimos orçamentos</h2>${state.projects.length>3?`<button type="button" class="small" data-pilot-page="history">Ver todos (${state.projects.length})</button>`:''}</div>
    ${recent.length?`<div class="card table-scroll"><table class="project-list"><thead><tr><th>Projeto / Cliente</th><th>Estado</th><th>Valor sem IVA</th><th>Memória</th><th></th></tr></thead><tbody>${projectRows(recent)}</tbody></table></div>`:
    '<div class="card card-pad"><p>Ainda não há orçamentos. Os que criares ficam guardados aqui, com as versões e a memória de cada obra.</p></div>'}
    ${window.forjaPilot.demo||state.projects.some(p=>p.id==='exemplo')?'':'<p class="pilot-example-link"><button type="button" class="small" data-pilot-example>Experimentar com um pedido de exemplo</button></p>'}</section>`;
  };
  $('#app').innerHTML=`<div class="pilot-office"><header class="pilot-header no-print"><div class="pilot-brand"><span>f</span> Forja</div>
    <strong>${esc(state.settings.company)}</strong><div class="pilot-header-actions">
    ${isDetail?pilotPendingChip(project()):''}${isDetail||pilotPage!=='home'?'<button data-pilot-page="home">Página inicial</button>':''}
    <button data-action="export">Exportar cópia</button><button data-pilot-action="logout">Sair</button></div></header>
    <main class="pilot-content"><div class="pilot-sync no-print" id="pilot-save-status" role="status">${esc(window.forjaPilot.status())}</div>
    ${!isDetail&&pilotPage==='home'?'<section id="pilot-responses" class="no-print"></section>':''}${isDetail&&tab==='orcamento'?pilotAiTop(project()):''}${isDetail?detail(project()):projectsHtml()}${isDetail&&tab==='pedido'?pilotAiPedido(project()):''}${isDetail?pilotPriceCheck(project()):''}</main></div>`;
  renderPilotResponses();
  // No separador Pedido, o botão Obter orçamento fica logo a seguir aos anexos (sem espaço vazio).
  const ai=document.querySelector('#pilot-ai'),files=document.querySelector('#anexos-card');
  if(ai&&files&&tab==='pedido')files.after(ai);
  document.querySelectorAll('textarea.desc').forEach(pilotFitDesc);
}
// Descrição das linhas: mostra sempre o texto inteiro (a caixa cresce com o texto); Enter termina a edição.
function pilotFitDesc(t){t.style.height='auto';t.style.height=t.scrollHeight+2+'px';}
document.addEventListener('input',e=>{if(e.target.matches?.('textarea.desc'))pilotFitDesc(e.target);});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.matches?.('textarea.desc')){e.preventDefault();e.target.blur();}});
addEventListener('resize',()=>document.querySelectorAll('textarea.desc').forEach(pilotFitDesc));
// Por baixo do conteúdo do separador: últimos acontecimentos e a nota de revisão humana (fora da coluna da direita).
function pilotDetailExtras(p){
  const ev=p.events.slice(0,3);
  return `<div class="pilot-extras no-print">
    <details class="pilot-events"${pilotFold.events?' open':''} data-fold="events"><summary><h2>Últimos acontecimentos</h2><span>${ev.length?date(ev[0].created):''}</span></summary>
      <ol>${ev.map(e=>`<li><small>${date(e.created)}</small><p>${esc(e.text)}</p><span>${esc(e.source)}</span></li>`).join('')||'<li><p>Sem acontecimentos.</p></li>'}</ol></details>
    <div class="pilot-review-note">${p.demo?'<b>Exemplo fictício.</b> Preços e horas ilustrativos. Substitui-os pelos valores da oficina.':'<b>Revisão humana.</b> Confirma medidas, materiais, processos e preços antes de enviar o orçamento.'}</div>
  </div>`;
}
// Lembrete "Antes de fechar" no topo: quantos pendentes e quais, a um clique.
function pilotPendingChip(p){
  const pend=p.memory.filter(n=>n.kind==='Pendente');
  return `<details class="pilot-pending${pend.length?' has':''}"><summary><span class="pilot-pending-dot" aria-hidden="true"></span>Antes de fechar <b>${pend.length}</b></summary>
    <div class="pilot-pending-panel"><strong>${pend.length?pend.length+' pendente(s) antes de enviar':'Sem pendentes registados'}</strong>
    <ul>${pend.slice(0,6).map(n=>`<li>${esc(n.text)}</li>`).join('')||'<li>Confirma os dados antes de orçar.</li>'}</ul>
    <button type="button" class="small" data-action="tab" data-tab="memoria">Abrir memória do projeto</button></div></details>`;
}
// O orçamento obtém-se em 1. Pedido; a proposta revê-se em 2. Orçamento.
function pilotAiStage(p){if(!p||pilotAi.pid!==p.id)return 'none';if(pilotAi.loading)return 'loading';return pilotAi.data?.turns?.length?'result':'none';}
function pilotAiPedido(p){
  const html=pilotAiHtml(p);
  if(pilotAiStage(p)!=='result')return html;
  return `<section class="card card-pad pilot-ai pilot-ai-ready no-print" id="pilot-ai"><div class="card-title"><h2>Orçamento proposto pronto</h2></div><p>A Forja já leu este pedido. Revê as linhas e aplica-as em <b>2. Orçamento</b>.</p><div class="pilot-ai-actions"><button type="button" class="primary" data-action="tab" data-tab="orcamento">Rever orçamento proposto →</button><button type="button" class="small ghost" data-ai-restart ${pilotAi.data?.remaining?'':'disabled'}>Analisar de novo</button></div></section>`;
}
function pilotAiTop(p){
  const html=pilotAiHtml(p),stage=pilotAiStage(p);
  if(stage!=='none')return html;
  if(p?.lines?.length)return '';
  return `<section class="card card-pad pilot-ai-hint no-print"><p><strong>Ainda sem orçamento.</strong> O orçamento faz-se em <b>1. Pedido</b>: junta o pedido e os anexos e carrega em <b>Obter orçamento</b>.</p><button type="button" class="primary" data-action="tab" data-tab="pedido">← Ir para 1. Pedido</button></section>`;
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
  return `<section class="card card-pad pilot-check no-print"><details data-fold="check"${pilotFold.check?' open':''}><summary><h2>Avaliar orçamento</h2><span class="smalltext muted">Compara o rascunho com o preço final</span></summary>
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
    <p class="smalltext muted">${p.priceCheck==='under'?'Abaixo do preço certo: é o erro mais caro para a oficina. A Forja aprende a arredondar para cima.':'Ajuda a Forja a nunca orçar abaixo do custo.'}</p></details></section>`;
}
let pilotFeedback={rating:null,text:'',sent:false};
let pilotFold={check:false,feedback:false,events:false};
// Cronómetro da análise: só arranca quando o servidor começa mesmo a analisar; antes disso diz "a preparar".
setInterval(()=>{const el=document.querySelector('#pilot-ai-elapsed'),st=pilotAi?.data?.started;if(!el||!st||!pilotAi.loading)return;const s=Math.max(0,Math.round((Date.now()-new Date(st))/1000));el.textContent=`${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;},1000);
// Página inicial e páginas próprias: histórico completo, avaliar orçamentos e feedback.
let pilotPage='home';
document.addEventListener('click',ev=>{
  const pg=ev.target.closest?.('[data-pilot-page]');
  if(pg){ev.preventDefault();pilotPage=pg.dataset.pilotPage;if(pilotPage==='feedback')pilotFold.feedback=true;view='projects';render();scrollTo({top:0});return;}
  const rt=ev.target.closest?.('[data-pilot-rate]');
  if(rt){ev.preventDefault();selected=rt.dataset.pilotRate;view='detail';tab='orcamento';pilotFold.check=true;render();setTimeout(()=>document.querySelector('.pilot-check')?.scrollIntoView({behavior:'smooth',block:'start'}),60);}
});
// Explicações de texto (origem, contas, ajudas) ocultas por omissão; preferência só deste navegador.
// A origem completa de cada linha abre em "ver origem"; na impressão aparece por inteiro.
document.body.classList.add('hide-explain');
// "Como calculei" / "Porquê?": explicação completa por linha, aberta a pedido e mantida aberta entre atualizações.
const pilotHow=new Set();
document.addEventListener('toggle',e=>{const d=e.target;if(d?.dataset?.how){d.open?pilotHow.add(d.dataset.how):pilotHow.delete(d.dataset.how)}},true);
document.addEventListener('click',ev=>{if(!ev.target.closest?.('[data-pilot-goto-ai]'))return;const ai=document.querySelector('#pilot-ai');ai?.scrollIntoView({behavior:'smooth',block:'start'});document.querySelector('#pilot-notes')?.focus({preventScroll:true});});
document.addEventListener('toggle',e=>{const d=e.target;if(d?.dataset?.fold)pilotFold[d.dataset.fold]=d.open},true);
let pilotQuick={rating:null,closed:false};
// ---------- Leitura com IA ----------
const pilotAi={pid:null,loading:false,error:'',data:null,off:new Set(),applied:{},prices:{},answers:{},fromClient:{},asks:[],qty:{},confirmed:new Set(),scope:{}};
// Custo proposto pelo catálogo para uma linha lida do pedido (só se a unidade bater certo).
// Linhas em horas sem artigo de horas no catálogo usam o custo por hora de partida da oficina.
const pilotHourly=()=>({price:Number(state.settings.hour)||0,score:0,label:'',applied:true,hourly:true});
function pilotAiMatch(l) {
  const best=pilotBestMatch(l.desc);
  if(!best)return l.unit==='h'?pilotHourly():{price:null,score:0,label:'',applied:false};
  if(best.score<60 || best.row.unit!==l.unit)return l.unit==='h'?pilotHourly():{price:null,score:best.row.unit!==l.unit?Math.min(best.score,59):best.score,label:best.row.label,applied:false};
  return {price:best.row.price,score:best.score,label:best.row.label,applied:true};
}
async function pilotAiLoad(p) {
  if(pilotAi.pid===p.id && (pilotAi.data || pilotAi.loading))return;
  pilotHow.clear();Object.assign(pilotAi,{pid:p.id,loading:false,error:'',data:null,off:new Set(),prices:{},answers:{},fromClient:{},asks:[],qty:{},confirmed:new Set(),scope:{}});
  try {pilotAi.data=await window.forjaPilot.ai.get(p.id);pilotAi.error=pilotAi.data.error||'';} catch(e) {pilotAi.error=e.message;}
  if(pilotAi.data?.pending)pilotAiPoll(p.id);
  await pilotAskRefresh(p.id,false);
  if(pilotAi.pid===p.id && view==='detail')render();
}
// ---------- Perguntar ao cliente ----------
// As respostas do cliente entram na linha da pergunta com o mesmo texto (sem apagar o que a oficina já escreveu).
function pilotAskMerge(notify) {
  const r=pilotAi.data?.turns?.at(-1)?.reading;
  if(!r)return 0;
  let n=0;
  for(const ask of pilotAi.asks) {
    if(!ask.answers)continue;
    ask.questions.forEach((q,k)=>{
      const a=(ask.answers[k]||'').trim(),i=r.missing.findIndex(m=>m.question===q);
      if(a && i>=0 && !(pilotAi.answers[i]||'').trim()){pilotAi.answers[i]=a;pilotAi.fromClient[i]=true;n++;}
    });
  }
  if(n && notify)toast(n===1?'O cliente respondeu a uma pergunta.':`O cliente respondeu a ${n} perguntas.`);
  return n;
}
async function pilotAskRefresh(pid,notify) {
  try {
    const list=await window.forjaPilot.ask.list(pid);
    if(pilotAi.pid!==pid)return 0;
    pilotAi.asks=list;
    return pilotAskMerge(notify);
  } catch {return 0;}
}
setInterval(async()=>{
  if(view!=='detail' || !pilotAi.pid || pilotAi.pid!==selected || !pilotAi.asks.some(a=>!a.answers))return;
  if(await pilotAskRefresh(pilotAi.pid,true) && !document.querySelector('.pv-overlay') && !document.activeElement?.matches?.('input,textarea'))render();
},20000);
function pilotAskStatus(r) {
  const open=pilotAi.asks.filter(a=>!a.answers && a.questions.some(q=>r.missing.some(m=>m.question===q)));
  return open.length?`<p class="smalltext muted">Perguntas enviadas ao cliente, à espera de resposta. As respostas aparecem aqui sozinhas.</p>`:'';
}
function pilotAskDialog(p) {
  const r=pilotAi.data.turns.at(-1).reading;
  const contact=String(p.contact||'');
  const phone=(contact.match(/\+?\d[\d\s.-]{7,}\d/)||[''])[0];
  const mail=(contact.match(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/)||[''])[0];
  const company=state.settings.company||'a oficina';
  const wrap=document.createElement('div');
  wrap.className='pv-overlay';wrap.setAttribute('role','dialog');wrap.setAttribute('aria-modal','true');
  wrap.innerHTML=`<div class="pv-box"><h2>Perguntar ao cliente</h2>
    <p class="smalltext muted">A Forja prepara a mensagem com um link para o cliente responder. Envias tu, do WhatsApp ou do email da oficina: a Forja não acede a nenhum dos dois.</p>
    <fieldset class="pilot-ask-qs"><legend>Perguntas a enviar</legend>${r.missing.map((q,i)=>`<label><input type="checkbox" data-ask-q="${i}" ${(pilotAi.answers[i]||'').trim()?'':'checked'}> ${esc(q.question)}</label>`).join('')}</fieldset>
    <div class="pilot-ask-contact"><label>Telemóvel do cliente<input class="field" id="ask-phone" type="tel" value="${esc(phone)}" placeholder="912 345 678"></label>
      <label>Email do cliente<input class="field" id="ask-mail" type="email" value="${esc(mail)}" placeholder="cliente@exemplo.pt"></label></div>
    <label>Mensagem<textarea class="field" id="ask-text" rows="7"></textarea></label>
    <p class="smalltext muted" id="ask-msg" role="status"></p>
    <div class="pv-actions"><button type="button" class="primary" data-ask-send="wa">Abrir no WhatsApp</button><button type="button" data-ask-send="mail">Abrir no email</button><button type="button" data-ask-send="copy">Copiar mensagem</button><button type="button" class="ghost" data-ask-close>Fechar</button></div></div>`;
  document.body.append(wrap);
  const text=wrap.querySelector('#ask-text'),msg=wrap.querySelector('#ask-msg');
  const chosen=()=>[...wrap.querySelectorAll('[data-ask-q]:checked')].map(c=>r.missing[Number(c.dataset.askQ)].question);
  let edited=false;
  const build=()=>{if(edited)return;const qs=chosen();text.value=`Olá${p.client?' '+p.client.split(' ')[0]:''}, fala ${company}.\nPara fecharmos o orçamento${p.name?' ('+p.name.split(' · ')[0]+')':''}, precisamos de saber:\n${qs.map((q,i)=>`${i+1}. ${q}`).join('\n')}\n\nPode responder aqui, é rápido: [link]\n\nObrigado!`;};
  build();
  text.addEventListener('input',()=>{edited=true;});
  wrap.addEventListener('change',e=>{if(e.target.matches('[data-ask-q]'))build();});
  let created=null;
  wrap.addEventListener('click',async e=>{
    const b=e.target.closest('[data-ask-send],[data-ask-close]');
    if(!b)return;
    if(b.hasAttribute('data-ask-close')){wrap.remove();render();return;}
    const qs=chosen();
    if(!qs.length){msg.textContent='Escolhe pelo menos uma pergunta.';return;}
    const kind=b.dataset.askSend;
    // Abre já a janela do WhatsApp para o browser não a bloquear; o endereço entra depois de criar o link.
    const win=kind==='wa'?window.open('about:blank','_blank'):null;
    try {
      const key=qs.join('\n');
      if(!created || created.key!==key){const out=await window.forjaPilot.ask.create(p.id,qs);created={key,url:location.origin+out.url};pilotAi.asks.push({id:out.id,questions:qs,answers:null,created:new Date().toISOString()});}
      const body=text.value.includes('[link]')?text.value.replace('[link]',created.url):text.value+'\n\n'+created.url;
      if(kind==='copy'){try{await navigator.clipboard.writeText(body);msg.textContent='Mensagem copiada. Cola-a onde costumas falar com o cliente.';}catch{text.value=body;text.select();msg.textContent='Mensagem selecionada: copia com Ctrl+C.';}return;}
      if(kind==='wa'){
        let digits=wrap.querySelector('#ask-phone').value.replace(/\D/g,'');
        if(/^[29]\d{8}$/.test(digits))digits='351'+digits;
        const url=(digits?`https://wa.me/${digits}`:'https://wa.me/')+'?text='+encodeURIComponent(body);
        if(win)win.location.href=url;else window.open(url,'_blank');
        msg.textContent='Abriu o WhatsApp com a mensagem pronta. Revê e envia.';
      } else {
        const to=wrap.querySelector('#ask-mail').value.trim();
        location.href=`mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent('Orçamento: algumas perguntas')}&body=${encodeURIComponent(body)}`;
        msg.textContent='Abriu o email com a mensagem pronta. Revê e envia.';
      }
      event(p,'Perguntas enviadas ao cliente ('+qs.length+')','Oficina');persist();
    } catch(err){win?.close();msg.textContent=err.message;}
  });
}
// A análise corre no servidor (até 10 minutos): pergunta a cada 4 segundos e mostra o tempo.
let pilotAiTimer=null;
function pilotAiPoll(pid) {
  clearTimeout(pilotAiTimer);
  pilotAi.loading=true;
  const tick=async()=>{
    if(pilotAi.pid!==pid){pilotAi.loading=false;return;}
    try {
      const d=await window.forjaPilot.ai.get(pid);
      if(pilotAi.pid!==pid)return;
      if(!d.pending){
        const changed=d.turns.length!==(pilotAi.data?.turns?.length||0);
        pilotAi.data=d;pilotAi.loading=false;pilotAi.error=d.error||'';
        if(changed){pilotHow.clear();pilotAi.off=new Set();pilotAi.prices={};pilotAi.answers={};pilotAi.fromClient={};pilotAi.qty={};pilotAi.confirmed=new Set();pilotAi.scope={};pilotAskMerge(false);toast('O orçamento proposto está pronto. Revê e aplica.');}
        // Acabou: salta para o separador Orçamento, com a proposta no topo.
        if(changed && view==='detail' && selected===pid){tab='orcamento';render();requestAnimationFrame(()=>document.querySelector('#pilot-ai')?.scrollIntoView({behavior:'smooth',block:'start'}));return;}
        if(view==='detail')render();
        return;
      }
      pilotAi.data={...pilotAi.data,...d};
    } catch { /* rede: tenta outra vez */ }
    const pr=document.querySelector('#pilot-ai-progress');
    if(pr && pilotAi.data?.progress && pr.textContent!==pilotAi.data.progress){pr.textContent=pilotAi.data.progress;pr.classList.remove('pilot-ai-fresh');void pr.offsetWidth;pr.classList.add('pilot-ai-fresh');}
    if(pilotAi.data?.started && !document.querySelector('.pilot-ai-wait')?.textContent.startsWith('Tempo'))render();
    pilotAiTimer=setTimeout(tick,2500);
  };
  pilotAiTimer=setTimeout(tick,1500);
}
function pilotAiHtml(p) {
  if(!p)return '';
  if(pilotAi.pid!==p.id){pilotAiLoad(p);return '';}
  const d=pilotAi.data;
  if(!d && !pilotAi.error)return '';
  if(d && !d.enabled)return '';
  const left=d?`<small class="muted">${d.remaining} orçamento(s) disponível(eis)${d.demo?' na demonstração':' hoje'}</small>`:'';
  const err=pilotAi.error?`<p class="pilot-message" role="alert">${esc(pilotAi.error)}</p>`:'';
  const turns=d?.turns||[];
  if(pilotAi.loading){const started=pilotAi.data?.started;return `<section class="pilot-ai pilot-ai-forging no-print" id="pilot-ai" aria-busy="true">
    <div class="pilot-forge" aria-hidden="true"><svg viewBox="0 0 160 110"><g class="pf-hammer"><rect x="92" y="10" width="8" height="46" rx="3"/><rect x="72" y="4" width="48" height="18" rx="4"/></g>
      <path class="pf-anvil" d="M30 62 H128 C128 70 118 74 104 74 L96 74 L100 92 H58 L62 74 L44 74 C36 74 30 68 30 62 Z"/><rect class="pf-piece" x="70" y="56" width="30" height="6" rx="2"/>
      <g class="pf-sparks"><circle cx="78" cy="54" r="1.8"/><circle cx="90" cy="52" r="1.6"/><circle cx="84" cy="50" r="1.4"/><circle cx="96" cy="54" r="1.5"/><circle cx="74" cy="52" r="1.3"/></g></svg></div>
    <h2>A forjar o teu orçamento</h2>
    <p class="pilot-ai-progress" id="pilot-ai-progress" aria-live="polite">${esc(pilotAi.data?.progress||'A preparar o pedido e os anexos…')}</p>
    <p class="pilot-ai-wait">${started?'Tempo decorrido: ':''}<strong id="pilot-ai-elapsed">${started?'':'a preparar'}</strong></p>
    <p class="smalltext">Uma análise completa pode levar alguns minutos. Podes continuar a trabalhar noutros pedidos: o resultado aparece aqui.</p>${left}</section>`;}
  if(!turns.length)return `<section class="card card-pad pilot-ai pilot-ai-cta no-print" id="pilot-ai"><div class="card-title"><h2>Obter orçamento</h2>${left}</div>
    <p>Quando o pedido e os anexos estiverem completos, carrega no botão. A Forja analisa tudo e propõe as peças, as linhas do orçamento com as contas e o que falta perguntar ao cliente. Os custos vêm do teu catálogo e podes alterá-los. Revês tudo antes de aplicar.</p>
    <label class="pilot-notes">Notas da oficina (opcional)<textarea class="field" id="pilot-notes" rows="3" maxlength="3000" placeholder="O que já sabes deste trabalho e o pedido não diz. Ex.: falei com o cliente, quer inox 316; a obra é num 3.º andar sem elevador; prazo apertado.">${esc(p.workshopNotes||'')}</textarea></label>
    <p class="smalltext muted">Telefones, emails, NIF e moradas do texto não são enviados. Nas fotos e PDFs, só as zonas que marcaste ficam tapadas.</p>${err}
    <button type="button" class="primary pilot-run" data-ai-run ${d?.remaining?'':'disabled'}><span class="pilot-run-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14h14c0 2-2 3-4 3h-1l1 3H7l1-3H6c-2 0-3-1-3-3z"/><path d="M14 4l5 5M12 6l4-4 5 5-4 4z"/></svg></span><span><strong>Obter orçamento</strong><small>A Forja lê o pedido e os anexos e monta o rascunho</small></span></button></section>`;
  const r=turns.at(-1).reading;
  const badge=st=>`<span class="pilot-ai-state pilot-ai-${st==='dito'?'said':st==='deduzido'?'deduced':'check'}">${esc(st)}</span>`;
  const lines=r.lines.map((l,i)=>{
    const m=pilotAiMatch(l),edited=pilotAi.prices[i];
    const price=edited!==undefined?edited:m.price;
    const conf=edited!==undefined?{manual:true,label:m.label,score:m.score,applied:false}:{manual:false,label:m.label,score:m.score,applied:m.applied,hourly:m.hourly};
    const qty=pilotAi.qty[i]!==undefined?pilotAi.qty[i]:l.qty, confirmed=pilotAi.confirmed.has(i), zero=!(Number(qty)>0);
    const state=confirmed?'<button type="button" class="pilot-ai-state pilot-ai-said pilot-ai-toggle" data-ai-confirm="'+i+'" title="Tocar para voltar ao estado anterior">confirmado ✓</button>'
      :l.state==='a confirmar'?'<button type="button" class="pilot-ai-state pilot-ai-check pilot-ai-toggle" data-ai-confirm="'+i+'" title="Tocar para confirmar esta linha">a confirmar · confirmar?</button>':badge(l.state);
    return `<li class="${zero&&!pilotAi.off.has(i)?'pilot-ai-zero':''}"><label><input type="checkbox" data-ai-line="${i}" ${pilotAi.off.has(i)?'':'checked'}>
    <span class="grow"><strong>${esc(l.desc)}</strong>${l.basis?`<details class="pilot-how" data-how="l${i}"${pilotHow.has('l'+i)?' open':''}><summary>Como calculei</summary><small>${esc(l.basis)}</small></details>`:''}</span></label>
    <div class="pilot-ai-price"><input type="number" min="0" step="any" class="pilot-ai-qty" data-ai-qty="${i}" value="${zero&&pilotAi.qty[i]===undefined?'':qty}" placeholder="${zero?'Qtd.?':''}" aria-label="Quantidade de ${esc(l.desc)}"><span>${esc(l.unit)}</span>${state}
    <input type="number" min="0" step="0.01" data-ai-price="${i}" value="${price===null?'':price}" placeholder="Custo" aria-label="Custo unitário de ${esc(l.desc)}"><span>€/${esc(l.unit)}</span>${pilotConfidence({match:conf})}</div></li>`;}).join('');
  const list=(title,items)=>items.length?`<h3>${title}</h3><ul>${items.map(x=>`<li>${esc(x)}</li>`).join('')}</ul>`:'';
  const pieces=r.pieces.length?`<details><summary>Peças (${r.pieces.length})</summary><div class="table-scroll"><table class="pilot-ai-table"><thead><tr><th>Peça</th><th>Medidas</th><th>Material</th><th>Qtd.</th><th>Fixação</th><th>Origem</th></tr></thead><tbody>
    ${r.pieces.map(x=>`<tr><td>${esc(x.piece)} ${badge(x.state)}</td><td>${esc(x.measures)}</td><td>${esc(x.material)}</td><td>${esc(x.qty)}</td><td>${esc(x.fixing)}</td><td><small>${esc(x.origin)}</small></td></tr>`).join('')}</tbody></table></div></details>`:'';
  const history=turns.slice(1).map(t=>`<li><small>${new Date(t.at).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</small> ${esc(t.ask)}</li>`).join('');
  return `<section class="card card-pad pilot-ai no-print" id="pilot-ai"><div class="card-title"><h2>Orçamento proposto</h2>${left}</div>
    ${r.reply?`<p class="pilot-ai-reply">${esc(r.reply)}</p>`:''}
    <p>${esc(r.summary)}</p>${pieces}
    ${r.lines.length?`<h3>Linhas propostas</h3><p class="smalltext muted">Escolhe as que entram no orçamento. O custo vem do catálogo e podes alterá-lo. A barra mostra quanto o artigo do catálogo bate com a linha; sem correspondência, o custo fica por indicar.</p><ul class="pilot-ai-lines">${lines}</ul>`:''}
    ${r.missing.length?`<h3>Falta saber</h3><p class="smalltext muted">Responde ao que já souberes, na própria linha, e atualiza o orçamento.</p><ul class="pilot-ai-questions">${r.missing.map((q,i)=>`<li><div class="pilot-ai-qtext"><span>${esc(q.question)}</span>${q.why?`<details class="pilot-how" data-how="q${i}"${pilotHow.has('q'+i)?' open':''}><summary>Porquê?</summary><small class="muted">${esc(q.why)}</small></details>`:''}</div><div class="pilot-ai-answer"><input class="field" data-ai-answer="${i}" maxlength="600" value="${esc(pilotAi.answers[i]||'')}" placeholder="Resposta" aria-label="Resposta: ${esc(q.question)}">${pilotAi.fromClient[i]?'<small class="pilot-ai-client">Respondido pelo cliente</small>':''}</div></li>`).join('')}</ul>
      <div class="pilot-ai-actions"><button type="button" class="primary" data-ai-answers ${d.remaining?'':'disabled'}>Responder e atualizar orçamento</button><button type="button" data-ai-askclient>Perguntar ao cliente</button></div>${pilotAskStatus(r)}`:''}
    ${pilotScopeHtml(r)}
    ${r.calcs.length?`<details><summary>Contas (${r.calcs.length})</summary><ul>${r.calcs.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></details>`:''}
    ${list('Avisos',r.warnings)}${err}
    <div class="pilot-ai-actions">${pilotAi.applied[p.id]===turns.at(-1).at?'<span class="smalltext muted">Esta leitura já foi aplicada. Se corrigires, a nova leitura pode ser aplicada outra vez (as linhas antigas ficam; apaga as que sobrarem).</span>':`<button type="button" class="primary" data-ai-apply ${r.lines.length||r.missing.length?'':'disabled'}>Aplicar ao orçamento e à memória</button>`}</div>
    <div class="pilot-ai-ask"><label for="ai-ask">Análise da oficina</label><p class="smalltext muted">Escreve o que sabes e o rascunho não tem: correções, o que a empresa costuma fazer, o que está incluído. A Forja interpreta e atualiza o orçamento.</p>
      <textarea class="field" id="ai-ask" rows="2" maxlength="2000" placeholder="Ex.: são 2 portões iguais; usamos chapa de 3 mm; a montagem está incluída; não leva motor."></textarea>
      <div class="pilot-ai-actions"><button type="button" class="primary" data-ai-ask ${d.remaining?'':'disabled'}>Atualizar orçamento</button><button type="button" class="small ghost" data-ai-restart ${d.remaining?'':'disabled'}>Analisar de novo</button></div>
      ${history?`<ul class="pilot-ai-history">${history}</ul>`:''}</div></section>`;
}
// Âmbito: cada item com decisão "fica fora" ou "entra no orçamento".
function pilotScopeItems(r) {
  return [...r.scope.excluded.map((x,i)=>({key:'e'+i,label:'Excluído',text:x})),...r.scope.purchase.map((x,i)=>({key:'c'+i,label:'Compra',text:x})),...r.scope.otherTrade.map((x,i)=>({key:'o'+i,label:'Outro ofício',text:x}))];
}
function pilotScopeHtml(r) {
  const items=pilotScopeItems(r);
  if(!items.length)return '';
  return `<h3>Fora do âmbito / a confirmar</h3><p class="smalltext muted">Decide cada um. "Entra no orçamento" cria as linhas quando carregares em Atualizar orçamento.</p><ul class="pilot-ai-scope">${items.map(it=>{
    const d=pilotAi.scope[it.key];
    return `<li><span><b>${esc(it.label)}:</b> ${esc(it.text)}</span><span class="pilot-ai-scope-btns"><button type="button" class="small ${d==='out'?'primary':''}" data-ai-scope="${it.key}" data-v="out" aria-pressed="${d==='out'}">Fica fora</button><button type="button" class="small ${d==='in'?'primary':''}" data-ai-scope="${it.key}" data-v="in" aria-pressed="${d==='in'}">Entra no orçamento</button></span></li>`;}).join('')}</ul>`;
}
// Junta numa só mensagem tudo o que a oficina decidiu desde a última análise.
function pilotUpdateMessage() {
  const r=pilotAi.data.turns.at(-1).reading, parts=[];
  const answers=r.missing.map((q,i)=>[q.question,(pilotAi.answers[i]||'').trim()]).filter(([,a])=>a);
  if(answers.length)parts.push('Respostas às perguntas em falta:\n'+answers.map(([q,a])=>`- ${q} → ${a}`).join('\n'));
  const scope=pilotScopeItems(r).filter(it=>pilotAi.scope[it.key]);
  if(scope.length)parts.push('Âmbito decidido pela oficina:\n'+scope.map(it=>`- ${it.text} → ${pilotAi.scope[it.key]==='in'?'ENTRA no orçamento: cria as linhas':'fica FORA do orçamento'}`).join('\n'));
  const lines=r.lines.map((l,i)=>[l,i]).filter(([l,i])=>pilotAi.confirmed.has(i)||pilotAi.qty[i]!==undefined);
  if(lines.length)parts.push('Linhas revistas pela oficina (mantém estes valores e marca-as como "dito"):\n'+lines.map(([l,i])=>`- ${l.desc}: ${pilotAi.qty[i]!==undefined?pilotAi.qty[i]:l.qty} ${l.unit}${pilotAi.confirmed.has(i)?' (confirmado)':''}`).join('\n'));
  const extra=document.querySelector('#ai-ask')?.value.trim();
  if(extra)parts.push('Análise da oficina: '+extra);
  return parts.length?(parts.join('\n\n')+'\n\nAtualiza a leitura e as linhas com isto.').slice(0,2000):'';
}
function pilotAiApply(p) {
  const r=pilotAi.data.turns.at(-1).reading,t=now();
  let added=0,priced=0,zero=0;
  r.lines.forEach((x,i)=>{
    if(pilotAi.off.has(i))return;
    const q=pilotAi.qty[i]!==undefined?Number(pilotAi.qty[i]):x.qty, st=pilotAi.confirmed.has(i)?'confirmado pela oficina':x.state;
    const line={id:uid(),desc:x.desc,qty:Math.round((Number.isFinite(q)?q:0)*1000)/1000,unit:x.unit,price:0,source:`Leitura do pedido (${st}) · ${x.basis}`.slice(0,400)};
    if(!(line.qty>0))zero++;
    const m=pilotAiMatch(x),edited=pilotAi.prices[i];
    if(edited!==undefined && edited!==null){line.price=edited;line.match={label:m.label,score:m.score,manual:true,applied:false};}
    else {line.price=m.price??0;line.match={label:m.label,score:m.score,manual:false,applied:m.applied,...(m.hourly?{hourly:true}:{})};}
    if(line.match.applied||line.match.manual)priced++;
    p.lines.push(line);added++;
  });
  r.missing.forEach((q,i)=>{const a=(pilotAi.answers[i]||'').trim();p.memory.unshift(a?{id:uid(),kind:'Decisão',text:q.question+' → '+a,source:'Resposta da oficina',created:t}:{id:uid(),kind:'Pendente',text:q.question+(q.why?' ('+q.why+')':''),source:'Leitura do pedido · por confirmar',created:t});});
  for(const it of pilotScopeItems(r)) {
    const d=pilotAi.scope[it.key];
    p.memory.unshift(d==='out'?{id:uid(),kind:'Decisão',text:'Fica fora do orçamento: '+it.text,source:'Âmbito decidido pela oficina',created:t}
      :d==='in'?{id:uid(),kind:'Pendente',text:'Entra no orçamento (criar linhas): '+it.text,source:'Âmbito decidido pela oficina',created:t}
      :{id:uid(),kind:'Hipótese',text:it.label+': '+it.text,source:'Leitura do pedido · âmbito por confirmar',created:t});
  }
  pilotAi.applied[p.id]=pilotAi.data.turns.at(-1).at;
  dirty(p);event(p,`Leitura do pedido aplicada: ${added} linha(s), ${r.missing.length} pergunta(s) em falta.`,'Leitura do pedido · revista pela oficina');
  persist();tab='orcamento';render();
  toast(`${added} linha(s) no orçamento, ${priced} com custo.`+(zero?` ${zero} com quantidade 0: indica-a no orçamento.`:' Revê as quantidades e os custos.'));
}
async function pilotAiRun(p,body) {
  const notes=document.querySelector('#pilot-notes');
  if(notes && notes.value.trim()!==(p.workshopNotes||'')){p.workshopNotes=notes.value.trim().slice(0,3000);persist();}
  pilotAi.loading=true;pilotAi.error='';render();
  try {
    if(!await window.forjaPilot.flush())throw new Error('Guarda o pedido antes de pedir o orçamento.');
    const out=await window.forjaPilot.ai.run(p.id,body);
    pilotAi.data={...pilotAi.data,remaining:out.remaining,started:out.started,pending:true};
    pilotAiPoll(p.id);
    if(view==='detail')render();
    return;
  } catch(e) {pilotAi.error=e.message;}
  pilotAi.loading=false;
  if(pilotAi.pid===p.id && view==='detail')render();
}
document.addEventListener('input',ev=>{
  const qf=ev.target.closest?.('[data-ai-qty]');
  if(qf){const i=Number(qf.dataset.aiQty),v=qf.value.replace(',','.');if(v==='')delete pilotAi.qty[i];else if(Number.isFinite(Number(v))&&Number(v)>=0)pilotAi.qty[i]=Number(v);qf.closest('li')?.classList.toggle('pilot-ai-zero',!(Number(v)>0));return;}
  const ans=ev.target.closest?.('[data-ai-answer]');
  if(ans){pilotAi.answers[Number(ans.dataset.aiAnswer)]=ans.value;return;}
  const f=ev.target.closest?.('[data-ai-price]');
  if(!f)return;
  const i=Number(f.dataset.aiPrice),v=f.value.replace(',','.');
  if(v===''){delete pilotAi.prices[i];return;}
  const n=Number(v);if(Number.isFinite(n)&&n>=0)pilotAi.prices[i]=n;
});
document.addEventListener('change',ev=>{
  if(ev.target.closest?.('[data-ai-price]')){render();return;}
  const box=ev.target.closest?.('[data-ai-line]');
  if(!box)return;
  const i=Number(box.dataset.aiLine);
  if(box.checked)pilotAi.off.delete(i);else pilotAi.off.add(i);
});
document.addEventListener('click',ev=>{
  const sc=ev.target.closest('[data-ai-scope],[data-ai-confirm]');
  if(sc && view==='detail'){
    if(sc.dataset.aiScope){const k=sc.dataset.aiScope;pilotAi.scope[k]=pilotAi.scope[k]===sc.dataset.v?undefined:sc.dataset.v;}
    else {const i=Number(sc.dataset.aiConfirm);if(pilotAi.confirmed.has(i))pilotAi.confirmed.delete(i);else pilotAi.confirmed.add(i);}
    const y=window.scrollY;render();window.scrollTo(0,y);return;
  }
  const t=ev.target.closest('[data-ai-run],[data-ai-apply],[data-ai-ask],[data-ai-restart],[data-ai-answers],[data-ai-askclient]');
  if(!t || view!=='detail')return;
  const p=project();
  if(t.hasAttribute('data-ai-run'))pilotAiRun(p,{});
  else if(t.hasAttribute('data-ai-restart'))pilotAiRun(p,{restart:true});
  else if(t.hasAttribute('data-ai-askclient'))pilotAskDialog(p);
  else if(t.hasAttribute('data-ai-answers') || t.hasAttribute('data-ai-ask')) {
    const msg=pilotUpdateMessage();
    if(!msg){toast('Responde a uma pergunta, decide um item do âmbito, confirma uma linha ou escreve na Análise da oficina.');return;}
    pilotAiRun(p,{message:msg});
  } else pilotAiApply(p);
});
window.forjaRender=()=>render();
// O botão "voltar" do telemóvel ou do browser também sai do pedido para o início.
let pilotLastView=null;
const pilotTrackView=()=>{
  if(view==='detail' && pilotLastView!=='detail'){try{history.pushState({forja:'detail'},'');}catch{}}
  pilotLastView=view;
};
document.addEventListener('click',()=>setTimeout(pilotTrackView,0),true);
window.addEventListener('popstate',()=>{
  if(view==='detail'){
    if(document.querySelector('.pv-overlay')){document.querySelectorAll('.pv-overlay').forEach(o=>o.remove());}
    view='projects';pilotLastView='projects';render();window.scrollTo(0,0);
  }
});
function pilotQuickHtml() {
  if(!window.forjaPilot.demo || !state.projects.some(p=>p.id==='exemplo') || pilotQuick.closed || pilotFeedback.sent)return '';
  if(pilotQuick.rating)return `<div class="pilot-quick no-print" role="status"><strong>Obrigado pela nota ${pilotQuick.rating}!</strong> <span>Em uma frase: o que mudavas?</span>
    <button type="button" class="small" data-pilot-feedback-go>Escrever</button><button type="button" class="small ghost" data-pilot-quick-close aria-label="Fechar">×</button></div>`;
  return `<div class="pilot-quick no-print"><strong>Que nota dás à Forja?</strong>
    <div class="pilot-rating" role="group" aria-label="Nota rápida de 1 a 5">${[1,2,3,4,5].map(n=>`<button type="button" data-pilot-quick="${n}">${n}</button>`).join('')}</div>
    <small>1 = não usava · 5 = usava já</small><button type="button" class="small ghost" data-pilot-quick-close aria-label="Fechar">×</button></div>`;
}
function pilotToolsHtml() {
  const zones=window.forjaPilot.privacyZones();
  const link=window.forjaPilot.formLink;
  return `<section class="pilot-client-card no-print">
    <div class="pilot-client-copy"><h2>Link para os teus clientes</h2>
      <p>Manda por WhatsApp ou email. O cliente descreve o trabalho e junta fotos, e o pedido aparece aqui sozinho, pronto para orçamentar.</p></div>
    ${link?`<div class="pilot-client-link"><div class="pilot-link-row"><input class="field" id="pilot-form-link" readonly value="${esc(link)}" aria-label="Link do formulário"><button type="button" class="primary" data-pilot-form-copy>Copiar link</button></div>
      <p class="smalltext" id="pilot-form-copied" role="status"></p></div>`:''}
    <button type="button" class="pilot-client-privacy" data-pilot-privacy>${zones?`Dados dos clientes protegidos: ${zones} zona(s) tapada(s). Alterar`:'Proteger dados dos clientes nas fotos e PDFs'}</button>
  </section>`;
}
document.addEventListener('submit',async ev=>{
  const f=ev.target.closest?.('[data-pilot-prices]');
  if(!f)return;
  ev.preventDefault();
  const d=new FormData(f),v=k=>Number(String(d.get(k)).replace(',','.'));
  const b=f.querySelector('button');b.disabled=true;
  try{const out=await window.forjaPilot.savePrices({hour:v('hour'),markup:v('markup'),vat:v('vat')});Object.assign(state.settings,{hour:out.hour,markup:out.markup,vat:out.vat});toast('Preços da oficina guardados.');}
  catch(e){toast(e.message);}
  b.disabled=false;
});
window.importPilotRequests=async list=>{
  let added=0;
  for(const r of list) {
    if(state.projects.some(p=>p.id===r.id))continue;
    const t=now();
    state.projects.push({id:r.id,code:nextCode(),name:(r.type||'Pedido')+' · '+r.client,client:r.client,contact:r.contact||'',place:r.place||'',channel:'Formulário',
      request:r.request||'',created:r.created||t,demo:false,status:'Rascunho',fields:{type:r.type||'',material:'',width:'',height:'',quantity:'1',finish:''},
      lines:[],markup:state.settings.markup,vat:state.settings.vat,versions:[],files:r.files||[],
      memory:[{id:uid(),kind:'Pendente',text:'Pedido feito pelo cliente no formulário. Confirmar medidas e material antes de orçar.',source:'Formulário do cliente',created:t}],
      events:[{id:uid(),text:'Pedido recebido pelo formulário'+(r.files?.length?` com ${r.files.length} anexo(s).`:'.'),source:'Formulário do cliente',created:t}]});
    added++;
  }
  if(added){persist();if(!document.querySelector('#modal')?.open && !document.querySelector('.pv-overlay'))render();toast(added===1?'Chegou um pedido novo pelo formulário.':`Chegaram ${added} pedidos novos pelo formulário.`);}
  return true;
};
document.addEventListener('click',async ev=>{
  const t=ev.target.closest('[data-pilot-quick],[data-pilot-quick-close],[data-pilot-privacy],[data-pilot-form-copy]');
  if(!t)return;
  if(t.hasAttribute('data-pilot-privacy')){window.forjaPilot.editPrivacy();return;}
  if(t.hasAttribute('data-pilot-quick-close')){pilotQuick.closed=true;render();return;}
  if(t.hasAttribute('data-pilot-form-copy')){
    const field=document.querySelector('#pilot-form-link'),status=document.querySelector('#pilot-form-copied');
    field.select();
    try{await navigator.clipboard.writeText(field.value);status.textContent='Link copiado.';}catch{status.textContent='Link selecionado. Copia com Ctrl+C.';}
    return;
  }
  const n=Number(t.dataset.pilotQuick);
  t.closest('.pilot-quick').querySelectorAll('button').forEach(b=>b.disabled=true);
  try{await window.forjaPilot.sendFeedback({rating:n,text:''});pilotQuick.rating=n;pilotFeedback.rating=n;render();}
  catch(e){toast(e.message);render();}
});
function pilotFeedbackHtml() {
  if(pilotFeedback.sent)return '<section class="card card-pad pilot-feedback no-print"><h2>Obrigado pelo feedback!</h2><p>A equipa da Forja vai ler.</p><button type="button" class="small" data-feedback-again>Enviar mais</button></section>';
  return `<section class="card card-pad pilot-feedback no-print"><details data-fold="feedback"${pilotFold.feedback?' open':''}><summary><h2>O que achaste da Forja?</h2><span class="smalltext muted">Um minuto, ajuda-nos muito</span></summary>
    <div class="pilot-rating" role="group" aria-label="Nota de 1 a 5">${[1,2,3,4,5].map(n=>`<button type="button" data-feedback-rating="${n}" aria-pressed="${pilotFeedback.rating===n}" class="${pilotFeedback.rating===n?'chosen':''}">${n}</button>`).join('')}<small>1 = não usava · 5 = usava já</small></div>
    <textarea class="field" id="pilot-feedback-text" rows="3" maxlength="2000" placeholder="O que falta? O que não percebeste? O que mudavas?">${esc(pilotFeedback.text)}</textarea>
    <button type="button" class="primary" data-feedback-send>Enviar feedback</button></details></section>`;
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
  if(target.hasAttribute('data-pilot-feedback-go')) {if(pilotPage!=='feedback'||view!=='projects'){pilotFold.feedback=true;pilotPage='feedback';view='projects';render();}document.querySelector('.pilot-feedback')?.scrollIntoView({behavior:'smooth'});document.querySelector('#pilot-feedback-text')?.focus({preventScroll:true});return;}
  if(target.hasAttribute('data-pilot-catalog')) {
    const rows=(state.settings.catalog||[]).map(x=>[x.label,x.unit,String(x.price).replace('.',','),x.date?x.date.split('-').reverse().join('/'):'',x.supplier||''].join(';').replace(/;+$/,'')).join('\n');
    modal(`${modalHead('Preços e catálogo da empresa','Valores gerais em cima. Artigos em baixo, um por linha: nome; unidade; custo; data da cotação; fornecedor (os dois últimos são opcionais). A Forja usa estes custos no orçamento, diz a confiança de cada correspondência e avisa quando a cotação está velha.')}
      <div class="pilot-drawing">
      <section class="pilot-general"><h3>Valores gerais</h3>
      <div class="pilot-prices"><label>Custo por hora de partida (€)<input class="field" id="pc-hour" type="number" min="0" max="100000" step="0.01" value="${esc(state.settings.hour)}"></label>
      <label>Acréscimo sobre custo (%)<input class="field" id="pc-markup" type="number" min="0" max="1000" step="0.01" value="${esc(state.settings.markup)}"></label>
      <label>IVA (%)<input class="field" id="pc-vat" type="number" min="0" max="100" step="0.01" value="${esc(state.settings.vat)}"></label></div>
      <details class="pilot-why"><summary>Para que serve cada um?</summary><ul>
        <li><b>Custo por hora de partida:</b> quanto custa à oficina uma hora de trabalho (salário, encargos, máquinas, energia). Usado nas linhas em horas quando o catálogo não tem um artigo em horas mais parecido (por exemplo "Soldadura TIG; h; 45").</li>
        <li><b>Acréscimo sobre custo:</b> o que se soma ao custo de materiais e horas para chegar ao preço. Não é a margem sobre a venda: 25 % de acréscimo sobre o custo dá uma margem de 20 % sobre o preço de venda (100 € de custo → 125 € de venda → 25 € são 20 % de 125 €). Cada orçamento pode ter outro acréscimo, conforme a obra e o cliente.</li>
        <li><b>IVA:</b> a taxa somada no fim ao total. Normalmente 23 %; algumas obras de habitação têm taxa reduzida, confirma com o contabilista.</li>
        <li>Os <b>artigos</b> abaixo têm o custo de cada material ou serviço, com a data da cotação e o fornecedor.</li></ul></details>
      <label class="pilot-rules">Como a oficina trabalha<textarea class="field" id="pc-rules" rows="4" maxlength="3000" placeholder="O que assumem quando o cliente não diz. Ex.: usamos chapa de 3 mm salvo indicação; inox 304 por defeito, 316 no exterior junto ao mar; montagem incluída até 30 km; ferro de exterior sempre galvanizado e lacado.">${esc(state.settings.houseRules||'')}</textarea></label>
      <p class="smalltext muted">Vai junto em todos os "Obter orçamento": o rascunho aplica estas regras quando o pedido não diz o contrário e marca "regra da casa" nas linhas. Os valores valem para os orçamentos novos; os já feitos não mudam.</p></section>
      <h3>Artigos</h3>
      <label class="sr-only" for="pc-text">Artigos</label><textarea class="field pilot-catalog-text" id="pc-text" rows="12" placeholder="Chapa inox 2 mm;m²;78&#10;Tubo aço 40×40×2;m;4,50&#10;Montagem em obra;h;35">${esc(rows)}</textarea>
      <label>Ou importar a tabela de preços dos fornecedores (Excel .xlsx ou CSV)<input class="field" id="pc-file" type="file" accept=".xlsx,.csv,.txt,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"></label>
      <p class="smalltext muted">Sem tabela completa? <button type="button" class="small" data-pilot-sample-catalog>Juntar catálogo de referência (≈200 artigos)</button> <a href="/pilot/catalogo-exemplo.xlsx" download>descarregar o Excel</a>. Aço, inox, perfis, ferragens e processos, com preços fictícios marcados “Referência”: junta-se ao teu catálogo sem apagar nada e deves substituí-los pelos teus.</p>
      <label>Ou ler orçamentos antigos (PDF com texto ou .txt)<input class="field" id="pc-quotes" type="file" multiple accept=".pdf,.txt,application/pdf,text/plain"></label>
      <p class="smalltext muted">Unidades: un, m, m², m³, kg ou h. Preços por barra são convertidos para metro quando o nome diz o comprimento. Separa com ponto e vírgula ou tabulação. Até 2000 artigos.</p>
      <p id="pc-status" class="pilot-message" role="alert" hidden></p>
      <div class="pilot-start"><button type="button" class="primary" data-pilot-catalog-save>Guardar preços e catálogo</button><button type="button" data-action="close">Cancelar</button></div></div>`);
    const importSheet=async f=>{
      const status=document.querySelector('#pc-status'),say=t=>{status.hidden=!t;status.textContent=t;};
      if(!/\.xlsx$/i.test(f.name)){document.querySelector('#pc-text').value=(await f.text()).slice(0,400000);return;}
      say('A ler o Excel…');
      try {
        const X=await import('/pilot/xlsx.mjs');
        const fileDate=new Date(f.lastModified||Date.now()).toISOString().slice(0,10);
        const {items,notes}=X.supplierCatalog(await X.readXlsx(f),fileDate);
        if(!items.length)return say('Não encontrei artigos com preço neste Excel. Confirma que tem uma coluna com o nome e outra com o preço.');
        const box=document.querySelector('#pc-text');
        const fold=t=>t.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().trim();
        const have=new Map(box.value.split(/\r?\n/).filter(Boolean).map(l=>[fold(l.split(/\t|;/)[0]||''),l]));
        for(const x of items)have.set(fold(x.label),[x.label,x.unit,String(x.price).replace('.',','),x.date?x.date.split('-').reverse().join('/'):'',x.supplier].join(';').replace(/;+$/,''));
        box.value=[...have.values()].join('\n');
        say(`${items.length} artigo(s) lidos do Excel. ${notes.join(' ')} Os que não tinham data ficaram com a data do ficheiro (${fileDate.split('-').reverse().join('/')}). Revê e carrega em Guardar.`);
      } catch(err) {say('Não foi possível ler este Excel: '+err.message);}
    };
    document.querySelector('#pc-file').addEventListener('change',e=>{if(e.target.files[0])importSheet(e.target.files[0]);});
    document.querySelector('[data-pilot-sample-catalog]').addEventListener('click',async()=>{
      const blob=await (await fetch('/pilot/catalogo-exemplo.xlsx')).blob();
      importSheet(new File([blob],'catalogo-exemplo.xlsx',{type:blob.type,lastModified:Date.now()}));
    });
    document.querySelector('#pc-quotes').addEventListener('change',e=>pilotImportQuotes([...e.target.files]));
    return;
  }
  if(target.hasAttribute('data-pilot-catalog-save')) {
    const status=document.querySelector('#pc-status'),say=t=>{status.hidden=!t;status.textContent=t;};
    let catalog;
    try {catalog=pilotParseCatalog(document.querySelector('#pc-text').value);} catch(e) {return say(e.message);}
    const num=id=>Number(String(document.querySelector(id).value).replace(',','.'));
    const prices={hour:num('#pc-hour'),markup:num('#pc-markup'),vat:num('#pc-vat'),houseRules:document.querySelector('#pc-rules').value};
    if([prices.hour,prices.markup,prices.vat].some(v=>!Number.isFinite(v)||v<0))return say('Confirma os valores gerais: custo por hora, acréscimo e IVA.');
    target.disabled=true;say('');
    try {
      const out=await window.forjaPilot.savePrices(prices);
      Object.assign(state.settings,{hour:out.hour,markup:out.markup,vat:out.vat,houseRules:out.houseRules||''});
      state.settings.catalog=await window.forjaPilot.saveCatalog(catalog);
      closeModal();render();toast(`Catálogo guardado: ${state.settings.catalog.length} artigo(s), ${String(out.hour).replace('.',',')} €/h, acréscimo ${String(out.markup).replace('.',',')} %, IVA ${String(out.vat).replace('.',',')} %.`);
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
  if(target.hasAttribute('data-pilot-history')) {pilotPage='history';view='projects';render();return;}
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
      for(const f of files){const id=uid();const out=await window.forjaPilot.putFile(id,f);saved.push({id,name:f.name,size:out?.size||f.size,type:out?.type||f.type,created:now()});}
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
  const hourly=()=>{line.price=Number(state.settings.hour)||0;if(!keepSource)line.source='Custo por hora da oficina';line.match={label:'',score:0,manual:false,applied:true,hourly:true};return 'applied';};
  if((!best || best.score<60 || (best.row.unit!==line.unit && !withUnit)) && line.unit==='h')return hourly();
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
  if(m.hourly && !m.manual)return `<span class="pilot-conf pilot-conf-mid" title="Sem artigo de horas no catálogo: usa o custo por hora de partida da oficina">Custo/hora da oficina</span>`;
  if(m.manual)return `<span class="pilot-conf pilot-conf-manual" title="Custo alterado à mão${m.label?' · catálogo: '+esc(m.label):''}">Manual</span>`;
  if(!m.applied)return `<span class="pilot-conf pilot-conf-low" title="${m.label?'Artigo mais parecido: '+esc(m.label)+' ('+m.score+'%), não é o mesmo':'Catálogo vazio'}">Sem artigo no catálogo · indicar custo</span>`;
  const level=m.score>=85?'high':'mid';
  return `<span class="pilot-conf pilot-conf-${level}" title="Artigo do catálogo: ${esc(m.label)}"><span class="pilot-bar" aria-hidden="true"><span style="width:${m.score}%"></span></span>${level==='high'?'Alta':'Média'} · ${m.score}%</span>${pilotAgeChip(m.label)}`;
}
// Aviso de cotação velha: o preço do fornecedor tem data e envelhece.
const PILOT_STALE_DAYS=30;
function pilotAgeChip(label) {
  const row=(state.settings.catalog||[]).find(c=>c.label===label);
  if(!row?.date)return '';
  const days=Math.floor((Date.now()-new Date(row.date+'T12:00:00'))/86400000);
  if(days<PILOT_STALE_DAYS)return '';
  return `<span class="pilot-stale" title="Cotação de ${row.date.split('-').reverse().join('/')}${row.supplier?' · '+esc(row.supplier):''}">Cotação com ${days} dias: confirma</span>`;
}
function pilotAfterEdit(p,l,k) {
  if(k==='price'||k==='unit'){if(l.match)l.match.manual=true;return false;}
  if(k==='desc' && !l.match?.manual && (state.settings.catalog||[]).length){
    pilotAutoPrice(l,{withUnit:true});dirty(p);event(p,'Linha «'+l.desc+'»: custo procurado no catálogo','Catálogo da oficina');persist();render();return true;
  }
  return false;
}
async function pilotImportQuotes(files) {
  const status=document.querySelector('#pc-status'),say=t=>{status.hidden=!t;status.textContent=t;};
  if(!files.length)return;
  if(files.length>20)return say('Escolhe até 20 orçamentos de cada vez.');
  say('A ler os orçamentos…');
  try {
    const {parseQuoteText,toCatalog}=await import('/pilot/import-quotes.js');
    const lines=[];let warnings=0,empty=[];
    for(const f of files) {
      const text=f.type==='application/pdf'||/\.pdf$/i.test(f.name)?await window.forjaPilot.pdfText(f,20):await f.text();
      const r=parseQuoteText(String(text).slice(0,400000));
      if(!r.lines.length)empty.push(f.name);
      lines.push(...r.lines.map(l=>({...l,unit:l.unit==='ml'?'m':l.unit,lastSeen:new Date(f.lastModified||Date.now()).toISOString().slice(0,10)})));
      warnings+=r.warnings.length;
    }
    const box=document.querySelector('#pc-text');
    const fold=s=>s.normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/\s+/g,' ').trim();
    const have=new Set(box.value.split(/\r?\n/).map(l=>l.split(/\t|;/)).filter(c=>c.length>=2).map(c=>fold(c[0])+'|'+c[1].trim()));
    const fresh=toCatalog(lines).filter(x=>!have.has(fold(x.label)+'|'+x.unit));
    if(fresh.length)box.value=(box.value.trim()?box.value.trim()+'\n':'')+fresh.map(x=>`${x.label};${x.unit};${String(Math.round(x.price*100)/100).replace('.',',')}`).join('\n');
    say(`${fresh.length} artigo(s) novos a partir de ${lines.length} linha(s) lidas.`+
      (warnings?` ${warnings} linha(s) ficaram de fora por não baterem certo (quantidade × preço ≠ total ou sem preço).`:'')+
      (empty.length?` Sem linhas lidas em: ${empty.join(', ')} (se for digitalizado, não tem texto).`:'')+
      ' Atenção: os preços dos orçamentos são de venda. Se o catálogo for de custos, ajusta-os antes de guardar, ou o acréscimo é aplicado duas vezes.');
  } catch(e) {say('Não foi possível ler estes orçamentos: '+e.message);}
}
function pilotParseCatalog(text) {
  const units={'un':'un','un.':'un','uni':'un','unid':'un','unid.':'un','unidade':'un','unidades':'un','m':'m','ml':'m','m2':'m²','m²':'m²','m3':'m³','m³':'m³','kg':'kg','h':'h','hr':'h','hora':'h','horas':'h'};
  const rows=String(text).split(/\r?\n/).map(l=>l.trim()).filter(Boolean);
  if(rows.length>2000)throw new Error('O catálogo pode ter até 2000 artigos.');
  return rows.filter((line,i)=>!(i===0 && /artigo|descri/i.test(line) && !/\d/.test(line))).map((line,i)=>{
    const cols=line.split(/\t|;/).map(c=>c.trim());
    if(cols.length<3)throw new Error(`Linha ${i+1}: escreve nome; unidade; custo.`);
    const unit=units[cols[1].toLowerCase()];
    if(!unit)throw new Error(`Linha ${i+1}: a unidade «${cols[1]}» não é un, m, m², m³, kg nem h.`);
    const price=Number(cols[2].replace(/[€\s]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.'));
    if(!Number.isFinite(price)||price<0)throw new Error(`Linha ${i+1}: o custo «${cols[2]}» não é um número.`);
    if(!cols[0]||cols[0].length>180)throw new Error(`Linha ${i+1}: falta o nome do artigo.`);
    const item={label:cols[0],unit,price};
    if(cols[3]){
      const d=cols[3].match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/),iso=cols[3].match(/^\d{4}-\d{2}-\d{2}$/);
      if(iso)item.date=cols[3];else if(d)item.date=`${d[3].length===2?'20'+d[3]:d[3]}-${d[2].padStart(2,'0')}-${d[1].padStart(2,'0')}`;
      else throw new Error(`Linha ${i+1}: a data «${cols[3]}» não está no formato dd/mm/aaaa.`);
    }
    if(cols[4])item.supplier=cols[4].slice(0,80);
    return item;
  });
}
// Fecha o lembrete "Antes de fechar" ao clicar fora.
document.addEventListener('click',e=>{const d=document.querySelector('details.pilot-pending[open]');if(d&&!d.contains(e.target))d.open=false;});
