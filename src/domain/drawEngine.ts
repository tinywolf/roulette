import {
  createAutoSchedule,
  createDrawOrder,
  secureRandomIndex,
  SecureRandomError,
  type RandomValuesSource,
} from "./random";
import type { Ball, DrawMode, DrawResult, DrawSession } from "./types";

const RANDOM_FAILURE_MESSAGE =
  "안전한 난수를 생성하지 못해 추첨을 중단했습니다. 처음부터 다시 시도해 주세요.";

function findBall(session: DrawSession, ballId: string): Ball {
  const ball = session.balls.find((candidate) => candidate.id === ballId);

  if (!ball) {
    throw new Error(`세션에서 공을 찾을 수 없습니다: ${ballId}`);
  }

  return ball;
}

function toRandomErrorSession(session: DrawSession): DrawSession {
  return {
    ...session,
    phase: "error",
    pendingBallId: null,
    error: RANDOM_FAILURE_MESSAGE,
  };
}

export function createDrawSession(
  balls: Ball[],
  mode: DrawMode,
  drawCount: number,
  startedAt: number,
  randomValues?: RandomValuesSource,
): DrawSession {
  if (
    !Number.isInteger(drawCount) ||
    drawCount < 1 ||
    drawCount > balls.length
  ) {
    throw new RangeError("추첨 개수는 전체 공 개수 이내의 양의 정수여야 합니다.");
  }

  const baseSession: DrawSession = {
    mode,
    drawCount,
    phase: mode === "manual" ? "ready" : "running",
    balls,
    remainingBallIds: balls.map((ball) => ball.id),
    results: [],
    schedule: [],
    startedAt,
    pendingBallId: null,
    error: null,
  };

  if (mode === "manual") {
    return baseSession;
  }

  try {
    const orderedBallIds = createDrawOrder(balls, randomValues).slice(
      0,
      drawCount,
    );

    return {
      ...baseSession,
      schedule: createAutoSchedule(orderedBallIds, startedAt, randomValues),
    };
  } catch (error) {
    if (error instanceof SecureRandomError) {
      return toRandomErrorSession(baseSession);
    }

    throw error;
  }
}

export function beginManualDraw(
  session: DrawSession,
  randomValues?: RandomValuesSource,
): DrawSession {
  if (
    session.mode !== "manual" ||
    session.phase !== "ready" ||
    session.remainingBallIds.length === 0 ||
    session.results.length >= session.drawCount
  ) {
    return session;
  }

  try {
    const selectedIndex = secureRandomIndex(
      session.remainingBallIds.length,
      randomValues,
    );

    return {
      ...session,
      phase: "mixing",
      pendingBallId: session.remainingBallIds[selectedIndex],
      error: null,
    };
  } catch (error) {
    if (error instanceof SecureRandomError) {
      return toRandomErrorSession(session);
    }

    throw error;
  }
}

export function completeManualDraw(
  session: DrawSession,
  drawnAt: number,
): DrawSession {
  if (
    session.mode !== "manual" ||
    session.phase !== "mixing" ||
    !session.pendingBallId
  ) {
    return session;
  }

  const ball = findBall(session, session.pendingBallId);
  const result: DrawResult = {
    order: session.results.length + 1,
    ballId: ball.id,
    name: ball.name,
    drawnAt,
  };
  const remainingBallIds = session.remainingBallIds.filter(
    (ballId) => ballId !== ball.id,
  );
  const results = [...session.results, result];

  return {
    ...session,
    phase: results.length >= session.drawCount ? "completed" : "ready",
    remainingBallIds,
    results,
    pendingBallId: null,
  };
}

export function reconcileScheduledDraws(
  session: DrawSession,
  now: number,
): DrawSession {
  if (session.mode !== "auto" || session.phase !== "running") {
    return session;
  }

  const completedBallIds = new Set(session.results.map((result) => result.ballId));
  const dueDraws = session.schedule.filter(
    (scheduledDraw) =>
      scheduledDraw.dueAt <= now && !completedBallIds.has(scheduledDraw.ballId),
  );

  if (dueDraws.length === 0) {
    return session;
  }

  const addedResults = dueDraws.map((scheduledDraw) => {
    const ball = findBall(session, scheduledDraw.ballId);

    return {
      order: scheduledDraw.order,
      ballId: ball.id,
      name: ball.name,
      drawnAt: scheduledDraw.dueAt,
    };
  });
  const drawnBallIds = new Set(addedResults.map((result) => result.ballId));
  const remainingBallIds = session.remainingBallIds.filter(
    (ballId) => !drawnBallIds.has(ballId),
  );
  const results = [...session.results, ...addedResults].sort(
    (first, second) => first.order - second.order,
  );

  return {
    ...session,
    phase: results.length >= session.drawCount ? "completed" : "running",
    remainingBallIds,
    results,
  };
}

export function formatResults(results: DrawResult[]): string {
  return results.map((result) => `${result.order}. ${result.name}`).join("\n");
}

export function resetDrawSession(): null {
  return null;
}
