import { createServer } from "node:http";
import handleVercelMcpRequest from "../../api/mcp.js";

const HOST = "127.0.0.1";
const PORT = Number.parseInt(process.env.MCP_PORT ?? "3000", 10);

/** 배포와 동일한 Vercel Node Function 진입점을 로컬 HTTP로 실행한다. */
const server = createServer(handleVercelMcpRequest);

server.listen(PORT, HOST, () => {
  console.info(`Local MCP server: http://${HOST}:${PORT}/mcp`);
});
