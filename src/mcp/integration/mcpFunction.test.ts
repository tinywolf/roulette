import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import {
  EXTENSION_ID,
  RESOURCE_MIME_TYPE,
} from "@modelcontextprotocol/ext-apps/server";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import handleVercelMcpRequest, {
  createMcpRequestHandler,
  createNodeMcpRequestHandler,
  handleMcpRequest,
} from "../../../api/mcp";
import { MCP_SERVER_VERSION } from "../server";
import { ROULETTE_RESULT_META_KEY } from "../tools/drawRoulette";

const clients: Client[] = [];
type NodeMcpRequestHandler = typeof handleVercelMcpRequest;

async function invokeNodeAdapter(
  request: Request,
  requestHandler: NodeMcpRequestHandler,
): Promise<Response> {
  const rawHeaders: string[] = [];
  const incomingHeaders: Record<string, string> = {};

  request.headers.forEach((value, name) => {
    rawHeaders.push(name, value);
    incomingHeaders[name] = value;
  });

  const requestBytes = Buffer.from(await request.arrayBuffer());
  const incoming = Object.assign(
    Readable.from(requestBytes.byteLength > 0 ? [requestBytes] : []),
    {
      headers: incomingHeaders,
      method: request.method,
      rawHeaders,
      url: `${new URL(request.url).pathname}${new URL(request.url).search}`,
    },
  ) as IncomingMessage;
  const responseHeaders = new Headers();
  let responseBytes = Buffer.alloc(0);
  const outgoing = {
    statusCode: 200,
    statusMessage: "",
    setHeader(name: string, value: number | string | readonly string[]) {
      responseHeaders.set(
        name,
        Array.isArray(value) ? value.join(", ") : String(value),
      );
      return this;
    },
    end(chunk?: Uint8Array) {
      if (chunk) responseBytes = Buffer.from(chunk);
      return this;
    },
  } as unknown as ServerResponse;

  await requestHandler(incoming, outgoing);

  return new Response(responseBytes, {
    status: outgoing.statusCode,
    statusText: outgoing.statusMessage,
    headers: responseHeaders,
  });
}

