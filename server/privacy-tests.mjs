import assert from 'node:assert/strict';
import { redactText, redactState, validZones } from '../dist/pilot/privacy.mjs';

const cases=[
  ['Ligue para 912 345 678 depois das 18h','Ligue para [telefone] depois das 18h'],
  ['Tel: +351 21 345 6789','Tel: [telefone]'],
  ['email: ana.silva+obra@gmail.com','email: [email]'],
  ['NIF: 123456789','NIF: [NIF]'],
  ['contribuinte 501964843','contribuinte [NIF]'],
  ['Rua X, 2710-123 Sintra','Rua X, [código postal] Sintra'],
  ['IBAN PT50 0002 0123 1234 5678 9015 4','IBAN [IBAN]'],
  ['contribuinte n.º 999999990 obrigado','contribuinte n.º [NIF] obrigado'],
  ['Pago com 501964843 sem rótulo','Pago com [NIF] sem rótulo'],
  ['telefone 219 123 456','telefone [telefone]'],
  ['ligar 0035191 234 5678','ligar [telefone]'],
  ['fixo 21 345 6789.','fixo [telefone].'],
];
for(const [input,expected] of cases) assert.equal(redactText(input).text,expected,input);
// Medidas, quantidades e preços ficam intactos.
const keep=['Portão de 3200 x 1800 mm','Tubo 40x40x2, 12 barras de 6 m','Total 1.234,56 €','Área 1,04 m²','Ref. 123456780 (artigo)','Ano 2026, 2 portões','Chapa 2 mm, 250 kg','Vãos de 200 300 400 mm','3 portões de 2 345 mm'];
for(const t of keep) assert.equal(redactText(t).text,t,t);
const state={projects:[{request:'Sou o Rui, 934 111 222',checkNote:'',extraFields:[{label:'Contacto',value:'rui@x.pt'}],memory:[{text:'Morada 2710-001'}],client:'Rui Exemplo',contact:'934 111 222'}]};
const found=redactState(state);
assert.deepEqual(found.sort(),['código postal','email','telefone']);
assert.equal(state.projects[0].request,'Sou o Rui, [telefone]');
assert.equal(state.projects[0].contact,'934 111 222','o campo de contacto do cliente fica');
assert.deepEqual(validZones([{x:.1,y:.1,w:.2,h:.2},{x:0,y:0,w:0,h:.5},{x:'a'}]),[{x:.1,y:.1,w:.2,h:.2}]);
assert.equal(validZones(Array(9).fill({x:0,y:0,w:.1,h:.1})).length,5);
console.log('PASS: texto tapado (telefone, email, NIF, código postal, IBAN) sem estragar medidas e preços.');
