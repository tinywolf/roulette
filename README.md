# 추첨기

서로 다른 추첨 규칙을 독립적인 UI로 제공하고, 입력 문법과 안전한 난수 같은 핵심만 공유하는 프로젝트입니다.

- 정적 웹앱: 비복원 로또 추첨기와 복원 돌림판 추첨기 중 선택
- Remote MCP: 에이전트가 옵션을 모두 확인한 뒤 구조화 결과를 확정하고 MCP Apps UI에서 표시하는 공개·stateless 도구

모든 추첨 결과는 Web Crypto API 기반 난수로 애니메이션 전에 확정합니다. 로또와 Remote MCP는 Fisher–Yates 순열을 이용한 비복원 추첨을, 돌림판은 매 회전 독립 인덱스 선택을 이용한 복원 추첨을 수행합니다.

## 주요 기능

- 줄바꿈 또는 콤마로 후보 구분
- `민지*2`, `7*3` 반복 입력과 `1~45` 숫자 범위 입력
- 2~45개 후보, 후보 이름당 최대 20자
- 중복 이름을 서로 다른 후보로 취급
- 로또: 전체 또는 지정 개수 비복원 추첨, 수동·자동 모드, 2D Canvas·3D WebGL 연출, 결과 복사·이미지 저장
- 돌림판: 같은 후보가 다시 나올 수 있는 수동 반복 추첨, 3.8~5.2초·6~10바퀴 SVG 회전, 결과 이력 복사·이미지 저장
- 선택 화면과 `#/lottery`, `#/wheel` 직접 주소
- 기능별 입력·설정을 서로 다른 브라우저 `localStorage` 키에 보존
- MCP `draw_roulette` 도구의 구조화 결과, MCP Apps 룰렛 애니메이션과 현재 카드 재추첨
- 웹·MCP 목적별 빌드와 테스트 격리

## 입력 예시

```text
민지, 준호
서연, 민지
```

반복식과 숫자 범위도 함께 사용할 수 있습니다.

```text
1~5, 민지*2, 7
```

웹의 로또에서는 전체/일부 추첨과 수동/자동 모드를 선택합니다. 돌림판에서는 후보를 설정한 뒤 필요한 만큼 반복 회전하며, 당첨 후보를 제거하지 않습니다. MCP에서는 에이전트가 후보 목록과 추첨 인원을 모두 확인한 경우에만 `draw_roulette`를 호출합니다. 전체 추첨은 `drawCount: "all"`, 일부 추첨은 양의 정수를 사용합니다.

## 기술 구성

| 영역 | 기술 |
|---|---|
| 공통 코어 | TypeScript, Web Crypto API |
| 정적 웹 | React 19, Vite, Canvas 2D, WebGL, Web Audio |
| Remote MCP | MCP TypeScript SDK 2, MCP Apps, MCP-UI, `mcp-handler`, Zod, Vercel Function |
| 테스트 | Vitest, Testing Library, jsdom |
| 웹 저장 | 브라우저 `localStorage` |

MCP 서버는 데이터베이스·캐시·분석 도구를 사용하지 않습니다. 후보와 결과를 애플리케이션 로그나 영구 저장소에 기록하지 않습니다.

## 실행 환경과 설치

- Node.js 22 이상 권장
- npm 10 이상 권장
- 웹 사용 시 최신 안정 버전 Chrome, Safari, Firefox 또는 Edge

```bash
npm install
```

## 웹 개발과 빌드

```bash
npm run dev
npm run build:web
npm exec -- vite preview
```

기본 개발 주소는 `http://localhost:5173`, 미리보기 주소는 `http://localhost:4173`입니다. 웹 빌드는 GitHub Pages 배포를 위해 `/roulette/` 경로를 유지합니다. Vercel 프로젝트는 MCP Function 전용이며 정적 웹을 다시 배포하지 않습니다.

## 로컬 MCP 서버 실행

저장소 루트에서 다음 명령을 실행합니다.

```bash
npm run dev:mcp
```

