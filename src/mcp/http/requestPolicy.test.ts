import { describe, expect, it } from "vitest";
import {
  createPolicyErrorResponse,
  isRequestOriginAllowed,
  secureMcpResponse,
} from "./requestPolicy";

describe("MCP requestPolicy", () => {
  it("Origin이 없거나 요청 URL과 같은 Origin만 허용한다", () => {
    expect(
      isRequestOriginAllowed(new Request("https://roulette.example/mcp")),
    ).toBe(true);
    expect(
      isRequestOriginAllowed(
        new Request("https://roulette.example/mcp", {
          headers: { Origin: "https://roulette.example" },
        }),
      ),
    ).toBe(true);
    expect(
      isRequestOriginAllowed(
        new Request("https://roulette.example/mcp", {
          headers: { Origin: "https://attacker.example" },
        }),
      ),
    ).toBe(false);
  });

  it("정책 오류와 일반 응답에 비저장 보안 헤더를 설정한다", async () => {
    const policyError = createPolicyErrorResponse(403, "Origin not allowed.");
    const secured = secureMcpResponse(new Response("ok"));

    expect(policyError.headers.get("cache-control")).toBe("no-store");
    expect(policyError.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await policyError.text()).not.toContain("attacker.example");
    expect(secured.headers.get("cache-control")).toBe("no-store");
    expect(secured.headers.get("x-content-type-options")).toBe("nosniff");
  });
});
