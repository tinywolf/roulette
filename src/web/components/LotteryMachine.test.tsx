import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Ball } from "../domain/types";
import { LotteryMachine } from "./LotteryMachine";

const rendererMocks = vi.hoisted(() => ({
  constructors: vi.fn(),
  dispose: vi.fn(),
  render: vi.fn(),
  resize: vi.fn(),
  syncBalls: vi.fn(),
}));

vi.mock("./lottery3dRenderer", () => ({
  Lottery3dRenderer: class {
    constructor() {
      rendererMocks.constructors();
    }

    dispose = rendererMocks.dispose;

    render = rendererMocks.render;

    resize = rendererMocks.resize;

    syncBalls = rendererMocks.syncBalls;
  },
}));

const balls: Ball[] = [
  { id: "ball-1", name: "1", color: "#ff6b6b" },
  { id: "ball-2", name: "2", color: "#4dabf7" },
];

describe("LotteryMachine", () => {
  beforeEach(() => {
    Object.values(rendererMocks).forEach((mock) => mock.mockClear());
  });

  it("추첨 상태와 남은 공이 바뀌어도 3D 렌더러와 아틀라스를 재생성하지 않는다", () => {
    const view = render(
      <LotteryMachine
        balls={balls}
        allBalls={balls}
        renderMode="3d"
        isMixing
        isSettling={false}
        visualBall={null}
        onError={vi.fn()}
      />,
    );

    view.rerender(
      <LotteryMachine
        balls={balls.slice(1)}
        allBalls={balls}
        renderMode="3d"
        isMixing={false}
        isSettling
        visualBall={balls[0]}
        onError={vi.fn()}
      />,
    );

    expect(rendererMocks.constructors).toHaveBeenCalledTimes(1);
    expect(rendererMocks.syncBalls).toHaveBeenCalledTimes(1);
    expect(rendererMocks.syncBalls).toHaveBeenCalledWith(balls);
    expect(rendererMocks.dispose).not.toHaveBeenCalled();

    view.unmount();

    expect(rendererMocks.dispose).toHaveBeenCalledTimes(1);
  });

  it("움직이는 공과 배출 공이 없으면 첫 프레임 뒤 애니메이션을 중단한다", () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    requestAnimationFrame.mockClear();

    render(
      <LotteryMachine
        balls={[]}
        allBalls={balls}
        renderMode="3d"
        isMixing={false}
        isSettling={false}
        visualBall={null}
        onError={vi.fn()}
      />,
    );

    expect(callbacks).toHaveLength(1);

    act(() => {
      callbacks.shift()?.(performance.now() + 16);
    });

    expect(callbacks).toHaveLength(0);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    requestAnimationFrame.mockRestore();
  });

  it("완료 후 44개 남은 공이 안정되면 정착 프레임 생성을 중단한다", () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    requestAnimationFrame.mockClear();
    const startedAt = performance.now();
    const settlingBalls = Array.from({ length: 44 }, (_, index) => ({
      id: `settling-${index}`,
      name: `${index + 1}`,
      color: "#ff6b6b",
    }));

    render(
      <LotteryMachine
        balls={settlingBalls}
        allBalls={settlingBalls}
        renderMode="3d"
        isMixing={false}
        isSettling
        visualBall={null}
        onError={vi.fn()}
      />,
    );

    let processedFrames = 0;

    while (callbacks.length > 0 && processedFrames < 1_200) {
      const callback = callbacks.shift();
      processedFrames += 1;

      act(() => {
        callback?.(startedAt + processedFrames * (1_000 / 60));
      });
    }

    expect(processedFrames).toBeLessThan(1_200);
    expect(callbacks).toHaveLength(0);
    requestAnimationFrame.mockRestore();
  });

  it("정착이 계속되어도 하드 리밋 수렴 후 프레임 생성을 중단한다", () => {
    const callbacks: FrameRequestCallback[] = [];
    const requestAnimationFrame = vi
      .spyOn(window, "requestAnimationFrame")
      .mockImplementation((callback) => {
        callbacks.push(callback);
        return callbacks.length;
      });
    requestAnimationFrame.mockClear();
    const startedAt = performance.now();
    const settlingBalls = Array.from({ length: 4 }, (_, index) => ({
      id: `hard-limit-${index}`,
      name: `${index + 1}`,
      color: "#ff6b6b",
    }));

    render(
      <LotteryMachine
        balls={settlingBalls}
        allBalls={settlingBalls}
        renderMode="3d"
        isMixing={false}
        isSettling
        visualBall={null}
        onError={vi.fn()}
      />,
    );

    let processedFrames = 0;

    while (callbacks.length > 0 && processedFrames < 10) {
      const callback = callbacks.shift();
      processedFrames += 1;

      act(() => {
        callback?.(startedAt + processedFrames * 6_100);
      });
    }

    expect(processedFrames).toBeLessThanOrEqual(3);
    expect(callbacks).toHaveLength(0);
    requestAnimationFrame.mockRestore();
  });
});
