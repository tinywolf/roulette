import { describe, expect, it, vi } from "vitest";
import {
  clearRawInput,
  loadRawInput,
  NAME_STORAGE_KEY,
  saveRawInput,
} from "./nameStorage";

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
    removeItem: vi.fn(() => {
      value = null;
    }),
  };
}

describe("NameStorage", () => {
  it("버전이 포함된 입력 원문만 저장하고 복원한다", () => {
    const storage = memoryStorage();

    expect(saveRawInput("민지, 준호", storage).warning).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(
      NAME_STORAGE_KEY,
      JSON.stringify({ version: 1, rawInput: "민지, 준호" }),
    );
    expect(loadRawInput(storage)).toEqual({
      value: "민지, 준호",
      warning: null,
    });
  });

  it("손상 데이터와 접근 실패를 경고로 변환한다", () => {
    expect(loadRawInput(memoryStorage("{bad json"))).toEqual({
      value: "",
      warning: "저장된 이름 목록을 불러오지 못했습니다.",
    });

    const failingStorage = {
      getItem: vi.fn(() => {
        throw new Error("거부");
      }),
      setItem: vi.fn(() => {
        throw new Error("거부");
      }),
      removeItem: vi.fn(() => {
        throw new Error("거부");
      }),
    };

    expect(saveRawInput("민지", failingStorage).warning).toBe(
      "목록을 저장하지 못했습니다.",
    );
    expect(clearRawInput(failingStorage).warning).toBe(
      "목록을 저장하지 못했습니다.",
    );
  });

  it("저장된 이름 목록을 삭제한다", () => {
    const storage = memoryStorage(
      JSON.stringify({ version: 1, rawInput: "민지, 준호" }),
    );

    expect(clearRawInput(storage).warning).toBeNull();
    expect(loadRawInput(storage).value).toBe("");
  });
});
