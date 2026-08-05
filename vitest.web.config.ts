import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

/** 웹 UI 회귀 테스트만 실행해 MCP와 독립적인 검증 경계를 제공한다. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    include: ["src/web/**/*.test.{ts,tsx}"],
    setupFiles: ["./src/web/test/setup.ts"],
    restoreMocks: true,
  },
});
