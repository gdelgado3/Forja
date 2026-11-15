import fs from 'node:fs';
const copy=(src,dst)=>{fs.mkdirSync(new URL('../dist/'+dst,import.meta.url).pathname.split('/').slice(0,-1).join('/'),{recursive:true});fs.copyFileSync(new URL('../node_modules/'+src,import.meta.url),new URL('../dist/'+dst,import.meta.url))};
for(const [src,dst]of[
['dxf-parser/dist/dxf-parser.js','vendor/dxf-parser.js'],['dxf-parser/LICENSE','vendor/DXF-LICENSE.txt'],
['tesseract.js/dist/tesseract.min.js','vendor/ocr/tesseract.min.js'],['tesseract.js/dist/worker.min.js','vendor/ocr/worker.min.js'],['tesseract.js/LICENSE.md','vendor/ocr/LICENSE.md'],['tesseract.js-core/tesseract-core-lstm.wasm.js','vendor/ocr/tesseract-core-lstm.wasm.js'],['tesseract.js-core/LICENSE','vendor/ocr/CORE-LICENSE.txt'],
['@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz','vendor/ocr/eng.traineddata.gz'],['@tesseract.js-data/por/4.0.0_best_int/por.traineddata.gz','vendor/ocr/por.traineddata.gz'],
['web-ifc/web-ifc-api.js','vendor/ifc/web-ifc-api.js'],['web-ifc/web-ifc.wasm','vendor/ifc/web-ifc.wasm'],['web-ifc/LICENSE.md','vendor/ifc/LICENSE.md'],
['pdfjs-dist/build/pdf.min.mjs','vendor/pdf/pdf.min.mjs'],['pdfjs-dist/build/pdf.worker.min.mjs','vendor/pdf/pdf.worker.min.mjs'],['pdfjs-dist/LICENSE','vendor/pdf/LICENSE.txt']])copy(src,dst);
fs.cpSync(new URL('../node_modules/pdfjs-dist/standard_fonts',import.meta.url),new URL('../dist/vendor/pdf/standard_fonts',import.meta.url),{recursive:true});
fs.cpSync(new URL('../node_modules/pdfjs-dist/wasm',import.meta.url),new URL('../dist/vendor/pdf/wasm',import.meta.url),{recursive:true});
console.log('Self-hosted readers copied.');
