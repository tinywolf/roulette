const POLICY_ERROR_CODE = -32000;

/** 공개 MCP Function의 요청 출처와 안전한 오류·응답 헤더를 관리한다. */
export function isRequestOriginAllowed(request: Request): boolean {
  const origin = request.headers.get("origin");

  if (origin === null) {
    return true;
  }

  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    const isOriginOnly =
      originUrl.pathname === "/" &&
      originUrl.search === "" &&
      originUrl.hash === "";

    return isOriginOnly && originUrl.origin === requestUrl.origin;
  } catch {
    return false;
  }
}

export function createPolicyErrorResponse(
  status: number,
  message: string,
): Response {
  return Response.json(
    {
      jsonrpc: "2.0",
      error: {
        code: POLICY_ERROR_CODE,
        message,
      },
      id: null,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}

export function secureMcpResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store");
  headers.set("X-Content-Type-Options", "nosniff");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
