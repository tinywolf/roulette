import { describe, expect, it } from "vitest";
import { getRevealDelay, parseRouletteResult } from "./model";

const validResult = {
  candidateCount: 3,
  drawCount: 2,
  remainingCount: 1,
  results: [
    { order: 1, id: "candidate-2", name: "민지" },
    { order: 2, id: "candidate-1", name: "준호" },
  ],
};

describe("MCP App 룰렛 결과 모델", () => {
  it("서버의 유효한 구조화 결과를 받아들인다", () => {
    expect(parseRouletteResult(validResult)).toEqual(validResult);
  });

  it.each([
    null,
    { ...validResult, remainingCount: 2 },
    { ...validResult, results: validResult.results.slice(0, 1) },
    {
      ...validResult,
      results: [validResult.results[0], validResult.results[0]],
    },
    {
      ...validResult,
      results: [{ order: 2, id: "candidate-2", name: "민지" }],
    },
    {
      ...validResult,
      results: [{ order: 1, id: "candidate-2", name: "가".repeat(21) }],
    },
  ])("일관되지 않거나 안전하지 않은 결과를 거부한다", (value) => {
    expect(parseRouletteResult(value)).toBeNull();
  });

  it("결과가 많을수록 공개 간격을 줄이고 상·하한을 지킨다", () => {
    expect(getRevealDelay(1)).toBe(420);
    expect(getRevealDelay(10)).toBe(420);
    expect(getRevealDelay(45)).toBe(93);
    expect(getRevealDelay(100)).toBe(90);
  });
});