이 명령은 자체 포함 MCP App 리소스를 먼저 빌드한 뒤 서버를 실행합니다. 3000번 포트를 사용 중이면 다른 포트를 지정할 수 있습니다.

```bash
MCP_PORT=3100 npm run dev:mcp
```

서버가 준비되면 다음 주소가 출력됩니다.

```text
[roulette-mcp-dev] development mode enabled
[roulette-mcp-dev] server: roulette-remote-mcp-dev
[roulette-mcp-dev] endpoint: http://127.0.0.1:3000/mcp
```

`dev:mcp`로 실행한 서버는 MCP 초기화 응답에서도 운영 이름 대신 `roulette-remote-mcp-dev`를 사용합니다. 요청마다 HTTP 메서드·경로·상태·소요시간을 출력하지만 후보 원문과 추첨 결과는 기록하지 않습니다. 로컬 MCP 서버를 사용하는 동안 이 터미널을 계속 실행해 둡니다. 서버를 종료할 때는 `Ctrl+C`를 누릅니다.

다른 터미널에서 MCP Inspector로 연결과 도구 호출을 확인할 수 있습니다.

```bash
npm run inspect:mcp:list
npm run inspect:mcp:call
```

Streamable HTTP를 지원하는 로컬 에이전트에는 다음 URL을 등록합니다.

```text
http://127.0.0.1:3000/mcp
```

Codex CLI에 등록하는 예시는 다음과 같습니다.

```bash
codex mcp add roulette-local --url http://127.0.0.1:3000/mcp
codex mcp list
```

등록 후 Codex 앱·CLI·IDE 확장을 재시작하거나 새 작업을 시작합니다. `127.0.0.1`은 같은 컴퓨터에서 실행되는 에이전트만 접근할 수 있으며, Codex Cloud나 별도 컨테이너에서는 이 주소로 호스트의 MCP 서버에 연결할 수 없습니다.

MCP Apps 확장을 협상한 호스트와 ChatGPT UI 호출은 같은 `draw_roulette` 호출에서 현재 추첨 결과와 룰렛 애니메이션을 렌더링합니다. 이때 결과는 모델에 보이는 `content`·`structuredContent`가 아니라 컴포넌트 전용 `_meta`로 전달되어 대화에 결과 텍스트가 중복되지 않습니다. App의 도구 호출까지 지원하는 호스트에서는 재추첨 버튼이 app-only `redraw_roulette`를 호출하고, 새 카드나 앱 컨텍스트를 만들지 않은 채 현재 카드의 결과 목록·선택 가능한 `추첨 결과: …` 텍스트·애니메이션을 함께 교체합니다. MCP Apps 비지원 호스트에는 기존처럼 텍스트와 구조화 결과를 반환합니다.

## 공개 Remote MCP

Vercel Hobby 환경의 운영 MCP는 다음 URL에서 사용할 수 있습니다.

```text
https://roulette-remote-mcp.vercel.app/mcp
```

표준 Streamable HTTP MCP 클라이언트에 이 URL을 등록합니다. 인증 없는 공개 서비스이므로 실제 개인정보나 민감정보를 후보로 사용하지 않습니다. Preview 배포는 Production 확인 후 모두 삭제했습니다.

## 테스트와 검증

전체 제품 경계와 회귀를 한 번에 검증합니다.

```bash
npm run verify
```

영역별 명령은 다음과 같습니다.

```bash
npm run test:core
npm run test:web
npm run test:mcp-app
npm run test:mcp
npm run build:web
npm run build:mcp
npm run verify:boundaries
```

`verify:boundaries`는 로또·돌림판 간 교차 import, 셸의 기능 내부 접근, 공통 코어의 역방향 의존, 웹·MCP App·MCP의 교차 import, 안전하지 않은 난수, MCP 계층의 로그·외부 요청과 웹 번들의 MCP 코드 혼입을 검사합니다.

Remote MCP의 로컬 실행과 Inspector 검증은 [기능 개발 가이드](docs/feature/remote-mcp/DEVELOPMENT.md)를 따릅니다. 실제 Vercel 배포 전 확인 사항과 단계별 명령은 [배포 가이드](docs/feature/remote-mcp/DEPLOYMENT.md)에 정리되어 있습니다.

