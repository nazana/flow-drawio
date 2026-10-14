import type {Cell} from './model.ts';
import {useState} from 'react';
import Modal from './Modal.tsx';
import {sampleSvg,validateStyles,type Styles,type LineStyle} from '../public/flow-styles.js';
function Icon({name}:{name:'shape'|'line'|'locate'|'trash'|'close'|'check'|'settings'}){
  const paths={shape:'M6 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',line:'M3 17 21 7m-7 0h7v7',locate:'M12 2v4m0 12v4M2 12h4m12 0h4M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',trash:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',close:'m6 6 12 12M6 18 18 6',check:'m5 12 4 4L19 6',settings:'M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M10 15v6'};
  return <svg className="settings-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}
type LegendEntry={id:string;name:string;included:boolean;fillColor?:string;strokeColor?:string};
export default function StyleSettings({value,cells,interfaces,onSave,onClose,onSelect}:{value:Styles;cells:Cell[];interfaces:import('./model.ts').Interface[];onSave:(value:Styles,entries:LegendEntry[])=>Promise<unknown>;onClose:()=>void;onSelect:(id:string)=>void}) {
  const [draft,setDraft]=useState<Styles>(()=>structuredClone(value)),[error,setError]=useState(''),[saving,setSaving]=useState(false);
  const [initialEntries]=useState<LegendEntry[]>(()=>cells.filter(c=>!c.legend&&c.legendIncluded).map(c=>({id:c.id,name:c.legendName||'',included:true})));
  const [entries,setEntries]=useState(initialEntries);
  const dirty=JSON.stringify(draft)!==JSON.stringify(value)||JSON.stringify(entries)!==JSON.stringify(initialEntries);
  function change(kind:keyof Styles,patch:Partial<LineStyle>){setDraft(old=>({...old,[kind]:{...old[kind],nativeStyle:Object.keys(patch).every(key=>key==='name')?old[kind].nativeStyle:undefined,...patch}}));}
  function edit(id:string,patch:Partial<LegendEntry>){setEntries(old=>old.map(v=>v.id===id?{...v,...patch}:v));}
  return <Modal label="표현과 범례 설정" busy={saving} onClose={onClose}><form className="modal style-settings" onSubmit={async e=>{e.preventDefault();if(saving)return;setSaving(true);try{validateStyles(draft);await onSave(draft,entries);onClose();}catch(e){setError((e as Error).message);}finally{setSaving(false);}}}>
    <header className="settings-heading"><div><span className="settings-heading-icon"><Icon name="settings"/></span><h2>표현·범례 설정</h2></div><button className="icon-button" type="button" title="닫기 (Esc)" aria-label="설정 닫기" data-modal-close disabled={saving}><Icon name="close"/></button></header>
    <div className="settings-section-title"><h3>추가한 범례</h3><span className="settings-badge">{entries.filter(e=>e.included).length}개</span></div><p className="hint">원본과 모양·색을 공유합니다. 삭제해도 캔버스의 원본은 유지됩니다.</p>
    {!entries.some(e=>e.included)&&<p className="hint">캔버스에서 요소를 선택하고 ‘범례 설정에 추가’를 누르세요.</p>}
    <div className="settings-rows legend-rows">
    {entries.some(e=>e.included)&&<div className="legend-settings-row settings-column-head" aria-hidden="true"><span>요소</span><span>범례 이름</span><span>바탕색</span><span>선 색</span><span>원본</span><span>삭제</span></div>}
    {entries.filter(e=>e.included).map((entry,index)=>{const source=cells.find(c=>c.id===entry.id);return <fieldset className="legend-settings-row" key={entry.id} disabled={saving}>
      <span className="element-symbol" title={source?.edge?'연결선':'도형'} aria-label={source?.edge?'연결선':'도형'}><Icon name={source?.edge?'line':'shape'}/></span><input aria-label={`범례 항목 ${index+1} 이름`} required maxLength={80} value={entry.name} onChange={e=>edit(entry.id,{name:e.target.value})}/>
      {(['fillColor','strokeColor'] as const).map(key=>{const color=source?.[key];return <label className="inline-color" key={key} title={key==='fillColor'?'원본 바탕색':'원본 선 색'}><input type="color" disabled={key==='fillColor'&&source?.edge} aria-label={`범례 항목 ${index+1} ${key}`} value={entry[key]||(/^#[0-9a-f]{6}$/i.test(color||'')?color:'#ffffff')} onInput={e=>edit(entry.id,{[key]:e.currentTarget.value})}/></label>;})}
      <button className="icon-button" title="원본 선택 및 모양 수정" aria-label={`${entry.name} 원본 선택`} type="button" onClick={()=>{if(!dirty||window.confirm('수정한 내용을 버리고 원본으로 이동할까요?'))onSelect(entry.id);}}><Icon name="locate"/></button><button className="icon-button danger" title="범례에서 삭제" type="button" aria-label={`${entry.name} 범례 삭제`} onClick={()=>edit(entry.id,{included:false,name:''})}><Icon name="trash"/></button>
    </fieldset>;})}
    </div><div className="settings-section-title"><h3>I/F 종류별 표현</h3><span className="settings-badge auto">자동 범례</span></div><p className="hint">캔버스에서 사용한 I/F 종류는 범례에 자동 표시됩니다. 아래 스타일은 ‘문서 설정 따르기’인 선에 적용됩니다.</p>
    <div className="settings-rows if-rows">
    <div className="if-settings-row settings-column-head" aria-hidden="true"><span>종류</span><span>미리보기</span><span>범례 이름</span><span>선 모양</span><span>색</span><span>두께</span><span>시작</span><span>끝</span><span>편집</span></div>
    {(Object.keys(draft) as Array<keyof Styles>).map(kind=>{const s=draft[kind];return <fieldset className="if-settings-row" key={kind} disabled={saving}>
      <span className="row-kind kind-badge">{kind}</span><img className="line-sample" alt={`${kind} 선 미리보기`} src={`data:image/svg+xml,${encodeURIComponent(sampleSvg(s))}`}/>
      <input aria-label={`${kind} 스타일 이름`} title="I/F 종류의 범례 이름" required maxLength={80} value={s.name} onChange={e=>change(kind,{name:e.target.value})}/>
      <select aria-label={`${kind} 선 모양`} value={s.line} onChange={e=>{const line=e.target.value as LineStyle['line'];change(kind,{line,...(line==='double'?{start:'none',end:'none'}:{})});}}><option value="solid">실선</option><option value="dashed">파선</option><option value="dotted">점선</option><option value="double">이중선</option></select>
      <input aria-label={`${kind} 색 선택`} title="선 색" type="color" value={s.color} onInput={e=>change(kind,{color:e.currentTarget.value})}/>
      <input aria-label={`${kind} 선 두께`} title="선 두께" type="number" min={1} max={6} step={1} required value={s.width} onChange={e=>change(kind,{width:e.target.valueAsNumber})}/>
      {(['start','end'] as const).map(key=><select key={key} title={key==='start'?'시작 표시':'끝 표시'} aria-label={`${kind} ${key==='start'?'시작':'끝'} 표시`} disabled={s.line==='double'} value={s[key]} onChange={e=>change(kind,{[key]:e.target.value})}><option value="none">{key==='start'?'시작':'끝'} 없음</option><option value="block">채운 화살표</option><option value="open">열린 화살표</option><option value="oval">원</option></select>)}
      <button type="button" className="icon-button" title="원본 선의 스타일 패널 열기" aria-label={`${kind} 스타일 패널 열기`} disabled={!cells.some(c=>c.edge&&interfaces.some(i=>i.ifId===c.ifId&&i.kind===kind))} onClick={()=>{const cell=cells.find(c=>c.edge&&interfaces.some(i=>i.ifId===c.ifId&&i.kind===kind));if(cell&&(!dirty||window.confirm('미적용 변경을 버리고 원본으로 이동할까요?')))onSelect(cell.id);}}><Icon name="settings"/></button>
    </fieldset>;})}
    </div>{error&&<p className="error" role="alert">{error}</p>}<div className="modal-actions"><span className="settings-footnote">이중선은 화살표 없이 표시됩니다.</span><button disabled={saving} type="button" data-modal-close>취소</button><button disabled={saving} type="submit" className="primary"><Icon name="check"/>{saving?'적용 중…':'설정 적용'}</button></div>
  </form></Modal>;
}
