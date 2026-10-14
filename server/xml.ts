import {validateStyles,validateElements} from '../public/flow-styles.js';
import {DOMParser, XMLSerializer} from '@xmldom/xmldom';
import {inflateRawSync} from 'node:zlib';
import {validateCatalog, type Catalog} from '../src/model.ts';
export function inspectXml(xml: unknown): {xml: string; catalog: Catalog} {
  if (typeof xml !== 'string' || xml.length > 16_000_000 || /<!DOCTYPE|<!ENTITY/i.test(xml)) throw new Error('유효한 draw.io XML이 필요합니다 (최대 16MB).');
  const doc = new DOMParser({onError: level => {if (level !== 'warning') throw new Error('XML 형식이 잘못되었습니다.');}}).parseFromString(xml, 'text/xml');
  if (!['mxfile','mxGraphModel'].includes(doc.documentElement?.tagName || '')) throw new Error('draw.io 파일을 선택하세요.');
  let model = doc.getElementsByTagName('mxGraphModel')[0];
  if (!model) {
    const diagram = doc.getElementsByTagName('diagram')[0];
    if (!diagram) throw new Error('그림 페이지가 없습니다.');
    const expanded = decodeURIComponent(inflateRawSync(Buffer.from(diagram.textContent || '', 'base64'), {maxOutputLength:16_000_000}).toString());
    return {xml, catalog: inspectXml(expanded).catalog};
  }
  const root = model.getElementsByTagName('root')[0];
  if (!root) throw new Error('그림 구조가 없습니다.');
  const cells = Array.from(root.childNodes).filter(n => n.nodeType === 1) as unknown as Element[];
  const data = cells.find(n => n.getAttribute('id') === '0')?.getAttribute('flowCatalog');
  const styleData=cells.find(n=>n.getAttribute('id')==='0')?.getAttribute('flowStyles');
  if(styleData)validateStyles(JSON.parse(styleData));
  const elementData=cells.find(n=>n.getAttribute('id')==='0')?.getAttribute('flowElements');
  if(elementData)validateElements(JSON.parse(elementData));
  const catalog: Catalog = data ? JSON.parse(data) : {systems:[],interfaces:[]};
  validateCatalog(catalog);
  return {xml, catalog};
}
// One-time migration of the earlier prototype's rows. Keep the original table intact.
export function migrateXml(row: {xml:string; diagram:string; systems:string; interfaces:string}): string {
  const catalog = {systems:JSON.parse(row.systems), interfaces:JSON.parse(row.interfaces)};
  const escape = (s:unknown) => String(s ?? '').replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
  let xml = row.xml;
  if (!xml) {
    const cells = JSON.parse(row.diagram).cells || [];
    xml = `<mxfile><diagram id="main" name="Page-1"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.map((c:any) => `<object id="${escape(c.id)}" label="${escape(c.value)}" systemCode="${escape(c.systemCode)}" ifId="${escape(c.ifId)}" detail="${escape(c.detail)}"><mxCell parent="1" ${c.edge?'edge="1"':'vertex="1"'} style="${escape(c.style || 'rounded=1;whiteSpace=wrap;html=1;')}" ${c.source?`source="${escape(c.source)}"`:""} ${c.target?`target="${escape(c.target)}"`:""}><mxGeometry x="${c.x || 0}" y="${c.y || 0}" width="${c.width || 150}" height="${c.height || 70}" ${c.edge?'relative="1"':''} as="geometry"/></mxCell></object>`).join('')}</root></mxGraphModel></diagram></mxfile>`;
  }
  const doc = new DOMParser().parseFromString(xml,'text/xml');
  const rootCell = Array.from(doc.getElementsByTagName('mxCell')).find(c => c.getAttribute('id') === '0');
  if (rootCell) {
    const object = doc.createElement('object');object.setAttribute('id','0');object.setAttribute('flowCatalog',JSON.stringify(catalog));
    rootCell.removeAttribute('id');rootCell.parentNode!.replaceChild(object,rootCell);object.appendChild(rootCell);
  }
  return new XMLSerializer().serializeToString(doc);
}
