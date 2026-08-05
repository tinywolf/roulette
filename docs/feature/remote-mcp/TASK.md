# Remote MCP 작업 계획

## Summary

- 기준 스펙: `docs/feature/remote-mcp/SPEC.md`
- 보조 요구사항 문서: 없음
- 대상 브랜치: `feature/remote-mcp`
- 최종 갱신일: 2026-08-05
- 전체 상태: `done`
- 진행률: 13/13
- 다음 작업: Deferred Work에서 Vercel Preview 배포와 원격 호스트별 검증을 별도 계획으로 시작한다.
- 현재 작업 완료 기준: 기존 텍스트 fallback을 유지하면서 MCP Apps 호환 호스트에 추첨 애니메이션을 제공하고, UI·서버·정적 웹의 빌드 경계와 로컬 검증을 모두 통과한다.
- 현재 작업 범위 제외: Vercel Preview·Production 배포, 배포 URL 검증, Vercel Runtime Logs·cold start·플랫폼 한도 검증, 실제 원격 MCP 클라이언트 E2E, 다중 클라이언트 운영 검증
- 기능 범위 제외: 인증·OAuth, 데이터베이스·KV·캐시, 추첨 감사·재현 기능, 상업적 운영
- 외부 작업: 현재 작업에서는 배포, 도메인 변경, 원격 MCP 클라이언트 등록을 수행하지 않는다.

### Open Questions

1. 해결됨: MCP SDK 2.0.0과 `mcp-handler` 2.1.0으로 고정하고 운영 의존성 취약점 0건을 확인했다.
2. 해결됨: `vercel build`는 ID 없는 임시 로컬 설정으로 통과했고, `vercel dev`는 OAuth·프로젝트 연결을 요구해 동등한 로컬 어댑터로 대체했다. 배포는 수행하지 않았다.
3. 해결됨: 신규 UI는 레거시 MCP-UI 프로토콜이 아니라 공식 MCP Apps 확장 표준의 `_meta.ui.resourceUri`와 `text/html;profile=mcp-app`을 사용한다.
4. 확인됨: MCP Apps는 코어 MCP가 아닌 확장 표준이므로 UI 렌더링을 지원하지 않는 호스트가 있다. Codex는 현재 공개된 MCP-UI 호환 호스트 목록에 없으므로 텍스트 fallback을 필수로 유지한다.

## Execution Order

1. T1에서 현재 웹앱의 입력 파싱·난수·추첨 로직을 프레임워크 독립적인 공통 코어로 추출한다.
2. T1 완료 후 T2의 웹 빌드 격리와 T3의 MCP 도구 구현을 진행한다. 두 작업은 소스 경계가 다르지만 패키지 설정 변경은 서로 조율한다.
3. T2와 T3을 바탕으로 T4에서 Streamable HTTP 엔드포인트와 Vercel 어댑터를 연결한다.
4. T5에서 공개 MCP에 필요한 개인정보·로그·오류 경계를 강화한다.
5. T6에서 전체 테스트와 번들 격리를 자동 검증하고, T7에서 사용·개발·개인정보 문서를 정리한다.
6. T8에서 Vercel 호환 로컬 실행·빌드와 MCP Inspector 검증을 수행하고 현재 작업을 완료한다.
7. Preview·Production 배포와 배포 후 검증은 별도 작업 계획으로 수립한다.
8. T9에서 2차 MCP Apps 계약을 확정하고 T10에서 격리된 UI를 만든 뒤, T11에서 기존 도구와 UI 리소스를 연결한다.
9. T12에서 프로토콜·UI·번들 경계를 로컬 검증하고 사용 가이드를 갱신한다.

## Tasks

### T1. 공통 코어 추출 및 기존 동작 보존

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 정적 웹앱과 MCP 서버가 동일한 입력 해석·난수·추첨 규칙을 공유하도록 프레임워크 독립적인 코어를 만든다.
- 작업 범위:
  - 현재 `src/domain/names.ts`, `src/domain/random.ts`, `src/domain/drawEngine.ts`, `src/domain/types.ts`의 책임과 의존성을 분석한다.
  - 이름 파싱과 후보 확장 규칙을 `src/core/input.ts`로 추출한다.
  - Web Crypto 기반 난수 인덱스와 Fisher–Yates 순열 생성을 `src/core/random.ts`로 추출한다.
  - 즉시 추첨 규칙을 `src/core/draw.ts`로 추출한다.
  - 후보·추첨 결과의 중립 타입을 `src/core/types.ts`로 분리한다.
  - 색상, 렌더링 상태, 자동·수동 진행 스케줄은 공통 코어에서 제외한다.
- 산출물:
  - `src/core/input.ts`
  - `src/core/random.ts`
  - `src/core/draw.ts`
  - `src/core/types.ts`
  - 공통 코어 단위 테스트
- 완료 조건:
  - 줄바꿈·쉼표 구분, `이름*반복`, 숫자 범위, 중복, 길이와 후보 수 제한이 기존과 동일하게 동작한다.
  - 추첨은 복원 없는 방식이며 유효 후보 전체를 한 번만 포함하는 순열을 만든다.
  - 편향을 피하기 위해 rejection sampling을 사용하고 `Math.random()` 대체 경로가 없다.
  - 공통 코어가 React, DOM, Canvas, MCP SDK, Vercel 런타임을 import하지 않는다.
  - 기존 웹 테스트가 공통 코어 추출 후에도 통과한다.
- 의존성: 없음
- 검증:
  - 공통 코어 테스트 실행
  - 기존 전체 테스트 실행
  - 코어 디렉터리의 금지 의존성 정적 검색
- `next_action`: 완료. T2에서 웹 전용 파일과 빌드 설정을 `src/web/` 경계로 이동한다.

