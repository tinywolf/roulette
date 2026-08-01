import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResultList } from "./ResultList";

describe("ResultList", () => {
  it("개별 결과 테두리에 실제 공 색상을 적용한다", () => {
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

    const resultItem = container.querySelector<HTMLElement>(".result-item");

    expect(resultItem).toHaveTextContent("준호");
    expect(resultItem?.style.getPropertyValue("--result-color")).toBe(
      "#4dabf7",
    );
    expect(container.querySelector(".result-ball")).not.toBeInTheDocument();
    expect(screen.queryByText("민지")).not.toBeInTheDocument();
  });
});
