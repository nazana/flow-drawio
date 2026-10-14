import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/db.ts';
import {normalizeMetadata} from '../src/model.ts';
import {sampleXml} from '../src/sample.ts';

test('문서 정보: 태그 정규화, 저장·목록·버전·복구, 기존 클라이언트 호환',()=>{
  const store=createStore(':memory:');
  try{
    const metadata={description:' 생산 연계 ',tags:[' ERP ','생산','ERP'],status:'review'};
    const doc=store.save({title:'태그 문서',xml:sampleXml(),metadata});
    assert.deepEqual(doc.metadata,{description:'생산 연계',tags:['ERP','생산'],status:'review'});
    assert.deepEqual(store.list()[0].metadata,doc.metadata);
    const changed=store.save({...doc,metadata:{...doc.metadata,tags:['차세대'],status:'complete'}},doc.id);
    const restored=store.restoreVersion(doc.id,1,{revision:changed.revision});
    assert.deepEqual(restored.metadata,doc.metadata);
    const recovery=store.saveRecovery(doc.id,{sessionId:'tab',title:doc.title,xml:doc.xml,baseRevision:restored.revision,metadata:{...doc.metadata,tags:['작업중']}});
    assert.deepEqual(store.recoveries(doc.id)[0].metadata,recovery.metadata);
    const legacy=store.save({title:doc.title,xml:doc.xml,revision:restored.revision},doc.id);
    assert.deepEqual(legacy.metadata,doc.metadata);
    assert.throws(()=>store.save({...legacy,metadata:{tags:['x'.repeat(41)]}},doc.id));
    assert.equal(store.read(doc.id).revision,legacy.revision);
    assert.throws(()=>normalizeMetadata({status:'invalid'}));
    assert.throws(()=>normalizeMetadata({tags:'ERP'}));
    assert.throws(()=>normalizeMetadata({description:'x'.repeat(2001)}));
    assert.deepEqual(normalizeMetadata(undefined),{description:'',tags:[],status:'draft'});
  }finally{store.close();}
});
