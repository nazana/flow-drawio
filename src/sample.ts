import type {Catalog} from './model.ts';
const escape = (s: string) => s.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function sampleXml(sample = true, showSystems = sample) {
  const catalog: Catalog = sample ? {systems: [{code:'ERP',name:'전사 자원관리',parentCode:null},{code:'MES',name:'생산관리',parentCode:null}], interfaces: [{ifId:'IF_PLAN_001',name:'생산계획 전달',kind:'TC',channel:'EAI',formatId:'FMT_PLAN',fromSystemCode:'ERP',toSystemCode:'MES'}]} : {systems:[],interfaces:[]};
  const node = (id: string, label: string, systemCode: string, x: number, color: string) => `<object id="${id}" label="${label}" systemCode="${systemCode}" detail=""><mxCell vertex="1" parent="1" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${color};strokeColor=#64748b;fontSize=16;"><mxGeometry x="${x}" y="160" width="180" height="80" as="geometry"/></mxCell></object>`;
  return `<mxfile><diagram id="main" name="${sample ? '시스템 연계' : 'Page-1'}"><mxGraphModel grid="1" gridSize="10" page="0"><root><object id="0" label="" flowShowSystems="${showSystems ? '1' : '0'}" flowCatalog="${escape(JSON.stringify(catalog))}"><mxCell/></object><mxCell id="1" parent="0"/>${sample ? node('erp','생산계획 수립','ERP',100,'#dbeafe') + node('mes','생산계획 수신','MES',480,'#dcfce7') + '<object id="if1" label="생산계획 전달" ifId="IF_PLAN_001"><mxCell edge="1" parent="1" source="erp" target="mes" style="edgeStyle=orthogonalEdgeStyle;endArrow=block;html=1;fontSize=13;"><mxGeometry relative="1" as="geometry"/></mxCell></object>' : ''}</root></mxGraphModel></diagram></mxfile>`;
}

