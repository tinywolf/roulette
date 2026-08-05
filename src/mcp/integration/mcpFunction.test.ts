import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it, vi } from "vitest";
import handleVercelMcpRequest, {
  handleMcpRequest,
} from "../../../api/mcp";

const clients: Client[] = [];

async function invokeVercelAdapter(request: Request): Promise<Response> {
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

  await handleVercelMcpRequest(incoming, outgoing);

  return new Response(responseBytes, {
    status: outgoing.statusCode,
    statusText: outgoing.statusMessage,
    headers: responseHeaders,
  });
}

async function createTestClient(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/mcp"),
    {
      fetch: async (input, init) =>
        invokeVercelAdapter(new Request(input, init)),
    },
  );
  const client = new Client({ name: "roulette-test-client", version: "1.0.0" });
  clients.push(client);
  await client.connect(transport);
  return client;
}

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
});

describe("Vercel MCP Function", () => {
  it("적극적인 사용 지침으로 초기화하고 UI가 연결된 단일 도구를 조회한다", async () => {
    const client = await createTestClient();
    const tools = await client.listTools();
    const instructions = client.getInstructions();

    expect(client.getServerVersion()).toMatchObject({
      name: "roulette-remote-mcp",
      version: "1.2.0",
    });
    expect(instructions).toContain("룰렛, 추첨, 랜덤 뽑기");
    expect(instructions).toContain("필요한 값만 사용자에게 질문");
    expect(instructions).toContain("추가 확인 없이 즉시 draw_roulette를 호출");
    expect(instructions).toContain(
      "draw_roulette를 호출하지 않고 후보를 직접 선택",
    );

    expect(tools.tools).toHaveLength(1);
    expect(tools.tools[0]).toMatchObject({
      name: "draw_roulette",
      title: "룰렛·무작위 추첨 실행",
      description: expect.stringContaining("반드시 이 도구를 호출"),
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        ui: { resourceUri: "ui://roulette/roulette-v1.html" },
        "openai/outputTemplate": "ui://roulette/roulette-v1.html",
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
    expect(tools.tools[0].inputSchema.required).toEqual([
      "rawInput",
      "drawCount",
    ]);
    expect(tools.tools[0].inputSchema.additionalProperties).toBe(false);
  });

  it("MCP Apps 룰렛 리소스를 표준 MIME과 자체 포함 HTML로 반환한다", async () => {
    const client = await createTestClient();
    const listed = await client.listResources();

    expect(listed.resources).toHaveLength(1);
    expect(listed.resources[0]).toMatchObject({
      uri: "ui://roulette/roulette-v1.html",
      mimeType: "text/html;profile=mcp-app",
    });

    const result = await client.readResource({
      uri: "ui://roulette/roulette-v1.html",
    });
    const resource = result.contents[0];

    expect(resource).toMatchObject({
      uri: "ui://roulette/roulette-v1.html",
      mimeType: "text/html;profile=mcp-app",
    });
    expect("text" in resource && resource.text).toContain("룰렛 추첨 결과");
    expect("text" in resource && resource.text).toContain(
      "ui/notifications/tool-result",
    );
    expect("text" in resource && resource.text).not.toMatch(
      /(?:src|href)=["']https?:\/\//,
    );
    expect("text" in resource && resource.text).not.toMatch(
      /\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b/,
    );
  });

  it("도구를 호출해 텍스트와 구조화 결과를 한 응답으로 받는다", async () => {
    const client = await createTestClient();
    const result = await client.callTool({
      name: "draw_roulette",
      arguments: {
        rawInput: "가,나,다",
        drawCount: 2,
      },
    });

    expect(result.isError).not.toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toMatchObject({ type: "text" });
    expect(result.structuredContent).toMatchObject({
      candidateCount: 3,
      drawCount: 2,
      remainingCount: 1,
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

    for (const spy of consoleSpies) {
      expect(spy).not.toHaveBeenCalled();
    }
  });
});
