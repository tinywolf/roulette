# Remote MCP 로컬 검증 기록

## 결과

- 검증 일시: 2026-08-05 13:40 KST
- 결과: 통과
- Preview·Production 배포: 수행하지 않음
- Vercel 프로젝트 생성·연결: 수행하지 않음

## 환경

| 항목 | 버전 |
|---|---|
| Node.js | 22.22.1 |
| npm | 10.9.4 |
| TypeScript | 6.0.3 |
| MCP SDK server/client | 2.0.0 |
| `mcp-handler` | 2.1.0 |
| MCP Apps SDK | 1.7.5 |
| MCP-UI server | 6.1.0, 빌드 시점 전용 |
| MCP Inspector | 2.0.0 |
| Vercel CLI | 58.5.1, 임시 디렉터리 격리 설치 |

## 자동 검증

`npm run verify` 결과:

- 코어: 3개 파일, 20개 테스트 통과
- 웹: 14개 파일, 110개 테스트 통과
- MCP App: 2개 파일, 10개 테스트 통과
- MCP·Function: 4개 파일, 14개 테스트 통과
- 웹 Vite 빌드 통과
- MCP App 단일 HTML 빌드 통과: 348.70 kB, gzip 83.48 kB
- MCP App·MCP TypeScript 검사 통과
- 소스·웹·MCP App·Function 번들 경계 검사 통과
- 합계: 23개 파일, 154개 테스트 통과

전체 의존성 `npm audit` 결과는 취약점 0건이다. 민감정보 패턴 검색에서도 개인 키·API 키·하드코딩된 비밀번호가 발견되지 않았다.

## MCP Inspector

로컬 `http://127.0.0.1:3000/mcp`에 Streamable HTTP로 연결했다.

- `tools/list`: `draw_roulette` 하나, 두 필수 입력, 추가 속성 거부와 안전성 annotation 확인
- 일반 일부 추첨: `가,나,다` 중 2개와 미추첨 수 확인
- 입력 문법: `1~3, 민지*2` 확장과 일부 추첨 확인
- 전체 추첨: 후보 3개가 고유 ID로 한 번씩 반환됨
- 중복 후보: 같은 이름이 서로 다른 ID로 반환됨
- 오류: `INVALID_INPUT`, `INVALID_DRAW_COUNT` 확인
- 동시 호출: 네 개 요청을 병렬 실행해 후보·결과·상태가 섞이지 않음
- 로그: 서버 시작 주소 외 후보 원문과 결과 출력 없음

## MCP Apps UI

MCP Inspector 웹 UI의 Apps 탭에서 동일한 로컬 서버를 호출했다.

- `tools/list`: `_meta.ui.resourceUri`와 ChatGPT 호환 `openai/outputTemplate`이 모두 `ui://roulette/roulette-v1.html`을 가리킴
- `resources/list`·`resources/read`: `text/html;profile=mcp-app` 자체 포함 리소스 반환
- `tools/call`: 기존 텍스트와 `structuredContent`를 유지하면서 UI가 같은 확정 결과를 수신
- 렌더링: 룰렛 회전 후 당첨자 2명을 순서대로 공개하고 미추첨 인원을 표시
- 런타임: Inspector 브라우저 오류 로그 0건
- 네트워크·저장: UI 번들에 외부 자산 URL, `fetch`, `localStorage`, `sessionStorage` 없음
- 접근성: `aria-live`, 작은 화면 레이아웃, `prefers-reduced-motion` 처리 확인

Inspector 2.0.0 npm 패키지는 공식 저장소의 `clients/web/static/sandbox_proxy.html`을 포함하지 않아 최초 실행에서 `Sandbox not loaded: ENOENT`가 발생했다. 공식 저장소의 해당 파일을 로컬 설치 경로에 복원한 뒤 재시작해 렌더링을 완료했다. 도구·리소스 프로토콜 검증은 보완 전에도 통과했으며, 이 문제는 서버나 UI 리소스의 오류가 아닌 Inspector 배포 패키징 문제다.

## Vercel 호환 빌드

외부 프로젝트 ID가 없는 임시 로컬 설정과 telemetry 비활성화 상태에서 `vercel build --standalone`을 실행했다.

- `build:mcp`만 실행되고 `build:web`은 실행되지 않음
- `api/mcp.func` 생성
- runtime `nodejs22.x`, handler `api/mcp.js`, `maxDuration: 10`
- `/mcp`에서 `/api/mcp`로 가는 route 생성
- 정적 출력은 `vercel-static/.gitkeep` 하나뿐이며 웹앱 산출물 없음
- Function 파일 경로에 `src/web`, React, ReactDOM, `html-to-image` 없음
- Function은 필요한 `src/core`, `src/mcp`와 생성된 MCP App HTML 리소스만 포함하고 UI 실행 소스는 포함하지 않음
- `verify-vercel-output.mjs` 검사 통과

Vercel CLI 58.5.1의 `vercel dev`는 프로젝트 연결이 없으면 OAuth 로그인을 요구했다. 외부 상태를 만들지 않기 위해 중단하고, T8에서 허용한 동등한 로컬 Web Request 어댑터와 실제 Inspector로 HTTP 동작을 검증했다.

## 배포 후 확인할 항목

- 실제 HTTPS `/mcp` 초기화·도구 호출
- Vercel rewrite와 404 동작
- cold start와 Function 제한
- Runtime Logs의 후보·결과 비노출
- Hobby 플랜 사용량과 공개 엔드포인트 남용 대응
- 실제 원격 MCP 클라이언트별 대화 수집과 호출 호환성
- MCP Apps 지원 호스트의 원격 UI와 비지원 호스트의 텍스트 fallback
- Preview 롤백 후 Production 배포·롤백 절차
