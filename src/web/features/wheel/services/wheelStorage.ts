export const WHEEL_CANDIDATES_STORAGE_KEY = "wheel-draw:candidates:v1";
export const WHEEL_OPTIONS_STORAGE_KEY = "wheel-draw:setup-options:v1";

export type WheelSetupOptions = {
  soundEnabled: boolean;
};

export const DEFAULT_WHEEL_OPTIONS: WheelSetupOptions = {
  soundEnabled: false,
};

type StoredWheelCandidates = {
  version: 1;
  rawInput: string;
};

type StoredWheelOptions = {
  version: 1;
  soundEnabled: boolean;
};

type StorageAdapter = Pick<
  Storage,
  "getItem" | "setItem" | "removeItem"
>;

export type WheelStorageResult<T> = {
  value: T;
  warning: string | null;
};

const CANDIDATES_LOAD_WARNING =
  "저장된 돌림판 후보를 불러오지 못했습니다.";
const CANDIDATES_SAVE_WARNING = "돌림판 후보를 저장하지 못했습니다.";
const OPTIONS_LOAD_WARNING = "저장된 돌림판 설정을 불러오지 못했습니다.";
const OPTIONS_SAVE_WARNING = "돌림판 설정을 저장하지 못했습니다.";

function browserStorage(): StorageAdapter {
  return globalThis.localStorage;
}

/** 로또 저장값과 분리된 돌림판 후보·효과음 설정만 관리한다. */
export function loadWheelRawInput(
  storage: StorageAdapter = browserStorage(),
): WheelStorageResult<string> {
  try {
    const serialized = storage.getItem(WHEEL_CANDIDATES_STORAGE_KEY);

    if (!serialized) {
      return { value: "", warning: null };
    }

    const parsed = JSON.parse(serialized) as Partial<StoredWheelCandidates>;

    if (parsed.version !== 1 || typeof parsed.rawInput !== "string") {
      return { value: "", warning: CANDIDATES_LOAD_WARNING };
    }

    return { value: parsed.rawInput, warning: null };
  } catch {
    return { value: "", warning: CANDIDATES_LOAD_WARNING };
  }
}

export function saveWheelRawInput(
  rawInput: string,
  storage: StorageAdapter = browserStorage(),
): WheelStorageResult<null> {
  const payload: StoredWheelCandidates = { version: 1, rawInput };

  try {
    storage.setItem(WHEEL_CANDIDATES_STORAGE_KEY, JSON.stringify(payload));
    return { value: null, warning: null };
  } catch {
    return { value: null, warning: CANDIDATES_SAVE_WARNING };
  }
}

export function clearWheelRawInput(
  storage: StorageAdapter = browserStorage(),
): WheelStorageResult<null> {
  try {
    storage.removeItem(WHEEL_CANDIDATES_STORAGE_KEY);
    return { value: null, warning: null };
  } catch {
    return { value: null, warning: CANDIDATES_SAVE_WARNING };
  }
}

export function loadWheelOptions(
  storage: StorageAdapter = browserStorage(),
): WheelStorageResult<WheelSetupOptions> {
  try {
    const serialized = storage.getItem(WHEEL_OPTIONS_STORAGE_KEY);

    if (!serialized) {
      return { value: { ...DEFAULT_WHEEL_OPTIONS }, warning: null };
    }

    const parsed = JSON.parse(serialized) as Partial<StoredWheelOptions>;

    if (parsed.version !== 1 || typeof parsed.soundEnabled !== "boolean") {
      return {
        value: { ...DEFAULT_WHEEL_OPTIONS },
        warning: OPTIONS_LOAD_WARNING,
      };
    }

    return {
      value: { soundEnabled: parsed.soundEnabled },
      warning: null,
    };
  } catch {
    return {
      value: { ...DEFAULT_WHEEL_OPTIONS },
      warning: OPTIONS_LOAD_WARNING,
    };
  }
}

export function saveWheelOptions(
  options: WheelSetupOptions,
  storage: StorageAdapter = browserStorage(),
): WheelStorageResult<null> {
  const payload: StoredWheelOptions = { version: 1, ...options };

  try {
    storage.setItem(WHEEL_OPTIONS_STORAGE_KEY, JSON.stringify(payload));
    return { value: null, warning: null };
  } catch {
    return { value: null, warning: OPTIONS_SAVE_WARNING };
  }
}
