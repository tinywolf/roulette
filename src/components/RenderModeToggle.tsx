import type { RenderMode } from "../domain/types";

type RenderModeToggleProps = {
  mode: RenderMode;
  onChange: (mode: RenderMode) => void;
};

/**
 * 설정과 추첨 화면에서 동일한 2D·3D 렌더링 선택 UI를 제공한다.
 * 이 선택은 추첨 상태와 무관한 보기 옵션으로만 동작한다.
 */
export function RenderModeToggle({
  mode,
  onChange,
}: RenderModeToggleProps) {
  return (
    <div
      className="render-mode-toggle"
      role="group"
      aria-label="추첨기 렌더링"
    >
      <button
        type="button"
        aria-pressed={mode === "2d"}
        onClick={() => onChange("2d")}
      >
        2D
      </button>
      <button
        type="button"
        aria-pressed={mode === "3d"}
        onClick={() => onChange("3d")}
      >
        3D
      </button>
    </div>
  );
}
