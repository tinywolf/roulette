---
revision: d90764e
updated_at: 2026-07-28T15:24:30+09:00
---

# 개발 가이드

## 로컬 구성

검증에 사용한 환경은 Node.js `22.22.1`, npm `10.9.4`다. 환경 변수, API 키, 백엔드 서비스는 필요하지 않다.

```bash
npm install
npm run dev
```

개발 서버의 기본 주소는 `http://localhost:5173`이다. 프로덕션 산출물은 다음 명령으로 `dist/`에 생성한다.

```bash
npm run build
```

`dist/`는 정적 파일이지만 특정 호스팅 서비스의 base path, 리다이렉트, 자동 배포 설정은 현재 범위에 없다.

## 검증 명령

```bash
npm run typecheck
npm test
npm run build
npm audit --omit=dev
```

- `typecheck`: `tsc --noEmit`으로 `src/`를 검사한다.
- `test`: jsdom 환경에서 전체 Vitest 스위트를 한 번 실행한다.
- `build`: 타입 검사 후 Vite 프로덕션 번들을 생성한다.
- `npm audit --omit=dev`: 런타임 의존성의 알려진 취약점을 확인한다.

2026-07-28 기준 전체 8개 테스트 파일, 54개 테스트와 정적 빌드가 통과했고 프로덕션 의존성 취약점은 0건이었다.

## 프로젝트 특화 구조와 패턴

### 도메인 로직은 브라우저 UI와 분리한다

`src/domain/`에는 DOM, React, Canvas 호출을 추가하지 않는다. 추첨 규칙 변경은 먼저 순수 함수와 단위 테스트에 반영한다.

- `names.ts`: 이름 목록 파싱, 숫자 범위 확장과 입력 제한
- `drawCount.ts`: 전체·일부 추첨 목표 개수 검증
- `random.ts`: 난수 생성, 순열, 자동 일정
- `drawEngine.ts`: 수동·자동 상태 전이와 결과
- `types.ts`: 세션과 공의 공통 계약

난수 함수는 테스트용 `RandomValuesSource`를 선택적으로 받는다. 새로운 무작위 기능도 `Math.random()`을 직접 사용하지 말고 이 경계를 재사용한다.

### 연출은 결과를 결정하지 않는다

`LotteryMachine`은 `remainingBalls`, `isMixing`, `isSettling`, `visualBall`을 받아 그린다. `lotteryMotion.ts`의 3축 좌표·속도·투영 결과를 `DrawEngine`에 되돌려 보내지 않는다. 이 원칙을 깨면 저성능 기기에서 추첨 결과가 달라질 수 있다.

### 자동 추첨은 절대 시각으로 계산한다

남은 시간을 감소시키는 방식 대신 각 공의 `dueAt`을 저장한다. 탭 가시성 변경, 포커스 복귀, 지연된 타이머에서 현재 시각을 기준으로 `reconcileScheduledDraws`를 호출한다.

타이머 코드를 변경할 때 다음 조건을 유지한다.

- 이미 반영한 공은 다시 추가하지 않는다.
- 백그라운드에서 놓친 여러 연출을 복귀 후 몰아서 재생하지 않는다.
- 목표 개수의 마지막 결과가 반영되면 `completed`로 전환한다.
- 재시작 시 타이머와 이벤트 구독을 정리한다.

### 브라우저 API 실패를 격리한다

`localStorage`, Clipboard, Web Audio, Canvas는 실패할 수 있다. 기술 예외를 UI까지 전달하지 말고 현재 모듈의 한국어 결과나 무해한 실패로 바꾼다. Web Crypto만은 정확성 요구사항 때문에 실패 시 추첨을 중단한다.

## 상태 변경 지점

앱 수준 상태는 `src/App.tsx`가 소유한다.

| 상태 | 변경 경로 |
|---|---|
| `rawInput` | 설정 입력, 모두 지우기, 초기 저장 복원 |
| `mode` | 설정 화면의 수동·자동 선택 |
| `drawCountMode` | 전체·일부 추첨 선택, 새로고침 시 `all` |
| `customDrawCount` | 일부 추첨의 숫자 입력, 새로고침 시 `"1"` |
| `session` | 시작, 수동 완료 타이머, 자동 일정 복구, 재시작 |
| `soundEnabled` | 효과음 토글, 새로고침 시 항상 `false` |
| `notice` | 저장·복사·난수·Canvas 결과 |
| `visualResult` | 화면이 보이는 상태에서 한 공이 새로 반영될 때 |

상태 분기가 더 늘어나면 `session`과 타이머 조정을 별도 `useDrawSession` 훅이나 reducer로 옮기되, 도메인 순수 함수는 유지한다.