### T2. 웹앱 소스 및 빌드 경계 격리

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 기존 정적 웹앱의 동작을 유지하면서 웹 전용 코드와 빌드가 MCP 전용 코드에 의존하지 않도록 분리한다.
- 작업 범위:
  - UI 컴포넌트, 웹 상태·스케줄 로직, 오디오, 로컬 저장소, Canvas 관련 코드를 `src/web/` 아래로 이동한다.
  - `src/web/components`, `src/web/domain`, `src/web/services`, `src/web/App.tsx`, `src/web/main.tsx` 경계를 적용한다.
  - `index.html`, Vite, Vitest 및 import 경로를 새 웹 엔트리 기준으로 갱신한다.
  - `tsconfig.base.json`과 `tsconfig.web.json`을 추가한다.
  - `build:web`, `test:web` 스크립트를 추가하고 기존 기본 명령의 호환성을 정리한다.
- 산출물:
  - `src/web/` 웹 전용 소스
  - `tsconfig.base.json`
  - `tsconfig.web.json`
  - 웹 전용 빌드·테스트 스크립트
- 완료 조건:
  - 기존 룰렛 입력, 자동·수동 추첨, 화면 표시, 오디오, 저장 기능이 회귀 없이 동작한다.
  - 웹 소스가 `src/mcp/`와 `api/`를 import하지 않는다.
  - 웹 빌드가 MCP SDK, Vercel 어댑터, 서버 전용 코드를 포함하지 않는다.
  - 웹 테스트와 정적 빌드가 독립 명령으로 성공한다.
- 의존성: T1
- 검증:
  - `npm run test:web`
  - `npm run build:web`
  - 웹 번들 및 import 그래프에서 MCP·Vercel 의존성 부재 확인
- `next_action`: 완료. T3에서 공통 코어만 사용하는 `draw_roulette` MCP 도구를 구현한다.

### T3. 범용 MCP 도구 계약 및 텍스트 결과 구현

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 에이전트가 완성된 옵션으로 호출할 수 있는 단일 `draw_roulette` 도구를 구현한다.
- 작업 범위:
  - Vercel에서 현재 지원되는 공식 MCP SDK와 `mcp-handler` 조합을 확인하고 정확한 버전을 잠금 파일에 고정한다.
  - `src/mcp/server.ts`에 서버 설명과 “모든 옵션을 사용자에게 확인한 뒤 호출” 지침을 정의한다.
  - `rawInput`과 `drawCount`를 필수로 받으며 추가 속성을 거부하는 입력 스키마를 정의한다.
  - `src/mcp/tools/drawRoulette.ts`에서 공통 코어를 호출해 전체 결과를 한 번에 결정한다.
  - `src/mcp/presentation/textResult.ts`에서 텍스트와 `structuredContent`를 함께 생성한다.
  - `INVALID_INPUT`, `INVALID_DRAW_COUNT`, `RANDOM_UNAVAILABLE`, `INTERNAL_ERROR` 오류를 안전한 형식으로 매핑한다.
  - 도구 annotation을 `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`로 설정한다.
- 산출물:
  - `src/mcp/server.ts`
  - `src/mcp/tools/drawRoulette.ts`
  - `src/mcp/presentation/textResult.ts`
  - MCP 스키마·도구·결과 단위 테스트
- 완료 조건:
  - 도구 이름은 `draw_roulette` 하나이며 `rawInput` 또는 `drawCount` 중 하나라도 없으면 호출에 실패한다.
  - `drawCount`는 `all` 또는 유효한 양의 정수만 허용하고 후보 수를 초과할 수 없다.
  - 정상 결과가 텍스트와 `candidateCount`, `drawCount`, `remainingCount`, 순번·ID·이름을 가진 `results`를 제공한다.
  - 결과는 점진적으로 공개하지 않고 한 번의 최종 응답으로 반환한다.
  - MCP 계층이 `src/web/`를 import하지 않는다.
  - 서버가 누락 옵션을 추측하거나 서버 상태로 보완하지 않는다.
- 의존성: T1
- 검증:
  - MCP 도구 단위 테스트
  - 입력 스키마 정상·경계·거부 사례 테스트
  - 텍스트와 구조화 결과의 일관성 테스트
- 열린 질문:
  - 구현 시점의 공식 호환성 자료를 기준으로 SDK와 `mcp-handler` 버전을 결정한다.
- `next_action`: 완료. T4에서 MCP 서버를 stateless Streamable HTTP Vercel Function으로 연결한다.

### T4. Streamable HTTP 및 Vercel Function 연결

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 상태를 저장하지 않는 공개 Remote MCP 엔드포인트로 배포할 수 있는 Vercel Function을 구현한다.
- 작업 범위:
  - `api/mcp.ts`에서 MCP 서버를 Vercel 요청·응답에 연결한다.
  - `/mcp` 경로에서 선택한 핸들러가 요구하는 Streamable HTTP 메서드를 처리한다.
  - 세션 저장소, Redis, KV 없이 stateless 방식으로 구성한다.
  - `tsconfig.mcp.json`과 `build:mcp` 스크립트를 추가한다.
  - 정적 웹앱 빌드와 MCP Function 빌드가 서로의 목적별 소스를 포함하지 않도록 Vercel 설정을 구성한다.
  - 로컬에서 HTTP 엔드포인트를 실행할 수 있는 개발 경로를 마련한다.
- 산출물:
  - `api/mcp.ts`
  - `tsconfig.mcp.json`
  - Vercel 및 MCP 전용 빌드 설정
  - HTTP 전송 계층 테스트
