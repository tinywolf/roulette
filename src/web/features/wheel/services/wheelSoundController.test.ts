import { describe, expect, it, vi } from "vitest";
import { WheelSoundController } from "./wheelSoundController";

function audioFixture() {
  const oscillator = {
    type: "sine",
    frequency: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  };
  const gain = {
    gain: {
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
    disconnect: vi.fn(),
  };
  const context = {
    currentTime: 10,
    state: "running",
    destination: {},
    createOscillator: vi.fn(() => oscillator),
    createGain: vi.fn(() => gain),
    close: vi.fn(() => Promise.resolve()),
    resume: vi.fn(() => Promise.resolve()),
  };

  return { context, gain, oscillator };
}

describe("WheelSoundController", () => {
  it("기본 음소거에서는 오디오 컨텍스트를 만들지 않는다", () => {
    const fixture = audioFixture();
    const factory = vi.fn(() => fixture.context as unknown as AudioContext);
    const controller = new WheelSoundController(factory);

    controller.startSpin(4_000);
    controller.playWinner();

    expect(factory).not.toHaveBeenCalled();
  });

  it("활성화하면 회전음을 시작하고 음소거 시 노드를 정리한다", () => {
    const fixture = audioFixture();
    const controller = new WheelSoundController(
      () => fixture.context as unknown as AudioContext,
    );

    controller.setEnabled(true);
    controller.startSpin(4_000);
    expect(fixture.oscillator.start).toHaveBeenCalledOnce();

    controller.setEnabled(false);
    expect(fixture.oscillator.stop).toHaveBeenCalled();
    expect(fixture.gain.disconnect).toHaveBeenCalled();
  });

  it("dispose에서 진행 중 노드와 컨텍스트를 닫는다", () => {
    const fixture = audioFixture();
    const controller = new WheelSoundController(
      () => fixture.context as unknown as AudioContext,
    );

    controller.setEnabled(true);
    controller.startSpin(4_000);
    controller.dispose();

    expect(fixture.oscillator.stop).toHaveBeenCalled();
    expect(fixture.context.close).toHaveBeenCalledOnce();
  });
});
