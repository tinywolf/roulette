import type { DrawSession } from "../domain/types";

type DrawControlsProps = {
  session: DrawSession;
  onManualDraw: () => void;
  onReset: () => void;
};

export function DrawControls({
  session,
  onManualDraw,
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
        >
          <span aria-hidden="true">{session.phase === "mixing" ? "◌" : "●"}</span>
          {session.phase === "mixing" ? "공을 섞는 중…" : "다음 공 뽑기"}
        </button>
      ) : null}

      {!isManual && !isCompleted && !isError ? (
        <div className="auto-status" role="status">
          <span className="auto-status-dot" aria-hidden="true" />
          공이 언제 나올지 집중해 보세요
        </div>
      ) : null}

      <button className="button button--restart" type="button" onClick={onReset}>
        처음부터 다시
      </button>
    </div>
  );
}
