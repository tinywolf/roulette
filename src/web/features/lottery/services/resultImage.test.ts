import { afterEach, describe, expect, it, vi } from "vitest";
import { downloadResultImage } from "./resultImage";

const { toPng } = vi.hoisted(() => ({ toPng: vi.fn() }));

vi.mock("html-to-image", () => ({ toPng }));

describe("downloadResultImage", () => {
  afterEach(() => {
    toPng.mockReset();
    document.querySelectorAll(".result-capture-host").forEach((element) => {
      element.remove();
    });
  });

  it("전체 결과용 복제본을 PNG로 변환하고 날짜가 포함된 이름으로 저장한다", async () => {
    const source = document.createElement("section");
    const heading = document.createElement("h2");
    let clickedDownload = "";
    let clickedHref = "";

    source.className = "results-card";
    heading.id = "results-title";
    source.append(heading);
    Object.defineProperty(source, "getBoundingClientRect", {
      value: () => ({ width: 360 }),
    });
    toPng.mockImplementation(async (captureNode: HTMLElement) => {
      expect(captureNode).not.toBe(source);
      expect(captureNode).toHaveClass("results-card--capture");
      expect(captureNode.parentElement).toHaveClass("result-capture-host");
      expect(captureNode.style.width).toBe("360px");
      expect(captureNode.querySelector("[id]")).toBeNull();
      expect(document.body).toContainElement(captureNode);
      return "data:image/png;base64,result";
    });
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, "click")
      .mockImplementation(function (this: HTMLAnchorElement) {
        clickedDownload = this.download;
        clickedHref = this.href;
      });

    await downloadResultImage(source, new Date(2026, 7, 1, 9, 5));

    expect(toPng).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      expect.objectContaining({
        backgroundColor: "#ffffff",
        pixelRatio: 2,
      }),
    );
    expect(clickedDownload).toBe("추첨결과-20260801-0905.png");
    expect(clickedHref).toContain("data:image/png;base64,result");
    expect(document.querySelector(".result-capture-host")).toBeNull();
    expect(document.querySelector(".results-card--capture")).toBeNull();
    click.mockRestore();
  });
});
