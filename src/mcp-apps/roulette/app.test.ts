import { beforeEach, describe, expect, it, vi } from "vitest";

type ToolResult = {
  content: Array<{ type: "text"; text: string }>;
  _meta?: Record<string, unknown>;
  structuredContent?: unknown;
  isError?: boolean;
};

type MockAppInstance = {
  ontoolinput?: (input: { arguments?: Record<string, unknown> }) => void;
  ontoolresult?: (result: ToolResult) => void;
  callServerTool: ReturnType<typeof vi.fn>;
};

const appMocks = vi.hoisted(() => ({
  instances: [] as MockAppInstance[],
  nextResult: null as ToolResult | null,
  emitResultDuringCall: false,
  hostCapabilities: { serverTools: {} } as { serverTools?: object },
}));

vi.mock("@modelcontextprotocol/ext-apps", () => ({
  App: class MockApp {
    ontoolinput?: MockAppInstance["ontoolinput"];
    ontoolresult?: MockAppInstance["ontoolresult"];

    callServerTool = vi.fn(async () => {
      if (!appMocks.nextResult) throw new Error("재추첨 결과가 없습니다.");
      if (appMocks.emitResultDuringCall) {
        this.ontoolresult?.(appMocks.nextResult);
      }
      return appMocks.nextResult;
    });

    constructor(..._arguments: unknown[]) {
      appMocks.instances.push(this);
    }

    async connect(): Promise<void> {}

    getHostCapabilities(): { serverTools?: object } {
      return appMocks.hostCapabilities;
    }
  },
}));

const initialResult: ToolResult = {
  content: [],
  _meta: {
    "roulette/result": {
      candidateCount: 3,
      drawCount: 1,
      remainingCount: 2,
      results: [{ order: 1, id: "candidate-1", name: "가" }],
    },
  },
};

const redrawResult: ToolResult = {
  content: [],
  _meta: {
    "roulette/result": {
      candidateCount: 3,
      drawCount: 1,
      remainingCount: 2,
      results: [{ order: 1, id: "candidate-3", name: "다" }],
    },
  },
};

const legacyStructuredResult: ToolResult = {
  content: [{ type: "text", text: "추첨 결과: 나, 다" }],
  structuredContent: {
    candidateCount: 3,
    drawCount: 2,
    remainingCount: 1,
    results: [
      { order: 1, id: "candidate-2", name: "나" },
      { order: 2, id: "candidate-3", name: "다" },
    ],
  },
};

async function flushPromises(): Promise<void> {
  for (let index = 0; index < 6; index += 1) {
    await Promise.resolve();
  }
}

async function renderInitialResult(): Promise<MockAppInstance> {
  await import("./app");
  await flushPromises();

  const app = appMocks.instances[0];
  app.ontoolinput?.({
    arguments: { rawInput: "가,나,다", drawCount: 1 },
  });
  app.ontoolresult?.(initialResult);
  await flushPromises();
  return app;
}

beforeEach(() => {
  vi.resetModules();
  appMocks.instances.length = 0;
  appMocks.nextResult = redrawResult;
  appMocks.emitResultDuringCall = false;
  appMocks.hostCapabilities = { serverTools: {} };

  document.body.innerHTML = `
    <main data-stage>
      <div data-wheel></div>
      <h1 data-status></h1>
      <p data-summary></p>
      <ol data-results></ol>
      <p data-text-result></p>
      <button type="button" data-redraw disabled hidden>재추첨</button>
      <span data-action-status></span>
    </main>
  `;
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn(() => ({ matches: true })),
  });
  vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
    callback(0);
    return 1;
  });
});

describe("MCP App 재추첨", () => {
  it("capability가 누락된 호스트의 기존 structuredContent도 표시한다", async () => {
    await import("./app");
    await flushPromises();

    const app = appMocks.instances[0];
    app.ontoolresult?.(legacyStructuredResult);
    await flushPromises();

    expect(document.querySelector("[data-results]")?.textContent).toBe(
      "1나2다",
    );
    expect(document.querySelector("[data-status]")?.textContent).toBe(
      "현재 추첨 결과",
    );
    expect(document.querySelector("[data-text-result]")?.textContent).toBe(
      "추첨 결과: 나, 다",
    );
  });

  it("app-only 도구 결과로 현재 카드만 한 번 다시 렌더링한다", async () => {
    appMocks.emitResultDuringCall = true;
    const app = await renderInitialResult();
    const button = document.querySelector<HTMLButtonElement>("[data-redraw]")!;

    expect(button.hidden).toBe(false);
    expect(button.disabled).toBe(false);
    expect(document.querySelector("[data-results]")?.textContent).toBe("1가");

    button.click();
    await flushPromises();

    expect(app.callServerTool).toHaveBeenCalledWith({
      name: "redraw_roulette",
      arguments: { rawInput: "가,나,다", drawCount: 1 },
    });
    expect(document.querySelector("[data-results]")?.textContent).toBe("1다");
    expect(document.querySelector("[data-text-result]")?.textContent).toBe(
      "추첨 결과: 다",
    );
    expect(window.requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(appMocks.instances).toHaveLength(1);
    expect(button.disabled).toBe(false);
  });

  it("재추첨 오류가 나면 기존 결과를 유지하고 다시 시도할 수 있다", async () => {
    appMocks.nextResult = {
      content: [{ type: "text", text: "INTERNAL_ERROR" }],
      isError: true,
    };
    await renderInitialResult();
    const button = document.querySelector<HTMLButtonElement>("[data-redraw]")!;

    button.click();
    await flushPromises();

    expect(document.querySelector("[data-results]")?.textContent).toBe("1가");
    expect(document.querySelector("[data-text-result]")?.textContent).toBe(
      "추첨 결과: 가",
    );
    expect(document.querySelector("[data-action-status]")?.textContent).toBe(
      "재추첨하지 못했습니다. 다시 시도해 주세요.",
    );
    expect(button.disabled).toBe(false);
  });

  it("호스트가 서버 도구 호출을 지원하지 않으면 버튼을 노출하지 않는다", async () => {
    appMocks.hostCapabilities = {};
    await renderInitialResult();

    expect(
      document.querySelector<HTMLButtonElement>("[data-redraw]")?.hidden,
    ).toBe(true);
  });
});
