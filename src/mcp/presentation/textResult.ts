import type { DrawSelection } from "../../core/types.js";

/** 확정된 추첨 데이터만 받아 범용 MCP 클라이언트용 일반 텍스트를 만든다. */
export function formatDrawResult(selection: DrawSelection): string {
  const resultLines = selection.results.map(
    (result) => `${result.order}. ${result.name}`,
  );

  return [
    "추첨 결과",
    ...resultLines,
    "",
    `전체 후보 ${selection.candidateCount}개 · 추첨 ${selection.drawCount}개 · 미추첨 ${selection.remainingCount}개`,
  ].join("\n");
}
