import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createWheelCandidates } from "../domain/wheelSession";
import {
  REDUCED_MOTION_DURATION_MS,
  WheelStage,
  WHEEL_SPIN_DURATION_MS,
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
        statusLabel="회전 준비"
      />,
    );

    expect(
      screen.getByRole("img", { name: "후보 2개의 돌림판. 회전 준비" }),
    ).toBeInTheDocument();
    expect(container.querySelectorAll("[data-candidate-id]")).toHaveLength(2);
    expect(container.querySelector(".wheel-stage__pointer"))
      .toBeInTheDocument();
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
        statusLabel="회전 중"
      />,
    );

    expect(container.querySelectorAll("[data-candidate-id]")).toHaveLength(45);
    expect(container.querySelector(".wheel-stage__svg"))
      .toHaveClass("wheel-stage__svg--dense");
    expect(screen.getByTestId("wheel-disc")).toHaveStyle({
      transform: "rotate(2164deg)",
      transitionDuration: `${WHEEL_SPIN_DURATION_MS}ms`,
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
        statusLabel="회전 중"
      />,
    );

    expect(screen.getByTestId("wheel-disc")).toHaveStyle({
      transform: "rotate(315deg)",
      transitionDuration: `${REDUCED_MOTION_DURATION_MS}ms`,
    });
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
