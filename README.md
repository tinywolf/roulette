# 로또 추첨기

같은 추첨 규칙을 두 가지 방식으로 제공하는 프로젝트입니다.

- 정적 웹앱: 브라우저에서 2D·3D 애니메이션과 함께 수동 또는 자동 추첨
- Remote MCP: 에이전트가 옵션을 모두 확인한 뒤 텍스트 결과를 즉시 반환하는 공개·stateless 도구

추첨 결과는 Web Crypto API와 거부 샘플링을 이용한 Fisher–Yates 순열로 결정합니다. 웹 애니메이션은 이미 결정된 결과의 표현만 담당합니다.

## 주요 기능

- 줄바꿈 또는 콤마로 후보 구분
- `민지*2`, `7*3` 반복 입력과 `1~45` 숫자 범위 입력
- 2~45개 후보, 후보 이름당 최대 20자
- 중복 이름을 서로 다른 후보로 취급
- 전체 또는 지정 개수 비복원 추첨
- 웹의 수동·자동 추첨, 2D Canvas·3D WebGL 연출, 효과음과 결과 복사
- 웹 입력·설정을 브라우저 `localStorage`에 보존
- MCP `draw_roulette` 도구의 텍스트 및 구조화 결과
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

웹에서는 전체/일부 추첨과 수동/자동 모드를 선택한 뒤 시작합니다. MCP에서는 에이전트가 후보 목록과 추첨 인원을 모두 확인한 경우에만 `draw_roulette`를 호출합니다. 전체 추첨은 `drawCount: "all"`, 일부 추첨은 양의 정수를 사용합니다.

## 기술 구성

| 영역 | 기술 |
|---|---|
| 공통 코어 | TypeScript, Web Crypto API |
| 정적 웹 | React 19, Vite, Canvas 2D, WebGL, Web Audio |
| Remote MCP | MCP TypeScript SDK 2, `mcp-handler`, Zod, Vercel Function |
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

서버가 준비되면 다음 주소가 출력됩니다.

```text
Local MCP server: http://127.0.0.1:3000/mcp
```

로컬 MCP 서버를 사용하는 동안 이 터미널을 계속 실행해 둡니다. 서버를 종료할 때는 `Ctrl+C`를 누릅니다.

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

## 테스트와 검증

전체 제품 경계와 회귀를 한 번에 검증합니다.

```bash
npm run verify
```

영역별 명령은 다음과 같습니다.

```bash
npm run test:core
npm run test:web
npm run test:mcp
npm run build:web
npm run build:mcp
npm run verify:boundaries
```

`verify:boundaries`는 공통 코어의 역방향 의존, 웹과 MCP의 교차 import, 안전하지 않은 난수, MCP 애플리케이션 로그와 웹 번들의 MCP 코드 혼입을 검사합니다.

Remote MCP의 로컬 실행과 Inspector 검증은 [기능 개발 가이드](docs/feature/remote-mcp/DEVELOPMENT.md)를 따릅니다. 이번 작업 범위에는 Vercel Preview·Production 배포가 포함되지 않습니다.

## 프로젝트 구조

```text
.
├── api/
│   └── mcp.ts                   # Vercel Function 진입점
├── docs/
│   ├── architecture.md
│   ├── development.md
│   └── feature/remote-mcp/      # Remote MCP SPEC·TASK·가이드
├── src/
│   ├── core/                    # 양쪽에서 재사용하는 파싱·난수·즉시 추첨
│   ├── web/                     # React·렌더링·저장·오디오 전용 코드
│   └── mcp/                     # 도구 계약·HTTP 정책·오류·텍스트 표현
├── tools/remote-mcp/            # 로컬 서버와 경계·Vercel 검증 도구
├── vercel-static/               # Vercel에 웹앱을 싣지 않는 빈 정적 출력
├── tsconfig.web.json
├── tsconfig.mcp.json
├── vercel.json
└── vite.config.ts
```

의존성 방향은 `web → core ← mcp ← api`입니다. `web`과 `mcp`는 서로 import하지 않으며 `core`는 React, DOM, MCP SDK 또는 Vercel API를 참조하지 않습니다.

## 데이터와 개인정보

- 웹 입력 원문과 설정은 사용자의 브라우저 `localStorage`에만 저장됩니다.
- MCP 후보와 결과는 요청 처리 중 메모리에서만 사용하고 로그·데이터베이스·캐시에 남기지 않습니다.
- 공개 MCP에는 인증이 없으므로 민감한 개인정보를 후보로 입력하지 않는 것이 좋습니다.
- Vercel 등 호스팅 플랫폼의 인프라 수준 요청 메타데이터는 애플리케이션의 무로그 정책과 별개일 수 있습니다.

## 관련 문서

- [기존 웹 제품 스펙](docs/SPEC.md)
- [아키텍처](docs/architecture.md)
- [개발 가이드](docs/development.md)
- [Remote MCP 스펙](docs/feature/remote-mcp/SPEC.md)
- [Remote MCP 작업 기록](docs/feature/remote-mcp/TASK.md)
- [Remote MCP 로컬 검증](docs/feature/remote-mcp/DEVELOPMENT.md)

## 현재 제한사항

- 후보는 최대 45개입니다.
- MCP 1차 버전은 텍스트 결과만 제공하며 MCP Apps 애니메이션은 후속 범위입니다.
- MCP는 인증, 상태 저장, 결과 복구와 재현 가능한 난수 시드를 제공하지 않습니다.
- 실제 Vercel 배포와 배포 후 원격 클라이언트 검증은 별도 작업입니다.
