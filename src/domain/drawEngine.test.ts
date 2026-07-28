import { describe, expect, it } from "vitest";
import {
  beginManualDraw,
  completeManualDraw,
  createDrawSession,
  formatResults,
  reconcileScheduledDraws,
  resetDrawSession,
} from "./drawEngine";
import type { RandomValuesSource } from "./random";
import { createBalls } from "./types";

const zeroSource: RandomValuesSource = (target) => {
  target[0] = 0;
  return target;
};

describe("manual draw", () => {
  it("공을 비복원 방식으로 하나씩 뽑는다", () => {
    const balls = createBalls(["민지", "민지"]);
    let session = createDrawSession(balls, "manual", balls.length, 1_000);

    session = beginManualDraw(session, zeroSource);
    const duplicateClick = beginManualDraw(session, zeroSource);
    expect(duplicateClick).toBe(session);

    session = completeManualDraw(session, 2_000);
    expect(session.results).toHaveLength(1);
    expect(session.remainingBallIds).toHaveLength(1);
    expect(session.phase).toBe("ready");

    session = beginManualDraw(session, zeroSource);
    session = completeManualDraw(session, 3_000);
    expect(session.results).toHaveLength(2);
    expect(new Set(session.results.map((result) => result.ballId)).size).toBe(2);
    expect(session.phase).toBe("completed");
  });

  it("난수 생성 실패 시 오류 상태로 전환한다", () => {
    const session = createDrawSession(
      createBalls(["가", "나"]),
      "manual",
      2,
      0,
    );
    const failed = beginManualDraw(session, () => {
      throw new Error("실패");
    });

    expect(failed.phase).toBe("error");
    expect(failed.error).toContain("추첨을 중단");
  });

  it("목표 개수만 뽑으면 남은 후보가 있어도 완료한다", () => {
    const balls = createBalls(["가", "나", "다", "라", "마"]);
    let session = createDrawSession(balls, "manual", 2, 1_000);

    session = completeManualDraw(beginManualDraw(session, zeroSource), 2_000);
    session = completeManualDraw(beginManualDraw(session, zeroSource), 3_000);

    expect(session.phase).toBe("completed");
    expect(session.results).toHaveLength(2);
    expect(session.remainingBallIds).toHaveLength(3);
    expect(beginManualDraw(session, zeroSource)).toBe(session);
  });
});

describe("automatic draw", () => {
  it("지난 일정을 순서대로 한 번만 반영한다", () => {
    const balls = createBalls(["가", "나", "다"]);
    const session = createDrawSession(
      balls,
      "auto",
      balls.length,
      1_000,
      zeroSource,
    );
    const firstDueAt = session.schedule[0].dueAt;
    const secondDueAt = session.schedule[1].dueAt;
    const reconciled = reconcileScheduledDraws(session, secondDueAt);
    const reconciledAgain = reconcileScheduledDraws(reconciled, secondDueAt);

    expect(firstDueAt).toBe(4_000);
    expect(reconciled.results.map((result) => result.order)).toEqual([1, 2]);
    expect(reconciledAgain.results).toEqual(reconciled.results);

    const completed = reconcileScheduledDraws(
      reconciledAgain,
      session.schedule[2].dueAt,
    );
    expect(completed.phase).toBe("completed");
    expect(completed.remainingBallIds).toEqual([]);
  });

  it("시작 시 난수 생성 실패를 오류 세션으로 변환한다", () => {
    const session = createDrawSession(
      createBalls(["가", "나"]),
      "auto",
      2,
      0,
      () => {
        throw new Error("실패");
      },
    );

    expect(session.phase).toBe("error");
    expect(session.schedule).toEqual([]);
  });

  it("일부 추첨 목표만 일정에 넣고 마지막 목표에서 완료한다", () => {
    const balls = createBalls(["가", "나", "다", "라", "마"]);
    const session = createDrawSession(balls, "auto", 2, 1_000, zeroSource);

    expect(session.schedule).toHaveLength(2);

    const completed = reconcileScheduledDraws(
      session,
      session.schedule[1].dueAt,
    );

    expect(completed.phase).toBe("completed");
    expect(completed.results).toHaveLength(2);
    expect(completed.remainingBallIds).toHaveLength(3);
  });
});

describe("createDrawSession", () => {
  it("유효하지 않은 목표 개수로 세션을 만들지 않는다", () => {
    const balls = createBalls(["가", "나"]);

    expect(() => createDrawSession(balls, "manual", 0, 0)).toThrow(RangeError);
    expect(() => createDrawSession(balls, "manual", 3, 0)).toThrow(RangeError);
    expect(() => createDrawSession(balls, "manual", 1.5, 0)).toThrow(
      RangeError,
    );
  });
});

describe("formatResults", () => {
  it("순서와 전체 이름을 줄 단위 텍스트로 만든다", () => {
    const session = createDrawSession(
      createBalls(["민지", "준호"]),
      "manual",
      2,
      0,
    );
    const first = completeManualDraw(beginManualDraw(session, zeroSource), 1_000);

    expect(formatResults(first.results)).toBe("1. 민지");
  });
});

describe("resetDrawSession", () => {
  it("진행 중 세션을 설정 상태로 되돌릴 수 있게 제거한다", () => {
    expect(resetDrawSession()).toBeNull();
  });
});
