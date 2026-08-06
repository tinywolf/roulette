# ChatGPT MCP Apps 룰렛 UX 조사 기록

## 문서 상태

- 조사일: 2026-08-06
- 상태: 구현 중단 및 롤백
- 조사 대상: ChatGPT에서 로컬 원격 MCP를 연결했을 때의 룰렛 UI, 재추첨, 결과 전달, 대화 세션 복귀 동작
- 유지 기준 리비전: `9d5ca80` (`MCP App 재추첨과 결과 전달 호환성 개선`)
- 롤백 대상: `9d5ca80` 이후 작업 트리에 추가한 세션 복원 및 presentation 추정 실험

이 문서는 구현을 다시 적용하기 위한 명세가 아니라, 동일한 호스트 호환성 우회 작업을 반복하지 않도록 실험 과정과 중단 근거를 남기는 조사 기록이다.

## 목표

조사에서 확인하려던 UX는 다음과 같다.

1. MCP Apps UI를 지원하는 호스트에서는 추첨 결과를 대화 텍스트로 중복하지 않고 룰렛 UI 안에서 목록과 일반 텍스트로 표시한다.
2. UI를 지원하지 않는 CLI와 일반 MCP 호스트에서는 기존 텍스트·구조화 결과를 그대로 반환한다.
3. 사용자가 UI의 재추첨 버튼을 누르면 새 대화 답변이나 새 카드 없이 현재 iframe에서 결과와 텍스트를 갱신한다.
4. 다른 대화로 이동했다가 돌아와 이미 완료된 결과를 복원할 때는 추첨 애니메이션을 다시 실행하지 않는다.

## 구현하며 확인한 내용

### 요구사항을 직접 구현한 부분

- `draw_roulette`와 별도로 App 전용 `redraw_roulette`를 두고, UI가 `tools/call`로 같은 입력을 재호출하도록 구성했다.
- 재추첨 결과는 현재 iframe의 목록과 `추첨 결과: ...` 일반 텍스트를 함께 갱신하도록 했다.
- UI 지원 호스트에는 결과를 컴포넌트 전용 `_meta`로 전달하고, 비지원 호스트에는 `content`와 `structuredContent`를 반환하는 경로를 분리했다.
- 캐시된 과거 도구 결과가 이전 `ui://roulette/roulette-vN.html`을 참조해도 리소스를 읽을 수 있도록 버전 URI 호환 템플릿을 추가했다.
- `dev:mcp` 실행 시 운영 서버와 다른 MCP 이름을 주입하고, 요청 시각·경로·상태·처리 시간을 로깅하도록 했다.

이 부분들은 제품 요구사항 또는 일반적인 하위 호환·개발환경 요구사항을 직접 반영한 구현이었다.

### 유지한 호스트 호환 처리

- stateless 도구 호출에서 협상된 MCP Apps capability를 찾지 못하는 경우 `openai/session` 요청 메타데이터로 ChatGPT UI 호출을 추정했다.
- 최초 결과가 `_meta`와 `structuredContent` 중 어느 경로로 전달됐는지 모두 처리했다.

이 처리는 `9d5ca80`에 포함된 UI·텍스트 fallback 계약을 실제 ChatGPT와 CLI에서 동작시키기 위해 유지한다. 향후 표준 capability만으로 같은 동작을 보장할 수 있게 되면 제거 여부를 별도로 검토한다.

### 롤백한 세션 복원 실험

- `window.openai.widgetState`와 `setWidgetState`에 완료 결과 fingerprint를 기록해 새 iframe이 과거 결과를 복원했는지 비교했다.
- 초기 전역 값이 늦게 주입되는 경우를 위해 `openai:set_globals` 이벤트를 별도로 수신했다.
- 일반 객체와 `privateContent` 양쪽의 widget state 형태를 허용했다.
- 호스트가 제공할 수 있는 `openai/widgetSessionId`를 확인했다.
- 서버가 tool result를 생성한 시각 `roulette/presentation.issuedAt`을 `_meta`로 전달하고, 실제 애니메이션 길이가 지난 결과는 복원 결과라고 추정했다.
- 위 동작을 관찰하기 위해 앱 버전, 상태 읽기·쓰기 결과, 이벤트 횟수, 결과 출처, presentation 상태와 렌더 모드를 다수의 `data-roulette-*` 속성으로 노출했다.

이 세션 복원 실험들은 표준 lifecycle 신호로 요구사항을 구현한 것이 아니라, 호스트가 제공하지 않는 복원 여부를 여러 간접 신호로 추정하기 위한 코드였다.

## 실제 관찰 결과

CLI의 텍스트 결과와 UI 내부 재추첨 자체는 정상 동작했다. 문제가 된 것은 대화 세션을 벗어났다가 기존 결과 카드로 돌아왔을 때 ChatGPT가 iframe을 다시 구성하며 동일한 tool result를 전달하는 경우였다.

진단 마크업에서 다음 상태를 순서대로 확인했다.

```text
data-roulette-app-version="1.4.2"
data-roulette-restore-state="missing"
data-roulette-render-mode="animated"
```

```text
data-roulette-app-version="1.4.4"
data-roulette-globals-event-count="1"
data-roulette-restore-state="missing"
data-roulette-render-mode="animated"
data-roulette-state-read-source="globals-event"
data-roulette-state-write="succeeded"
data-roulette-widget-session-id="missing"
```

