// Proteção de dados pessoais antes de enviar para o servidor.
// Tudo corre no browser: o texto, as imagens e os PDFs são limpos no aparelho da oficina.

const MAX_ZONES = 5;
const MAX_PDF_PAGES = 12;

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
  // Moradas: só quando o tipo de via vem com maiúscula e seguido de um nome próprio ("Rua das Flores, 12"), para não apanhar "portão para a rua".
  ['morada', /\b(?:Rua|Avenida|Av\.|Travessa|Tv\.|Largo|Praça|Estrada|Alameda|Calçada|Urbanização|Urb\.|Beco|Quinta)\s+(?:(?:d[aeo]s?)\s+)?[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n,;()]{1,60}(?:,\s*(?:n\.?\s*º\s*)?\d+[A-Za-z]?(?:\s*[-,]?\s*\d+\s*º?\s*(?:andar|esq\.?|dto\.?|frente|[A-Z]))?)?/g, '[morada]'],
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
    clean(p, 'workshopNotes');
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
  return { canvas, widthPt: base.width, heightPt: base.height, page, viewport };
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

// ---------- Deteção automática de dados pessoais nas folhas ----------
// Lê a folha no aparelho (texto do PDF ou OCR local), encontra dados pessoais e devolve retângulos para tapar.

const LABEL = /\b(nome(?:\s+do\s+cliente)?|cliente|requerente|dono\s+d[ae]\s+obra|morada|endere[cç]o|contactos?|telefone|telem[oó]vel|tlm|tlf|tel|e-?mail|nif|nipc|contribuinte|assinatura)\s*[.:]\s*/i;

// tokens: [{text, x, y, w, h}] de uma linha, em píxeis da página. Devolve os retângulos a tapar.
function detectLine(tokens, known) {
  let line = '', spans = [];
  for (const t of tokens) { const start = line.length ? line.length + 1 : 0; line += (line ? ' ' : '') + t.text; spans.push([start, start + t.text.length]); }
  const hits = [];
  for (const [, pattern] of RULES) { pattern.lastIndex = 0; for (const m of line.matchAll(pattern)) hits.push([m.index, m.index + m[0].length]); }
  for (const m of line.matchAll(/(?<!\d|\d[,.])\d{9}(?!\d|[,.]\d)/g)) if (validNif(m[0])) hits.push([m.index, m.index + 9]);
  for (const w of known) for (const m of line.matchAll(new RegExp(`(?<![\\p{L}])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\p{L}])`, 'giu'))) hits.push([m.index, m.index + m[0].length]);
  const label = line.match(LABEL);
  let labelOnly = false;
  if (label) {
    const from = label.index + label[0].length;
    if (line.slice(from).trim()) hits.push([from, line.length]); else labelOnly = true;
  }
  const boxes = [];
  for (const [a, b] of hits) {
    // Junta num só retângulo as partes dos tokens que caem dentro do que se encontrou (os itens dos PDFs podem ser frases inteiras).
    let u = null;
    tokens.forEach((t, k) => {
      const [s0, s1] = spans[k];
      if (s1 <= a || s0 >= b) return;
      const from = Math.max(0, a - s0) / t.text.length, to = Math.min(t.text.length, b - s0) / t.text.length;
      const r = { x: t.x + t.w * from, y: t.y, x2: t.x + t.w * to, y2: t.y + t.h };
      u = u ? { x: Math.min(u.x, r.x), y: Math.min(u.y, r.y), x2: Math.max(u.x2, r.x2), y2: Math.max(u.y2, r.y2) } : r;
    });
    if (u) boxes.push({ x: u.x, y: u.y, w: u.x2 - u.x, h: u.y2 - u.y });
  }
  // Retângulos sobrepostos (vários padrões no mesmo dado) contam como um.
  const merged = [];
  for (const bx of boxes.sort((p, q) => p.x - q.x)) {
    const m = merged.find(o => bx.x <= o.x + o.w + 2 && bx.y < o.y + o.h && bx.y + bx.h > o.y);
    if (m) { const x2 = Math.max(m.x + m.w, bx.x + bx.w), y2 = Math.max(m.y + m.h, bx.y + bx.h); m.y = Math.min(m.y, bx.y); m.w = x2 - m.x; m.h = y2 - m.y; } else merged.push({ ...bx });
  }
  return { boxes: merged, labelOnly };
}

