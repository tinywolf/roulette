---
revision: 94d57b666972420f324eb51b0445223bb9564482
updated_at: 2026-08-14T16:56:40+09:00
---

# 개발 가이드

## 개발 환경

- Node.js 22 이상
- npm 10 이상
- 웹 확인용 최신 Chromium, Safari, Firefox 또는 Edge

저장소 루트에서 설치한다.

```bash
npm install
```

## 코드 구조와 의존성 규칙

```text
api/          Vercel Function과 HTTP 정책
src/core/     웹·MCP 공통 순수 규칙
src/web/      선택 셸과 추첨기별 수직 기능
src/mcp-apps/ MCP Apps UI와 생성 리소스
src/mcp/      MCP 도구·리소스·표현 전용 제품
tools/        로컬 실행과 빌드·경계 검증 도구
```

허용 방향은 `web → core ← mcp ← api`다. 웹 내부에서는 `App → features/<type>/index.ts → 기능 내부·core` 방향만 허용한다. `mcp-apps`는 독립 빌드하며 MCP 서버에는 생성된 HTML 리소스만 전달한다.

- `core`에서 React, DOM, MCP SDK, Vercel API를 import하지 않는다.
- `web`과 `mcp`는 서로 import하지 않는다.
- `mcp-apps`는 `core`, `web`, `mcp`, `api`를 import하지 않으며 서버 난수와 도구 호출을 수행하지 않는다.
- `src/web/App.tsx`는 기능별 `index.ts` 공개 진입점만 import하고 `domain`, `components`, `services`에 직접 접근하지 않는다.
- `features/lottery`와 `features/wheel`은 서로 import하지 않으며 셸 모듈로 역방향 의존하지 않는다.
- 로또 수동·자동 일정과 렌더링 타입은 `src/web/features/lottery` 내부에 둔다.
- 돌림판 복원 세션, 각도, SVG UI, 저장과 음향은 `src/web/features/wheel` 내부에 둔다.
- 후보 파싱, 난수와 즉시 추첨처럼 여러 제품에서 같은 의미인 규칙만 `src/core`에 둔다.
- MCP 요청 변환과 보안 헤더는 `api`에 두고 코어로 밀어 넣지 않는다.
- 독립 모듈·컴포넌트에는 역할과 책임을 설명하는 주석을 추가한다.

## 웹 개발

개발 서버를 실행한다.

```bash
npm run dev
```

기본 주소는 `http://localhost:5173`이다. 다른 포트는 `npm run dev -- --port 5174`처럼 지정한다.

웹 주소는 hash 기반이다.

- `#/`: 추첨기 선택
- `#/lottery`: 로또 추첨기
- `#/wheel`: 돌림판 추첨기

기능별 입력과 옵션은 독립된 `localStorage` 키를 사용한다. 셸은 `roulette:selected-experience:v1`만, 로또는 `lottery-draw:*`, 돌림판은 `wheel-draw:*`만 읽고 쓴다.

정적 빌드와 미리보기는 다음과 같다.

```bash
npm run build:web
npm exec -- vite preview
```

웹 빌드는 기존 GitHub Pages 경로 `/roulette/`를 유지한다. Vercel 설정은 MCP Function 전용이므로 이 정적 산출물을 사용하지 않는다.

## MCP 개발

타입 검사와 테스트는 서버 실행 없이 가능하다.

```bash
npm run build:mcp
npm run test:mcp-app
npm run test:mcp
```

`build:mcp`는 MCP App을 단일 HTML 리소스로 먼저 생성한 뒤 서버 타입을 검사한다. `src/mcp/integration/mcpFunction.test.ts`는 실제 MCP 2 클라이언트와 Streamable HTTP transport를 메모리상의 Function에 연결해 초기화, 도구·리소스 조회와 호출을 검증한다. 로컬 HTTP 서버와 MCP Inspector 절차는 [Remote MCP 개발 가이드](feature/remote-mcp/DEVELOPMENT.md)에 기록한다.

