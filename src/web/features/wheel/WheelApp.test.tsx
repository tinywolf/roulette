import {
  act,
  fireEvent,
  render,
  screen,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RandomValuesSource } from "../../../core/random";
import { WheelApp } from "./WheelApp";
import {
  MAXIMUM_SPIN_DURATION_MS,
  MINIMUM_SPIN_DURATION_MS,
} from "./components/WheelStage";
import {
  WHEEL_CANDIDATES_STORAGE_KEY,
  WHEEL_OPTIONS_STORAGE_KEY,
} from "./services/wheelStorage";

const { downloadWheelResultImage } = vi.hoisted(() => ({
  downloadWheelResultImage: vi.fn(),
}));

vi.mock("./services/wheelResultImage", () => ({ downloadWheelResultImage }));

function fixedRandom(value: number): RandomValuesSource {
  return (values) => {
    values[0] = value;
  };
}

function soundService() {
  return {
    setEnabled: vi.fn(),
    startSpin: vi.fn(),
    playWinner: vi.fn(),
    stopSpin: vi.fn(),
    dispose: vi.fn(),
  };
}

function startWheel() {
  fireEvent.change(screen.getByLabelText("돌림판 후보"), {
    target: { value: "민지, 준호" },
  });
  fireEvent.click(screen.getByRole("button", { name: "돌림판 시작" }));
}

