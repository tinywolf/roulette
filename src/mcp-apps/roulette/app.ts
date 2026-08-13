import { App } from "@modelcontextprotocol/ext-apps";
import {
  createWheelGradient,
  getRevealDelay,
  parseRouletteDrawInput,
  parseRouletteResult,
  type RouletteDrawInput,
  type RouletteResult,
} from "./model";

const REDRAW_ROULETTE_TOOL_NAME = "redraw_roulette";
// MCP 서버와 App은 서로 다른 번들 경계이므로 이 문자열이 UI 전용 결과의 wire contract다.
const ROULETTE_RESULT_META_KEY = "roulette/result";
type RouletteToolResult = Awaited<ReturnType<App["callServerTool"]>>;

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
const textResult = getRequiredElement<HTMLElement>("[data-text-result]");
const redrawButton = getRequiredElement<HTMLButtonElement>("[data-redraw]");
const actionStatus = getRequiredElement<HTMLElement>("[data-action-status]");

let animationToken = 0;
let presentationToken = 0;
let currentInput: RouletteDrawInput | null = null;
let appConnected = false;
let redrawSupported = false;
let redrawActive = false;
let renderingResult = false;
let hasResult = false;

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function waitForAnimationFrame(): Promise<void> {
  return new Promise((resolve) => window.requestAnimationFrame(() => resolve()));
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function resetView(): void {
  animationToken += 1;
  wheel.classList.remove("is-spinning", "is-complete");
  stage.classList.remove("has-error", "is-complete");
  results.replaceChildren();
  textResult.textContent = "";
}

function updateRedrawControl(): void {
  const available = appConnected && redrawSupported && currentInput !== null;
  redrawButton.hidden = !available;
  redrawButton.disabled = !available || redrawActive || renderingResult || !hasResult;
  redrawButton.textContent = redrawActive ? "재추첨 중…" : "재추첨";
  redrawButton.setAttribute("aria-busy", String(redrawActive));
}

function clearActionStatus(): void {
  actionStatus.classList.remove("has-error");
  actionStatus.textContent = "";
}

function showRedrawError(): void {
  actionStatus.classList.add("has-error");
  actionStatus.textContent = "재추첨하지 못했습니다. 다시 시도해 주세요.";
}

function showError(message: string): void {
  resetView();
  stage.classList.add("has-error");
  status.textContent = message;
  summary.textContent = "요청을 확인한 뒤 다시 시도해 주세요.";
  hasResult = false;
  renderingResult = false;
  updateRedrawControl();
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

/** 기존 호스트의 한 줄 결과와 같은 표현을 현재 App 카드 안에 만든다. */
function formatTextResult(result: RouletteResult): string {
  return `추첨 결과: ${result.results.map((winner) => winner.name).join(", ")}`;
}

/** 서버가 확정한 순서를 바꾸지 않고 화면 공개 타이밍만 연출한다. */
async function renderResult(result: RouletteResult): Promise<void> {
  resetView();
  const currentToken = animationToken;
  const reducedMotion = prefersReducedMotion();

  status.textContent = "룰렛을 돌리고 있어요";
  summary.textContent = `후보 ${result.candidateCount}개 중 ${result.drawCount}개를 추첨합니다.`;
  wheel.style.background = createWheelGradient(result.candidateCount);

  if (!reducedMotion) {
    await waitForAnimationFrame();
    if (currentToken !== animationToken) return;
    wheel.classList.add("is-spinning");
  }

  if (!reducedMotion) {
    await wait(1_450);
  }

  if (currentToken !== animationToken) return;

  wheel.classList.remove("is-spinning");
  wheel.classList.add("is-complete");
  status.textContent = "현재 추첨 결과";

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

async function presentToolResult(
  toolResult: RouletteToolResult,
  source: "initial" | "redraw",
): Promise<boolean> {
  if (toolResult.isError) {
    if (source === "redraw") showRedrawError();
    else showError("추첨을 완료하지 못했습니다.");
    return false;
  }

  const resultPayload =
    toolResult._meta?.[ROULETTE_RESULT_META_KEY] ??
    toolResult.structuredContent;
  const parsed = parseRouletteResult(resultPayload);
  if (!parsed) {
    if (source === "redraw") showRedrawError();
    else showError("표시할 수 없는 추첨 결과입니다.");
    return false;
  }

  const currentPresentation = ++presentationToken;
  renderingResult = true;
  clearActionStatus();
  updateRedrawControl();
  await renderResult(parsed);

  if (currentPresentation !== presentationToken) return false;

  hasResult = true;
  renderingResult = false;
  textResult.textContent = formatTextResult(parsed);
  updateRedrawControl();

  return true;
}

/** MCP Apps 호스트의 최초 결과와 App 전용 재추첨을 현재 카드에 연결한다. */
const app = new App(
  { name: "Roulette Result", version: "1.4.0" },
  {},
  { autoResize: true, strict: true },
);

app.ontoolinput = (toolInput) => {
  const parsed = parseRouletteDrawInput(toolInput.arguments);
  if (!parsed) return;

  currentInput = parsed;
  updateRedrawControl();
};

app.ontoolresult = (toolResult) => {
  if (redrawActive) return;
  void presentToolResult(toolResult, "initial");
};

redrawButton.addEventListener("click", () => {
  if (
    currentInput === null ||
    !appConnected ||
    !redrawSupported ||
    redrawActive ||
    renderingResult ||
    !hasResult
  ) {
    return;
  }

  const input = currentInput;
  redrawActive = true;
  actionStatus.classList.remove("has-error");
  actionStatus.textContent = "새 결과를 추첨하고 있습니다.";
  updateRedrawControl();

  void app
    .callServerTool({
      name: REDRAW_ROULETTE_TOOL_NAME,
      arguments: input,
    })
    .then((toolResult) => presentToolResult(toolResult, "redraw"))
    .catch(() => {
      showRedrawError();
      return false;
    })
    .finally(() => {
      redrawActive = false;
      updateRedrawControl();
    });
});

void app
  .connect()
  .then(() => {
    appConnected = true;
    redrawSupported = app.getHostCapabilities()?.serverTools !== undefined;
    updateRedrawControl();
  })
  .catch(() => {
    showError("호스트와 UI를 연결하지 못했습니다.");
  });
