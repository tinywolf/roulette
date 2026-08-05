type SoundToggleProps = {
  enabled: boolean;
  onToggle: () => void;
};

export function SoundToggle({ enabled, onToggle }: SoundToggleProps) {
  return (
    <button
      className="sound-toggle"
      type="button"
      aria-pressed={enabled}
      onClick={onToggle}
    >
      <span aria-hidden="true">{enabled ? "🔊" : "🔇"}</span>
      <span>{enabled ? "효과음 켜짐" : "효과음 꺼짐"}</span>
    </button>
  );
}
