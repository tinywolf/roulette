import { defineConfig } from "vitest/config";

/** 대상별 환경과 setup을 격리한 네 테스트 프로젝트를 기본 명령으로 실행한다. */
export default defineConfig({
  test: {
    projects: [
      "./vitest.core.config.ts",
      "./vitest.web.config.ts",
      "./vitest.mcp-app.config.ts",
      "./vitest.mcp.config.ts",
    ],
  },
});
