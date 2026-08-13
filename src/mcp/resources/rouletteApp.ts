import {
  ResourceNotFoundError,
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/server";
import { ROULETTE_APP_RESOURCE } from "../../mcp-apps/roulette/generated/rouletteAppResource.js";

export const ROULETTE_APP_RESOURCE_URI = ROULETTE_APP_RESOURCE.uri;
export const ROULETTE_APP_LEGACY_RESOURCE_URI_TEMPLATE =
  "ui://roulette/roulette-v{version}.html";

const ROULETTE_APP_RESOURCE_METADATA = {
  title: "룰렛 추첨 결과",
  description: "서버에서 확정한 결과를 룰렛 애니메이션으로 표시합니다.",
  mimeType: ROULETTE_APP_RESOURCE.mimeType,
} as const;

/** 생성 리소스 URI와 요청 변수가 실제 과거 숫자 버전을 가리키는지 판별한다. */
function isLegacyResourceVersion(version: string | string[]): boolean {
  if (typeof version !== "string" || !/^[1-9]\d*$/.test(version)) {
    return false;
  }

  const currentVersion = ROULETTE_APP_RESOURCE_URI.match(
    /\/roulette-v([1-9]\d*)\.html$/,
  )?.[1];

  return currentVersion !== undefined && Number(version) < Number(currentVersion);
}

/** 요청 URI를 보존하면서 현재 MCP App 번들을 리소스 응답으로 만든다. */
function createRouletteAppResourceResponse(requestedUri: URL) {
  return {
    contents: [
      {
        ...ROULETTE_APP_RESOURCE,
        uri: requestedUri.toString(),
      },
    ],
  };
}

/** 현재 앱과 캐시된 과거 도구 메타데이터용 URI 템플릿을 함께 공개한다. */
export function registerRouletteAppResource(server: McpServer): void {
  server.registerResource(
    "roulette-result-ui",
    ROULETTE_APP_RESOURCE_URI,
    ROULETTE_APP_RESOURCE_METADATA,
    async (requestedUri) => createRouletteAppResourceResponse(requestedUri),
  );

  server.registerResource(
    "roulette-result-ui-legacy",
    new ResourceTemplate(ROULETTE_APP_LEGACY_RESOURCE_URI_TEMPLATE, {
      list: undefined,
    }),
    ROULETTE_APP_RESOURCE_METADATA,
    async (requestedUri, variables) => {
      if (!isLegacyResourceVersion(variables.version)) {
        throw new ResourceNotFoundError(requestedUri.toString());
      }

      return createRouletteAppResourceResponse(requestedUri);
    },
  );
}
