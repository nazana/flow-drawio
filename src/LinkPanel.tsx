import {useEffect,useState} from 'react';
import type {Cell,DocumentSummary} from './model.ts';
export default function LinkPanel({cell,documents,pages,pageId,documentId,onApply,onOpen}:{cell:Cell;documents:DocumentSummary[];pages:{id:string;name:string}[];pageId:string;documentId:string;onApply:(kind:string,target:string)=>Promise<unknown>;onOpen:()=>Promise<unknown>}){
  const [kind,setKind]=useState('document'),[target,setTarget]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const link=cell.link||'',internal=link.startsWith('data:flow-document/id,')||link.startsWith('data:page/id,');
  useEffect(()=>{setKind(link.startsWith('data:page/id,')?'page':'document');setTarget(internal?link.slice(link.indexOf(',')+1):'');setError('');},[cell.id,link]);
  const options=kind==='page'?pages.filter(p=>p.id!==pageId):documents.filter(d=>d.id!==documentId).map(d=>({id:d.id,name:d.title}));
  async function run(action:()=>Promise<unknown>){setBusy(true);setError('');try{await action();}catch(e){setError((e as Error).message);}finally{setBusy(false);}}
  return <section className="link-panel"><h3>문서·페이지 링크</h3>
    <div className="link-controls"><select aria-label="링크 종류" disabled={busy} value={kind} onChange={e=>{setKind(e.target.value);setTarget('');}}><option value="document">다른 문서</option><option value="page">이 문서의 페이지</option></select><select aria-label="링크 대상" disabled={busy} value={target} onChange={e=>setTarget(e.target.value)}><option value="">대상 선택</option>{target&&!options.some(item=>item.id===target)&&<option value={target}>대상 없음 또는 현재 위치</option>}{options.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
    {!options.length&&<p className="hint">{kind==='page'?'아래 페이지 탭에서 페이지를 추가하세요.':'다른 문서를 만든 뒤 연결하세요.'}</p>}
    {!!link&&!internal&&<p className="hint">기존 링크를 문서·페이지 링크로 바꿉니다.</p>}
    <div className="link-actions"><button disabled={busy||!options.some(item=>item.id===target)} onClick={()=>void run(()=>onApply(kind,target))}>링크 적용</button>{internal&&<button disabled={busy} onClick={()=>void run(onOpen)}>↗ 열기</button>}{!!link&&<button disabled={busy} onClick={()=>void run(()=>onApply('none',''))}>해제</button>}</div>
    {error&&<p className="error" role="alert">{error}</p>}
  </section>;
}
