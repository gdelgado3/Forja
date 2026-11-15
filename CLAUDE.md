# Forja — contexto para colaboração

MVP de orçamentação para serralharia em português. O objetivo imediato é interpretar imagens/PDF/CAD/BIM e ligar dados revistos ao orçamento e à memória de projeto. Geração de desenho técnico é uma fase posterior.

## Executar

Servir `dist/` na raiz HTTP: `python3 -m http.server 8000 --directory dist` e abrir http://localhost:8000. Não abrir o HTML diretamente com file://.

Para desenvolvimento: `npm ci`. Os leitores já estão incluídos em `dist/vendor/`. Após alterar dependências, executar `node scripts/vendor.mjs`.

## Ficheiros principais

- `dist/app.js`: projetos, custos, versões, memória e persistência local.
- `dist/interpret.js`: upload, OCR, PDF e interface de revisão.
- `dist/readers.mjs`: leitura DXF e IFC, unidades e extração de cotas.
- `dist/reader-worker.mjs`: executa DXF/IFC sem bloquear a interface.
- `dist/style.css`: interface responsiva.

## Regras do produto

Não inventar medidas a partir de fotos. Preservar a fonte de cada resultado. Exigir revisão antes de aplicar. Não alterar versões guardadas. Distinguir acréscimo sobre custo de margem sobre venda. Dados iniciais e ficheiros de exemplo são fictícios.

Imagens: OCR local português/inglês. PDF: texto ou OCR, até cinco páginas. DXF ASCII: linhas, arcos, círculos, polilinhas suportadas; unidades do cabeçalho ou confirmadas pelo utilizador. IFC: elementos, materiais associados e quantidades declaradas; não calcula geometria 3D. DWG/RVT exigem exportação. Há limites explícitos na interface.

## Estado

Não existe ainda chamada à API de visão nem chave configurada. A integração exige backend e secret no servidor. Não colocar chaves no JavaScript público. Os dados dos projetos estão em localStorage/IndexedDB e podem ser exportados/importados.

## Validar

`node --check dist/app.js`
`node --check dist/interpret.js`
`node reader-tests.mjs`
`node tests.mjs`

Testados: cálculos em cêntimos, independência de snapshots, extração de cotas, DXF e IFC sintéticos e OCR da imagem de teste. QA no navegador confirmou DXF e aplicação de uma área ao orçamento/memória. PDF e IFC no navegador ainda precisam de validação completa.

## Entregar alterações

Editar estes ficheiros e devolver o projeto ou um patch. Este pacote não contém credenciais nem permissões para publicar no alojamento original. As alterações devem ser testadas e depois integradas pelo responsável do site.


Atualização: ler README.md. Backend local em server/local.mjs e server/vision.mjs; teste server/vision-tests.mjs. Visão IA opcional para imagens e texto associado, revisão obrigatória, não publicada. Teste real bloqueado por aprovação automática. Não confundir testes simulados com precisão medida.
