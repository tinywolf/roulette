type WheelControlsProps = {
  isSpinning: boolean;
  soundEnabled: boolean;
  onSpin: () => void;
  onReset: () => void;
  onSoundToggle: () => void;
};

/** 반복 회전, 설정 복귀와 효과음 수명주기를 조작하는 돌림판 제어부다. */
export function WheelControls({
  isSpinning,
  soundEnabled,
  onSpin,
  onReset,
  onSoundToggle,
}: WheelControlsProps) {
  return (
    <div className="wheel-controls">
      <button
        type="button"
        className="wheel-button wheel-button--spin"
        disabled={isSpinning}
        onClick={onSpin}
      >
        {isSpinning ? "회전 중…" : "돌림판 회전"}
      </button>
      <div className="wheel-controls__secondary">
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
          className="wheel-button wheel-button--ghost"
          onClick={onReset}
        >
          처음부터 다시
        </button>
      </div>
    </div>
  );
}
