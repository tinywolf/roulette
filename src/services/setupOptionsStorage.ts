/**
 * 추첨 세션과 무관한 사용자 설정을 버전 저장값으로 관리하고,
 * 손상 데이터나 저장소 접근 실패를 안전한 기본값으로 격리한다.
 */
import type { DrawCountMode, DrawMode } from "../domain/types";

export const SETUP_OPTIONS_STORAGE_KEY = "lottery-draw:setup-options:v1";

export type SetupOptions = {
  mode: DrawMode;
  drawCountMode: DrawCountMode;
  customDrawCount: string;
  soundEnabled: boolean;
};

export const DEFAULT_SETUP_OPTIONS: SetupOptions = {
  mode: "manual",
  drawCountMode: "all",
  customDrawCount: "1",
  soundEnabled: false,
};

type StoredSetupOptions = SetupOptions & {
  version: 1;
};

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

type StorageResult<T> = {
  value: T;
  warning: string | null;
};

const SAVE_WARNING = "설정을 저장하지 못했습니다.";
const LOAD_WARNING = "저장된 설정을 불러오지 못했습니다.";

function browserStorage(): StorageAdapter {
  return globalThis.localStorage;
}

function isStoredSetupOptions(value: unknown): value is StoredSetupOptions {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredSetupOptions>;

  return (
    candidate.version === 1 &&
    (candidate.mode === "manual" || candidate.mode === "auto") &&
    (candidate.drawCountMode === "all" ||
      candidate.drawCountMode === "custom") &&
    typeof candidate.customDrawCount === "string" &&
    typeof candidate.soundEnabled === "boolean"
  );
}

export function loadSetupOptions(
  storage: StorageAdapter = browserStorage(),
): StorageResult<SetupOptions> {
  try {
    const serialized = storage.getItem(SETUP_OPTIONS_STORAGE_KEY);

    if (!serialized) {
      return { value: { ...DEFAULT_SETUP_OPTIONS }, warning: null };
    }

    const parsed: unknown = JSON.parse(serialized);

    if (!isStoredSetupOptions(parsed)) {
      return {
        value: { ...DEFAULT_SETUP_OPTIONS },
        warning: LOAD_WARNING,
      };
    }

    return {
      value: {
        mode: parsed.mode,
        drawCountMode: parsed.drawCountMode,
        customDrawCount: parsed.customDrawCount,
        soundEnabled: parsed.soundEnabled,
      },
      warning: null,
    };
  } catch {
    return {
      value: { ...DEFAULT_SETUP_OPTIONS },
      warning: LOAD_WARNING,
    };
  }
}

export function saveSetupOptions(
  options: SetupOptions,
  storage: StorageAdapter = browserStorage(),
): StorageResult<null> {
  const payload: StoredSetupOptions = {
    version: 1,
    ...options,
  };

  try {
    storage.setItem(SETUP_OPTIONS_STORAGE_KEY, JSON.stringify(payload));
    return { value: null, warning: null };
  } catch {
    return { value: null, warning: SAVE_WARNING };
  }
}
