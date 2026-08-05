import { defineConfig } from "vitest/config";

/** MCP 도구와 전송 계층을 브라우저 환경 없이 검증한다. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/mcp/**/*.test.ts", "api/**/*.test.ts"],
    restoreMocks: true,
  },
});
