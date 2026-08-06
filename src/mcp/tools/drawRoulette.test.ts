import { describe, expect, it } from "vitest";
import type { RandomValuesSource } from "../../core/random";
import {
  ROULETTE_RESULT_META_KEY,
  drawRouletteInputSchema,
  executeDrawRoulette,
} from "./drawRoulette";

const zeroSource: RandomValuesSource = (target) => {
  target[0] = 0;
};

function errorText(result: ReturnType<typeof executeDrawRoulette>): string {
  const firstContent = result.content[0];

  if (firstContent?.type !== "text") {
    throw new Error("텍스트 결과가 없습니다.");
  }

  return firstContent.text;
}

describe("drawRouletteInputSchema", () => {
  it("두 입력을 요구하고 추가 속성을 거부한다", () => {
    expect(drawRouletteInputSchema.safeParse({ rawInput: "가,나" }).success).toBe(
      false,
    );
    expect(drawRouletteInputSchema.safeParse({ drawCount: "all" }).success).toBe(
      false,
    );
    expect(
      drawRouletteInputSchema.safeParse({
        rawInput: "가,나",
        drawCount: "all",
        unexpected: true,
      }).success,
    ).toBe(false);
  });
});

describe("executeDrawRoulette", () => {
  it("MCP Apps 비지원 호스트용 텍스트와 구조화 결과를 반환한다", () => {
    const result = executeDrawRoulette(
      { rawInput: "민지,민지,준호", drawCount: "all" },
      { randomValues: zeroSource },
    );

    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([
      {
        type: "text",
        text: [
          "추첨 결과",
          "1. 민지",
          "2. 준호",
          "3. 민지",
          "",
          "전체 후보 3개 · 추첨 3개 · 미추첨 0개",
        ].join("\n"),
      },
    ]);
    expect(result.structuredContent).toEqual({
      candidateCount: 3,
      drawCount: 3,
      remainingCount: 0,
      results: [
        { order: 1, id: "candidate-2", name: "민지" },
        { order: 2, id: "candidate-3", name: "준호" },
        { order: 3, id: "candidate-1", name: "민지" },
      ],
    });
  });

  it("MCP Apps 호스트에는 결과를 컴포넌트 전용 _meta로만 반환한다", () => {
    const result = executeDrawRoulette(
      { rawInput: "가,나,다", drawCount: 1 },
      { randomValues: zeroSource },
      "mcp-app",
    );

    expect(result.isError).not.toBe(true);
    expect(result.content).toEqual([]);
    expect(result.structuredContent).toBeUndefined();
    expect(result._meta?.[ROULETTE_RESULT_META_KEY]).toEqual({
      candidateCount: 3,
      drawCount: 1,
      remainingCount: 2,
      results: [{ order: 1, id: "candidate-2", name: "나" }],
    });
  });

  it("일부 추첨에서 미추첨 이름을 노출하지 않는다", () => {
    const result = executeDrawRoulette(
      { rawInput: "가,나,비공개후보", drawCount: 1 },
      { randomValues: zeroSource },
    );

    expect(result.structuredContent).toMatchObject({
      candidateCount: 3,
      drawCount: 1,
      remainingCount: 2,
    });
    expect(JSON.stringify(result.structuredContent)).not.toContain(
      "비공개후보",
    );
  });

  it("후보 입력과 추첨 인원 오류를 안정적인 코드로 반환한다", () => {
    const invalidInput = executeDrawRoulette({
      rawInput: "한명",
      drawCount: "all",
    });
    const invalidDrawCount = executeDrawRoulette({
      rawInput: "가,나",
      drawCount: 3,
    });

    expect(invalidInput.isError).toBe(true);
    expect(errorText(invalidInput)).toContain("INVALID_INPUT");
    expect(invalidDrawCount.isError).toBe(true);
    expect(errorText(invalidDrawCount)).toContain("INVALID_DRAW_COUNT");
  });

  it("난수 실패와 예상하지 못한 오류의 세부 정보를 숨긴다", () => {
    const randomFailure = executeDrawRoulette(
      { rawInput: "민감후보,다른후보", drawCount: 1 },
      {
        randomValues: () => {
          throw new Error("민감후보 stack detail");
        },
      },
    );
    const internalFailure = executeDrawRoulette(
      { rawInput: "민감후보,다른후보", drawCount: 1 },
      {
        draw: () => {
          throw new Error("민감후보 stack detail");
        },
      },
    );

    expect(errorText(randomFailure)).toContain("RANDOM_UNAVAILABLE");
    expect(errorText(internalFailure)).toContain("INTERNAL_ERROR");
    expect(errorText(randomFailure)).not.toContain("민감후보");
    expect(errorText(internalFailure)).not.toContain("stack detail");
  });
});
