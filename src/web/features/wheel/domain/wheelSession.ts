import {
  secureRandomIndex,
  type RandomValuesSource,
} from "../../../../core/random";

export type WheelCandidate = {
  id: string;
  name: string;
};

export type WheelPhase = "ready" | "spinning" | "error";

export type WheelOutcome = {
  id: string;
  spinNumber: number;
  candidateId: string;
  name: string;
  drawnAt: number;
};

export type ActiveSpin = {
  outcomeId: string;
  targetCandidateId: string;
  startedAt: number;
  revealAt: number;
};

export type WheelSession = {
  candidates: WheelCandidate[];
  phase: WheelPhase;
  activeSpin: ActiveSpin | null;
  outcomes: WheelOutcome[];
  error: string | null;
};

const RANDOM_ERROR =
  "안전한 난수를 생성하지 못했습니다. 다시 시도해 주세요.";

/** 입력 순서를 보존하면서 중복 이름도 서로 다른 돌림판 구획으로 만든다. */
export function createWheelCandidates(names: string[]): WheelCandidate[] {
  return names.map((name, index) => ({
    id: `wheel-candidate-${index + 1}`,
    name,
  }));
}

/** 복원 추첨의 후보, 활성 회전과 개별 당첨 사건을 관리하는 순수 세션이다. */
export function createWheelSession(
  candidates: WheelCandidate[],
): WheelSession {
  if (candidates.length === 0) {
    throw new RangeError("돌림판 후보가 한 개 이상 필요합니다.");
  }

  const uniqueIds = new Set(candidates.map((candidate) => candidate.id));

  if (uniqueIds.size !== candidates.length) {
    throw new RangeError("돌림판 후보 ID는 서로 달라야 합니다.");
  }

  return {
    candidates: [...candidates],
    phase: "ready",
    activeSpin: null,
    outcomes: [],
    error: null,
  };
}

export function beginWheelSpin(
  session: WheelSession,
  startedAt: number,
  durationMs: number,
  randomValues?: RandomValuesSource,
): WheelSession {
  if (session.phase === "spinning") {
    return session;
  }

  if (!Number.isFinite(startedAt) || !Number.isFinite(durationMs) || durationMs < 0) {
    throw new RangeError("회전 시작 시각과 지속 시간은 유효해야 합니다.");
  }

  try {
    const targetIndex = secureRandomIndex(
      session.candidates.length,
      randomValues,
    );
    const targetCandidate = session.candidates[targetIndex];
    const spinNumber = session.outcomes.length + 1;

    return {
      ...session,
      phase: "spinning",
      activeSpin: {
        outcomeId: `wheel-outcome-${spinNumber}`,
        targetCandidateId: targetCandidate.id,
        startedAt,
        revealAt: startedAt + durationMs,
      },
      error: null,
    };
  } catch {
    return {
      ...session,
      phase: "error",
      activeSpin: null,
      error: RANDOM_ERROR,
    };
  }
}

export function completeWheelSpin(
  session: WheelSession,
  outcomeId: string,
  now: number,
): WheelSession {
  const activeSpin = session.activeSpin;

  if (
    session.phase !== "spinning" ||
    !activeSpin ||
    activeSpin.outcomeId !== outcomeId ||
    now < activeSpin.revealAt
  ) {
    return session;
  }

  const candidate = session.candidates.find(
    ({ id }) => id === activeSpin.targetCandidateId,
  );

  if (!candidate) {
    return {
      ...session,
      phase: "error",
      activeSpin: null,
      error: "확정된 당첨 후보를 찾지 못했습니다.",
    };
  }

  return {
    ...session,
    phase: "ready",
    activeSpin: null,
    outcomes: [
      ...session.outcomes,
      {
        id: activeSpin.outcomeId,
        spinNumber: session.outcomes.length + 1,
        candidateId: candidate.id,
        name: candidate.name,
        drawnAt: activeSpin.revealAt,
      },
    ],
    error: null,
  };
}

export function clearWheelOutcomes(session: WheelSession): WheelSession {
  return {
    ...session,
    phase: "ready",
    activeSpin: null,
    outcomes: [],
    error: null,
  };
}
