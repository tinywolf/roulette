import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadWheelResultImage } from "./wheelResultImage";

const { toPng } = vi.hoisted(() => ({ toPng: vi.fn() }));

vi.mock("html-to-image", () => ({ toPng }));

describe("downloadWheelResultImage", () => {
  afterEach(() => {
    toPng.mockReset();
    document
      .querySelectorAll(".wheel-result-capture-host")
      .forEach((element) => element.remove());
  });

  it("결과 카드 복제본 전체를 PNG로 변환하고 저장 시각을 파일명에 포함한다", async () => {
    const source = document.createElement("section");
    const heading = document.createElement("h2");
    let clickedDownload = "";
    let clickedHref = "";

    source.className = "wheel-panel wheel-results";
    heading.id = "wheel-results-title";
    source.append(heading);
    Object.defineProperty(source, "getBoundingClientRect", {
      value: () => ({ width: 380 }),
    });
    toPng.mockImplementation(async (captureNode: HTMLElement) => {
      expect(captureNode).not.toBe(source);
      expect(captureNode).toHaveClass("wheel-results--capture");
      expect(captureNode.parentElement).toHaveClass(
        "wheel-result-capture-host",
      );
      expect(captureNode.style.width).toBe("380px");
      expect(captureNode.querySelector("[id]")).toBeNull();
      expect(document.body).toContainElement(captureNode);
      return "data:image/png;base64,wheel-result";
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download;
        clickedHref = this.href;
      });

    await downloadWheelResultImage(source, new Date(2026, 7, 14, 18, 12));

    expect(toPng).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      }),
    );
    expect(clickedDownload).toBe("돌림판-추첨결과-20260814-1812.png");
    expect(clickedHref).toContain("data:image/png;base64,wheel-result");
    expect(document.querySelector(".wheel-result-capture-host")).toBeNull();
    expect(document.querySelector(".wheel-results--capture")).toBeNull();
    click.mockRestore();
  });

  it("이미지 생성에 실패해도 캡처 복제본을 제거한다", async () => {
    const source = document.createElement("section");

    toPng.mockRejectedValue(new Error("capture failed"));

    await expect(downloadWheelResultImage(source)).rejects.toThrow(
      "capture failed",
    );
    expect(document.querySelector(".wheel-result-capture-host")).toBeNull();
  });
});
