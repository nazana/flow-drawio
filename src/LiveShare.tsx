import {useEffect,useRef,useState} from 'react';
import Modal from './Modal.tsx';
import type {Snapshot} from './model.ts';
import {editorUrl,parseEditorMessage,postEditorMessage} from './drawio.ts';

export async function liveApi(path:string,method:string,body:unknown){
  const response=await fetch('/api/live'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw new Error(result.error||'공유 서버와 연결하지 못했습니다.');return result;
}
export function LiveShare({documentId,title,snapshot}:{documentId?:string;title:string;snapshot:Snapshot|null}){
  const [room,setRoom]=useState<{token:string;links:string[]}|null>(null),[open,setOpen]=useState(false),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [password,setPassword]=useState(''),[copied,setCopied]=useState('');
  const latest=useRef({title,xml:snapshot?.xml??'',pageId:snapshot?.pageId??''});latest.current={title,xml:snapshot?.xml??'',pageId:snapshot?.pageId??''};
  const active=useRef(room);active.current=room;
  const currentDocument=useRef(documentId);currentDocument.current=documentId;
  const uploading=useRef(false);
  async function publish(token:string){
    if(uploading.current||!latest.current.xml||active.current?.token!==token)return;
    uploading.current=true;const sent=latest.current;
    try{await liveApi('/'+token,'PUT',sent);if(active.current?.token===token)setError('');}
    catch(e){if(active.current?.token===token)setError((e as Error).message);}
    finally{uploading.current=false;if(active.current?.token===token&&JSON.stringify(latest.current)!==JSON.stringify(sent))void publish(token);}
  }
  useEffect(()=>()=>{const current=active.current;if(current){void liveApi('/'+current.token,'DELETE',{}).catch(()=>{});active.current=null;setRoom(null);setPassword('');}},[documentId]);
  useEffect(()=>{
    if(!room)return;
    const heartbeat=setInterval(()=>void publish(room.token),10000);
    const pagehide=()=>{void fetch('/api/live/'+room.token,{method:'DELETE',headers:{'Content-Type':'application/json'},body:'{}',keepalive:true}).catch(()=>{});};
    window.addEventListener('pagehide',pagehide);
    return()=>{clearInterval(heartbeat);window.removeEventListener('pagehide',pagehide);};
  },[room]);
  useEffect(()=>{
    if(!room||!snapshot)return;
    const timer=setTimeout(()=>void publish(room.token),350);
    return()=>clearTimeout(timer);
  },[room,title,snapshot?.xml,snapshot?.pageId]);
  async function start(){
    setBusy(true);setError('');const id=documentId;
    try{const value=await liveApi('','POST',{...latest.current,password});if(currentDocument.current!==id){await liveApi('/'+value.token,'DELETE',{});return;}setRoom(value);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  }
  async function stop(){if(!room)return;setBusy(true);try{await liveApi('/'+room.token,'DELETE',{});setRoom(null);setPassword('');setOpen(false);setError('');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  async function copy(value:string,label:string){
    const field=document.createElement('textarea'),focus=document.activeElement as HTMLElement|null;
    field.value=value;field.style.cssText='position:fixed;opacity:0';(document.querySelector('dialog[open]')??document.body).appendChild(field);field.select();
    const copied=document.execCommand('copy');field.remove();focus?.focus();
    try{if(!copied)await navigator.clipboard.writeText(value);setCopied(`${label} 복사됨`);}catch{setCopied('복사하지 못했습니다. 입력 내용을 선택해 직접 복사하세요.');}
  }
  return <><button disabled={!snapshot||busy} aria-pressed={!!room} onClick={()=>{setCopied('');setOpen(true);}}>{room?'● 공유 중':'실시간 보기 공유'}</button>{error&&!open&&<span role="alert">공유 연결 확인 필요</span>}{open&&<Modal label="실시간 보기 공유" busy={busy} confirmChanges={!room} onClose={()=>setOpen(false)}><form className="modal connection-modal" onSubmit={e=>{e.preventDefault();if(!room)void start();}}><h2>실시간 보기 공유</h2><p className="hint">상대방은 링크와 비밀번호로 현재 문서의 저장 전 변경을 실시간으로 봅니다. 수정과 다른 문서 열기는 허용하지 않습니다.</p><label>공유 비밀번호<input aria-label="공유 비밀번호" type="password" autoComplete="new-password" minLength={8} maxLength={128} required readOnly={!!room} value={password} onChange={e=>setPassword(e.target.value)} placeholder="직접 설정 · 8자 이상"/></label>{room&&<button type="button" onClick={()=>void copy(password,'비밀번호')}>비밀번호 복사</button>}{room?.links.map(link=><div key={link}><label>공유 링크<input aria-label="공유 링크" readOnly value={link} onFocus={e=>e.target.select()}/></label><button type="button" onClick={()=>void copy(link,'공유 링크')}>링크 복사</button></div>)}{room&&!room.links.length&&<p className="error">네트워크 주소가 없습니다. 노트북의 Wi-Fi 또는 유선 연결을 확인하세요.</p>}<p className="hint">같은 사내망·Wi-Fi에서 사용하세요. 노트북 방화벽에서 앱 접속 허용이 필요할 수 있습니다. 문서를 바꾸거나 공유를 중단하면 링크가 종료됩니다. 비밀번호를 바꾸려면 공유를 중단하고 다시 시작하세요.</p>{copied&&<p role="status">{copied}</p>}{error&&<p role="alert" className="error">{error}</p>}<div className="modal-actions"><button type="button" data-modal-close>닫기</button>{room?<button type="button" disabled={busy} onClick={()=>void stop()}>공유 중단</button>:<button className="primary" disabled={busy||!snapshot}>공유 시작</button>}</div></form></Modal>}</>;
}

type LiveState={title:string;xml:string;pageId:string};
export function LiveViewer({token}:{token:string}){
  const frame=useRef<HTMLIFrameElement>(null),latest=useRef<LiveState|null>(null);
  const ready=useRef(false),initialized=useRef(false),loading=useRef(false),loadedXml=useRef('');
  const [title,setTitle]=useState('실시간 보기'),[status,setStatus]=useState('공유 비밀번호를 입력하세요.');
  const [authorized,setAuthorized]=useState(false),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[ended,setEnded]=useState(false);
  function send(message:unknown){postEditorMessage(frame.current?.contentWindow,message);}
  function load(){if(!ready.current||!initialized.current||!latest.current||loading.current)return;loading.current=true;loadedXml.current=latest.current.xml;send({action:'load',xml:latest.current.xml,title:latest.current.title,autosave:0});}
  async function join(){setBusy(true);setError('');try{await liveApi('/'+token+'/join','POST',{password});setAuthorized(true);setPassword('');setStatus('연결 중…');}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  useEffect(()=>{
    if(!authorized)return;
    let cancelled=false;
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!==location.origin)return;
      const message=parseEditorMessage(event.data);if(!message)return;
      if(message.event==='init'){initialized.current=true;load();}
      if(message.event==='flow:ready'){ready.current=true;load();}
      if(message.event==='load'){loading.current=false;send({action:'flow:readonly',pageId:latest.current?.pageId});if(latest.current?.xml!==loadedXml.current)load();}
      if(message.event==='flow:readonly')setStatus('● 실시간 연결 · 보기 전용');
    };
    window.addEventListener('message',receive);
    const stream=new EventSource('/api/live/'+token+'/events');
    stream.addEventListener('snapshot',event=>{
      const next=JSON.parse((event as MessageEvent).data) as LiveState;
      const changed=next.xml!==latest.current?.xml;latest.current=next;setTitle(next.title);
      if(changed||!loadedXml.current)load();else if(!loading.current)send({action:'flow:readonly',pageId:next.pageId});
    });
    stream.addEventListener('ended',()=>{setStatus('공유가 종료되었습니다.');setEnded(true);stream.close();});
    stream.onerror=()=>{setStatus('연결이 끊겼습니다. 재연결 중…');void fetch('/api/live/'+token,{signal:AbortSignal.timeout(5000)}).then(response=>{if(cancelled)return;if(response.status===410){setStatus('공유가 종료되었습니다.');setEnded(true);stream.close();}else if(response.status===401){setAuthorized(false);setStatus('공유 비밀번호를 다시 입력하세요.');stream.close();}}).catch(()=>{});};
    return()=>{cancelled=true;stream.close();window.removeEventListener('message',receive);ready.current=false;initialized.current=false;loading.current=false;loadedXml.current='';latest.current=null;};
  },[authorized,token]);
  return <main><header><strong>{title}</strong><span role="status">{status}</span></header>{!authorized?<form className="modal" style={{margin:'40px auto'}} onSubmit={e=>{e.preventDefault();void join();}}><h2>보기 전용 공유 접속</h2><label>공유 비밀번호<input autoFocus type="password" autoComplete="off" required minLength={8} maxLength={128} value={password} onChange={e=>setPassword(e.target.value)}/></label>{error&&<p className="error" role="alert">{error}</p>}<button className="primary" disabled={busy}>접속</button></form>:<div className="editor" style={{flex:1}}>{ended?<div className="loading">공유가 종료되었습니다.</div>:<iframe ref={frame} title="보기 전용 공유 캔버스" src={editorUrl}/>}</div>}</main>;
}