- 완료 조건:
  - `/mcp`가 표준 MCP 클라이언트의 초기화와 도구 목록·호출 요청에 응답한다.
  - 요청 간 후보·결과·세션 상태를 저장하지 않는다.
  - 웹 빌드와 MCP 빌드를 각각 독립적으로 실행할 수 있다.
  - 기존 정적 웹 배포 경로가 유지된다.
  - MCP Function 번들에 React, DOM, Canvas, 웹 UI 코드가 포함되지 않는다.
- 의존성: T2, T3
- 검증:
  - `npm run build:mcp`
  - 로컬 HTTP 전송 테스트
  - MCP 및 웹 산출물의 의존성·파일 목록 확인
- `next_action`: 완료. T5에서 공개 HTTP 요청과 로그·오류의 개인정보 경계를 강화한다.

### T5. 공개 MCP 개인정보·보안·오류 경계 강화

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 인증 없는 공개 서비스에서도 후보와 추첨 결과가 서버 로그·저장소·오류 응답에 남지 않도록 보장한다.
- 작업 범위:
  - 후보 원문, 파싱 결과, 추첨 결과를 출력하는 로그·예외·추적 코드를 제거하거나 금지한다.
  - 운영 관측 항목을 요청 시각, 성공 여부, 안전한 오류 코드 등 payload 비포함 메타데이터로 제한한다.
  - 원시 예외, stack trace, 요청 본문이 외부 오류 응답으로 노출되지 않도록 변환한다.
  - `Origin` 헤더가 존재하는 경우 허용 정책에 따라 검증하고, 헤더가 없는 표준 MCP 클라이언트 요청도 고려한다.
  - 데이터베이스, KV, 캐시, 분석 SDK, 외부 추적 호출이 없음을 점검한다.
  - 콘솔 출력과 오류 경로에 민감 정보가 포함되지 않는지 자동 테스트한다.
- 산출물:
  - 보안·개인정보 경계 코드
  - 오류·로그 비노출 테스트
  - 공개 엔드포인트 점검 체크리스트
- 완료 조건:
  - 정상·오류 요청 모두에서 후보와 결과가 애플리케이션 로그에 남지 않는다.
  - 오류 응답은 정의된 코드와 안전한 메시지만 제공한다.
  - 입력값, 결과, stack trace, 원시 예외가 클라이언트에 노출되지 않는다.
  - 영속 저장소와 외부 분석·추적 서비스가 사용되지 않는다.
  - 공개·무인증이라는 1차 정책이 코드와 문서에서 일치한다.
- 의존성: T3, T4
- 검증:
  - `npm run test:mcp`
  - 콘솔 spy를 사용한 정상·오류 로그 비노출 테스트
  - 로그 호출, 저장소 및 분석 의존성 정적 검색
- `next_action`: 완료. T6에서 목적별 테스트·빌드와 코드 경계 검사를 전체 검증 게이트로 묶는다.

### T6. 자동 회귀 테스트 및 빌드 격리 게이트 완성

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 공통 코어, 웹앱, MCP 서버를 독립적으로 검증하고 목적별 코드 혼입을 자동으로 차단한다.
- 작업 범위:
  - `test:core`, `test:web`, `test:mcp`, `build:web`, `build:mcp` 스크립트를 완성한다.
  - 전체 검증을 한 번에 수행하는 상위 스크립트를 정의한다.
  - 공통 코어의 파싱·난수 경계·복원 없는 추첨 테스트를 확장한다.
  - 웹 전체 회귀 테스트와 MCP 정상·오류 계약 테스트를 통합 실행한다.
  - 웹 번들에 MCP·Vercel 코드가 없고 MCP Function에 React·Canvas·브라우저 서비스가 없는지 자동 검사한다.
  - 깨끗한 설치 상태에서 빌드·테스트 재현성을 확인한다.
- 산출물:
  - 목적별 및 전체 검증 스크립트
  - 번들 격리 검사
  - 보강된 자동 테스트 모음
- 완료 조건:
  - 공통 코어, 웹, MCP 테스트가 각각 독립적으로 통과한다.
  - 웹과 MCP 빌드가 각각 독립적으로 성공한다.
  - 전체 검증 명령 하나로 모든 P0 자동 검증을 재현할 수 있다.
  - 목적에 맞지 않는 프레임워크·런타임 코드가 각 산출물에 포함되면 검증이 실패한다.
  - 기존 웹 기능의 회귀가 없다.
- 의존성: T2, T3, T4, T5
- 검증:
  - `npm run test:core`
  - `npm run test:web`
  - `npm run test:mcp`
  - `npm run build:web`
  - `npm run build:mcp`
  - 전체 검증 스크립트
- `next_action`: 완료. T7에서 구현된 구조와 로컬 검증·개인정보 경계를 문서화한다.

### T7. 개발·사용·개인정보 문서 정비

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 정적 웹앱과 공개 MCP의 서로 다른 데이터 경계와 실행·배포 절차를 명확하게 설명한다.
- 작업 범위:
  - 루트 README에서 정적 웹앱의 로컬 처리와 MCP 호출 시 외부 전송을 구분한다.
  - 기능 디렉터리에 로컬 개발, 테스트, 빌드와 후속 Vercel 배포·롤백 절차를 기록한다.
  - `/mcp`, `draw_roulette`, 입력 문법, 출력 형식, 오류 코드와 재시도 시 새 결과가 생성되는 특성을 문서화한다.
  - 후보·결과 무로그·무저장 정책과 안전한 메타데이터 범위를 문서화한다.
  - Vercel Hobby의 개인·비상업 사용 전제와 트래픽 한계를 명시한다.
  - 기존 아키텍처·개발 문서 중 서버가 없다는 전제가 사실과 달라지는 부분만 갱신하되 기존 `docs/SPEC.md`는 수정하지 않는다.
  - MCP Apps UI가 후속 범위임을 명시한다.
- 산출물:
  - 갱신된 README 및 관련 프로젝트 문서
  - `docs/feature/remote-mcp/` 하위 개발·배포 가이드
