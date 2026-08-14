import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  secureRandomInteger,
  type RandomValuesSource,
} from "../../../core/random";
import { WheelControls } from "./components/WheelControls";
import {
  formatWheelOutcomes,
  WheelResultHistory,
} from "./components/WheelResultHistory";
import { WheelSetup } from "./components/WheelSetup";
import { WheelSoundToggle } from "./components/WheelSoundToggle";
import {
  MAXIMUM_FULL_ROTATIONS,
  MAXIMUM_SPIN_DURATION_MS,
  MINIMUM_FULL_ROTATIONS,
  MINIMUM_SPIN_DURATION_MS,
  REDUCED_MOTION_DURATION_MS,
  WheelStage,
} from "./components/WheelStage";
import { getTargetRotation } from "./domain/wheelGeometry";
import {
  beginWheelSpin,
  clearWheelOutcomes,
  completeWheelSpin,
  createWheelSession,
  type WheelSession,
} from "./domain/wheelSession";
import { parseWheelInput } from "./domain/wheelSetup";
import { WheelSoundController } from "./services/wheelSoundController";
import {
  clearWheelRawInput,
  loadWheelOptions,
  loadWheelRawInput,
  saveWheelOptions,
  saveWheelRawInput,
} from "./services/wheelStorage";
import "./wheel.css";

type WheelSoundService = Pick<
  WheelSoundController,
  "setEnabled" | "startSpin" | "playWinner" | "stopSpin" | "dispose"
>;

type WheelAppProps = {
  randomValues?: RandomValuesSource;
  now?: () => number;
  soundService?: WheelSoundService;
};

type WheelSpinProfile = {
  durationMs: number;
  fullRotations: number;
};

/** 같은 회전 강도로 회전량과 시간을 함께 늘려 물리적인 편차를 표현한다. */
function createWheelSpinProfile(
  randomValues?: RandomValuesSource,
): WheelSpinProfile {
  let durationMs = MINIMUM_SPIN_DURATION_MS;

  try {
    durationMs = secureRandomInteger(
      MINIMUM_SPIN_DURATION_MS,
      MAXIMUM_SPIN_DURATION_MS,
      randomValues,
    );
  } catch {
    // 연출 난수만 실패하면 최소 프로필을 사용하고, 당첨 난수 실패는 세션이 별도로 처리한다.
  }

  const strength =
    (durationMs - MINIMUM_SPIN_DURATION_MS) /
    (MAXIMUM_SPIN_DURATION_MS - MINIMUM_SPIN_DURATION_MS);

  return {
    durationMs,
    fullRotations: Math.round(
      MINIMUM_FULL_ROTATIONS +
        (MAXIMUM_FULL_ROTATIONS - MINIMUM_FULL_ROTATIONS) * strength,
    ),
  };
}

function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-reduced-motion: reduce)");

    if (!mediaQuery) {
      return;
    }

    const syncPreference = () => setReducedMotion(mediaQuery.matches);
    mediaQuery.addEventListener("change", syncPreference);
    return () => mediaQuery.removeEventListener("change", syncPreference);
  }, []);

  return reducedMotion;
}