도구 계약 변경 시 다음을 함께 갱신한다.

- `src/mcp/tools/drawRoulette.ts`의 Zod 스키마
- `src/mcp/server.ts`의 설명·초기화 지침
- 정상·오류·프로토콜 통합 테스트
- `docs/feature/remote-mcp/SPEC.md`와 기능 가이드

후보 원문과 결과를 `console`, 오류 메시지, 이벤트 콜백 또는 저장소에 추가하지 않는다. 운영 관측이 필요하면 payload를 포함하지 않는 메서드·상태·소요 시간만 별도 검토한다.

## 테스트

전체 검증 명령은 모든 테스트, 타입 검사, 빌드와 경계 검사를 순서대로 실행한다.

```bash
npm run verify
```

영역별로 빠르게 실행할 수 있다.

```bash
npm run test:core
npm run test:web
npm run test:mcp-app
npm run test:mcp
npm run verify:boundaries
```

특정 코어 파일만 실행하는 실제 예시는 다음과 같다.

```bash
npm run test:core -- src/core/input.test.ts
npm run test:web -- src/web/features/wheel/domain/wheelSession.test.ts
```

입력 문법을 수정할 때는 일반 후보, 빈 항목, 중복, 반복, 범위, 길이와 최종 2~45개 경계를 함께 추가한다. 난수 코드는 결정론적 `RandomValuesSource`를 주입해 거부 샘플링과 오류 분기를 검증한다.

웹 기능 경계만 빠르게 검사할 때는 `npm run test:boundaries`를 사용한다. 실제 저장소의 전체 소스·번들 경계까지 확인하려면 `npm run verify:boundaries`를 실행한다.

## 구현 작업 순서

1. 변경 책임이 `core`, 웹 셸, 특정 웹 기능, `mcp-apps`, `mcp`, `api` 중 어디에 속하는지 결정한다.
2. 가장 작은 단위 테스트로 현재 계약과 실패 사례를 고정한다.
3. 단순한 구현으로 테스트를 통과시킨다.
4. 목적별 테스트와 타입 검사를 실행한다.
5. `npm run verify`로 교차 제품 회귀와 번들 경계를 확인한다.
6. MCP Function 변경은 로컬 Inspector와 Vercel 호환 검증을 추가로 수행한다.

새 웹 추첨기를 추가할 때는 다음 순서를 따른다.

1. `src/web/features/<type>` 안에 도메인·UI·서비스·테스트를 함께 둔다.
2. 외부에 필요한 컴포넌트만 `index.ts`에서 공개한다.
3. `experience.ts`에 표시용 타입·라벨·설명을 추가하고 `App.tsx`에 명시적 마운트 분기를 추가한다.
4. 기능 전용 저장 키를 사용하고 기존 기능 키를 읽거나 마이그레이션하지 않는다.
5. 범용 세션이나 capability를 먼저 만들지 않고, 두 구현의 동일한 계약이 확인된 작은 프리미티브만 공유한다.

## 디버깅

### 입력 오류

`parseNames`가 반환하는 `errors`를 먼저 확인한다. MCP 오류는 `INVALID_INPUT`과 안전한 설명으로 변환되므로 원문이나 내부 예외를 응답에 삽입하지 않는다.

### 무작위 테스트 실패

테스트에서는 Web Crypto 전역을 바꾸기보다 `RandomValuesSource`를 주입한다. 운영 코드에서 난수 실패를 `Math.random()`으로 대체하면 안 된다.

### 돌림판 회전·결과 불일치

- 결과 후보는 `wheelSession`의 활성 회전에서 먼저 확정되는지 확인한다.
- 포인터 정렬은 `wheelGeometry`의 상단 0도·시계 방향 좌표계와 후보 중심각을 확인한다.
- 결과 공개는 transition 종료가 아니라 절대 `revealAt` 기준인지 확인한다.
- 일반 회전은 같은 강도 값으로 3.8~5.2초와 6~10회 순방향 회전을 함께 늘리고, `prefers-reduced-motion`에서는 220ms 전환을 사용한다.
- 화면 이동·언마운트 시 timer, animation과 `WheelSoundController`가 정리되는지 확인한다.