- 완료 조건:
  - 사용자가 정적 웹과 MCP의 개인정보 경계를 혼동하지 않도록 설명되어 있다.
  - 새 개발자가 목적별 테스트·빌드·로컬 실행을 재현하고 후속 배포 절차를 이해할 수 있다.
  - 공개·무인증·무로그·무저장 정책이 구현과 일치한다.
  - 기존 `docs/SPEC.md`에는 변경이 없다.
- 의존성: T4, T5
- 검증:
  - 문서 명령을 깨끗한 환경에서 실행해 결과 확인
  - 링크와 경로 유효성 확인
  - 구현과 문서의 엔드포인트·스키마·오류 코드 대조
- `next_action`: 완료. T8에서 로컬 HTTP·Inspector·Vercel 호환 빌드와 로그 비노출을 종합 검증한다.

### T8. Vercel 호환 로컬 종합 검증

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 배포하지 않고 Vercel Function 빌드·라우팅, Streamable HTTP 프로토콜, 결과와 개인정보 경계를 로컬에서 종합 검증한다.
- 작업 범위:
  - `vercel dev` 또는 동등한 로컬 Vercel 실행 경로로 `/mcp` Function을 실행한다.
  - 로컬 `/mcp`를 MCP Inspector에 Streamable HTTP로 연결해 초기화, 도구 목록, 도구 호출을 검증한다.
  - 일반 후보, 입력 문법, `all`, 일부 추첨, 경계값, 오류 사례를 실행한다.
  - `vercel build`로 로컬 Vercel Build Output을 생성하고 Function 엔트리, 라우팅과 번들 의존성을 검사한다.
  - 공개 `/mcp` 경로가 의도한 Function으로 연결되고 Vercel 산출물에 정적 웹앱이 포함되지 않는지 확인한다.
  - 여러 요청과 동시 요청에서 후보·결과·세션 상태가 공유되지 않는지 검증한다.
  - 로컬 프로세스 로그에 후보 원문과 추첨 결과가 남지 않는지 확인한다.
  - 로컬 검증으로 확인할 수 없는 Vercel 플랫폼 항목을 후속 검증 목록으로 확정한다.
- 산출물:
  - 로컬 MCP Inspector 검증 기록
  - 로컬 Vercel 실행·빌드 검증 기록
  - 로컬 로그 비노출 확인 기록
  - 배포 후 별도 검증 항목 목록
- 완료 조건:
  - 로컬 `/mcp`에서 표준 MCP 초기화, `tools/list`, `tools/call`이 성공한다.
  - 정상·오류·입력 문법·전체/일부 추첨 시나리오가 스펙과 일치한다.
  - `vercel build`가 성공하고 생성된 MCP Function 번들에 웹 전용 코드가 포함되지 않는다.
  - 공개 `/mcp` 라우팅이 정상이고 기존 정적 웹앱은 GitHub Pages 빌드에서 회귀가 없으며 Vercel에는 포함되지 않는다.
  - 복수·동시 호출 간 상태가 공유되지 않고 로컬 로그에 후보와 결과가 없다.
  - Preview·Production 배포를 생성하지 않는다.
- 의존성: T6, T7
- 검증:
  - 전체 자동 검증 스크립트
  - `vercel dev` 또는 동등한 로컬 어댑터 기반 HTTP·라우팅 검증
  - `vercel build` 산출물 검사
  - 로컬 MCP Inspector 수동·반자동 시나리오
  - 로컬 프로세스 로그 점검
- 열린 질문:
  - 해결됨: Build는 임시 로컬 설정으로 가능하고 Dev는 연결을 요구한다.
- `next_action`: 완료. Preview·Production 배포와 배포 후 검증은 별도 작업에서 수행한다.

### T9. MCP Apps 호환성 및 2차 계약 확정

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: MCP-UI를 공식 MCP Apps 확장 표준에 맞춰 도입하면서 기존 범용 MCP의 텍스트 동작과 개인정보 경계를 보존한다.
- 작업 범위:
  - MCP Apps와 MCP-UI의 현재 공식 규격, TypeScript SDK, 호스트 지원 범위를 확인한다.
  - UI 지원·비지원 호스트의 동작과 텍스트 fallback 계약을 정의한다.
  - 서버가 확정한 결과를 UI가 애니메이션으로만 표현하고 재추첨하지 않는 책임 경계를 정의한다.
  - 기존 `draw_roulette` 도구에 UI를 직접 연결할지 별도 렌더 도구를 둘지 사용자 흐름을 기준으로 결정한다.
  - 후보와 결과의 무로그·무저장 정책을 UI 리소스와 오류 경로까지 확장한다.
- 산출물:
  - 갱신된 `docs/feature/remote-mcp/SPEC.md`
  - 갱신된 `docs/feature/remote-mcp/TASK.md`
- 완료 조건:
  - `_meta.ui.resourceUri`와 `text/html;profile=mcp-app`을 사용하는 표준 계약이 명시되어 있다.
  - UI가 없는 호스트에서도 기존 텍스트와 `structuredContent`로 전체 흐름을 완료할 수 있다.
  - 호스트 지원 범위와 Codex 로컬 테스트의 한계가 문서에 명시되어 있다.
  - 추첨 결과의 유일한 원본이 서버의 `draw_roulette` 결과임이 명시되어 있다.
- 의존성: T8
- 검증:
  - MCP Apps, MCP-UI 공식 문서와 구현 계약 대조
  - 기존 SPEC의 1차 계약과 충돌 여부 검토
- `next_action`: 완료. T10에서 자체 포함 룰렛 UI와 전용 빌드·테스트를 구현한다.

