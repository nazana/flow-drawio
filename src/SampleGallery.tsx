import {useId,useState} from 'react';
import Modal from './Modal.tsx';
import {samples,type Sample} from './sample.ts';

export function SamplePreview({sample}:{sample:Sample}){
  const marker=useId().replaceAll(':','');
  const width=Math.max(...sample.nodes.map(n=>n.x+n.w))+40;
  return <svg viewBox={`0 0 ${width} 410`} role="img" aria-label={`${sample.name} 초안 미리보기`} className="sample-diagram">
    <defs><marker id={marker} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"/></marker></defs>
    {sample.nodes.filter(n=>n.shape==='zone').map(n=><g key={n.id}><rect x={n.x} y={n.y} width={n.w} height={n.h} className="sample-zone"/><text x={n.x+14} y={n.y+26} fontSize="16">{n.label}</text></g>)}
    {sample.edges.map((e,i)=>{
      const a=sample.nodes.find(n=>n.id===e.from)!,b=sample.nodes.find(n=>n.id===e.to)!;
      const dx=b.x-a.x,dy=b.y-a.y;
      const vertical=e.at===undefined&&Math.abs(dy)>Math.abs(dx);
      const x1=e.at!==undefined?a.x+a.w/2:vertical?a.x+a.w/2:a.x+(dx>=0?a.w:0),x2=e.at!==undefined?b.x+b.w/2:vertical?b.x+b.w/2:b.x+(dx>=0?0:b.w);
      const y1=e.at!==undefined?a.y+a.h*e.at:vertical?a.y+(dy>=0?a.h:0):a.y+a.h/2,y2=e.at!==undefined?b.y+b.h*e.at:vertical?b.y+(dy>=0?0:b.h):b.y+b.h/2;
      const path=e.at!==undefined?`M${x1} ${y1}H${x2}`:vertical?`M${x1} ${y1}V${(y1+y2)/2}H${x2}V${y2}`:`M${x1} ${y1}H${(x1+x2)/2}V${y2}H${x2}`;
      return <g key={i} className={e.ifId?'sample-if-edge':'sample-edge'}><path d={path} fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray={e.dashed?'6 4':undefined} markerEnd={`url(#${marker})`}/><text x={(x1+x2)/2} y={(y1+y2)/2-10} textAnchor="middle" fontSize="12" className="sample-edge-label">{e.label}</text></g>;
    })}
    {sample.nodes.filter(n=>n.shape!=='zone').map(n=><g key={n.id} className={n.accent?'sample-node sample-accent':'sample-node'}>
      {n.shape==='lifeline'?<><rect x={n.x} y={n.y} width={n.w} height={64}/><line x1={n.x+n.w/2} y1={n.y+64} x2={n.x+n.w/2} y2={n.y+n.h} stroke="currentColor" strokeDasharray="5 5"/></>:n.shape==='line'?<line x1={n.x} y1={n.y} x2={n.x} y2={n.y+n.h} stroke="currentColor" strokeDasharray="5 5"/>:n.shape==='diamond'?<polygon points={`${n.x+n.w/2},${n.y} ${n.x+n.w},${n.y+n.h/2} ${n.x+n.w/2},${n.y+n.h} ${n.x},${n.y+n.h/2}`}/>:n.shape==='ellipse'?<ellipse cx={n.x+n.w/2} cy={n.y+n.h/2} rx={n.w/2} ry={n.h/2}/>:<rect x={n.x} y={n.y} width={n.w} height={n.h}/>}
      <text x={n.x+n.w/2} y={n.y+(n.shape==='lifeline'?32:n.h/2)-(n.label.split('\n').length-1)*11+5} textAnchor="middle" fontSize="16">{n.label.split('\n').map((line,i)=><tspan key={i} x={n.x+n.w/2} dy={i?22:0}>{line}</tspan>)}</text>
    </g>)}
  </svg>;
}
export default function SampleGallery({busy,dirty,error,onClose,onCreate}:{busy:boolean;dirty:boolean;error:string;onClose:()=>void;onCreate:(sample:Sample|null,title:string,saveFirst:boolean)=>Promise<void>}){
  const [selected,setSelected]=useState<Sample|null>(samples[0]),[title,setTitle]=useState(samples[0].title),[expanded,setExpanded]=useState(false),[confirm,setConfirm]=useState(false);
  function choose(sample:Sample|null){setSelected(sample);setTitle(sample?.title??'새 그림');setExpanded(false);setConfirm(false);}
  async function submit(saveFirst=false){if(busy||!title.trim())return;if(dirty&&!confirm){setConfirm(true);return;}await onCreate(selected,title.trim(),saveFirst);}
  return <Modal label="새 문서 만들기" busy={busy} confirmChanges={false} onClose={onClose}><form className="sample-gallery" onSubmit={e=>{e.preventDefault();void submit();}}>
    <div className="gallery-heading"><div><h2>새 문서</h2><p>샘플을 골라 편집 가능한 초안으로 시작하세요.</p></div><div><button type="button" disabled={busy} onClick={()=>choose(null)}>＋ 빈 문서</button><button type="button" aria-label="닫기" disabled={busy} data-modal-close>×</button></div></div>
    <div className={`gallery-body${expanded?' gallery-expanded':''}`}>
      <div className="sample-grid" aria-label="샘플 목록">{samples.map(sample=><button type="button" key={sample.id} disabled={busy} aria-pressed={selected?.id===sample.id} onClick={()=>choose(sample)}><SamplePreview sample={sample}/><strong>{sample.name}</strong><span>{sample.description}</span></button>)}</div>
      <section className="sample-detail" aria-label="선택한 초안"><div className="sample-detail-heading"><h3>{selected?.title??'빈 문서'}</h3>{selected&&<button type="button" onClick={()=>setExpanded(!expanded)} aria-label={expanded?'미리보기 축소':'미리보기 확대'} title={expanded?'축소':'확대'}>{expanded?'↙':'⛶'}</button>}</div><div className="sample-preview">{selected?<SamplePreview sample={selected}/>:<p>빈 캔버스에서 자유롭게 시작합니다.</p>}</div><p className="sample-count">{selected?`시스템 ${selected.catalog.systems.length} · I/F ${selected.catalog.interfaces.length} · 모든 요소 편집 가능`:'도형과 시스템·I/F를 언제든 추가할 수 있습니다.'}</p><label>문서 제목<input required maxLength={160} value={title} disabled={busy} onChange={e=>{setTitle(e.target.value);setConfirm(false);}}/></label>
      </section>
    </div>
    {error&&<p className="error" role="alert">{error}</p>}
    <div className="gallery-actions">{confirm?<><strong>현재 변경 내용을 저장할까요?</strong><button type="button" disabled={busy} onClick={()=>setConfirm(false)}>취소</button><button type="button" disabled={busy} onClick={()=>void submit(false)}>저장 없이 시작</button><button type="button" className="primary" disabled={busy} onClick={()=>void submit(true)}>저장 후 시작</button></>:<><span>선택한 샘플은 새 문서로 복사됩니다.</span><button className="primary" disabled={busy||!title.trim()} type="submit">{busy?'생성 중…':selected?'이 초안으로 시작':'빈 문서 만들기'}</button></>}</div>
  </form></Modal>;
}
