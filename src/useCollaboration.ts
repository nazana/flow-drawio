import {useEffect,useRef} from 'react';
import {parseEditorMessage,postEditorMessage} from './drawio.ts';
export async function liveApi(path:string,method:string,body:unknown){
  const response=await fetch('/api/live'+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
  const result=await response.json();if(!response.ok)throw Object.assign(new Error(result.error||'공유 서버와 연결하지 못했습니다.'),{status:response.status});return result;
}


export type SharedState={title:string;xml:string;pageId:string;revision:number;editable:boolean;operationId?:string};
export function useCollaboration({token,owner,frame,title,onTitle,onError,onStatus,onSnapshot}:{token?:string;owner:boolean;frame:React.RefObject<HTMLIFrameElement|null>;title:string;onTitle:(title:string)=>void;onError:(message:string)=>void;onStatus:(message:string)=>void;onSnapshot?:(xml:string)=>void}){
  const titleRef=useRef(title);titleRef.current=title;
  const wake=useRef<()=>void>(()=>{});
  useEffect(()=>{wake.current();},[title]);
  useEffect(()=>{
    if(!token)return;
    let stopped=false,ready=false,applying=false,currentXml='',changed=false,remote:SharedState|null=null;
    let pending:{operationId:string;base:SharedState;state:SharedState}|null=null;
    const queue:SharedState[]=[];
    const prefix=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);let sequence=0;
    const requests=new Map<string,(message:any)=>void>();
    const send=(message:unknown)=>postEditorMessage(frame.current?.contentWindow,message);
    function incoming(next:SharedState){
      if(stopped)return;
      const acknowledgement=pending?queue.find(value=>value.operationId===pending?.operationId):undefined;
      queue.length=0;if(acknowledgement&&acknowledgement!==next)queue.push(acknowledgement);
      queue.push(next);void applyNext();
    }
    async function applyNext(){
      if(!ready||applying||stopped)return;
      const next=queue.shift();if(!next)return;
      const own=!!pending&&pending.operationId===next.operationId;
      if(remote&&next.revision<=remote.revision&&!own){void applyNext();return;}
      const target=remote&&next.revision<remote.revision?remote:next;
      const base=own?pending!.state:remote;
      const mergedTitle=base&&titleRef.current!==base.title?titleRef.current:target.title;
      applying=true;
      const id=prefix+'-apply-'+(++sequence);
      requests.set(id,message=>{
        applying=false;if(stopped)return;
        if(message.event==='flow:error'){onError(message.error);return;}
        remote=target;currentXml=message.xml;changed=!!message.collabChanged;
        if(own)pending=null;
        titleRef.current=mergedTitle;onTitle(mergedTitle);onSnapshot?.(currentXml);
        onStatus('● 공동편집 연결됨');onError('');void applyNext();
      });
      send({action:'flow:collabApply',sessionId:token,requestId:id,baseXml:base?.xml??currentXml,xml:target.xml});
    }
    async function transmit(){
      if(!pending||stopped)return;const operation=pending;
      try{
        const result=await liveApi('/'+token+'/edit'+(owner?'?owner=1':''),'POST',operation);
        if(!stopped&&pending===operation)incoming(result);
      }catch(error){
        if(stopped||pending!==operation)return;
        onError((error as Error).message);onStatus('공동편집 연결 확인 중 · 변경 내용 보존됨');
        if([401,403,410].includes((error as {status:number}).status)){stopped=true;stream.close();send({action:'flow:collabStop',sessionId:token,freeze:!owner});return;}
        retry=setTimeout(()=>void transmit(),1500);
      }
    }
    function publish(){
      if(stopped||!ready||applying||pending||!remote||!currentXml||(!changed&&titleRef.current===remote.title))return;
      pending={operationId:prefix+'-'+(++sequence),base:remote,state:{...remote,title:titleRef.current,xml:currentXml}};
      void transmit();
    }
    let retry:ReturnType<typeof setTimeout>|undefined;
    wake.current=publish;
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!==location.origin)return;
      const message=parseEditorMessage(event.data);if(!message)return;
      const request=requests.get(message.requestId);
      if(request){requests.delete(message.requestId);request(message);return;}
      if(message.event==='load'||message.event==='flow:ready')send({action:'flow:snapshot'});
      if(message.event==='flow:snapshot'){
        currentXml=message.xml;changed=!!message.collabChanged;onSnapshot?.(currentXml);ready=true;
        void applyNext();
      }
    };
    window.addEventListener('message',receive);
    const stream=new EventSource('/api/live/'+token+'/events'+(owner?'?owner=1':''));
    stream.addEventListener('snapshot',event=>incoming(JSON.parse((event as MessageEvent).data)));
    stream.addEventListener('ended',()=>{onStatus('공유가 종료되었습니다. 변경 내용은 내려받아 보관하세요.');onError('공동편집 종료');stopped=true;stream.close();send({action:'flow:collabStop',sessionId:token,freeze:!owner});});
    stream.onerror=()=>{onStatus('연결이 끊겼습니다. 재연결 중…');};
    const tick=setInterval(publish,250);
    send({action:'flow:collabBegin',sessionId:token});send({action:'flow:snapshot'});
    return()=>{stopped=true;wake.current=()=>{};clearInterval(tick);clearTimeout(retry);stream.close();requests.clear();window.removeEventListener('message',receive);send({action:'flow:collabStop',sessionId:token});};
  },[token,owner]);
}
