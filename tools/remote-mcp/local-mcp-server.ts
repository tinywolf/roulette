import { createServer } from "node:http";
import { handleMcpRequest } from "../../api/mcp.js";

const HOST = "127.0.0.1";
const PORT = 3_000;

/** Vercel의 Web Request 진입점을 배포 없이 HTTP로 검증하는 최소 로컬 어댑터다. */
const server = createServer(async (incoming, outgoing) => {
  const chunks: Buffer[] = [];

  for await (const chunk of incoming) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const headers = new Headers();
  for (const [name, value] of Object.entries(incoming.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(name, item);
    } else if (value !== undefined) {
      headers.set(name, value);
    }
  }

  const body = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const request = new Request(
    `http://${incoming.headers.host ?? `${HOST}:${PORT}`}${incoming.url ?? "/"}`,
    {
      method: incoming.method,
      headers,
      body,
    },
  );
  const response = await handleMcpRequest(request);

  outgoing.statusCode = response.status;
  response.headers.forEach((value, name) => outgoing.setHeader(name, value));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
});

server.listen(PORT, HOST, () => {
  console.info(`Local MCP server: http://${HOST}:${PORT}/mcp`);
});
