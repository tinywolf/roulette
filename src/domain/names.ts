import type { ParseNamesResult } from "./types";

export const MIN_BALLS = 2;
export const MAX_BALLS = 45;
export const MAX_NAME_LENGTH = 20;

const NUMERIC_RANGE_PATTERN = /^(\d+)[ \t]*~[ \t]*(\d+)$/;
const REPEAT_PATTERN = /^(.*?)[ \t]*\*[ \t]*(\d+)$/;
const RANGE_FORMAT_ERROR =
  "숫자 범위는 1~45처럼 숫자 두 개만 ~로 연결해 입력해 주세요.";
const REPEAT_FORMAT_ERROR =
  "반복 입력은 민지*2처럼 값 뒤에 *와 1~45 사이 정수를 입력해 주세요.";

function parseNumericRange(raw: string): ParseNamesResult | null {
  if (!raw.includes("~")) {
    return null;
  }

  const match = NUMERIC_RANGE_PATTERN.exec(raw.trim());

  if (!match) {
    return {
      names: [],
      errors: [RANGE_FORMAT_ERROR],
    };
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    return {
      names: [],
      errors: ["숫자 범위에는 안전하게 처리할 수 있는 정수를 입력해 주세요."],
    };
  }

  if (start > end) {
    return {
      names: [],
      errors: ["숫자 범위의 시작 숫자는 끝 숫자보다 클 수 없습니다."],
    };
  }

  const rangeLength = end - start + 1;

  if (rangeLength < MIN_BALLS) {
    return {
      names: [],
      errors: [`숫자 범위에는 ${MIN_BALLS}개 이상의 숫자가 필요합니다.`],
    };
  }

  if (rangeLength > MAX_BALLS) {
    return {
      names: [],
      errors: [`숫자 범위는 최대 ${MAX_BALLS}개까지 입력할 수 있습니다.`],
    };
  }

  return {
    names: Array.from({ length: rangeLength }, (_, index) =>
      String(start + index),
    ),
    errors: [],
  };
}

function expandRepeatedEntry(entry: string): {
  names: string[];
  error: string | null;
} {
  if (!entry.includes("*")) {
    return { names: [entry], error: null };
  }

  const match = REPEAT_PATTERN.exec(entry);
  const name = match?.[1].trim() ?? "";
  const repeatCount = match ? Number(match[2]) : Number.NaN;

  if (
    !match ||
    !name ||
    name.includes("*") ||
    !Number.isSafeInteger(repeatCount) ||
    repeatCount < 1 ||
    repeatCount > MAX_BALLS
  ) {
    return {
      names: [],
      error: REPEAT_FORMAT_ERROR,
    };
  }

  return {
    names: Array.from({ length: repeatCount }, () => name),
    error: null,
  };
}

export function parseNames(raw: string): ParseNamesResult {
  const numericRange = parseNumericRange(raw);

  if (numericRange) {
    return numericRange;
  }

  const entries = raw
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const names = entries.flatMap((entry) => {
    const expanded = expandRepeatedEntry(entry);

    if (expanded.error && !errors.includes(expanded.error)) {
      errors.push(expanded.error);
    }

    return expanded.names;
  });

  if (names.length < MIN_BALLS) {
    errors.push(`이름을 ${MIN_BALLS}개 이상 입력해 주세요.`);
  }

  if (names.length > MAX_BALLS) {
    errors.push(`이름은 최대 ${MAX_BALLS}개까지 입력할 수 있습니다.`);
  }

  const overlongNames = names.filter((name) => name.length > MAX_NAME_LENGTH);

  if (overlongNames.length > 0) {
    errors.push(`이름은 각각 ${MAX_NAME_LENGTH}자 이하로 입력해 주세요.`);
  }

  return { names, errors };
}
