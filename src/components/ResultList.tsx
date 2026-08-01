import type { CSSProperties } from "react";
import type { Ball, DrawResult } from "../domain/types";

type ResultListProps = {
  results: DrawResult[];
  balls: Ball[];
  totalCount: number;
  candidateCount: number;
  completed: boolean;
  onCopy: () => void;
};

/** 추첨 순서와 실제 공의 색상을 함께 보여주는 결과 목록이다. */
export function ResultList({
  results,
  balls,
  totalCount,
  candidateCount,
  completed,
  onCopy,
}: ResultListProps) {
  const ballColorById = new Map(balls.map((ball) => [ball.id, ball.color]));

  return (
    <section className="results-card" aria-labelledby="results-title">
      <div className="results-heading">
        <div>
          <p className="section-kicker">DRAW ORDER</p>
          <h2 id="results-title">{completed ? "추첨 완료!" : "추첨 결과"}</h2>
        </div>
        <span className="result-count">
          {results.length} / {totalCount}
        </span>
      </div>

      {results.length === 0 ? (
        <div className="results-empty">
          <span aria-hidden="true">○</span>
          <p>첫 번째 공을 기다리고 있어요.</p>
        </div>
      ) : (
        <ol className="result-list">
          {results.map((result) => (
            <li
              key={result.ballId}
              className="result-item"
              style={
                {
                  "--result-color": ballColorById.get(result.ballId),
                } as CSSProperties
              }
            >
              <span className="result-order">{result.order}</span>
              <span className="result-name">{result.name}</span>
              {result.order === results.length && !completed ? (
                <span className="result-latest">NEW</span>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {completed ? (
        <div className="completion-banner">
          <span aria-hidden="true">🎉</span>
          <p>
            {totalCount === candidateCount
              ? "모든 공을 빠짐없이 뽑았어요."
              : `선택한 ${totalCount}개의 공을 모두 뽑았어요.`}
          </p>
        </div>
      ) : null}

      <button
        className="button button--copy"
        type="button"
        onClick={onCopy}
        disabled={results.length === 0}
      >
        결과 복사
      </button>
    </section>
  );
}
