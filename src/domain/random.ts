import type { Ball, ScheduledDraw } from "./types";

const UINT32_RANGE = 0x1_0000_0000;
export const AUTO_DRAW_MIN_SECONDS = 3;
export const AUTO_DRAW_MAX_SECONDS = 7;

export type RandomValuesSource = (values: Uint32Array<ArrayBuffer>) => void;

export class SecureRandomError extends Error {
  constructor(message = "안전한 난수를 생성하지 못했습니다.") {
    super(message);
    this.name = "SecureRandomError";
  }
}

export const browserRandomValues: RandomValuesSource = (values) => {
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
  randomValues: RandomValuesSource = browserRandomValues,
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
  randomValues: RandomValuesSource = browserRandomValues,
): number {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || minimum > maximum) {
    throw new RangeError("유효한 정수 범위를 입력해야 합니다.");
  }

  return minimum + secureRandomIndex(maximum - minimum + 1, randomValues);
}

export function createDrawOrder(
  balls: Ball[],
  randomValues: RandomValuesSource = browserRandomValues,
): string[] {
  const orderedIds = balls.map((ball) => ball.id);

  for (let index = orderedIds.length - 1; index > 0; index -= 1) {
    const swapIndex = secureRandomIndex(index + 1, randomValues);
    [orderedIds[index], orderedIds[swapIndex]] = [
      orderedIds[swapIndex],
      orderedIds[index],
    ];
  }

  return orderedIds;
}

export function createAutoSchedule(
  orderedBallIds: string[],
  startedAt: number,
  randomValues: RandomValuesSource = browserRandomValues,
): ScheduledDraw[] {
  let dueAt = startedAt;

  return orderedBallIds.map((ballId, index) => {
    dueAt +=
      secureRandomInteger(
        AUTO_DRAW_MIN_SECONDS,
        AUTO_DRAW_MAX_SECONDS,
        randomValues,
      ) * 1_000;

    return {
      order: index + 1,
      ballId,
      dueAt,
    };
  });
}
