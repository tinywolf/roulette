import { createMcpHandler } from "mcp-handler";
import {
  MCP_SERVER_INFO,
  MCP_SERVER_OPTIONS,
  registerRouletteMcp,
} from "../src/mcp/server.js";
import {
  createPolicyErrorResponse,
  isRequestOriginAllowed,
  secureMcpResponse,
} from "../src/mcp/http/requestPolicy.js";

const MAX_REQUEST_BYTES = 16 * 1_024;

const internalHandler = createMcpHandler(
  registerRouletteMcp,
  {
    ...MCP_SERVER_OPTIONS,
    serverInfo: MCP_SERVER_INFO,
    verboseLogs: false,
  },
);

function cloneRequestWithBody(
  request: Request,
  body: ArrayBuffer | undefined,
): Request {
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    body,
    signal: request.signal,
  });
}

/** 공개 `/mcp` 요청을 payload 기록 없이 stateless MCP 처리기로 전달한다. */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (!isRequestOriginAllowed(request)) {
    return createPolicyErrorResponse(403, "Origin not allowed.");
  }

  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    return createPolicyErrorResponse(413, "Request body too large.");
  }

  const body =
    request.method === "GET" || request.method === "HEAD"
      ? undefined
      : await request.arrayBuffer();

  if (body && body.byteLength > MAX_REQUEST_BYTES) {
    return createPolicyErrorResponse(413, "Request body too large.");
  }

  const response = await internalHandler(cloneRequestWithBody(request, body));

  return secureMcpResponse(response);
}

export default handleMcpRequest;
