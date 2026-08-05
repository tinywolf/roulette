import { describe, expect, it } from "vitest";
import { formatDrawResult } from "./textResult";

describe("formatDrawResult", () => {
  it("확정된 결과 순서와 전체·미추첨 수를 표시한다", () => {
    expect(
      formatDrawResult({
        candidateCount: 3,
        drawCount: 2,
        remainingCount: 1,
        results: [
          { order: 1, id: "candidate-2", name: "민지" },
          { order: 2, id: "candidate-1", name: "준호" },
        ],
      }),
    ).toBe(
      "추첨 결과\n1. 민지\n2. 준호\n\n전체 후보 3개 · 추첨 2개 · 미추첨 1개",
    );
  });
});
