export type Kind = 'TC' | 'EVENT' | 'API';
export const channels = {TC: 'EAI', EVENT: 'KAFKA', API: 'API_SYNC'} as const;
export type System = {code: string; name: string; parentCode: string | null};
export type Interface = {ifId: string; name: string; kind: Kind; channel: string; formatId: string | null; fromSystemCode: string; toSystemCode: string};
export type Catalog = {systems: System[]; interfaces: Interface[]};
export type Cell = {link?:string;fillColor?:string;strokeColor?:string;legendIncluded?:boolean;legendName?:string;legend?:boolean;styleMode?:'auto'|'custom';id: string; label: string; edge: boolean; source?: string; target?: string; systemCode: string; ifId: string; detail: string};
export type ConnectionConflict = {id:string;ifId:string;source:string;target:string;from:string;to:string;ifFrom:string;ifTo:string;shared:number;related:number};
export type Snapshot = {pages?:{id:string;name:string}[];conflicts?:ConnectionConflict[];elements?:import('../public/flow-styles.js').ElementDefinition[];styles:import('../public/flow-styles.js').Styles;showSystems: boolean; xml: string; catalog: Catalog; cells: Cell[]; selection: string[]; pageId: string};
export type Document = {metadata:DocumentMetadata;id: string; title: string; xml: string; revision: number; updatedAt: string};
export type DocumentSummary = Omit<Document, 'xml'>;
const record = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown, max = 2000): v is string => typeof v === 'string' && v.length <= max;
const code = (v: unknown): v is string => text(v, 160) && !!v.trim();
export function validateCatalog(value: unknown): asserts value is Catalog {
  if (!record(value) || !Array.isArray(value.systems) || !Array.isArray(value.interfaces) || value.systems.length > 5000 || value.interfaces.length > 5000) throw new Error('시스템·I/F 목록을 확인하세요.');
  const systems = value.systems;
  if (systems.some(s => !record(s) || !code(s.code) || !code(s.name) || !(s.parentCode === null || code(s.parentCode))) || new Set(systems.map(s => s.code)).size !== systems.length) throw new Error('시스템 코드·이름·중복을 확인하세요.');
  const codes = new Map(systems.map(s => [s.code, s]));
  for (const system of systems) {
    const seen = new Set([system.code]);
    let parent = system.parentCode;
    while (parent) {
      if (!codes.has(parent) || seen.has(parent)) throw new Error('상위 시스템이 없거나 계층이 순환합니다.');
      seen.add(parent); parent = codes.get(parent)!.parentCode;
    }
  }
  const interfaces = value.interfaces;
  if (interfaces.some(i => !record(i) || !code(i.ifId) || !code(i.name) || !Object.hasOwn(channels, String(i.kind)) || i.channel !== channels[i.kind as Kind] || !(i.formatId === null || text(i.formatId, 160)) || !codes.has(i.fromSystemCode) || !codes.has(i.toSystemCode)) || new Set(interfaces.map(i => i.ifId)).size !== interfaces.length) throw new Error('I/F 코드·이름·채널·송수신 시스템을 확인하세요.');
}
export function targetedIssues(snapshot: Snapshot): {id:string;message:string}[] {
  const systems = new Set(snapshot.catalog.systems.map(s => s.code));
  const defs = new Map(snapshot.catalog.interfaces.map(i => [i.ifId, i]));
  const cells = new Map(snapshot.cells.map(c => [c.id, c]));
  return snapshot.cells.flatMap(c => {
    const result = (message:string) => [{id:c.id,message}];
    if (!c.edge) return c.systemCode && !systems.has(c.systemCode) ? result(`${c.label}: 소속 시스템이 없습니다.`) : [];
    if (!c.ifId) return [];
    const def = defs.get(c.ifId);
    if (!def) return result(`${c.label || c.id}: I/F 정의가 없습니다.`);
    const source=cells.get(c.source || ''),target=cells.get(c.target || '');
    if(!source||!target)return result(`${c.ifId}: 연결선의 시작 또는 끝 도형이 없습니다.`);
    return (source.systemCode && source.systemCode !== def.fromSystemCode) || (target.systemCode && target.systemCode !== def.toSystemCode) ? result(`${c.ifId}: 연결 방향과 송수신 시스템이 다릅니다.`) : [];
  });
}

export type Recovery = {metadata:DocumentMetadata;docId:string;sessionId:string;title:string;xml:string;baseRevision:number;updatedAt:string};

export type Version = {metadata:DocumentMetadata;docId:string;revision:number;title:string;xml:string;note:string;createdAt:string};
export type VersionSummary = Omit<Version,'xml'>;

export const documentStatuses = {draft:'작성 중',review:'검토 중',complete:'완료'} as const;
export type DocumentMetadata = {description:string;tags:string[];status:keyof typeof documentStatuses};
export function normalizeMetadata(raw:unknown):DocumentMetadata {
  if(raw===undefined)return {description:'',tags:[],status:'draft'};
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new Error('문서 정보를 확인하세요.');
  const value=raw as Partial<DocumentMetadata>;
  const description=value.description??'',tags=value.tags??[],status=value.status??'draft';
  if(typeof description!=='string'||description.length>2000||!Array.isArray(tags)||tags.length>20||tags.some(tag=>typeof tag!=='string'||!tag.trim()||tag.trim().length>40)||!Object.hasOwn(documentStatuses,status))throw new Error('설명은 2,000자, 태그는 40자씩 최대 20개입니다. 상태도 확인하세요.');
  return {description:description.trim(),tags:[...new Set(tags.map(tag=>tag.trim()))],status};
}

export function issues(snapshot:Snapshot):string[]{return targetedIssues(snapshot).map(i=>i.message);}