/** 설정·복원 추첨·회전 표현·결과 이력을 독립적으로 조정하는 돌림판 기능 진입점이다. */
export function WheelApp({
  randomValues,
  now = Date.now,
  soundService,
}: WheelAppProps = {}) {
  const loadedRawInput = useState(() => loadWheelRawInput())[0];
  const loadedOptions = useState(() => loadWheelOptions())[0];
  const [view, setView] = useState<"setup" | "draw">("setup");
  const [rawInput, setRawInput] = useState(loadedRawInput.value);
  const [soundEnabled, setSoundEnabled] = useState(
    loadedOptions.value.soundEnabled,
  );
  const [warning, setWarning] = useState<string | null>(
    [loadedRawInput.warning, loadedOptions.warning].filter(Boolean).join(" ") ||
      null,
  );
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [session, setSession] = useState<WheelSession | null>(null);
  const [currentRotation, setCurrentRotation] = useState(0);
  const [previousRotation, setPreviousRotation] = useState(0);
  const [spinDurationMs, setSpinDurationMs] = useState(
    MINIMUM_SPIN_DURATION_MS,
  );
  const sessionRef = useRef<WheelSession | null>(null);
  const rotationRef = useRef(0);
  const reducedMotion = useReducedMotion();
  const controller = useState<WheelSoundService>(
    () => soundService ?? new WheelSoundController(),
  )[0];
  const parsedInput = useMemo(() => parseWheelInput(rawInput), [rawInput]);

  const commitSession = useCallback((nextSession: WheelSession | null) => {
    sessionRef.current = nextSession;
    setSession(nextSession);
  }, []);

  useEffect(() => {
    controller.setEnabled(soundEnabled);
  }, [controller, soundEnabled]);

  useEffect(
    () => () => {
      controller.dispose();
      sessionRef.current = null;
    },
    [controller],
  );

  const activeOutcomeId = session?.activeSpin?.outcomeId;
  const activeRevealAt = session?.activeSpin?.revealAt;

  useEffect(() => {
    if (!activeOutcomeId || activeRevealAt === undefined) {
      return;
    }

    let timerId: number | null = null;

    const finishSpin = () => {
      const currentSession = sessionRef.current;

      if (
        !currentSession?.activeSpin ||
        currentSession.activeSpin.outcomeId !== activeOutcomeId
      ) {
        return;
      }

      const currentTime = now();
      const remainingTime = activeRevealAt - currentTime;

      if (remainingTime > 0) {
        timerId = window.setTimeout(finishSpin, remainingTime);
        return;
      }

      const completed = completeWheelSpin(
        currentSession,
        activeOutcomeId,
        currentTime,
      );

      if (completed !== currentSession) {
        commitSession(completed);
        controller.playWinner();
        setActionMessage(null);
      }
    };

    timerId = window.setTimeout(
      finishSpin,
      Math.max(0, activeRevealAt - now()),
    );
    const recoverOverdueSpin = () => {
      if (!document.hidden) {
        finishSpin();
      }
    };

    window.addEventListener("focus", finishSpin);
    document.addEventListener("visibilitychange", recoverOverdueSpin);

    return () => {
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
      window.removeEventListener("focus", finishSpin);
      document.removeEventListener("visibilitychange", recoverOverdueSpin);
    };
  }, [activeOutcomeId, activeRevealAt, commitSession, controller, now]);

  const handleRawInputChange = (value: string) => {
    setRawInput(value);
    setWarning(saveWheelRawInput(value).warning);
  };

  const handleClearInput = () => {
    setRawInput("");
    setWarning(clearWheelRawInput().warning);
  };

  const handleSoundToggle = () => {
    const nextSoundEnabled = !soundEnabled;
    setSoundEnabled(nextSoundEnabled);
    setWarning(
      saveWheelOptions({ soundEnabled: nextSoundEnabled }).warning,
    );
  };

  const handleStart = () => {
    if (parsedInput.errors.length > 0 || parsedInput.candidates.length === 0) {
      return;
    }

    commitSession(createWheelSession(parsedInput.candidates));
    rotationRef.current = 0;
    setCurrentRotation(0);
    setPreviousRotation(0);
    setSpinDurationMs(MINIMUM_SPIN_DURATION_MS);
    setActionMessage(null);
    setView("draw");
  };

  const handleSpin = () => {
    const currentSession = sessionRef.current;

    if (!currentSession || currentSession.phase === "spinning") {
      return;
    }

    const spinProfile = reducedMotion
      ? {
          durationMs: REDUCED_MOTION_DURATION_MS,
          fullRotations: MINIMUM_FULL_ROTATIONS,
        }
      : createWheelSpinProfile(randomValues);
    const startedAt = now();
    const nextSession = beginWheelSpin(
      currentSession,
      startedAt,
      spinProfile.durationMs,
      randomValues,
    );
    commitSession(nextSession);

    if (!nextSession.activeSpin) {
      controller.stopSpin();
      return;
    }

    const candidateIndex = nextSession.candidates.findIndex(
      ({ id }) => id === nextSession.activeSpin?.targetCandidateId,
    );
    const nextRotation = getTargetRotation({
      currentRotation: rotationRef.current,
      candidateIndex,
      candidateCount: nextSession.candidates.length,
      pointerAngle: 0,
      minimumFullRotations: spinProfile.fullRotations,
    });

    setPreviousRotation(rotationRef.current);
    setSpinDurationMs(spinProfile.durationMs);
    rotationRef.current = nextRotation;
    setCurrentRotation(nextRotation);
    setActionMessage(null);
    controller.startSpin(spinProfile.durationMs);
  };

  const handleClearOutcomes = () => {
    const currentSession = sessionRef.current;

    if (!currentSession || currentSession.phase === "spinning") {
      return;
    }

    commitSession(clearWheelOutcomes(currentSession));
    setActionMessage("결과를 비웠습니다.");
  };

  const handleRedraw = () => {
    const currentSession = sessionRef.current;

    if (
      !currentSession ||
      currentSession.phase === "spinning" ||
      currentSession.outcomes.length === 0
    ) {
      return;
    }

    commitSession(clearWheelOutcomes(currentSession));
    setActionMessage("재추첨할 준비가 되었습니다.");
  };

  const handleCopyOutcomes = async () => {
    const outcomes = sessionRef.current?.outcomes ?? [];

    if (outcomes.length === 0) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard unavailable");
      }

      await navigator.clipboard.writeText(formatWheelOutcomes(outcomes));
      setActionMessage("결과를 복사했습니다.");
    } catch {
      setActionMessage("결과를 복사하지 못했습니다.");
    }
  };

  const handleReset = () => {
    controller.stopSpin();
    commitSession(null);
    rotationRef.current = 0;
    setCurrentRotation(0);
    setPreviousRotation(0);
    setSpinDurationMs(MINIMUM_SPIN_DURATION_MS);
    setActionMessage(null);
    setView("setup");
  };

  const handleAnimationError = useCallback(() => {
    setWarning(
      "회전 연출을 표시하지 못했지만 확정된 결과는 정상 처리됩니다.",
    );
  }, []);

  if (view === "setup" || !session) {
    return (
      <WheelSetup
        rawInput={rawInput}
        parsedInput={parsedInput}
        soundEnabled={soundEnabled}
        warning={warning}
        onRawInputChange={handleRawInputChange}
        onClearInput={handleClearInput}
        onSoundToggle={handleSoundToggle}
        onStart={handleStart}
      />
    );
  }

  const isSpinning = session.phase === "spinning";
  const latestOutcome = session.outcomes.at(-1);
  const statusLabel = isSpinning
    ? "당첨 후보를 향해 회전 중입니다."
    : session.phase === "error"
      ? session.error ?? "회전을 시작하지 못했습니다."
      : latestOutcome
        ? `최근 당첨 결과는 ${latestOutcome.name}입니다.`
        : "회전할 준비가 되었습니다.";

  return (
    <main className="wheel-app wheel-draw">
      <div className="wheel-draw__utility">
        <WheelSoundToggle
          enabled={soundEnabled}
          onToggle={handleSoundToggle}
        />
      </div>
      <header className="wheel-draw__header">
        <div>
          <p className="wheel-eyebrow">WHEEL DRAW</p>
          <h1 aria-label="돌려 돌려, 돌림판">
            돌려 돌려,{" "}
            <span>돌림판</span>
          </h1>
        </div>
        <p className="wheel-draw__status" role="status">
          {statusLabel}
        </p>
      </header>

      <div className="wheel-draw__layout">
        <section className="wheel-panel wheel-draw__stage" aria-label="돌림판 회전">
          <WheelStage
            candidates={session.candidates}
            currentRotation={currentRotation}
            previousRotation={previousRotation}
            isSpinning={isSpinning}
            reducedMotion={reducedMotion}
            spinDurationMs={spinDurationMs}
            statusLabel={statusLabel}
            onAnimationError={handleAnimationError}
          />
          <WheelControls
            isSpinning={isSpinning}
            canRedraw={session.outcomes.length > 0}
            onSpin={handleSpin}
            onRedraw={handleRedraw}
            onReset={handleReset}
          />
          {session.error ? (
            <p className="wheel-error" role="alert">
              {session.error}
            </p>
          ) : null}
          {warning ? (
            <p className="wheel-warning" role="status">
              {warning}
            </p>
          ) : null}
        </section>

        <WheelResultHistory
          candidates={session.candidates}
          outcomes={session.outcomes}
          isSpinning={isSpinning}
          actionMessage={actionMessage}
          onCopy={() => void handleCopyOutcomes()}
          onClear={handleClearOutcomes}
        />

        <aside className="wheel-panel wheel-candidates" aria-labelledby="wheel-candidates-title">
          <div className="wheel-section-heading">
            <div>
              <p className="wheel-eyebrow">CANDIDATES</p>
              <h2 id="wheel-candidates-title">전체 후보</h2>
            </div>
            <span>{session.candidates.length}명</span>
          </div>
          <ol>
            {session.candidates.map((candidate, index) => (
              <li key={candidate.id}>
                <span>{index + 1}</span>
                <strong>{candidate.name}</strong>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </main>
  );
}
