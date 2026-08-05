# Remote MCP Vercel 배포 가이드

## 현재 준비 상태

- 배포 대상은 정적 웹앱이 아니라 `api/mcp.ts` Vercel Function 하나다.
- 외부 엔드포인트는 `https://<배포 도메인>/mcp`다.
- 정적 웹앱은 계속 GitHub Pages에서 빌드·배포한다.
- `j-personal-projects/roulette-remote-mcp` Vercel 프로젝트와 로컬 연결을 생성했다.
- Hobby 플랜과 공개 Preview 배포를 확인했다.
- 정상 Preview MCP는 `https://roulette-remote-l3lnprqhy-j-personal-projects.vercel.app/mcp`다.
- 첫 배포 자동 지정으로 생성된 Production 별칭은 수정 전 코드라 현재 500을 반환하며, 정상 Preview를 아직 승격하지 않았다.
- 현재 구현에는 환경 변수, 데이터베이스, KV, 캐시, 외부 API 키가 필요하지 않다.

2026-08-05 Preview 검증에서 23개 파일·157개 테스트, 웹·MCP App·MCP 빌드, 소스 경계, Vercel Function 전용 Build Output과 공개 원격 MCP 호출이 모두 통과했다. 상세 결과는 [Preview 검증 기록](PREVIEW-VALIDATION.md)을 참고한다.

## 사용자 확인이 필요한 항목

Production을 만들기 전에 아래 항목을 확정한다.

| 항목 | 권장값 | 확인 이유 |
| --- | --- | --- |
| Vercel 계정 범위 | `j-personal-projects`, Hobby 확인 완료 | Hobby는 개인·비상업 용도로만 사용할 수 있다. 상업적 운영이면 Pro 이상을 선택한다. |
| 프로젝트 이름 | `roulette-remote-mcp`, 생성 완료 | 정적 웹 프로젝트와 역할을 구분한다. 실제 `vercel.app` 도메인은 Preview 배포 후 생성된다. |
| 최초 배포 방식 | 첫 배포 자동 Production 지정 확인 | 빈 프로젝트에서는 `--prod`가 없어도 첫 배포가 Production이 될 수 있다. 현재 구버전 Production 처리는 사용자 결정 대기 중이다. |
| Preview 보호 | `None` 적용 완료 | 일반 MCP 호스트가 Vercel Authentication 로그인 리다이렉트를 처리한다고 가정할 수 없어 공개 검증 동안 보호를 비활성화했다. |
| Production 도메인 | 기본 `*.vercel.app` | MCP 연결에는 충분하다. 사용자 소유 커스텀 도메인은 선택 사항이다. |
| Git 연동 | Preview 통과와 `main` 병합 후 연결 | 현재 원격 `main`에는 MCP용 `vercel.json`이 없으므로 지금 저장소를 Import하면 정적 웹이 Vercel에 배포될 수 있다. |
| 공개 엔드포인트 정책 | 인증 없음에 동의, WAF rate limit 검토 | 누구나 `/mcp`를 호출할 수 있으므로 사용량과 남용을 관찰해야 한다. |
| 데이터 학습 설정 | `Team Settings → Data Preferences`에서 Model Training 비활성화 | 2026년 Vercel 정책상 Hobby는 선택적 AI 모델 학습이 기본 활성화될 수 있다. 애플리케이션 무로그 정책과 별개로 배포 전에 opt-out한다. |

Vercel 토큰은 채팅, 저장소, 문서에 전달하거나 기록하지 않는다. CLI 배포를 진행할 때 사용자가 자기 터미널에서 `vercel login`을 완료하는 방식이 가장 단순하다. CI용 토큰이 나중에 필요하면 Vercel 또는 GitHub Secrets에만 저장한다.

Vercel의 공식 변경 안내가 열거한 모델 학습 데이터는 코드·Vercel 에이전트 대화·빌드 및 배포 텔레메트리·빌드 오류·집계 트래픽 통계다. 런타임 후보 payload가 학습 대상이라고 단정할 근거는 없지만, 약관의 `Your Content` 정의는 넓으므로 개인정보 최소화 원칙에 따라 opt-out을 배포 선행 조건으로 둔다.

