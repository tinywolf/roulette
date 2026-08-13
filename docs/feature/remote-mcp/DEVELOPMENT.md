# Remote MCP 로컬 개발·검증 가이드

## 현재 상태

- 대상 브랜치: `feature/remote-mcp`
- 구현 범위: 범용 Streamable HTTP MCP, UI 중심 구조화 결과, 모델용 `draw_roulette`와 MCP App 전용 `redraw_roulette`
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
- MCP Apps capability를 협상했거나 ChatGPT의 `openai/session` 호출 메타데이터가 있는 호출은 빈 `content`와 컴포넌트 전용 `_meta["roulette/result"]`만 반환한다. 비지원 호출은 텍스트 `content`와 `structuredContent`를 함께 반환하고, 오류 응답은 복구 가능한 텍스트 안내를 유지한다.
- MCP Apps 지원 호스트는 `_meta.ui.resourceUri`로 연결된 `ui://roulette/roulette-v6.html`을 렌더링한다.
- `resources/list`는 현재 `v6`만 공개하고 `ui://roulette/roulette-v{version}.html` ResourceTemplate이 캐시된 과거 버전 URI를 현재 앱 HTML로 해석한다.
- `draw_roulette`는 모델이 호출하고 UI 리소스를 여는 도구다. `redraw_roulette`는 App에서만 호출하며 UI 리소스를 연결하지 않는다.
- 재추첨 버튼은 최초 입력으로 `redraw_roulette`를 호출하고 반환된 컴포넌트 전용 `_meta` 결과를 현재 iframe에서 다시 애니메이션한다. 선택 가능한 `추첨 결과: 이름1, 이름2` 텍스트도 UI 안에서 갱신하며 사용자 메시지·새 카드·앱 컨텍스트를 만들지 않는다.
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

`dev:mcp`는 단일 HTML UI 리소스를 먼저 생성하고 개발 식별자 `roulette-remote-mcp-dev`로 Function을 실행한다. 기본 MCP 엔드포인트는 `http://127.0.0.1:3000/mcp`다. 로컬 어댑터는 운영과 같은 정책·도구 등록을 사용하되 서버 이름만 주입하고, HTTP 메서드·경로·상태·소요시간을 로그로 남긴다. 후보 원문·추첨 결과·요청 본문은 기록하지 않는다. 다른 포트가 필요하면 `MCP_PORT=3100 npm run dev:mcp`처럼 지정한다.

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
- 서버 이름이 `roulette-remote-mcp-dev`이고 운영 이름 `roulette-remote-mcp`와 구분됨
- 도구 목록에 모델용 `draw_roulette`와 app-only `redraw_roulette`가 존재
- `draw_roulette`에만 `ui://roulette/roulette-v6.html` 리소스가 연결되고 `redraw_roulette`에는 UI 리소스가 없음
- `resources/list`에는 현재 `v6` 하나만 있고 `resources/templates/list`에는 과거 숫자 버전용 템플릿 하나만 있음
- `resources/read`가 `v1`~`v5`에는 현재 앱 HTML을 반환하고 미래 버전은 거부함
- `rawInput`, `drawCount`가 필수이며 추가 속성을 허용하지 않음
- Apps capability 협상 호출과 `openai/session` 메타데이터가 있는 ChatGPT 호출은 `content`·`structuredContent`에 결과가 없고 `_meta["roulette/result"]`가 전체 결과를 포함
- 비지원 호출은 친화적 텍스트 `content`와 전체 `structuredContent`를 포함
- UI는 `_meta["roulette/result"]`를 우선하며 capability가 유실된 기존 호출의 `structuredContent`도 렌더링
- UI는 결과 목록과 별도로 선택 가능한 한 줄 텍스트 결과를 표시하고 `ui/update-model-context`를 호출하지 않음
- 잘못된 후보 수와 추첨 인원이 안전한 코드로 반환
- 서버 터미널에 후보 원문과 추첨 결과가 출력되지 않음
- 서버 터미널에 요청 메서드·경로·상태·소요시간 로그가 출력됨

MCP Apps UI까지 확인하려면 Inspector 웹 UI를 실행한다.

```bash
HOST=127.0.0.1 npx mcp-inspector --web \
  --transport http \
  --server-url http://127.0.0.1:3000/mcp
```

브라우저의 Apps 탭에서 `룰렛·무작위 추첨 실행`을 선택하고 두 입력을 채운 뒤 `Open App`을 누른다. 최초 결과의 룰렛 회전과 당첨 순서 공개를 확인한 다음 재추첨 버튼을 누른다. 같은 카드에서 애니메이션과 결과가 교체되고 별도 카드가 생기지 않는지, Protocol 패널에서 `redraw_roulette`의 `tools/call`이 성공하는지 확인한다.

Inspector 2.0.0 npm 배포본에는 공식 저장소의 `clients/web/static/sandbox_proxy.html`이 누락된 패키징 문제가 있다. `Sandbox not loaded: ENOENT`가 나오면 MCP 서버 문제가 아니며, 수정된 Inspector 버전을 사용하거나 공식 저장소의 같은 파일을 설치 경로에 복원해야 한다. 이 저장소의 로컬 검증은 공식 파일을 복원한 환경에서 수행했다.

## MCP Apps 호환성

MCP Apps는 공식 확장 표준이지만 MCP 코어의 필수 기능은 아니다. 서버는 `io.modelcontextprotocol/ui` capability와 `text/html;profile=mcp-app` MIME 지원을 우선 확인한다. ChatGPT의 stateless 경로처럼 UI를 렌더링하면서 협상 capability를 서버까지 보존하지 않는 경우에는 호출별 `openai/session` 메타데이터를 표현 경로 힌트로만 사용한다. UI 지원 호출에는 모델에서 숨겨진 `_meta`만 반환하고, 그 외 호출에는 텍스트와 `structuredContent`를 반환한다. `openai/session`은 인증이나 권한 판단에는 사용하지 않는다.

MCP App은 `_meta["roulette/result"]`를 먼저 읽고 `structuredContent`를 호환 fallback으로 읽는다. 따라서 이미 캐시된 호출이나 capability 전달이 누락된 호스트에서도 UI 자체는 결과를 표시하며, 신규 ChatGPT 호출은 서버의 메타데이터 분기로 대화 텍스트 중복도 피한다. 결과는 이미 UI에 존재하므로 `ui/update-model-context`로 composer에 다시 첨부하지 않는다.

- MCP Apps 호환 호스트: UI 전용 결과로 현재 텍스트 결과와 룰렛 애니메이션 사용. App tool call을 지원하면 현재 카드 재추첨도 사용
- 일반 MCP 호스트: 친화적 텍스트와 구조화 결과를 수신
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

Preview와 Production 생성 절차, 사용자 확인 사항과 롤백 기준은 [Vercel 배포 가이드](DEPLOYMENT.md)를 따른다. 실제 HTTPS `/mcp`, cold start, Function Runtime Logs, Hobby 한도, 원격 클라이언트의 MCP Apps UI와 구조화 결과 호환성 및 롤백을 검증한다. 이 문서의 로컬 통과만으로 운영 배포가 완료되었다고 판단하지 않는다.
