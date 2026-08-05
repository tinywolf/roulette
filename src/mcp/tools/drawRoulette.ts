import type { CallToolResult } from "@modelcontextprotocol/server";
import { z } from "zod";
import { drawCandidates } from "../../core/draw.js";
import { parseNames } from "../../core/input.js";
import {
  SecureRandomError,
  type RandomValuesSource,
} from "../../core/random.js";
import type { Candidate, DrawSelection } from "../../core/types.js";
import { createToolError } from "../errors.js";
import { formatDrawResult } from "../presentation/textResult.js";

export const DRAW_ROULETTE_TOOL_NAME = "draw_roulette";

/** 에이전트가 모든 옵션을 수집한 뒤 한 번에 전달하는 엄격한 입력 계약이다. */
export const drawRouletteInputSchema = z
  .object({
    rawInput: z
      .string()
      .describe(
        "대화에서 확인된 후보 목록 원문을 그대로 전달합니다. 콤마·줄바꿈·이름*반복·숫자 범위(예: 1~45)를 지원하며 후보를 추측하거나 추가하지 않습니다.",
      ),
    drawCount: z
      .union([z.literal("all"), z.number()])
      .describe(
        "대화에서 확인된 추첨 개수입니다. 전체 후보의 무작위 순서는 all, 일부 추첨은 양의 정수를 사용하며 값을 추측하지 않습니다.",
      ),
  })
  .strict();

export const drawRouletteOutputSchema = z
  .object({
    candidateCount: z.number().int().min(2).max(45),
    drawCount: z.number().int().min(1).max(45),
    remainingCount: z.number().int().min(0).max(44),
    results: z.array(
      z
        .object({
          order: z.number().int().min(1).max(45),
          id: z.string(),
          name: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export type DrawRouletteInput = z.infer<typeof drawRouletteInputSchema>;
export type DrawRouletteOutput = z.infer<typeof drawRouletteOutputSchema>;

type DrawRouletteDependencies = {
  randomValues?: RandomValuesSource;
  draw?: typeof drawCandidates;
};

function createCandidates(names: string[]): Candidate[] {
  return names.map((name, index) => ({
    id: `candidate-${index + 1}`,
    name,
  }));
}

function resolveDrawCount(
  drawCount: DrawRouletteInput["drawCount"],
  candidateCount: number,
): number | null {
  if (drawCount === "all") {
    return candidateCount;
  }

  if (
    !Number.isInteger(drawCount) ||
    drawCount < 1 ||
    drawCount > candidateCount
  ) {
    return null;
  }

  return drawCount;
}

function createSuccessResult(selection: DrawSelection): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: formatDrawResult(selection),
      },
    ],
    structuredContent: selection,
  };
}

/** 입력 검증부터 결과 확정까지 한 호출에서 수행하며 어떤 상태도 보존하지 않는다. */
export function executeDrawRoulette(
  input: DrawRouletteInput,
  dependencies: DrawRouletteDependencies = {},
): CallToolResult {
  const parsed = parseNames(input.rawInput);

  if (parsed.errors.length > 0) {
    return createToolError("INVALID_INPUT", parsed.errors.join(" "));
  }

  const drawCount = resolveDrawCount(input.drawCount, parsed.names.length);

  if (drawCount === null) {
    return createToolError(
      "INVALID_DRAW_COUNT",
      `1부터 ${parsed.names.length} 사이의 정수 또는 all을 사용해 주세요.`,
    );
  }

  try {
    const draw = dependencies.draw ?? drawCandidates;
    const selection = draw(
      createCandidates(parsed.names),
      drawCount,
      dependencies.randomValues,
    );

    return createSuccessResult(selection);
  } catch (error) {
    if (error instanceof SecureRandomError) {
      return createToolError("RANDOM_UNAVAILABLE");
    }

    return createToolError("INTERNAL_ERROR");
  }
}
