# Remote MCP 로컬 개발·검증 가이드

## 현재 상태

- 대상 브랜치: `feature/remote-mcp`
- 구현 범위: 범용 Streamable HTTP MCP, 단일 텍스트 `draw_roulette` 도구
- 배포 대상: Vercel Function
- 현재 검증 범위: 로컬만
- 실제 Vercel Preview·Production URL: 없음

MCP Apps 애니메이션, 인증, 영속 상태와 배포 후 검증은 후속 작업이다.

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
- 오류 코드는 `INVALID_INPUT`, `INVALID_DRAW_COUNT`, `RANDOM_UNAVAILABLE`, `INTERNAL_ERROR`다.

## 자동 검증

```bash
npm run verify
```

이 명령은 코어·웹·MCP 테스트, 두 제품의 TypeScript 검사, 웹 번들과 import·난수·로그 경계를 확인한다.

## 로컬 HTTP 실행

우선 저장소에 포함된 로컬 Web Request 어댑터로 Function을 실행한다.

```bash
npm run dev:mcp
```

기본 MCP 엔드포인트는 `http://127.0.0.1:3000/mcp`다. 로컬 어댑터는 배포 코드를 복제하지 않고 `handleMcpRequest`를 Node HTTP에 연결한다.

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

## 개인정보와 로그

- Function은 후보·결과·요청 본문을 `console`에 기록하지 않는다.
- `mcp-handler`의 `verboseLogs`는 비활성화한다.
- 403·413 응답은 원문을 반사하지 않는다.
- 응답은 `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`를 포함한다.
- 데이터베이스, KV, 캐시와 분석 SDK를 사용하지 않는다.

애플리케이션 무로그 정책은 Vercel이 인프라 운영을 위해 수집할 수 있는 요청 메타데이터까지 제거한다는 의미는 아니다.

## 배포 후 별도 검증

후속 작업에서만 Preview와 Production을 생성한다. 실제 HTTPS `/mcp`, cold start, Function Runtime Logs, Hobby 한도, 원격 클라이언트 호환성과 롤백을 검증한다. 이 문서의 로컬 통과만으로 운영 배포가 완료되었다고 판단하지 않는다.
