import { describe, expect, it } from "vitest";
import {
  createAutoSchedule,
  createDrawOrder,
  secureRandomIndex,
  SecureRandomError,
  type RandomValuesSource,
} from "./random";
import { createBalls } from "./types";

function sequenceSource(...values: number[]): RandomValuesSource {
  return (target) => {
    const nextValue = values.shift();

    if (nextValue === undefined) {
      throw new Error("테스트 난수 값이 부족합니다.");
    }

    target[0] = nextValue;
    return target;
  };
}

describe("secureRandomIndex", () => {
  it("편향 구간의 값을 거부하고 다시 추출한다", () => {
    const source = sequenceSource(0xffff_ffff, 4);

    expect(secureRandomIndex(3, source)).toBe(1);
  });

  it("난수 소스 실패를 안전한 난수 오류로 변환한다", () => {
    expect(() =>
      secureRandomIndex(2, () => {
        throw new Error("실패");
      }),
    ).toThrow(SecureRandomError);
  });
});

describe("draw order and schedule", () => {
  it("모든 공을 정확히 한 번 포함한다", () => {
    const balls = createBalls(["가", "나", "다", "라"]);
    const order = createDrawOrder(balls, sequenceSource(0, 1, 0));

    expect(new Set(order)).toEqual(new Set(balls.map((ball) => ball.id)));
    expect(order).toHaveLength(balls.length);
  });

  it("첫 공부터 5~10초의 누적 일정을 만든다", () => {
    const schedule = createAutoSchedule(
      ["ball-1", "ball-2"],
      1_000,
      sequenceSource(0, 5),
    );

    expect(schedule.map((item) => item.dueAt)).toEqual([6_000, 16_000]);
  });
});
