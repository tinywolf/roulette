import { useEffect } from "react";

type WheelControlsProps = {
  isSpinning: boolean;
  canRedraw: boolean;
  onSpin: () => void;
  onRedraw: () => void;
  onReset: () => void;
};

/** 반복 회전과 설정 복귀를 로또 추첨기와 같은 조작 계층으로 제공한다. */
export function WheelControls({
  isSpinning,
  canRedraw,
  onSpin,
  onRedraw,
  onReset,
}: WheelControlsProps) {
  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if (
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

      if (event.code === "Space") {
        if (
          isSpinning ||
          (target instanceof Element &&
            target.closest(
              "button, input, textarea, select, [contenteditable='true']",
            ))
        ) {
          return;
        }

        event.preventDefault();
        onSpin();
        return;
      }

      if (
        event.code !== "KeyR" ||
        isSpinning ||
        !canRedraw ||
        (target instanceof Element &&
          target.closest("input, textarea, select, [contenteditable='true']"))
      ) {
        return;
      }

      event.preventDefault();
      onRedraw();
    };

    window.addEventListener("keydown", handleShortcut);
    return () => window.removeEventListener("keydown", handleShortcut);
  }, [canRedraw, isSpinning, onRedraw, onSpin]);

  return (
    <div className="wheel-controls">
      <button
        type="button"
        className="wheel-button wheel-button--spin"
        disabled={isSpinning}
        onClick={onSpin}
        aria-keyshortcuts="Space"
      >
        <span aria-hidden="true">{isSpinning ? "◌" : "●"}</span>
        {isSpinning ? "회전 중…" : "돌림판 회전"}
        <kbd className="wheel-shortcut-key" aria-hidden="true">
          Space
        </kbd>
      </button>
      <button
        type="button"
        className="wheel-button wheel-button--redraw"
        disabled={isSpinning || !canRedraw}
        onClick={onRedraw}
        aria-keyshortcuts="R"
      >
        <span aria-hidden="true">↻</span>
        재추첨
        <kbd className="wheel-shortcut-key" aria-hidden="true">
          R
        </kbd>
      </button>
      <button
        type="button"
        className="wheel-button wheel-button--restart"
        onClick={onReset}
      >
        처음부터 다시
      </button>
    </div>
  );
}
