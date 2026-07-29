import { describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SETUP_OPTIONS,
  loadSetupOptions,
  saveSetupOptions,
  SETUP_OPTIONS_STORAGE_KEY,
} from "./setupOptionsStorage";

function memoryStorage(initialValue: string | null = null) {
  let value = initialValue;

  return {
    getItem: vi.fn(() => value),
    setItem: vi.fn((_key: string, nextValue: string) => {
      value = nextValue;
    }),
  };
}

describe("SetupOptionsStorage", () => {
  it("버전이 포함된 설정 옵션을 저장하고 복원한다", () => {
    const storage = memoryStorage();
    const options = {
      mode: "auto" as const,
      drawCountMode: "custom" as const,
      customDrawCount: "6",
      soundEnabled: true,
    };

    expect(saveSetupOptions(options, storage).warning).toBeNull();
    expect(storage.setItem).toHaveBeenCalledWith(
      SETUP_OPTIONS_STORAGE_KEY,
      JSON.stringify({ version: 1, ...options }),
    );
    expect(loadSetupOptions(storage)).toEqual({
      value: options,
      warning: null,
    });
  });

  it("저장값이 없으면 기본 설정을 반환한다", () => {
    expect(loadSetupOptions(memoryStorage())).toEqual({
      value: DEFAULT_SETUP_OPTIONS,
      warning: null,
    });
  });

  it.each([
    "{bad json",
    JSON.stringify({
      version: 1,
      mode: "invalid",
      drawCountMode: "all",
      customDrawCount: "1",
      soundEnabled: false,
    }),
    JSON.stringify({
      version: 2,
      mode: "manual",
      drawCountMode: "all",
      customDrawCount: "1",
      soundEnabled: false,
    }),
  ])("손상되거나 지원하지 않는 저장값을 기본 설정과 경고로 변환한다", (value) => {
    expect(loadSetupOptions(memoryStorage(value))).toEqual({
      value: DEFAULT_SETUP_OPTIONS,
      warning: "저장된 설정을 불러오지 못했습니다.",
    });
  });

  it("저장소 접근 실패를 경고로 변환한다", () => {
    const failingStorage = {
      getItem: vi.fn(() => {
        throw new Error("거부");
      }),
      setItem: vi.fn(() => {
        throw new Error("거부");
      }),
    };

    expect(loadSetupOptions(failingStorage)).toEqual({
      value: DEFAULT_SETUP_OPTIONS,
      warning: "저장된 설정을 불러오지 못했습니다.",
    });
    expect(saveSetupOptions(DEFAULT_SETUP_OPTIONS, failingStorage).warning).toBe(
      "설정을 저장하지 못했습니다.",
    );
  });
});
