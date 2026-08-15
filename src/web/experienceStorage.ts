import type { DrawExperienceType } from "./experience";

export const EXPERIENCE_STORAGE_KEY = "roulette:selected-experience:v1";

type StoredExperience = {
  version: 1;
  type: DrawExperienceType;
};

type StorageAdapter = Pick<Storage, "getItem" | "setItem">;

type StorageResult<T> = {
  value: T;
  warning: string | null;
};

const LOAD_WARNING = "마지막 추첨기 선택을 불러오지 못했습니다.";
const SAVE_WARNING = "마지막 추첨기 선택을 저장하지 못했습니다.";

function browserStorage(): StorageAdapter {
  return globalThis.localStorage;
}

function isStoredExperience(value: unknown): value is StoredExperience {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<StoredExperience>;

  return (
    candidate.version === 1 &&
    (candidate.type === "lottery" || candidate.type === "wheel")
  );
}

/** 기능 내부 저장값과 분리된 셸의 마지막 선택값만 관리한다. */
export function loadSelectedExperience(
  storage: StorageAdapter = browserStorage(),
): StorageResult<DrawExperienceType | null> {
  try {
    const serialized = storage.getItem(EXPERIENCE_STORAGE_KEY);

    if (!serialized) {
      return { value: null, warning: null };
    }

    const parsed: unknown = JSON.parse(serialized);

    if (!isStoredExperience(parsed)) {
      return { value: null, warning: LOAD_WARNING };
    }

    return { value: parsed.type, warning: null };
  } catch {
    return { value: null, warning: LOAD_WARNING };
  }
}

export function saveSelectedExperience(
  type: DrawExperienceType,
  storage: StorageAdapter = browserStorage(),
): StorageResult<null> {
  const payload: StoredExperience = { version: 1, type };

  try {
    storage.setItem(EXPERIENCE_STORAGE_KEY, JSON.stringify(payload));
    return { value: null, warning: null };
  } catch {
    return { value: null, warning: SAVE_WARNING };
  }
}
