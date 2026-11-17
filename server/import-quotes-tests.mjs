import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// Keeps this command usable even inside a project that declares type: commonjs.
const source = await readFile(new URL('../dist/pilot/import-quotes.js', import.meta.url), 'utf8');
const {parseQuoteText, toCatalog} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const item = (desc, qty, unit, unitPrice, total) => ({desc, qty, unit, unitPrice, total});
const examples = [
  {
    name:'exemplo 1 · milhares e IVA',
    text:'Orçamento n.º 001\nDescrição   Qtd.  Un.  Preço Unit.  Total\nPortão de correr 2 un 1.234,50 € 2.469,00 €\nSubtotal: 2.469,00 €\nIVA 23% 567,87 €\nTotal geral: 3.036,87 €\nPágina 1 de 1',
    lines:[item('Portão de correr', 2, 'un', 1234.5, 2469)]
  },
  {
    name:'exemplo 2 · descrição na linha anterior',
    text:'Orçamento: 002\nDescrição | Qtd | Un. | Preço Unit. | Total\nGuarda de escada\n2,50 m2 € 80,00 € 200,00\nAcabamento pintado 3 m² 12,50 37,50',
    lines:[item('Guarda de escada', 2.5, 'm²', 80, 200), item('Acabamento pintado', 3, 'm²', 12.5, 37.5)]
  },
  {
    name:'exemplo 3 · quebra depois da unidade',
    text:'Orçamento: 003\nPerfil em inox 3,5 ml\n12,00 € 42,00 €\nChapa galvanizada\t2\tkg\t5,00\t10,00\nDesconto 5%\nTotal: 49,40 €',
    lines:[item('Perfil em inox', 3.5, 'ml', 12, 42), item('Chapa galvanizada', 2, 'kg', 5, 10)]
  },
  {
    name:'exemplo 4 · cabeçalhos separados e unidades',
    text:'Orçamento: 004\nQtd\nUn.\nPreço Unit.\nTotal\nEnchimento 1 m3 130,00 130,00\nPerfil 2\nm 5,00 10,00\nMontagem 1,5 h 30,00 45,00\nProcessado por computador',
    lines:[item('Enchimento', 1, 'm³', 130, 130), item('Perfil', 2, 'm', 5, 10), item('Montagem', 1.5, 'h', 30, 45)]
  },
  {
    name:'exemplo 5 · linhas ambíguas e totais incoerentes',
    text:'Orçamento: 005\nPala em chapa 2 un 30,00 10,00\nFecho em vidro: preço a acordar\nFixação 2 un 4,00 8,00\nTotal: 8,00 €',
    lines:[item('Fixação', 2, 'un', 4, 8)],
    warnings:['Linha 2: Pala em chapa 2 un 30,00 10,00', 'Linha 3: Fecho em vidro: preço a acordar']
  }
];

let failures = 0;
function test(name, check) {
  try { check(); console.log('PASS ' + name); }
  catch (error) { failures++; console.error('FAIL ' + name + '\n' + error.message); }
}
for (const {name, text, lines, warnings = []} of examples) {
  test(name, () => assert.deepEqual(parseQuoteText(text), {lines, warnings}));
}
test('exemplo 6 · mediana, normalização, unidades e última data conhecida', () => {
  assert.deepEqual(toCatalog([
    {desc:' Perfil  térmico ', unit:'M2', unitPrice:30, lastSeen:'2026-03-02'},
    {desc:'PERFIL TERMICO', unit:'m²', unitPrice:20, lastSeen:'2026-04-04'},
    {desc:'perfil térmico', unit:'m²', unitPrice:99},
    {desc:'PERFIL TÉRMICO', unit:'m²', unitPrice:24, lastSeen:'2026-02-30'},
    {desc:'Perfil térmico', unit:'m', unitPrice:3}
  ]), [
    {label:'Perfil térmico', unit:'m²', price:27, count:4, lastSeen:'2026-04-04'},
    {label:'Perfil térmico', unit:'m', price:3, count:1, lastSeen:null}
  ]);
});
if (failures) process.exitCode = 1;
