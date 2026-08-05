# Remote MCP Vercel Production 검증 기록

## 배포 대상

- 배포일: 2026-08-05
- Git 커밋: `38fdfdc` (`main`, `origin/main` 일치)
- Vercel Scope: `j-personal-projects` Hobby
- 프로젝트: `roulette-remote-mcp`
- Production Deployment: `dpl_5nJj91sxSSYLBfvw7iUMceNPtQb3`
- 고유 URL: `https://roulette-remote-ah873qdkq-j-personal-projects.vercel.app`
- 운영 MCP URL: `https://roulette-remote-mcp.vercel.app/mcp`
- 런타임: Vercel Node.js 24.x, ARM64, `iad1`, 최대 실행 시간 10초

사용자는 Preview에서 동일한 기능 계약을 이미 검증했으므로 별도 staged Production 배포를 생략하고 운영 도메인에 직접 연결하기로 결정했다.

## 배포 전 검증

- 로컬 `main`과 `origin/main`이 `38fdfdc`로 일치하고 worktree가 깨끗함
- Production 프로젝트 설정 pull 완료
- 23개 파일·157개 테스트 통과
- 웹·MCP App·MCP 빌드와 소스·번들 경계 검사 통과
- Production Build Output의 `/mcp` rewrite와 `api/mcp` Function 전용 구성 확인

## 운영 도메인 검증

| 항목 | 결과 | 확인 내용 |
| --- | --- | --- |
| Deployment | 통과 | target `production`, 상태 `Ready`, 프로젝트 Production 대상 ID 일치 |
| 운영 별칭 | 통과 | `roulette-remote-mcp.vercel.app`이 새 Deployment에 연결됨 |
| 루트 경로 | 통과 | `/`는 404, 약 0.11초로 정적 웹앱 미배포 확인 |
| MCP 응답 정책 | 통과 | 일반 GET 405, `cache-control: no-store`, `x-content-type-options: nosniff`, 약 0.27초 |
| 도구 목록 | 통과 | `draw_roulette` 하나와 필수 입력·출력 스키마 확인 |
| 정상 추첨 | 통과 | 합성 후보 3개 중 2개 추첨, 텍스트와 구조화 결과 일치 |
| MCP App 리소스 | 통과 | `ui://roulette/roulette-v1.html`, `text/html;profile=mcp-app`, 자체 포함 HTML 330,042자 확인 |
| Runtime Logs | 통과 | 35개 로그에 메서드·경로만 있으며 후보·결과·요청 본문·오류 없음 |
| 보호 설정 | 통과 | Vercel Authentication 비활성화, 자동화 우회 토큰 0개 |

검증에는 `운영검증A`처럼 식별 불가능한 합성 후보만 사용했다.

## 현재 운영 제약과 후속 작업

- 현재 배포가 첫 정상 Production이므로 이전 Production으로 즉시 롤백할 수 없다. 장애 시 수정본을 새 Production으로 배포한다.
- Preview 배포 2개는 Production 확인 후 삭제했고 각 고유 URL의 404를 확인했다.
- Vercel Dashboard의 Model Training opt-out 상태는 CLI에서 검증하지 못하므로 사용자가 최종 확인한다.
- 실제 MCP Apps 호스트의 원격 UI 렌더링과 대화 기반 옵션 수집 E2E는 별도 작업이다.
- GitHub–Vercel 자동 배포 연결과 공개 `/mcp` rate limit은 운영 안정화 단계에서 검토한다.