function detectLines(lines, known) {
  const boxes = [];
  lines.forEach((tokens, i) => {
    const r = detectLine(tokens, known);
    boxes.push(...r.boxes);
    // "Nome:" sozinho numa linha: o valor costuma estar na linha de baixo.
    if (r.labelOnly && lines[i + 1]) for (const t of lines[i + 1]) boxes.push({ x: t.x, y: t.y, w: t.w, h: t.h });
  });
  return boxes;
}

// Linhas de um PDF com texto, em píxeis do canvas.
async function pdfLines(page, viewport) {
  const content = await page.getTextContent();
  const rows = [];
  for (const item of content.items) {
    if (!item.str?.trim() || !item.transform) continue;
    const [a, b, c, d, e, f] = viewport.transform;
    const pt = (x, y) => [a * x + c * y + e, b * x + d * y + f];
    const hgt = item.height || Math.hypot(item.transform[2], item.transform[3]) || 10;
    const [x0, y0] = pt(item.transform[4], item.transform[5] - hgt * 0.25), [x1, y1] = pt(item.transform[4] + (item.width || 0), item.transform[5] + hgt);
    const t = { text: item.str.trim(), x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
    let row = rows.find(r => Math.abs(r.y - t.y) < t.h * 0.5);
    if (!row) rows.push(row = { y: t.y, tokens: [] });
    row.tokens.push(t);
  }
  return rows.sort((a, b) => a.y - b.y).map(r => r.tokens.sort((a, b) => a.x - b.x));
}

let ocrWorker = null;
async function ocrLines(canvas) {
  if (!window.Tesseract) await new Promise((ok, fail) => { const sc = document.createElement('script'); sc.src = '/vendor/ocr/tesseract.min.js'; sc.onload = ok; sc.onerror = () => fail(new Error('OCR indisponível')); document.head.append(sc); });
  ocrWorker ||= await window.Tesseract.createWorker('por+eng', 1, { workerPath: '/vendor/ocr/worker.min.js', corePath: '/vendor/ocr/tesseract-core-lstm.wasm.js', langPath: '/vendor/ocr' });
  // O OCR corre numa cópia mais pequena (mais rápido); as caixas voltam à escala da página.
  const scale = Math.min(1, 2000 / Math.max(canvas.width, canvas.height));
  let src = canvas;
  if (scale < 1) { src = document.createElement('canvas'); src.width = Math.round(canvas.width * scale); src.height = Math.round(canvas.height * scale); src.getContext('2d').drawImage(canvas, 0, 0, src.width, src.height); }
  await ocrWorker.setParameters({ tessedit_pageseg_mode: '11' });
  const { data } = await ocrWorker.recognize(src, {}, { blocks: true });
  const lines = [];
  for (const block of data.blocks || []) for (const par of block.paragraphs || []) for (const line of par.lines || []) {
    const words = (line.words || []).filter(w => w.text?.trim() && w.confidence > 30).map(w => ({ text: w.text.trim(), x: w.bbox.x0 / scale, y: w.bbox.y0 / scale, w: (w.bbox.x1 - w.bbox.x0) / scale, h: (w.bbox.y1 - w.bbox.y0) / scale }));
    if (words.length) lines.push(words);
  }
  return lines;
}

function knownWords() {
  try {
    const name = String((typeof window.project === 'function' && window.project()?.client) || '').trim();
    const common = new Set(['cliente', 'exemplo', 'senhor', 'senhora', 'dona', 'eng', 'arq', 'obra', 'empresa', 'lda', 'unipessoal']);
    return name.split(/\s+/).filter(w => w.length >= 3 && /^\p{Lu}/u.test(w) && !common.has(w.toLowerCase()));
  } catch { return []; }
}

const pad = (b, W, H) => {
  const px = Math.max(3, b.h * 0.25), py = Math.max(2, b.h * 0.2);
  const x = Math.max(0, b.x - px), y = Math.max(0, b.y - py);
  return { x: x / W, y: y / H, w: Math.min(W - x, b.w + 2 * px) / W, h: Math.min(H - y, b.h + 2 * py) / H, auto: true };
};

// ---------- Preparar um ficheiro para enviar ----------
// Devolve as páginas com os retângulos propostos (zonas da oficina + deteção automática), para rever antes de enviar.
export async function prepareUpload(blob, zonesInput, onStatus = () => {}) {
  const zones = validZones(zonesInput).map(z => ({ ...z, zone: true }));
  const type = blob.type || '';
  const known = knownWords();
  if (/^image\/(jpeg|png|webp)$/.test(type)) {
    const canvas = await imageToCanvas(blob);
    onStatus('A procurar dados pessoais na imagem…');
    let lines = [];
    try { lines = await ocrLines(canvas); } catch { /* sem OCR: fica só com as zonas */ }
    const auto = detectLines(lines, known).map(b => pad(b, canvas.width, canvas.height));
    const wordCount = lines.reduce((n, l) => n + l.length, 0);
    return { kind: 'image', type: type === 'image/png' ? 'image/png' : 'image/jpeg', original: blob, pages: [{ canvas, boxes: [...zones, ...auto] }], auto: auto.length,
      // Só pede revisão quando há algo tapado ou a imagem parece uma folha com texto.
      review: zones.length > 0 || auto.length > 0 || wordCount >= 12 };
  }
  if (type === 'application/pdf') {
    const pdf = await openPdf(blob);
    if (pdf.numPages > MAX_PDF_PAGES) throw new Error(`Para proteger os dados, o PDF pode ter até ${MAX_PDF_PAGES} páginas.`);
    const pages = [];
    let auto = 0, words = 0;
    for (let n = 1; n <= pdf.numPages; n++) {
      onStatus(`A procurar dados pessoais na página ${n} de ${pdf.numPages}…`);
      const r = await renderPage(pdf, n, 1400);
      let lines = await pdfLines(r.page, r.viewport);
      if (lines.reduce((k, l) => k + l.length, 0) < 3) { try { lines = await ocrLines(r.canvas); } catch { lines = []; } }
      words += lines.reduce((k, l) => k + l.length, 0);
      const found = detectLines(lines, known).map(b => pad(b, r.canvas.width, r.canvas.height));
      auto += found.length;
      pages.push({ canvas: r.canvas, widthPt: r.widthPt, heightPt: r.heightPt, boxes: [...zones, ...found] });
    }
    return { kind: 'pdf', type, original: blob, pages, auto, review: zones.length > 0 || auto > 0 || words >= 12 };
  }
  return { kind: 'other', original: blob, pages: [], auto: 0, review: false };
}

// Quantos dados foram tapados, contados por linha da folha (uma morada partida em 3 palavras conta como 1).
function countLines(pages) {
  let n = 0;
  for (const p of pages) {
    const rows = [];
    for (const b of p.boxes.filter(b => b.auto)) { const c = b.y + b.h / 2; if (!rows.some(r => Math.abs(r - c) < b.h * 0.6)) rows.push(c); }
    n += rows.length;
  }
  return n;
}

function paintBoxes(ctx, W, H, boxes, preview) {
  for (const b of boxes) {
    ctx.fillStyle = '#000';
    ctx.fillRect(b.x * W, b.y * H, b.w * W, b.h * H);
    if (preview) { ctx.strokeStyle = b.auto ? '#c47835' : '#2f7d55'; ctx.lineWidth = Math.max(2, W / 400); ctx.strokeRect(b.x * W, b.y * H, b.w * W, b.h * H); }
  }
}

// Faz o ficheiro final: imagem sem metadados, ou PDF refeito em imagem (sem camada de texto) quando há algo tapado.
export async function finishUpload(result) {
  if (result.kind === 'image') {
    const src = result.pages[0].canvas, out = document.createElement('canvas');
    out.width = src.width; out.height = src.height;
    const ctx = out.getContext('2d'); ctx.drawImage(src, 0, 0); paintBoxes(ctx, out.width, out.height, result.pages[0].boxes, false);
    return canvasBlob(out, result.type, 0.9);
  }
  if (result.kind === 'pdf') {
    if (!result.pages.some(p => p.boxes.length)) return result.original;
    const pages = [];
    for (const p of result.pages) {
      const out = document.createElement('canvas'); out.width = p.canvas.width; out.height = p.canvas.height;
      const ctx = out.getContext('2d'); ctx.drawImage(p.canvas, 0, 0); paintBoxes(ctx, out.width, out.height, p.boxes, false);
      pages.push({ jpeg: new Uint8Array(await (await canvasBlob(out, 'image/jpeg', 0.85)).arrayBuffer()), width: out.width, height: out.height, widthPt: p.widthPt, heightPt: p.heightPt });
    }
    return imagesToPdf(pages);
  }
  return result.original;
}

// ---------- Janelas ----------

// Aviso pequeno enquanto a folha é lida (o OCR pode levar uns segundos, sobretudo na primeira vez).
export function busy(text) {
  const el = document.createElement('div');
  el.className = 'pv-busy'; el.setAttribute('role', 'status');
  el.textContent = text;
  document.body.append(el);
  return { set: t => { el.textContent = t; }, close: () => el.remove() };
}

function overlay(html) {
  const wrap = document.createElement('div');
  wrap.className = 'pv-overlay';
  wrap.setAttribute('role', 'dialog');
  wrap.setAttribute('aria-modal', 'true');
  wrap.innerHTML = `<div class="pv-box">${html}</div>`;
  document.body.append(wrap);
  return wrap;
}

// Revisão antes de enviar: retângulos laranja = encontrados automaticamente, verdes = zonas da oficina.
// Tocar num retângulo tira-o; arrastar tapa mais. Devolve o ficheiro final, ou null se cancelar.
export function reviewUpload(result, fileName) {
  if (!result.review) return finishUpload(result);
  return new Promise(resolve => {
    const total = result.pages.reduce((n, p) => n + p.boxes.length, 0);
    const box = overlay(`<h2>Antes de enviar: ${escapeHtml(fileName || 'ficheiro')}</h2>
      <p>${result.auto ? `A Forja encontrou e tapou dados pessoais em <b>${countLines(result.pages)}</b> linha(s) da folha (a laranja).` : 'A Forja não encontrou dados pessoais escritos de forma legível.'} Confirma que nome, morada, contactos e NIF do cliente estão tapados.</p>
      <p class="smalltext muted">Arrasta sobre a folha para tapar mais. Toca num retângulo para o retirar.</p>
      <div class="pv-previews"></div>
      <p class="pv-count" role="status"></p>
      <div class="pv-actions"><button type="button" class="primary" data-pv="ok">Está tapado, enviar</button><button type="button" data-pv="cancel">Cancelar</button></div>`);
    const holder = box.querySelector('.pv-previews'), count = box.querySelector('.pv-count');
    const shown = result.pages.slice(0, 10);
    const views = shown.map(page => {
      const c = document.createElement('canvas'); c.width = page.canvas.width; c.height = page.canvas.height; c.className = 'pv-canvas pv-draw'; c.style.touchAction = 'none';
      holder.append(c);
      const draw = drag => { const ctx = c.getContext('2d'); ctx.drawImage(page.canvas, 0, 0); paintBoxes(ctx, c.width, c.height, page.boxes, true); if (drag) { ctx.strokeStyle = '#2f7d55'; ctx.lineWidth = Math.max(2, c.width / 300); ctx.strokeRect(drag.x * c.width, drag.y * c.height, drag.w * c.width, drag.h * c.height); } };
      const point = e => { const r = c.getBoundingClientRect(); return { x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) }; };
      let drag = null;
      c.addEventListener('pointerdown', e => { c.setPointerCapture(e.pointerId); const p = point(e); drag = { sx: p.x, sy: p.y, x: p.x, y: p.y, w: 0, h: 0 }; });
      c.addEventListener('pointermove', e => { if (!drag) return; const p = point(e); drag.x = Math.min(drag.sx, p.x); drag.y = Math.min(drag.sy, p.y); drag.w = Math.abs(p.x - drag.sx); drag.h = Math.abs(p.y - drag.sy); draw(drag); });
      c.addEventListener('pointerup', () => {
        if (!drag) return;
        const d = drag; drag = null;
        if (d.w < 0.01 && d.h < 0.01) {
          // Toque: retira o retângulo por baixo do dedo.
          const k = page.boxes.findLastIndex(b => d.x >= b.x && d.x <= b.x + b.w && d.y >= b.y && d.y <= b.y + b.h);
          if (k >= 0) page.boxes.splice(k, 1);
        } else page.boxes.push({ x: d.x, y: d.y, w: d.w, h: d.h, manual: true });
        draw(); update();
      });
      draw();
      return draw;
    });
    const update = () => { const n = result.pages.reduce((k, p) => k + p.boxes.length, 0); count.textContent = `${n} retângulo(s) a tapar${result.pages.length > shown.length ? ` · só as primeiras ${shown.length} páginas aparecem aqui` : ''}.`; };
    update(); void total; void views;
    box.querySelector('[data-pv="ok"]').focus();
    box.addEventListener('click', async e => {
      const b = e.target.closest('[data-pv]');
      if (!b) return;
      if (b.dataset.pv === 'cancel') { box.remove(); resolve(null); return; }
      b.disabled = true; b.textContent = 'A preparar…';
      try { const out = await finishUpload(result); box.remove(); resolve(out); }
      catch (err) { b.disabled = false; b.textContent = 'Está tapado, enviar'; count.textContent = err.message; }
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
    <label class="pv-file">A tua folha de medidas (imagem ou PDF)<input type="file" accept="image/jpeg,image/png,image/webp,application/pdf"></label>
    <p class="smalltext muted">Não tens uma à mão? <button type="button" class="small" data-z="sample">Usar uma folha de exemplo</button> (dados inventados)</p>
    <div class="pv-stage" hidden><canvas class="pv-canvas pv-draw"></canvas></div>
    <p class="pv-count"></p>
    <p class="pv-msg" role="status"></p>
    <div class="pv-actions"><button type="button" class="primary" data-z="save">Guardar zonas</button><button type="button" data-z="test" hidden>Testar a proteção nesta folha</button><button type="button" data-z="clear">Limpar zonas</button><button type="button" data-z="close">Fechar</button></div>`);
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
  let sheet = null;
  const openSheet = async file => {
    msg.textContent = 'A abrir…';
    try {
      base = file.type === 'application/pdf' ? (await renderPage(await openPdf(file), 1, 1200)).canvas : await imageToCanvas(file, 1600);
      canvas.width = base.width; canvas.height = base.height; sheet = file;
      stage.hidden = false; box.querySelector('[data-z="test"]').hidden = false;
      msg.textContent = 'Arrasta para marcar uma zona. Depois carrega em "Testar a proteção" para ver o que é tapado ao enviar.'; draw();
    } catch { msg.textContent = 'Não foi possível abrir este ficheiro.'; }
  };
  box.querySelector('input[type=file]').addEventListener('change', e => { if (e.target.files[0]) openSheet(e.target.files[0]); });
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
    if (b.dataset.z === 'sample') {
      const blob = await (await fetch('/pilot/folha-exemplo.png')).blob();
      openSheet(new File([blob], 'folha-exemplo.png', { type: 'image/png' }));
      return;
    }
    if (b.dataset.z === 'test') {
      // Mostra o que seria tapado ao enviar esta folha (zonas + deteção automática). Não envia nada.
      if (!sheet) return;
      b.disabled = true;
      const status = busy('A procurar dados pessoais na folha…');
      let result;
      try { result = await prepareUpload(sheet, zones, t => status.set(t)); } catch (err) { msg.textContent = err.message; }
      status.close(); b.disabled = false;
      if (!result) return;
      box.style.display = 'none';
      result.review = true;
      await reviewUpload(result, sheet.name + ' (teste: nada é enviado)');
      box.style.display = '';
      msg.textContent = 'Teste feito: nada foi enviado. Se faltou tapar alguma coisa, marca uma zona por cima e guarda.';
      return;
    }
    b.disabled = true; msg.textContent = 'A guardar…';
    try { await save(zones); msg.textContent = 'Zonas guardadas. Vão ser tapadas em todos os ficheiros que enviares.'; }
    catch (err) { msg.textContent = err.message; }
    b.disabled = false;
  });
}
