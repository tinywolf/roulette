import type { DrawCountMode } from "./types";

export type DrawCountValidation = {
  value: number;
  errors: string[];
};

export function validateDrawCount(
  mode: DrawCountMode,
  customValue: string,
  availableCount: number,
): DrawCountValidation {
  if (mode === "all") {
    return {
      value: availableCount,
      errors: [],
    };
  }

  const normalizedValue = customValue.trim();

  if (normalizedValue.length === 0) {
    return {
      value: 0,
      errors: ["추첨할 공 개수를 입력해 주세요."],
    };
  }

  if (!/^\d+$/.test(normalizedValue)) {
    return {
      value: 0,
      errors: ["추첨 개수는 정수로 입력해 주세요."],
    };
  }

  const value = Number(normalizedValue);

  if (value < 1) {
    return {
      value,
      errors: ["추첨 개수는 1개 이상이어야 합니다."],
    };
  }

  if (value > availableCount) {
    return {
      value,
      errors: [
        `추첨 개수는 입력한 공 개수(${availableCount}개)를 넘을 수 없습니다.`,
      ],
    };
  }

  return {
    value,
    errors: [],
  };
}
