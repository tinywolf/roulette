# Remote MCP 로컬 검증 기록

## 결과

- 검증 일시: 2026-08-05 12:10 KST
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
| MCP Inspector | 2.0.0 |
| Vercel CLI | 58.5.1, 임시 디렉터리 격리 설치 |

## 자동 검증

`npm run verify` 결과:

- 코어: 3개 파일, 20개 테스트 통과
- 웹: 14개 파일, 110개 테스트 통과
- MCP·Function: 4개 파일, 13개 테스트 통과
- 웹 Vite 빌드 통과
- MCP TypeScript 검사 통과
- 소스·웹 번들 경계 검사 통과
- 합계: 21개 파일, 143개 테스트 통과

`npm audit --omit=dev` 결과는 취약점 0건이다. 민감정보 패턴 검색에서도 토큰·개인 키·하드코딩된 비밀번호가 발견되지 않았다.

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

## Vercel 호환 빌드

외부 프로젝트 ID가 없는 임시 로컬 설정과 telemetry 비활성화 상태에서 `vercel build --standalone`을 실행했다.

- `build:mcp`만 실행되고 `build:web`은 실행되지 않음
- `api/mcp.func` 생성
- runtime `nodejs22.x`, handler `api/mcp.js`, `maxDuration: 10`
- `/mcp`에서 `/api/mcp`로 가는 route 생성
- 정적 출력은 `vercel-static/.gitkeep` 하나뿐이며 웹앱 산출물 없음
- Function 파일 경로에 `src/web`, React, ReactDOM, `html-to-image` 없음
- Function에 필요한 `src/core`와 `src/mcp`만 포함
- `verify-vercel-output.mjs` 검사 통과

Vercel CLI 58.5.1의 `vercel dev`는 프로젝트 연결이 없으면 OAuth 로그인을 요구했다. 외부 상태를 만들지 않기 위해 중단하고, T8에서 허용한 동등한 로컬 Web Request 어댑터와 실제 Inspector로 HTTP 동작을 검증했다.

## 배포 후 확인할 항목

- 실제 HTTPS `/mcp` 초기화·도구 호출
- Vercel rewrite와 404 동작
- cold start와 Function 제한
- Runtime Logs의 후보·결과 비노출
- Hobby 플랜 사용량과 공개 엔드포인트 남용 대응
- 실제 원격 MCP 클라이언트별 대화 수집과 호출 호환성
- Preview 롤백 후 Production 배포·롤백 절차
