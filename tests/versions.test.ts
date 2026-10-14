import test from 'node:test';
import assert from 'node:assert/strict';
import {createStore} from '../server/db.ts';
import {sampleXml} from '../src/sample.ts';

test('버전: 메모와 전체 XML 보존, 복원은 새 버전, 경합·잘못된 입력 원자적 거부',()=>{
  const store=createStore(':memory:');
  try{
    const first=store.save({title:'v1 제목',xml:sampleXml(),note:'최초'});
    const second=store.save({...first,title:'v2 제목',xml:sampleXml(false),note:'업무 흐름 변경'},first.id);
    assert.equal(store.versions(first.id).length,2);
    assert.equal(store.version(first.id,1).xml,first.xml);
    assert.equal(store.version(first.id,2).note,'업무 흐름 변경');
    assert.equal('xml' in store.versions(first.id)[0],false);
    assert.throws(()=>store.save({...second,note:'x'.repeat(501)},first.id),/500/);
    assert.throws(()=>store.restoreVersion(first.id,1,{revision:1}),/다른 창/);
    assert.throws(()=>store.restoreVersion(first.id,999,{revision:2}),/버전/);
    const third=store.restoreVersion(first.id,1,{revision:2});
    assert.equal(third.revision,3);assert.equal(third.xml,first.xml);assert.equal(third.title,first.title);
    assert.equal(store.versions(first.id).length,3);
    assert.equal(store.version(first.id,3).note,'v1 복원');
    assert.equal(store.version(first.id,2).xml,second.xml);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM flow_interfaces WHERE docId=?').get(first.id)!.n,1);
    const other=store.save({title:'별도 문서',xml:sampleXml(false)});
    assert.throws(()=>store.version(other.id,2),/버전/);
    assert.throws(()=>store.save({...third,xml:'<bad/>'},first.id));
    assert.equal(store.versions(first.id).length,3);
  }finally{store.close();}
});
