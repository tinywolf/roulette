import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultList } from "./ResultList";

describe("ResultList", () => {
  it("추첨된 이름을 실제 공 색상의 공 스타일로 표시한다", () => {
    const { container } = render(
      <ResultList
        results={[
          {
            order: 1,
            ballId: "ball-2",
            name: "준호",
            drawnAt: 1_000,
          },
        ]}
        balls={[
          { id: "ball-1", name: "민지", color: "#ff6b6b" },
          { id: "ball-2", name: "준호", color: "#4dabf7" },
        ]}
        totalCount={2}
        candidateCount={2}
        completed={false}
        onCopy={vi.fn()}
      />,
    );

    const resultBall = container.querySelector<HTMLElement>(".result-ball");

    expect(resultBall).toHaveTextContent("준호");
    expect(resultBall?.style.getPropertyValue("--result-ball-color")).toBe(
      "#4dabf7",
    );
    expect(screen.queryByText("민지")).not.toBeInTheDocument();
  });
});