```text
data-roulette-app-version="1.4.5"
data-roulette-globals-event-count="1"
data-roulette-presentation-state="missing"
data-roulette-restore-state="missing"
data-roulette-render-mode="animated"
data-roulette-state-read-source="globals-event"
data-roulette-state-write="succeeded"
data-roulette-widget-session-id="missing"
```

이 결과로 다음을 확인했다.

- `openai:set_globals` 이벤트 리스너는 실제로 동작했다.
- `setWidgetState` 호출이 예외 없이 완료됐지만, 대화 복귀 후 새 iframe에는 저장한 룰렛 상태가 전달되지 않았다.
- 현재 호스트의 tool result에는 `openai/widgetSessionId`가 없었다.
- 과거에 저장된 tool result에는 나중에 추가한 presentation metadata가 없으므로 새 UI 리소스만 배포해 이를 보완할 수 없었다.
- 결과적으로 앱이 받는 데이터만으로는 최초 표시와 과거 결과 복원을 안정적으로 구분할 수 없었다.

## 공식 계약과의 차이

OpenAI 문서는 `window.openai.widgetState`를 선택적인 widget-scoped persistence로 설명하지만, 동시에 상태가 하나의 렌더링된 UI 인스턴스에 속하며 durable storage나 비즈니스 데이터의 원본으로 사용해서는 안 된다고 명시한다.

- <https://developers.openai.com/plugins/build/chatgpt-ui#keep-temporary-ui-state-in-the-ui>

또한 tool result 계약에서 다음을 구분한다.

- `content`와 `structuredContent`: 모델과 컴포넌트에 전달되고 대화 transcript에 포함될 수 있음
- `_meta`: 컴포넌트에만 전달되고 모델에는 노출되지 않음
- `openai/widgetSessionId`: 제공되는 경우 현재 마운트된 widget 인스턴스를 식별하는 값

- <https://developers.openai.com/plugins/reference#tool-results>

따라서 관찰된 동작을 곧바로 ChatGPT의 스펙 위반이라고 단정할 수는 없다. 핵심 문제는 애초에 기대했던 “대화 세션 복귀 후 새 iframe에서도 이전 widget state를 복원한다”는 수명주기가 공식 계약으로 보장되지 않는다는 점이다. 현재 호스트는 이 요구사항을 구현하는 데 필요한 `isRestore`, `isReplay` 같은 명시적 lifecycle 신호도 제공하지 않았다.

## 중단 판단

아래 두 상황이 앱에는 동일하게 보인다.

1. 서버가 방금 생성한 결과를 처음 표시하는 새 iframe
2. 대화 복귀 시 캐시된 과거 tool result를 다시 표시하는 새 iframe

두 경우에 같은 tool result가 전달되고 복원 상태나 replay 신호가 없다면, 클라이언트 코드만으로 “첫 표시는 애니메이션, 복귀 표시는 정적 결과”를 결정할 수 없다.

`issuedAt` 만료 판정은 이 정보 부족을 해결하지 않는다. 서버·클라이언트 시계, 네트워크와 모델 응답 지연, 캐시된 옛 결과의 metadata 유무에 따라 최초 표시도 정적으로 처리하거나 복원 표시를 다시 애니메이션할 수 있다. 이는 lifecycle을 구현한 것이 아니라 결과의 나이로 lifecycle을 추정하는 heuristic이다.

widget state 형태, 이벤트 도착 순서, 결과 envelope와 시각 metadata에 대한 fallback을 계속 추가하는 작업은 제품 요구사항 구현보다 특정 호스트 관찰값에 맞춘 polyfill 유지보수가 된다. 안정적인 완료 조건도 정의할 수 없으므로 추가 구현을 중단하고 관련 변경을 롤백한다.

## 재검토 조건

다음 중 하나가 충족될 때만 이 요구사항을 다시 검토한다.

- MCP Apps 또는 ChatGPT가 tool result의 최초 표시와 replay·restore를 구분하는 명시적 lifecycle 신호를 제공한다.
- 대화 세션 복귀를 포함하는 widget state 수명주기가 문서로 보장되고 실제 호스트에서 검증된다.
- 제품 요구사항을 “최초 결과도 정적으로 표시하고, 현재 iframe의 명시적 재추첨에서만 애니메이션한다”로 변경한다.
- 서버에 `drawId`별 최초 표시 여부를 영속 저장하고 원자적으로 claim하는 별도 상태 시스템의 비용을 수용한다.

마지막 선택지는 인증·영속 저장이 없는 현재 원격 룰렛 MCP의 범위를 크게 확장하므로 권장하지 않는다.

## 롤백 및 복구 정보

- 커밋된 UX 변경 `9d5ca80`은 유지한다.
- `9d5ca80` 이후 세션 복원 실험의 미커밋 변경은 `rollback-backup-mcpapp-session-restore-2026-08-06` stash에 보존했다.
- 세션 복원 실험과 함께 작성됐지만 독립 요구사항인 개발 요청 로그의 ISO 시각 표시는 선별 유지한다.
- 롤백 후 제품 코드는 `9d5ca80`을 기준으로 하며, 개발 로그 시각 표시와 이 조사 문서만 추가 변경으로 남긴다.
