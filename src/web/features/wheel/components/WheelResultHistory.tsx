import { useRef, useState, type CSSProperties } from "react";
import type { WheelCandidate, WheelOutcome } from "../domain/wheelSession";
import { downloadWheelResultImage } from "../services/wheelResultImage";
import { getWheelSegmentColor } from "./wheelPalette";

type WheelResultHistoryProps = {
  candidates: WheelCandidate[];
  outcomes: WheelOutcome[];
  isSpinning: boolean;
  actionMessage: string | null;
  onCopy: () => void;
  onImageSaveResult: (succeeded: boolean) => void;
};

export function formatWheelOutcomes(outcomes: WheelOutcome[]): string {
  return outcomes
    .map((outcome) => `${outcome.spinNumber}. ${outcome.name}`)
    .join("\n");
}

/** 반복 후보도 고유 outcome ID로 모두 보존하는 돌림판 결과 이력이다. */
export function WheelResultHistory({
  candidates,
  outcomes,
  isSpinning,
  actionMessage,
  onCopy,
  onImageSaveResult,
}: WheelResultHistoryProps) {
  const cardRef = useRef<HTMLElement>(null);
  const [isSavingImage, setIsSavingImage] = useState(false);
  const latestOutcome = outcomes.at(-1);
  const candidateColorById = new Map(
    candidates.map((candidate, index) => [
      candidate.id,
      getWheelSegmentColor(index),
    ]),
  );

  const handleImageSave = async () => {
    if (
      !cardRef.current ||
      outcomes.length === 0 ||
      isSpinning ||
      isSavingImage
    ) {
      return;
    }

    setIsSavingImage(true);

    try {
      await downloadWheelResultImage(cardRef.current);
      onImageSaveResult(true);
    } catch {
      onImageSaveResult(false);
    } finally {
      setIsSavingImage(false);
    }
  };

  return (
    <section
      className="wheel-panel wheel-results"
      aria-labelledby="wheel-results-title"
      ref={cardRef}
    >
      <div className="wheel-section-heading">
        <div>
          <p className="wheel-eyebrow">RESULT HISTORY</p>
          <h2 id="wheel-results-title">당첨 결과</h2>
        </div>
        <span>{outcomes.length}회</span>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {latestOutcome
          ? `${latestOutcome.spinNumber}번째 당첨 결과는 ${latestOutcome.name}입니다.`
          : ""}
      </p>

      {outcomes.length === 0 ? (
        <p className="wheel-results__empty">
          돌림판을 돌리면 당첨 결과가 순서대로 쌓입니다.
        </p>
      ) : (
        <ol className="wheel-results__list">
          {outcomes.map((outcome, index) => (
            <li
              key={outcome.id}
              className={
                index === outcomes.length - 1
                  ? "wheel-results__item wheel-results__item--latest"
                  : "wheel-results__item"
              }
              style={
                {
                  "--wheel-result-color": candidateColorById.get(
                    outcome.candidateId,
                  ),
                } as CSSProperties
              }
            >
              <span>{outcome.spinNumber}</span>
              <strong>{outcome.name}</strong>
              {index === outcomes.length - 1 ? <em>NEW</em> : null}
            </li>
          ))}
        </ol>
      )}

      <div className="wheel-results__actions">
        <button
          type="button"
          className="wheel-button wheel-button--copy"
          disabled={outcomes.length === 0}
          onClick={onCopy}
        >
          결과 복사
        </button>
        <button
          type="button"
          className="wheel-button wheel-button--image-save"
          disabled={outcomes.length === 0 || isSpinning || isSavingImage}
          aria-busy={isSavingImage}
          onClick={() => void handleImageSave()}
        >
          {isSavingImage ? "이미지 만드는 중…" : "이미지 저장"}
        </button>
      </div>
      {actionMessage ? (
        <p className="wheel-action-message" role="status">
          {actionMessage}
        </p>
      ) : null}
    </section>
  );
}