## 프로젝트 구조

```text
.
├── api/
│   └── mcp.ts                   # Vercel Function 진입점
├── docs/
│   ├── architecture.md
│   ├── development.md
│   └── feature/                 # 기능별 SPEC·DESIGN·TASK·가이드
├── src/
│   ├── core/                    # 제품 간 재사용하는 파싱·난수·즉시 추첨
│   ├── web/
│   │   ├── App.tsx              # 추첨기 선택·hash 내비게이션 셸
│   │   └── features/
│   │       ├── lottery/         # 비복원 로또 도메인·UI·서비스
│   │       └── wheel/           # 복원 돌림판 도메인·UI·서비스
│   ├── mcp-apps/                # MCP Apps 전용 UI와 생성 리소스
│   └── mcp/                     # 도구 계약·UI 리소스 등록·HTTP 정책·표현
├── tools/
│   ├── verify/                  # 소스·산출물 아키텍처 경계 검증 도구
│   └── remote-mcp/              # MCP App 생성·로컬 서버·Vercel 검증 도구
├── vercel-static/               # Vercel에 웹앱을 싣지 않는 빈 정적 출력
├── tsconfig.web.json
├── tsconfig.mcp.json
├── tsconfig.mcp-app.json
├── vercel.json
└── vite.config.ts
```

의존성 방향은 `web/features/* → core ← mcp ← api`이며 웹 셸은 각 기능의 `index.ts` 공개 진입점만 참조합니다. 로또와 돌림판은 서로 import하지 않습니다. MCP App UI는 별도로 빌드되고 MCP 서버에는 생성된 단일 HTML 리소스만 포함됩니다.

## 데이터와 개인정보

- 웹 입력 원문과 설정은 사용자의 브라우저 `localStorage`에만 저장됩니다.
- MCP 후보와 결과는 요청 처리 중 메모리에서만 사용하고 로그·데이터베이스·캐시에 남기지 않습니다.
- 공개 MCP에는 인증이 없으므로 민감한 개인정보를 후보로 입력하지 않는 것이 좋습니다.
- Vercel 등 호스팅 플랫폼의 인프라 수준 요청 메타데이터는 애플리케이션의 무로그 정책과 별개일 수 있습니다.

## 관련 문서

- [기존 웹 제품 스펙](docs/SPEC.md)
- [돌림판 요구사항](docs/feature/wheel-draw/PRD.md)
- [돌림판 스펙](docs/feature/wheel-draw/SPEC.md)
- [돌림판 설계](docs/feature/wheel-draw/DESIGN.md)
- [돌림판 작업 기록](docs/feature/wheel-draw/TASK.md)
- [아키텍처](docs/architecture.md)
- [개발 가이드](docs/development.md)
- [Remote MCP 스펙](docs/feature/remote-mcp/SPEC.md)
- [Remote MCP 작업 기록](docs/feature/remote-mcp/TASK.md)
- [Remote MCP 로컬 검증](docs/feature/remote-mcp/DEVELOPMENT.md)
- [Remote MCP Vercel 배포](docs/feature/remote-mcp/DEPLOYMENT.md)
- [Remote MCP Preview 검증 기록](docs/feature/remote-mcp/PREVIEW-VALIDATION.md)
- [Remote MCP Production 검증 기록](docs/feature/remote-mcp/PRODUCTION-VALIDATION.md)

## 현재 제한사항

- 후보는 최대 45개입니다.
- MCP Apps UI는 호스트가 확장을 협상한 경우에만 표시되며, 비지원 호스트에는 친화적 텍스트와 구조화 결과가 반환됩니다.
- MCP는 인증, 상태 저장, 결과 복구와 재현 가능한 난수 시드를 제공하지 않습니다.
- Vercel Preview와 Production의 Function·프로토콜·로그 검증은 통과했지만 실제 원격 MCP Apps 호스트 E2E는 아직 수행하지 않았습니다.
