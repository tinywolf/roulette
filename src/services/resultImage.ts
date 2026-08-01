import { toPng } from "html-to-image";

const FALLBACK_CAPTURE_WIDTH = 360;

function padDatePart(value: number): string {
  return String(value).padStart(2, "0");
}

function createResultImageFilename(now: Date): string {
  const date = [
    now.getFullYear(),
    padDatePart(now.getMonth() + 1),
    padDatePart(now.getDate()),
  ].join("");
  const time = [padDatePart(now.getHours()), padDatePart(now.getMinutes())].join(
    "",
  );

  return `추첨결과-${date}-${time}.png`;
}

/** 화면을 흔들지 않고 전체 결과 카드를 복제해 고해상도 PNG로 다운로드한다. */
export async function downloadResultImage(
  source: HTMLElement,
  now = new Date(),
): Promise<void> {
  const captureHost = document.createElement("div");
  const captureNode = source.cloneNode(true) as HTMLElement;
  const sourceWidth = Math.round(source.getBoundingClientRect().width);

  captureHost.className = "result-capture-host";
  captureHost.setAttribute("aria-hidden", "true");
  captureNode.classList.add("results-card--capture");
  captureNode.removeAttribute("aria-labelledby");
  captureNode.querySelectorAll("[id]").forEach((element) => {
    element.removeAttribute("id");
  });
  captureNode.style.width = `${sourceWidth || FALLBACK_CAPTURE_WIDTH}px`;
  captureHost.append(captureNode);
  document.body.append(captureHost);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready;
    }

    const dataUrl = await toPng(captureNode, {
      backgroundColor: "#ffffff",
      cacheBust: true,
      pixelRatio: 2,
    });
    const link = document.createElement("a");

    link.download = createResultImageFilename(now);
    link.href = dataUrl;
    document.body.append(link);
    link.click();
    link.remove();
  } finally {
    captureHost.remove();
  }
}