### T10. 격리된 룰렛 MCP App UI 구현

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 기존 정적 웹앱과 독립된 단일 파일 룰렛 UI를 구현해 MCP Apps 호스트의 sandbox iframe에서 실행한다.
- 작업 범위:
  - `src/mcp-apps/roulette/`에 UI 엔트리, 스타일, 결과 검증·표현 코드를 둔다.
  - MCP Apps 브리지로 최종 `structuredContent`를 수신하고 추첨 순서대로 애니메이션을 재생한다.
  - 외부 네트워크, 저장소, 분석, 오디오 없이 단일 HTML 리소스로 번들한다.
  - 애니메이션 감소 설정과 작은 화면을 고려한 접근성·반응형 표현을 제공한다.
  - 정적 웹 빌드와 MCP 서버 타입 검사에서 UI 소스 경계를 분리한다.
- 산출물:
  - `src/mcp-apps/roulette/` UI 소스
  - MCP App 전용 타입·빌드 설정
  - UI 단위 테스트
- 완료 조건:
  - 유효한 최종 결과를 받아 당첨 순서를 애니메이션으로 표시한다.
  - UI가 난수를 생성하거나 서버 도구를 다시 호출하지 않는다.
  - 사용자 입력과 결과를 HTML로 삽입하지 않고 텍스트 데이터로 안전하게 렌더링한다.
  - 외부 origin 연결 없이 자체 포함 리소스로 동작한다.
- 의존성: T9
- 검증:
  - `test:mcp-app`
  - `build:mcp-app`
  - 결과 스키마·XSS·접근성·애니메이션 감소 테스트
- `next_action`: 완료. T11에서 빌드된 리소스를 기존 `draw_roulette` 메타데이터와 연결한다.

### T11. 기존 추첨 도구와 UI 리소스 연결

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: `draw_roulette`의 결과·오류 계약을 유지하면서 호환 호스트가 룰렛 UI 리소스를 발견하고 렌더링하게 한다.
- 작업 범위:
  - 버전이 포함된 안정적인 `ui://` 리소스를 MCP 서버에 등록한다.
  - `draw_roulette` 도구 메타데이터를 UI 리소스 URI에 연결한다.
  - 기존 텍스트와 `structuredContent` 응답을 변경 없이 유지한다.
  - UI 리소스 응답에 최소 CSP와 무캐시·무외부연결 정책을 적용한다.
  - 로컬·Vercel Function 빌드가 생성된 UI 리소스를 포함하도록 구성한다.
- 산출물:
  - MCP Apps 도구·리소스 등록 코드
  - 프로토콜 통합 테스트
- 완료 조건:
  - `tools/list`에서 UI resource URI를 확인할 수 있다.
  - `resources/read`가 올바른 MIME의 자체 포함 HTML을 반환한다.
  - `tools/call`은 기존 텍스트·구조화 결과를 계속 반환한다.
  - UI 비지원 클라이언트와 기존 Inspector 호출이 회귀 없이 동작한다.
- 의존성: T10
- 검증:
  - MCP SDK 클라이언트의 도구 목록·리소스 조회·도구 호출 통합 테스트
  - 기존 MCP 테스트 전체 실행
- `next_action`: 완료. T12에서 호환 로컬 UI 호스트의 실제 렌더링과 전체 빌드 경계를 검증한다.

### T12. MCP App 로컬 종합 검증 및 문서화

- 상태: `done`
- 우선순위: P0
- 진행: [x]
- 목적: 배포하지 않고 MCP Apps 렌더링, 텍스트 fallback, 개인정보와 목적별 번들 격리를 검증하고 실행 방법을 문서화한다.
- 작업 범위:
  - MCP Apps 호환 로컬 UI Inspector 또는 참조 호스트에서 애니메이션을 검증한다.
  - Codex와 일반 MCP Inspector에서는 텍스트 fallback과 도구 계약을 재검증한다.
  - 웹·MCP App·MCP Function의 목적별 빌드와 금지 의존성 경계를 자동 검사한다.
  - README와 기능 개발 가이드에 UI 지원 조건과 로컬 실행·검증 절차를 추가한다.
  - Vercel 배포 후 UI 호스트 검증 항목을 Deferred Work에 추가한다.
- 산출물:
  - 자동 검증 스크립트와 로컬 검증 기록
  - 갱신된 README·개발 가이드
- 완료 조건:
  - 호환 참조 호스트에서 결과 애니메이션이 렌더링된다.
  - 비호환 호스트에서 텍스트 결과가 누락되지 않는다.
  - 전체 자동 테스트와 세 빌드 경계 검사가 통과한다.
  - 후보·결과가 로그·저장소·외부 요청에 남지 않는다.
- 의존성: T11
- 검증:
  - 전체 `verify` 명령
  - 로컬 UI Inspector 시나리오
  - Vercel 호환 로컬 빌드 및 산출물 검사
- `next_action`: 완료. Preview·Production 배포와 원격 MCP Apps 호스트 검증은 Deferred Work에서 별도로 진행한다.

### T13. MCP App 렌더링 방향 검토 및 기존 룰렛 복원

- 상태: `done`
- 우선순위: P1
- 진행: [x]
- 목적: 웹 수준의 2D 추첨기 공용화가 필수가 아닌 상황에서 호스트 제약과 구조 복잡도를 재평가하고 MCP 전용 경량 룰렛 UI를 유지한다.
- 작업 범위:
  - 실험한 Canvas 2D 추첨기 렌더러와 관련 테스트를 제거한다.
  - T12에서 검증한 CSS 룰렛 회전 UI, 1.45초 회전과 당첨 순차 공개를 복원한다.
  - UI 리소스 `ui://roulette/roulette-v1.html`과 서버·문서·테스트 버전을 복원한다.
  - 웹과 MCP 렌더링은 독립적으로 유지하고 입력·추첨 규칙과 결과 계약만 공유한다.
