import type { Candidate } from "./types.js";

/** Web Crypto로 편향 없는 인덱스와 비복원 추첨 순서를 생성한다. */
const UINT32_RANGE = 0x1_0000_0000;

export type RandomValuesSource = (values: Uint32Array<ArrayBuffer>) => void;

export class SecureRandomError extends Error {
  constructor(message = "안전한 난수를 생성하지 못했습니다.") {
    super(message);
    this.name = "SecureRandomError";
  }
}

export const webCryptoRandomValues: RandomValuesSource = (values) => {
  const cryptoApi = globalThis.crypto;

  if (!cryptoApi?.getRandomValues) {
    throw new SecureRandomError();
  }

  try {
    cryptoApi.getRandomValues(values);
  } catch {
    throw new SecureRandomError();
  }
};

export function secureRandomIndex(
  length: number,
  randomValues: RandomValuesSource = webCryptoRandomValues,
): number {
  if (!Number.isInteger(length) || length <= 0 || length > UINT32_RANGE) {
    throw new RangeError("난수 범위는 1 이상 2^32 이하여야 합니다.");
  }

  const acceptanceLimit = Math.floor(UINT32_RANGE / length) * length;
  const values = new Uint32Array(1);

  for (;;) {
    try {
      randomValues(values);
    } catch (error) {
      if (error instanceof SecureRandomError) {
        throw error;
      }

      throw new SecureRandomError();
    }

    if (values[0] < acceptanceLimit) {
      return values[0] % length;
    }
  }
}

export function secureRandomInteger(
  minimum: number,
  maximum: number,
  randomValues: RandomValuesSource = webCryptoRandomValues,
): number {
  if (
    !Number.isInteger(minimum) ||
    !Number.isInteger(maximum) ||
    minimum > maximum
  ) {
    throw new RangeError("유효한 정수 범위를 입력해야 합니다.");
  }

  return minimum + secureRandomIndex(maximum - minimum + 1, randomValues);
}

export function createDrawOrder(
  candidates: Candidate[],
  randomValues: RandomValuesSource = webCryptoRandomValues,
): string[] {
  const orderedIds = candidates.map((candidate) => candidate.id);

  for (let index = orderedIds.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1, randomValues);
    [orderedIds[index], orderedIds[swapIndex]] = [
      orderedIds[swapIndex],
      orderedIds[index],
    ];
  }

  return orderedIds;
}
