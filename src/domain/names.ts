import type { ParseNamesResult } from "./types";

export const MIN_BALLS = 2;
export const MAX_BALLS = 45;
export const MAX_NAME_LENGTH = 20;

export function parseNames(raw: string): ParseNamesResult {
  const names = raw
    .split(/[\n,]/)
    .map((name) => name.trim())
    .filter(Boolean);

  const errors: string[] = [];

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
