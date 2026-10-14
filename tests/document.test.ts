import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {createStore} from '../server/db.ts';
import {inspectXml} from '../server/xml.ts';
import {sampleXml} from '../src/sample.ts';

test('원본 XML·정규화 속성 저장, 경합 거부 및 기존 저장본 보존',()=>{
  const store=createStore(':memory:');
  try{
    const xml=sampleXml();const saved=store.save({title:'생산계획',xml});
    assert.equal(store.read(saved.id).xml,xml);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM flow_systems').get()!.n,2);
    assert.equal(store.db.prepare('SELECT ifId FROM flow_interfaces').get()!.ifId,'IF_PLAN_001');
    const newer=store.save({...saved,title:'수정'},saved.id);assert.equal(newer.revision,2);
    assert.throws(()=>store.save({...saved,title:'충돌'},saved.id),/다른 창/);
    assert.equal(store.read(saved.id).title,'수정');
    assert.throws(()=>store.save({...newer,xml:'<notdrawio/>'},saved.id),/draw.io/);
    assert.equal(store.read(saved.id).xml,xml);
  }finally{store.close();}
});
test('XML 신뢰 경계와 압축 문서의 속성 읽기',()=>{
  assert.throws(()=>inspectXml('<!DOCTYPE mxfile [<!ENTITY x SYSTEM "file:///etc/passwd">]><mxfile>&x;</mxfile>'));
  assert.throws(()=>inspectXml('<mxfile><diagram></mxfile>'));
  const model=sampleXml().match(/<mxGraphModel[\s\S]*<\/mxGraphModel>/)![0];
  const compressed=deflateRawSync(encodeURIComponent(model)).toString('base64');
  const xml=`<mxfile><diagram>${compressed}</diagram></mxfile>`;
  assert.equal(inspectXml(xml).catalog.interfaces[0].ifId,'IF_PLAN_001');
  assert.equal(inspectXml(xml).xml,xml);
});
