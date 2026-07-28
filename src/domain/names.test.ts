import { describe, expect, it } from "vitest";
import { parseNames } from "./names";
import { createBalls } from "./types";

describe("parseNames", () => {
  it("줄바꿈과 콤마를 함께 처리하고 빈 항목을 무시한다", () => {
    expect(parseNames(" 민지, 준호\n\n서연, ").names).toEqual([
      "민지",
      "준호",
      "서연",
    ]);
  });

  it("중복 이름을 허용한다", () => {
    const result = parseNames("민지, 민지");

    expect(result.errors).toEqual([]);
    expect(result.names).toEqual(["민지", "민지"]);
  });

  it("개수와 길이 제한을 검증한다", () => {
    expect(parseNames("민지").errors).toContain("이름을 2개 이상 입력해 주세요.");
    expect(
      parseNames(
        Array.from({ length: 46 }, (_, index) => `이름${index}`).join(","),
      ).errors,
    ).toContain("이름은 최대 45개까지 입력할 수 있습니다.");
    expect(parseNames(`${"가".repeat(21)},준호`).errors).toContain(
      "이름은 각각 20자 이하로 입력해 주세요.",
    );
  });

  it("이름 45개까지 허용한다", () => {
    const rawInput = Array.from(
      { length: 45 },
      (_, index) => `이름${index + 1}`,
    ).join(",");

    expect(parseNames(rawInput).errors).toEqual([]);
    expect(parseNames(rawInput).names).toHaveLength(45);
  });

  it("숫자 범위를 오름차순 이름 목록으로 확장한다", () => {
    const result = parseNames("1~45");

    expect(result.errors).toEqual([]);
    expect(result.names).toHaveLength(45);
    expect(result.names[0]).toBe("1");
    expect(result.names[44]).toBe("45");
  });

  it("숫자 범위의 공백과 선행 0을 정규화한다", () => {
    expect(parseNames("  01 ~ 03  ").names).toEqual(["1", "2", "3"]);
  });

  it("숫자 범위를 일반 이름이나 다른 구분자와 섞지 못하게 한다", () => {
    expect(parseNames("1~3,민지").errors).toContain(
      "숫자 범위는 1~45처럼 숫자 두 개만 ~로 연결해 입력해 주세요.",
    );
    expect(parseNames("민지~준호").errors).toContain(
      "숫자 범위는 1~45처럼 숫자 두 개만 ~로 연결해 입력해 주세요.",
    );
  });

  it("역순과 생성 개수 경계를 검증한다", () => {
    expect(parseNames("3~1").errors[0]).toContain(
      "시작 숫자는 끝 숫자보다 클 수 없습니다.",
    );
    expect(parseNames("1~1").errors[0]).toContain("2개 이상");
    expect(parseNames("1~46").errors[0]).toContain("최대 45개");
  });
});

describe("createBalls", () => {
  it("중복 이름에도 서로 다른 ID를 부여한다", () => {
    const balls = createBalls(["민지", "민지"]);

    expect(balls[0].name).toBe(balls[1].name);
    expect(balls[0].id).not.toBe(balls[1].id);
  });
});
