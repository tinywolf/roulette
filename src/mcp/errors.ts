import type { CallToolResult } from "@modelcontextprotocol/server";

/** 외부에 노출해도 안전한 룰렛 도구 오류 코드와 메시지만 관리한다. */
export type RouletteErrorCode =
  | "INVALID_INPUT"
  | "INVALID_DRAW_COUNT"
  | "RANDOM_UNAVAILABLE"
  | "INTERNAL_ERROR";

const ERROR_MESSAGES: Record<RouletteErrorCode, string> = {
  INVALID_INPUT: "후보 입력을 확인해 주세요.",
  INVALID_DRAW_COUNT: "추첨 인원을 확인해 주세요.",
  RANDOM_UNAVAILABLE:
    "안전한 난수를 생성하지 못해 추첨을 중단했습니다. 다시 시도해 주세요.",
  INTERNAL_ERROR: "추첨을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.",
};

export function createToolError(
  code: RouletteErrorCode,
  detail?: string,
): CallToolResult {
  const message = detail ? `${ERROR_MESSAGES[code]} ${detail}` : ERROR_MESSAGES[code];

  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `오류 [${code}]\n${message}`,
      },
    ],
  };
}
