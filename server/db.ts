import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {dirname} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import type {Document,DocumentSummary,Recovery,Version,VersionSummary} from '../src/model.ts';
import {normalizeMetadata} from '../src/model.ts';
import {inspectXml,migrateXml} from './xml.ts';

export const failure = (message:string,status=400) => Object.assign(new Error(message),{status});
export function createStore(path=process.env.FLOW_DB_PATH ?? '.data/flow.sqlite') {
  if(path!==':memory:')mkdirSync(dirname(path),{recursive:true});
  const db=new DatabaseSync(path);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS flow_documents(id TEXT PRIMARY KEY,title TEXT NOT NULL,xml TEXT NOT NULL,revision INTEGER NOT NULL,updatedAt TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS flow_versions(docId TEXT NOT NULL REFERENCES flow_documents(id),revision INTEGER NOT NULL,title TEXT NOT NULL,xml TEXT NOT NULL,note TEXT NOT NULL,createdAt TEXT NOT NULL,PRIMARY KEY(docId,revision));
    CREATE TABLE IF NOT EXISTS flow_recoveries(docId TEXT NOT NULL REFERENCES flow_documents(id),sessionId TEXT NOT NULL,title TEXT NOT NULL,xml TEXT NOT NULL,baseRevision INTEGER NOT NULL,updatedAt TEXT NOT NULL,PRIMARY KEY(docId,sessionId));
    CREATE TABLE IF NOT EXISTS flow_systems(docId TEXT REFERENCES flow_documents(id),code TEXT,name TEXT NOT NULL,parentCode TEXT,PRIMARY KEY(docId,code));
    CREATE TABLE IF NOT EXISTS flow_interfaces(docId TEXT REFERENCES flow_documents(id),ifId TEXT,name TEXT NOT NULL,kind TEXT NOT NULL,channel TEXT NOT NULL,formatId TEXT,fromSystemCode TEXT NOT NULL,toSystemCode TEXT NOT NULL,PRIMARY KEY(docId,ifId));`);
  for(const table of ['flow_documents','flow_versions','flow_recoveries']){
    if(!db.prepare(`PRAGMA table_info(${table})`).all().some(column=>column.name==='metadata'))db.exec(`ALTER TABLE ${table} ADD COLUMN metadata TEXT NOT NULL DEFAULT '{}'`);
  }
  const decode=<T>(row:unknown):T=>{const data=row as Record<string,unknown>;return {...data,metadata:normalizeMetadata(JSON.parse(String(data.metadata||'{}')))} as T;};
  db.exec("INSERT OR IGNORE INTO flow_versions(docId,revision,title,xml,note,createdAt,metadata) SELECT id,revision,title,xml,'이력 기능 도입 시 저장본',updatedAt,metadata FROM flow_documents");
  function read(id:string):Document {
    const row=db.prepare('SELECT * FROM flow_documents WHERE id=?').get(id) as Document|undefined;
    if(!row)throw failure('문서를 찾을 수 없습니다.',404);
    return decode(row);
  }
  function save(raw:unknown,id?:string):Document {
    const input=raw as {title?:unknown;xml?:unknown;revision?:unknown;metadata?:unknown;note?:unknown;sessionId?:unknown;recoveredSessionId?:unknown;recoveredUpdatedAt?:unknown};
    if(!input || typeof input.title!=='string'||!input.title.trim()||input.title.length>160)throw failure('문서 제목은 1~160자입니다.');
    if(input.note!==undefined&&(typeof input.note!=='string'||input.note.length>500))throw failure('변경 메모는 500자 이내로 입력하세요.');
    const {xml,catalog}=inspectXml(input.xml);
    const key=id??randomUUID();
    db.exec('BEGIN IMMEDIATE');
    try {
      const prior=id?read(id):null;
      const metadata=normalizeMetadata(input.metadata??prior?.metadata);
      const revision=prior?.revision??0;
      if(id&&input.revision!==revision)throw failure('다른 창에서 수정되었습니다. 파일로 백업한 뒤 문서를 다시 여세요.',409);
      const updatedAt=new Date().toISOString();
      db.prepare('INSERT INTO flow_documents(id,title,xml,revision,updatedAt,metadata) VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET title=excluded.title,xml=excluded.xml,revision=excluded.revision,updatedAt=excluded.updatedAt,metadata=excluded.metadata').run(key,input.title.trim(),xml,revision+1,updatedAt,JSON.stringify(metadata));
      db.prepare('INSERT INTO flow_versions(docId,revision,title,xml,note,createdAt,metadata) VALUES(?,?,?,?,?,?,?)').run(key,revision+1,input.title.trim(),xml,typeof input.note==='string'?input.note.trim():'',updatedAt,JSON.stringify(metadata));
      db.prepare('DELETE FROM flow_interfaces WHERE docId=?').run(key);db.prepare('DELETE FROM flow_systems WHERE docId=?').run(key);
      const system=db.prepare('INSERT INTO flow_systems VALUES(?,?,?,?)');
      for(const s of catalog.systems)system.run(key,s.code,s.name,s.parentCode);
      const iface=db.prepare('INSERT INTO flow_interfaces VALUES(?,?,?,?,?,?,?,?)');
      for(const i of catalog.interfaces)iface.run(key,i.ifId,i.name,i.kind,i.channel,i.formatId,i.fromSystemCode,i.toSystemCode);
      if(typeof input.sessionId==='string')db.prepare('DELETE FROM flow_recoveries WHERE docId=? AND sessionId=?').run(key,input.sessionId);
      if(typeof input.recoveredSessionId==='string'&&typeof input.recoveredUpdatedAt==='string')db.prepare('DELETE FROM flow_recoveries WHERE docId=? AND sessionId=? AND updatedAt=?').run(key,input.recoveredSessionId,input.recoveredUpdatedAt);
      db.exec('COMMIT');return read(key);
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  function versions(id:string):VersionSummary[]{
    read(id);
    return db.prepare('SELECT docId,revision,title,note,createdAt,metadata FROM flow_versions WHERE docId=? ORDER BY revision DESC').all(id).map(row=>decode<VersionSummary>(row));
  }
  function version(id:string,revision:number):Version{
    read(id);
    const row=db.prepare('SELECT * FROM flow_versions WHERE docId=? AND revision=?').get(id,revision) as Version|undefined;
    if(!row)throw failure('버전을 찾을 수 없습니다.',404);
    return decode(row);
  }
  function restoreVersion(id:string,revision:number,raw:unknown):Document{
    const input=raw as {revision?:unknown;sessionId?:unknown};
    if(!input||!Number.isInteger(input.revision))throw failure('현재 문서 revision을 확인하세요.');
    const previous=version(id,revision);
    return save({title:previous.title,xml:previous.xml,metadata:previous.metadata,revision:input.revision,sessionId:input.sessionId,note:`v${revision} 복원`},id);
  }
  function recoveries(id:string):Recovery[]{
    read(id);
    return db.prepare('SELECT * FROM flow_recoveries WHERE docId=? ORDER BY updatedAt DESC').all(id).map(row=>decode<Recovery>(row));
  }
  function saveRecovery(id:string,raw:unknown):Recovery{
    const input=raw as Partial<Recovery>;
    if(!input||typeof input.sessionId!=='string'||!/^[a-zA-Z0-9-]{1,80}$/.test(input.sessionId)||typeof input.title!=='string'||!input.title.trim()||input.title.length>160)throw failure('복구본 정보를 확인하세요.');
    const {xml}=inspectXml(input.xml);
    db.exec('BEGIN IMMEDIATE');
    try{
      const saved=read(id),metadata=normalizeMetadata(input.metadata??read(id).metadata);
      if(saved.revision!==input.baseRevision)throw failure('다른 탭에서 문서가 저장되어 자동저장을 중단했습니다. 현재 내용을 파일로 백업한 뒤 다시 열어주세요.',409);
      const updatedAt=new Date().toISOString();
      if(saved.title===input.title.trim()&&saved.xml===xml&&JSON.stringify(saved.metadata)===JSON.stringify(metadata))db.prepare('DELETE FROM flow_recoveries WHERE docId=? AND sessionId=?').run(id,input.sessionId);
      else db.prepare('INSERT INTO flow_recoveries(docId,sessionId,title,xml,baseRevision,updatedAt,metadata) VALUES(?,?,?,?,?,?,?) ON CONFLICT(docId,sessionId) DO UPDATE SET title=excluded.title,xml=excluded.xml,baseRevision=excluded.baseRevision,updatedAt=excluded.updatedAt,metadata=excluded.metadata').run(id,input.sessionId,input.title.trim(),xml,input.baseRevision,updatedAt,JSON.stringify(metadata));
      db.exec('COMMIT');return {metadata,docId:id,sessionId:input.sessionId,title:input.title.trim(),xml,baseRevision:input.baseRevision,updatedAt};
    }catch(error){db.exec('ROLLBACK');throw error;}
  }
  if(!db.prepare('SELECT id FROM flow_documents LIMIT 1').get() && db.prepare("SELECT name FROM sqlite_master WHERE name='documents'").get()) {
    for(const row of db.prepare('SELECT * FROM documents').all()) {
      const old=row as unknown as {title:string;xml:string;diagram:string;systems:string;interfaces:string};
      save({title:old.title,xml:migrateXml(old)});
    }
  }
  return {read,save,versions,version,restoreVersion,recoveries,saveRecovery,db,list:()=>db.prepare('SELECT id,title,revision,updatedAt,metadata FROM flow_documents ORDER BY updatedAt DESC').all().map(row=>decode<DocumentSummary>(row)),close:()=>db.close()};
}
