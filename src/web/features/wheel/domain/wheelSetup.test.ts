import { describe, expect, it } from "vitest";
import { parseWheelInput } from "./wheelSetup";

describe("parseWheelInput", () => {
  it("공통 범위·반복 문법과 중복 이름을 순서대로 변환한다", () => {
    expect(parseWheelInput("1~2, 민지*2")).toEqual({
      names: ["1", "2", "민지", "민지"],
      candidates: [
        { id: "wheel-candidate-1", name: "1" },
        { id: "wheel-candidate-2", name: "2" },
        { id: "wheel-candidate-3", name: "민지" },
        { id: "wheel-candidate-4", name: "민지" },
      ],
      errors: [],
    });
  });

  it("2개와 45개 후보 경계를 허용한다", () => {
    expect(parseWheelInput("민지,준호").errors).toEqual([]);
    expect(parseWheelInput("1~45").candidates).toHaveLength(45);
  });

  it("46개 후보는 세션 후보를 만들지 않고 오류를 반환한다", () => {
    const parsed = parseWheelInput("1~40, 민지*6");

    expect(parsed.candidates).toEqual([]);
    expect(parsed.errors).toContain("이름은 최대 45개까지 입력할 수 있습니다.");
  });

  it("20자 이름은 허용하고 21자 이름은 차단한다", () => {
    expect(parseWheelInput(`${"가".repeat(20)},준호`).errors).toEqual([]);

    const parsed = parseWheelInput(`${"가".repeat(21)},준호`);
    expect(parsed.candidates).toEqual([]);
    expect(parsed.errors).toContain("이름은 각각 20자 이하로 입력해 주세요.");
  });
});
