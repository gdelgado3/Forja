// Proteção de dados pessoais antes de enviar para o servidor.
// Tudo corre no browser: o texto, as imagens e os PDFs são limpos no aparelho da oficina.

const MAX_ZONES = 5;
const MAX_PDF_PAGES = 20;

// ---------- Texto ----------

function validNif(digits) {
  if (!/^[1235689]\d{8}$/.test(digits)) return false;
  let sum = 0;
  for (let i = 0; i < 8; i++) sum += Number(digits[i]) * (9 - i);
  const check = 11 - (sum % 11);
  return (check >= 10 ? 0 : check) === Number(digits[8]);
}

const RULES = [
  ['email', /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g, '[email]'],
  ['iban', /\bPT\s?50(?:\s?\d){21}\b/gi, '[IBAN]'],
  ['nif', /\b(NIF|NIPC|N\.?\s?º?\s?(?:de\s)?contribuinte|contribuinte)(\s*[:.ºn°-]*\s*)\d{9}\b/gi, (m, label, sep) => `${label}${sep}[NIF]`],
  // Telemóvel (9x) em qualquer formato; fixo (2x) com +351, com rótulo, seguido ou em 2-3-4.
  // "200 300 400" sem rótulo fica: pode ser uma lista de medidas.
  ['telefone', /(?:(?:\+|00)351[\s.-]?[29](?:[\s.-]?\d){8}|(?<!\d|\d[,.])9[1236](?:[\s.-]?\d){7}|(?<!\d|\d[,.])2\d{8}|(?<!\d|\d[,.])2\d[\s.-]\d{3}[\s.-]\d{4})(?!\d|[,.]\d)/g, '[telefone]'],
  ['telefone', /\b(tel(?:efone|ef|em[oó]vel)?|contacto|ligue|ligar)(\.?\s*[:.]?\s*)2\d{2}[\s.-]?\d{3}[\s.-]?\d{3}(?!\d|[,.]\d)/gi, (m, label, sep) => `${label}${sep}[telefone]`],
  ['código postal', /\b\d{4}-\d{3}\b/g, '[código postal]'],
];

export function redactText(input) {
  if (typeof input !== 'string' || !input) return { text: input, found: [] };
  let text = input;
  const found = [];
  for (const [name, pattern, replacement] of RULES) {
    text = text.replace(pattern, (...args) => {
      found.push(name);
      return typeof replacement === 'function' ? replacement(...args) : replacement;
    });
  }
  // NIF sem rótulo: só 9 algarismos com o dígito de controlo certo.
  text = text.replace(/(?<!\d|\d[,.])\d{9}(?!\d|[,.]\d)/g, m => {
    if (!validNif(m)) return m;
    found.push('nif');
    return '[NIF]';
  });
  return { text, found };
}

export function containsPersonalData(text) {
  return redactText(text).found.length > 0;
}

// Limpa os campos de texto de um estado da oficina, no próprio objeto. Devolve o que foi tapado.
export function redactState(state) {
  const found = [];
  const clean = (obj, key) => {
    if (!obj || typeof obj[key] !== 'string') return;
    const r = redactText(obj[key]);
    if (r.found.length) { obj[key] = r.text; found.push(...r.found); }
  };
  for (const p of state.projects || []) {
    clean(p, 'request');
    clean(p, 'checkNote');
    for (const x of p.extraFields || []) clean(x, 'value');
    for (const m of p.memory || []) clean(m, 'text');
  }
  return found;
}

// ---------- Zonas ----------

export function validZones(zones) {
  if (!Array.isArray(zones)) return [];
  return zones.slice(0, MAX_ZONES).map(z => ({
    x: Math.min(1, Math.max(0, Number(z.x))), y: Math.min(1, Math.max(0, Number(z.y))),
    w: Math.min(1, Math.max(0, Number(z.w))), h: Math.min(1, Math.max(0, Number(z.h))),
  })).filter(z => [z.x, z.y, z.w, z.h].every(Number.isFinite) && z.w > 0.005 && z.h > 0.005);
}

function paintZones(ctx, width, height, zones) {
  ctx.fillStyle = '#000';
  for (const z of zones) ctx.fillRect(Math.floor(z.x * width), Math.floor(z.y * height), Math.ceil(z.w * width), Math.ceil(z.h * height));
}

function canvasBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error('Não foi possível preparar a imagem.')), type, quality));
}

// ---------- Imagens ----------

async function imageToCanvas(blob, maxSide = 3000) {
  const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' });
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close?.();
  return canvas;
}

// ---------- PDF ----------

let pdfjsPromise;
function pdfjs() {
  pdfjsPromise ||= import('../vendor/pdf/pdf.min.mjs').then(lib => {
    lib.GlobalWorkerOptions.workerSrc = '/vendor/pdf/pdf.worker.min.mjs';
    return lib;
  });
  return pdfjsPromise;
}

async function openPdf(blob) {
  const lib = await pdfjs();
  return lib.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), isEvalSupported: false }).promise;
}

