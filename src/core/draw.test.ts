import { describe, expect, it } from "vitest";
import { drawCandidates } from "./draw";
import type { RandomValuesSource } from "./random";

function sequenceSource(...values: number[]): RandomValuesSource {
  return (target) => {
    const value = values.shift();

    if (value === undefined) {
      throw new Error("테스트 난수 값이 부족합니다.");
    }

    target[0] = value;
  };
}

describe("drawCandidates", () => {
  it("후보를 비복원 방식으로 즉시 추첨하고 요약을 반환한다", () => {
    const candidates = [
      { id: "candidate-1", name: "민지" },
      { id: "candidate-2", name: "민지" },
      { id: "candidate-3", name: "준호" },
    ];
    const selection = drawCandidates(
      candidates,
      2,
      sequenceSource(0, 0),
    );

    expect(selection).toEqual({
      candidateCount: 3,
      drawCount: 2,
      remainingCount: 1,
      results: [
        { order: 1, id: "candidate-2", name: "민지" },
        { order: 2, id: "candidate-3", name: "준호" },
      ],
    });
    expect(new Set(selection.results.map((result) => result.id)).size).toBe(2);
  });

  it("잘못된 추첨 수와 중복 후보 ID를 거부한다", () => {
    const candidates = [
      { id: "candidate-1", name: "가" },
      { id: "candidate-2", name: "나" },
    ];

    expect(() => drawCandidates(candidates, 0)).toThrow(RangeError);
    expect(() => drawCandidates(candidates, 3)).toThrow(RangeError);
    expect(() =>
      drawCandidates(
        [
          { id: "candidate-1", name: "가" },
          { id: "candidate-1", name: "나" },
        ],
        1,
      ),
    ).toThrow("후보 ID는 서로 달라야 합니다.");
  });
});
