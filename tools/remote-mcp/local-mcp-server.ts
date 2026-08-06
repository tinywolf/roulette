import { createServer } from "node:http";
import { performance } from "node:perf_hooks";
import {
  createMcpRequestHandler,
  createNodeMcpRequestHandler,
} from "../../api/mcp.js";
import { MCP_SERVER_VERSION } from "../../src/mcp/server.js";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.MCP_PORT ?? "3000", 10);
const DEVELOPMENT_MCP_SERVER_INFO = {
  name: "roulette-remote-mcp-dev",
  version: MCP_SERVER_VERSION,
} as const;

const developmentMcpHandler = createNodeMcpRequestHandler(
  createMcpRequestHandler(DEVELOPMENT_MCP_SERVER_INFO),
);

/** 비민감 HTTP 메타데이터만 출력하며 개발 식별자의 MCP 서버를 실행한다. */
const server = createServer(async (incoming, outgoing) => {
  const startedAt = performance.now();
  const method = incoming.method ?? "UNKNOWN";
  const pathname = new URL(incoming.url ?? "/", "http://localhost").pathname;

  outgoing.once("finish", () => {
    const duration = Math.round(performance.now() - startedAt);
    console.info(
      `[roulette-mcp-dev] ${method} ${pathname} ${outgoing.statusCode} ${duration}ms`,
    );
  });

  try {
    await developmentMcpHandler(incoming, outgoing);
  } catch (error) {
    const errorName = error instanceof Error ? error.name : "UnknownError";
    console.error(`[roulette-mcp-dev] request failed: ${errorName}`);

    if (!outgoing.headersSent) outgoing.statusCode = 500;
    if (!outgoing.writableEnded) outgoing.end();
  }
});

server.listen(PORT, HOST, () => {
  console.info("[roulette-mcp-dev] development mode enabled");
  console.info(`[roulette-mcp-dev] server: ${DEVELOPMENT_MCP_SERVER_INFO.name}`);
  console.info(`[roulette-mcp-dev] endpoint: http://${HOST}:${PORT}/mcp`);
});
