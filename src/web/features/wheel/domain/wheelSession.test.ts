import { describe, expect, it } from "vitest";
import type { RandomValuesSource } from "../../../../core/random";
import {
  beginWheelSpin,
  clearWheelOutcomes,
  completeWheelSpin,
  createWheelCandidates,
  createWheelSession,
} from "./wheelSession";

function fixedRandom(value: number): RandomValuesSource {
  return (values) => {
    values[0] = value;
  };
}

describe("wheelSession", () => {
  const candidates = createWheelCandidates(["민지", "민지", "준호"]);

  it("중복 이름에도 순서 기반의 고유 후보 ID를 부여한다", () => {
    expect(candidates).toEqual([
      { id: "wheel-candidate-1", name: "민지" },
      { id: "wheel-candidate-2", name: "민지" },
      { id: "wheel-candidate-3", name: "준호" },
    ]);
  });

  it("회전 시작 시 목표와 공개 시각을 먼저 확정한다", () => {
    const session = createWheelSession(candidates);
    const spinning = beginWheelSpin(session, 1_000, 4_000, fixedRandom(1));

    expect(spinning).toMatchObject({
      phase: "spinning",
      activeSpin: {
        outcomeId: "wheel-outcome-1",
        targetCandidateId: "wheel-candidate-2",
        startedAt: 1_000,
        revealAt: 5_000,
      },
      outcomes: [],
      error: null,
    });
  });

  it("같은 후보의 연속 당첨을 별도 outcome으로 기록한다", () => {
    let session = createWheelSession(candidates);

    session = beginWheelSpin(session, 0, 100, fixedRandom(0));
    session = completeWheelSpin(session, "wheel-outcome-1", 100);
    session = beginWheelSpin(session, 200, 100, fixedRandom(0));
    session = completeWheelSpin(session, "wheel-outcome-2", 300);

    expect(session.phase).toBe("ready");
    expect(session.candidates).toEqual(candidates);
    expect(session.outcomes).toEqual([
      {
        id: "wheel-outcome-1",
        spinNumber: 1,
        candidateId: "wheel-candidate-1",
        name: "민지",
        drawnAt: 100,
      },
      {
        id: "wheel-outcome-2",
        spinNumber: 2,
        candidateId: "wheel-candidate-1",
        name: "민지",
        drawnAt: 300,
      },
    ]);
  });

  it("활성 회전 중 추가 시작 요청은 같은 세션을 반환한다", () => {
    const spinning = beginWheelSpin(
      createWheelSession(candidates),
      0,
      100,
      fixedRandom(0),
    );

    expect(beginWheelSpin(spinning, 10, 100, fixedRandom(2))).toBe(spinning);
  });

  it("이르거나 다른 outcome의 완료와 중복 완료를 무시한다", () => {
    const spinning = beginWheelSpin(
      createWheelSession(candidates),
      0,
      100,
      fixedRandom(2),
    );

    expect(completeWheelSpin(spinning, "다른-id", 100)).toBe(spinning);
    expect(completeWheelSpin(spinning, "wheel-outcome-1", 99)).toBe(spinning);

    const completed = completeWheelSpin(spinning, "wheel-outcome-1", 500);
    expect(completed.outcomes).toHaveLength(1);
    expect(completeWheelSpin(completed, "wheel-outcome-1", 500)).toBe(
      completed,
    );
  });

  it("난수 실패는 결과 없는 오류 상태가 되고 같은 세션에서 재시도한다", () => {
    const ready = createWheelSession(candidates);
    const failed = beginWheelSpin(ready, 0, 100, () => {
      throw new Error("crypto failure");
    });

    expect(failed).toEqual({
      ...ready,
      phase: "error",
      activeSpin: null,
      error: "안전한 난수를 생성하지 못했습니다. 다시 시도해 주세요.",
    });

    const retried = beginWheelSpin(failed, 200, 100, fixedRandom(2));
    expect(retried.phase).toBe("spinning");
    expect(retried.activeSpin?.targetCandidateId).toBe("wheel-candidate-3");
  });

  it("결과 비우기는 후보를 유지하고 준비 상태로 돌아간다", () => {
    const spinning = beginWheelSpin(
      createWheelSession(candidates),
      0,
      100,
      fixedRandom(0),
    );
    const completed = completeWheelSpin(spinning, "wheel-outcome-1", 100);

    expect(clearWheelOutcomes(completed)).toEqual({
      candidates,
      phase: "ready",
      activeSpin: null,
      outcomes: [],
      error: null,
    });
  });
});
