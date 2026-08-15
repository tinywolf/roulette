import {
  secureRandomInteger,
  webCryptoRandomValues,
  type RandomValuesSource,
} from "../../../../core/random";
import type { ScheduledDraw } from "./types";

export const AUTO_DRAW_MIN_SECONDS = 3;
export const AUTO_DRAW_MAX_SECONDS = 7;

export {
  createDrawOrder,
  secureRandomIndex,
  secureRandomInteger,
  SecureRandomError,
  webCryptoRandomValues as browserRandomValues,
  type RandomValuesSource,
} from "../../../../core/random";

export function createAutoSchedule(
  orderedBallIds: string[],
  startedAt: number,
  randomValues: RandomValuesSource = webCryptoRandomValues,
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