- 완료 조건:
  - Inspector에서 기존 원형 룰렛과 당첨 결과가 표시된다.
  - Canvas 추첨기 코드와 신규 UI 리소스 버전 참조가 남지 않는다.
  - 기존 MCP Apps 연결, 텍스트 fallback과 제품별 빌드 경계가 유지된다.
- 검증:
  - 총 23개 파일·154개 테스트와 전체 빌드·경계 검사
  - MCP Inspector Apps 실제 렌더링 및 브라우저 오류 확인
  - Vercel 호환 로컬 빌드 및 Function 전용 산출물 검사
- `next_action`: 완료. Preview·Production 배포와 원격 MCP Apps 호스트 검증은 Deferred Work에서 별도로 진행한다.

## Deferred Work

다음 항목은 현재 작업의 완료 조건이 아니며, T8 완료 후 별도 작업 계획과 상태로 관리한다.

1. Vercel Preview 배포 및 검증
   - 실제 `/mcp` HTTPS 라우팅, cold start, Function Runtime Logs, 플랫폼 실행·번들 제한, 정적 웹앱 회귀를 확인한다.
2. Vercel Production 배포 및 실제 원격 MCP 클라이언트 E2E
   - 옵션 누락 시 대화 수집, 옵션 완성 시 즉시 호출, 텍스트·구조화 결과, Production 로그와 롤백을 확인한다.
3. 출시 후 운영 안정화
   - 다중 클라이언트 호환성, payload 비포함 관측, Hobby 한도·남용 대응과 의존성 업데이트 절차를 관리한다.

## Requirements Coverage

| 스펙 영역 | 대응 작업 |
| --- | --- |
| 사용자 흐름과 입력 문법 | T1, T3, T8 |
| 난수·추첨 규칙 | T1, T3, T6 |
| MCP 도구·응답·오류 계약 | T3, T5, T8 |
| 공통 코어·웹·MCP 구조 격리 | T1, T2, T4, T6 |
| Streamable HTTP와 Vercel 배포 준비 | T4, T8 |
| 공개 서비스 보안·개인정보의 로컬 검증 | T5, T7, T8 |
| 자동 테스트와 배포 전 로컬 검증 | T6, T8 |
| MCP Apps UI와 텍스트 fallback | T2, T7, T9, T10, T11, T12, T13 |
| Vercel Hobby 운영 제약 문서화 | T7 |

### 현재 작업에서 미완료로 남는 스펙 요구사항

| 스펙 요구사항 | 후속 작업 |
| --- | --- |
| Vercel Preview·Production 배포 | Deferred Work 1, 2 |
| 배포 환경의 HTTPS·cold start·Runtime Logs·플랫폼 한도 검증 | Deferred Work 1, 2 |
| 실제 원격 MCP 클라이언트의 대화 기반 E2E | Deferred Work 2 |
| 다중 클라이언트 및 출시 후 운영 안정화 | Deferred Work 3 |

## Resume Guide

1. Summary의 `다음 작업`과 해당 작업의 상태를 확인한다.
2. 작업을 시작할 때 상태를 `in_progress`로 바꾸고 `next_action`을 실제 첫 행동으로 갱신한다.
3. 새 미정 사항이 발견되면 Summary의 Open Questions와 영향을 받는 작업 양쪽에 기록한다.
4. 완료 조건과 검증을 모두 통과한 뒤에만 상태를 `done`으로 바꾼다.
5. 작업 완료 후 다음 선행 조건을 충족한 작업을 Summary의 `다음 작업`으로 지정하고 진행률을 갱신한다.
6. T8을 완료하면 현재 작업 상태를 `done`으로 바꾸고, 배포 및 원격 검증은 별도 TASK 문서나 후속 브랜치에서 새 작업 ID로 시작한다.

## 진행 로그

- 2026-08-05 11:30 | 단계: T1 | 상태: `in_progress` → `done`
  - 요약: 입력 파서와 Web Crypto 난수 로직을 공통 코어로 추출하고 상태 없는 즉시 비복원 추첨 함수를 추가했다.
  - 산출물: `src/core/input.ts`, `src/core/random.ts`, `src/core/draw.ts`, `src/core/types.ts`와 공통 추첨 테스트
  - 검증: Vitest 15개 파일·112개 테스트 통과, TypeScript 및 Vite 프로덕션 빌드 통과
  - 리스크_또는_차단: 없음
  - 다음: T2 웹앱 소스 및 빌드 경계 격리
  - 사용자_피드백: 단계별 중단 없이 진행 요청 반영
- 2026-08-05 11:33 | 단계: T2 | 상태: `in_progress` → `done`
  - 요약: 기존 React·Canvas·브라우저 저장 코드를 `src/web/`으로 이동하고 웹 전용 TypeScript·Vitest·Vite 경계를 구성했다.
  - 산출물: `src/web/`, `tsconfig.base.json`, `tsconfig.web.json`, `vitest.web.config.ts`, `build:web`, `test:web`
  - 검증: 웹 테스트 14개 파일·110개 테스트, 전체 15개 파일·112개 테스트, 웹 타입 검사와 Vite 빌드 통과
  - 리스크_또는_차단: README의 기존 `src/domain/` 설명은 T7에서 갱신 예정
  - 다음: T3 범용 MCP 도구 계약 및 텍스트 결과 구현
  - 사용자_피드백: 단계별 중단 없이 진행 요청 반영
