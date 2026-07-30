import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DrawControls } from "./components/DrawControls";
import { LotteryMachine } from "./components/LotteryMachine";
import { RenderModeToggle } from "./components/RenderModeToggle";
import { ResultList } from "./components/ResultList";
import { SetupPanel } from "./components/SetupPanel";
import { SoundToggle } from "./components/SoundToggle";
import {
  beginManualDraw,
  completeManualDraw,
  createDrawSession,
  formatResults,
  reconcileScheduledDraws,
  redrawSession,
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
  type RenderMode,
} from "./domain/types";
import {
  clearRawInput,
  loadRawInput,
  saveRawInput,
} from "./services/nameStorage";
import {
  loadSetupOptions,
  saveSetupOptions,
} from "./services/setupOptionsStorage";
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
  const [initialNameStorage] = useState(() => loadRawInput());
  const [initialOptionsStorage] = useState(() => loadSetupOptions());
  const initialWarning =
    initialNameStorage.warning ?? initialOptionsStorage.warning;
  const [rawInput, setRawInput] = useState(initialNameStorage.value);
  const [mode, setMode] = useState<DrawMode>(
    initialOptionsStorage.value.mode,
  );
  const [drawCountMode, setDrawCountMode] =
    useState<DrawCountMode>(initialOptionsStorage.value.drawCountMode);
  const [customDrawCount, setCustomDrawCount] = useState(
    initialOptionsStorage.value.customDrawCount,
  );
  const [session, setSession] = useState<DrawSession | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(
    initialOptionsStorage.value.soundEnabled,
  );
  const [renderMode, setRenderMode] = useState<RenderMode>(
    initialOptionsStorage.value.renderMode,
  );
  const [notice, setNotice] = useState<Notice | null>(() =>
    initialWarning
      ? { type: "warning", text: initialWarning }
      : null,
  );
  const [visualResult, setVisualResult] = useState<DrawResult | null>(null);
  const previousResultCount = useRef(0);
  const hasMountedSetupOptions = useRef(false);
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
  }, [session?.balls, session?.remainingBallIds]);
  const isMachineMixing = session ? shouldMixMachine(session) : false;

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
      soundController.current?.stopMixing();
      setNotice({ type: "error", text: nextSession.error });
    } else {
      void soundController.current?.startMixing(nextSession.balls.length);
      setNotice(null);
    }
  };

  const handleManualDraw = useCallback(() => {
    setSession((current) =>
      current ? beginManualDraw(current) : current,
    );
  }, []);

  useEffect(() => {
    if (
      !session ||
      session.mode !== "manual" ||
      session.phase !== "ready"
    ) {
      return undefined;
    }

    const handleManualDrawShortcut = (event: KeyboardEvent) => {
      if (
        event.code !== "Space" ||
        event.repeat ||
        event.isComposing
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "button, input, textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }

      event.preventDefault();
      handleManualDraw();
    };

    window.addEventListener("keydown", handleManualDrawShortcut);

    return () => {
      window.removeEventListener("keydown", handleManualDrawShortcut);
    };
  }, [handleManualDraw, session]);

  const handleReset = () => {
    soundController.current?.stopMixing();
    setSession(resetDrawSession());
    setVisualResult(null);
    previousResultCount.current = 0;
    setNotice(null);
  };

  const handleRedraw = useCallback(() => {
    if (!session) {
      return;
    }

    const nextSession = redrawSession(session, Date.now());
    previousResultCount.current = 0;
    setVisualResult(null);
    setSession(nextSession);
    setNotice(
      nextSession.error
        ? { type: "error", text: nextSession.error }
        : null,
    );
  }, [session]);

  const handleSoundToggle = () => {
    setSoundEnabled((enabled) => {
      const nextEnabled = !enabled;
      soundController.current?.setEnabled(nextEnabled);

      if (nextEnabled) {
        void soundController.current?.play("draw");
        if (isMachineMixing) {
          void soundController.current?.startMixing(remainingBalls.length);
        }
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
    if (soundEnabled && isMachineMixing) {
      void soundController.current?.startMixing(remainingBalls.length);
    } else {
      soundController.current?.stopMixing();
    }
  }, [isMachineMixing, remainingBalls.length, soundEnabled]);

  useEffect(() => {
    // 복원 직후에는 같은 값을 다시 쓰지 않고 사용자가 옵션을 바꾼 뒤부터 저장한다.
    if (!hasMountedSetupOptions.current) {
      hasMountedSetupOptions.current = true;
      return;
    }

    const result = saveSetupOptions({
      mode,
      drawCountMode,
      customDrawCount,
      soundEnabled,
      renderMode,
    });

    if (result.warning) {
      setNotice({ type: "warning", text: result.warning });
    }
  }, [customDrawCount, drawCountMode, mode, renderMode, soundEnabled]);

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
          <div className="utility-controls">
            <RenderModeToggle
              mode={renderMode}
              onChange={setRenderMode}
            />
            <SoundToggle enabled={soundEnabled} onToggle={handleSoundToggle} />
          </div>
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
            renderMode={renderMode}
            onRawInputChange={handleRawInputChange}
            onModeChange={setMode}
            onDrawCountModeChange={setDrawCountMode}
            onCustomDrawCountChange={setCustomDrawCount}
            onSoundToggle={handleSoundToggle}
            onRenderModeChange={setRenderMode}
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
                allBalls={session.balls}
                renderMode={renderMode}
                isMixing={isMachineMixing}
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
                onRedraw={handleRedraw}
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
        <span>입력한 내용과 설정은 이 브라우저에서만 저장하고 처리해요.</span>
        <span>
          © 2026 로또 추첨기 ·{" "}
          <a
            href="https://github.com/tinywolf/roulette"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </span>
      </footer>
    </main>
  );
}

export default App;
