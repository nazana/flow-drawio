import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DOMParser} from '@xmldom/xmldom';
import {samples,draftXml} from '../src/sample.ts';
import {inspectXml} from '../server/xml.ts';
import {createStore} from '../server/db.ts';

test('six editable samples preserve catalog, links, multiline labels and versions',()=>{
  assert.equal(samples.length,6);
  const store=createStore(':memory:');
  try{
    for(const sample of samples){
      const xml=draftXml(sample);
      assert.deepEqual(inspectXml(xml).catalog,sample.catalog);
      const tree=new DOMParser().parseFromString(xml,'text/xml');
      const objects=Array.from(tree.getElementsByTagName('object'));
      assert.equal(new Set(objects.map(o=>o.getAttribute('id'))).size,objects.length);
      for(const node of sample.nodes)assert.equal(objects.find(o=>o.getAttribute('id')===node.id)?.getAttribute('label'),node.label);
      for(const edge of sample.edges){
        assert.ok(sample.nodes.some(n=>n.id===edge.from));assert.ok(sample.nodes.some(n=>n.id===edge.to));
        if(edge.ifId){const iface=sample.catalog.interfaces.find(i=>i.ifId===edge.ifId)!;assert.ok(iface);assert.equal(sample.nodes.find(n=>n.id===edge.from)?.system,iface.fromSystemCode);assert.equal(sample.nodes.find(n=>n.id===edge.to)?.system,iface.toSystemCode);}
      }
      const saved=store.save({title:sample.title,xml});
      assert.equal(store.read(saved.id).xml,xml);
      const edited=xml.replace('fontSize=16','fontSize=18');
      store.save({title:sample.title,xml:edited,revision:saved.revision},saved.id);
      assert.equal(store.read(saved.id).xml,edited);
      assert.equal(store.versions(saved.id).length,2);
    }
  }finally{store.close();}
});
