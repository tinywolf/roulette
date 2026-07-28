import { describe, expect, it, vi } from "vitest";
import { SoundController } from "./soundController";

function installAudioContextMock() {
  const start = vi.fn();
  const close = vi.fn().mockResolvedValue(undefined);
  const createOscillator = vi.fn(() => ({
    type: "sine",
    frequency: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
    start,
    stop: vi.fn(),
  }));
  const createGain = vi.fn(() => ({
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  }));

  class AudioContextMock {
    state = "running";

    currentTime = 0;

    destination = {};

    createOscillator = createOscillator;

    createGain = createGain;

    resume = vi.fn().mockResolvedValue(undefined);

    close = close;
  }

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: AudioContextMock,
  });

  return { close, createOscillator, start };
}

describe("SoundController", () => {
  it("기본 음소거 상태에서는 오디오를 생성하지 않는다", async () => {
    const { createOscillator } = installAudioContextMock();
    const controller = new SoundController();

    await controller.play("draw");

    expect(createOscillator).not.toHaveBeenCalled();
  });

  it("활성화 시 완료 효과음을 재생하고 안전하게 정리한다", async () => {
    const { close, createOscillator, start } = installAudioContextMock();
    const controller = new SoundController();
    controller.setEnabled(true);

    await controller.play("complete");
    controller.dispose();

    expect(createOscillator).toHaveBeenCalledTimes(3);
    expect(start).toHaveBeenCalledTimes(3);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("브라우저 오디오 실패를 호출자에게 전파하지 않는다", async () => {
    Object.defineProperty(window, "AudioContext", {
      configurable: true,
      value: class AudioContextFailure {
        constructor() {
          throw new Error("오디오 실패");
        }
      },
    });
    const controller = new SoundController();
    controller.setEnabled(true);

    await expect(controller.play("draw")).resolves.toBeUndefined();
  });
});
