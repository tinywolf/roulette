import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWheelCandidates } from "../domain/wheelSession";
import {
  MAXIMUM_SPIN_DURATION_MS,
  MINIMUM_SPIN_DURATION_MS,
  WheelStage,
} from "./WheelStage";

describe("WheelStage", () => {
  it("후보마다 동일 좌표계의 SVG 구획과 고정 포인터를 렌더링한다", () => {
    const { container } = render(
      <WheelStage
        candidates={createWheelCandidates(["민지", "준호"])}
        currentRotation={0}
        previousRotation={0}
        isSpinning={false}
        reducedMotion={false}
        spinDurationMs={MINIMUM_SPIN_DURATION_MS}
        statusLabel="회전 준비"
      />,
    );

    expect(
      screen.getByRole("img", { name: "후보 2개의 돌림판. 회전 준비" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("[data-candidate-id]")).toHaveLength(2);
    const segmentPaths = container.querySelectorAll(
      "[data-candidate-id] path",
    );
    expect(segmentPaths[0]).toHaveAttribute("fill", "#ff6b68");
    expect(segmentPaths[1]).toHaveAttribute("fill", "#ffb84d");
    expect(container.querySelector(".wheel-stage__pointer"))
      .toHaveAttribute("points", "108,5 132,5 120,29");
  });

  it("45개 후보를 DOM 재구성 없이 하나의 회전 그룹에 표시한다", () => {
    const names = Array.from({ length: 45 }, (_, index) => `후보${index + 1}`);
    const { container } = render(
      <WheelStage
        candidates={createWheelCandidates(names)}
        currentRotation={2_164}
        previousRotation={0}
        isSpinning
        reducedMotion={false}
        spinDurationMs={MAXIMUM_SPIN_DURATION_MS}
        statusLabel="회전 중"
      />,
    );

    expect(container.querySelectorAll("[data-candidate-id]")).toHaveLength(45);
    expect(container.querySelector(".wheel-stage__svg"))
      .toHaveClass("wheel-stage__svg--dense");
    expect(screen.getByTestId("wheel-disc")).toHaveStyle({
      transform: "rotate(2164deg)",
    });
    expect(screen.getByTestId("wheel-disc")).not.toHaveStyle({
      transitionProperty: "transform",
    });
  });

  it("동작 감소 환경에서는 정규화된 목표와 짧은 전환을 사용한다", () => {
    render(
      <WheelStage
        candidates={createWheelCandidates(["민지", "준호"])}
        currentRotation={2_475}
        previousRotation={0}
        isSpinning
        reducedMotion
        spinDurationMs={MAXIMUM_SPIN_DURATION_MS}
        statusLabel="회전 중"
      />,
    );

    expect(screen.getByTestId("wheel-disc")).toHaveStyle({
      transform: "rotate(315deg)",
    });
  });

  it("한 애니메이션으로 이전 각도에서 목표 각도까지 끊김 없이 이동한다", () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "animate",
    );
    const cancel = vi.fn();
    const animate = vi.fn(
      (keyframes: Keyframe[], options: KeyframeAnimationOptions) => {
        void keyframes;
        void options;
        return { cancel };
      },
    );
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: animate,
    });

    try {
      const rendered = render(
        <WheelStage
          candidates={createWheelCandidates(["민지", "준호"])}
          currentRotation={2_430}
          previousRotation={0}
          isSpinning
          reducedMotion={false}
          spinDurationMs={MINIMUM_SPIN_DURATION_MS}
          statusLabel="회전 중"
        />,
      );

      expect(animate).toHaveBeenCalledOnce();
      const [keyframes, options] = animate.mock.calls[0];
      expect(keyframes).toEqual([
        { transform: "rotate(0deg)" },
        { transform: "rotate(2430deg)" },
      ]);
      expect(options).toEqual({
        duration: MINIMUM_SPIN_DURATION_MS,
        easing: "cubic-bezier(0.12, 0.72, 0.18, 1)",
        fill: "none",
      });
      expect(screen.getByTestId("wheel-disc")).toHaveStyle({
        transform: "rotate(2430deg)",
      });

      rendered.rerender(
        <WheelStage
          candidates={createWheelCandidates(["민지", "준호"])}
          currentRotation={2_430}
          previousRotation={0}
          isSpinning={false}
          reducedMotion={false}
          spinDurationMs={MINIMUM_SPIN_DURATION_MS}
          statusLabel="민지 당첨"
        />,
      );
      expect(cancel).toHaveBeenCalledOnce();
      expect(screen.getByTestId("wheel-disc")).toHaveStyle({
        transform: "rotate(2430deg)",
      });
    } finally {
      if (originalAnimate) {
        Object.defineProperty(Element.prototype, "animate", originalAnimate);
      } else {
        delete (Element.prototype as Partial<Element>).animate;
      }
    }
  });

  it("애니메이션 API 실패를 알리고 최종 목표 transform은 유지한다", () => {
    const originalAnimate = Object.getOwnPropertyDescriptor(
      Element.prototype,
      "animate",
    );
    Object.defineProperty(Element.prototype, "animate", {
      configurable: true,
      value: vi.fn(() => {
        throw new Error("animation failure");
      }),
    });
    const onAnimationError = vi.fn();

    try {
      render(
        <WheelStage
          candidates={createWheelCandidates(["민지", "준호"])}
          currentRotation={2_475}
          previousRotation={0}
          isSpinning
          reducedMotion={false}
          spinDurationMs={MINIMUM_SPIN_DURATION_MS}
          statusLabel="회전 중"
          onAnimationError={onAnimationError}
        />,
      );

      expect(onAnimationError).toHaveBeenCalledOnce();
      expect(screen.getByTestId("wheel-disc")).toHaveStyle({
        transform: "rotate(2475deg)",
      });
    } finally {
      if (originalAnimate) {
        Object.defineProperty(Element.prototype, "animate", originalAnimate);
      } else {
        delete (Element.prototype as Partial<Element>).animate;
      }
    }
  });
});
