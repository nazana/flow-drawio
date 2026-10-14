// Exercise the shipped portable EXE through Chromium's test-only debugging port.
import assert from 'node:assert/strict';
import {readdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {sampleXml} from '../src/sample.ts';

const filename=(await readdir('releases')).find(name=>name.endsWith('-Windows-x64-Portable.exe'));
assert.ok(filename,'Portable EXE missing');
const endpoint='http://127.0.0.1:9331';
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitFor(check){
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){try{const result=await check();if(result)return result;}catch{}await sleep(250);}
  throw new Error('Electron smoke test timed out');
}
async function launch(){
  console.log('Launching portable EXE');
  const child=spawn(resolve('releases',filename),['--remote-debugging-port=9331'],{stdio:'inherit'});
  child.on('error',error=>{console.error(error);process.exitCode=1;});
  const target=await waitFor(async()=>{
    const targets=await (await fetch(endpoint+'/json/list',{signal:AbortSignal.timeout(1000)})).json();
    return targets.find(target=>target.type==='page'&&target.url.startsWith('http://127.0.0.1:'));
  });
  console.log('Connected to app page:',target.url);
  const socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  let id=0;const pending=new Map();
  socket.addEventListener('message',event=>{
    const message=JSON.parse(event.data),request=pending.get(message.id);
    if(request){pending.delete(message.id);clearTimeout(request.timer);message.error?request.reject(new Error(JSON.stringify(message.error))):request.resolve(message.result);}
  });
  function send(method,params={}){
    return new Promise((resolve,reject)=>{
      const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(new Error(`${method} timed out`));},15000);
      pending.set(key,{resolve,reject,timer});socket.send(JSON.stringify({id:key,method,params}));
    });
  }
  async function evaluate(expression){
    const result=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
    if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  }
  async function close(){
    console.log('Closing app');
    await send('Browser.close').catch(()=>{});socket.close();
    await waitFor(async()=>{try{await fetch(endpoint+'/json/list',{signal:AbortSignal.timeout(1000)});return false;}catch{return true;}});
  }
  return {send,evaluate,close};
}
let browser=await launch();
let saved;
try{
  console.log('Checking screen load');
  await waitFor(()=>browser.evaluate("document.readyState==='complete' && document.body.innerText.includes('새 문서')"));
  console.log('Saving document');
  const xml=sampleXml();
  saved=await browser.evaluate(`fetch('/api/documents',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(${JSON.stringify({title:'Electron portable smoke',xml})})}).then(r=>r.json())`);
  assert.ok(saved.id);assert.equal(saved.xml,xml);
  const versions=await browser.evaluate(`fetch('/api/documents/${saved.id}/versions').then(r=>r.json())`);
  assert.equal(versions.length,1);
  await browser.send('Page.reload');
  console.log('Checking draw.io bridge');
  await waitFor(()=>browser.evaluate("Array.from(document.querySelectorAll('button')).some(b=>b.textContent==='전체 보기'&&!b.disabled) && !!document.querySelector('iframe')?.contentDocument?.querySelector('.geDiagramContainer')"));
  const screenshot=await browser.send('Page.captureScreenshot');
  await writeFile('releases/windows-electron-smoke.png',Buffer.from(screenshot.data,'base64'));
}finally{await browser.close();}
const database=await readFile('releases/.data/flow.sqlite');
assert.equal(database.subarray(0,15).toString(),'SQLite format 3');
browser=await launch();
try{
  console.log('Checking restart persistence');
  const restored=await browser.evaluate(`fetch('/api/documents/${saved.id}').then(r=>r.json())`);
  assert.equal(restored.xml,saved.xml);assert.equal(restored.title,saved.title);
}finally{await browser.close();}
console.log('Windows portable EXE: app, draw.io bridge, save, history and restart persistence passed.');
