// Shared by the editor bridge and React settings. No editor engine changes.
export const defaultStyles = {
  TC:{name:'TC · EAI',line:'solid',color:'#475569',width:2,start:'none',end:'block'},
  EVENT:{name:'EVENT · KAFKA',line:'dashed',color:'#2563eb',width:2,start:'none',end:'block'},
  API:{name:'API · API_SYNC',line:'double',color:'#7c3aed',width:2,start:'none',end:'none'}
};
export function validateStyles(styles) {
  if (!styles || typeof styles !== 'object' || Object.keys(styles).length!==3 || Object.keys(styles).some(k=>!Object.hasOwn(defaultStyles,k))) throw new Error('표현 설정을 확인하세요.');
  for (const kind of Object.keys(defaultStyles)) {
    const s=styles[kind];
    if(s?.nativeStyle!==undefined&&(typeof s.nativeStyle!=='object'||s.nativeStyle===null||Array.isArray(s.nativeStyle)||Object.keys(s.nativeStyle).length>50||Object.entries(s.nativeStyle).some(([k,v])=>!nativeStyleKeys.includes(k)||typeof v!=='string'||v.length>200||v.includes(';'))))throw new Error('I/F 스타일 값을 확인하세요.');
    if (!s || typeof s.name!=='string' || !s.name.trim() || s.name.length>80 || !['solid','dashed','dotted','double'].includes(s.line) || !/^#[0-9a-f]{6}$/i.test(s.color) || !Number.isInteger(s.width) || s.width<1 || s.width>6 || !['none','block','open','oval'].includes(s.start) || !['none','block','open','oval'].includes(s.end) || s.line==='double'&&(s.start!=='none'||s.end!=='none')) throw new Error(`${kind}: 이름·선 모양·색·두께·화살표를 확인하세요.`);
  }
}
export const nativeStyleKeys='shape strokeColor strokeWidth dashed dashPattern startArrow endArrow startFill endFill startSize endSize fillColor gradientColor gradientDirection opacity strokeOpacity fillOpacity rounded curved shadow sketch comic jiggle disableMultiStroke'.split(' ');
export function styleValues(s) {
  return {shape:s.line==='double'?'link':'connector',strokeColor:s.color,strokeWidth:String(s.width),dashed:s.line==='dashed'||s.line==='dotted'?'1':'0',dashPattern:s.line==='dotted'?'1 3':'6 4',startArrow:s.start,endArrow:s.end,startFill:'1',endFill:'1',width:'4',...s.nativeStyle};
}
export function patchStyle(style,values) {
  const parts=(style||'').split(';').filter(p=>p && !Object.hasOwn(values,p.split('=')[0]));
  return [...parts,...Object.entries(values).map(([k,v])=>`${k}=${v}`)].join(';')+';';
}
export function followsStyle(style,stamp) {
  if(!stamp)return false;
  try {
    const expected=JSON.parse(stamp),actual=Object.fromEntries((style||'').split(';').filter(p=>p.includes('=')).map(p=>{const at=p.indexOf('=');return [p.slice(0,at),p.slice(at+1)];}));
    return Object.keys(styleValues(defaultStyles.TC)).every(k=>Object.hasOwn(expected,k))&&Object.keys(expected).every(k=>actual[k]===expected[k]);
  } catch { return false; }
}
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export function sampleSvg(s) {
  const line=(y,width,color,dash='')=>`<path d="M12 ${y} H68" fill="none" stroke="${color}" stroke-width="${width}" ${dash}/>`;
  let result=s.line==='double'?line(9,s.width,s.color)+line(15,s.width,s.color):line(12,s.width,s.color,s.line==='dashed'?`stroke-dasharray="${6*s.width} ${4*s.width}"`:s.line==='dotted'?`stroke-dasharray="${s.width} ${3*s.width}"`:'');
  const arrow=(kind,reverse)=>{
    if(kind==='none')return '';
    const transform=reverse?'translate(80 0) scale(-1 1)':'';
    return kind==='oval'?`<circle cx="${reverse?12:68}" cy="12" r="4" fill="${s.color}"/>`:`<path transform="${transform}" d="M60 7 L68 12 L60 17${kind==='block'?' Z':''}" fill="${kind==='block'?s.color:'none'}" stroke="${s.color}" stroke-width="${s.width}"/>`;
  };
  result+=arrow(s.start,true)+arrow(s.end,false);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="24" viewBox="0 0 80 24">${result}</svg>`;
}
export function legendLabel(kinds,styles,customCount,elements=[]) {
  const items=[...kinds.map(kind=>({name:styles[kind].name,svg:sampleSvg(styles[kind])})),...elements].map(item=>`<span style="display:inline-flex;align-items:center;gap:4px;margin:0 16px 0 0;max-width:100%;vertical-align:middle"><img alt="" width="48" height="18" style="flex:none" src="data:image/svg+xml,${encodeURIComponent(item.svg)}"/><span style="overflow-wrap:anywhere">${escape(item.name)}</span></span>`).join('');
  return `<div title="${customCount?`개별 모양 ${customCount}개 · 범례에서 제외`:''}" style="font-family:Arial,sans-serif;font-size:11px;font-weight:400;line-height:24px;color:#475569;text-align:left">${items||'<span style="color:#94a3b8">표시할 범례 없음</span>'}</div>`;
}

export function validateElements(items) {
  if(!Array.isArray(items)||items.length>100)throw new Error('내 요소는 문서당 최대 100개입니다.');
  const ids=new Set();
  for(const item of items){
    if(!item||typeof item.id!=='string'||!item.id||item.id.length>80||ids.has(item.id)||typeof item.name!=='string'||!item.name.trim()||item.name.length>80||typeof item.edge!=='boolean'||typeof item.style!=='string'||item.style.length>10000||![item.width,item.height].every(n=>Number.isFinite(n)&&n>0&&n<=2000))throw new Error('내 요소의 이름·모양·크기를 확인하세요.');
    ids.add(item.id);
  }
}
