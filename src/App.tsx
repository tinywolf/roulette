import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DrawControls } from "./components/DrawControls";
import { LotteryMachine } from "./components/LotteryMachine";
import { ResultList } from "./components/ResultList";
import { SetupPanel } from "./components/SetupPanel";
import { SoundToggle } from "./components/SoundToggle";
import {
  beginManualDraw,
  completeManualDraw,
  createDrawSession,
  formatResults,
  reconcileScheduledDraws,
  resetDrawSession,
} from "./domain/drawEngine";
import { validateDrawCount } from "./domain/drawCount";
import { parseNames } from "./domain/names";
import {
  createBalls,
  type DrawCountMode,
  type DrawMode,
  type DrawResult,
  type DrawSession,
} from "./domain/types";
import {
  clearRawInput,
  loadRawInput,
  saveRawInput,
} from "./services/nameStorage";
import { SoundController } from "./services/soundController";

type Notice = {
  type: "success" | "warning" | "error";
  text: string;
};

const MANUAL_DRAW_DURATION = 2_400;

export function shouldMixMachine(
  session: Pick<DrawSession, "mode" | "phase">,
): boolean {
  if (session.mode === "auto") {
    return session.phase === "running";
  }

  return session.phase === "ready" || session.phase === "mixing";
}

function App() {
  const [initialStorage] = useState(() => loadRawInput());
  const [rawInput, setRawInput] = useState(initialStorage.value);
  const [mode, setMode] = useState<DrawMode>("manual");
  const [drawCountMode, setDrawCountMode] =
    useState<DrawCountMode>("all");
  const [customDrawCount, setCustomDrawCount] = useState("1");
  const [session, setSession] = useState<DrawSession | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(() =>
    initialStorage.warning
      ? { type: "warning", text: initialStorage.warning }
      : null,
  );
  const [visualResult, setVisualResult] = useState<DrawResult | null>(null);
  const previousResultCount = useRef(0);
  const soundController = useRef<SoundController | null>(null);
  soundController.current ??= new SoundController();

  const parsedNames = useMemo(() => parseNames(rawInput), [rawInput]);
  const drawCountValidation = useMemo(
    () =>
      validateDrawCount(
        drawCountMode,
        customDrawCount,
        parsedNames.names.length,
      ),
    [customDrawCount, drawCountMode, parsedNames.names.length],
  );
  const isSetup = session === null;
  const remainingBalls = useMemo(() => {
    if (!session) {
      return [];
    }

    const remainingIds = new Set(session.remainingBallIds);
    return session.balls.filter((ball) => remainingIds.has(ball.id));
  }, [session]);

  const handleCanvasError = useCallback((message: string) => {
    setNotice((current) =>
      current?.text === message ? current : { type: "warning", text: message },
    );
  }, []);

  const handleRawInputChange = (value: string) => {
    setRawInput(value);
    const result = saveRawInput(value);

    if (result.warning) {
      setNotice({ type: "warning", text: result.warning });
    } else if (notice?.type === "warning") {
      setNotice(null);
    }
  };

  const handleClear = () => {
    setRawInput("");
    const result = clearRawInput();

    setNotice(
      result.warning ? { type: "warning", text: result.warning } : null,
    );
  };

  const handleStart = () => {
    if (
      parsedNames.errors.length > 0 ||
      drawCountValidation.errors.length > 0
    ) {
      return;
    }

    const nextSession = createDrawSession(
      createBalls(parsedNames.names),
      mode,
      drawCountValidation.value,
      Date.now(),
    );
    previousResultCount.current = 0;
    setVisualResult(null);
    setSession(nextSession);

    if (nextSession.error) {
      setNotice({ type: "error", text: nextSession.error });
    } else {
      setNotice(null);
    }
  };

  const handleManualDraw = () => {
    void soundController.current?.play("mix");
    setSession((current) =>
      current ? beginManualDraw(current) : current,
    );
  };

  const handleReset = () => {
    setSession(resetDrawSession());
    setVisualResult(null);
    previousResultCount.current = 0;
    setNotice(null);
  };

  const handleSoundToggle = () => {
    setSoundEnabled((enabled) => {
      const nextEnabled = !enabled;
      soundController.current?.setEnabled(nextEnabled);

      if (nextEnabled) {
        void soundController.current?.play("draw");
      }

      return nextEnabled;
    });
  };

  const handleCopy = async () => {
    if (!session || session.results.length === 0) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("클립보드를 사용할 수 없습니다.");
      }

      await navigator.clipboard.writeText(formatResults(session.results));
      setNotice({ type: "success", text: "추첨 결과를 복사했습니다." });
    } catch {
      setNotice({ type: "error", text: "결과를 복사하지 못했습니다." });
    }
  };

  useEffect(() => {
    soundController.current?.setEnabled(soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    return () => {
      soundController.current?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!session || session.mode !== "manual" || session.phase !== "mixing") {
      return undefined;
    }

    const pendingBallId = session.pendingBallId;
    const timer = window.setTimeout(() => {
      setSession((current) => {
        if (
          !current ||
          current.phase !== "mixing" ||
          current.pendingBallId !== pendingBallId
        ) {
          return current;
        }

        return completeManualDraw(current, Date.now());
      });
    }, MANUAL_DRAW_DURATION);

    return () => {
      window.clearTimeout(timer);
    };
  }, [session]);

  useEffect(() => {
    if (!session || session.mode !== "auto" || session.phase !== "running") {
      return undefined;
    }

    const reconcile = () => {
      setSession((current) =>
        current ? reconcileScheduledDraws(current, Date.now()) : current,
      );
    };
    const completedIds = new Set(session.results.map((result) => result.ballId));
    const nextDraw = session.schedule.find(
      (scheduledDraw) => !completedIds.has(scheduledDraw.ballId),
    );
    const timeout = window.setTimeout(
      reconcile,
      Math.max(0, (nextDraw?.dueAt ?? Date.now()) - Date.now()),
    );

    document.addEventListener("visibilitychange", reconcile);
    window.addEventListener("focus", reconcile);
    reconcile();

    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("visibilitychange", reconcile);
      window.removeEventListener("focus", reconcile);
    };
  }, [session]);

  useEffect(() => {
    if (!session) {
      previousResultCount.current = 0;
      return;
    }

    const nextCount = session.results.length;
    const addedCount = nextCount - previousResultCount.current;

    if (addedCount > 0) {
      const latest = session.results.at(-1) ?? null;
      const isVisible =
        typeof document === "undefined" || document.visibilityState === "visible";

      setVisualResult(isVisible && addedCount === 1 ? latest : null);

      if (isVisible && addedCount === 1) {
        void soundController.current?.play(
          session.phase === "completed" ? "complete" : "draw",
        );
      }
    }

    previousResultCount.current = nextCount;
  }, [session]);

  useEffect(() => {
    if (session?.phase === "error" && session.error) {
      setNotice({ type: "error", text: session.error });
    }
  }, [session]);

  return (
    <main className={isSetup ? "app-shell app-shell--setup" : "app-shell"}>
      <header className="app-header">
        <div className="brand" aria-label="로또 추첨기">
          <span className="brand-mark" aria-hidden="true">
            ●
          </span>
          <span>로또 추첨기</span>
        </div>
        {!isSetup ? (
          <SoundToggle enabled={soundEnabled} onToggle={handleSoundToggle} />
        ) : null}
      </header>

      {notice ? (
        <div
          className={`notice notice--${notice.type}`}
          role={notice.type === "error" ? "alert" : "status"}
        >
          <span aria-hidden="true">
            {notice.type === "success"
              ? "✓"
              : notice.type === "warning"
                ? "!"
                : "×"}
          </span>
          {notice.text}
        </div>
      ) : null}

      {isSetup ? (
        <div className="setup-layout">
          <section className="hero-copy" aria-labelledby="hero-title">
            <p className="app-eyebrow">FAIR · SIMPLE · EXCITING</p>
            <h1
              id="hero-title"
              aria-label="두근두근, 추첨을 시작합니다"
            >
              두근두근,
              <br />
              <span>추첨을 시작합니다</span>
            </h1>
            <p>
              이름도 숫자도, 원하는 대로 넣어보세요.
              <br />
              누가 뽑힐지는 마지막 순간까지 아무도 몰라요.
            </p>
            <div className="hero-balls" aria-hidden="true">
              <span>4</span>
              <span>12</span>
              <span>19</span>
              <span>27</span>
              <span>33</span>
              <span>41</span>
            </div>
          </section>
          <SetupPanel
            rawInput={rawInput}
            nameCount={parsedNames.names.length}
            errors={parsedNames.errors}
            mode={mode}
            drawCountMode={drawCountMode}
            customDrawCount={customDrawCount}
            drawCountErrors={drawCountValidation.errors}
            soundEnabled={soundEnabled}
            onRawInputChange={handleRawInputChange}
            onModeChange={setMode}
            onDrawCountModeChange={setDrawCountMode}
            onCustomDrawCountChange={setCustomDrawCount}
            onSoundToggle={handleSoundToggle}
            onClear={handleClear}
            onStart={handleStart}
          />
        </div>
      ) : (
        <div className="draw-page">
          <div className="draw-page-heading">
            <div>
              <p className="section-kicker">
                {session.mode === "manual" ? "MANUAL DRAW" : "AUTO DRAW"}
              </p>
              <h1>
                {session.phase === "completed"
                  ? "추첨이 완료됐어요"
                  : session.phase === "error"
                    ? "추첨을 계속할 수 없어요"
                    : "두근두근, 추첨을 시작합니다"}
              </h1>
            </div>
            <span className={`phase-pill phase-pill--${session.phase}`}>
              {session.phase === "completed"
                ? "추첨 완료"
                : session.phase === "error"
                  ? "오류"
                  : session.mode === "auto"
                    ? "자동 진행 중"
                    : session.phase === "mixing"
                      ? "섞는 중"
                      : "준비 완료"}
            </span>
          </div>

          <div className="draw-layout">
            <section className="machine-card">
              <LotteryMachine
                balls={remainingBalls}
                isMixing={shouldMixMachine(session)}
                isSettling={
                  session.phase === "completed" && remainingBalls.length > 0
                }
                visualBall={
                  session.balls.find(
                    (ball) => ball.id === visualResult?.ballId,
                  ) ?? null
                }
                onError={handleCanvasError}
              />
              <DrawControls
                session={session}
                onManualDraw={handleManualDraw}
                onReset={handleReset}
              />
            </section>
            <ResultList
              results={session.results}
              totalCount={session.drawCount}
              candidateCount={session.balls.length}
              completed={session.phase === "completed"}
              onCopy={handleCopy}
            />
          </div>
        </div>
      )}

      <footer className="app-footer">
        모든 이름은 이 브라우저 안에서만 처리됩니다.
      </footer>
    </main>
  );
}

export default App;
