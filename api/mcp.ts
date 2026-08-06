import type { IncomingMessage, ServerResponse } from "node:http";
import { createMcpHandler } from "mcp-handler";
import {
  MCP_SERVER_OPTIONS,
  MCP_SERVER_VERSION,
  registerRouletteMcp,
} from "../src/mcp/server.js";
import {
  createPolicyErrorResponse,
  isRequestOriginAllowed,
  secureMcpResponse,
} from "../src/mcp/http/requestPolicy.js";

const MAX_REQUEST_BYTES = 16 * 1_024;

type McpServerInfo = {
  name: string;
  version: string;
};

type McpWebRequestHandler = (request: Request) => Promise<Response>;

const PRODUCTION_MCP_SERVER_INFO = {
  name: "roulette-remote-mcp",
  version: MCP_SERVER_VERSION,
} as const;

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

async function createWebRequest(incoming: IncomingMessage): Promise<Request> {
  const headers = new Headers();

  for (let index = 0; index < incoming.rawHeaders.length; index += 2) {
    headers.append(incoming.rawHeaders[index], incoming.rawHeaders[index + 1]);
  }

  const forwardedProtocol = incoming.headers["x-forwarded-proto"];
  const protocol = Array.isArray(forwardedProtocol)
    ? forwardedProtocol[0]
    : (forwardedProtocol ?? "https");
  const host = incoming.headers.host ?? "localhost";
  const method = incoming.method ?? "GET";
  const chunks: Buffer[] = [];

  if (method !== "GET" && method !== "HEAD") {
    for await (const chunk of incoming) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
  }

  const bytes = chunks.length > 0 ? Buffer.concat(chunks) : undefined;
  const body = bytes
    ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    : undefined;

  return new Request(
    new URL(incoming.url ?? "/", `${protocol}://${host}`),
    { method, headers, body },
  );
}

async function sendWebResponse(
  response: Response,
  outgoing: ServerResponse,
): Promise<void> {
  outgoing.statusCode = response.status;
  if (response.statusText) outgoing.statusMessage = response.statusText;
  response.headers.forEach((value, name) => outgoing.setHeader(name, value));

  if (response.body === null) {
    outgoing.end();
    return;
  }

  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

/** 서버 식별자만 주입해 운영과 로컬 개발이 같은 정책·도구 계약을 사용하게 한다. */
export function createMcpRequestHandler(
  serverInfo: McpServerInfo,
): McpWebRequestHandler {
  const internalHandler = createMcpHandler(registerRouletteMcp, {
    ...MCP_SERVER_OPTIONS,
    serverInfo,
    verboseLogs: false,
  });

  return async (request: Request): Promise<Response> => {
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
  };
}

/** 공개 `/mcp` 요청을 운영 식별자의 stateless MCP 처리기로 전달한다. */
export const handleMcpRequest = createMcpRequestHandler(
  PRODUCTION_MCP_SERVER_INFO,
);

/** Node HTTP 요청을 선택한 Web Request 기반 MCP 처리기에 연결한다. */
export function createNodeMcpRequestHandler(
  requestHandler: McpWebRequestHandler,
): (incoming: IncomingMessage, outgoing: ServerResponse) => Promise<void> {
  return async (
    incoming: IncomingMessage,
    outgoing: ServerResponse,
  ): Promise<void> => {
    const request = await createWebRequest(incoming);
    const response = await requestHandler(request);

    await sendWebResponse(response, outgoing);
  };
}

/** Vercel Function은 항상 운영 서버 식별자를 사용한다. */
const handleVercelMcpRequest = createNodeMcpRequestHandler(handleMcpRequest);

export default handleVercelMcpRequest;
