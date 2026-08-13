import { defineConfig } from "vitest/config";

/** 프레임워크 독립적인 공통 파싱·난수·추첨 규칙만 검증한다. */
export default defineConfig({
  test: {
    name: "core",
    environment: "node",
    include: ["src/core/**/*.test.ts"],
    restoreMocks: true,
  },
});
