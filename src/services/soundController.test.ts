import { describe, expect, it, vi } from "vitest";
import { SoundController } from "./soundController";

function installAudioContextMock() {
  const start = vi.fn();
  const close = vi.fn().mockResolvedValue(undefined);
  const bufferSources: Array<{
    buffer: AudioBuffer | null;
    loop: boolean;
    connect: ReturnType<typeof vi.fn>;
    start: ReturnType<typeof vi.fn>;
    stop: ReturnType<typeof vi.fn>;
  }> = [];
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
      linearRampToValueAtTime: vi.fn(),
      cancelScheduledValues: vi.fn(),
    },
    connect: vi.fn(),
  }));
  const createBufferSource = vi.fn(() => {
    const source = {
      buffer: null as AudioBuffer | null,
      loop: false,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    };
    bufferSources.push(source);
    return source;
  });
  const createBiquadFilter = vi.fn(() => ({
    type: "lowpass",
    frequency: { setValueAtTime: vi.fn() },
    Q: { setValueAtTime: vi.fn() },
    connect: vi.fn(),
  }));
  const createBuffer = vi.fn(
    (_channels: number, frameCount: number) => {
      const channel = new Float32Array(frameCount);
      return {
        getChannelData: vi.fn(() => channel),
      };
    },
  );

  class AudioContextMock {
    state = "running";

    currentTime = 0;

    sampleRate = 48_000;

    destination = {};

    createOscillator = createOscillator;

    createGain = createGain;

    createBufferSource = createBufferSource;

    createBiquadFilter = createBiquadFilter;

    createBuffer = createBuffer;

    resume = vi.fn().mockResolvedValue(undefined);

    close = close;
  }

  Object.defineProperty(window, "AudioContext", {
    configurable: true,
    value: AudioContextMock,
  });

  return {
    bufferSources,
    close,
    createBufferSource,
    createOscillator,
    start,
  };
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

  it("혼합 중 바람 루프와 불규칙한 공 충돌음을 재생한다", async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const {
      bufferSources,
      createBufferSource,
      createOscillator,
    } = installAudioContextMock();
    const controller = new SoundController();
    controller.setEnabled(true);

    await controller.startMixing(45);

    expect(createBufferSource).toHaveBeenCalledTimes(1);
    expect(bufferSources[0].loop).toBe(true);
    expect(bufferSources[0].start).toHaveBeenCalledTimes(1);

    await controller.startMixing(20);
    expect(createBufferSource).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);

    expect(createBufferSource.mock.calls.length).toBeGreaterThan(1);
    expect(createOscillator).toHaveBeenCalled();

    const createdBeforeMute = createBufferSource.mock.calls.length;
    controller.setEnabled(false);
    expect(bufferSources[0].stop).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2_000);
    expect(createBufferSource).toHaveBeenCalledTimes(createdBeforeMute);

    randomSpy.mockRestore();
    vi.useRealTimers();
  });

  it("남은 공이 많을수록 같은 시간에 더 많은 충돌음을 만든다", async () => {
    vi.useFakeTimers();
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.5);
    const denseAudio = installAudioContextMock();
    const denseController = new SoundController();
    denseController.setEnabled(true);
    await denseController.startMixing(45);

    vi.advanceTimersByTime(600);
    const denseCollisions = denseAudio.createBufferSource.mock.calls.length - 1;
    denseController.dispose();

    const sparseAudio = installAudioContextMock();
    const sparseController = new SoundController();
    sparseController.setEnabled(true);
    await sparseController.startMixing(1);

    vi.advanceTimersByTime(600);
    const sparseCollisions =
      sparseAudio.createBufferSource.mock.calls.length - 1;
    sparseController.dispose();

    expect(denseCollisions).toBeGreaterThan(sparseCollisions);

    randomSpy.mockRestore();
    vi.useRealTimers();
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
    await expect(controller.startMixing(10)).resolves.toBeUndefined();
  });
});
