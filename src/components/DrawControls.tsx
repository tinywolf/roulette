import { useCallback, useEffect, useRef, useState } from "react";
import type { DrawSession } from "../domain/types";

type DrawControlsProps = {
  session: DrawSession;
  onManualDraw: () => void;
  onRedraw: () => void;
  onReset: () => void;
};

export function DrawControls({
  session,
  onManualDraw,
  onRedraw,
  onReset,
}: DrawControlsProps) {
  const isManual = session.mode === "manual";
  const isCompleted = session.phase === "completed";
  const isError = session.phase === "error";
  const [isConfirmingRedraw, setIsConfirmingRedraw] = useState(false);
  const cancelRedrawRef = useRef<HTMLButtonElement>(null);

  const requestRedraw = useCallback(() => {
    if (isConfirmingRedraw) {
      return;
    }

    if (isCompleted || isError) {
      onRedraw();
      return;
    }

    setIsConfirmingRedraw(true);
  }, [isCompleted, isConfirmingRedraw, isError, onRedraw]);

  const confirmRedraw = () => {
    setIsConfirmingRedraw(false);
    onRedraw();
  };

  const cancelRedraw = useCallback(() => {
    setIsConfirmingRedraw(false);
  }, []);

  useEffect(() => {
    if (isConfirmingRedraw) {
      cancelRedrawRef.current?.focus();
    }
  }, [isConfirmingRedraw]);

  useEffect(() => {
    const handleRedrawShortcut = (event: KeyboardEvent) => {
      if (event.code === "Escape" && isConfirmingRedraw) {
        event.preventDefault();
        cancelRedraw();
        return;
      }

      if (
        event.code !== "KeyR" ||
        isConfirmingRedraw ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }

      const target = event.target;
      if (
        target instanceof Element &&
        target.closest(
          "input, textarea, select, [contenteditable='true']",
        )
      ) {
        return;
      }

      event.preventDefault();
      requestRedraw();
    };

    window.addEventListener("keydown", handleRedrawShortcut);

    return () => {
      window.removeEventListener("keydown", handleRedrawShortcut);
    };
  }, [cancelRedraw, isConfirmingRedraw, requestRedraw]);

  return (
    <div className="draw-controls">
      {isConfirmingRedraw ? (
        <div
          className="redraw-confirmation"
          role="alertdialog"
          aria-labelledby="redraw-confirmation-title"
          aria-describedby="redraw-confirmation-description"
        >
          <div className="redraw-confirmation__copy">
            <strong id="redraw-confirmation-title">
              추첨을 다시 시작할까요?
            </strong>
            <span id="redraw-confirmation-description">
              {session.results.length > 0
                ? `지금까지 뽑은 ${session.results.length}개의 결과가 모두 사라져요.`
                : "진행 중인 추첨을 취소하고 처음부터 다시 시작해요."}
            </span>
          </div>
          <div className="redraw-confirmation__actions">
            <button
              ref={cancelRedrawRef}
              className="button button--restart"
              type="button"
              onClick={cancelRedraw}
            >
              계속 추첨
            </button>
            <button
              className="button button--redraw-confirm"
              type="button"
              onClick={confirmRedraw}
            >
              재추첨하기
            </button>
          </div>
        </div>
      ) : (
        <>
          {isManual && !isCompleted && !isError ? (
            <button
              className="button button--draw"
              type="button"
              onClick={onManualDraw}
              disabled={session.phase !== "ready"}
              aria-keyshortcuts="Space"
            >
              <span aria-hidden="true">
                {session.phase === "mixing" ? "◌" : "●"}
              </span>
              {session.phase === "mixing"
                ? "공을 섞는 중…"
                : "다음 공 뽑기"}
              <kbd className="shortcut-key" aria-hidden="true">
                Space
              </kbd>
            </button>
          ) : null}

          <button
            className="button button--redraw"
            type="button"
            onClick={requestRedraw}
            aria-keyshortcuts="R"
          >
            <span aria-hidden="true">↻</span>
            재추첨
            <kbd className="shortcut-key" aria-hidden="true">
              R
            </kbd>
          </button>

          <button
            className="button button--restart"
            type="button"
            onClick={onReset}
          >
            처음부터 다시
          </button>
        </>
      )}
    </div>
  );
}
