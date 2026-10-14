import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser,XMLSerializer} from '@xmldom/xmldom';
import {mergeXml} from '../public/flow-merge.js';
const base='<mxfile><diagram id="p"><mxGraphModel><root><mxCell id="0"/><mxCell id="1" parent="0"/><mxCell id="a" value="A" vertex="1" parent="1"><mxGeometry x="10" y="20" width="80" height="40" as="geometry"/></mxCell><mxCell id="b" value="B" vertex="1" parent="1"><mxGeometry x="30" y="40" width="80" height="40" as="geometry"/></mxCell></root></mxGraphModel></diagram></mxfile>';
const merge=(before:string,edited:string,current:string)=>mergeXml(before,edited,current,DOMParser,XMLSerializer);
const cell=(xml:string,id:string)=>Array.from(new DOMParser().parseFromString(xml,'text/xml').getElementsByTagName('mxCell')).find(node=>node.getAttribute('id')===id)!;
test('concurrent labels, movement, inserts and field conflicts converge without replacing other cells',()=>{
 const left=base.replace('value="A"','value="Left"'),right=base.replace('value="B"','value="Right"');
 const combined=merge(base,left,right);assert.equal(cell(combined,'a').getAttribute('value'),'Left');assert.equal(cell(combined,'b').getAttribute('value'),'Right');
 const movement=base.replace('x="10"','x="90"');const moved=merge(base,movement,left);assert.equal(cell(moved,'a').getAttribute('value'),'Left');assert.equal(cell(moved,'a').getElementsByTagName('mxGeometry')[0].getAttribute('x'),'90');
 const last=merge(base,base.replace('value="A"','value="Last"'),left);assert.equal(cell(last,'a').getAttribute('value'),'Last');
 const add=(id:string)=>base.replace('</root>',`<mxCell id="${id}" vertex="1" parent="1"/></root>`);
 const inserted=merge(base,add('new-left'),add('new-right'));assert.ok(cell(inserted,'new-left'));assert.ok(cell(inserted,'new-right'));
 assert.throws(()=>merge(base,add('same'),add('same').replace('id="same" vertex="1"','id="same" vertex="1" value="other"')),/ID/);
});
test('deletion wins, new dangling edges are disconnected, invalid roots and parent cycles are rejected',()=>{
 const removed=base.replace(/<mxCell id="a"[\s\S]*?<\/mxCell>/,'');
 const updated=merge(base,base.replace('value="A"','value="Concurrent"'),removed);assert.equal(cell(updated,'a'),undefined);
 const edge=base.replace('</root>','<mxCell id="edge" parent="1" edge="1" source="a" target="b"/></root>');
 const merged=merge(base,edge,removed);assert.equal(cell(merged,'edge').hasAttribute('source'),false);assert.equal(cell(merged,'edge').getAttribute('target'),'b');
 assert.throws(()=>merge(base,base.replace('<mxCell id="0"/>',''),base),/루트/);
 assert.throws(()=>merge(base,base.replace('id="a" value="A" vertex="1" parent="1"','id="a" value="A" vertex="1" parent="a"'),base),/순환/);
 assert.throws(()=>merge(base,'<!DOCTYPE mxfile>'+base,base));
});
test('changing shape stacking order preserves the unchanged prefix and concurrent labels',()=>{
 const reordered=base.replace(/(<mxCell id="a"[\s\S]*?<\/mxCell>)(<mxCell id="b"[\s\S]*?<\/mxCell>)/,'$2$1');
 const combined=merge(base,reordered,base.replace('value="A"','value="Other editor"'));
 const ids=Array.from(new DOMParser().parseFromString(combined,'text/xml').getElementsByTagName('root')[0].childNodes).filter(node=>node.nodeType===1).map(node=>(node as Element).getAttribute('id'));
 assert.deepEqual(ids,['0','1','b','a']);assert.equal(cell(combined,'a').getAttribute('value'),'Other editor');
 assert.deepEqual(Array.from(new DOMParser().parseFromString(merge(base,reordered,combined),'text/xml').getElementsByTagName('mxCell')).map(node=>node.getAttribute('id')),ids);
});
