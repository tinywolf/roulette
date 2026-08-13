import type { DrawSelection } from "../../core/types.js";

/** MCP Apps를 지원하지 않는 호스트가 그대로 표시할 수 있는 추첨 결과를 만든다. */
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
