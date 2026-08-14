type WheelSoundToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

/** 로또 추첨기와 같은 표현으로 돌림판 효과음 상태를 제어한다. */
export function WheelSoundToggle({
  enabled,
  onToggle,
}: WheelSoundToggleProps) {
  return (
    <button
      className="wheel-sound-toggle"
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
    >
      <span aria-hidden="true">{enabled ? "🔊" : "🔇"}</span>
      <span>{enabled ? "효과음 켜짐" : "효과음 꺼짐"}</span>
    </button>
  );
}
