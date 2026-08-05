import type { McpServer } from "@modelcontextprotocol/server";
import { ROULETTE_APP_RESOURCE } from "../../mcp-apps/roulette/generated/rouletteAppResource.js";

export const ROULETTE_APP_RESOURCE_URI = ROULETTE_APP_RESOURCE.uri;

/** 빌드된 MCP App HTML을 버전 고정 UI 리소스로 공개한다. */
export function registerRouletteAppResource(server: McpServer): void {
  server.registerResource(
    "roulette-result-ui",
    ROULETTE_APP_RESOURCE_URI,
    {
      title: "룰렛 추첨 결과",
      description: "서버에서 확정한 결과를 룰렛 애니메이션으로 표시합니다.",
      mimeType: ROULETTE_APP_RESOURCE.mimeType,
    },
    async () => ({ contents: [ROULETTE_APP_RESOURCE] }),
  );
}
