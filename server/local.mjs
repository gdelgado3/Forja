import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {analyze} from './vision.mjs';
try{process.loadEnvFile('.env.local')}catch{}
const root=resolve('dist');
const types={'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.wasm':'application/wasm','.png':'image/png','.json':'application/json'};
http.createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://localhost');
 if(url.pathname==='/api/vision'){
  res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST'){res.writeHead(405);return res.end('{}')}
  if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host){res.writeHead(403);return res.end('{}')}
  let body='',size=0;for await(const chunk of req){size+=chunk.length;if(size>32000000)throw Error('Pedido demasiado grande.');body+=chunk}
  const out=await analyze(JSON.parse(body),process.env);return res.end(JSON.stringify(out));
 }
 const path=resolve(root,'.'+decodeURIComponent(url.pathname==='/'?'/index.html':url.pathname));if(!path.startsWith(root+sep))throw Error('Caminho inválido.');
 res.setHeader('Content-Type',types[extname(path)]||'application/octet-stream');res.end(await readFile(path));
 }catch(e){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message}))}
}).listen(8000,'127.0.0.1',()=>console.log('Forja: http://localhost:8000'));
