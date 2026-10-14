import type {IncomingMessage,ServerResponse} from 'node:http';
import {randomBytes,scrypt,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import {networkInterfaces} from 'node:os';
import {failure} from './db.ts';
import {inspectXml} from './xml.ts';
import {readJson,requireOwner} from './access.ts';

type State={title:string;xml:string;pageId:string};
type Room={state:State;updated:number;clients:Set<ServerResponse>;salt:Buffer;hash:Buffer;sessions:Set<string>;attempts:Map<string,{count:number;since:number}>};
const derive=promisify(scrypt);
function password(input:unknown){if(typeof input!=='string'||input.length<8||input.length>128)throw failure('비밀번호는 8~128자로 입력하세요.');return input;}
export function createLiveHandler(){
  const rooms=new Map<string,Room>();
  function emit(client:ServerResponse,event:string,data:unknown){
    if(client.writableLength>20_000_000){client.destroy();return;}
    client.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  function stop(token:string){const room=rooms.get(token);if(!room)return;rooms.delete(token);for(const client of room.clients){emit(client,'ended',{});client.end();}}
  const timer=setInterval(()=>{for(const [token,room] of rooms){if(Date.now()-room.updated>45000)stop(token);else for(const client of room.clients)client.write(': heartbeat\n\n');}},10000);
  timer.unref();
  function state(input:any):State{
    if(!input||typeof input.title!=='string'||input.title.length>160||typeof input.pageId!=='string'||input.pageId.length>200||typeof input.xml!=='string')throw failure('공유 내용을 확인하세요.');
    inspectXml(input.xml);
    return {title:input.title,xml:input.xml,pageId:input.pageId};
  }
  async function handler(req:IncomingMessage,res:ServerResponse){
    const path=new URL(req.url!,'http://localhost').pathname;
    if(path==='/api/live'&&req.method==='POST'){
      requireOwner(req);const input=await readJson(req),data=state(input),secret=password(input.password);
      if(rooms.size>=10)throw failure('공유는 동시에 최대 10개까지 가능합니다.');
      const salt=randomBytes(16),hash=await derive(secret,salt,32) as Buffer;
      const token=randomBytes(32).toString('hex');rooms.set(token,{state:data,updated:Date.now(),clients:new Set(),salt,hash,sessions:new Set(),attempts:new Map()});
      const port=new URL(`http://${req.headers.host}`).port;
      const hosts=[...new Set(Object.values(networkInterfaces()).flat().filter(item=>item?.family==='IPv4'&&!item.internal).map(item=>item!.address))];
      res.end(JSON.stringify({token,links:hosts.map(host=>`http://${host}${port?':'+port:''}/#view=${token}`)}));return;
    }
    const match=/^\/api\/live\/([a-f0-9]{64})(\/(?:events|join))?$/.exec(path);
    if(!match)throw failure('공유를 찾을 수 없습니다.',404);
    const token=match[1],room=rooms.get(token);
    if(!room)throw failure('공유가 종료되었거나 링크가 만료되었습니다.',410);
    if(match[2]==='/join'&&req.method==='POST'){
      const input=await readJson(req),secret=password(input?.password),address=req.socket.remoteAddress??'';
      for(const [key,attempt] of room.attempts)if(Date.now()-attempt.since>=60000)room.attempts.delete(key);
      const attempt=room.attempts.get(address)??{count:0,since:Date.now()};
      if(attempt.count>=5||room.attempts.size>=100)throw failure('접속 시도가 많습니다. 1분 후 다시 시도하세요.',429);
      attempt.count++;room.attempts.set(address,attempt);
      const hash=await derive(secret,room.salt,32) as Buffer;
      if(!timingSafeEqual(hash,room.hash))throw failure('비밀번호가 일치하지 않습니다.',401);
      if(rooms.get(token)!==room)throw failure('공유가 종료되었습니다.',410);
      if(room.sessions.size>=100)throw failure('접속이 너무 많습니다. 공유를 다시 시작하세요.',429);
      room.attempts.delete(address);const session=randomBytes(32).toString('hex');room.sessions.add(session);
      res.setHeader('Set-Cookie',`flow-view-${token}=${session}; HttpOnly; SameSite=Strict; Path=/api/live/${token}; Max-Age=3600`);res.end('{}');return;
    }
    if(req.method==='GET'){
      const cookie=req.headers.cookie?.split(';').map(value=>value.trim()).find(value=>value.startsWith(`flow-view-${token}=`))?.split('=')[1];
      if(!cookie||!room.sessions.has(cookie))throw failure('공유 비밀번호를 입력하세요.',401);
    }
    if(!match[2]&&req.method==='GET'){res.end(JSON.stringify(room.state));return;}
    if(match[2]==='/events'&&req.method==='GET'){
      if(room.clients.size>=30)throw failure('보기 접속은 최대 30명까지 가능합니다.',429);
      res.writeHead(200,{'Content-Type':'text/event-stream','Cache-Control':'no-store','X-Accel-Buffering':'no'});
      room.clients.add(res);res.on('close',()=>room.clients.delete(res));emit(res,'snapshot',room.state);return;
    }
    requireOwner(req);
    if(req.method==='PUT'&&!match[2]){
      const next=state(await readJson(req));room.updated=Date.now();
      if(JSON.stringify(next)!==JSON.stringify(room.state)){room.state=next;for(const client of room.clients)emit(client,'snapshot',next);}
      res.end('{}');return;
    }
    if(req.method==='DELETE'&&!match[2]){await readJson(req);stop(token);res.end('{}');return;}
    throw failure('보기 전용 공유입니다.',405);
  }
  return {handler,close(){clearInterval(timer);for(const token of rooms.keys())stop(token);}};
}
