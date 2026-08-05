# Remote MCP 로컬 개발·검증 가이드

## 현재 상태

- 대상 브랜치: `feature/remote-mcp`
- 구현 범위: 범용 Streamable HTTP MCP, 텍스트 fallback과 MCP Apps UI를 제공하는 단일 `draw_roulette` 도구
- 배포 대상: Vercel Function
- 현재 검증 범위: 로컬만
- 실제 Vercel Preview·Production URL: 없음

인증, 영속 상태와 배포 후 검증은 후속 작업이다.

## 도구 계약

```json
{
  "rawInput": "1~5, 민지*2, 준호",
  "drawCount": 3
}
```

- `rawInput`: 콤마·줄바꿈, `값*반복횟수`, `시작~끝` 문법을 지원한다.
- `drawCount`: 전체는 `"all"`, 일부는 1 이상 후보 수 이하의 정수다.
- 두 값이 모두 준비되기 전에는 에이전트가 도구를 호출하지 않는다.
- 성공 결과는 `content`의 한국어 텍스트와 `structuredContent`를 함께 반환한다.
- MCP Apps 지원 호스트는 `_meta.ui.resourceUri`로 연결된 `ui://roulette/roulette-v1.html`을 렌더링한다.
- UI는 서버가 확정한 `structuredContent`를 표현할 뿐 재추첨하거나 도구를 다시 호출하지 않는다.
- 오류 코드는 `INVALID_INPUT`, `INVALID_DRAW_COUNT`, `RANDOM_UNAVAILABLE`, `INTERNAL_ERROR`다.

## 자동 검증

```bash
npm run verify
```

이 명령은 코어·웹·MCP App·MCP 테스트, 세 제품의 TypeScript 검사, 웹 번들과 import·난수·로그·외부 요청 경계를 확인한다.

## 로컬 HTTP 실행

우선 저장소에 포함된 로컬 Web Request 어댑터로 Function을 실행한다.

```bash
npm run dev:mcp
```

`dev:mcp`는 단일 HTML UI 리소스를 먼저 생성하고 Function을 실행한다. 기본 MCP 엔드포인트는 `http://127.0.0.1:3000/mcp`다. 로컬 어댑터는 배포 코드를 복제하지 않고 `handleMcpRequest`를 Node HTTP에 연결한다. 다른 포트가 필요하면 `MCP_PORT=3100 npm run dev:mcp`처럼 지정한다.

Vercel CLI는 저장소 의존성으로 고정하지 않는다. 현재 CLI의 개발 의존성 트리가 `npm audit` 경고를 만들기 때문에, Vercel 호환 검증 시에만 격리된 임시 디렉터리에 설치해 사용한다. 프로젝트 연결이나 로그인이 필요한 동작은 로컬 범위를 넘으므로 진행하지 않는다.

Vercel rewrite·번들 자체는 아래 로컬 빌드 검사로 확인한다.

## MCP Inspector

서버를 실행한 터미널과 별도로 다음을 실행한다.

```bash
npm run inspect:mcp:list
npm run inspect:mcp:call
```

확인 사항:

- 서버 초기화 성공
- 도구 목록에 `draw_roulette` 하나만 존재
- `rawInput`, `drawCount`가 필수이며 추가 속성을 허용하지 않음
- 호출 결과가 텍스트와 구조화 결과를 함께 포함
- 잘못된 후보 수와 추첨 인원이 안전한 코드로 반환
- 서버 터미널에 후보 원문과 추첨 결과가 출력되지 않음

MCP Apps UI까지 확인하려면 Inspector 웹 UI를 실행한다.

```bash
HOST=127.0.0.1 npx mcp-inspector --web \
  --transport http \
  --server-url http://127.0.0.1:3000/mcp
```

브라우저의 Apps 탭에서 `룰렛 추첨`을 선택하고 두 입력을 채운 뒤 `Open App`을 누른다. 결과가 정해진 뒤 룰렛 회전과 당첨 순서 공개가 표시되는지, Protocol 패널에 `tools/call`과 `resources/read`가 각각 한 번씩 성공하는지 확인한다.

Inspector 2.0.0 npm 배포본에는 공식 저장소의 `clients/web/static/sandbox_proxy.html`이 누락된 패키징 문제가 있다. `Sandbox not loaded: ENOENT`가 나오면 MCP 서버 문제가 아니며, 수정된 Inspector 버전을 사용하거나 공식 저장소의 같은 파일을 설치 경로에 복원해야 한다. 이 저장소의 로컬 검증은 공식 파일을 복원한 환경에서 수행했다.

