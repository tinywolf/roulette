import type { DrawCountMode, DrawMode } from "../domain/types";
import { MAX_BALLS } from "../domain/names";
import { SoundToggle } from "./SoundToggle";

type SetupPanelProps = {
  rawInput: string;
  nameCount: number;
  errors: string[];
  mode: DrawMode;
  drawCountMode: DrawCountMode;
  customDrawCount: string;
  drawCountErrors: string[];
  soundEnabled: boolean;
  onRawInputChange: (value: string) => void;
  onModeChange: (mode: DrawMode) => void;
  onDrawCountModeChange: (mode: DrawCountMode) => void;
  onCustomDrawCountChange: (value: string) => void;
  onSoundToggle: () => void;
  onClear: () => void;
  onStart: () => void;
};

export function SetupPanel({
  rawInput,
  nameCount,
  errors,
  mode,
  drawCountMode,
  customDrawCount,
  drawCountErrors,
  soundEnabled,
  onRawInputChange,
  onModeChange,
  onDrawCountModeChange,
  onCustomDrawCountChange,
  onSoundToggle,
  onClear,
  onStart,
}: SetupPanelProps) {
  const isValid = errors.length === 0 && drawCountErrors.length === 0;

  return (
    <section className="setup-card" aria-labelledby="setup-title">
      <div className="setup-heading">
        <div>
          <p className="section-kicker">DRAW SETUP</p>
          <h2 id="setup-title">어떤 공을 넣어볼까요?</h2>
        </div>
        <SoundToggle enabled={soundEnabled} onToggle={onSoundToggle} />
      </div>

      <div className="input-group">
        <div className="input-label-row">
          <label htmlFor="names-input">공 이름</label>
          <span
            className={
              nameCount > MAX_BALLS
                ? "count-badge count-badge--error"
                : "count-badge"
            }
          >
            {nameCount} / {MAX_BALLS}
          </span>
        </div>
        <textarea
          id="names-input"
          value={rawInput}
          onChange={(event) => onRawInputChange(event.target.value)}
          placeholder={"민지, 준호, 7\n서연*2, 12*3\n또는 1~45"}
          rows={7}
          aria-describedby={
            errors.length > 0 ? "input-errors input-help" : "input-help"
          }
          aria-invalid={errors.length > 0}
        />
        {errors.length > 0 ? (
          <ul className="input-errors" id="input-errors">
            {errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}
        <div className="input-help input-guide" id="input-help">
          <strong>입력 예시</strong>
          <ul>
            <li>
              목록: <code>민지, 준호, 7</code> (콤마 또는 줄바꿈)
            </li>
            <li>
              반복: <code>민지*2, 7*3</code>
            </li>
            <li>
              숫자 범위: <code>1~45</code> (단독 입력)
            </li>
          </ul>
        </div>
      </div>

      <fieldset className="mode-fieldset draw-count-fieldset">
        <legend>추첨 개수</legend>
        <div className="mode-grid">
          <label
            className={
              drawCountMode === "all"
                ? "mode-option is-selected"
                : "mode-option"
            }
          >
            <input
              type="radio"
              name="draw-count-mode"
              value="all"
              checked={drawCountMode === "all"}
              onChange={() => onDrawCountModeChange("all")}
            />
            <span className="mode-icon" aria-hidden="true">
              ◎
            </span>
            <span>
              <strong>전체 추첨</strong>
              <small>{nameCount}개 모두 순서대로</small>
            </span>
          </label>
          <label
            className={
              drawCountMode === "custom"
                ? "mode-option is-selected"
                : "mode-option"
            }
          >
            <input
              type="radio"
              name="draw-count-mode"
              value="custom"
              checked={drawCountMode === "custom"}
              onChange={() => onDrawCountModeChange("custom")}
            />
            <span className="mode-icon" aria-hidden="true">
              #
            </span>
            <span>
              <strong>일부만 추첨</strong>
              <small>원하는 개수만 뽑기</small>
            </span>
          </label>
        </div>

        {drawCountMode === "custom" ? (
          <div className="draw-count-input">
            <label htmlFor="draw-count-input">뽑을 공 개수</label>
            <input
              id="draw-count-input"
              type="number"
              min="1"
              max={Math.max(1, nameCount)}
              step="1"
              inputMode="numeric"
              value={customDrawCount}
              onChange={(event) =>
                onCustomDrawCountChange(event.target.value)
              }
              aria-describedby={
                drawCountErrors.length > 0
                  ? "draw-count-errors"
                  : "draw-count-help"
              }
              aria-invalid={drawCountErrors.length > 0}
            />
            {drawCountErrors.length > 0 ? (
              <ul className="input-errors" id="draw-count-errors">
                {drawCountErrors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            ) : (
              <p className="input-help" id="draw-count-help">
                입력한 {nameCount}개 중 몇 개를 뽑을지 정하세요.
              </p>
            )}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="mode-fieldset">
        <legend>진행 방식</legend>
        <div className="mode-grid">
          <label className={mode === "manual" ? "mode-option is-selected" : "mode-option"}>
            <input
              type="radio"
              name="draw-mode"
              value="manual"
              checked={mode === "manual"}
              onChange={() => onModeChange("manual")}
            />
            <span className="mode-icon" aria-hidden="true">
              👆
            </span>
            <span>
              <strong>직접 뽑기</strong>
              <small>버튼을 눌러 한 공씩</small>
            </span>
          </label>
          <label className={mode === "auto" ? "mode-option is-selected" : "mode-option"}>
            <input
              type="radio"
              name="draw-mode"
              value="auto"
              checked={mode === "auto"}
              onChange={() => onModeChange("auto")}
            />
            <span className="mode-icon" aria-hidden="true">
              ✨
            </span>
            <span>
              <strong>자동 추첨</strong>
              <small>예고 없이 끝까지</small>
            </span>
          </label>
        </div>
      </fieldset>

      <div className="setup-actions">
        <button
          className="button button--ghost"
          type="button"
          onClick={onClear}
          disabled={rawInput.length === 0}
        >
          모두 지우기
        </button>
        <button
          className="button button--primary"
          type="button"
          onClick={onStart}
          disabled={!isValid}
        >
          추첨 시작
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  );
}