describe("WheelApp", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    downloadWheelResultImage.mockReset();
    downloadWheelResultImage.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("유효한 후보만 저장해 돌림판 세션을 시작한다", () => {
    const { container } = render(
      <WheelApp randomValues={fixedRandom(0)} />,
    );
    const startButton = screen.getByRole("button", { name: "돌림판 시작" });

    expect(startButton).toBeDisabled();
    fireEvent.change(screen.getByLabelText("돌림판 후보"), {
      target: { value: "민지*0, 준호" },
    });
    expect(startButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText("돌림판 후보"), {
      target: { value: "민지, 민지, 준호" },
    });
    expect(startButton).toBeEnabled();
    expect(localStorage.getItem(WHEEL_CANDIDATES_STORAGE_KEY)).toContain(
      "민지, 민지, 준호",
    );

    fireEvent.click(startButton);
    expect(
      screen.getByRole("img", { name: /후보 3개의 돌림판/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "전체 후보" }))
      .toBeInTheDocument();
    const drawLayout = container.querySelector(".wheel-draw__layout");
    expect(drawLayout?.children[1]).toHaveClass("wheel-results");
    expect(drawLayout?.children[2]).toHaveClass("wheel-candidates");
  });

  it("동일 기능 버튼을 로또 추첨기와 같은 위치와 시각 계층으로 배치한다", () => {
    render(<WheelApp randomValues={fixedRandom(0)} />);

    const setupSoundToggle = screen.getByRole("button", {
      name: "효과음 꺼짐",
    });
    const clearInputButton = screen.getByRole("button", {
      name: "입력 비우기",
    });
    const startButton = screen.getByRole("button", { name: "돌림판 시작" });

    expect(setupSoundToggle).toHaveClass("wheel-sound-toggle");
    expect(setupSoundToggle.closest(".wheel-setup__heading")).not.toBeNull();
    expect(clearInputButton).toHaveClass("wheel-input-clear-button");
    expect(clearInputButton.closest(".wheel-input-guide-row")).not.toBeNull();
    expect(startButton).toHaveClass("wheel-button--primary");
    expect(startButton.closest(".wheel-setup__actions")).not.toBeNull();

    startWheel();

    const drawSoundToggle = screen.getByRole("button", {
      name: "효과음 꺼짐",
    });
    const spinButton = screen.getByRole("button", { name: "돌림판 회전" });
    const restartButton = screen.getByRole("button", {
      name: "처음부터 다시",
    });
    const redrawButton = screen.getByRole("button", { name: "재추첨" });
    const copyButton = screen.getByRole("button", { name: "결과 복사" });
    const imageSaveButton = screen.getByRole("button", {
      name: "이미지 저장",
    });

    expect(drawSoundToggle.closest(".wheel-draw__utility")).not.toBeNull();
    expect(spinButton.closest(".wheel-controls")).not.toBeNull();
    expect(spinButton).toHaveAttribute("aria-keyshortcuts", "Space");
    expect(redrawButton).toHaveClass("wheel-button--redraw");
    expect(redrawButton).toHaveAttribute("aria-keyshortcuts", "R");
    expect(redrawButton.closest(".wheel-controls")).not.toBeNull();
    expect(restartButton).toHaveClass("wheel-button--restart");
    expect(restartButton.closest(".wheel-controls")).not.toBeNull();
    expect(copyButton).toHaveClass("wheel-button--copy");
    expect(imageSaveButton).toHaveClass("wheel-button--image-save");
    expect(imageSaveButton).toBeDisabled();
    expect(copyButton.parentElement).toBe(imageSaveButton.parentElement);
  });

  it("결과가 있어도 회전 중에는 이미지 저장을 비활성화한다", () => {
    render(<WheelApp randomValues={fixedRandom(0)} />);
    startWheel();
    fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));
    act(() => vi.advanceTimersByTime(MINIMUM_SPIN_DURATION_MS));

    const imageSaveButton = screen.getByRole("button", { name: "이미지 저장" });
    expect(imageSaveButton).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));
    expect(imageSaveButton).toBeDisabled();
  });

  it("Space로 회전하고 R로 결과 이력만 비워 재추첨을 준비한다", () => {
    render(<WheelApp randomValues={fixedRandom(0)} />);
    startWheel();

    const spinButton = screen.getByRole("button", { name: "돌림판 회전" });
    const redrawButton = screen.getByRole("button", { name: "재추첨" });

    expect(redrawButton).toBeDisabled();

    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
      repeat: true,
    });
    fireEvent.keyDown(window, {
      code: "Space",
      key: " ",
      ctrlKey: true,
    });
    fireEvent.keyDown(
      screen.getByRole("button", { name: "처음부터 다시" }),
      { code: "Space", key: " " },
    );
    expect(spinButton).toBeEnabled();

    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(screen.getByRole("button", { name: "회전 중…" })).toBeDisabled();

    fireEvent.keyDown(window, { code: "KeyR", key: "r" });
    act(() => vi.advanceTimersByTime(MINIMUM_SPIN_DURATION_MS));

    const results = screen.getByRole("region", { name: "당첨 결과" });
    expect(within(results).getAllByRole("listitem")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "재추첨" })).toBeEnabled();

    fireEvent.keyDown(window, {
      code: "KeyR",
      key: "r",
      repeat: true,
    });
    fireEvent.keyDown(window, {
      code: "KeyR",
      key: "r",
      metaKey: true,
    });
    expect(within(results).getAllByRole("listitem")).toHaveLength(1);

    fireEvent.keyDown(window, { code: "KeyR", key: "r" });
    expect(screen.getByText("0회")).toBeInTheDocument();
    expect(
      screen.getByText("재추첨할 준비가 되었습니다."),
    ).toBeInTheDocument();

    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(screen.getByRole("button", { name: "회전 중…" })).toBeDisabled();
  });

  it.each([
    {
      label: "약한 회전",
      randomValue: 0,
      expectedDuration: MINIMUM_SPIN_DURATION_MS,
      expectedRotation: 2_430,
    },
    {
      label: "강한 회전",
      randomValue: 1_400,
      expectedDuration: MAXIMUM_SPIN_DURATION_MS,
      expectedRotation: 3_870,
    },
  ])(
    "$label은 6~10바퀴와 3.8~5.2초 범위 안에서 함께 증가한다",
    ({ randomValue, expectedDuration, expectedRotation }) => {
      render(<WheelApp randomValues={fixedRandom(randomValue)} />);
      startWheel();
      fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));

      expect(screen.getByTestId("wheel-disc")).toHaveStyle({
        transform: `rotate(${expectedRotation}deg)`,
      });

      act(() => vi.advanceTimersByTime(expectedDuration - 1));
      expect(screen.getByText("0회")).toBeInTheDocument();
      act(() => vi.advanceTimersByTime(1));
      expect(screen.getByText("1회")).toBeInTheDocument();
    },
  );

  it("연출 난수만 실패하면 최소 프로필로 복구하고 당첨 난수는 별도로 처리한다", () => {
    let callCount = 0;
    const transientRandom: RandomValuesSource = (values) => {
      callCount += 1;

      if (callCount === 1) {
        throw new Error("motion random failure");
      }

      values[0] = 1;
    };

    render(<WheelApp randomValues={transientRandom} />);
    startWheel();
    fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));

    act(() => vi.advanceTimersByTime(MINIMUM_SPIN_DURATION_MS));
    const results = screen.getByRole("region", { name: "당첨 결과" });
    expect(within(results).getByText("준호")).toBeInTheDocument();
    expect(
      within(results).getByRole("listitem").style.getPropertyValue(
        "--wheel-result-color",
      ),
    ).toBe("#ffb84d");
  });

  it("같은 후보를 반복 당첨 결과로 한 번씩만 누적한다", () => {
    render(<WheelApp randomValues={fixedRandom(0)} />);
    startWheel();
    const spinButton = screen.getByRole("button", { name: "돌림판 회전" });

    fireEvent.click(spinButton);
    expect(screen.getByRole("button", { name: "회전 중…" })).toBeDisabled();
    expect(screen.getByText("0회")).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(4_000));
    const results = screen.getByRole("region", { name: "당첨 결과" });
    expect(within(results).getByText("민지")).toBeInTheDocument();
    expect(within(results).getByText("1회")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));
    act(() => vi.advanceTimersByTime(4_000));

    const resultItems = within(results).getAllByRole("listitem");
    expect(resultItems).toHaveLength(2);
    expect(within(resultItems[0]).getByText("1")).toBeInTheDocument();
    expect(within(resultItems[1]).getByText("2")).toBeInTheDocument();
    expect(within(resultItems[0]).getByText("민지")).toBeInTheDocument();
    expect(within(resultItems[1]).getByText("민지")).toBeInTheDocument();
    expect(
      resultItems[0].style.getPropertyValue("--wheel-result-color"),
    ).toBe("#ff6b68");
    expect(within(results).getByText("2회")).toBeInTheDocument();
  });

  it("결과를 순서 텍스트로 복사하고 결과 카드 이미지를 저장한다", async () => {
    const writeText = vi.fn(() => Promise.resolve());
    let finishImageSave: (() => void) | undefined;
    const originalClipboard = Object.getOwnPropertyDescriptor(
      navigator,
      "clipboard",
    );
    downloadWheelResultImage.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishImageSave = resolve;
        }),
    );
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    try {
      render(<WheelApp randomValues={fixedRandom(0)} />);
      startWheel();
      fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));
      act(() => vi.advanceTimersByTime(4_000));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "결과 복사" }));
        await Promise.resolve();
      });
      expect(writeText).toHaveBeenCalledWith("1. 민지");
      expect(screen.getByText("결과를 복사했습니다.")).toBeInTheDocument();

      fireEvent.click(screen.getByRole("button", { name: "이미지 저장" }));
      expect(screen.getByRole("button", { name: "이미지 만드는 중…" }))
        .toBeDisabled();
      expect(screen.getByRole("button", { name: "이미지 만드는 중…" }))
        .toHaveAttribute("aria-busy", "true");

      await act(async () => {
        finishImageSave?.();
        await Promise.resolve();
      });
      expect(downloadWheelResultImage).toHaveBeenCalledWith(
        document.querySelector(".wheel-results"),
      );
      expect(screen.getByText("1회")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "전체 후보" }))
        .toBeInTheDocument();
      expect(screen.getByText("추첨 결과 이미지를 저장했습니다."))
        .toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "결과 비우기" }))
        .not.toBeInTheDocument();
    } finally {
      if (originalClipboard) {
        Object.defineProperty(navigator, "clipboard", originalClipboard);
      } else {
        Object.defineProperty(navigator, "clipboard", {
          configurable: true,
          value: undefined,
        });
      }
    }
  });

  it("결과 이미지 생성 실패를 알리고 기존 결과를 유지한다", async () => {
    downloadWheelResultImage.mockRejectedValueOnce(new Error("capture failed"));
    render(<WheelApp randomValues={fixedRandom(0)} />);
    startWheel();
    fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));
    act(() => vi.advanceTimersByTime(4_000));

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "이미지 저장" }));
      await Promise.resolve();
    });

    expect(screen.getByText("결과 이미지를 저장하지 못했습니다."))
      .toBeInTheDocument();
    expect(screen.getByText("1회")).toBeInTheDocument();
  });

  it("처음부터 다시는 결과만 버리고 저장된 후보와 설정을 유지한다", () => {
    render(<WheelApp randomValues={fixedRandom(0)} />);
    fireEvent.change(screen.getByLabelText("돌림판 후보"), {
      target: { value: "민지, 준호" },
    });
    fireEvent.click(screen.getByRole("button", { name: "효과음 꺼짐" }));
    fireEvent.click(screen.getByRole("button", { name: "돌림판 시작" }));
    fireEvent.click(screen.getByRole("button", { name: "처음부터 다시" }));

    expect(screen.getByLabelText("돌림판 후보")).toHaveValue("민지, 준호");
    expect(screen.getByRole("button", { name: "효과음 켜짐" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(localStorage.getItem(WHEEL_OPTIONS_STORAGE_KEY)).toContain(
      '"soundEnabled":true',
    );
  });

  it("동작 감소 환경에서는 220ms 뒤 같은 결과를 공개한다", () => {
    const originalMatchMedia = window.matchMedia;
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn(() => ({
        matches: true,
        media: "(prefers-reduced-motion: reduce)",
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });

    try {
      render(<WheelApp randomValues={fixedRandom(1)} />);
      startWheel();
      fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));
      act(() => vi.advanceTimersByTime(219));
      expect(screen.getByText("0회")).toBeInTheDocument();

      act(() => vi.advanceTimersByTime(1));
      const results = screen.getByRole("region", { name: "당첨 결과" });
      expect(within(results).getByText("준호")).toBeInTheDocument();
    } finally {
      Object.defineProperty(window, "matchMedia", {
        configurable: true,
        value: originalMatchMedia,
      });
    }
  });

  it("언마운트 시 진행 타이머와 돌림판 효과음을 정리한다", () => {
    const sound = soundService();
    const rendered = render(
      <WheelApp randomValues={fixedRandom(0)} soundService={sound} />,
    );
    startWheel();
    fireEvent.click(screen.getByRole("button", { name: "돌림판 회전" }));
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    rendered.unmount();

    expect(vi.getTimerCount()).toBe(0);
    expect(sound.dispose).toHaveBeenCalledOnce();
  });
});
