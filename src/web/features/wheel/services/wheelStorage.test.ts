import { describe, expect, it, vi } from "vitest";
import {
  clearWheelRawInput,
  DEFAULT_WHEEL_OPTIONS,
  loadWheelOptions,
  loadWheelRawInput,
  saveWheelOptions,
  saveWheelRawInput,
  WHEEL_CANDIDATES_STORAGE_KEY,
  WHEEL_OPTIONS_STORAGE_KEY,
} from "./wheelStorage";

function memoryStorage(initialValues: Record<string, string> = {}) {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem: vi.fn((key: string) => values.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    removeItem: vi.fn((key: string) => values.delete(key)),
  };
}

describe("wheelStorage", () => {
  it("후보 원문과 효과음 설정을 서로 다른 v1 키에 저장하고 복원한다", () => {
    const storage = memoryStorage();

    expect(saveWheelRawInput("민지,준호", storage).warning).toBeNull();
    expect(saveWheelOptions({ soundEnabled: true }, storage).warning).toBeNull();
    expect(loadWheelRawInput(storage)).toEqual({
      value: "민지,준호",
      warning: null,
    });
    expect(loadWheelOptions(storage)).toEqual({
      value: { soundEnabled: true },
      warning: null,
    });
    expect(storage.setItem).toHaveBeenCalledWith(
      WHEEL_CANDIDATES_STORAGE_KEY,
      JSON.stringify({ version: 1, rawInput: "민지,준호" }),
    );
    expect(storage.setItem).toHaveBeenCalledWith(
      WHEEL_OPTIONS_STORAGE_KEY,
      JSON.stringify({ version: 1, soundEnabled: true }),
    );
  });

  it("저장값이 없으면 빈 후보와 기본 음소거를 반환한다", () => {
    const storage = memoryStorage();

    expect(loadWheelRawInput(storage)).toEqual({ value: "", warning: null });
    expect(loadWheelOptions(storage)).toEqual({
      value: DEFAULT_WHEEL_OPTIONS,
      warning: null,
    });
  });

  it("입력 비우기는 돌림판 후보 키만 삭제한다", () => {
    const storage = memoryStorage({
      [WHEEL_CANDIDATES_STORAGE_KEY]: "후보",
      [WHEEL_OPTIONS_STORAGE_KEY]: "옵션",
      "lottery-draw:names:v1": "로또",
    });

    expect(clearWheelRawInput(storage).warning).toBeNull();
    expect(storage.removeItem).toHaveBeenCalledOnce();
    expect(storage.removeItem).toHaveBeenCalledWith(
      WHEEL_CANDIDATES_STORAGE_KEY,
    );
    expect(storage.getItem("lottery-draw:names:v1")).toBe("로또");
  });

  it("손상된 후보와 옵션을 각각 기본값과 경고로 복구한다", () => {
    const storage = memoryStorage({
      [WHEEL_CANDIDATES_STORAGE_KEY]: JSON.stringify({
        version: 2,
        rawInput: "민지,준호",
      }),
      [WHEEL_OPTIONS_STORAGE_KEY]: "{bad json",
    });

    expect(loadWheelRawInput(storage)).toEqual({
      value: "",
      warning: "저장된 돌림판 후보를 불러오지 못했습니다.",
    });
    expect(loadWheelOptions(storage)).toEqual({
      value: DEFAULT_WHEEL_OPTIONS,
      warning: "저장된 돌림판 설정을 불러오지 못했습니다.",
    });
  });

  it("저장소 접근 실패를 현재 값과 분리된 경고로 반환한다", () => {
    const storage = {
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

    expect(loadWheelRawInput(storage).warning).toBe(
      "저장된 돌림판 후보를 불러오지 못했습니다.",
    );
    expect(loadWheelOptions(storage).warning).toBe(
      "저장된 돌림판 설정을 불러오지 못했습니다.",
    );
    expect(saveWheelRawInput("민지,준호", storage).warning).toBe(
      "돌림판 후보를 저장하지 못했습니다.",
    );
    expect(saveWheelOptions({ soundEnabled: true }, storage).warning).toBe(
      "돌림판 설정을 저장하지 못했습니다.",
    );
    expect(clearWheelRawInput(storage).warning).toBe(
      "돌림판 후보를 저장하지 못했습니다.",
    );
  });
});
