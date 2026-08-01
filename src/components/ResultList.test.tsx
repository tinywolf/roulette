import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ResultList } from "./ResultList";

const { downloadResultImage } = vi.hoisted(() => ({
  downloadResultImage: vi.fn(),
}));

vi.mock("../services/resultImage", () => ({ downloadResultImage }));

describe("ResultList", () => {
  beforeEach(() => {
    downloadResultImage.mockReset();
  });

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
        onImageSaveResult={vi.fn()}
      />,
    );

    const resultItem = container.querySelector<HTMLElement>(".result-item");

    expect(resultItem).toHaveTextContent("준호");
    expect(resultItem?.style.getPropertyValue("--result-color")).toBe(
      "#4dabf7",
    );
    expect(container.querySelector(".result-ball")).not.toBeInTheDocument();
    expect(screen.queryByText("민지")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "결과 복사" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "이미지 저장" })).toBeDisabled();
  });

  it("결과 카드 전체의 이미지 저장을 요청하고 성공을 알린다", async () => {
    downloadResultImage.mockResolvedValue(undefined);
    const onImageSaveResult = vi.fn();
    const { container } = render(
      <ResultList
        results={[
          { order: 1, ballId: "ball-1", name: "민지", drawnAt: 1_000 },
        ]}
        balls={[{ id: "ball-1", name: "민지", color: "#ff6b6b" }]}
        totalCount={1}
        candidateCount={1}
        completed
        onCopy={vi.fn()}
        onImageSaveResult={onImageSaveResult}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "이미지 저장" }));

    await waitFor(() => {
      expect(downloadResultImage).toHaveBeenCalledWith(
        container.querySelector(".results-card"),
      );
      expect(onImageSaveResult).toHaveBeenCalledWith(true);
    });
  });
});