## MCP Apps 호환성

MCP Apps는 공식 확장 표준이지만 MCP 코어의 필수 기능은 아니다. 따라서 MCP를 연결할 수 있어도 Apps 확장을 구현하지 않은 호스트는 iframe UI를 표시하지 않는다. 서버는 이를 기능 실패로 취급하지 않고 동일한 텍스트와 `structuredContent`를 반환한다.

- MCP Apps/MCP-UI 호환 호스트: 룰렛 애니메이션과 텍스트 결과 사용
- 일반 MCP 호스트 및 현재 공개 목록 밖의 Codex: 텍스트·구조화 결과 사용
- 호스트별 지원 여부는 [MCP-UI 지원 호스트 목록](https://mcpui.dev/guide/supported-hosts)에서 확인

## 로컬 Vercel 빌드

Vercel CLI는 개발 의존성 감사 경고를 저장소에 남기지 않도록 임시 디렉터리에 설치한다. 프로젝트를 연결하지 않은 최초 검증은 CLI 58.5.1에서 로컬 설정 파일을 요구한다.

```bash
npm install --prefix /tmp/roulette-vercel-cli --save-exact vercel@58.5.1
mkdir -p .vercel
cp tools/remote-mcp/vercel-project.local.json .vercel/project.json
NO_UPDATE_NOTIFIER=1 VERCEL_TELEMETRY_DISABLED=1 /tmp/roulette-vercel-cli/node_modules/.bin/vercel --global-config /tmp/roulette-vercel-config --non-interactive build --standalone
node tools/remote-mcp/verify-vercel-output.mjs .vercel/output
```

`.vercel`은 Git에서 제외된다. 위 프로젝트 설정 형식은 CLI 58.5.1 로컬 검증용이며 외부 `projectId`·`orgId`나 인증 정보를 포함하지 않는다. 이후 실제 Vercel 프로젝트를 연결하면 공식 `vercel pull` 결과를 사용한다.

생성된 Build Output에서는 다음을 확인한다.

- `api/mcp` Function 존재
- Function 번들에 React·Canvas·WebGL·`localStorage` 전용 코드가 없음
- Vercel Build Output에 정적 웹 산출물이 없음

실제 실행 결과는 [로컬 검증 기록](LOCAL-VALIDATION.md)에 남긴다.

## 수동 시나리오

1. `rawInput: "가,나,다"`, `drawCount: 2`를 호출해 두 개의 고유 ID와 `remainingCount: 1`을 확인한다.
2. `rawInput: "1~3, 민지*2"`, `drawCount: "all"`로 다섯 결과를 확인한다.
3. `rawInput: "가"`를 호출해 `INVALID_INPUT`을 확인한다.
4. 후보 3개에 `drawCount: 4`를 전달해 `INVALID_DRAW_COUNT`를 확인한다.
5. 두 호출을 동시에 실행해 결과와 상태가 서로 섞이지 않는지 확인한다.
6. Vercel 루트가 정적 웹을 제공하지 않고 `/mcp`만 Function으로 연결되는지 확인한다.
7. 서버 출력을 검색해 시나리오의 후보·결과 문자열이 없는지 확인한다.
8. Apps 탭에서 룰렛이 렌더링되고 브라우저 콘솔 오류와 외부 네트워크 요청이 없는지 확인한다.

## 개인정보와 로그

- Function은 후보·결과·요청 본문을 `console`에 기록하지 않는다.
- `mcp-handler`의 `verboseLogs`는 비활성화한다.
- 403·413 응답은 원문을 반사하지 않는다.
- 응답은 `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`를 포함한다.
- 데이터베이스, KV, 캐시와 분석 SDK를 사용하지 않는다.
- UI 리소스의 CSP는 연결·리소스 origin을 빈 목록으로 선언하며 외부 자산, `fetch`, 브라우저 저장소를 사용하지 않는다.

애플리케이션 무로그 정책은 Vercel이 인프라 운영을 위해 수집할 수 있는 요청 메타데이터까지 제거한다는 의미는 아니다.

## 배포 후 별도 검증

Preview와 Production 생성 절차, 사용자 확인 사항과 롤백 기준은 [Vercel 배포 가이드](DEPLOYMENT.md)를 따른다. 실제 HTTPS `/mcp`, cold start, Function Runtime Logs, Hobby 한도, 원격 클라이언트의 MCP Apps·텍스트 fallback 호환성과 롤백을 검증한다. 이 문서의 로컬 통과만으로 운영 배포가 완료되었다고 판단하지 않는다.
