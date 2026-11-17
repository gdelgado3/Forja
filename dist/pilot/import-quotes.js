const units = new Map([
  ['un', 'un'], ['m', 'm'], ['ml', 'ml'], ['m2', 'm²'], ['m²', 'm²'],
  ['m3', 'm³'], ['m³', 'm³'], ['kg', 'kg'], ['h', 'h']
]);

const number = String.raw`(?:\d{1,3}(?:\.\d{3})+|\d+)(?:,\d+)?`;
const money = String.raw`(?:€\s*)?(${number})(?:\s*€)?`;
const columns = String.raw`(${number})\s+(un\.?|ml|m[²³23]?|kg|h)\s+${money}\s+${money}`;
const row = new RegExp(String.raw`^(.+?)\s+${columns}$`, 'i');
const amountsOnly = new RegExp(String.raw`^${columns}$`, 'i');
const incompleteRow = new RegExp(String.raw`(?:^|\s)${number}\s+(?:un\.?|ml|m[²³23]?|kg|h)(?=\s|$)`, 'i');
const unitContinuation = new RegExp(String.raw`^(?:un\.?|ml|m[²³23]?|kg|h)\s+${money}\s+${money}$`, 'i');
const fold = text => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
const decimal = text => Number(text.replace(/\./g, '').replace(',', '.'));
const toCents = value => Math.round((value + Number.EPSILON) * 100);
const normalizeUnit = unit => units.get(String(unit ?? '').toLowerCase().trim().replace(/\.$/, ''));

function isBoilerplate(line) {
  const plain = fold(line);
  return /^(?:sub[ -]?total|total|desconto|iva|imposto|valor tributavel|a pagar)\b(?=\s*[:€(\d-]|\s*$|\s+(?:geral|liquido|il[ií]quido|a pagar|com iva|sem iva|de iva|do documento|da proposta|com desconto)\b)/.test(plain)
    || /^(?:pag(?:ina)?\.?\s*\d+(?:\s*(?:\/|de)\s*\d+)?|\d+\s*\/\s*\d+)$/i.test(plain)
    || /^(?:nif|n\.?\s*contribuinte|capital social|iban|telefone|email|e-mail|morada|cliente|data|validade|condicoes de pagamento)\b\s*[:#-]/.test(plain)
    || /^(?:documento processado|processado por computador|obrigad[oa]\b)/.test(plain)
    || /^orcamento\s*(?:$|n[.º°o]*\s*[:#-]?\s*\d|[:#-]|\d)/.test(plain);
}

function isColumnHeading(line) {
  const tokens = new Set([
    'artigo', 'artigos', 'descricao', 'designacao', 'referencia', 'ref', 'codigo', 'qtd', 'qt',
    'quantidade', 'un', 'und', 'unidade', 'preco', 'p', 'unit', 'unitario', 'total', 'valor', 'eur', '€'
  ]);
  const parts = fold(line).replace(/[.():]/g, ' ').split(/\s+/).filter(Boolean);
  return parts.length > 0 && parts.every(part => tokens.has(part));
}

export function parseQuoteText(text) {
  if (typeof text !== 'string') throw new TypeError('O orçamento deve ser fornecido como texto.');
  const lines = [];
  const warnings = [];
  let pending = null;

  function warn(entry) {
    warnings.push('Linha ' + entry.number + ': ' + entry.text);
  }

  for (const [index, raw] of text.split(/\r\n?|\n/).entries()) {
    const value = raw.replace(/[|\t]/g, ' ').replace(/\s+/g, ' ').trim();
    if (!value) continue;
    if (isBoilerplate(value) || isColumnHeading(value)) {
      if (pending) warn(pending);
      pending = null;
      continue;
    }
    const full = value.match(row);
    // A complete row starts an independent article. A numeric continuation
    // or a row with an incomplete numeric suffix can follow one description.
    let entry = {text:value, number:index + 1};
    let match = full;
    if (pending) {
      const combined = pending.text + ' ' + value;
      const isolatedAmounts = amountsOnly.test(value);
      const extendsNumericSuffix = incompleteRow.test(pending.text);
      if (isolatedAmounts || (!full && (extendsNumericSuffix || unitContinuation.test(value)))) {
        entry = {text:combined, number:pending.number};
        match = combined.match(row);
      } else {
        warn(pending);
      }
      pending = null;
    }
    if (!match) {
      if (entry.number !== index + 1 || amountsOnly.test(value)) warn(entry);
      else pending = entry;
      continue;
    }
    const [, desc, quantity, rawUnit, price, amount] = match;
    const qty = decimal(quantity);
    const unitPrice = decimal(price);
    const total = decimal(amount);
    if (!(qty > 0) || !Number.isSafeInteger(toCents(qty * unitPrice)) ||
        !Number.isSafeInteger(toCents(total)) || Math.abs(toCents(qty * unitPrice) - toCents(total)) > 1) {
      warn(entry);
      continue;
    }
    lines.push({desc, qty, unit:normalizeUnit(rawUnit), unitPrice, total});
  }
  if (pending) warn(pending);
  return {lines, warnings};
}

function seenDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

export function toCatalog(arrayDeLines) {
  const groups = new Map();
  for (const line of arrayDeLines) {
    const label = typeof line?.desc === 'string' ? line.desc.trim().replace(/\s+/g, ' ') : '';
    const unit = normalizeUnit(line?.unit);
    const price = line?.unitPrice;
    if (!label || !unit || !Number.isFinite(price) || price < 0) continue;
    const key = JSON.stringify([fold(label), unit]);
    const lastSeen = seenDate(line.lastSeen);
    if (!groups.has(key)) groups.set(key, {label, unit, prices:[], lastSeen:null});
    const group = groups.get(key);
    group.prices.push(price);
    if (lastSeen && (!group.lastSeen || lastSeen > group.lastSeen)) group.lastSeen = lastSeen;
  }
  return [...groups.values()].map(({label, unit, prices, lastSeen}) => {
    prices.sort((a, b) => a - b);
    const count = prices.length;
    const middle = Math.floor(count / 2);
    const price = count % 2 ? prices[middle] : prices[middle - 1] / 2 + prices[middle] / 2;
    return {label, unit, price, count, lastSeen};
  });
}
