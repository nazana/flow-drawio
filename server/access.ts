import type {IncomingMessage} from 'node:http';
import {failure} from './db.ts';

export function requireOwner(req:IncomingMessage){
  const address=req.socket.remoteAddress;
  const host=new URL(`http://${req.headers.host??''}`).hostname;
  if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(address??'')||!['127.0.0.1','localhost','[::1]'].includes(host))throw failure('편집과 문서 관리는 서버 노트북에서만 가능합니다.',403);
}
export async function readJson(req:IncomingMessage){
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`&&req.headers.origin!==`https://${req.headers.host}`)throw failure('같은 출처의 요청만 허용합니다.',403);
  if(!req.headers['content-type']?.startsWith('application/json'))throw failure('JSON 요청이 필요합니다.',415);
  let bytes=0;const chunks:Buffer[]=[];
  for await(const chunk of req){bytes+=chunk.length;if(bytes>20_000_000)throw failure('요청은 최대 20MB입니다.',413);chunks.push(chunk);}
  return JSON.parse(Buffer.concat(chunks).toString());
}
