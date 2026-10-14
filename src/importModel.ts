import {validateCatalog,type Catalog,type System,type Interface} from './model.ts';
type Node={id:string;label:string;shape:string;detail:string;systemCode:string|null;x:number;y:number};
type Edge={id:string;label:string;source:string;target:string;ifId:string|null;lineStyle?:string;markerStart?:string;markerEnd?:string};
type Group={id:string;title:string;description?:string;color:string;x:number;y:number;width:number;height:number;nodeIds:string[]};
export type Legacy={catalog:Catalog;nodes:Node[];edges:Edge[];groups:Group[];warnings:string[]};
export type Choice='keep'|'replace'|'rename';
const obj=(v:any)=>v&&typeof v==='object'&&!Array.isArray(v);
const str=(v:any,max=2000)=>typeof v==='string'&&v.length<=max;
const id=(v:any)=>str(v,160)&&v.trim().length>0;
const coordinate=(v:any)=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=100000;
const list=(v:any,max=5000):any[]=>{if(!Array.isArray(v)||v.length>max)throw new Error('목록 형식 또는 항목 수를 확인하세요.');return v;};
function unique(rows:{id:string}[]){if(new Set(rows.map(x=>x.id)).size!==rows.length)throw new Error('도형·선 ID가 중복됩니다.');}
export function parseLegacy(raw:unknown):Legacy{
  let data:any=raw;const warnings:string[]=[];
  if(Array.isArray(data)){
    const systems=new Map<string,System>();
    const interfaces=list(data).map(r=>{if(!obj(r)||!obj(r.fromSys)||!obj(r.toSys))throw new Error('I/F 파일의 fromSys·toSys를 확인하세요.');
      for(const s of [r.fromSys,r.toSys]){if(systems.has(s.code)&&systems.get(s.code)!.name!==s.name)throw new Error('같은 시스템 코드의 이름이 다릅니다.');systems.set(s.code,{code:s.code,name:s.name,parentCode:null});}
      return {ifId:r.ifId,name:r.name??r.ifId,kind:r.kind,channel:r.channel,formatId:r.formatId??null,fromSystemCode:r.fromSys.code,toSystemCode:r.toSys.code};});
    data={systems:[...systems.values()],interfaces,nodes:[],edges:[]};
  }else data=obj(data)&&data.ir?data.ir:data;
  if(!obj(data))throw new Error('flow2 JSON 또는 I/F 정의 배열을 선택하세요.');
  if(data.irVersion!==undefined&&data.irVersion!==1)throw new Error('지원하지 않는 IR 버전입니다.');
  const catalog:Catalog={systems:list(data.systems).map(s=>{if(!obj(s))throw new Error('시스템 형식을 확인하세요.');return {code:s.code,name:s.name,parentCode:s.parentCode??null};}),interfaces:list(data.interfaces).map(i=>{if(!obj(i))throw new Error('I/F 형식을 확인하세요.');return {ifId:i.ifId,name:i.name,kind:i.kind,channel:i.channel,formatId:i.formatId??null,fromSystemCode:i.fromSystemCode,toSystemCode:i.toSystemCode};})};
  validateCatalog(catalog);
  const nodes:Node[]=list(data.nodes??[]).map(n=>{if(!obj(n)||!id(n.id)||!str(n.label)||!str(n.detail??'')||!['process','decision','terminal','database','external','link'].includes(n.shape)||!coordinate(n.x)||!coordinate(n.y)||!(n.systemCode==null||catalog.systems.some(s=>s.code===n.systemCode)))throw new Error('도형의 ID·모양·좌표·시스템을 확인하세요.');return {...n,detail:n.detail??'',systemCode:n.systemCode??null};});
  const nodeIds=new Set(nodes.map(n=>n.id));
  const edges:Edge[]=list(data.edges??[]).map(e=>{if(!obj(e)||!id(e.id)||!str(e.label??'')||!nodeIds.has(e.source)||!nodeIds.has(e.target)||!(e.ifId==null||catalog.interfaces.some(i=>i.ifId===e.ifId)))throw new Error('연결선의 ID·양 끝 도형·I/F를 확인하세요.');return {...e,label:e.label??'',ifId:e.ifId??null};});
  unique([...nodes,...edges]);
  const members=new Set<string>();
  const groups:Group[]=list(data.groups??[],500).map(g=>{if(!obj(g)||!id(g.id)||!str(g.title)||!str(g.description??'')||!/^#[0-9a-f]{6}$/i.test(g.color)||![g.x,g.y,g.width,g.height].every(coordinate)||g.width<=0||g.height<=0||!list(g.nodeIds).every(n=>nodeIds.has(n)))throw new Error('그룹 형식을 확인하세요.');for(const n of g.nodeIds){if(members.has(n))throw new Error('도형이 여러 그룹에 포함되어 있습니다.');members.add(n);}return g;});
  unique([...nodes,...edges,...groups]);
  if(data.links?.length)warnings.push('이전 문서·버전 링크는 대상 저장소가 달라 옮기지 않습니다. 가져온 뒤 다시 지정하세요.');
  if(data.swimlanes)warnings.push('이전 전용 스윔레인은 가져오지 않습니다. 도형 위치는 유지되며 기본 표로 구획을 만들 수 있습니다.');
  if(groups.length)warnings.push('그룹은 draw.io 컨테이너로 변환합니다.');
  if(nodes.length)warnings.push('도형 위치·소속·설명을 유지하며 모양과 선 경로는 draw.io 기본 표현으로 변환합니다.');
  return {catalog,nodes,edges,groups,warnings};
}
const esc=(v:unknown)=>String(v??'').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\n','&#10;');
export function mergeLegacy(data:Legacy,current:Catalog,nodeSelection:string[],interfaceSelection:string[],choices:Record<string,Choice>,systemSelection:string[]=[]){
  const nodes=data.nodes.filter(n=>nodeSelection.includes(n.id)),ids=new Set(nodes.map(n=>n.id));
  const edges=data.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
  const neededIf=new Set([...interfaceSelection,...edges.flatMap(e=>e.ifId?[e.ifId]:[])]);
  const incomingIf=data.catalog.interfaces.filter(i=>neededIf.has(i.ifId));
  const neededSys=new Set([...systemSelection,...nodes.flatMap(n=>n.systemCode?[n.systemCode]:[]),...incomingIf.flatMap(i=>[i.fromSystemCode,i.toSystemCode])]);
  // Definition-only files also allow importing systems with no interfaces.
  if(!data.nodes.length&&!data.catalog.interfaces.length)data.catalog.systems.forEach(s=>neededSys.add(s.code));
  const byCode=new Map(data.catalog.systems.map(s=>[s.code,s]));
  for(const code of neededSys){let parent=byCode.get(code)?.parentCode;while(parent){neededSys.add(parent);parent=byCode.get(parent)?.parentCode;}}
  const result:Catalog=structuredClone(current),systemMap=new Map<string,string>(),interfaceMap=new Map<string,string>();
  function renamed(code:string,used:Set<string>){let n=2,candidate;do{candidate=code.slice(0,150)+'_'+n++;}while(used.has(candidate));used.add(candidate);return candidate;}
  const usedSys=new Set([...current.systems,...data.catalog.systems].map(s=>s.code)),usedIf=new Set([...current.interfaces,...data.catalog.interfaces].map(i=>i.ifId));
  for(const code of neededSys)systemMap.set(code,current.systems.some(s=>s.code===code)&&choices['s:'+code]==='rename'?renamed(code,usedSys):code);
  for(const source of data.catalog.systems.filter(s=>neededSys.has(s.code))){const item={...source,code:systemMap.get(source.code)!,parentCode:source.parentCode?systemMap.get(source.parentCode)!:null};const index=result.systems.findIndex(s=>s.code===item.code);if(index<0)result.systems.push(item);else if(choices['s:'+source.code]==='replace')result.systems[index]=item;}
  for(const source of incomingIf){const code=current.interfaces.some(i=>i.ifId===source.ifId)&&choices['i:'+source.ifId]==='rename'?renamed(source.ifId,usedIf):source.ifId;interfaceMap.set(source.ifId,code);const item:Interface={...source,ifId:code,fromSystemCode:systemMap.get(source.fromSystemCode)!,toSystemCode:systemMap.get(source.toSystemCode)!};const index=result.interfaces.findIndex(i=>i.ifId===code);if(index<0)result.interfaces.push(item);else if(choices['i:'+source.ifId]==='replace')result.interfaces[index]=item;}
  validateCatalog(result);
  const groups=data.groups.filter(g=>g.nodeIds.some(n=>ids.has(n))||!g.nodeIds.length&&nodes.length===data.nodes.length);
  const cells:string[]=[],cellIds=new Map([...groups,...nodes,...edges].map((c,i)=>[c.id,'import-'+i]));
  function vertex(id:string,label:string,detail:string,system:string,x:number,y:number,width:number,height:number,style:string,parent='1') {cells.push(`<object id="${esc(id)}" label="${esc(label)}" detail="${esc(detail)}" systemCode="${esc(system)}"><mxCell vertex="1" parent="${esc(parent)}" style="${esc(style)}"><mxGeometry x="${x}" y="${y}" width="${width}" height="${height}" as="geometry"/></mxCell></object>`);}
  for(const g of groups)vertex(cellIds.get(g.id)!,g.title,g.description??'','',g.x,g.y,g.width,g.height,`container=1;collapsible=0;recursiveResize=0;whiteSpace=wrap;html=0;verticalAlign=top;fillColor=${g.color};strokeColor=#94a3b8;`);
  const shapes:Record<string,string>={process:'rounded=0;',decision:'rhombus;',terminal:'rounded=1;arcSize=50;',database:'shape=cylinder3;',external:'rounded=0;dashed=1;',link:'shape=rectangle;rounded=1;'};
  for(const n of nodes){const g=groups.find(g=>g.nodeIds.includes(n.id));vertex(cellIds.get(n.id)!,n.label,n.detail,n.systemCode?systemMap.get(n.systemCode)!:'',n.x-(g?.x??0),n.y-(g?.y??0),184,66,shapes[n.shape]+'whiteSpace=wrap;html=0;fillColor=#ffffff;strokeColor=#64748b;',g?cellIds.get(g.id)!:'1');}
  const arrow:Record<string,string>={none:'none',arrow:'open',arrowClosed:'block',circle:'oval',dot:'oval',cross:'cross'};
  for(const e of edges){const line=e.lineStyle==='double'?'shape=link;':e.lineStyle==='dotted'?'dashed=1;dashPattern=1 3;':e.lineStyle==='dashed'?'dashed=1;':e.lineStyle==='thick'?'strokeWidth=3;':'';cells.push(`<object id="${cellIds.get(e.id)}" label="${esc(e.label)}" ifId="${esc(e.ifId?interfaceMap.get(e.ifId):'')}"><mxCell edge="1" parent="1" source="${cellIds.get(e.source)}" target="${cellIds.get(e.target)}" style="edgeStyle=orthogonalEdgeStyle;html=0;${line}startArrow=${arrow[e.markerStart??'none']??'none'};endArrow=${arrow[e.markerEnd??'arrowClosed']??'block'};"><mxGeometry relative="1" as="geometry"/></mxCell></object>`);}
  return {catalog:result,xml:`<mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel>`,nodes:nodes.length,edges:edges.length};
}
