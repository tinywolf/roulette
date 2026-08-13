import { describe, expect, it } from "vitest";
import {
  MAX_CANDIDATES,
  MAX_CANDIDATE_NAME_LENGTH,
  MIN_CANDIDATES,
  parseNames,
} from "./input";

describe("core parseNames", () => {
  it("콤마·줄바꿈·빈 항목과 중복 이름을 입력 순서대로 처리한다", () => {
    const result = parseNames(" 민지, 민지\n\n준호, ");

    expect(result).toEqual({ names: ["민지", "민지", "준호"], errors: [] });
  });

  it("반복식과 숫자 범위를 함께 확장한다", () => {
    const result = parseNames(" 01 ~ 03 , 민지 * 2\n7");

    expect(result).toEqual({
      names: ["1", "2", "3", "민지", "민지", "7"],
      errors: [],
    });
  });

  it.each([
    "민지*0,준호",
    "민지*46,준호",
    "민지*1.5,준호",
    "민지*둘,준호",
    "*2,준호",
    "민지**2,준호",
  ])("잘못된 반복식 %s을 거부한다", (rawInput) => {
    expect(parseNames(rawInput).errors).toContain(
      "반복 입력은 민지*2처럼 값 뒤에 *와 1~45 사이 정수를 입력해 주세요.",
    );
  });

  it.each(["민지~준호", "1~3~5", "1~3*2", "3~1"])(
    "잘못된 숫자 범위 %s을 거부한다",
    (rawInput) => {
      expect(parseNames(`${rawInput},준호`).errors.length).toBeGreaterThan(0);
    },
  );

  it("확장 후 후보 수와 이름 길이 경계를 검증한다", () => {
    expect(parseNames("한명").errors).toContain(
      `이름을 ${MIN_CANDIDATES}개 이상 입력해 주세요.`,
    );
    expect(parseNames("민지*45,준호").errors).toContain(
      `이름은 최대 ${MAX_CANDIDATES}개까지 입력할 수 있습니다.`,
    );
    expect(
      parseNames(`${"가".repeat(MAX_CANDIDATE_NAME_LENGTH + 1)},준호`).errors,
    ).toContain(
      `이름은 각각 ${MAX_CANDIDATE_NAME_LENGTH}자 이하로 입력해 주세요.`,
    );
    expect(parseNames("1~1,민지")).toEqual({
      names: ["1", "민지"],
      errors: [],
    });
    expect(parseNames("1~40,민지*6").errors).toContain(
      `이름은 최대 ${MAX_CANDIDATES}개까지 입력할 수 있습니다.`,
    );
  });

  it("최대 45개 후보를 허용한다", () => {
    const result = parseNames("1~45");

    expect(result.errors).toEqual([]);
    expect(result.names).toHaveLength(MAX_CANDIDATES);
  });
});
