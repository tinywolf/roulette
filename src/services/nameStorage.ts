export const NAME_STORAGE_KEY = "lottery-draw:names:v1";

type StoredNames = {
  version: 1;
  rawInput: string;
};

export type StorageResult<T> = {
  value: T;
  warning: string | null;
};

type StorageAdapter = Pick<Storage, "getItem" | "setItem" | "removeItem">;

const SAVE_WARNING = "목록을 저장하지 못했습니다.";
const LOAD_WARNING = "저장된 이름 목록을 불러오지 못했습니다.";

function browserStorage(): StorageAdapter {
  return globalThis.localStorage;
}

export function loadRawInput(
  storage: StorageAdapter = browserStorage(),
): StorageResult<string> {
  try {
    const serialized = storage.getItem(NAME_STORAGE_KEY);

    if (!serialized) {
      return { value: "", warning: null };
    }

    const parsed = JSON.parse(serialized) as Partial<StoredNames>;

    if (parsed.version !== 1 || typeof parsed.rawInput !== "string") {
      return { value: "", warning: LOAD_WARNING };
    }

    return { value: parsed.rawInput, warning: null };
  } catch {
    return { value: "", warning: LOAD_WARNING };
  }
}

export function saveRawInput(
  rawInput: string,
  storage: StorageAdapter = browserStorage(),
): StorageResult<null> {
  const payload: StoredNames = { version: 1, rawInput };

  try {
    storage.setItem(NAME_STORAGE_KEY, JSON.stringify(payload));
    return { value: null, warning: null };
  } catch {
    return { value: null, warning: SAVE_WARNING };
  }
}

export function clearRawInput(
  storage: StorageAdapter = browserStorage(),
): StorageResult<null> {
  try {
    storage.removeItem(NAME_STORAGE_KEY);
    return { value: null, warning: null };
  } catch {
    return { value: null, warning: SAVE_WARNING };
  }
}