## 기능 변경 가이드

### 입력 제한 변경

1. `src/domain/names.ts`의 상수를 변경한다.
2. `src/domain/names.test.ts` 경계값을 갱신한다.
3. `SetupPanel`의 개수 배지와 안내 문구를 함께 바꾼다.
4. 공 개수를 늘리면 Canvas와 모바일 레이아웃을 다시 검수한다.

숫자 범위는 입력 전체에 ASCII `~`가 있을 때 우선 적용한다. 일반 이름과의 혼합을 허용하려면 단순 구분자 추가가 아니라 문법 충돌, 이름에 포함된 `~`, 생성 개수 합산 규칙을 먼저 정의해야 한다.

### 자동 간격 변경

1. `createAutoSchedule`의 범위를 변경한다.
2. 가짜 난수 기반 단위 테스트의 `dueAt` 기대값을 수정한다.
3. `App.test.tsx`의 가짜 시계 자동 흐름을 갱신한다.
4. `docs/SPEC.md`와 아키텍처 문서의 수치를 함께 변경한다.

### 추첨 목표 개수 변경

1. 설정 입력 검증은 `validateDrawCount`에서 처리한다.
2. `createDrawSession`에는 후보 수 이내의 양의 정수 `drawCount`만 전달한다.
3. 수동 완료 조건, 자동 일정 길이와 결과 카운터가 모두 `session.drawCount`를 기준으로 하는지 확인한다.
4. 일부 추첨 완료 후 `remainingBallIds`가 남는 것은 정상이며 결과 수와 목표 개수가 같은지를 먼저 확인한다.

### Canvas 연출 변경

운동 규칙은 `lotteryMotion.ts`, 실제 그리기는 `LotteryMachine.tsx`에 둔다. `BallMotionNode`는 화면 중심 기준 상대 3축 좌표를 사용하므로 리사이즈 시 위치와 속도를 같은 비율로 조정한다.

- 공 간 충돌은 완료 후 정착 단계에서만 사용한다. 혼합 단계에 다시 추가하면 투영 겹침과 45개 혼합 유동성이 줄어들 수 있다.
- 공 반지름은 깊이와 무관하게 고정한다. 좌표 원근과 투명도 범위를 바꾸면 모바일에서 이름 가독성과 원형 경계 침범을 함께 확인한다.
- 중앙 횡단은 공별 위상이 다른 목표점과 횡단 제트가 담당한다. 목표점 추종력을 바꾸면 중앙 군집 없이 바깥 공과 중앙 공이 동시에 보이는지 확인한다.
- 완료 후 정착은 중력, 구형 경계 반발, 3회의 공 간 위치 보정과 저반발 충돌로 처리한다. 반복 횟수나 마찰을 바꾸면 공 관통·바닥 떨림·모바일 프레임을 함께 확인한다.
- 배출 시작 시각은 공 ID별 ref에 유지해 혼합 상태 변경으로 직전 배출이 재생되지 않게 한다.
- `DrawSession`은 수정하지 않으며 애니메이션 예외는 `onError`로 격리한다.

## 테스트

### 설정

`vitest.config.ts`는 jsdom과 `src/test/setup.ts`를 사용한다. 테스트 설정은 Canvas context, `ResizeObserver`, animation frame을 최소 구현으로 대체해 도메인·UI 검증이 실제 프레임 루프에 의존하지 않게 한다.

테스트 파일은 대상 파일과 같은 디렉터리에 둔다.

```text
src/domain/names.ts
src/domain/names.test.ts
```

### 새 테스트 작성

아래 예제는 현재 `src/domain/names.test.ts`에 포함된 형태와 동일한 패턴이며 실제로 실행해 통과했다.

```ts
import { describe, expect, it } from "vitest";
import { parseNames } from "./names";

describe("parseNames", () => {
  it("중복 이름을 허용한다", () => {
    const result = parseNames("민지, 민지");

    expect(result.errors).toEqual([]);
    expect(result.names).toEqual(["민지", "민지"]);
  });
});
```

해당 테스트만 실행하려면 다음 명령을 사용한다.

```bash
npm test -- src/domain/names.test.ts
```

문서 작성 시 이 명령을 실제 실행했고 1개 파일의 9개 테스트가 통과했다.

### 난수 테스트

분포를 반복 실행해 통계적으로 단정하지 않는다. `RandomValuesSource`에 미리 정한 32비트 값을 주입해 다음을 결정적으로 검증한다.

- 거부 구간 값은 폐기하고 다음 값을 사용한다.
- Fisher–Yates 결과가 모든 공 ID를 한 번씩 포함한다.
- 0과 4 인덱스가 각각 3초와 7초 간격을 만든다.
- 난수 소스 예외가 `SecureRandomError`로 바뀐다.