## 권장 배포 순서

### 1. Preview 프로젝트 연결

저장소 루트에서 실행한다. Vercel CLI는 저장소 의존성에 추가하지 않고 검증에 사용한 버전을 명시한다.

```bash
npx vercel@58.5.1 login
npx vercel@58.5.1 link
```

`vercel link`에서 다음을 선택한다.

- Scope: 확정한 개인 또는 팀 계정
- 기존 프로젝트: 없음
- 새 프로젝트 이름: 확정한 이름
- 소스 루트: 현재 저장소 루트 `.`

이 명령은 로컬 검증용 `.vercel/project.json`을 실제 `projectId`·`orgId`가 있는 연결 정보로 교체한다. `.vercel`은 Git에서 제외되어 있으므로 커밋하지 않는다.

현재 프로젝트 생성·연결은 완료됐다. CLI가 GitHub 저장소 연결도 시도했지만 Vercel 계정에 GitHub Login Connection이 없어 연결하지 않았다. Git 연동은 `main` 병합 후 진행하므로 Preview에는 필요하지 않다. 프로젝트 기본 Node.js는 현재 Vercel의 기본값인 24.x이며, Preview 호출에서 런타임 호환성을 검증한다.

### 2. Preview Build Output 생성

```bash
npx vercel@58.5.1 pull --yes --environment=preview
npx vercel@58.5.1 build
node tools/remote-mcp/verify-vercel-output.mjs .vercel/output
```

환경 변수는 현재 0개지만, `vercel pull`로 원격 프로젝트 설정을 동기화한 뒤 빌드한다. 검사기는 `/mcp` rewrite, `api/mcp` Function, 10초 제한, 웹 코드·정적 웹 산출물 비포함을 확인한다.

### 3. Preview 배포

```bash
npx vercel@58.5.1 deploy --prebuilt
```

이미 배포 이력이 있는 프로젝트에서는 `--prod`를 붙이지 않아야 Preview로 생성된다. 다만 빈 프로젝트의 첫 배포는 이 명령도 Production으로 자동 지정될 수 있으므로 CLI 결과의 `Environment`를 즉시 확인한다. 생성된 URL은 배포 검증 기록에 남기되 인증 토큰이나 보호 우회 값을 함께 기록하지 않는다.

이 프로젝트에서는 첫 배포가 자동으로 Production이 됐고, 수정 전 두 배포에서 Vercel Node 요청과 Web `Request` 형식 불일치가 발견됐다. 어댑터 수정 후 생성한 정상 Preview는 다음과 같다.

```text
https://roulette-remote-l3lnprqhy-j-personal-projects.vercel.app/mcp
```

### 4. Preview 검증

1. `https://<preview-domain>/mcp`에서 MCP 초기화와 `tools/list`가 성공하는지 확인한다.
2. 일부 추첨, 전체 추첨, 입력 문법, 잘못된 입력, 병렬 호출을 검증한다.
3. MCP Apps 지원 호스트에서 UI가 표시되고, 비지원 호스트에서 텍스트 결과가 유지되는지 확인한다.
4. 첫 호출과 후속 호출 시간을 비교해 cold start가 10초 제한 안에 들어오는지 확인한다.
5. Vercel Runtime Logs에서 요청 메타데이터 외 후보 원문·추첨 결과·요청 본문이 출력되지 않는지 확인한다.
6. 루트에 정적 웹앱이 제공되지 않고 기존 GitHub Pages 배포가 영향을 받지 않는지 확인한다.
7. Usage에서 Function 호출량·CPU·메모리를 확인한다.

공개 Preview에서 후보로 실제 개인정보나 민감정보를 사용하지 않는다. 검증 데이터는 `가,나,다`, `1~3, 민지*2`처럼 식별 불가능한 값만 쓴다.

