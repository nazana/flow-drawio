import {useState} from 'react';
import Modal from './Modal.tsx';
import type {ConnectionConflict,Snapshot} from './model.ts';

export default function ConnectionConflictDialog({snapshot,enabled,onResolve}:{snapshot:Snapshot;enabled:boolean;onResolve:(conflict:ConnectionConflict,mode:string)=>Promise<unknown>}){
  const [dismissed,setDismissed]=useState<Set<string>>(new Set()),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const key=(item:ConnectionConflict)=>JSON.stringify([snapshot.pageId,item]);
  const conflicts=snapshot.conflicts||[],current=conflicts.find(item=>!dismissed.has(key(item)));
  function close(){if(current)setDismissed(old=>new Set([...old,key(current)]));setError('');}
  async function apply(mode:string){if(!current||busy)return;setBusy(true);setError('');try{await onResolve(current,mode);close();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  const system=(code:string)=>{const item=snapshot.catalog.systems.find(s=>s.code===code);return <span title={item?.name}>{code||'미지정'}</span>;};
  return <>
    {!!conflicts.length&&!current&&<button onClick={()=>setDismissed(new Set())}>연결 정보 확인 · {conflicts.length}건</button>}
    {current&&enabled&&<Modal label="노드와 I/F의 시스템 확인" busy={busy} onClose={close}><section className="modal connection-modal">
      <h2>시스템 연결 확인</h2>
      <p className="connection-id">{current.ifId}</p>
      <p className="hint">{!current.source||!current.target?'연결이 끊긴 끝점이 있습니다.':!current.from||!current.to?'노드의 시스템이 미지정입니다.':'노드와 I/F의 송수신 시스템이 다릅니다.'}</p>
      <table className="connection-comparison"><thead><tr><th>기준</th><th>송신</th><th>수신</th></tr></thead><tbody>
        <tr><th>노드</th><td>{current.source?system(current.from):'연결 끊김'}</td><td>{current.target?system(current.to):'연결 끊김'}</td></tr>
        <tr><th>I/F 정의</th><td>{system(current.ifFrom)}</td><td>{system(current.ifTo)}</td></tr>
      </tbody></table>
      <div className="connection-choices">
        <button disabled={busy||!current.source||!current.target||!current.from||!current.to} onClick={()=>void apply('interface')}><strong>노드 → I/F 동기화</strong><small>{current.shared?`공유 선 ${current.shared}개 영향`:'I/F 정의 변경'}</small></button>
        <button disabled={busy||!current.source||!current.target||current.source===current.target&&current.ifFrom!==current.ifTo} onClick={()=>void apply('nodes')}><strong>I/F → 노드 동기화</strong><small>{current.related?`관련 선 ${current.related}개 확인 필요`:'노드 소속 변경'}</small></button>
        <button disabled={busy} onClick={()=>void apply('detach')}><strong>I/F 지정 해제</strong><small>선·공유 정의 유지</small></button>
      </div>
      {(!current.source||!current.target||!current.from||!current.to)&&<p className="hint">노드 → I/F: 양 끝 연결과 시스템 지정이 필요합니다.</p>}
      {error&&<p className="error" role="alert">{error}</p>}
      <div className="modal-actions"><span className="hint">선택 전까지 변경되지 않습니다.</span><button disabled={busy} data-modal-close>나중에</button></div>
    </section></Modal>}
  </>;
}
