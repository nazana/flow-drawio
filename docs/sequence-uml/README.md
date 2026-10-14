# 시퀀스 종합 샘플

문서: `시퀀스 종합 샘플 · 실행 상자와 UML 표기`

편집 파일: [sequence-complete.drawio](sequence-complete.drawio)

| 페이지 | 포함 요소 |
|---|---|
| 1 실행 상자 · 공장 전문 | 7개 시스템, 20개 전문, 생명선, 실행 상자 11개, 동기 호출, 반환, 비동기 신호 |
| 2 분기 · 반복 · 병렬 | alt / guard / else, opt, loop, par, critical, break, 피연산자 구분선 |
| 3 생성 · 종료 · 자기 호출 | 중첩 실행, 자기 호출, 생성 메시지, 삭제 메시지와 X, ref, 상태 불변식, found/lost 메시지, gate, 시간·기간 제약, continuation, 노트 |
| 4 고급 상호작용 표기 | seq, strict, neg, assert, ignore, consider |

파란 직사각형은 실행 상자(execution specification)다. 생명선의 자식 도형으로 저장하며, 1페이지의 전문은 상자에 직접 연결된다. 새 객체의 실행 상자는 생성 이후에 시작하고 삭제 X 전에 끝난다.

모든 요소는 draw.io 기본 도형과 연결선으로 편집 가능하다. I/F 메타데이터는 1페이지 전문 20개에 연결된다. 2~4페이지는 표기 학습용 예제로 I/F를 강제로 지정하지 않는다. 같은 문서 안에서 카탈로그는 유지된다.

주요 표기와 결합 단편 연산자 12종을 담았다. UML 메타모델의 모든 개념을 열거하거나 UML 의미를 자동 검증하는 도구는 아니다. 시간 제약은 예시 주석이며 런타임 시간 측정 기능은 없다. ref/continuation은 표기 예시로 페이지 이동 링크가 아니다.

기준: [OMG UML 2.5.1](https://www.omg.org/spec/UML/2.5.1/), [StarUML 시퀀스 표기](https://docs.staruml.io/working-with-uml-diagrams/sequence-diagram).

검증: XML 구문, 페이지별 ID 중복·부모·연결 참조, 카탈로그 20개를 확인했다. 로컬 API 저장 후 실제 자체 호스팅 편집기에서 4개 페이지를 열어 배치와 실행 상자를 확인했다.

실제 화면 캡처: [실행 상자](01-activations.jpg), [결합 단편](02-fragments.jpg), [생명주기](03-lifecycle.jpg), [고급 표기](04-advanced.jpg).

## 문서별 팔레트

시퀀스 초안에는 `flowDiagramType="sequence"`를 저장한다. 이전 문서는 생명선이 있으면 시퀀스 유형으로 인식한다. 시퀀스 문서는 기본 도형 대신 시퀀스 팔레트를 먼저 열고 스크래치 패드를 유지한다. ‘그 외 도형’으로 추가한 라이브러리는 `flowPaletteLibraries`에 저장해 다시 열 때 복원한다. 일반 문서는 일반·기본·화살표·순서도 팔레트로 시작한다. 팔레트는 삽입할 도형 목록만 바꾸며 캔버스 요소는 바꾸지 않는다.

확인: 일반 문서 전환, 시퀀스 저장본 재열기, 다른 라이브러리 추가, ‘이 설정 기억하기’를 끈 상태의 문서 저장을 실제 화면과 저장 XML에서 확인했다. `npm run build` 통과. [팔레트 화면](05-sequence-palette.jpg).