위 항목 중 실제 원격 MCP Apps 호스트 렌더링과 Usage 장기 추이를 제외한 Function·프로토콜·로그 검증은 2026-08-05에 통과했다. 결과와 배포 ID는 [Preview 검증 기록](PREVIEW-VALIDATION.md)에 남겼다.

### 5. 운영 보호 설정

공개 무인증 MCP이므로 Production 전에 Vercel Firewall의 `/mcp` rate limit 규칙을 검토한다. Hobby에서도 프로젝트당 규칙 하나를 사용할 수 있다. 처음에는 `Log` 동작으로 정상 클라이언트의 요청 빈도를 관찰한 뒤, 임계값을 정해 `429` 차단으로 전환하는 순서가 안전하다. 이 설정은 후보나 결과 payload를 애플리케이션 로그에 추가하지 않는다.

Preview를 계속 공개할 이유가 없으면 검증 후 Deployment Protection을 다시 활성화하거나 해당 Preview의 사용을 중단한다. Production의 MCP 도메인은 서비스 요구사항상 공개 상태를 유지한다.

### 6. Production 배포

Preview 통과 후에만 다음 순서로 진행한다.

1. 현재 변경을 커밋하고 `feature/remote-mcp`를 원격에 push한다.
2. PR 검증 후 `main`에 병합한다.
3. 병합된 `main`에서 전체 검증과 Production Build Output 검사를 다시 실행한다.
4. 같은 Vercel 프로젝트에서 Production 배포를 실행한다.

```bash
npx vercel@58.5.1 pull --yes --environment=production
npx vercel@58.5.1 build --prod
node tools/remote-mcp/verify-vercel-output.mjs .vercel/output
npx vercel@58.5.1 deploy --prebuilt --prod
```

운영 URL은 `https://<production-domain>/mcp`다. Production 검증까지 통과한 뒤 Vercel 프로젝트를 GitHub의 `tinywolf/roulette` 저장소와 연결하고 Production Branch를 `main`으로 설정하면 이후 push 기반 자동 배포를 사용할 수 있다. GitHub Pages workflow와 Vercel의 `build:mcp`는 서로 다른 제품을 빌드한다.

## 실패와 롤백

- Preview 실패: Production으로 승격하지 않고 로그와 Build Output을 확인해 수정한 뒤 새 Preview를 만든다.
- 빈 프로젝트의 첫 배포가 자동 Production으로 지정됨: 해당 배포를 승격된 Preview로 간주하지 말고, Deployment 목록과 별칭 상태를 기록한 뒤 삭제 또는 교체 전에 사용자 승인을 받는다.
- 첫 Production 실패: 수정 Preview를 다시 검증한 뒤 Production을 재배포한다.
- 이후 Production 회귀: Dashboard의 Instant Rollback 또는 `vercel rollback`으로 직전 Production으로 되돌린다.
- Hobby에서는 즉시 롤백 대상이 바로 이전 Production 하나로 제한된다.
- 롤백 후에는 새 Production의 자동 도메인 연결이 중지될 수 있으므로, 수정본 검증 후 `vercel promote <deployment-url>`로 정상 배포 흐름을 복구한다.

## 공식 참고 자료

- [Git 저장소 배포](https://vercel.com/docs/git)
- [CLI로 프로젝트 배포](https://vercel.com/docs/projects/deploy-from-cli)
- [`vercel link`](https://vercel.com/docs/cli/link)
- [`vercel deploy --prebuilt`](https://vercel.com/docs/cli/deploy)
- [Deployment Protection](https://vercel.com/docs/deployment-protection)
- [Runtime Logs](https://vercel.com/docs/logs/runtime)
- [Hobby 플랜](https://vercel.com/docs/plans/hobby)
- [Vercel 이용약관](https://vercel.com/legal/terms)
- [2026년 데이터 학습 정책 변경 안내](https://vercel.com/changelog/updates-to-terms-of-service-march-2026)
- [WAF Rate Limiting](https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting)
- [Instant Rollback](https://vercel.com/docs/instant-rollback)
