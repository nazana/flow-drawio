import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {extname,join,resolve,sep} from 'node:path';
import {createApiHandler} from './api.ts';
const root=resolve(process.env.FLOW_STATIC_PATH??'dist'),api=createApiHandler();
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.gif':'image/gif','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf','.ico':'image/x-icon','.xml':'application/xml','.txt':'text/plain','.wasm':'application/wasm'};
const csp="default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; frame-src 'self' blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; frame-ancestors 'self'";
const server=createServer((req,res)=>{
  res.setHeader('Content-Security-Policy',csp);res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  if(req.url?.startsWith('/api/')){void api.handler(req,res,()=>{res.statusCode=404;res.end();});return;}
  void(async()=>{try {
    if(req.method!=='GET'&&req.method!=='HEAD'){res.statusCode=405;res.end();return;}
    const pathname=decodeURIComponent(new URL(req.url??'/','http://localhost').pathname);
    if(pathname==='/drawio'){res.writeHead(302,{Location:'/drawio/'});res.end();return;}
    let file=resolve(root,`.${pathname}`);
    if((file!==root&&!file.startsWith(root+sep))||/\/(?:WEB-INF|META-INF)(?:\/|$)/i.test(pathname)){res.statusCode=403;res.end();return;}
    if((await stat(file)).isDirectory())file=join(file,'index.html');
    res.setHeader('Content-Type',types[extname(file)]??'application/octet-stream');
    res.end(req.method==='HEAD'?undefined:await readFile(file));
  }catch{res.statusCode=404;res.end('Not found');}})();
});
server.on('close',api.close);
export {server};
export const serverReady=new Promise<string>((ready,reject)=>{
  server.once('error',reject);
  server.listen(Number(process.env.PORT??5180),process.env.HOST??'0.0.0.0',()=>ready(`http://127.0.0.1:${(server.address() as {port:number}).port}`));
});
serverReady.then(url=>console.log(`Flow Studio: ${url}`)).catch(error=>{console.error(error.message);process.exitCode=1;});
