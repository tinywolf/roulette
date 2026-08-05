import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const sourceDirectory = path.join(
  process.cwd(),
  "src/mcp-apps/roulette",
);

describe("MCP App 소스 경계", () => {
  it("자체 포함 UI와 접근성·애니메이션 감소 계약을 선언한다", async () => {
    const html = await readFile(`${sourceDirectory}/index.html`, "utf8");

    expect(html).toContain('aria-live="polite"');
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).not.toMatch(/<(?:script|link|img)[^>]+(?:src|href)=["']https?:\/\//);
  });

  it("결과 이름을 HTML이 아니라 텍스트로 렌더링하고 저장·외부 호출을 하지 않는다", async () => {
    const source = await readFile(`${sourceDirectory}/app.ts`, "utf8");

    expect(source).toContain("name.textContent = result.name");
    expect(source).not.toContain("innerHTML");
    expect(source).not.toMatch(/\b(?:fetch|localStorage|sessionStorage)\b/);
    expect(source).not.toContain("callServerTool");
  });
});
