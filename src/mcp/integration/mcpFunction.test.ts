import {
  Client,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMcpRequest } from "../../../api/mcp";

const clients: Client[] = [];

async function createTestClient(): Promise<Client> {
  const transport = new StreamableHTTPClientTransport(
    new URL("http://localhost/mcp"),
    {
      fetch: async (input, init) => {
        const request = new Request(input, init);
        return handleMcpRequest(request);
      },
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
  it("Streamable HTTP로 초기화하고 단일 도구를 조회한다", async () => {
    const client = await createTestClient();
    const tools = await client.listTools();

    expect(tools.tools).toHaveLength(1);
    expect(tools.tools[0]).toMatchObject({
      name: "draw_roulette",
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: false,
      },
    });
    expect(tools.tools[0].inputSchema.required).toEqual([
      "rawInput",
      "drawCount",
    ]);
    expect(tools.tools[0].inputSchema.additionalProperties).toBe(false);
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
