const root = document.querySelector('#app');
const escape = value => String(value ?? '').replace(/[&<>"']/g, char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const invite = new URLSearchParams(location.hash.slice(1)).get('convite');
let officeList = [];

async function request(path, {method='GET', json, blob}={}) {
  const headers = {};
  if (json !== undefined) headers['Content-Type']='application/json';
  if (blob) headers['Content-Type']=blob.type || 'application/octet-stream';
  const response=await fetch('/api/pilot'+path,{method,headers,body:blob || (json===undefined?undefined:JSON.stringify(json)),cache:'no-store'});
  if (!response.ok) {
    const data=await response.json().catch(()=>({}));
    throw new Error(data.error || 'Não foi possível ligar à Forja.');
  }
  return response;
}
const api = async (path,options) => (await request(path,options)).json();
const post = (path,json) => api(path,{method:'POST',json});
function alertText(message) {
  const element=document.querySelector('#pilot-message');
  if(element) {element.hidden=!message;element.textContent=message;}
}
function access(mode) {
  const titles={setup:'Criar administrador',activate:'Ativar a tua oficina',login:'Entrar na Forja'};
  const descriptions={setup:'Usa o código inicial que recebeste.',activate:'Escolhe a palavra-passe da tua conta.',login:'Abre os orçamentos da tua oficina.'};
  const email=mode==='activate'?'':'<label>Email<input class="field" name="email" type="email" autocomplete="username" required></label>';
  root.innerHTML=`<main class="pilot-access"><div class="pilot-brand"><span>f</span> Forja</div>
    <section class="card card-pad"><h1>${titles[mode]}</h1><p>${descriptions[mode]}</p>
    <p id="pilot-message" class="pilot-message" role="alert" hidden></p>
    <form data-pilot-form="${mode}">
      ${mode==='setup'?'<label>Código inicial<input class="field" name="code" type="password" required autocomplete="off"></label>':''}
      ${email}<label>Palavra-passe<input class="field" name="password" type="password" required ${mode==='login'?'autocomplete="current-password"':'autocomplete="new-password" minlength="12"'} maxlength="128"></label>
      <label class="pilot-show"><input type="checkbox" data-pilot-show> Mostrar palavra-passe</label>
      ${mode==='login'?'':'<p class="muted smalltext">Mínimo de 12 caracteres.</p>'}
      <button class="primary" type="submit">${titles[mode]}</button>
    </form></section></main>`;
}
function landing() {
  root.innerHTML=`<main class="pilot-access pilot-landing"><div class="pilot-brand"><span>f</span> Forja</div>
    <section class="card card-pad"><h1>Do pedido ao orçamento em minutos.</h1>
    <p>Envia o pedido de um cliente (texto, foto, esquiço ou PDF) e recebe o rascunho do orçamento.</p>
    <p id="pilot-message" class="pilot-message" role="alert" hidden></p>
    <button class="primary pilot-try" type="button" data-pilot-action="demo">Experimentar agora</button>
    <p class="muted smalltext">Abre uma oficina de demonstração, sem conta. Não envies dados pessoais de clientes.</p>
    <details class="muted smalltext"><summary>Privacidade</summary><p>A oficina é responsável pelos dados dos seus clientes. A Forja trata-os por conta da oficina para preparar orçamentos, com alojamento na UE e acesso limitado à equipa autorizada da oficina, da Forja e dos fornecedores contratados para prestar o serviço. Os dados pessoais ficam excluídos do treino de modelos. A Forja apaga os pedidos que não avancem até 90 dias após a receção e os restantes até 90 dias após o fecho do orçamento. O fim do piloto antecipa o apagamento, salvo obrigação legal. Para exercer direitos sobre os dados de um pedido, contacte a oficina.</p></details></section>
    <section class="card card-pad"><h2>Já tenho conta</h2>
    <form data-pilot-form="login"><label>Email<input class="field" name="email" type="email" autocomplete="username" required></label>
    <label>Palavra-passe<input class="field" name="password" type="password" required autocomplete="current-password" maxlength="128"></label>
    <label class="pilot-show"><input type="checkbox" data-pilot-show> Mostrar palavra-passe</label>
    <button type="submit">Entrar</button></form></section></main>`;
}
const bytesText = n => n>=1048576?(n/1048576).toFixed(1).replace('.',',')+' MB':Math.max(1,Math.round(n/1024))+' kB';
const dateText = value => value?new Date(value).toLocaleString('pt-PT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'';
let inboxData={items:[]};
function inboxHtml() {
  const cards=inboxData.items.map(item=>{
    const key=item.workshop.id+'/'+item.project.id;
    const files=item.files.map(f=>`<button type="button" class="small pilot-file" data-pilot-action="open-file" data-workshop="${item.workshop.id}" data-id="${escape(f.id)}" data-name="${escape(f.name)}">${escape(f.name)} <small>${bytesText(f.size)}</small></button>`).join('');
    const sent=item.responses.map(r=>`<li><span>${r.name?`<strong>${escape(r.name)}</strong> <small>${bytesText(r.size||0)}</small>`:''}${r.note?` <em>${escape(r.note)}</em>`:''} <small>· ${dateText(r.created)}</small></span>
      <button type="button" class="small" data-pilot-action="remove-response" data-id="${r.id}" aria-label="Apagar resposta">Apagar</button></li>`).join('');
    return `<article class="card card-pad pilot-request ${item.responses.length?'':'pilot-waiting'}">
      <header><div><strong>${escape(item.project.code)} · ${escape(item.project.name)}</strong>
      <small>${escape(item.workshop.name)}${item.workshop.demo?' · demonstração':''} · cliente: ${escape(item.project.client||'—')} · ${dateText(item.last)}</small></div>
      ${item.project.kind==='desenho'?'<span class="pilot-tag pilot-tag-drawing">Desenho técnico</span>':''}<span class="pilot-tag">${item.responses.length?'Respondido':'Por responder'}${item.project.priceCheck?' · rascunho '+({under:'abaixo',ok:'certo',over:'acima'})[item.project.priceCheck]:''}</span></header>
      ${item.project.request?`<details><summary>Pedido em texto</summary><pre>${escape(item.project.request)}</pre></details>`:''}
      <div class="pilot-files">${files||'<small>Sem anexos.</small>'}</div>
      <div class="pilot-drop" data-drop="${key}" tabindex="0" role="button" aria-label="Enviar resposta">
        <p><strong>Arrasta para aqui a resposta</strong> (PDF ou imagem) ou clica para escolher.</p>
        <input type="file" hidden accept=".pdf,image/png,image/jpeg,image/webp">
        <textarea class="field" rows="2" maxlength="4000" placeholder="Nota para a oficina (opcional)"></textarea>
        <button type="button" class="small" data-pilot-action="send-note">Enviar só a nota</button>
        <p class="pilot-drop-status" role="status"></p></div>
      ${sent?`<ul class="pilot-sent">${sent}</ul>`:''}</article>`;
  }).join('');
  const used=inboxData.maxStorage?` · espaço usado: ${bytesText(inboxData.storage||0)} de ${bytesText(inboxData.maxStorage)}`:'';
  return `<div class="pilot-inbox-head"><h2>Pedidos recebidos</h2><button type="button" class="small" data-pilot-action="refresh">Atualizar</button></div>
    <p class="muted smalltext">${inboxData.items.length} pedido(s), de todas as oficinas${used}</p>
    ${cards||'<p class="empty">Ainda não chegou nenhum pedido.</p>'}`;
}
let feedbackData={items:[],checks:{under:0,ok:0,over:0},checked:[]};
function feedbackHtml() {
  const c=feedbackData.checks,rated=feedbackData.items.filter(f=>f.rating);
  const average=rated.length?(rated.reduce((sum,f)=>sum+f.rating,0)/rated.length).toFixed(1).replace('.',','):'—';
  const rows=feedbackData.items.map(f=>`<li><strong>${f.rating?f.rating+'/5':'sem nota'}</strong> ${f.text?escape(f.text):'<em>sem texto</em>'}<small>${escape(f.workshop)} · ${dateText(f.created)}</small></li>`).join('');
  const names={under:'abaixo',ok:'certo',over:'acima'};
  const eur=v=>new Intl.NumberFormat('pt-PT',{style:'currency',currency:'EUR'}).format(v);
  const checked=feedbackData.checked.map(x=>{
    const diff=x.actual>0&&x.draft!=null?Math.round((x.draft-x.actual)/x.actual*100):null;
    return `<li>${escape(x.project)}${x.example?' (exemplo)':''}: <strong>${x.check?names[x.check]:'sem avaliação'}</strong>
      ${x.actual!=null?` · rascunho ${x.draft!=null?eur(x.draft):'—'} · final ${eur(x.actual)}${diff!==null?` (<strong>${diff>0?'+':''}${diff}%</strong>)`:''}`:''}
      ${x.note?`<br>O que falhou: ${escape(x.note)}`:''}<small>${escape(x.workshop)}${x.saved?' · '+dateText(x.saved):''}</small></li>`;}).join('');
  return `<h2>Feedback</h2>
    <div class="pilot-stats"><div><strong>${feedbackData.items.length}</strong><span>respostas</span></div><div><strong>${average}</strong><span>nota média (1 a 5)</span></div>
    <div><strong>${c.under}</strong><span>rascunhos abaixo</span></div><div><strong>${c.ok}</strong><span>rascunhos certos</span></div><div><strong>${c.over}</strong><span>rascunhos acima</span></div></div>
    ${rows?`<ul class="pilot-feedback-list">${rows}</ul>`:'<p class="empty">Ainda não há feedback.</p>'}
    ${checked?`<h3>Orçamentos avaliados (${feedbackData.checked.length})</h3><ul class="pilot-feedback-list">${checked}</ul>`:''}`;
}
async function refreshInbox(force) {
  const box=document.querySelector('#pilot-inbox');
  if(!box)return;
  if(!force && (box.querySelector('.pilot-dragging') || [...box.querySelectorAll('textarea')].some(t=>t.value) || box.contains(document.activeElement)))return;
  inboxData=await api('/admin/inbox');
  box.innerHTML=inboxHtml();
  feedbackData=await api('/admin/feedback');
  const panel=document.querySelector('#pilot-feedback-admin');
  if(panel)panel.innerHTML=feedbackHtml();
}
async function sendResponse(zone,file) {
  const status=zone.querySelector('.pilot-drop-status'),note=zone.querySelector('textarea').value.trim();
  if(!file && !note){status.textContent='Escreve uma nota ou junta um ficheiro.';return;}
  if(file && file.size>20*1024*1024){status.textContent='O ficheiro tem de ter menos de 20 MB.';return;}
  status.textContent='A enviar…';
  const query=new URLSearchParams();
  if(file)query.set('name',file.name);
  if(note)query.set('note',note);
  try {
    await request('/admin/responses/'+zone.dataset.drop+'?'+query,{method:'PUT',blob:file||new Blob([],{type:'application/octet-stream'})});
    zone.querySelector('textarea').value='';
    await refreshInbox(true);
  } catch(e) {status.textContent=e.message;}
}
async function openBlob(path,name) {
  const blob=await (await request(path)).blob();
  const link=document.createElement('a');
  link.href=URL.createObjectURL(blob);
  if(/^(application\/pdf|image\/)/.test(blob.type)) link.target='_blank'; else link.download=name||'ficheiro';
  if(name && !link.target) link.download=name;
  document.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(link.href),60000);
}
root.addEventListener('dragover',event=>{
  const zone=event.target.closest?.('.pilot-drop');
  if(zone){event.preventDefault();zone.classList.add('pilot-dragging');}
});
root.addEventListener('dragleave',event=>event.target.closest?.('.pilot-drop')?.classList.remove('pilot-dragging'));
root.addEventListener('drop',event=>{
  const zone=event.target.closest?.('.pilot-drop');
  if(!zone)return;
  event.preventDefault();zone.classList.remove('pilot-dragging');
  if(event.dataTransfer.files[0])sendResponse(zone,event.dataTransfer.files[0]);
});
root.addEventListener('change',event=>{
  if(event.target.matches?.('[data-pilot-show]')){const f=event.target.closest('form').querySelector('input[name=password]');f.type=event.target.checked?'text':'password';return;}
  const zone=event.target.closest?.('.pilot-drop');
  if(zone && event.target.type==='file' && event.target.files[0]){sendResponse(zone,event.target.files[0]);event.target.value='';}
});
function priceInputs(settings={}) {
  const entries=(settings.catalog||[]).map(x=>`${x.label};${x.unit};${x.price}`).join('\n');
  return `<div class="field-grid"><label>Custo por hora (€)<input class="field" name="hour" type="number" min="0" max="100000" step="0.01" required value="${escape(settings.hour)}"></label>
  <label>Acréscimo sobre custo (%)<input class="field" name="markup" type="number" min="0" max="1000" step="0.01" required value="${escape(settings.markup)}"></label>
  <label>IVA (%)<input class="field" name="vat" type="number" min="0" max="100" step="0.01" required value="${escape(settings.vat)}"></label></div>
  <label>Custos unitários da oficina<textarea class="field" name="catalog" rows="4" placeholder="Artigo;unidade;custo">${escape(entries)}</textarea></label>
  <p class="smalltext muted">Uma linha por artigo, com ponto e vírgula entre os campos. Usa un, m, m², m³, kg ou h.</p>`;
}
function readPrices(data) {
  const catalog=String(data.get('catalog')||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
    const columns=line.split(';').map(x=>x.trim());
    if(columns.length!==3 || !columns[0] || !columns[2]) throw new Error('Cada linha de preços precisa de artigo, unidade e custo.');
    return {label:columns[0],unit:columns[1],price:Number(columns[2].replace(',','.'))};
  });
  return {hour:Number(data.get('hour')),markup:Number(data.get('markup')),vat:Number(data.get('vat')),catalog};
}
async function admin(link='') {
  const everyOffice=await api('/admin/workshops');
  officeList=everyOffice.filter(w=>!w.demo);
  const demos=everyOffice.length-officeList.length;
  inboxData=await api('/admin/inbox');
  feedbackData=await api('/admin/feedback');
  const rows=officeList.map(w=>`<tr><td><strong>${escape(w.name)}</strong><small>${escape(w.email)} · ${w.active?'Ativa':'Por ativar'}</small></td>
    <td>${w.lastUse?escape(new Date(w.lastUse).toLocaleString('pt-PT')):'—'}</td>
    <td>${w.requests}</td><td>${w.drafts}</td><td>${w.savedQuotes}</td><td>${w.accepted}</td>
    <td><button type="button" class="small" data-pilot-action="prices" data-id="${w.id}">Preços</button>
    <button type="button" class="small" data-pilot-action="invite" data-id="${w.id}">${w.active?'Repor acesso':'Novo convite'}</button></td></tr>`).join('');
  root.innerHTML=`<main class="pilot-admin"><header class="pilot-header"><div class="pilot-brand"><span>f</span> Forja</div><button data-pilot-action="logout">Sair</button></header>
    <p id="pilot-message" class="pilot-message" role="alert" hidden></p>
    <section id="pilot-inbox">${inboxHtml()}</section>
    <section id="pilot-feedback-admin" class="card card-pad">${feedbackHtml()}</section>
    <h1>Utilização por oficina</h1><p>Projetos guardados e última atividade registada no servidor.${demos?` Contas de demonstração abertas: ${demos}.`:''}</p>
    ${link?`<section class="card card-pad pilot-invite"><h2>Convite da oficina</h2><p>Partilha este link com a oficina. Fica válido durante três dias.</p><input class="field" id="pilot-invite-link" value="${escape(link)}" readonly aria-label="Link do convite"><button type="button" data-pilot-action="copy">Copiar link</button><p id="pilot-copied" role="status"></p></section>`:''}
    <section class="card table-scroll"><table class="project-list"><thead><tr><th>Oficina</th><th>Última utilização</th><th>Pedidos</th><th>Rascunhos</th><th>Orçamentos guardados</th><th>Aceites</th><th>Ações</th></tr></thead><tbody>${rows}</tbody></table>${rows?'':'<p class="empty">Cria a primeira oficina para começar.</p>'}</section>
    <section class="card card-pad pilot-create"><h2>Adicionar oficina</h2><form data-pilot-form="workshop">
      <div class="field-grid"><label>Nome da oficina<input class="field" name="name" required maxlength="100"></label><label>Email de acesso<input class="field" name="email" type="email" required></label></div>
      <p class="smalltext muted">Custo por hora, acréscimo, IVA e catálogo ficam com valores de partida (35 €/h, 25 %, 23 %) e a própria oficina muda-os no seu menu.</p>
      <button type="submit" class="primary">Criar oficina e convite</button></form></section>
    <section id="pilot-edit-prices" class="card card-pad" hidden></section></main>`;
}
function inviteLink(raw) {return location.origin+'/#convite='+encodeURIComponent(raw);}
async function signOut() {
  if(window.forjaPilot && !await window.forjaPilot.flush()) return;
  await post('/logout',{});
  location.replace('/');
}
root.addEventListener('submit',async event=>{
  const form=event.target,mode=form.dataset.pilotForm;
  if(!mode)return;
  event.preventDefault();alertText('');
  const button=form.querySelector('[type="submit"]');
  button.disabled=true;
  try {
    const values=new FormData(form);
    if(mode==='workshop') {
      const result=await post('/admin/workshops',{name:values.get('name'),email:values.get('email')});
      await admin(inviteLink(result.invite));
    } else if(mode==='prices') {
      await post('/admin/workshops/'+form.dataset.id+'/prices',readPrices(values));
      await admin();
    } else {
      const data=Object.fromEntries(values);
      if(mode==='activate')data.invite=invite;
      await post('/'+mode,data);
      location.replace('/');
    }
  } catch(e) {alertText(e.message);}
  finally {button.disabled=false;}
});
root.addEventListener('click',async event=>{
  const button=event.target.closest('[data-pilot-action]');
  if(!button) {
    const zone=event.target.closest('.pilot-drop');
    if(zone && !event.target.closest('textarea,button,input'))zone.querySelector('input[type=file]').click();
    return;
  }
  try {
    if(button.dataset.pilotAction==='logout') await signOut();
    if(button.dataset.pilotAction==='demo') {button.disabled=true;try{await post('/demo',{});location.replace('/');}finally{button.disabled=false;}}
    if(button.dataset.pilotAction==='refresh') await refreshInbox(true);
    if(button.dataset.pilotAction==='open-file') await openBlob('/admin/files/'+button.dataset.workshop+'/'+encodeURIComponent(button.dataset.id),button.dataset.name);
    if(button.dataset.pilotAction==='send-note') await sendResponse(button.closest('.pilot-drop'));
    if(button.dataset.pilotAction==='remove-response') {await request('/admin/responses/'+button.dataset.id,{method:'DELETE'});await refreshInbox(true);}
    if(button.dataset.pilotAction==='open-response') await openBlob('/responses/'+button.dataset.id,button.dataset.name);
    if(button.dataset.pilotAction==='invite') {
      const result=await post('/admin/workshops/'+button.dataset.id+'/invite',{});
      await admin(inviteLink(result.invite));
    }
    if(button.dataset.pilotAction==='prices') {
      const office=officeList.find(w=>w.id===button.dataset.id);
      const panel=document.querySelector('#pilot-edit-prices');
      panel.hidden=false;
      panel.innerHTML=`<h2>Preços · ${escape(office.name)}</h2><form data-pilot-form="prices" data-id="${office.id}">${priceInputs(office.settings)}<button type="submit" class="primary">Guardar preços</button></form>`;
      panel.scrollIntoView({behavior:'smooth'});
      panel.querySelector('input').focus({preventScroll:true});
    }
    if(button.dataset.pilotAction==='copy') {
      const field=document.querySelector('#pilot-invite-link');
      field.select();
      const status=document.querySelector('#pilot-copied');
      try {await navigator.clipboard.writeText(field.value);status.textContent='Link copiado.';}
      catch {status.textContent='Link selecionado. Usa Ctrl+C para copiar.';}
    }
  } catch(e) {alertText(e.message);}
});
function loadScript(src) {
  return new Promise((resolve,reject)=>{
    const script=document.createElement('script');script.src=src;
    script.onload=resolve;script.onerror=()=>reject(new Error('Não foi possível carregar a área da oficina.'));
    document.head.append(script);
  });
}
async function workshop() {
  const initial=await api('/workspace');
  const privacy=await import('/pilot/privacy.mjs');
  let zones=initial.state.settings?.privacy?.zones||[];
  let revision=initial.revision, queue=Promise.resolve(), pending=0, failure='', lastQueued=JSON.stringify(initial.state);
  function status(message) {
    const node=document.querySelector('#pilot-save-status');
    if(node)node.textContent=message;
  }
  window.forjaPilot={
    initialState:initial.state,
    demo:!!initial.demo,
    status:()=>failure || (pending?'A guardar…':'Guardado na oficina'),
    save(state) {
      const found=privacy.redactState(state);
      if(found.length && typeof window.toast==='function') {
        const kinds=[...new Set(found)].join(', ');
        setTimeout(()=>window.toast(`Tapámos dados pessoais no texto (${kinds}). Os contactos do cliente ficam só no campo Cliente.`),0);
        if(typeof window.forjaRender==='function')setTimeout(window.forjaRender,0);
      }
      const serialized=JSON.stringify(state);
      if(serialized===lastQueued)return true;
      lastQueued=serialized;
      const snapshot=JSON.parse(serialized);
      pending++;status('A guardar…');
      queue=queue.then(async()=>{
        if(failure)return;
        try {
          const result=await api('/workspace',{method:'PUT',json:{revision,state:snapshot}});
          revision=result.revision;
        } catch(e) {failure=e.message;}
      }).finally(()=>{
        pending--;
        status(window.forjaPilot.status());
        if(failure && typeof window.toast==='function')window.toast(failure);
      });
      return true;
    },
    async flush() {await queue;return !failure;},
    async putFile(id,blob) {
      let prepared;
      const status=privacy.busy('A proteger os dados pessoais de '+(blob.name||'ficheiro')+'…');
      try { prepared=await privacy.prepareUpload(blob,zones,t=>status.set(t)); } finally { status.close(); }
      const ready=await privacy.reviewUpload(prepared,blob.name);
      if(!ready)throw new Error('Envio cancelado. O ficheiro não foi guardado.');
      await request('/files/'+encodeURIComponent(id),{method:'PUT',blob:ready});
      return {size:ready.size,type:ready.type};
    },
    privacyZones:()=>zones.length,
    pdfText:(blob,pages)=>privacy.pdfText(blob,pages),
    editPrivacy() {
      privacy.editZones(zones,async next=>{zones=(await api('/privacy',{method:'PUT',json:{zones:next}})).zones;if(typeof window.forjaRender==='function')window.forjaRender();});
    },
    formLink:initial.formToken?location.origin+'/pedido/'+initial.formToken:'',
    markImported:id=>post('/requests/'+encodeURIComponent(id)+'/imported',{}),
    ai:{get:id=>api('/ai/'+encodeURIComponent(id)),run:(id,body)=>post('/ai/'+encodeURIComponent(id),body)},
    deleteFile:id=>api('/files/'+encodeURIComponent(id),{method:'DELETE'}),
    ask:{create:(id,questions)=>post('/ask/'+encodeURIComponent(id),{questions}),list:id=>api('/ask/'+encodeURIComponent(id))},
    async getFile(id) {return (await request('/files/'+encodeURIComponent(id))).blob();},
    responses:[],
    sendFeedback:data=>post('/feedback',data),
    saveCatalog:async catalog=>(await api('/catalog',{method:'PUT',json:{catalog}})).catalog,
    savePrices:async prices=>(await api('/settings',{method:'PUT',json:prices})).settings
  };
  async function loadResponses() {
    try {
      const list=await api('/responses');
      if(JSON.stringify(list)!==JSON.stringify(window.forjaPilot.responses)) {
        const grew=list.length>window.forjaPilot.responses.length && window.forjaPilot.loaded;
        window.forjaPilot.responses=list;
        if(typeof window.renderPilotResponses==='function')window.renderPilotResponses();
        if(grew && typeof window.toast==='function')window.toast('Chegou uma resposta da Forja.');
      }
      window.forjaPilot.loaded=true;
    } catch { /* tenta de novo no próximo ciclo */ }
  }
  window.forjaPilot.refreshResponses=loadResponses;
  let importing=false;
  async function loadRequests() {
    if(importing || typeof window.importPilotRequests!=='function')return;
    importing=true;
    try {
      const list=await api('/requests');
      if(list.length && await window.importPilotRequests(list) && await window.forjaPilot.flush())
        for(const r of list) await window.forjaPilot.markImported(r.id).catch(()=>{});
    } catch { /* tenta de novo no próximo ciclo */ }
    importing=false;
  }
  await loadResponses();
  setInterval(()=>{loadResponses();loadRequests();},15000);
  window.addEventListener('beforeunload',event=>{
    if(pending||failure){event.preventDefault();event.returnValue='';}
  });
  await loadScript('/pilot/workspace.js');
  await loadScript('/app.js');
  await loadScript('/interpret.js');
  loadRequests();
}
try {
  const me=await api('/me');
  if(invite)access('activate');
  else if(me.needsSetup && location.hash==='#configurar')access('setup');
  else if(!me.user)landing();
  else if(me.user.role==='admin'){await admin();setInterval(()=>refreshInbox(false).catch(()=>{}),20000);}
  else await workshop();
} catch(error) {
  root.innerHTML=`<main class="pilot-access"><section class="card card-pad"><h1>Não foi possível abrir a Forja</h1><p role="alert">${escape(error.message)}</p><a href="/">Tentar novamente</a></section></main>`;
}
