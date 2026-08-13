import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createUIResource } from "@mcp-ui/server";

const toolsDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDirectory, "../..");
const htmlPath = path.join(
  projectRoot,
  "dist/mcp-apps/roulette/index.html",
);
const generatedDirectory = path.join(
  projectRoot,
  "src/mcp-apps/roulette/generated",
);
const generatedPath = path.join(
  generatedDirectory,
  "rouletteAppResource.ts",
);
const resourceUri = "ui://roulette/roulette-v6.html";

/** MCP-UI가 만든 표준 리소스를 현재 MCP SDK 2.x가 읽는 정적 모듈로 고정한다. */
const html = await readFile(htmlPath, "utf8");
const embeddedResource = createUIResource({
  uri: resourceUri,
  content: { type: "rawHtml", htmlString: html },
  encoding: "text",
  metadata: {
    title: "룰렛 추첨 결과",
    description:
      "서버에서 확정한 룰렛 당첨 결과를 애니메이션으로 표시하고 같은 옵션으로 재추첨합니다.",
    ui: {
      prefersBorder: true,
      csp: {
        connectDomains: [],
        resourceDomains: [],
      },
    },
    "openai/widgetDescription":
      "전체 추첨 결과와 요약을 순서대로 표시하고 현재 카드에서 재추첨하므로 대화에서 결과를 반복할 필요가 없습니다.",
    "openai/widgetPrefersBorder": true,
  },
  uiMetadata: {
    "preferred-frame-size": ["720px", "480px"],
  },
});

if (
  embeddedResource.resource.uri !== resourceUri ||
  embeddedResource.resource.mimeType !== "text/html;profile=mcp-app" ||
  !("text" in embeddedResource.resource)
) {
  throw new Error("MCP-UI가 예상한 표준 HTML 리소스를 생성하지 않았습니다.");
}

const generatedSource = `/** MCP App 빌드에서 생성한 자체 포함 UI 리소스다. 직접 수정하지 않는다. */
export const ROULETTE_APP_RESOURCE = ${JSON.stringify(embeddedResource.resource)} as const;
`;

await mkdir(generatedDirectory, { recursive: true });
await writeFile(generatedPath, generatedSource, "utf8");
