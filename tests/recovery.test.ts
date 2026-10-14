import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/db.ts';
import {sampleXml} from '../src/sample.ts';

test('자동복구: 탭 분리, 원본 보존, 경합 차단, 선택한 복구본만 정리',()=>{
  const store=createStore(':memory:');
  try{
    const doc=store.save({title:'원본',xml:sampleXml()});
    const draft={docId:doc.id,sessionId:'tab-a',title:'작업 A',xml:sampleXml(false),baseRevision:doc.revision};
    const first=store.saveRecovery(doc.id,draft);
    store.saveRecovery(doc.id,{...draft,sessionId:'tab-b',title:'작업 B'});
    assert.deepEqual(store.read(doc.id),doc);
    assert.equal(store.recoveries(doc.id).length,2);
    assert.throws(()=>store.saveRecovery(doc.id,{...draft,xml:'<broken/>'}));
    assert.throws(()=>store.saveRecovery(doc.id,{...draft,baseRevision:99}),/다른 탭/);
    assert.equal(store.recoveries(doc.id).length,2);
    const restored=store.save({...doc,title:first.title,xml:first.xml,sessionId:'tab-c',recoveredSessionId:first.sessionId,recoveredUpdatedAt:first.updatedAt},doc.id);
    assert.equal(restored.revision,2);
    assert.equal(store.recoveries(doc.id).length,1);
    assert.equal(store.recoveries(doc.id)[0].sessionId,'tab-b');
    assert.throws(()=>store.saveRecovery(doc.id,draft),/다른 탭/);
    store.saveRecovery(doc.id,{...draft,baseRevision:2});
    assert.equal(store.recoveries(doc.id).length,1); // Identical to saved copy: no draft needed.
    const later=store.saveRecovery(doc.id,{...draft,title:'더 최근 작업',baseRevision:2});
    store.save({...restored,recoveredSessionId:later.sessionId,recoveredUpdatedAt:'stale-timestamp'},doc.id);
    assert.equal(store.recoveries(doc.id).length,2);
  }finally{store.close();}
});
