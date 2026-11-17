// Leitor mínimo de Excel (.xlsx) no browser, sem bibliotecas: abre o zip, lê a primeira folha e devolve as linhas.
// Usa o DecompressionStream do próprio browser para descomprimir.

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

async function unzip(buffer) {
  const view = new DataView(buffer), bytes = new Uint8Array(buffer);
  // Fim do diretório central: assinatura 0x06054b50, procurada de trás para a frente.
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 70000); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  if (end < 0) throw new Error('Este ficheiro não parece um Excel (.xlsx).');
  const count = view.getUint16(end + 10, true);
  let ptr = view.getUint32(end + 16, true);
  const files = new Map(), dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (view.getUint32(ptr, true) !== 0x02014b50) break;
    const method = view.getUint16(ptr + 10, true), size = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true), extraLen = view.getUint16(ptr + 30, true), commentLen = view.getUint16(ptr + 32, true);
    const local = view.getUint32(ptr + 42, true);
    const name = dec.decode(bytes.subarray(ptr + 46, ptr + 46 + nameLen));
    files.set(name, { method, size, local });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return async name => {
    const f = files.get(name);
    if (!f) return null;
    const start = f.local + 30 + view.getUint16(f.local + 26, true) + view.getUint16(f.local + 28, true);
    const raw = bytes.subarray(start, start + f.size);
    const out = f.method === 0 ? raw : f.method === 8 ? await inflateRaw(raw) : null;
    if (!out) throw new Error('Formato de compressão do Excel não suportado.');
    return dec.decode(out);
  };
}

const colIndex = ref => { let n = 0; for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };

// Datas do Excel são números de dias desde 1899-12-30.
export const excelDate = n => new Date(Math.round((n - 25569) * 86400000)).toISOString().slice(0, 10);