async function renderPage(pdf, number, targetWidth = 1600) {
  const page = await pdf.getPage(number);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: targetWidth / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return { canvas, widthPt: base.width, heightPt: base.height };
}

export async function pdfText(blob, maxPages = 5) {
  const pdf = await openPdf(blob);
  let text = '';
  for (let n = 1; n <= Math.min(pdf.numPages, maxPages); n++) {
    const content = await (await pdf.getPage(n)).getTextContent();
    // Junta por linha (mesma altura na página), da esquerda para a direita.
    const rows = [];
    for (const item of content.items) {
      if (!item.str || !item.transform) continue;
      const y = item.transform[5], x = item.transform[4];
      let row = rows.find(r => Math.abs(r.y - y) < Math.max(2, (item.height || 10) * 0.4));
      if (!row) rows.push(row = { y, parts: [] });
      row.parts.push({ x, str: item.str });
    }
    rows.sort((a, b) => b.y - a.y);
    text += rows.map(r => r.parts.sort((a, b) => a.x - b.x).map(p => p.str).join(' ').replace(/\s+/g, ' ').trim()).join('\n') + '\n';
  }
  return text;
}

// PDF mínimo com uma imagem JPEG por página. Não leva camada de texto: o que foi tapado desaparece mesmo.
async function imagesToPdf(pages) {
  const enc = new TextEncoder();
  const parts = [];
  const offsets = [];
  let length = 0;
  const push = chunk => { const bytes = typeof chunk === 'string' ? enc.encode(chunk) : chunk; parts.push(bytes); length += bytes.length; };
  const object = (id, body) => { offsets[id] = length; push(`${id} 0 obj\n`); body(); push('\nendobj\n'); };
  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  const kids = pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ');
  object(1, () => push('<< /Type /Catalog /Pages 2 0 R >>'));
  object(2, () => push(`<< /Type /Pages /Kids [${kids}] /Count ${pages.length} >>`));
  for (let i = 0; i < pages.length; i++) {
    const { jpeg, width, height, widthPt, heightPt } = pages[i];
    const pageId = 3 + i * 3, contentId = pageId + 1, imageId = pageId + 2;
    const draw = `q ${widthPt.toFixed(2)} 0 0 ${heightPt.toFixed(2)} 0 0 cm /Im0 Do Q`;
    object(pageId, () => push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${widthPt.toFixed(2)} ${heightPt.toFixed(2)}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`));
    object(contentId, () => { push(`<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`); });
    object(imageId, () => {
      push(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
      push(jpeg);
      push('\nendstream');
    });
  }
  const count = 3 + pages.length * 3;
  const xref = length;
  push(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let id = 1; id < count; id++) push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  push(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(parts, { type: 'application/pdf' });
}

// ---------- Preparar um ficheiro para enviar ----------
// Devolve {blob, previews:[canvas], note}. previews vazio = nada a mostrar antes de enviar.

export async function prepareUpload(blob, zonesInput) {
  const zones = validZones(zonesInput);
  const type = blob.type || '';
  if (/^image\/(jpeg|png|webp)$/.test(type)) {
    const canvas = await imageToCanvas(blob);
    if (zones.length) paintZones(canvas.getContext('2d'), canvas.width, canvas.height, zones);
    const out = await canvasBlob(canvas, type === 'image/png' ? 'image/png' : 'image/jpeg', 0.9);
    // Sem zonas, só tirámos os metadados (EXIF/GPS): não há nada novo para mostrar.
    return { blob: out, previews: zones.length ? [canvas] : [], note: zones.length ? 'A zona dos dados do cliente foi tapada.' : '' };
  }
  if (type === 'application/pdf') {
    if (!zones.length) {
      let risky = false;
      try { risky = containsPersonalData(await pdfText(blob)); } catch { /* PDF sem texto legível */ }
      return { blob, previews: [], note: '', warning: risky ? 'Este PDF tem contactos ou um NIF no texto. Marca a zona dos dados do cliente em "Proteger dados dos clientes" para os tapar antes de enviar.' : '' };
    }
    const pdf = await openPdf(blob);
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`Para tapar dados, o PDF pode ter até ${MAX_PDF_PAGES} páginas.`);
    const pages = [], previews = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const { canvas, widthPt, heightPt } = await renderPage(pdf, n);
      paintZones(canvas.getContext('2d'), canvas.width, canvas.height, zones);
      const jpeg = new Uint8Array(await (await canvasBlob(canvas, 'image/jpeg', 0.85)).arrayBuffer());
      pages.push({ jpeg, width: canvas.width, height: canvas.height, widthPt, heightPt });
      if (n === 1) previews.push(canvas);
    }
    return { blob: await imagesToPdf(pages), previews, note: `A zona dos dados do cliente foi tapada em ${pdf.numPages} página(s). O texto escondido por baixo também foi removido.` };
  }
  return { blob, previews: [], note: '' };
}

// ---------- Janelas ----------

function overlay(html) {
  const wrap = document.createElement('div');
  wrap.className = 'pv-overlay';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="pv-box">${html}</div>`;
  document.body.append(wrap);
  return wrap;
}

export function confirmPreview(result, fileName) {
  if (!result.previews.length && !result.warning) return Promise.resolve(true);
  return new Promise(resolve => {
    const box = overlay(`<h2>Antes de enviar: ${escapeHtml(fileName || 'ficheiro')}</h2>
      ${result.warning ? `<p class="pv-warn">${escapeHtml(result.warning)}</p>` : `<p>${escapeHtml(result.note)} Confirma que os dados do cliente estão tapados.</p>`}
      <div class="pv-previews"></div>
      <div class="pv-actions"><button type="button" class="primary" data-pv="ok">${result.warning ? 'Enviar assim' : 'Está tapado, enviar'}</button><button type="button" data-pv="cancel">Cancelar</button></div>`);
    for (const c of result.previews) { c.className = 'pv-canvas'; box.querySelector('.pv-previews').append(c); }
    box.querySelector('[data-pv="ok"]').focus();
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-pv]');
      if (!b) return;
      box.remove();
      resolve(b.dataset.pv === 'ok');
    });
  });
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Editor: a oficina abre uma folha sua e arrasta retângulos por cima dos dados do cliente.
export function editZones(current, save) {
  let zones = validZones(current);
  const box = overlay(`<h2>Proteger dados dos clientes</h2>
    <p>Abre uma folha de medidas ou um pedido típico e arrasta um retângulo por cima de cada zona com dados do cliente (nome, morada, contactos, NIF). A Forja tapa essas zonas em todas as imagens e PDFs, no teu aparelho, antes de enviar.</p>
    <label class="pv-file">Folha de exemplo (imagem ou PDF)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
    <div class="pv-stage" hidden><canvas class="pv-canvas pv-draw"></canvas></div>
    <p class="pv-count"></p>
    <p class="pv-msg" role="status"></p>
    <div class="pv-actions"><button type="button" class="primary" data-z="save">Guardar zonas</button><button type="button" data-z="clear">Limpar zonas</button><button type="button" data-z="close">Fechar</button></div>`);
  const canvas = box.querySelector('.pv-draw'), stage = box.querySelector('.pv-stage');
  const count = box.querySelector('.pv-count'), msg = box.querySelector('.pv-msg');
  let base = null, drag = null;
  const draw = () => {
    if (!base) return;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(base, 0, 0);
    ctx.fillStyle = 'rgba(0,0,0,.75)';
    for (const z of zones) ctx.fillRect(z.x * canvas.width, z.y * canvas.height, z.w * canvas.width, z.h * canvas.height);
    if (drag) { ctx.strokeStyle = '#c47835'; ctx.lineWidth = Math.max(2, canvas.width / 300); ctx.strokeRect(drag.x * canvas.width, drag.y * canvas.height, drag.w * canvas.width, drag.h * canvas.height); }
  };
  const updateCount = () => { count.textContent = zones.length ? `${zones.length} zona(s) marcada(s), de ${MAX_ZONES} possíveis.` : 'Ainda não há zonas marcadas.'; };
  updateCount();
  const point = e => { const r = canvas.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
  box.querySelector('input[type=file]').addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    msg.textContent = 'A abrir…';
    try {
      base = file.type === 'application/pdf' ? (await renderPage(await openPdf(file), 1, 1200)).canvas : await imageToCanvas(file, 1600);
      canvas.width = base.width; canvas.height = base.height;
      stage.hidden = false; msg.textContent = 'Arrasta para marcar uma zona.'; draw();
    } catch { msg.textContent = 'Não foi possível abrir este ficheiro.'; }
  });
  canvas.addEventListener('pointerdown', e => {
    if (zones.length >= MAX_ZONES) { msg.textContent = `Podes marcar até ${MAX_ZONES} zonas.`; return; }
    canvas.setPointerCapture(e.pointerId);
    const p = point(e); drag = { sx: p.x, sy: p.y, x: p.x, y: p.y, w: 0, h: 0 };
  });
  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    const p = point(e);
    drag.x = Math.min(drag.sx, p.x); drag.y = Math.min(drag.sy, p.y);
    drag.w = Math.abs(p.x - drag.sx); drag.h = Math.abs(p.y - drag.sy);
    draw();
  });
  canvas.addEventListener('pointerup', () => {
    if (!drag) return;
    const z = validZones([drag]);
    drag = null;
    if (z.length) zones.push(z[0]);
    updateCount(); draw();
  });
  canvas.style.touchAction = 'none';
  box.addEventListener('click', async e => {
    const b = e.target.closest('[data-z]');
    if (!b) return;
    if (b.dataset.z === 'close') { box.remove(); return; }
    if (b.dataset.z === 'clear') { zones = []; updateCount(); draw(); return; }
    b.disabled = true; msg.textContent = 'A guardar…';
    try { await save(zones); msg.textContent = 'Zonas guardadas. Vão ser tapadas em todos os ficheiros que enviares.'; }
    catch (err) { msg.textContent = err.message; }
    b.disabled = false;
  });
}
