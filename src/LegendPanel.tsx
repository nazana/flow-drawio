import {useEffect,useState} from 'react';
import type {Cell} from './model.ts';
export default function LegendPanel({cell,onApply}:{cell:Cell;onApply:(included:boolean,name:string)=>Promise<unknown>}){
  const [name,setName]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setName(cell.legendName||'');setError('');},[cell.id,cell.legendName]);
  return <section className="element-panel"><h3>범례 설정에 추가</h3><label>범례 이름<input aria-label="범례 이름" value={name} maxLength={80} placeholder="예: 수정 대상" disabled={busy} onChange={e=>setName(e.target.value)}/></label><button type="button" className="wide" disabled={busy||!name.trim()} onClick={async()=>{setBusy(true);setError('');try{await onApply(true,name);}catch(e){setError((e as Error).message);}finally{setBusy(false);}}}>범례 설정에 추가</button><p className="hint">선택한 모양을 표현·범례 설정 목록에 추가합니다.</p>{error&&<p className="error" role="alert">{error}</p>}</section>;
}