export async function readXlsx(file) {
  if (typeof DecompressionStream === 'undefined') throw new Error('Este browser não abre Excel. Guarda a folha como CSV e importa esse ficheiro.');
  const read = await unzip(await file.arrayBuffer());
  const parse = xml => new DOMParser().parseFromString(xml, 'application/xml');
  const shared = [];
  const sst = await read('xl/sharedStrings.xml');
  if (sst) for (const si of parse(sst).getElementsByTagName('si')) shared.push([...si.getElementsByTagName('t')].map(t => t.textContent).join(''));
  // Primeira folha pela ordem do livro.
  let sheetPath = 'xl/worksheets/sheet1.xml';
  const wb = await read('xl/workbook.xml'), rels = await read('xl/_rels/workbook.xml.rels');
  if (wb && rels) {
    const first = parse(wb).getElementsByTagName('sheet')[0];
    const rid = first?.getAttribute('r:id') || first?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
    const target = [...parse(rels).getElementsByTagName('Relationship')].find(r => r.getAttribute('Id') === rid)?.getAttribute('Target');
    if (target) sheetPath = target.startsWith('/') ? target.slice(1) : 'xl/' + target.replace(/^\.\//, '');
  }
  const sheet = await read(sheetPath);
  if (!sheet) throw new Error('Não encontrei nenhuma folha neste Excel.');
  // Estilos de data: números com formato de data passam a AAAA-MM-DD.
  const dateStyles = new Set();
  const styles = await read('xl/styles.xml');
  if (styles) {
    const doc = parse(styles), custom = new Map([...doc.getElementsByTagName('numFmt')].map(f => [f.getAttribute('numFmtId'), f.getAttribute('formatCode') || '']));
    const xfs = doc.getElementsByTagName('cellXfs')[0]?.getElementsByTagName('xf') || [];
    [...xfs].forEach((xf, i) => {
      const id = xf.getAttribute('numFmtId');
      if ((+id >= 14 && +id <= 22) || /[dy]{1,4}.*[my]|[my].*[dy]/i.test((custom.get(id) || '').replace(/\[[^\]]*\]|"[^"]*"/g, ''))) dateStyles.add(String(i));
    });
  }
  const rows = [];
  for (const row of parse(sheet).getElementsByTagName('row')) {
    const cells = [];
    for (const c of row.getElementsByTagName('c')) {
      const t = c.getAttribute('t'), v = c.getElementsByTagName('v')[0]?.textContent;
      let value = '';
      if (t === 's') value = shared[+v] ?? '';
      else if (t === 'inlineStr') value = [...c.getElementsByTagName('t')].map(x => x.textContent).join('');
      else if (t === 'b') value = v === '1' ? 'VERDADEIRO' : 'FALSO';
      else if (v != null) value = dateStyles.has(c.getAttribute('s')) && Number.isFinite(+v) ? excelDate(+v) : Number(v);
      cells[colIndex(c.getAttribute('r') || 'A1')] = value;
      if (rows.length > 5000) break;
    }
    if (cells.some(x => x !== '' && x != null)) rows.push(Array.from(cells, x => x ?? ''));
  }
  return rows;
}

// ---------- Tabela de fornecedor → catálogo ----------
const UNIT_WORDS = [[/€?\s*\/?\s*(kg|quilo)/i, 'kg'], [/€?\s*\/?\s*(m2|m²)/i, 'm²'], [/€?\s*\/?\s*(m3|m³)/i, 'm³'], [/€?\s*\/?\s*(ml|metro|m\b)/i, 'm'], [/€?\s*\/?\s*(barra|vara)/i, 'barra'], [/€?\s*\/?\s*(un|unid|pe[cç]a|pç)/i, 'un'], [/€?\s*\/?\s*(h|hora)/i, 'h']];
const unitOf = v => { const s = String(v || '').trim().toLowerCase(); if (!s) return ''; for (const [re, u] of UNIT_WORDS) if (re.test(s)) return u; return ''; };
const num = v => typeof v === 'number' ? v : Number(String(v).replace(/[€\s]/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
const toDate = v => {
  if (typeof v === 'number' && v > 20000 && v < 80000) return excelDate(v);
  const s = String(v || '').trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/); if (m) return `${m[3].length === 2 ? '20' + m[3] : m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return '';
};
// Comprimento da barra no nome ("barra 6 m", "6000 mm", "6mts").
const barLength = name => { const m = String(name).match(/(\d+(?:[.,]\d+)?)\s*(mts?|m|mm)\b/i); if (!m) return 0; const v = num(m[1]); return /mm/i.test(m[2]) ? v / 1000 : v; };

// Devolve {items:[{label,unit,price,date,supplier}], notes:[]} a partir das linhas da folha.
export function supplierCatalog(rows, fallbackDate = '') {
  const notes = [];
  const headerAt = rows.slice(0, 15).findIndex(r => r.some(c => /descri|artigo|perfil|produto|designa|material/i.test(String(c))) && r.some(c => /pre[cç]o|custo|valor|€/i.test(String(c))));
  const header = headerAt >= 0 ? rows[headerAt].map(c => String(c).toLowerCase()) : [];
  const body = rows.slice(headerAt + 1);
  const find = re => header.findIndex(h => re.test(h));
  let name = find(/descri|artigo|perfil|produto|designa|material/), price = find(/pre[cç]o|custo|valor|€/), unit = find(/^un|unid|medida de venda/), date = find(/data|validade|cota[cç]/), supplier = find(/fornecedor|marca/);
  if (name < 0) name = 0;
  if (price < 0) { const counts = (body[0] || []).map((_, i) => body.filter(r => Number.isFinite(num(r[i])) && r[i] !== '').length); price = counts.lastIndexOf(Math.max(...counts, 0)); }
  if (headerAt < 0) notes.push('Não encontrei cabeçalhos: usei a 1.ª coluna como nome e a última coluna com números como preço.');
  const priceUnit = header[price] ? unitOf(header[price].split(/€|\//).slice(1).join('/')) : '';
  const items = [];
  let converted = 0, unknown = 0;
  for (const r of body) {
    const label = String(r[name] ?? '').trim(), p = num(r[price]);
    if (!label || !Number.isFinite(p) || p <= 0) continue;
    let u = unitOf(unit >= 0 ? r[unit] : '') || priceUnit || '';
    let value = p, l = label;
    if (u === 'barra') {
      const len = barLength(label);
      if (len > 0) { value = p / len; u = 'm'; converted++; l = label + ' (de barra de ' + String(len).replace('.', ',') + ' m)'; }
      else { u = 'un'; l = label + ' (barra)'; }
    }
    if (!u) { u = 'un'; unknown++; }
    items.push({ label: l.slice(0, 180), unit: u, price: Math.round(value * 10000) / 10000, date: toDate(date >= 0 ? r[date] : '') || fallbackDate, supplier: supplier >= 0 ? String(r[supplier] || '').slice(0, 80) : '' });
  }
  if (converted) notes.push(`${converted} preço(s) por barra convertidos para preço por metro.`);
  if (unknown) notes.push(`${unknown} artigo(s) sem unidade: ficaram em "un". Confirma antes de guardar.`);
  return { items, notes };
}
