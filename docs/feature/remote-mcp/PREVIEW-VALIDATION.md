# Remote MCP Vercel Preview 검증 기록

## 검증 대상

- 검증일: 2026-08-05
- Vercel Scope: `j-personal-projects` Hobby
- 프로젝트: `roulette-remote-mcp`
- 정상 Preview Deployment: `dpl_HVFjSkjURrpKNm8pyDqGGnTNJamc`
- MCP URL: `https://roulette-remote-l3lnprqhy-j-personal-projects.vercel.app/mcp`
- 런타임: Vercel Node.js 24.x, `iad1`, 최대 실행 시간 10초
- 공개 범위: Vercel Authentication 비활성화, 인증 없는 공개 MCP

검증에는 `프리뷰후보A`처럼 식별 불가능한 합성 후보만 사용했다.

## 결과

| 항목 | 결과 | 확인 내용 |
| --- | --- | --- |
| Function 전용 빌드 | 통과 | `/mcp` rewrite와 `api/mcp` Function만 포함하고 정적 웹 산출물은 포함하지 않음 |
| 루트 경로 | 통과 | `/`는 404로 응답해 GitHub Pages용 정적 웹앱이 Vercel에 배포되지 않음 |
| MCP 연결 | 통과 | 공개 URL에서 인증 리다이렉트 없이 Streamable HTTP 초기화 성공 |
| 도구 목록 | 통과 | `draw_roulette` 하나와 필수 `rawInput`, `drawCount` 스키마 확인 |
| 정상 추첨 | 통과 | 후보 3개 중 2개 추첨, `candidateCount: 3`, `drawCount: 2`, `remainingCount: 1` 일치 |
| 오류 응답 | 통과 | 후보 수를 넘는 4개 요청을 `INVALID_DRAW_COUNT`와 안전한 메시지로 거부 |
| MCP App 리소스 | 통과 | `ui://roulette/roulette-v1.html`, `text/html;profile=mcp-app`, 자체 포함 HTML 330,042자 확인 |
| 텍스트 fallback | 통과 | 같은 도구 응답에 텍스트 결과와 `structuredContent`가 모두 존재 |
| 응답 정책 | 통과 | `/mcp` 일반 GET은 405, `cache-control: no-store`, `x-content-type-options: nosniff` 확인 |
| cold start | 통과 | 새 Preview의 첫 Function 요청이 약 0.33초로 10초 제한 이내 |
| Runtime Logs | 통과 | 29개 호출 로그에 메서드·경로만 있으며 합성 후보, 결과, 요청 본문, 오류 스택 없음 |

배포 직전 `npm run verify`는 23개 파일·157개 테스트와 웹·MCP App·MCP 빌드 및 경계 검사를 모두 통과했다. 수정 후 `vercel build`와 `verify-vercel-output.mjs`도 다시 통과했다.

## 배포 중 발견하고 수정한 문제

Vercel Node Function은 기본 export에 Node의 `IncomingMessage`와 `ServerResponse`를 전달하지만 기존 진입점은 Web `Request` 하나를 받는 것으로 가정했다. 실제 Preview 로그에서 `request.headers.get is not a function`이 확인됐고 `/mcp`가 500을 반환했다.

`api/mcp.ts`에 Node 요청·응답과 Web Fetch API 사이의 얇은 어댑터를 추가했다. 공통 MCP 처리기는 계속 Web `Request`/`Response`를 사용하며 로컬 서버와 통합 테스트도 실제 Vercel 진입점을 경유하도록 변경했다.

## Vercel 첫 배포 예외

빈 프로젝트의 첫 `vercel deploy --prebuilt`는 `--prod`를 지정하지 않았는데도 Vercel이 Production으로 자동 지정했다. CLI도 첫 배포는 Production이고 이후 기본 배포부터 Preview라고 안내했다.

| 환경 | Deployment | 상태 |
| --- | --- | --- |
| Production | `dpl_3ZfLZgCexs2vcS9qw1CXszcSM1C1` | 수정 전 코드로 500을 반환해 검증 후 삭제 완료 |
| 첫 Preview | `dpl_GUj8hRUM7p8zKAAGS97p2A2JAvmh` | 수정 전 코드라 `/mcp` 500, Production 확인 후 삭제 완료 |
| 정상 Preview | `dpl_HVFjSkjURrpKNm8pyDqGGnTNJamc` | 전체 Preview 검증 통과, Production 확인 후 삭제 완료 |

정상 Preview를 Production으로 승격하지 않았다. 사용자 승인 후 구버전 Production 배포를 삭제하고 보호 진단 중 생성된 자동화 우회 토큰 1개도 값을 노출하지 않고 폐기했다. 병합된 `main`에서 새 Production을 배포·검증한 뒤 두 Preview를 모두 삭제했으며 각 고유 URL은 404를 반환한다.

## 후속 작업

1. 완료: 의도치 않은 구버전 Production 배포와 자동화 우회 토큰을 삭제했다.
2. Vercel Hobby의 Model Training opt-out 상태를 확인한다.
3. 완료: 변경을 PR로 `main`에 병합하고 Production을 새로 빌드·배포했다.
4. 완료: Production 확인 후 Preview 배포 2개를 삭제했다.
5. 실제 MCP Apps 호스트에서 원격 UI 렌더링과 대화 기반 옵션 수집 E2E를 별도로 검증한다.