### MCP 연결 실패

- `npm run dev:mcp`의 시작 로그에서 개발 서버 이름 `roulette-remote-mcp-dev`와 endpoint를 확인한다.
- 요청 경로가 `/mcp`인지 확인한다.
- `Content-Type: application/json`과 MCP 프로토콜 헤더를 Inspector 또는 SDK transport가 설정하는지 확인한다.
- Origin이 있다면 요청 URL과 같은 origin인지 확인한다.
- 16 KiB를 넘는 요청은 의도적으로 413을 반환한다.
- GET·DELETE 405는 stateless 서버의 정상 동작이다.

### MCP App이 표시되지 않음

- `tools/list`에서 `draw_roulette`의 `_meta.ui.resourceUri`가 `ui://roulette/roulette-v6.html`이고 app-only `redraw_roulette`에는 UI 리소스가 없는지 확인한다.
- `resources/list`에는 현재 `v6`만, `resources/templates/list`에는 `ui://roulette/roulette-v{version}.html` 과거 버전 fallback만 노출되는지 확인한다.
- `resources/read`의 MIME이 `text/html;profile=mcp-app`인지 확인한다.
- 기존 대화가 과거 `v1`~`v5` URI를 요청해도 현재 앱 HTML을 반환하며, 현재보다 높은 미래 버전 요청은 거부한다.
- MCP Apps capability를 협상했거나 ChatGPT의 `openai/session` 호출 메타데이터가 있는 호출은 빈 `content`와 컴포넌트 전용 `_meta["roulette/result"]`를, 비지원 호출은 텍스트 `content`와 `structuredContent`를 받는지 확인한다.
- UI는 `_meta["roulette/result"]`를 우선하고, capability가 유실된 기존 호출은 `structuredContent`로도 결과를 렌더링하는지 확인한다.
- 최초·재추첨의 선택 가능한 `추첨 결과: 이름1, 이름2` 텍스트가 UI 안에서 갱신되고 `ui/update-model-context`를 호출해 composer에 앱 컨텍스트를 추가하지 않는지 확인한다.
- Inspector 2.0.0에서 `sandbox_proxy.html` ENOENT가 발생하면 기능 가이드의 알려진 패키징 문제를 확인한다.

### 웹·MCP 코드 혼입

`npm run verify:boundaries`를 실행한다. 웹 기능 위반은 보고된 importer와 target을 따라가며 셸은 공개 `index.ts`로, 기능 공통 규칙은 `core`로 의존 방향을 고친다. 정적 검사 외에 `dist/assets`에서 MCP SDK나 UI 리소스 식별자가 발견되면 웹 진입점의 import 경로를 추적한다. Function은 MCP App 실행 소스가 아니라 생성된 HTML 리소스만 포함해야 한다.

## 보안 점검

변경 후 다음을 실행한다.

```bash
npm audit --omit=dev
npm run verify:boundaries
```

커밋 전에는 토큰·비밀번호·개인 키 패턴과 후보·결과를 출력하는 `console` 호출을 검사한다. 의존성 취약점은 무시하거나 문서화만 하지 말고, 호환 가능한 보안 버전으로 올린 뒤 전체 검증을 다시 수행한다.

## 배포 경계

`vercel.json`은 정적 웹 빌드 없이 `/mcp`를 `api/mcp`로 rewrite하고 Function 최대 실행 시간을 10초로 제한한다. 웹은 기존 GitHub Pages workflow로 배포한다. 현재 작업은 로컬 검증까지만 수행하며 Preview·Production 생성, 실제 URL·로그·cold start 검증과 롤백은 별도 작업으로 진행한다.