- 2026-08-05 11:37 | 단계: T3 | 상태: `in_progress` → `done`
  - 요약: 공식 호환 버전을 고정하고 엄격한 `draw_roulette` 스키마, 서버 지침, 안전성 annotation, 텍스트·구조화 결과와 안정적인 오류 코드를 구현했다.
  - 산출물: `src/mcp/server.ts`, `src/mcp/tools/drawRoulette.ts`, `src/mcp/presentation/textResult.ts`, `src/mcp/errors.ts`, MCP 테스트·타입 설정
  - 검증: MCP 테스트 2개 파일·6개 테스트, MCP 타입 검사, 웹 테스트 110개와 웹 빌드 통과
  - 리스크_또는_차단: 스키마 단계에서 거부되는 누락·타입 오류는 SDK 표준 Invalid params로 처리되고, 의미상 오류는 정의된 도구 오류 코드로 처리됨
  - 다음: T4 Streamable HTTP 및 Vercel Function 연결
  - 사용자_피드백: 단계별 중단 없이 진행 요청 반영
- 2026-08-05 11:39 | 단계: T4 | 상태: `in_progress` → `done`
  - 요약: stateless `mcp-handler`를 Vercel Function에 연결하고 외부 `/mcp` rewrite와 실제 SDK Streamable HTTP 통합 테스트를 추가했다.
  - 산출물: `api/mcp.ts`, `src/mcp/integration/mcpFunction.test.ts`, `vercel.json`, `tsconfig.mcp.json`, `build:mcp`
  - 검증: MCP 통합 포함 3개 파일·9개 테스트, MCP 타입 검사, 웹 테스트 110개와 웹 빌드 통과
  - 리스크_또는_차단: 실제 Vercel rewrite 동작은 T8의 `vercel dev`·`vercel build`에서 재검증 예정
  - 다음: T5 공개 MCP 개인정보·보안·오류 경계 강화
  - 사용자_피드백: 단계별 중단 없이 진행 요청 반영
- 2026-08-05 11:41 | 단계: T5 | 상태: `in_progress` → `done`
  - 요약: same-origin 요청 정책, 16KiB 본문 제한, 비저장 보안 헤더와 payload 비포함 오류 응답을 적용했다.
  - 산출물: `src/mcp/http/requestPolicy.ts`와 정책·로그 비노출 자동 테스트
  - 검증: MCP 4개 파일·13개 테스트, MCP 타입 검사, 웹 테스트 110개와 웹 빌드 통과
  - 리스크_또는_차단: Vercel 플랫폼 자체 Runtime Logs의 최종 확인은 별도 배포 후 작업으로 유보
  - 다음: T6 자동 회귀 테스트 및 빌드 격리 게이트 완성
  - 사용자_피드백: 단계별 중단 없이 진행 요청 반영
- 2026-08-05 11:43 | 단계: T6 | 상태: `in_progress` → `done`
  - 요약: 코어 전용 테스트를 보강하고 목적별 테스트·빌드와 소스·웹 번들 경계 검사를 전체 검증 명령으로 자동화했다.
  - 산출물: `vitest.core.config.ts`, 코어 입력·난수 테스트, `verify:boundaries`, `verify` 스크립트
  - 검증: 코어 20개, 웹 110개, MCP 13개 테스트와 웹·MCP 빌드 및 경계 검사 통과
  - 리스크_또는_차단: 실제 Vercel Build Output의 Function 번들 검사는 T8에서 수행 예정
  - 다음: T7 개발·사용·개인정보 문서 정비
  - 사용자_피드백: 단계별 중단 없이 진행 요청 반영
- 2026-08-05 11:55 | 단계: T7 | 상태: `in_progress` → `done`
  - 요약: 정적 웹과 MCP의 실행·데이터 경계를 README, 아키텍처, 개발 가이드와 기능 전용 가이드에 반영했다. 보안 감사에서 발견된 기존 SDK 경로를 MCP SDK 2.0과 `mcp-handler` 2.1로 교체했다.
  - 산출물: `README.md`, `docs/architecture.md`, `docs/development.md`, `docs/feature/remote-mcp/DEVELOPMENT.md`
  - 검증: 문서에 제시한 코어 입력 테스트 14개와 전체 143개 테스트·웹/MCP 빌드·경계 검사 통과, 운영 의존성 취약점 0건, 민감정보 패턴 없음
  - 리스크_또는_차단: Vercel CLI 자체 개발 의존성 트리의 audit 경고 때문에 저장소에는 고정하지 않고 T8의 격리된 임시 환경에서만 사용
  - 다음: T8 Vercel 호환 로컬 종합 검증
  - 사용자_피드백: 단계별 중단 없이 진행 요청 반영
- 2026-08-05 12:10 | 단계: T8 | 상태: `in_progress` → `done`
  - 요약: 실제 MCP Inspector의 목록·정상·오류·전체·중복·동시 호출과 무로그를 확인하고, 격리 Vercel CLI로 Function 전용 Build Output을 생성·검사했다. Vercel에서 정적 웹이 중복 배포되지 않도록 웹 빌드를 제거했다.
  - 산출물: `docs/feature/remote-mcp/LOCAL-VALIDATION.md`, 로컬 MCP 어댑터, Inspector 스크립트, Vercel Build Output 검사 도구, Function 전용 `vercel.json`
  - 검증: 총 21개 파일·143개 테스트, 웹·MCP 빌드, Inspector E2E, Vercel CLI 58.5.1 빌드와 산출물 경계, 운영 의존성 취약점 0건 통과
  - 리스크_또는_차단: `vercel dev`는 미연결 상태에서 OAuth를 요구해 동등 로컬 어댑터로 검증함. 실제 HTTPS·Runtime Logs·cold start는 배포 후 범위
  - 다음: Deferred Work의 Preview 배포 및 배포 후 검증
  - 사용자_피드백: Vercel은 MCP Function 전용으로 유지하고 기존 정적 웹은 GitHub Pages 배포를 계속 사용
