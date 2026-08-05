import { App } from "@modelcontextprotocol/ext-apps";
import {
  createWheelGradient,
  getRevealDelay,
  parseRouletteResult,
  type RouletteResult,
} from "./model";

function getRequiredElement<ElementType extends Element>(
  selector: string,
): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error("룰렛 UI를 초기화할 수 없습니다.");
  }

  return element;
}

const stage = getRequiredElement<HTMLElement>("[data-stage]");
const wheel = getRequiredElement<HTMLElement>("[data-wheel]");
const status = getRequiredElement<HTMLElement>("[data-status]");
const summary = getRequiredElement<HTMLElement>("[data-summary]");
const results = getRequiredElement<HTMLOListElement>("[data-results]");

let animationToken = 0;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resetView(): void {
  animationToken += 1;
  wheel.classList.remove("is-spinning", "is-complete");
  stage.classList.remove("has-error", "is-complete");
  results.replaceChildren();
}

function showError(message: string): void {
  resetView();
  stage.classList.add("has-error");
  status.textContent = message;
  summary.textContent = "텍스트 결과를 확인해 주세요.";
}

function createResultItem(result: RouletteResult["results"][number]): HTMLLIElement {
  const item = document.createElement("li");
  item.className = "result-item";

  const order = document.createElement("span");
  order.className = "result-order";
  order.textContent = String(result.order);

  const name = document.createElement("span");
  name.className = "result-name";
  name.textContent = result.name;

  item.append(order, name);
  return item;
}

/** 서버가 확정한 순서를 바꾸지 않고 화면 공개 타이밍만 연출한다. */
async function renderResult(result: RouletteResult): Promise<void> {
  resetView();
  const currentToken = animationToken;
  const reducedMotion = prefersReducedMotion();

  status.textContent = "룰렛을 돌리고 있어요";
  summary.textContent = `후보 ${result.candidateCount}개 중 ${result.drawCount}개를 추첨합니다.`;
  wheel.style.background = createWheelGradient(result.candidateCount);
  wheel.classList.add("is-spinning");

  if (!reducedMotion) {
    await wait(1_450);
  }

  if (currentToken !== animationToken) return;

  wheel.classList.remove("is-spinning");
  wheel.classList.add("is-complete");
  status.textContent = "추첨 결과";

  const revealDelay = reducedMotion ? 0 : getRevealDelay(result.results.length);
  for (const winner of result.results) {
    if (currentToken !== animationToken) return;

    const item = createResultItem(winner);
    results.append(item);
    requestAnimationFrame(() => item.classList.add("is-visible"));

    if (revealDelay > 0) {
      await wait(revealDelay);
    }
  }

  if (currentToken !== animationToken) return;

  stage.classList.add("is-complete");
  summary.textContent =
    result.remainingCount > 0
      ? `${result.drawCount}개 추첨 완료 · ${result.remainingCount}개 남음`
      : `전체 ${result.drawCount}개 순서 추첨 완료`;
}

/** MCP Apps 호스트의 tool-result 통지를 받아 UI에 전달한다. */
const app = new App(
  { name: "Roulette Result", version: "1.0.0" },
  {},
  { autoResize: true, strict: true },
);

app.ontoolresult = (toolResult) => {
  if (toolResult.isError) {
    showError("추첨을 완료하지 못했습니다.");
    return;
  }

  const parsed = parseRouletteResult(toolResult.structuredContent);
  if (!parsed) {
    showError("표시할 수 없는 추첨 결과입니다.");
    return;
  }

  void renderResult(parsed);
};

void app.connect().catch(() => {
  showError("호스트와 UI를 연결하지 못했습니다.");
});
