# Forja — contexto para colaboração

MVP de orçamentação para serralharia em português. O objetivo imediato é interpretar imagens/PDF/CAD/BIM e ligar dados revistos ao orçamento e à memória de projeto. Geração de desenho técnico é uma fase posterior.

## Executar

Para leitura visual: Node 22 ou superior, `node server/local.mjs` e abrir http://localhost:8000. O servidor lê a chave de `.env.local` (nunca incluída no ZIP). Para apenas OCR/CAD/BIM, pode servir `dist/` com um servidor estático. Não abrir o HTML diretamente com file://.

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

Existe uma chamada Responses API no backend local `server/vision.mjs`, com saída estruturada, fonte, evidência, hipóteses e perguntas. Ativar a opção IA em Interpretar ficheiros para enviar imagem e contexto. O servidor local suporta fotos/esquiços; PDF continua texto/OCR. A integração ainda não está publicada no site estático. O teste real da API foi bloqueado pela revisão automática; precisão visual não validada. Não colocar chaves no JavaScript público. Os dados dos projetos estão em localStorage/IndexedDB e podem ser exportados/importados.

## Validar

`node --check dist/app.js`
`node --check dist/interpret.js`
`node reader-tests.mjs`
`node tests.mjs`

Testados: cálculos em cêntimos, independência de snapshots, extração de cotas, DXF e IFC sintéticos e OCR da imagem de teste. QA no navegador confirmou DXF e aplicação de uma área ao orçamento/memória. PDF e IFC no navegador ainda precisam de validação completa.

## Entregar alterações

Editar estes ficheiros e devolver o projeto ou um patch. Este pacote não contém credenciais nem permissões para publicar no alojamento original. As alterações devem ser testadas e depois integradas pelo responsável do site.

## Testes adicionais
`node server/vision-tests.mjs` valida contratos com API simulada, nunca precisão visual.

## Próxima validação
Cinco pedidos reais autorizados, com respostas esperadas revistas pela empresa e critério de aprovação acordado. Medir campos corretos, omissões, medidas inventadas e tempo de revisão. Nenhum resultado de mercado ou piloto pago é presumido.

## Usar Anthropic
No ficheiro local `.env.local`, configurar `VISION_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` e, opcionalmente, `ANTHROPIC_VISION_MODEL=claude-sonnet-4-6`. Introduzir a chave apenas no computador/servidor, nunca no chat nem no frontend. Depois executar `npm start`. Não existe chave Anthropic configurada neste pacote. A chave e o saldo OpenAI não são utilizados quando o fornecedor é Anthropic. Não há troca automática de fornecedor após erros.
Integração baseada em https://platform.claude.com/docs/en/build-with-claude/vision e https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools . Testes simulados; sem chamada real à Anthropic e sem publicação.

## Windows
No PowerShell, se npm.ps1 estiver bloqueado, usar `npm.cmd start` e `npm.cmd test`. O servidor valida caminhos com `path.sep` para suportar Windows e Linux.

## Avaliação com pedidos reais
Preparar cinco pedidos anonimizados de tipos diferentes e escrever as respostas esperadas antes de executar. Guardar entradas em `pedidos/` e respostas em `resultados/`. Congelar código, modelo e prompt durante a avaliação. Classificar os campos como certos, errados ou inventados, incluindo omissões. Só alterar o prompt depois da avaliação. Os testes automáticos atuais não demonstram precisão em pedidos reais.

## DWG como fonte
Selecionar DWG em Interpretar ficheiros guarda o original (até 20 MB, cabeçalho ACxxxx reconhecido). Em Fontes DWG, associar DXF ASCII exportado da mesma versão. A análise preserva os IDs e nomes do original e do derivado; as linhas incluem a cadeia DWG → DXF → entidade. A correspondência dos dois ficheiros é confirmada pelo utilizador, não verificada geometricamente. O DWG isolado não produz medidas. Conversão automática e interpretação direta DWG não implementadas. Não validado com DWG real de empresa.