export type SampleNode = {id:string;label:string;x:number;y:number;w:number;h:number;shape?:'diamond'|'ellipse'|'line'|'entity'|'zone'|'lifeline';system?:string;accent?:boolean};
export type SampleEdge = {from:string;to:string;label:string;ifId?:string;dashed?:boolean;at?:number};
export type Sample = {id:string;name:string;title:string;description:string;nodes:SampleNode[];edges:SampleEdge[];catalog:Catalog;showTable:boolean};
const empty:Catalog={systems:[],interfaces:[]};
const systems:Catalog['systems']=['ERP','EAI','MES','WMS'].map(code=>({code,name:({ERP:'전사 자원관리',EAI:'연계 허브',MES:'생산관리',WMS:'창고관리'} as Record<string,string>)[code],parentCode:null}));
const iface=(id:string,name:string,from:string,to:string):Catalog['interfaces'][number]=>({ifId:id,name,kind:'TC',channel:'EAI',formatId:null,fromSystemCode:from,toSystemCode:to});
const n=(id:string,label:string,x:number,y:number,shape?:SampleNode['shape'],system?:string):SampleNode=>({id,label,x,y,w:150,h:64,shape,system});
const e=(from:string,to:string,label='',ifId?:string):SampleEdge=>({from,to,label,ifId});
export const samples:Sample[]=[
  {id:'business',name:'업무 흐름',title:'업무 승인 흐름',description:'검토와 승인·반려를 표현합니다.',showTable:false,catalog:empty,
    nodes:[n('request','요청 등록',40,150),n('review','내용 검토',240,150),{...n('decision','승인?',440,138,'diamond'),w:110,h:88},n('done','처리 완료',620,60),{...n('reject','반려',620,250),accent:true}],
    edges:[e('request','review'),e('review','decision'),e('decision','done','승인'),e('decision','reject','반려')]},
  {id:'interface',name:'시스템 연계',title:'생산계획 연계',description:'시스템 사이의 I/F를 정의합니다.',showTable:true,
    catalog:{systems,interfaces:[iface('IF_PLAN_001','계획 전달','ERP','EAI'),iface('IF_PLAN_002','계획 수신','EAI','MES'),iface('IF_STOCK_001','자재 준비','MES','WMS')]},
    nodes:[n('erp','ERP\n생산계획 수립',40,140,undefined,'ERP'),n('eai','EAI\n계획 중계',240,140,undefined,'EAI'),n('mes','MES\n생산계획 수신',440,140,undefined,'MES'),n('wms','WMS\n자재 준비',640,140,undefined,'WMS')],
    edges:[e('erp','eai','계획 전달','IF_PLAN_001'),e('eai','mes','계획 수신','IF_PLAN_002'),e('mes','wms','자재 준비','IF_STOCK_001')]},
  {id:'sequence',name:'시퀀스',title:'생산계획 전송 시퀀스',description:'시간 순서로 요청과 응답을 표현합니다.',showTable:true,
    catalog:{systems:systems.filter(s=>s.code!=='WMS'),interfaces:[iface('IF_SEND','계획 전송','ERP','EAI'),iface('IF_DELIVER','계획 전달','EAI','MES'),iface('IF_ACK','접수 응답','MES','EAI'),iface('IF_RESULT','결과 회신','EAI','ERP')]},
    nodes:['ERP','EAI','MES'].map((code,i)=>({...n(code,code,70+i*260,20,'lifeline',code),h:360})),
    edges:[{...e('ERP','EAI','1. 계획 전송','IF_SEND'),at:.28},{...e('EAI','MES','2. 계획 전달','IF_DELIVER'),at:.46},{...e('MES','EAI','3. 접수 응답','IF_ACK'),at:.66,dashed:true},{...e('EAI','ERP','4. 결과 회신','IF_RESULT'),at:.86,dashed:true}]},
  {id:'architecture',name:'시스템 구성',title:'생산 시스템 구성',description:'영역별 시스템과 연결을 살펴봅니다.',showTable:false,catalog:{systems,interfaces:[]},
    nodes:[{id:'zone1',label:'업무 영역',x:30,y:30,w:210,h:330,shape:'zone'},{id:'zone2',label:'연계 영역',x:290,y:30,w:210,h:330,shape:'zone'},{id:'zone3',label:'생산 영역',x:550,y:30,w:230,h:330,shape:'zone'},n('erp','ERP',60,150,undefined,'ERP'),n('eai','EAI',320,150,undefined,'EAI'),n('mes','MES',590,100,undefined,'MES'),n('wms','WMS',590,250,undefined,'WMS')],
    edges:[e('erp','eai','계획'),e('eai','mes','생산'),e('mes','wms','자재')]},
  {id:'state',name:'상태 전이',title:'작업지시 상태',description:'상태 변화와 분기 조건을 정의합니다.',showTable:false,catalog:empty,
    nodes:[{...n('start','',40,170,'ellipse'),w:24,h:24,accent:true},n('draft','작성',100,150),n('review','검토',310,150),n('approved','승인',540,50),n('rejected','반려',540,270),n('done','완료',740,50)],
    edges:[e('start','draft'),e('draft','review','제출'),e('review','approved','승인'),e('review','rejected','반려'),e('rejected','draft','재작성'),e('approved','done','처리')]},
  {id:'data',name:'데이터 모델',title:'생산 데이터 모델',description:'엔터티의 필드와 관계를 정리합니다.',showTable:false,catalog:empty,
    nodes:[{...n('plan','생산계획\nPK plan_id\n계획일 · 품목 · 수량',40,90,'entity'),w:210,h:180},{...n('order','작업지시\nPK order_id\nFK plan_id\n작업일 · 상태',340,90,'entity'),w:210,h:180},{...n('result','생산실적\nPK result_id\nFK order_id\n생산량 · 완료일',640,90,'entity'),w:210,h:180}],
    edges:[e('plan','order','1 : N'),e('order','result','1 : N')]}
];
export function draftXml(sample:Sample):string {
  const nodes=sample.nodes.map(n=>{
    const shape=n.shape==='diamond'?'rhombus':n.shape==='ellipse'?'ellipse':n.shape==='line'?'line':n.shape==='lifeline'?'umlLifeline':'rectangle';
    const style=`shape=${shape};rounded=0;whiteSpace=wrap;html=0;fontSize=16;fontColor=#2d3142;fillColor=${n.accent?'#fff0e8':n.shape==='zone'?'#f5f7fa':'#ffffff'};strokeColor=${n.accent?'#eb6c36':'#64748b'};${n.shape==='lifeline'?'size=64;perimeter=lifelinePerimeter;container=1;dropTarget=0;collapsible=0;recursiveResize=0;outlineConnect=0;portConstraint=eastwest;':n.shape==='line'?'dashed=1;direction=south;':n.shape==='zone'?'verticalAlign=top;spacingTop=12;':''}`;
    return `<object id="${n.id}" label="${escape(n.label).replaceAll('\n','&#10;')}" systemCode="${n.system??''}" detail=""><mxCell vertex="1" parent="1" style="${style}"><mxGeometry x="${n.x}" y="${n.y}" width="${n.w||1}" height="${n.h}" as="geometry"/></mxCell></object>`;
  }).join('');
  const edges=sample.edges.map((e,i)=>`<object id="edge${i}" label="${escape(e.label)}" ifId="${e.ifId??''}" detail=""><mxCell edge="1" parent="1" source="${e.from}" target="${e.to}" style="html=0;fontSize=12;strokeColor=${e.ifId?'#2e5aa8':'#64748b'};endArrow=block;endFill=1;${e.dashed?'dashed=1;':''}${e.at!==undefined?`edgeStyle=none;exitX=0.5;exitY=${e.at};entryX=0.5;entryY=${e.at};exitPerimeter=0;entryPerimeter=0;`:'edgeStyle=orthogonalEdgeStyle;'}"><mxGeometry relative="1" as="geometry"/></mxCell></object>`).join('');
  return `<mxfile><diagram id="main" name="${sample.name}"><mxGraphModel grid="1" gridSize="10" page="0"><root><object id="0" label="" flowDiagramType="${sample.id==='sequence'?'sequence':'general'}" flowShowSystems="0" flowCatalog="${escape(JSON.stringify(sample.catalog))}"><mxCell/></object><mxCell id="1" parent="0"/>${nodes}${edges}</root></mxGraphModel></diagram></mxfile>`;
}
