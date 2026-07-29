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

  return (
    <div className="draw-controls">
      {isManual && !isCompleted && !isError ? (
        <button
          className="button button--draw"
          type="button"
          onClick={onManualDraw}
          disabled={session.phase !== "ready"}
          aria-keyshortcuts="Space"
        >
          <span aria-hidden="true">{session.phase === "mixing" ? "◌" : "●"}</span>
          {session.phase === "mixing" ? "공을 섞는 중…" : "다음 공 뽑기"}
          <kbd className="shortcut-key" aria-hidden="true">
            Space
          </kbd>
        </button>
      ) : null}

      <button
        className="button button--redraw"
        type="button"
        onClick={onRedraw}
      >
        <span aria-hidden="true">↻</span>
        재추첨
      </button>

      <button className="button button--restart" type="button" onClick={onReset}>
        처음부터 다시
      </button>
    </div>
  );
}
