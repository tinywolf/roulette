import type { ParsedWheelInput } from "../domain/wheelSetup";

type WheelSetupProps = {
  rawInput: string;
  parsedInput: ParsedWheelInput;
  soundEnabled: boolean;
  warning: string | null;
  onRawInputChange: (value: string) => void;
  onClearInput: () => void;
  onSoundToggle: () => void;
  onStart: () => void;
};

/** 돌림판 후보 입력과 기능 전용 효과음 설정을 받는 시작 화면이다. */
export function WheelSetup({
  rawInput,
  parsedInput,
  soundEnabled,
  warning,
  onRawInputChange,
  onClearInput,
  onSoundToggle,
  onStart,
}: WheelSetupProps) {
  const canStart = parsedInput.errors.length === 0;

  return (
    <main className="wheel-app wheel-setup">
      <header className="wheel-hero">
        <p className="wheel-eyebrow">WHEEL DRAW</p>
        <h1>돌림판 추첨기</h1>
        <p>
          같은 후보가 다시 나올 수 있어요. 이름이나 숫자를 넣고 필요한
          만큼 돌려보세요.
        </p>
      </header>

      <section className="wheel-panel wheel-setup__panel" aria-label="돌림판 설정">
        <div className="wheel-field__heading">
          <label htmlFor="wheel-candidates">돌림판 후보</label>
          <span>{parsedInput.names.length} / 45</span>
        </div>
        <textarea
          id="wheel-candidates"
          value={rawInput}
          rows={8}
          placeholder={"민지, 준호, 서연\n또는 1~10, 민지*2"}
          aria-describedby="wheel-input-guide wheel-input-errors"
          onChange={(event) => onRawInputChange(event.target.value)}
        />
        <p id="wheel-input-guide" className="wheel-field__guide">
          쉼표·줄바꿈으로 구분하고, 반복은 이름*2, 숫자 범위는 1~10처럼
          입력하세요. 후보는 2~45개까지 사용할 수 있습니다.
        </p>
        <div id="wheel-input-errors" className="wheel-field__errors">
          {parsedInput.errors.map((error) => (
            <p key={error} role="alert">
              {error}
            </p>
          ))}
        </div>

        <div className="wheel-setup__actions">
          <button type="button" className="wheel-button wheel-button--ghost" onClick={onClearInput}>
            입력 비우기
          </button>
          <button
            type="button"
            className="wheel-button wheel-button--ghost"
            aria-pressed={soundEnabled}
            onClick={onSoundToggle}
          >
            효과음 {soundEnabled ? "켜짐" : "꺼짐"}
          </button>
          <button
            type="button"
            className="wheel-button wheel-button--primary"
            disabled={!canStart}
            onClick={onStart}
          >
            돌림판 시작
          </button>
        </div>
        {warning ? (
          <p className="wheel-warning" role="status">
            {warning}
          </p>
        ) : null}
      </section>
    </main>
  );
}