### 타이머 테스트

React 통합 테스트에서는 `vi.useFakeTimers()`와 `vi.setSystemTime()`을 사용한다. 수동 혼합은 2,400ms, 자동 첫 결과는 주입된 난수에 따라 3,000ms 경계 전후를 검증한다. 테스트 종료 전 `vi.useRealTimers()`로 복구한다.

### 수동 스모크 체크리스트

- 입력 2개 미만, 46개 이상, 20자 초과에서 시작이 비활성화되는가
- 중복 이름이 별도의 공으로 보이는가
- `1~45`가 45개의 숫자 공으로 보이고 입력 원문 그대로 새로고침 후 복원되는가
- 숫자 범위와 일반 이름의 혼합, 역순, 46개 이상 범위가 차단되는가
- 전체 추첨이 기본으로 선택되고 일부 추첨이 1~후보 수 범위만 허용하는가
- 45개 중 6개 추첨이 여섯 번째 결과에서 완료되는가
- 45개 혼합 프레임에서 모든 공 크기가 같고 중앙·바깥 공이 동시에 보이며 역동적으로 위치가 변하는가
- 일부 추첨 완료 후 남은 공이 원형 바닥에 여러 층으로 쌓이고 흔들림이 감쇠하는가
- 두 번째 수동 혼합에서 직전 배출 공이 다시 나타나지 않는가
- 수동 버튼 연속 클릭이 결과를 중복 생성하지 않는가
- 자동 모드에 카운트다운과 일시정지 버튼이 없는가
- 새로고침에서는 입력만, 처음부터 다시에서는 입력과 현재 설정이 유지되는가
- 결과 복사 형식이 `1. 이름`인가
- 390px 모바일 폭에서 설정·Canvas·결과가 잘리거나 겹치지 않는가
- 브라우저 콘솔에 오류가 없는가

현재 데스크톱과 390×844 모바일 Chromium 스모크는 통과했다. Safari, Firefox, Edge 실제 실행은 가능한 환경에서 추가해야 한다.

## 디버깅

### 자동 결과가 늦게 보일 때

`session.schedule`의 `dueAt`, `Date.now()`, `session.results`의 공 ID를 비교한다. 백그라운드 탭에서는 타이머가 정확한 순간에 실행되지 않는 것이 정상이며, 복귀 후 일정이 중복 없이 반영되는지를 확인한다.

### Canvas와 결과 개수가 다를 때

전체 후보와 Canvas 표시의 기준은 `DrawSession.remainingBallIds`다. 완료 여부와 결과 카운터의 기준은 `DrawSession.drawCount`다. 일부 추첨 완료 시 둘의 개수가 다른 것은 정상이다. Canvas 노드는 파생 상태이므로 `nodesRef`를 데이터 원본으로 사용하지 않는다. 공 ID 동기화와 effect cleanup을 먼저 확인한다.

### 저장 경고가 반복될 때

브라우저의 사이트 저장 권한과 private mode를 확인한다. 앱은 저장 실패 후에도 현재 메모리 입력으로 동작해야 한다.

### 오디오가 재생되지 않을 때

최초 토글이 사용자 클릭 안에서 실행되는지와 `AudioContext.state`를 확인한다. 오디오 실패는 핵심 추첨 결함으로 취급하지 않는다.

## 보안 점검

- 소스와 문서에서 password, API key, client secret, private key, access token 패턴을 검색했으며 직접 포함된 민감 정보는 발견되지 않았다.
- `npm audit --omit=dev` 결과 프로덕션 취약점은 0건이었다.
- 이름은 네트워크로 전송하지 않고 React 텍스트 노드와 Canvas `fillText`로만 표시한다.
- 이름 원문은 `localStorage`에 평문으로 남는다. 공용 기기에서는 `모두 지우기`를 사용해야 한다.
- 새로운 원격 의존성, 분석 도구, 폰트, 이미지 CDN을 추가하면 “브라우저 안에서만 처리” 안내와 개인정보 흐름을 다시 검토한다.

## 알려진 제약

- 문서의 `revision`은 이번 변경을 시작한 기준 커밋 `d90764e`다. 후속 커밋 이후 문서를 갱신할 때 새 기준 리비전으로 교체한다.
- 최대 공 개수는 45개다.
- Canvas는 실제 3D 엔진이 아니라 3축 운동을 2D로 투영하는 연출이다.
- 추첨 결과와 세션은 새로고침 후 복구하지 않는다.
- 특정 호스팅 서비스 설정, PWA, 접근성 전용 대응, 모니터링은 초기 범위 밖이다.
