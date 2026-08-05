import { createDrawOrder, type RandomValuesSource } from "./random.js";
import type { Candidate, DrawSelection } from "./types.js";

/** 완성된 후보와 추첨 수를 받아 상태를 남기지 않고 즉시 추첨한다. */
export function drawCandidates(
  candidates: Candidate[],
  drawCount: number,
  randomValues?: RandomValuesSource,
): DrawSelection {
  if (
    !Number.isInteger(drawCount) ||
    drawCount < 1 ||
    drawCount > candidates.length
  ) {
    throw new RangeError(
      "추첨 개수는 전체 후보 개수 이내의 양의 정수여야 합니다.",
    );
  }

  const candidatesById = new Map(
    candidates.map((candidate) => [candidate.id, candidate]),
  );

  if (candidatesById.size !== candidates.length) {
    throw new RangeError("후보 ID는 서로 달라야 합니다.");
  }

  const results = createDrawOrder(candidates, randomValues)
    .slice(0, drawCount)
    .map((id, index) => {
      const candidate = candidatesById.get(id);

      if (!candidate) {
        throw new Error("추첨 순서에서 후보를 찾을 수 없습니다.");
      }

      return {
        order: index + 1,
        id: candidate.id,
        name: candidate.name,
      };
    });

  return {
    candidateCount: candidates.length,
    drawCount,
    remainingCount: candidates.length - drawCount,
    results,
  };
}
