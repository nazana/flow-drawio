# 설계 재검토와 구현 기록

## 기존 작업에서 수정한 사항

1. draw.io 번들이 없어서 열리지 않던 iframe에 공식 고정 버전의 정적 앱을 포함했다.
2. 표준 embed protocol에 선택 이벤트가 있다고 가정한 코드를 제거했다. 로컬 플러그인이 실제 선택 모델을 관찰하고 호스트에 전달한다.
3. 도형 목록에서 그림 XML을 재생성하던 방식은 그룹·레이어·페이지·연결 경로를 잃을 수 있어 폐기했다. draw.io가 반환한 전체 XML을 원본으로 저장한다.
4. 속성 변경은 셀 value의 XML 속성만 수정한다. draw.io 모델 변경 경로를 사용하므로 undo/redo 기록에 포함된다.
5. 그림 XML과 정규화된 시스템·I/F 테이블을 하나의 SQLite 트랜잭션으로 저장한다. revision이 다른 오래된 저장 요청은 거부한다.
6. 편집기 밖 속성 패널로 포커스를 옮길 때 선택이 사라지던 현상을 수정했다.

## flow2 참고 결과

`flow2`는 읽기만 했다. `src/model.ts`의 시스템 코드·이름·상위 시스템, I/F 코드·이름·처리 종류·채널·포맷·송수신 시스템을 참고했다. TC→EAI, EVENT→KAFKA, API→API_SYNC 조합도 유지했다. `sysGroup: null`, 빈 `ext`는 현 기능에서 사용하지 않아 별도 편집 항목을 만들지 않았다.

flow2는 자체 IR의 노드·연결선·그룹·스윔레인·문서 연결과 수동 버전/자동저장 구조를 가진다. 이번 편집기에는 그림 표현을 draw.io에 맡기고, 첫 범위인 문서 저장·재조회와 시스템/I/F 속성만 구현했다. flow2 JSON 가져오기나 전체 기능 호환을 구현한 것은 아니다.

## 데이터와 통신

브라우저 React UI ↔ 같은 출처 iframe(draw.io + 로컬 브리지) → Node API → SQLite.

표준 JSON embed protocol은 초기화와 XML 로딩에 사용한다. `flow:*` 메시지는 선택·속성·전체 XML 조회를 담당한다. 양쪽 모두 메시지 source와 origin을 확인한다.

도형은 `systemCode`, 연결선은 `ifId`, 공통은 `label`과 `detail`을 XML 사용자 속성으로 가진다. 첫 페이지 root의 `flowCatalog`에 전체 정의 JSON을 포함하므로 `.drawio` 파일 하나로 그림과 정의를 함께 이동할 수 있다. DB의 시스템/I/F 테이블은 이 원본에서 추출한 조회용 데이터다.

`flow_documents`는 원본 XML·제목·revision·수정 시각, `flow_systems`와 `flow_interfaces`는 문서별 정의를 저장한다. 이전 flow-drawio 시제품 테이블은 최초 실행 때 새 테이블로 변환하고 원래 테이블은 보존한다.

## 기술 선택과 확장

SSR이나 검색 노출이 필요 없는 편집기이므로 Vite로 React 정적 앱을 빌드한다. Node 내장 HTTP·SQLite를 사용하며 Docker나 별도 draw.io 서버가 필요 없다. Node.js에서 TypeScript 타입을 제거해 서버를 실행한다.

복잡도가 늘면 기능 단위 UI 분리, API 권한 검사, 문서 버전 테이블을 실제 요구에 맞춰 추가한다. 사용자·쓰기 부하가 늘어 단일 서버 SQLite 운영의 한계에 도달하면 저장 모듈을 PostgreSQL로 바꾼다. 공동편집은 별도의 동시 편집 설계가 필요하다. SSR, 조직 인증 통합 또는 팀 배포 표준이 Next.js를 요구할 때 프레임워크 전환을 검토한다. 현재 브리지·도메인 검증·API 경계를 유지하면 편집기 통합을 다시 만들 필요는 없다.

## 고정한 외부 자산

- 공식 저장소: https://github.com/jgraph/drawio
- 버전: v31.4.6, commit `744cb5420fdf126efd7a09b1d7082ca3e12c0841`
- 반입 대상: `src/main/webapp` → `public/drawio`, upstream LICENSE 포함
- 변경: `js/PreConfig.js`의 offline/stealth 및 외부 서비스 비활성화 설정, `js/PostConfig.js`의 로컬 `flow-bridge.js` 로드
- draw.io 엔진 파일은 수정하지 않았다. 버전 교체 시 브리지와 embed 통합을 재검증해야 한다.

## 검증 기록 (2026-09-29)

- TypeScript 검사와 Vite production 빌드 통과.
- Node 테스트: XML 원본 왕복, 시스템/I/F 정규화 저장, revision 충돌 거부, 실패 시 기존 문서 보존, 잘못된 XML/DTD 거부, 압축 draw.io 읽기 통과.
- 실제 브라우저: 자체 호스팅 draw.io 로딩, ERP 도형 선택과 속성 패널, 도형 이름 변경, 시스템 이름 수정, I/F 이름 수정, 저장 후 새 브라우저 탭에서 도형 이름과 I/F 정의 재조회 확인.
- 운영 CSP로 외부 리소스 연결을 제한한 상태에서 위 흐름 확인. 물리적 망 분리, 별도 사내 서버, 다수 사용자 부하 검증은 하지 않았다.
- 다중 페이지·복잡한 그룹·이미지 내보내기의 전체 회귀 검증은 아직 하지 않았다. XML을 재작성하지 않도록 원본 저장 경로를 사용한다.
