import {useEffect,useRef,useState} from 'react';
import {normalizeMetadata,type DocumentMetadata,channels,targetedIssues,validateCatalog,type VersionSummary,type Recovery,type Catalog,type Cell,type Document,type DocumentSummary,type Interface,type Snapshot,type System} from './model.ts';
import {editorUrl,parseEditorMessage,postEditorMessage} from './drawio.ts';
import {sampleXml,draftXml} from './sample.ts';
import SampleGallery from './SampleGallery.tsx';
import InterfaceTable from './InterfaceTable.tsx';
import StyleSettings from './StyleSettings.tsx';
import Modal from './Modal.tsx';
import ConnectionConflictDialog from './ConnectionConflictDialog.tsx';
import LegendPanel from './LegendPanel.tsx';
import ImportDialog from './ImportDialog.tsx';
import {parseLegacy,type Legacy} from './importModel.ts';
import {createPptx,downloadBlob,imageDataBlob} from './export.ts';
import LinkPanel from './LinkPanel.tsx';
import DocumentLibrary,{MetadataDialog} from './DocumentLibrary.tsx';

type Dialog = {kind:'system';index:number;value:System}|{kind:'interface';index:number;value:Interface;edge?:{id:string;pageId:string};applySystems?:boolean};
async function api<T>(path:string,method='GET',body?:unknown):Promise<T> {
  const response=await fetch(`/api/documents${path}`,{method,headers:body?{'Content-Type':'application/json'}:undefined,body:body?JSON.stringify(body):undefined});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'서버와 연결하지 못했습니다.');return data;
}
export default function App(){
  const [propertiesCollapsed,setPropertiesCollapsed]=useState(false);
  const [dark,setDark]=useState(false);
  useEffect(()=>{document.documentElement.dataset.theme=dark?'dark':'light';},[dark]);
  const frame=useRef<HTMLIFrameElement>(null),fileInput=useRef<HTMLInputElement>(null);
  const pending=useRef(new Map<string,{resolve:(s:Snapshot)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>());
  const loaded=useRef(false),baseline=useRef(''),loadingBaseline=useRef(true);
  const [documents,setDocuments]=useState<DocumentSummary[]>([]),[doc,setDoc]=useState<Document|null>(null);
  const [title,setTitle]=useState(''),[snapshot,setSnapshot]=useState<Snapshot|null>(null),[selection,setSelection]=useState<Cell[]>([]);
  const [init,setInit]=useState(false),[bridge,setBridge]=useState(false),[saving,setSaving]=useState(false);
  const [error,setError]=useState(''),[notice,setNotice]=useState(''),[tab,setTab]=useState<'selection'|'systems'|'interfaces'>('selection');
  const [dialog,setDialog]=useState<Dialog|null>(null),[draft,setDraft]=useState<Cell|null>(null);
  const importInput=useRef<HTMLInputElement>(null);
  const [importData,setImportData]=useState<Legacy|null>(null),[relationships,setRelationships]=useState(()=>{try{return localStorage.getItem('flow:relationships')!=='0';}catch{return true;}}),[exporting,setExporting]=useState(false);
  const exportPending=useRef<{id:string;resolve:(uri:string)=>void;reject:(error:Error)=>void;timer:ReturnType<typeof setTimeout>}|null>(null);
  const [styleSettings,setStyleSettings]=useState(false);
  const [navigationTarget,setNavigationTarget]=useState<string|null>(null),[navigating,setNavigating]=useState(false);
  const [metadata,setMetadata]=useState<DocumentMetadata>(()=>normalizeMetadata(undefined)),[metadataOpen,setMetadataOpen]=useState(false),[libraryOpen,setLibraryOpen]=useState(false);
  const [loadKey,setLoadKey]=useState(0),[versions,setVersions]=useState<VersionSummary[]|null>(null),[versionError,setVersionError]=useState('');
  const [noteOpen,setNoteOpen]=useState(false),[versionNote,setVersionNote]=useState('');
  const sessionId=useRef(crypto.randomUUID()),autoBusy=useRef(false),lastRecovery=useRef('');
  const adoptedRecovery=useRef<Recovery|null>(null);
  const [recoveries,setRecoveries]=useState<Recovery[]>([]),[recoveryOpen,setRecoveryOpen]=useState(false),[recoveryReady,setRecoveryReady]=useState(false);
  const [autoStatus,setAutoStatus]=useState(''),[recoveryIndex,setRecoveryIndex]=useState(0);

  const [applySystems,setApplySystems]=useState(false),[applying,setApplying]=useState(false);
  const [showTable,setShowTable]=useState(false),[newDocument,setNewDocument]=useState(false),[creating,setCreating]=useState(false);
  const tablePreference=useRef<boolean|null>(null),activeDocumentId=useRef('');
  function readTablePreference(id:string){try{const value=localStorage.getItem(`flow:if-table:${id}`);return value===null?null:value==='1';}catch{return null;}}
  function rememberTable(id:string,visible:boolean){try{localStorage.setItem(`flow:if-table:${id}`,visible?'1':'0');}catch{setNotice('이 브라우저에서는 화면 설정을 기억할 수 없습니다.');}}
  function toggleTable(){if(!doc)return;const next=!showTable;tablePreference.current=next;setShowTable(next);rememberTable(doc.id,next);}
  const [blocked,setBlocked]=useState<string[]>([]);
  const dirty=!!doc&&(title!==doc.title||JSON.stringify(metadata)!==JSON.stringify(doc.metadata)||!!snapshot&&snapshot.xml!==baseline.current);
  const active=selection.length===1?selection[0]:null;
  const catalog=snapshot?.catalog??{systems:[],interfaces:[]};
  const warnings=snapshot?targetedIssues(snapshot):[];
  function send(message:unknown){postEditorMessage(frame.current?.contentWindow,message);}
  function invoke(action:string,extra:Record<string,unknown>={}):Promise<Snapshot>{
    return new Promise((resolve,reject)=>{
      const requestId=crypto.randomUUID();
      const timer=setTimeout(()=>{pending.current.delete(requestId);reject(new Error('편집기 응답이 없습니다. 입력 내용을 보존하고 다시 시도하세요.'));},10000);
      pending.current.set(requestId,{resolve,reject,timer});send({action,requestId,...extra});
    });
  }
  useEffect(()=>{if(bridge)send({action:'flow:relationships',enabled:relationships});},[bridge,relationships,loadKey]);
  const openLinkedDocument=useRef<(id:string)=>void>(()=>{});
  openLinkedDocument.current=id=>{if(/^[a-zA-Z0-9-]{1,80}$/.test(id))void open(id);};
  function accept(document:Document){setLoadKey(old=>old+1);setVersions(null);setRecoveries([]);setRecoveryOpen(false);setRecoveryReady(false);setRecoveryIndex(0);setAutoStatus('');lastRecovery.current='';adoptedRecovery.current=null;activeDocumentId.current=document.id;tablePreference.current=readTablePreference(document.id);setShowTable(tablePreference.current??false);loaded.current=false;loadingBaseline.current=true;baseline.current='';setSnapshot(null);setSelection([]);setDoc(document);setTitle(document.title);setMetadata(document.metadata);setError('');setNotice('');}
  useEffect(()=>{
    let cancelled=false;
    api<DocumentSummary[]>('').then(async rows=>{if(cancelled)return;setDocuments(rows);if(rows[0]){const data=await api<Document>(`/${rows[0].id}`);if(!cancelled)accept(data);}else setNewDocument(true);}).catch(e=>!cancelled&&setError(e.message));
    return()=>{cancelled=true;};
  },[]);
  useEffect(()=>{
    const receive=(event:MessageEvent)=>{
      if(event.source!==frame.current?.contentWindow||event.origin!==window.location.origin)return;
      const m=parseEditorMessage(event.data);if(!m)return;
      if(m.event==='export'&&exportPending.current){let request;try{request=typeof m.message==='string'?JSON.parse(m.message):m.message;}catch{}if(request?.flowExportId===exportPending.current.id){const p=exportPending.current;clearTimeout(p.timer);exportPending.current=null;if(typeof m.data==='string'&&m.data.startsWith('data:image/'))p.resolve(m.data);else p.reject(new Error('이미지 출력에 실패했습니다.'));}}
      if(m.event==='init')setInit(true);
      if(m.event==='flow:theme'&&typeof m.dark==='boolean'){setDark(m.dark);if(!m.initial)try{localStorage.setItem('flow:dark',m.dark?'1':'0');}catch{}}
      if(m.event==='flow:ready'){setBridge(true);try{const saved=localStorage.getItem('flow:dark');if(saved!==null)send({action:'flow:theme',dark:saved==='1'});}catch{}}
      if(m.event==='load'){loaded.current=true;send({action:'flow:snapshot'});}
      if(m.event==='flow:blocked')setBlocked(old=>[...new Set([...old,String(m.uri)])]);
      if(m.event==='flow:openDocument'&&typeof m.id==='string')openLinkedDocument.current(m.id);
      if(m.event==='flow:notice')setNotice(String(m.message));
      if(m.event==='flow:selection'&&loaded.current && (m.cells.length || document.activeElement===frame.current)){setSelection(m.cells);}
      if(m.event==='flow:snapshot'&&loaded.current){
        const data=m as unknown as Snapshot;
        if(loadingBaseline.current){baseline.current=data.xml;loadingBaseline.current=false;if(tablePreference.current===null){const visible=data.catalog.interfaces.length>0;tablePreference.current=visible;setShowTable(visible);rememberTable(activeDocumentId.current,visible);}}
        setSnapshot(data);setSelection(previous=>data.cells.filter(c=>(data.selection.length||document.activeElement===frame.current?data.selection:previous.map(p=>p.id)).includes(c.id)));
        const p=pending.current.get(m.requestId);if(p){clearTimeout(p.timer);pending.current.delete(m.requestId);p.resolve(data);}
      }
      if(m.event==='flow:error'){
        setError(m.error);const p=pending.current.get(m.requestId);if(p){clearTimeout(p.timer);pending.current.delete(m.requestId);p.reject(new Error(m.error));}
      }
    };
    window.addEventListener('message',receive);
    const csp=(event:SecurityPolicyViolationEvent)=>setBlocked(old=>[...new Set([...old,event.blockedURI])]);
    window.addEventListener('securitypolicyviolation',csp);
    return()=>{window.removeEventListener('message',receive);window.removeEventListener('securitypolicyviolation',csp);};
  },[]);
  useEffect(()=>{
    if(!doc||!init||!bridge)return;
    loaded.current=false;loadingBaseline.current=true;
    send({action:'load',xml:doc.xml,title:doc.title,autosave:0,fit:1});
  },[doc?.id,loadKey,init,bridge]);
  useEffect(()=>{setDraft(active?{...active}:null);setApplySystems(false);},[active?.id,active?.label,active?.detail,active?.systemCode,active?.ifId,active?.styleMode]);
  useEffect(()=>{const before=(event:BeforeUnloadEvent)=>{if(dirty){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',before);return()=>window.removeEventListener('beforeunload',before);},[dirty]);
  useEffect(()=>{
    if(!doc)return;
    let cancelled=false;
    api<Recovery[]>(`/${doc.id}/recovery`).then(rows=>{
      if(cancelled)return;
      const available=rows.filter(row=>row.xml!==doc.xml||row.title!==doc.title||JSON.stringify(row.metadata)!==JSON.stringify(doc.metadata));
      setRecoveries(available);setRecoveryIndex(0);setRecoveryOpen(available.length>0);setRecoveryReady(true);
    }).catch(e=>{if(!cancelled)setAutoStatus(`복구본 확인 실패: ${e.message}`);});
    return()=>{cancelled=true;};
  },[doc?.id,loadKey]);
  const autoSave=useRef<()=>Promise<void>>(async()=>{});
  autoSave.current=async()=>{
    if(!doc||!snapshot||!loaded.current||(!dirty&&!lastRecovery.current)||saving||autoBusy.current||!recoveryReady||recoveryOpen)return;
    const currentDoc=doc,recoveryXml=dirty?snapshot.xml:doc.xml,key=JSON.stringify([title,recoveryXml,metadata]);
    if(key===lastRecovery.current)return;
    autoBusy.current=true;setAutoStatus('복구본 저장 중…');
    try{
      const result=await api<Recovery>(`/${currentDoc.id}/recovery`,'PUT',{sessionId:sessionId.current,title,xml:recoveryXml,metadata,baseRevision:currentDoc.revision});
      if(activeDocumentId.current===currentDoc.id){lastRecovery.current=dirty?key:'';setAutoStatus(`복구본 저장 ${new Date(result.updatedAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'})}`);}
    }catch(e){if(activeDocumentId.current===currentDoc.id)setAutoStatus(`자동저장 실패: ${(e as Error).message}`);}finally{autoBusy.current=false;}
  };
  useEffect(()=>{const timer=setInterval(()=>void autoSave.current(),60_000);return()=>clearInterval(timer);},[]);
  function restoreRecovery(){
    const recovery=recoveries[recoveryIndex];if(!recovery||!loaded.current)return;
    if(dirty&&!window.confirm('현재 편집 내용을 복구본으로 바꿀까요? 저장하지 않은 변경은 사라집니다.'))return;
    adoptedRecovery.current=recovery;setTitle(recovery.title);setMetadata(recovery.metadata);setRecoveryOpen(false);
    loaded.current=false;loadingBaseline.current=false;
    send({action:'load',xml:recovery.xml,title:recovery.title,autosave:0,fit:1});
    setNotice('복구본을 불러왔습니다. 확인 후 저장하세요.');
  }
  async function save(note=''){
    if(!doc||saving)return;setSaving(true);setError('');
    try{
      const data=await invoke('flow:snapshot');const saved=await api<Document>(`/${doc.id}`,'PUT',{title,metadata,xml:data.xml,revision:doc.revision,note,sessionId:sessionId.current,recoveredSessionId:adoptedRecovery.current?.sessionId,recoveredUpdatedAt:adoptedRecovery.current?.updatedAt});
      baseline.current=data.xml;lastRecovery.current='';adoptedRecovery.current=null;setAutoStatus('');setRecoveries([]);setDoc(saved);setMetadata(saved.metadata);setDocuments(await api<DocumentSummary[]>(''));setNoteOpen(false);setVersionNote('');setNotice(`v${saved.revision} 저장했습니다.`);return true;
    }catch(e){setError((e as Error).message);return false;}finally{setSaving(false);}
  }
  async function showVersions(){
    if(!doc)return;const id=doc.id;setVersionError('');
    try{const rows=await api<VersionSummary[]>(`/${id}/versions`);if(activeDocumentId.current===id)setVersions(rows);}catch(e){setError((e as Error).message);}
  }
  async function restoreVersion(revision:number){
    if(!doc||saving)return;
    if(!window.confirm(`v${revision}을 새 버전으로 복원할까요?${dirty?' 저장하지 않은 편집 내용은 대체됩니다.':''} 기존 저장 이력은 유지됩니다.`))return;
    setSaving(true);setVersionError('');
    try{
      const restored=await api<Document>(`/${doc.id}/versions/${revision}`,'POST',{revision:doc.revision,sessionId:sessionId.current});
      accept(restored);setDocuments(await api<DocumentSummary[]>(''));setNotice(`v${revision} 내용을 v${restored.revision}으로 복원했습니다.`);
    }catch(e){setVersionError((e as Error).message);}finally{setSaving(false);}
  }
  async function navigateDocument(id:string){
    setNavigating(true);try{const next=await api<Document>(`/${id}`);accept(next);setNavigationTarget(null);setLibraryOpen(false);}catch(e){setError(`연결 문서를 열 수 없습니다: ${(e as Error).message}`);}finally{setNavigating(false);}
  }
  async function open(id:string){if(saving||navigating)return;if(id===doc?.id){setLibraryOpen(false);return;}if(dirty){setNavigationTarget(id);return;}await navigateDocument(id);}
  async function create(xml=sampleXml(false),name='새 흐름',initialTable?:boolean,discardConfirmed=false){
    if(saving)return;
    if(dirty&&!discardConfirmed&&!window.confirm('저장하지 않은 변경을 버리고 새 문서를 열까요?'))return;
    try{const created=await api<Document>('','POST',{title:name,xml});if(initialTable!==undefined)rememberTable(created.id,initialTable);setDocuments(await api<DocumentSummary[]>(''));accept(created);return true;}catch(e){setError((e as Error).message);}
  }
  async function download(){try{const data=await invoke('flow:snapshot');const url=URL.createObjectURL(new Blob([data.xml],{type:'application/xml'}));const a=document.createElement('a');a.href=url;a.download=`${title||'흐름'}.drawio`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){setError((e as Error).message);}}
  async function exportPage(format:'png'|'svg'|'pptx'){
    if(exporting||!snapshot)return;setExporting(true);setError('');
    try{
      await invoke('flow:snapshot');
      const uri=await new Promise<string>((resolve,reject)=>{const id=crypto.randomUUID(),timer=setTimeout(()=>{exportPending.current=null;reject(new Error('출력 시간이 초과되었습니다. 그림 크기와 외부 이미지를 확인하세요.'));},60000);exportPending.current={id,resolve,reject,timer};send({action:'export',format:format==='svg'?'svg':'png',flowExportId:id,currentPage:true,theme:'light',scale:2,border:16,background:'#ffffff',embedImages:true,embedFonts:false});});
      const blob=format==='pptx'?await createPptx(uri):imageDataBlob(uri);
      if(format==='png'){const image=new Image();image.src=uri;await image.decode();if(image.width<2||image.height<2)throw new Error('출력할 그림이 없거나 이미지 변환에 실패했습니다.');}
      downloadBlob(blob,`${title||'흐름'}-${snapshot.pages?.find(p=>p.id===snapshot.pageId)?.name||'페이지'}.${format}`);setNotice(`현재 페이지를 ${format.toUpperCase()}로 출력했습니다.`);
    }catch(e){setError((e as Error).message);}finally{setExporting(false);}
  }
  async function applyCell(){
    if(!draft||!snapshot||applying)return;setApplying(true);
    try{
      if(draft.edge&&draft.ifId)await invoke('flow:interface',{pageId:snapshot.pageId,id:draft.id,ifId:draft.ifId,applySystems,patch:{label:draft.label,detail:draft.detail}});
      else await invoke('flow:cell',{pageId:snapshot.pageId,id:draft.id,patch:{label:draft.label,detail:draft.detail,systemCode:draft.systemCode,ifId:draft.ifId}});
      setNotice('속성을 적용했습니다. 실행 취소로 되돌릴 수 있습니다.');setError('');setApplySystems(false);
    }catch(e){setError((e as Error).message);}finally{setApplying(false);}
  }
  async function applyStyleMode(mode:'auto'|'custom'){if(!active||!snapshot)return;try{await invoke('flow:styleMode',{id:active.id,pageId:snapshot.pageId,mode});setError('');}catch(e){setError((e as Error).message);}}
  async function insertLegend(){try{await invoke('flow:legend');setError('');setNotice('범례를 선택했습니다. 이동·크기는 캔버스에서 조절하세요.');}catch(e){setError((e as Error).message);}}
  async function changeSystemDisplay(visible:boolean){try{await invoke('flow:view',{showSystems:visible});setError('');}catch(e){setError((e as Error).message);}}
  async function applyCatalog(next:Catalog){validateCatalog(next);await invoke('flow:catalog',{catalog:next});setError('');}
  async function submitDialog(event:React.FormEvent){
    event.preventDefault();if(!dialog||applying)return;setApplying(true);
    try{
      const next=structuredClone(catalog);
      if(dialog.kind==='system'){if(dialog.index<0)next.systems.push(dialog.value);else next.systems[dialog.index]=dialog.value;}
      else{if(dialog.index<0)next.interfaces.push(dialog.value);else next.interfaces[dialog.index]=dialog.value;}
      validateCatalog(next);
      if(dialog.kind==='interface'&&dialog.edge)await invoke('flow:interface',{...dialog.edge,ifId:dialog.value.ifId,definition:dialog.value,applySystems:!!dialog.applySystems});
      else await applyCatalog(next);
      setDialog(null);setError('');setNotice(dialog.kind==='interface'&&dialog.edge?'I/F를 만들고 선에 지정했습니다. 실행 취소 한 번으로 되돌릴 수 있습니다.':'정의를 적용했습니다.');
    }catch(e){setError((e as Error).message);}finally{setApplying(false);}
  }
  async function removeDefinition(kind:'systems'|'interfaces',index:number){try{const next=structuredClone(catalog);next[kind].splice(index,1);await applyCatalog(next);}catch(e){setError((e as Error).message);}}
  function selectConnection(id:string){send({action:'flow:select',id});setTab('selection');}
  function locateInterface(ifId:string){const cell=snapshot?.cells.find(c=>c.ifId===ifId);if(cell){send({action:'flow:locate',id:cell.id});setNotice('연결선 위치를 3초간 강조합니다.');}else setNotice('현재 페이지에 지정된 연결선이 없습니다.');}
  function locateSystem(code:string){const count=snapshot?.cells.filter(c=>!c.edge&&!c.legend&&c.systemCode===code).length||0;if(count){send({action:'flow:locate',systemCode:code});setNotice(`소속 노드 ${count}개를 3초간 강조합니다.`);}else setNotice('현재 페이지에 이 시스템에 속한 노드가 없습니다.');}
  function addSystem(){setDialog({kind:'system',index:-1,value:{code:'',name:'',parentCode:null}});}
  function addInterface(){setDialog({kind:'interface',index:-1,value:{ifId:'',name:'',kind:'TC',channel:'EAI',formatId:null,fromSystemCode:catalog.systems[0]?.code??'',toSystemCode:catalog.systems.at(-1)?.code??''}});}
  function addInterfaceForEdge(){
    if(!draft?.edge||!snapshot)return;
    const source=snapshot.cells.find(c=>c.id===draft.source),target=snapshot.cells.find(c=>c.id===draft.target);
    if(!source||!target){setError('선을 시작 도형과 끝 도형에 연결하세요.');return;}
    setError('');setDialog({kind:'interface',index:-1,edge:{id:draft.id,pageId:snapshot.pageId},applySystems:false,value:{ifId:'',name:'',kind:'TC',channel:'EAI',formatId:null,fromSystemCode:source.systemCode||'',toSystemCode:target.systemCode||''}});
  }
  function systemApplication(edge:Cell|undefined,def:Interface|undefined,checked:boolean,onChange:(value:boolean)=>void){
    if(!edge||!def)return null;
    const source=snapshot?.cells.find(c=>c.id===edge.source),target=snapshot?.cells.find(c=>c.id===edge.target);
    const mismatched=!!source?.systemCode&&source.systemCode!==def.fromSystemCode||!!target?.systemCode&&target.systemCode!==def.toSystemCode;
    return <div className="system-application"><label className="check-label"><input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)}/>송수신 정보를 도형의 소속에도 적용</label>
      <p>시작 도형: {source?(source.label||'이름 없는 도형'):'연결 없음'} · {source?.systemCode||'소속 없음'}{checked?` → ${def.fromSystemCode||'송신 선택 필요'}`:''}<br/>끝 도형: {target?(target.label||'이름 없는 도형'):'연결 없음'} · {target?.systemCode||'소속 없음'}{checked?` → ${def.toSystemCode||'수신 선택 필요'}`:''}</p>
      {mismatched&&!checked&&<p className="mismatch">도형 소속과 다릅니다. 송수신을 바꾸거나 위 옵션을 선택하세요.</p>}
      {checked&&<p>다른 연결선에도 영향이 있을 수 있습니다. 기존 I/F 정의는 유지하며 불일치는 경고합니다.</p>}
    </div>;
  }
  const field=(name:keyof Cell,value:string)=>setDraft(d=>d?{...d,[name]:value}:d);
  const options=catalog.systems.map(s=><option key={s.code} value={s.code}>{s.name} · {s.code}</option>);
  return <main>
    <header><div className="brand"><b>F</b><div><strong>Flow Studio</strong><small>시스템 · 인터페이스 설계</small></div></div>
      <div className="doc-controls"><button disabled={saving} onClick={async()=>{try{setDocuments(await api<DocumentSummary[]>(''));setLibraryOpen(true);}catch(e){setError((e as Error).message);}}}>문서 목록</button><select aria-label="문서 선택" disabled={saving} value={doc?.id??''} onChange={e=>void open(e.target.value)}>{documents.map(d=><option key={d.id} value={d.id}>{d.title}</option>)}</select><button disabled={saving} onClick={()=>setNewDocument(true)}>＋ 새 문서</button><input aria-label="문서 제목" value={title} maxLength={160} onChange={e=>setTitle(e.target.value)}/><span>{saving?'저장 중':dirty?'변경됨':'저장됨'}</span><button className="primary" disabled={!snapshot||saving} onClick={()=>void save()}>저장</button></div>
    </header>
    <div className="subbar"><div><button onClick={()=>fileInput.current?.click()}>파일 열기</button><button disabled={!snapshot||exporting} onClick={()=>importInput.current?.click()}>JSON 가져오기</button><input hidden type="file" accept=".json,application/json" ref={importInput} onChange={async e=>{const f=e.target.files?.[0];e.target.value='';if(!f)return;try{if(f.size>16000000)throw new Error('파일은 16MB 이하여야 합니다.');setImportData(parseLegacy(JSON.parse(await f.text())));}catch(e){setError((e as Error).message);}}}/><details className="export-menu"><summary>내보내기</summary><div><button disabled={!snapshot||exporting} onClick={()=>void download()}>.drawio 문서</button>{(['png','svg','pptx'] as const).map(format=><button key={format} disabled={!snapshot||exporting} onClick={()=>void exportPage(format)}>{format.toUpperCase()} · 현재 페이지{format==='pptx'?' (이미지)':''}</button>)}{exporting&&<small>출력 중…</small>}</div></details><button disabled={!snapshot} onClick={()=>send({action:'fit',maxScale:1,border:40})}>전체 보기</button><button disabled={!doc} aria-pressed={showTable} onClick={toggleTable}>I/F 목록</button><details className="view-menu"><summary>보기</summary><div><label className="check-label"><input type="checkbox" disabled={!bridge} checked={dark} onChange={e=>send({action:'flow:theme',dark:e.target.checked})}/>다크 모드</label><label className="check-label"><input type="checkbox" checked={relationships} onChange={e=>{setRelationships(e.target.checked);try{localStorage.setItem('flow:relationships',e.target.checked?'1':'0');}catch{}}}/>선택 항목의 연결 관계 강조</label><label className="check-label"><input type="checkbox" disabled={!snapshot} checked={snapshot?.showSystems??false} onChange={e=>void changeSystemDisplay(e.target.checked)}/>노드 시스템명 표시</label></div></details><button disabled={!doc||saving} onClick={()=>setMetadataOpen(true)}>문서 정보</button><button disabled={!snapshot||saving} onClick={()=>{setVersionNote('');setNoteOpen(true);}}>메모와 저장</button><button disabled={!snapshot||saving} onClick={()=>void showVersions()}>버전 이력</button><button disabled={!snapshot} onClick={()=>setStyleSettings(true)}>표현·범례 설정</button><button disabled={!snapshot} onClick={()=>void insertLegend()}>범례 넣기</button></div><span aria-live="polite">{notice||'도형을 연결하고, 시스템과 I/F 정보를 지정하세요.'}</span><input hidden ref={fileInput} type="file" accept=".drawio,.xml" onChange={async e=>{const f=e.target.files?.[0];if(f){if(f.size>16_000_000)setError('파일은 16MB 이하여야 합니다.');else await create(await f.text(),f.name.replace(/\.(drawio|xml)$/i,''));}e.target.value='';}}/></div>
    {error&&<div className="error" role="alert">{error}<button onClick={()=>setError('')}>닫기</button></div>}
    <section className={`layout${propertiesCollapsed?' properties-collapsed':''}`}><div className="canvas-column"><div className="editor"><iframe ref={frame} title="draw.io 편집기" src={editorUrl}/>{!snapshot&&<div className="loading">{doc?'편집기를 준비하고 있습니다…':'＋ 새 문서에서 초안을 선택하세요.'}</div>}</div>
        <InterfaceTable key={doc?.id} visible={showTable} onHide={toggleTable} rows={catalog.interfaces} cells={snapshot?.cells??[]} selection={selection} onSelect={selectConnection} onEdit={item=>setDialog({kind:'interface',index:catalog.interfaces.findIndex(i=>i.ifId===item.ifId),value:{...item}})}/>
      </div>
      <aside className="properties-panel"><button className="properties-toggle" type="button" aria-label={propertiesCollapsed?'속성 패널 펼치기':'속성 패널 접기'} title={propertiesCollapsed?'속성 패널 펼치기':'속성 패널 접기'} aria-expanded={!propertiesCollapsed} aria-controls="flow-properties" onClick={()=>setPropertiesCollapsed(value=>!value)}><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d={propertiesCollapsed?'M15 6l-6 6 6 6':'M9 6l6 6-6 6'}/></svg></button>{propertiesCollapsed&&<span className="properties-rail-label" aria-hidden="true">속성</span>}<div id="flow-properties" hidden={propertiesCollapsed}><nav className="tabs"><button className={tab==='selection'?'active':''} onClick={()=>setTab('selection')}>선택 속성</button><button className={tab==='systems'?'active':''} onClick={()=>setTab('systems')}>시스템 {catalog.systems.length}</button><button className={tab==='interfaces'?'active':''} onClick={()=>setTab('interfaces')}>I/F {catalog.interfaces.length}</button></nav>
        {tab==='selection'&&<><div className="panel-heading"><h2>{draft?(draft.legend?'범례':draft.edge?'연결선 속성':'도형 속성'):'선택 속성'}</h2><span>{selection.length>1?`${selection.length}개 선택`:active?.id??''}</span></div>{active&&!active.legend&&!active.legendIncluded&&!(active.edge&&catalog.interfaces.some(i=>i.ifId===active.ifId))&&snapshot&&<LegendPanel cell={active} onApply={async(included,name)=>{await invoke('flow:legendEntry',{included,name,id:active.id,pageId:snapshot.pageId});setNotice('범례 설정 목록에 추가했습니다. 표현·범례 설정에서 수정할 수 있습니다.');}}/>}{active&&!active.legend&&snapshot&&doc&&<LinkPanel cell={active} documents={documents} pages={snapshot.pages||[]} pageId={snapshot.pageId} documentId={doc.id} onApply={async(kind,target)=>{if(kind==='document')await api<Document>(`/${target}`);await invoke('flow:link',{id:active.id,pageId:snapshot.pageId,kind,target});setNotice(kind==='none'?'링크를 해제했습니다.':'링크를 적용했습니다. 그림과 함께 저장하세요.');}} onOpen={()=>invoke('flow:followLink',{id:active.id,pageId:snapshot.pageId})}/>}{draft?.legend?<div className="hint"><p>현재 페이지에서 범례에 포함하도록 지정한 도형·선을 표시합니다. 위치와 크기는 캔버스에서 조절할 수 있습니다.</p><button onClick={()=>setStyleSettings(true)}>표현·범례 설정</button><p>범례를 선택하고 Delete 키를 누르면 제거됩니다. 다시 넣을 수 있습니다.</p></div>:draft?<form key={`${snapshot?.pageId}:${draft.id}`} onSubmit={e=>{e.preventDefault();void applyCell();}}><label>표시 이름<input value={draft.label} onChange={e=>field('label',e.target.value)} maxLength={2000}/></label><label>설명<textarea rows={4} value={draft.detail} onChange={e=>field('detail',e.target.value)} maxLength={2000}/></label>{!draft.edge?<label>소속 시스템<select value={draft.systemCode} onChange={e=>field('systemCode',e.target.value)}><option value="">소속 없음</option>{options}</select></label>:<><div className="direction">{draft.source?(snapshot?.cells.find(c=>c.id===draft.source)?.label||'이름 없는 도형'):'시작점 연결 없음'} → {draft.target?(snapshot?.cells.find(c=>c.id===draft.target)?.label||'이름 없는 도형'):'도착점 연결 없음'}</div><label>연결 I/F<select value={draft.ifId} onChange={e=>{field('ifId',e.target.value);setApplySystems(false);}}><option value="">I/F 미지정</option>{catalog.interfaces.map(i=><option key={i.ifId} value={i.ifId}>{i.ifId} · {i.name}</option>)}</select></label>{active?.ifId&&<><div className="system-application"><button type="button" onClick={()=>send({action:'flow:select',id:active.id,openStyle:true})}>이 선 스타일 편집</button><button type="button" onClick={async()=>{try{await invoke('flow:publishStyle',{id:active.id,pageId:snapshot?.pageId});setNotice('같은 I/F 종류의 스타일과 범례에 적용했습니다.');}catch(e){setError((e as Error).message);}}}>현재 스타일을 같은 I/F 종류에 적용</button><p className="hint">기본 스타일 패널에서 수정하면 이 선만 바뀝니다. 종류에 적용하면 문서 설정을 따르는 선들도 갱신됩니다.</p></div><label>선 표현<select aria-label="선 표현 방식" value={active.styleMode??'custom'} onChange={e=>void applyStyleMode(e.target.value as 'auto'|'custom')}><option value="auto">문서 설정 따르기</option><option value="custom">개별 모양 유지</option></select><small className="hint">직접 선 모양을 바꾸면 개별 모양으로 전환됩니다. 기존 선은 ‘문서 설정 따르기’를 선택해 적용하세요.</small></label></>}{systemApplication(draft,catalog.interfaces.find(i=>i.ifId===draft.ifId),applySystems,setApplySystems)}<button type="button" className="wide" disabled={applying} onClick={addInterfaceForEdge}>새 I/F 만들기</button>{draft.ifId&&<p className="hint">{catalog.interfaces.find(i=>i.ifId===draft.ifId)?.fromSystemCode} → {catalog.interfaces.find(i=>i.ifId===draft.ifId)?.toSystemCode}</p>}</>}<button className="primary wide" disabled={applying} type="submit">{applying?'적용 중…':'속성 적용'}</button><p className="hint">적용한 속성은 그림과 함께 저장됩니다.</p></form>:<div className="empty"><span>◇</span><h3>{selection.length>1?'여러 항목 선택됨':'도형 또는 연결선을 선택하세요'}</h3><p>도형은 소속 시스템을,<br/>연결선은 I/F 정의를 지정할 수 있습니다.</p></div>}</>}

        {tab==='systems'&&<><div className="panel-heading"><h2>시스템 정의</h2><button disabled={!snapshot} onClick={addSystem}>＋ 추가</button></div>{catalog.systems.map((s,i)=><article className="definition definition-locate" key={s.code} tabIndex={0} aria-label={`${s.name} 소속 노드 찾기`} onClick={e=>{if(!(e.target as HTMLElement).closest('button'))locateSystem(s.code);}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();locateSystem(s.code);}}}><strong>{s.name}</strong><code>{s.code}</code>{s.parentCode&&<small>상위: {s.parentCode}</small>}<div><button onClick={()=>setDialog({kind:'system',index:i,value:{...s}})}>수정</button><button onClick={()=>void removeDefinition('systems',i)}>삭제</button><button onClick={()=>locateSystem(s.code)}>노드 찾기</button></div></article>)}{!catalog.systems.length&&<p className="hint">ERP, MES 등 연계할 시스템을 추가하세요.</p>}</>}
        {tab==='interfaces'&&<><div className="panel-heading"><h2>I/F 정의</h2><button disabled={!snapshot||!catalog.systems.length} onClick={addInterface}>＋ 추가</button></div>{catalog.interfaces.map((i,index)=><article className="definition definition-locate" key={i.ifId} tabIndex={0} aria-label={`${i.name} 연결선 위치 찾기`} onClick={e=>{if(!(e.target as HTMLElement).closest('button'))locateInterface(i.ifId);}} onKeyDown={e=>{if(e.target===e.currentTarget&&(e.key==='Enter'||e.key===' ')){e.preventDefault();locateInterface(i.ifId);}}}><div className="section-title"><strong>{i.name}</strong><span className="badge">{i.kind}</span></div><code>{i.ifId}</code><small>{i.fromSystemCode} → {i.toSystemCode} · {i.channel}</small>{i.formatId&&<small>포맷: {i.formatId}</small>}<div><button onClick={()=>setDialog({kind:'interface',index,value:{...i}})}>수정</button><button onClick={()=>void removeDefinition('interfaces',index)}>삭제</button><button onClick={()=>locateInterface(i.ifId)}>연결선 찾기</button></div></article>)}{!catalog.interfaces.length&&<p className="hint">시스템을 등록한 뒤 I/F 정의를 추가하세요.</p>}</>}
        {warnings.length>0&&<div className="warnings"><strong>연결 확인 {warnings.length}건</strong>{warnings.map((w,i)=><button key={i} onClick={()=>selectConnection(w.id)} title="해당 도형·선으로 이동">↗ {w.message}</button>)}<small>작성 중인 상태도 저장할 수 있습니다.</small></div>}
      </div></aside></section>
    <div className="recovery-status" role="status"><span>{autoStatus||'변경 내용은 1분마다 복구본으로 저장됩니다.'}</span>{recoveries.length>0&&<button onClick={()=>setRecoveryOpen(true)}>복구본 {recoveries.length}개</button>}</div>
    <footer><span>{snapshot?`${snapshot.cells.filter(c=>!c.edge&&!c.legend).length} 도형 · ${snapshot.cells.filter(c=>c.edge).length} 연결선`:'편집기 연결 중'}</span><span>{blocked.length?`외부 리소스 차단 ${blocked.length}건`:'자체 호스팅 · 외부 연결 제한'} · draw.io 31.4.6</span></footer>
    {snapshot&&<ConnectionConflictDialog key={doc?.id} snapshot={snapshot} enabled={!importData&&!navigationTarget&&!styleSettings&&!dialog&&!newDocument&&!recoveryOpen&&!noteOpen&&!versions&&!metadataOpen&&!libraryOpen&&!metadataOpen&&!libraryOpen} onResolve={async(conflict,mode)=>{await invoke('flow:resolveConnection',{id:conflict.id,pageId:snapshot.pageId,expected:conflict,mode});setNotice('선택한 방식으로 연결 정보를 변경했습니다.');}}/>}
    {importData&&snapshot&&<ImportDialog data={importData} catalog={catalog} onClose={()=>setImportData(null)} onApply={async result=>{await invoke('flow:import',{...result,pageId:snapshot.pageId});setNotice('선택 항목을 가져왔습니다. 실행 취소 한 번으로 되돌릴 수 있습니다.');}}/>}
    {styleSettings&&snapshot&&<StyleSettings value={snapshot.styles} cells={snapshot.cells} interfaces={catalog.interfaces} onSelect={id=>{send({action:'flow:select',id,openStyle:true});setTab('selection');setStyleSettings(false);}} onClose={()=>setStyleSettings(false)} onSave={async (styles,entries)=>{await invoke('flow:styles',{styles,entries,pageId:snapshot.pageId});setNotice('표현 설정을 적용했습니다. 그림과 함께 저장하세요.');}}/>}
    {recoveryOpen&&snapshot&&!styleSettings&&!dialog&&!newDocument&&!noteOpen&&!versions&&!metadataOpen&&!libraryOpen&&<Modal label="자동저장 복구" onClose={()=>setRecoveryOpen(false)}><section className="modal connection-modal">
      <h2>자동저장 복구본이 있습니다</h2>
      <p className="hint">수동 저장본은 그대로 유지됩니다. 복원할 내용을 선택하세요.</p>
      <label>복구본<select value={recoveryIndex} onChange={e=>setRecoveryIndex(Number(e.target.value))}>{recoveries.map((item,index)=><option key={item.sessionId} value={index}>{new Date(item.updatedAt).toLocaleString('ko-KR')} · {item.title}</option>)}</select></label>
      {recoveries[recoveryIndex]?.baseRevision!==doc?.revision&&<p className="hint">이 복구본 이후 수동 저장된 내용이 있습니다. 복원 후 저장하면 현재 저장본을 대체합니다.</p>}
      <div className="modal-actions"><button data-modal-close>{dirty?'현재 내용 유지':'저장본 열기'}</button><button className="primary" onClick={restoreRecovery}>복구본 복원</button></div>
    </section></Modal>}
    {libraryOpen&&<DocumentLibrary documents={documents} currentId={doc?.id} onOpen={open} onClose={()=>setLibraryOpen(false)}/>}
    {metadataOpen&&<MetadataDialog value={metadata} tags={[...new Set(documents.flatMap(d=>d.metadata.tags))].sort()} onClose={()=>setMetadataOpen(false)} onApply={value=>{setMetadata(value);setMetadataOpen(false);setNotice('문서 정보를 적용했습니다. 저장하면 반영됩니다.');}}/>}
    {navigationTarget&&<Modal label="다른 문서 열기" busy={saving||navigating} onClose={()=>setNavigationTarget(null)}><section className="modal connection-modal"><h2>변경 내용을 저장할까요?</h2><p className="hint">다른 문서를 열기 전에 현재 작업을 저장할 수 있습니다.</p>{error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><button disabled={saving||navigating} data-modal-close>취소</button><button disabled={saving||navigating} onClick={()=>void navigateDocument(navigationTarget)}>저장 없이 열기</button><button className="primary" disabled={saving||navigating} onClick={async()=>{const id=navigationTarget;if(await save())await navigateDocument(id);}}>저장 후 열기</button></div></section></Modal>}
    {noteOpen&&<Modal label="메모와 버전 저장" busy={saving} onClose={()=>setNoteOpen(false)}><form className="modal connection-modal" onSubmit={e=>{e.preventDefault();void save(versionNote);}}>
      <h2>메모와 저장</h2><label>변경 메모<textarea autoFocus rows={3} maxLength={500} value={versionNote} onChange={e=>setVersionNote(e.target.value)} placeholder="무엇을 변경했나요? (선택)"/></label>
      {error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" disabled={saving} data-modal-close>취소</button><button className="primary" disabled={saving}>버전 저장</button></div>
    </form></Modal>}
    {versions&&<Modal label="버전 이력" busy={saving} onClose={()=>setVersions(null)}><section className="modal version-history">
      <h2>버전 이력</h2><p className="hint">복원하면 새 버전으로 저장됩니다. 기존 이력은 유지됩니다.</p>
      <div className="version-list">{versions.map(version=><article key={version.revision}><div><strong>v{version.revision}{version.revision===doc?.revision?' · 현재':''}</strong><time>{new Date(version.createdAt).toLocaleString('ko-KR')}</time><p>{version.note||'일반 저장'}</p><small>{version.title}</small></div><button disabled={saving||version.revision===doc?.revision} onClick={()=>void restoreVersion(version.revision)} aria-label={`v${version.revision} 복원`}>복원</button></article>)}</div>
      {versionError&&<p className="error" role="alert">{versionError}</p>}<div className="modal-actions"><button disabled={saving} data-modal-close>닫기</button></div>
    </section></Modal>}
    {newDocument&&<SampleGallery busy={creating||saving} dirty={dirty} error={error} onClose={()=>setNewDocument(false)} onCreate={async(sample,name,saveFirst)=>{
      if(creating||saving)return;setCreating(true);setError('');
      try{if(saveFirst&&!await save())return;if(await create(sample?draftXml(sample):sampleXml(false),name,sample?.showTable??false,true))setNewDocument(false);}finally{setCreating(false);}
    }}/>}
    {dialog&&<Modal label={dialog.kind==='system'?'시스템 정의 편집':'I/F 정의 편집'} busy={applying} onClose={()=>{setDialog(null);setError('');}}><form className="modal"  onSubmit={submitDialog}><h2>{dialog.kind==='system'?'시스템':'I/F'} {dialog.index<0?'추가':'수정'}</h2>{dialog.kind==='interface'&&dialog.edge&&<p className="hint">만들면 선택한 선에 바로 지정됩니다. 노드 소속이 없어도 송수신을 직접 선택할 수 있습니다.</p>}{dialog.kind==='system'?<><label>시스템 코드<input required maxLength={160} disabled={dialog.index>=0} value={dialog.value.code} onChange={e=>setDialog({...dialog,value:{...dialog.value,code:e.target.value}})}/></label><label>시스템 이름<input required maxLength={160} value={dialog.value.name} onChange={e=>setDialog({...dialog,value:{...dialog.value,name:e.target.value}})}/></label><label>상위 시스템<select value={dialog.value.parentCode??''} onChange={e=>setDialog({...dialog,value:{...dialog.value,parentCode:e.target.value||null}})}><option value="">없음</option>{catalog.systems.filter(s=>s.code!==dialog.value.code).map(s=><option key={s.code} value={s.code}>{s.name}</option>)}</select></label></>:<><label>I/F 코드<input required maxLength={160} disabled={dialog.index>=0} value={dialog.value.ifId} onChange={e=>setDialog({...dialog,value:{...dialog.value,ifId:e.target.value}})}/></label><label>이름<input required maxLength={160} value={dialog.value.name} onChange={e=>setDialog({...dialog,value:{...dialog.value,name:e.target.value}})}/></label><label>처리 종류<select value={dialog.value.kind} onChange={e=>{const kind=e.target.value as Interface['kind'];setDialog({...dialog,value:{...dialog.value,kind,channel:channels[kind]}});}}>{Object.entries(channels).map(([kind,channel])=><option key={kind} value={kind}>{kind} · {channel}</option>)}</select></label><label>포맷 ID<input maxLength={160} value={dialog.value.formatId??''} onChange={e=>setDialog({...dialog,value:{...dialog.value,formatId:e.target.value||null}})}/></label><label>송신 시스템<select required value={dialog.value.fromSystemCode} onChange={e=>setDialog({...dialog,value:{...dialog.value,fromSystemCode:e.target.value}})}><option value="">송신 시스템 선택</option>{options}</select></label><label>수신 시스템<select required value={dialog.value.toSystemCode} onChange={e=>setDialog({...dialog,value:{...dialog.value,toSystemCode:e.target.value}})}><option value="">수신 시스템 선택</option>{options}</select></label></>}{dialog.kind==='interface'&&dialog.edge&&systemApplication(snapshot?.cells.find(c=>c.id===dialog.edge?.id),dialog.value,!!dialog.applySystems,value=>setDialog({...dialog,applySystems:value}))}{dialog.kind==='interface'&&!catalog.systems.length&&<p className="hint">등록된 시스템이 없습니다. 취소 후 오른쪽 시스템 탭에서 시스템을 먼저 추가하세요.</p>}{error&&<p className="error">{error}</p>}<div className="modal-actions"><button type="button" disabled={applying} data-modal-close>취소</button><button className="primary" disabled={applying} type="submit">{applying?'적용 중…':dialog.kind==='interface'&&dialog.edge?'만들고 선에 지정':'적용'}</button></div></form></Modal>}
  </main>;
}
