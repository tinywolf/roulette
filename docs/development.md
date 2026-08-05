---
revision: 15ebddc
updated_at: 2026-08-05T12:23:14+09:00
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
src/web/      React·브라우저 전용 제품
src/mcp-apps/ MCP Apps UI와 생성 리소스
src/mcp/      MCP 도구·리소스·표현 전용 제품
tools/        로컬 실행과 빌드·경계 검증 도구
```

허용 방향은 `web → core ← mcp ← api`다. `mcp-apps`는 독립 빌드하며 MCP 서버에는 생성된 HTML 리소스만 전달한다.

- `core`에서 React, DOM, MCP SDK, Vercel API를 import하지 않는다.
- `web`과 `mcp`는 서로 import하지 않는다.
- `mcp-apps`는 `core`, `web`, `mcp`, `api`를 import하지 않으며 서버 난수와 도구 호출을 수행하지 않는다.
- 웹 수동·자동 일정과 렌더링 타입은 `src/web/domain`에 둔다.
- 후보 파싱, 난수와 즉시 추첨처럼 두 제품에서 같은 의미인 규칙만 `src/core`에 둔다.
- MCP 요청 변환과 보안 헤더는 `api`에 두고 코어로 밀어 넣지 않는다.
- 독립 모듈·컴포넌트에는 역할과 책임을 설명하는 주석을 추가한다.

## 웹 개발

개발 서버를 실행한다.

```bash
npm run dev
```

기본 주소는 `http://localhost:5173`이다. 다른 포트는 `npm run dev -- --port 5174`처럼 지정한다.

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
```

입력 문법을 수정할 때는 일반 후보, 빈 항목, 중복, 반복, 범위, 길이와 최종 2~45개 경계를 함께 추가한다. 난수 코드는 결정론적 `RandomValuesSource`를 주입해 거부 샘플링과 오류 분기를 검증한다.

## 구현 작업 순서

1. 변경 책임이 `core`, `web`, `mcp-apps`, `mcp`, `api` 중 어디에 속하는지 결정한다.
2. 가장 작은 단위 테스트로 현재 계약과 실패 사례를 고정한다.
3. 단순한 구현으로 테스트를 통과시킨다.
4. 목적별 테스트와 타입 검사를 실행한다.
5. `npm run verify`로 교차 제품 회귀와 번들 경계를 확인한다.
6. MCP Function 변경은 로컬 Inspector와 Vercel 호환 검증을 추가로 수행한다.

## 디버깅

### 입력 오류

`parseNames`가 반환하는 `errors`를 먼저 확인한다. MCP 오류는 `INVALID_INPUT`과 안전한 설명으로 변환되므로 원문이나 내부 예외를 응답에 삽입하지 않는다.

### 무작위 테스트 실패

테스트에서는 Web Crypto 전역을 바꾸기보다 `RandomValuesSource`를 주입한다. 운영 코드에서 난수 실패를 `Math.random()`으로 대체하면 안 된다.

### MCP 연결 실패

- 요청 경로가 `/mcp`인지 확인한다.
- `Content-Type: application/json`과 MCP 프로토콜 헤더를 Inspector 또는 SDK transport가 설정하는지 확인한다.
- Origin이 있다면 요청 URL과 같은 origin인지 확인한다.
- 16 KiB를 넘는 요청은 의도적으로 413을 반환한다.
- GET·DELETE 405는 stateless 서버의 정상 동작이다.

### MCP App이 표시되지 않음

- `tools/list`의 `_meta.ui.resourceUri`가 `ui://roulette/roulette-v1.html`인지 확인한다.
- `resources/read`의 MIME이 `text/html;profile=mcp-app`인지 확인한다.
- 호스트가 MCP Apps 확장을 지원하지 않으면 텍스트 결과만 표시되는 것이 정상이다.
- Inspector 2.0.0에서 `sandbox_proxy.html` ENOENT가 발생하면 기능 가이드의 알려진 패키징 문제를 확인한다.

### 웹·MCP 코드 혼입

`npm run verify:boundaries`를 실행한다. 정적 검사 외에 `dist/assets`에서 MCP SDK나 UI 리소스 식별자가 발견되면 웹 진입점의 import 경로를 추적한다. Function은 MCP App 실행 소스가 아니라 생성된 HTML 리소스만 포함해야 한다.

## 보안 점검

변경 후 다음을 실행한다.

```bash
npm audit --omit=dev
npm run verify:boundaries
```

커밋 전에는 토큰·비밀번호·개인 키 패턴과 후보·결과를 출력하는 `console` 호출을 검사한다. 의존성 취약점은 무시하거나 문서화만 하지 말고, 호환 가능한 보안 버전으로 올린 뒤 전체 검증을 다시 수행한다.

## 배포 경계

`vercel.json`은 정적 웹 빌드 없이 `/mcp`를 `api/mcp`로 rewrite하고 Function 최대 실행 시간을 10초로 제한한다. 웹은 기존 GitHub Pages workflow로 배포한다. 현재 작업은 로컬 검증까지만 수행하며 Preview·Production 생성, 실제 URL·로그·cold start 검증과 롤백은 별도 작업으로 진행한다.
