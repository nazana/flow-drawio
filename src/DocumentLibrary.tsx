import {useState} from 'react';
import Modal from './Modal.tsx';
import {documentStatuses,normalizeMetadata,type DocumentMetadata,type DocumentSummary} from './model.ts';

export function MetadataDialog({value,tags,onApply,onClose}:{value:DocumentMetadata;tags:string[];onApply:(value:DocumentMetadata)=>void;onClose:()=>void}){
  const [draft,setDraft]=useState(value),[tag,setTag]=useState(''),[error,setError]=useState('');
  function withTag(){return normalizeMetadata({...draft,tags:tag.trim()?[...draft.tags,tag.trim()]:draft.tags});}
  function add(){try{setDraft(withTag());setTag('');setError('');}catch(e){setError((e as Error).message);}}
  return <Modal label="문서 정보" onClose={onClose}><form className="modal connection-modal" onSubmit={e=>{e.preventDefault();try{onApply(withTag());}catch(e){setError((e as Error).message);}}}>
    <input type="hidden" value={JSON.stringify(draft.tags)}/><h2>문서 정보</h2><label>설명<textarea rows={3} maxLength={2000} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
    <label>상태<select value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as DocumentMetadata['status']})}>{Object.entries(documentStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
    <label htmlFor="document-tag">태그</label><div className="tag-entry"><input id="document-tag" list="document-tag-options" value={tag} maxLength={40} placeholder="태그 입력 또는 선택" onChange={e=>setTag(e.target.value)} onKeyDown={e=>{if(e.key==='Enter'&&!e.nativeEvent.isComposing){e.preventDefault();add();}}}/><button type="button" onClick={add}>추가</button></div>
    <datalist id="document-tag-options">{tags.filter(item=>!draft.tags.includes(item)).map(item=><option key={item} value={item}/>)}</datalist>
    <div className="document-tags">{draft.tags.map(item=><button key={item} type="button" aria-label={`${item} 태그 제거`} onClick={()=>setDraft({...draft,tags:draft.tags.filter(t=>t!==item)})}>{item} <span aria-hidden="true">×</span></button>)}</div>
    {error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><span className="hint">문서 저장 시 함께 반영됩니다.</span><button type="button" data-modal-close>취소</button><button className="primary">적용</button></div>
  </form></Modal>;
}
export default function DocumentLibrary({documents,currentId,onOpen,onClose}:{documents:DocumentSummary[];currentId?:string;onOpen:(id:string)=>Promise<void>;onClose:()=>void}){
  const [query,setQuery]=useState(''),[status,setStatus]=useState(''),[tag,setTag]=useState(''),[busy,setBusy]=useState(false);
  const tags=[...new Set(documents.flatMap(doc=>doc.metadata.tags))].sort((a,b)=>a.localeCompare(b,'ko'));
  const needle=query.trim().toLocaleLowerCase();
  const rows=documents.filter(doc=>(!status||doc.metadata.status===status)&&(!tag||doc.metadata.tags.includes(tag))&&[doc.title,doc.metadata.description,...doc.metadata.tags].join(' ').toLocaleLowerCase().includes(needle));
  return <Modal label="문서 목록" busy={busy} confirmChanges={false} onClose={onClose}><section className="modal document-library">
    <h2>문서 목록 <small>{rows.length} / {documents.length}</small></h2>
    <div className="document-filters"><input autoFocus type="search" aria-label="문서 검색" placeholder="제목·설명·태그 검색" value={query} onChange={e=>setQuery(e.target.value)}/><select aria-label="상태 필터" value={status} onChange={e=>setStatus(e.target.value)}><option value="">모든 상태</option>{Object.entries(documentStatuses).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select><select aria-label="태그 필터" value={tag} onChange={e=>setTag(e.target.value)}><option value="">모든 태그</option>{tags.map(item=><option key={item}>{item}</option>)}</select></div>
    <div className="document-results"><table className="document-table"><thead><tr><th>문서</th><th>태그</th><th>상태</th><th>수정일</th><th><span className="sr-only">열기</span></th></tr></thead><tbody>{rows.map(doc=><tr key={doc.id} aria-current={doc.id===currentId?'true':undefined}>
      <td><div className="document-title"><span title={`${doc.title}${doc.metadata.description?` — ${doc.metadata.description}`:''}`}>{doc.title}</span>{doc.id===currentId&&<small>현재</small>}</div></td>
      <td><div className="document-row-tags" title={doc.metadata.tags.join(', ')}>{doc.metadata.tags.slice(0,2).map(item=><span key={item}>#{item}</span>)}{doc.metadata.tags.length>2&&<small>+{doc.metadata.tags.length-2}</small>}</div></td>
      <td><span className="document-state">{documentStatuses[doc.metadata.status]}</span></td>
      <td><time title={new Date(doc.updatedAt).toLocaleString('ko-KR')}>{new Date(doc.updatedAt).toLocaleDateString('ko-KR',{year:'numeric',month:'2-digit',day:'2-digit'})}</time></td>
      <td><button disabled={busy} aria-label={`${doc.title} ${doc.id===currentId?'돌아가기':'열기'}`} onClick={async()=>{setBusy(true);try{await onOpen(doc.id);}finally{setBusy(false);}}}>{doc.id===currentId?'돌아가기':'열기'}</button></td>
    </tr>)}</tbody></table>{!rows.length&&<p className="hint">조건에 맞는 문서가 없습니다.</p>}</div>
    <div className="modal-actions"><button disabled={busy} data-modal-close>닫기</button></div>
  </section></Modal>;
}