async function createTestClient(
  requestHandler: NodeMcpRequestHandler = handleVercelMcpRequest,
  supportsMcpApps = false,
): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/mcp"),
    {
      fetch: async (input, init) =>
        invokeNodeAdapter(new Request(input, init), requestHandler),
    },
  );
  const client = new Client(
    { name: "roulette-test-client", version: "1.0.0" },
    supportsMcpApps
      ? {
          capabilities: {
            extensions: {
              [EXTENSION_ID]: { mimeTypes: [RESOURCE_MIME_TYPE] },
            },
          },
          versionNegotiation: { mode: "auto" },
        }
      : undefined,
  );
  clients.push(client);
  await client.connect(transport);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Vercel MCP Function", () => {
  it("로컬 개발 처리기에서만 별도 서버 이름을 노출한다", async () => {
    const developmentHandler = createNodeMcpRequestHandler(
      createMcpRequestHandler({
        name: "roulette-remote-mcp-dev",
        version: MCP_SERVER_VERSION,
      }),
    );
    const client = await createTestClient(developmentHandler);

    expect(client.getServerVersion()).toMatchObject({
      name: "roulette-remote-mcp-dev",
      version: "1.5.2",
    });
  });

  it("최초 추첨과 App 전용 재추첨 도구를 분리해 조회한다", async () => {
    const client = await createTestClient();
    const tools = await client.listTools();
    const instructions = client.getInstructions();

    expect(client.getServerVersion()).toMatchObject({
      name: "roulette-remote-mcp",
      version: "1.5.2",
    });
    expect(instructions).toContain("룰렛, 추첨, 랜덤 뽑기");
    expect(instructions).toContain("필요한 값만 사용자에게 질문");
    expect(instructions).toContain("추가 확인 없이 즉시 draw_roulette를 호출");
    expect(instructions).toContain(
      "draw_roulette를 호출하지 않고 후보를 직접 선택",
    );
    expect(instructions).toContain("MCP Apps UI가 렌더링되면");
    expect(instructions).toContain("텍스트 결과를 사용자에게 전달");
    expect(client.getServerCapabilities()?.extensions).toHaveProperty(
      EXTENSION_ID,
    );

    expect(tools.tools).toHaveLength(2);
    const drawTool = tools.tools.find((tool) => tool.name === "draw_roulette");
    const redrawTool = tools.tools.find(
      (tool) => tool.name === "redraw_roulette",
    );

    expect(drawTool).toMatchObject({
      name: "draw_roulette",
      title: "룰렛·무작위 추첨 실행",
      description: expect.stringContaining("반드시 이 도구를 호출"),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: {
          resourceUri: "ui://roulette/roulette-v6.html",
          visibility: ["model"],
        },
        "openai/outputTemplate": "ui://roulette/roulette-v6.html",
      },
      inputSchema: {
        properties: {
          rawInput: {
            description: expect.stringContaining("후보 목록 원문을 그대로 전달"),
          },
          drawCount: {
            description: expect.stringContaining("추첨 개수"),
          },
        },
      },
    });
    expect(drawTool?.inputSchema.required).toEqual([
      "rawInput",
      "drawCount",
    ]);
    expect(drawTool?.inputSchema.additionalProperties).toBe(false);
    expect(drawTool).not.toHaveProperty("outputSchema");

    expect(redrawTool).toMatchObject({
      name: "redraw_roulette",
      title: "현재 옵션으로 룰렛 재추첨",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { visibility: ["app"] },
        "openai/widgetAccessible": true,
        "openai/visibility": "private",
      },
    });
    expect(redrawTool?._meta).not.toHaveProperty("ui.resourceUri");
    expect(redrawTool?._meta).not.toHaveProperty("openai/outputTemplate");
    expect(redrawTool).not.toHaveProperty("outputSchema");
  });

  it("MCP Apps 룰렛 리소스와 과거 URI 호환 응답을 반환한다", async () => {
    const client = await createTestClient();
    const listed = await client.listResources();
    const templates = await client.listResourceTemplates();

    expect(listed.resources).toHaveLength(1);
    expect(listed.resources[0]).toMatchObject({
      uri: "ui://roulette/roulette-v6.html",
      mimeType: "text/html;profile=mcp-app",
    });
    expect(templates.resourceTemplates).toEqual([
      expect.objectContaining({
        name: "roulette-result-ui-legacy",
        uriTemplate: "ui://roulette/roulette-v{version}.html",
        mimeType: "text/html;profile=mcp-app",
      }),
    ]);

    const result = await client.readResource({
      uri: "ui://roulette/roulette-v6.html",
    });
    const resource = result.contents[0];

    expect(resource).toMatchObject({
      uri: "ui://roulette/roulette-v6.html",
      mimeType: "text/html;profile=mcp-app",
    });
    expect("text" in resource && resource.text).toContain("룰렛 추첨 결과");
    expect("text" in resource && resource.text).toContain(
      "ui/notifications/tool-result",
    );
    expect("text" in resource && resource.text).toContain("redraw_roulette");
    expect("text" in resource && resource.text).toContain("재추첨");
    expect("text" in resource && resource.text).toContain("현재 추첨 결과");
    expect("text" in resource && resource.text).not.toMatch(
      /(?:src|href)=["']https?:\/\//,
    );
    expect("text" in resource && resource.text).not.toMatch(
      /\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b/,
    );

    for (const legacyUri of [
      "ui://roulette/roulette-v1.html",
      "ui://roulette/roulette-v2.html",
      "ui://roulette/roulette-v3.html",
      "ui://roulette/roulette-v4.html",
      "ui://roulette/roulette-v5.html",
    ]) {
      const legacyResult = await client.readResource({ uri: legacyUri });

      expect(legacyResult.contents[0]).toMatchObject({
        uri: legacyUri,
        mimeType: "text/html;profile=mcp-app",
        text: expect.stringContaining("현재 추첨 결과"),
      });
    }

    await expect(
      client.readResource({ uri: "ui://roulette/roulette-v7.html" }),
    ).rejects.toThrow("ui://roulette/roulette-v7.html");
  });

  it("MCP Apps 비지원 호스트는 기존 텍스트 추첨 결과를 받는다", async () => {
    const client = await createTestClient();
    const drawResult = await client.callTool({
      name: "draw_roulette",
      arguments: {
        rawInput: "가,나,다",
        drawCount: 2,
      },
    });

    expect(drawResult.isError).not.toBe(true);
    expect(drawResult.content[0]).toMatchObject({
      type: "text",
      text: expect.stringContaining("추첨 결과"),
    });
    expect(drawResult.structuredContent).toMatchObject({
      candidateCount: 3,
      drawCount: 2,
      remainingCount: 1,
    });
    expect(drawResult._meta).toBeUndefined();
  });

  it("MCP Apps 지원 호스트에는 최초·재추첨 결과를 UI 전용 _meta로만 반환한다", async () => {
    const client = await createTestClient(handleVercelMcpRequest, true);
    const drawResult = await client.callTool({
      name: "draw_roulette",
      arguments: {
        rawInput: "가,나,다",
        drawCount: 2,
      },
    });
    const redrawResult = await client.callTool({
      name: "redraw_roulette",
      arguments: {
        rawInput: "가,나,다",
        drawCount: 2,
      },
    });

    for (const result of [drawResult, redrawResult]) {
      expect(result.isError).not.toBe(true);
      expect(result.content).toEqual([]);
      expect(result.structuredContent).toBeUndefined();
      expect(result._meta?.[ROULETTE_RESULT_META_KEY]).toMatchObject({
        candidateCount: 3,
        drawCount: 2,
        remainingCount: 1,
      });
    }
  });

  it("ChatGPT의 호출 메타데이터가 있으면 legacy 요청도 UI 전용 결과를 받는다", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "draw_roulette",
      arguments: {
        rawInput: "가,나,다",
        drawCount: 1,
      },
      _meta: { "openai/session": "test-chatgpt-session" },
    });

    expect(result.content).toEqual([]);
    expect(result.structuredContent).toBeUndefined();
    expect(result._meta?.[ROULETTE_RESULT_META_KEY]).toMatchObject({
      candidateCount: 3,
      drawCount: 1,
      remainingCount: 2,
    });
  });

  it("GET과 DELETE에 stateless 응답을 반환한다", async () => {
    for (const method of ["GET", "DELETE"]) {
      const response = await handleMcpRequest(
        new Request("http://localhost/mcp", { method }),
      );

      expect(response.status).toBe(405);
      expect(response.headers.get("cache-control")).toBe("no-store");
    }
  });

  it("다른 Origin과 지나치게 큰 요청을 payload 노출 없이 거부한다", async () => {
    const originResponse = await handleMcpRequest(
      new Request("https://roulette.example/mcp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "https://attacker.example",
        },
        body: JSON.stringify({ rawInput: "민감후보,다른후보" }),
      }),
    );
    const oversizedResponse = await handleMcpRequest(
      new Request("http://localhost/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "x".repeat(16 * 1_024 + 1),
      }),
    );

    expect(originResponse.status).toBe(403);
    expect(await originResponse.text()).not.toContain("민감후보");
    expect(oversizedResponse.status).toBe(413);
    expect(await oversizedResponse.text()).not.toContain("xxxx");
  });

  it("정상·도구 오류 처리 중 후보와 결과를 console에 기록하지 않는다", async () => {
    const consoleSpies = [
      vi.spyOn(console, "log").mockImplementation(() => undefined),
      vi.spyOn(console, "error").mockImplementation(() => undefined),
      vi.spyOn(console, "warn").mockImplementation(() => undefined),
      vi.spyOn(console, "info").mockImplementation(() => undefined),
      vi.spyOn(console, "debug").mockImplementation(() => undefined),
    ];
    const client = await createTestClient();

    await client.callTool({
      name: "draw_roulette",
      arguments: { rawInput: "민감후보,다른후보", drawCount: 1 },
    });
    await client.callTool({
      name: "draw_roulette",
      arguments: { rawInput: "민감후보", drawCount: "all" },
    });
    await client.callTool({
      name: "redraw_roulette",
      arguments: { rawInput: "민감후보,다른후보", drawCount: 1 },
    });

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
