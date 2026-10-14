import {useState} from 'react';
import type {Cell,Interface} from './model.ts';

const columns = [['ifId','I/F 코드'],['name','이름'],['kind','종류'],['channel','채널'],['fromSystemCode','송신'],['toSystemCode','수신'],['formatId','포맷']] as const;
export default function InterfaceTable({visible,onHide,rows,cells,selection,onSelect,onEdit}:{visible:boolean;onHide:()=>void;rows:Interface[];cells:Cell[];selection:Cell[];onSelect:(id:string)=>void;onEdit:(item:Interface)=>void}) {
  const [search,setSearch]=useState('');
  const [sort,setSort]=useState<{key:typeof columns[number][0];direction:1|-1}>({key:'ifId',direction:1});
  if(!visible)return null;
  const query=search.trim().toLocaleLowerCase();
  const filtered=rows.filter(row=>columns.some(([key])=>String(row[key]??'').toLocaleLowerCase().includes(query)))
    .sort((a,b)=>sort.direction*String(a[sort.key]??'').localeCompare(String(b[sort.key]??''),'ko',{numeric:true}));
  const edges=new Map<string,Cell[]>();
  for(const cell of cells)if(cell.edge&&cell.ifId){const matches=edges.get(cell.ifId);if(matches)matches.push(cell);else edges.set(cell.ifId,[cell]);}
  const selected=new Set(selection.filter(c=>c.edge).map(c=>c.ifId));
  return <section className="interface-table" aria-label="I/F 목록">
    <div className="table-toolbar"><button onClick={onHide}>I/F 목록 숨기기 · {rows.length}건</button>
      <input type="search" aria-label="I/F 표 검색" placeholder="코드·이름·송수신 검색" value={search} onChange={e=>setSearch(e.target.value)}/>
    </div>
    <div id="interface-table-content"><p className="table-hint">문서 전체 정의 · 연결선 버튼은 현재 페이지 기준 · 열 제목을 누르면 정렬됩니다.</p>
      <div className="table-scroll"><table><thead><tr>{columns.map(([key,label])=><th key={key} scope="col" aria-sort={sort.key===key?(sort.direction===1?'ascending':'descending'):'none'}><button onClick={()=>setSort({key,direction:sort.key===key&&sort.direction===1?-1:1})}>{label}{sort.key===key?(sort.direction===1?' ↑':' ↓'):''}</button></th>)}<th scope="col">현재 페이지 연결선</th><th scope="col">정의</th></tr></thead>
        <tbody>{filtered.map(row=><tr key={row.ifId} className={selected.has(row.ifId)?'selected':''}>
          {columns.map(([key])=><td key={key}>{row[key]||'—'}</td>)}
          <td>{edges.get(row.ifId)?.map((cell,index)=><button key={cell.id} aria-pressed={selection.some(s=>s.id===cell.id)} aria-label={`${row.ifId} 연결선 ${index+1} 선택`} title={cell.label||cell.id} onClick={()=>onSelect(cell.id)}>연결선 {index+1}</button>)??<span>없음</span>}</td>
          <td><button aria-label={`${row.ifId} 정의 수정`} onClick={()=>onEdit(row)}>수정</button></td>
        </tr>)}{!filtered.length&&<tr><td colSpan={9}>{rows.length?'검색 결과가 없습니다.':'등록된 I/F가 없습니다. 오른쪽 I/F 탭에서 추가하세요.'}</td></tr>}</tbody>
      </table></div>
    </div>
  </section>;
}
