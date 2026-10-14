import type {IncomingMessage,ServerResponse} from 'node:http';
import type {Plugin} from 'vite';
import {createStore,failure} from './db.ts';
import {readJson,requireOwner} from './access.ts';
import {createLiveHandler} from './live.ts';
export function createApiHandler() {
  const store=createStore();
  const live=createLiveHandler();
  async function handler(req:IncomingMessage,res:ServerResponse,next:()=>void) {
    if(!req.url?.startsWith('/api/')){next();return;}
    res.setHeader('Content-Type','application/json; charset=utf-8');res.setHeader('Cache-Control','no-store');
    try {
      if(new URL(req.url,'http://localhost').pathname.startsWith('/api/live')){await live.handler(req,res);return;}
      requireOwner(req);
      const match=/^\/api\/documents(?:\/([\w-]+)(?:\/(recovery|versions)(?:\/(\d+))?)?)?$/.exec(new URL(req.url,'http://localhost').pathname);
      if(!match)throw failure('API를 찾을 수 없습니다.',404);
      const id=match[1],recovery=match[2]==='recovery',versions=match[2]==='versions',version=match[3]?Number(match[3]):undefined;
      if((recovery&&version!==undefined)||(version!==undefined&&!Number.isSafeInteger(version)))throw failure('API를 찾을 수 없습니다.',404);
      let data:unknown;
      if(req.method==='GET')data=versions?(version===undefined?store.versions(id):store.version(id,version)):recovery?store.recoveries(id):id?store.read(id):store.list();
      else if((req.method==='POST'&&(!id||versions&&version!==undefined))||(req.method==='PUT'&&id&&!versions)) {
        const input=await readJson(req);
        data=versions?store.restoreVersion(id,version!,input):recovery?store.saveRecovery(id,input):store.save(input,id);
      }else throw failure('지원하지 않는 요청입니다.',405);
      res.end(JSON.stringify(data));
    }catch(error){res.statusCode=(error as {status?:number}).status??400;res.end(JSON.stringify({error:error instanceof Error?error.message:'요청 처리 실패'}));}
  }
  return {handler,close(){live.close();store.close();}};
}
export function localAPI():Plugin {
  return {name:'flow-local-api',configureServer(server){const api=createApiHandler();server.middlewares.use(api.handler);server.httpServer?.once('close',api.close);}};
}
