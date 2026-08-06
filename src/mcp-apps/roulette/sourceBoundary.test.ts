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
    expect(html).toContain('aria-label="복사 가능한 추첨 결과"');
    expect(html).toContain('data-text-result');
    expect(html).not.toContain("<textarea");
    expect(html).not.toContain("data-copy");
    expect(html).toContain("prefers-reduced-motion: reduce");
    expect(html).not.toMatch(/<(?:script|link|img)[^>]+(?:src|href)=["']https?:\/\//);
  });

  it("결과 이름을 텍스트로 렌더링하고 재추첨 외 저장·외부 호출을 하지 않는다", async () => {
    const source = await readFile(`${sourceDirectory}/app.ts`, "utf8");

    expect(source).toContain("name.textContent = result.name");
    expect(source).not.toContain("innerHTML");
    expect(source).not.toMatch(/\b(?:fetch|localStorage|sessionStorage)\b/);
    expect(source).toContain("callServerTool");
    expect(source).toContain('name: REDRAW_ROULETTE_TOOL_NAME');
    expect(source).toContain('const ROULETTE_RESULT_META_KEY = "roulette/result"');
    expect(source).toContain("toolResult._meta?.[ROULETTE_RESULT_META_KEY]");
    expect(source).toContain("toolResult.structuredContent");
    expect(source).not.toContain("updateModelContext");
    expect(source).not.toMatch(/\.(?:sendMessage|sendFollowUpMessage)\s*\(/);
    expect(source).toContain('status.textContent = "현재 추첨 결과"');
    expect(source).toContain("추첨 결과:");
    expect(source).toContain("개 추첨 완료");
    expect(source).not.toMatch(/명 당첨|명 미추첨/);
  });
});
