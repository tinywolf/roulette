import { describe, expect, it, vi } from "vitest";
import {
  EXPERIENCE_STORAGE_KEY,
  loadSelectedExperience,
  saveSelectedExperience,
} from "./experienceStorage";

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
  };
}

describe("experienceStorage", () => {
  it("버전이 포함된 마지막 선택값을 저장하고 복원한다", () => {
    const storage = memoryStorage();

    expect(saveSelectedExperience("wheel", storage).warning).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(
      EXPERIENCE_STORAGE_KEY,
      JSON.stringify({ version: 1, type: "wheel" }),
    );
    expect(loadSelectedExperience(storage)).toEqual({
      value: "wheel",
      warning: null,
    });
  });

  it("저장값이 없으면 선택하지 않은 상태를 반환한다", () => {
    expect(loadSelectedExperience(memoryStorage())).toEqual({
      value: null,
      warning: null,
    });
  });

  it.each([
    "{bad json",
    JSON.stringify({ version: 2, type: "wheel" }),
    JSON.stringify({ version: 1, type: "unknown" }),
  ])("손상된 저장값을 경고와 선택하지 않은 상태로 복구한다", (value) => {
    expect(loadSelectedExperience(memoryStorage(value))).toEqual({
      value: null,
      warning: "마지막 추첨기 선택을 불러오지 못했습니다.",
    });
  });

  it("저장소 접근 실패를 경고로 변환한다", () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("거부");
      }),
      setItem: vi.fn(() => {
        throw new Error("거부");
      }),
    };

    expect(loadSelectedExperience(storage)).toEqual({
      value: null,
      warning: "마지막 추첨기 선택을 불러오지 못했습니다.",
    });
    expect(saveSelectedExperience("lottery", storage).warning).toBe(
      "마지막 추첨기 선택을 저장하지 못했습니다.",
    );
  });
});
