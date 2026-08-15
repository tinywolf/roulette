import { describe, expect, it } from "vitest";
import {
  createAutoSchedule,
  type RandomValuesSource,
} from "./random";

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

describe("automatic draw schedule", () => {
  it("첫 공부터 3~7초의 누적 일정을 만든다", () => {
    const schedule = createAutoSchedule(
      ["ball-1", "ball-2"],
      1_000,
      sequenceSource(0, 4),
    );

    expect(schedule.map((item) => item.dueAt)).toEqual([4_000, 11_000]);
  });
});
