import type {Diagram,DiagramCell} from './model.ts';

export type DrawioEvent={event:string;xml?:string;cells?:DiagramCell[];selected?:string[];data?:string;id?:string};
export function postEditorMessage(frame:Window,message:unknown){frame.postMessage(JSON.stringify(message),'*');}
export function parseEditorMessage(raw:unknown):DrawioEvent|null {
 let value=raw;
 if(typeof value==='string'){try{value=JSON.parse(value);}catch{return null;}}
 return value&&typeof value==='object'&&typeof (value as DrawioEvent).event==='string'?value as DrawioEvent:null;
}
export function encodeDiagram(diagram:Diagram):string {
 const cellXml=diagram.cells.map(c=>`<mxCell id="${esc(c.id)}" value="${esc(c.value)}" style="${esc(c.style??'')}"${c.vertex?' vertex="1"':''}${c.edge?' edge="1"':''} parent="1"${c.source?` source="${esc(c.source)}"`:''}${c.target?` target="${esc(c.target)}"`:''} systemCode="${esc(c.systemCode??'')}" ifId="${esc(c.ifId??'')}" detail="${esc(c.detail??'')}"><mxGeometry x="0" y="0" width="120" height="60" as="geometry"/></mxCell>`).join('');
 return `<mxfile host="app.diagrams.net"><diagram id="main" name="페이지-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cellXml}</root></mxGraphModel></diagram></mxfile>`;
}
const esc=(s:string)=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');

export function diagramFromXml(xml:string):Diagram {
 const parsed=new DOMParser().parseFromString(xml,'application/xml');
 if(parsed.querySelector('parsererror'))throw new Error('draw.io 다이어그램 XML을 읽을 수 없습니다.');
 return {cells:[...parsed.querySelectorAll('mxCell')].filter(c=>c.id!=='0'&&c.id!=='1').map(c=>({id:c.id,value:c.getAttribute('value')??'',...(c.getAttribute('vertex')?{vertex:c.getAttribute('vertex)!}:{}),...(c.getAttribute('edge')?{edge:c.getAttribute('edge)!}:{}),...(c.getAttribute('style')?{style:c.getAttribute('style)!}:{}),...(c.getAttribute('source')?{source:c.getAttribute('source)!}:{}),...(c.getAttribute('target')?{target:c.getAttribute('target)!}:{}),...(c.getAttribute('systemCode')?{systemCode:c.getAttribute('systemCode)!}:{}),...(c.getAttribute('ifId')?{ifId:c.getAttribute('ifId)!}:{}),...(c.getAttribute('detail')?{detail:c.getAttribute('detail)!}:{})}))};
}
