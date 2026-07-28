import { describe, expect, it } from "vitest";
import { validateDrawCount } from "./drawCount";

describe("validateDrawCount", () => {
  it("전체 추첨은 입력된 공 개수를 목표로 사용한다", () => {
    expect(validateDrawCount("all", "", 45)).toEqual({
      value: 45,
      errors: [],
    });
  });

  it("일부 추첨은 1부터 전체 공 개수까지의 정수만 허용한다", () => {
    expect(validateDrawCount("custom", "6", 45)).toEqual({
      value: 6,
      errors: [],
    });
    expect(validateDrawCount("custom", "0", 45).errors[0]).toContain(
      "1개 이상",
    );
    expect(validateDrawCount("custom", "46", 45).errors[0]).toContain(
      "45개",
    );
    expect(validateDrawCount("custom", "1.5", 45).errors[0]).toContain(
      "정수",
    );
    expect(validateDrawCount("custom", "", 45).errors[0]).toContain(
      "입력",
    );
  });
});
