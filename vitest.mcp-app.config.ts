import { defineConfig } from "vitest/config";

/** MCP App의 신뢰 경계와 표현 모델을 브라우저형 환경에서 검증한다. */
export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/mcp-apps/**/*.test.ts"],
    restoreMocks: true,
  },
});
