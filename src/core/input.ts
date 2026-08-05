import type { ParseNamesResult } from "./types.js";

/** 후보 문자열을 웹과 MCP가 공유하는 입력 문법에 따라 확장하고 검증한다. */
export const MIN_CANDIDATES = 2;
export const MAX_CANDIDATES = 45;
export const MAX_CANDIDATE_NAME_LENGTH = 20;

const NUMERIC_RANGE_PATTERN = /^(\d+)[ \t]*~[ \t]*(\d+)$/;
const REPEAT_PATTERN = /^(.*?)[ \t]*\*[ \t]*(\d+)$/;
const RANGE_FORMAT_ERROR =
  "숫자 범위는 1~45처럼 숫자 두 개만 ~로 연결해 입력해 주세요.";
const REPEAT_FORMAT_ERROR =
  "반복 입력은 민지*2처럼 값 뒤에 *와 1~45 사이 정수를 입력해 주세요.";
const RANGE_REPEAT_ERROR =
  "숫자 범위에는 * 반복을 사용할 수 없습니다. 범위와 반복 항목을 콤마나 줄바꿈으로 구분해 주세요.";

type ExpandedEntry = {
  names: string[];
  error: string | null;
};

function parseNumericRangeEntry(entry: string): ExpandedEntry | null {
  if (!entry.includes("~")) {
    return null;
  }

  const match = NUMERIC_RANGE_PATTERN.exec(entry);

  if (!match) {
    return {
      names: [],
      error: RANGE_FORMAT_ERROR,
    };
  }

  const start = Number(match[1]);
  const end = Number(match[2]);

  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
    return {
      names: [],
      error: "숫자 범위에는 안전하게 처리할 수 있는 정수를 입력해 주세요.",
    };
  }

  if (start > end) {
    return {
      names: [],
      error: "숫자 범위의 시작 숫자는 끝 숫자보다 클 수 없습니다.",
    };
  }

  const rangeLength = end - start + 1;

  if (rangeLength > MAX_CANDIDATES) {
    return {
      names: [],
      error: `숫자 범위는 최대 ${MAX_CANDIDATES}개까지 입력할 수 있습니다.`,
    };
  }

  return {
    names: Array.from({ length: rangeLength }, (_, index) =>
      String(start + index),
    ),
    error: null,
  };
}

function expandEntry(entry: string): ExpandedEntry {
  let value = entry;
  let repeatCount = 1;
  let hasRepeat = false;

  if (entry.includes("*")) {
    hasRepeat = true;
    const match = REPEAT_PATTERN.exec(entry);
    value = match?.[1].trim() ?? "";
    repeatCount = match ? Number(match[2]) : Number.NaN;

    if (
      !match ||
      !value ||
      value.includes("*") ||
      !Number.isSafeInteger(repeatCount) ||
      repeatCount < 1 ||
      repeatCount > MAX_CANDIDATES
    ) {
      return {
        names: [],
        error: REPEAT_FORMAT_ERROR,
      };
    }
  }

  const numericRange = parseNumericRangeEntry(value);
  const baseNames = numericRange?.names ?? [value];

  if (numericRange?.error) {
    return numericRange;
  }

  if (numericRange && hasRepeat) {
    return {
      names: [],
      error: RANGE_REPEAT_ERROR,
    };
  }

  return {
    names: Array.from({ length: repeatCount }, () => baseNames).flat(),
    error: null,
  };
}

export function parseNames(raw: string): ParseNamesResult {
  const entries = raw
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean);

  const errors: string[] = [];
  const names = entries.flatMap((entry) => {
    const expanded = expandEntry(entry);

    if (expanded.error && !errors.includes(expanded.error)) {
      errors.push(expanded.error);
    }

    return expanded.names;
  });

  if (names.length < MIN_CANDIDATES) {
    errors.push(`이름을 ${MIN_CANDIDATES}개 이상 입력해 주세요.`);
  }

  if (names.length > MAX_CANDIDATES) {
    errors.push(`이름은 최대 ${MAX_CANDIDATES}개까지 입력할 수 있습니다.`);
  }

  const overlongNames = names.filter(
    (name) => name.length > MAX_CANDIDATE_NAME_LENGTH,
  );

  if (overlongNames.length > 0) {
    errors.push(
      `이름은 각각 ${MAX_CANDIDATE_NAME_LENGTH}자 이하로 입력해 주세요.`,
    );
  }

  return { names, errors };
}
