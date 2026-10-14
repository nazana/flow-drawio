import test from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {parseLegacy,mergeLegacy} from '../src/importModel.ts';
import {imageDataBlob,pptxParts} from '../src/export.ts';
import {targetedIssues} from '../src/model.ts';
const data={systems:[{code:'ERP',name:'새 ERP',parentCode:null},{code:'MES',name:'MES',parentCode:'ERP'}],interfaces:[{ifId:'I1',name:'계획',kind:'TC',channel:'EAI',formatId:null,fromSystemCode:'ERP',toSystemCode:'MES'}],nodes:[{id:'a',shape:'process',label:'A<&',detail:'한글',systemCode:'ERP',x:20,y:30},{id:'b',shape:'decision',label:'B',systemCode:'MES',x:250,y:30}],edges:[{id:'e',source:'a',target:'b',ifId:'I1',label:'송신'}],groups:[{id:'g',title:'묶음',color:'#ffeecc',x:0,y:0,width:500,height:200,nodeIds:['a','b']}]};
test('legacy import validates, selects dependencies, resolves codes and escapes XML',()=>{
 const parsed=parseLegacy({ir:data}),existing={systems:[{code:'ERP',name:'기존',parentCode:null}],interfaces:[]};
 const partial=mergeLegacy(parsed,existing,['a'],[],{});assert.equal(partial.edges,0);assert.equal(partial.catalog.interfaces.length,0);assert.equal(partial.catalog.systems[0].name,'기존');
 const merged=mergeLegacy(parsed,existing,['a','b'],[],{'s:ERP':'rename'});assert.equal(merged.edges,1);assert.equal(merged.catalog.interfaces[0].fromSystemCode,'ERP_2');assert.equal(merged.catalog.systems.find(s=>s.code==='MES')?.parentCode,'ERP_2');
 const xml=new DOMParser().parseFromString(merged.xml,'text/xml');assert.equal(xml.getElementsByTagName('parsererror').length,0);assert.equal(xml.getElementsByTagName('object')[1].getAttribute('label'),'A<&');
 assert.equal(mergeLegacy(parsed,existing,[],['I1'],{'s:ERP':'replace'}).catalog.systems[0].name,'새 ERP');
 assert.throws(()=>parseLegacy({...data,nodes:[{...data.nodes[0],x:Infinity}]}));assert.throws(()=>parseLegacy({...data,edges:[{...data.edges[0],target:'missing'}]}));assert.throws(()=>parseLegacy({...data,systems:[{code:'ERP',name:'A',parentCode:'ERP'}]}));
 const array=parseLegacy([{fromSys:{code:'a',name:'A'},toSys:{code:'b',name:'B'},ifId:'X',kind:'API',channel:'API_SYNC'}]);assert.equal(array.catalog.interfaces[0].name,'X');
});
test('PPTX XML and relationships point to local package parts, issues keep target IDs',()=>{
 const parts=pptxParts(1280,720);assert.match(parts['[Content_Types].xml'],/presentationml.presentation.main\+xml/);assert.equal(imageDataBlob('data:image/png;base64,YQ==').size,1);assert.equal(imageDataBlob('data:image/svg+xml,%3Csvg%2F%3E').size,6);for(const [path,content] of Object.entries(parts)){const doc=new DOMParser().parseFromString(content,'text/xml');assert.equal(doc.getElementsByTagName('parsererror').length,0,path);}
 assert.match(parts['ppt/slides/slide1.xml'],/r:embed="rId1"/);assert.match(parts['ppt/slides/_rels/slide1.xml.rels'],/\.\.\/media\/image1.png/);assert.throws(()=>pptxParts(0,10));
 const issues=targetedIssues({catalog:{systems:[],interfaces:[]},cells:[{id:'broken',label:'도형',edge:false,systemCode:'missing'}]} as any);assert.equal(issues[0].id,'broken');assert.match(issues[0].message,/소속/);
});
