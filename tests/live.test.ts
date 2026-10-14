import test from 'node:test';
import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import {EventEmitter} from 'node:events';
import type {IncomingMessage,ServerResponse} from 'node:http';
import {createLiveHandler} from '../server/live.ts';
import {requireOwner} from '../server/access.ts';
import {sampleXml} from '../src/sample.ts';
import {createApiHandler} from '../server/api.ts';

function request(path:string,method='GET',body?:unknown,remote=false,cookie=''){
  const req=Readable.from(body===undefined?[]:[Buffer.from(JSON.stringify(body))]) as IncomingMessage;
  req.url=path;req.method=method;
  req.headers={host:remote?'192.168.1.10:5180':'127.0.0.1:5180','content-type':'application/json',cookie};
  Object.defineProperty(req,'socket',{value:{remoteAddress:remote?'192.168.1.20':'127.0.0.1'}});
  return req;
}
function response(){
  const res=new EventEmitter() as ServerResponse&{chunks:string[];headers:Record<string,string>;ended:boolean};
  res.chunks=[];res.headers={};res.ended=false;
  Object.defineProperty(res,'writableLength',{value:0});
  res.setHeader=((key:string,value:string)=>{res.headers[key]=value;return res;}) as any;
  res.writeHead=((status:number,headers:Record<string,string>)=>{res.statusCode=status;Object.assign(res.headers,headers);return res;}) as any;
  res.write=((value:string)=>{res.chunks.push(value);return true;}) as any;
  res.end=((value?:string)=>{if(value)res.chunks.push(value);res.ended=true;return res;}) as any;
  return res;
}
const rejectsStatus=(status:number)=>(error:any)=>error.status===status;

test('remote requests cannot list, read or save stored documents even with a localhost Host',async()=>{
  const previous=process.env.FLOW_DB_PATH;process.env.FLOW_DB_PATH=':memory:';
  const api=createApiHandler();if(previous===undefined)delete process.env.FLOW_DB_PATH;else process.env.FLOW_DB_PATH=previous;
  try{
    for(const [path,method] of [['/api/documents','GET'],['/api/documents/example','GET'],['/api/documents','POST'],['/api/documents/example','PUT']]){
      const req=request(path,method,{title:'remote',xml:sampleXml()},true);req.headers.host='127.0.0.1:5180';
      const res=response();await api.handler(req,res,()=>assert.fail('API must handle request'));
      assert.equal(res.statusCode,403);assert.match(res.chunks.join(''),/노트북/);
    }
    const local=response();await api.handler(request('/api/documents'),local,()=>assert.fail());assert.deepEqual(JSON.parse(local.chunks.join('')),[]);
  }finally{api.close();}
});

test('live viewing: password required, scoped sessions, read-only remote access, updates and revocation',async()=>{
  const live=createLiveHandler();
  const state={title:'저장 전 작업',xml:sampleXml(),pageId:'main'},password='my-live-password';
  try{
    const created=response();await live.handler(request('/api/live','POST',{...state,password}),created);
    const {token}=JSON.parse(created.chunks.join(''));
    assert.match(token,/^[a-f0-9]{64}$/);assert.ok(!created.chunks.join('').includes(password));
    const path='/api/live/'+token;
    await assert.rejects(live.handler(request(path,'GET',undefined,true),response()),rejectsStatus(401));
    await assert.rejects(live.handler(request(path+'/events','GET',undefined,true),response()),rejectsStatus(401));
    await assert.rejects(live.handler(request(path+'/join','POST',{password:'wrong-password'},true),response()),rejectsStatus(401));
    const joined=response();await live.handler(request(path+'/join','POST',{password},true),joined);
    const cookie=joined.headers['Set-Cookie'].split(';')[0];assert.match(joined.headers['Set-Cookie'],/HttpOnly; SameSite=Strict/);
    const viewer=response();await live.handler(request(path+'/events','GET',undefined,true,cookie),viewer);
    assert.equal(viewer.statusCode,200);assert.ok(viewer.chunks[0].includes('저장 전 작업'));
    await assert.rejects(live.handler(request(path,'PUT',{...state,title:'remote edit'},true,cookie),response()),rejectsStatus(403));
    await assert.rejects(live.handler(request(path,'DELETE',{},true,cookie),response()),rejectsStatus(403));
    await assert.rejects(live.handler(request('/api/live','POST',{...state,password},true,cookie),response()),rejectsStatus(403));
    const changed={...state,title:'바로 반영',xml:state.xml.replace('생산계획','실시간 변경')};
    await live.handler(request(path,'PUT',changed),response());assert.equal(viewer.chunks.length,2);assert.ok(viewer.chunks[1].includes('바로 반영'));
    const read=response();await live.handler(request(path,'GET',undefined,true,cookie),read);assert.deepEqual(JSON.parse(read.chunks.join('')),changed);
    const second=response();await live.handler(request('/api/live','POST',{...state,password}),second);
    const other='/api/live/'+JSON.parse(second.chunks.join('')).token;
    await assert.rejects(live.handler(request(other,'GET',undefined,true,cookie),response()),rejectsStatus(401));
    await live.handler(request(path,'DELETE',{}),response());assert.equal(viewer.ended,true);assert.match(viewer.chunks.at(-1)!,/event: ended/);
    await assert.rejects(live.handler(request(path,'GET',undefined,true,cookie),response()),rejectsStatus(410));
  }finally{live.close();}
});

test('live trust boundaries: password limits, XML validation, origin, throttling and owner host',async()=>{
  const live=createLiveHandler(),state={title:'작업',xml:sampleXml(),pageId:'main'};
  try{
    await assert.rejects(live.handler(request('/api/live','POST',{...state,password:'short'}),response()));
    await assert.rejects(live.handler(request('/api/live','POST',{...state,xml:'<notdrawio/>',password:'password123'}),response()));
    const foreign=request('/api/live','POST',{...state,password:'password123'});foreign.headers.origin='https://evil.example';
    await assert.rejects(live.handler(foreign,response()),rejectsStatus(403));
    const rebound=request('/api/live','POST');rebound.headers.host='evil.example';assert.throws(()=>requireOwner(rebound),rejectsStatus(403));
    const spoof=request('/api/live','POST',{},true);spoof.headers.host='localhost:5180';assert.throws(()=>requireOwner(spoof),rejectsStatus(403));
    const created=response();await live.handler(request('/api/live','POST',{...state,password:'password123'}),created);
    const path='/api/live/'+JSON.parse(created.chunks.join('')).token+'/join';
    for(let i=0;i<5;i++)await assert.rejects(live.handler(request(path,'POST',{password:'password999'},true),response()),rejectsStatus(401));
    await assert.rejects(live.handler(request(path,'POST',{password:'password999'},true),response()),rejectsStatus(429));
  }finally{live.close();}
});