- 2026-08-05 12:23 | 단계: 완료 후 구조 정리 | 상태: `done`
  - 요약: 문서 디렉터리에 있던 실행·검증 도구를 루트 `tools/remote-mcp/`로 이동하고 모든 실행 경로와 구조 문서를 갱신했다.
  - 검증: 전체 143개 테스트·웹/MCP 빌드·경계 검사와 이동된 로컬 서버의 Inspector `tools/list` 통과
  - 리스크_또는_차단: 없음
  - 사용자_피드백: `docs`는 문서 전용 위치로 유지
- 2026-08-05 13:10 | 단계: T9 | 상태: `in_progress` → `done`
  - 요약: 신규 UI를 공식 MCP Apps 확장 표준에 맞추고 기존 `draw_roulette`에 직접 연결하며, UI 비지원 호스트에는 텍스트 fallback을 유지하는 2차 계약을 확정했다.
  - 산출물: 갱신된 `docs/feature/remote-mcp/SPEC.md`, `docs/feature/remote-mcp/TASK.md`
  - 검증: MCP Apps 2026-01-26 안정 규격, MCP-UI TypeScript 가이드와 공개 호스트 지원 목록 대조
  - 리스크_또는_차단: Codex는 현재 공개 MCP-UI 호환 호스트 목록에 없으므로 로컬 Codex에서는 UI 렌더링 대신 텍스트 fallback만 검증 가능
  - 다음: T10 격리된 룰렛 MCP App UI 구현
  - 사용자_피드백: MCP Apps를 사실상 표준으로 보고 표준 우선 구현을 진행하되 호스트 비호환 가능성을 확인
- 2026-08-05 13:25 | 단계: T10 | 상태: `in_progress` → `done`
  - 요약: Vanilla TypeScript와 MCP Apps 브리지로 서버 결과만 표현하는 룰렛 애니메이션을 구현하고 MCP-UI로 표준 단일 HTML 리소스를 생성했다.
  - 산출물: `src/mcp-apps/roulette/`, `tsconfig.mcp-app.json`, `vite.mcp-app.config.ts`, `vitest.mcp-app.config.ts`, 리소스 생성 도구
  - 검증: UI 모델·소스 경계 10개 테스트와 전용 타입 검사·단일 HTML 빌드 통과, gzip 기준 약 84KB
  - 리스크_또는_차단: UI 렌더링은 호스트의 MCP Apps 지원이 필요하며 UI 자체는 추첨이나 도구 재호출을 수행하지 않음
  - 다음: T11 기존 추첨 도구와 UI 리소스 연결
  - 사용자_피드백: 공식 MCP Apps 표준 우선 구현
- 2026-08-05 13:40 | 단계: T11 | 상태: `in_progress` → `done`
  - 요약: 기존 `draw_roulette`에 표준 UI 리소스 URI와 ChatGPT 호환 alias를 연결하고, MCP SDK 2.x의 리소스 API로 자체 포함 HTML을 제공했다.
  - 산출물: `src/mcp/resources/rouletteApp.ts`, 갱신된 서버 등록·통합 테스트, MCP-UI 생성 리소스
  - 검증: MCP 테스트 14개 통과, Inspector `tools/list`, `resources/list`, App probe와 실제 `tools/call` 통과
  - 리스크_또는_차단: `@mcp-ui/server`는 빌드 시점에만 사용해 현재 MCP SDK 2.x 런타임과 구형 SDK 의존성의 등록 충돌을 차단함
  - 다음: T12 MCP App 로컬 종합 검증 및 문서화
  - 사용자_피드백: UI 비지원 호스트의 텍스트 fallback 유지
- 2026-08-05 13:40 | 단계: T12 | 상태: `in_progress` → `done`
  - 요약: MCP Inspector의 실제 sandbox iframe에서 룰렛 UI를 렌더링하고, 텍스트 fallback·개인정보·목적별 번들 경계를 전체 검증과 문서에 반영했다.
  - 산출물: 보강된 경계·Vercel 산출물 검사, `README.md`, 아키텍처·개발 가이드, 갱신된 로컬 검증 기록
  - 검증: 총 23개 파일·154개 테스트, 웹·MCP App·MCP 빌드, Inspector UI 렌더링·브라우저 오류 0건, Vercel CLI 58.5.1 Function 전용 Build Output, 전체 의존성 취약점 0건 통과
  - 리스크_또는_차단: Inspector 2.0.0 npm 패키지의 sandbox 파일 누락은 공식 파일 복원으로 로컬 검증했으며, Codex UI 렌더링과 실제 원격 호스트 호환성은 배포 후 범위
  - 다음: Deferred Work의 Preview 배포 및 원격 호스트별 검증
  - 사용자_피드백: MCP Apps를 표준 우선으로 제공하되 비지원 호스트의 텍스트 fallback 유지
- 2026-08-05 14:14 | 단계: T13 | 상태: `in_progress` → `done`
  - 요약: 웹 수준 Canvas 추첨기 실험을 제거하고 T12의 경량 CSS 룰렛 회전 UI와 `roulette-v1` 리소스를 복원했다.
  - 산출물: T13 이전 MCP App 소스·생성 리소스·서버 버전·테스트·문서 복원, 갱신된 작업 기록
  - 검증: 총 23개 파일·154개 테스트와 세 제품 빌드·경계 검사, Inspector 룰렛 렌더링·브라우저 오류 0건, Vercel Function 전용 Build Output 통과
  - 리스크_또는_차단: MCP UI는 웹의 사실적 추첨기와 시각적으로 다르지만 제품별 제약과 독립적인 발전을 우선함
  - 다음: Deferred Work의 Preview 배포 및 원격 호스트별 검증
  - 사용자_피드백: 동등 UX가 필수가 아니므로 웹과 MCP 렌더링을 별도로 유지하고 이전 룰렛 방식으로 롤백
