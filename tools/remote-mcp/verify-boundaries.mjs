import { readdir, readFile } from "node:fs/promises";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";
import { findWebFeatureImportFailures } from "./web-feature-boundaries.mjs";

const toolsDirectory = nodePath.dirname(fileURLToPath(import.meta.url));
const projectRoot = nodePath.resolve(toolsDirectory, "../..");
const coreRoot = nodePath.join(projectRoot, "src/core");
const webRoot = nodePath.join(projectRoot, "src/web");
const mcpRoot = nodePath.join(projectRoot, "src/mcp");
const mcpAppRoot = nodePath.join(projectRoot, "src/mcp-apps");
const generatedMcpAppRoot = nodePath.join(mcpAppRoot, "roulette/generated");
const apiRoot = nodePath.join(projectRoot, "api");
const failures = [];

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = nodePath.join(directory, entry.name);

      if (entry.isDirectory()) {
        return listSourceFiles(absolutePath);
      }

      return /\.(?:ts|tsx)$/.test(entry.name) ? [absolutePath] : [];
    }),
  );

  return files.flat();
}

function findImports(source) {
  const imports = [];
  const patterns = [
    /(?:from|import\s*\()\s*["']([^"']+)["']/g,
    /import\s*["']([^"']+)["']/g,
  ];

  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) {
      imports.push(match[1]);
    }
  }

  return imports;
}

function resolvesInside(importer, specifier, directory) {
  if (!specifier.startsWith(".")) {
    return false;
  }

  const resolved = nodePath.resolve(nodePath.dirname(importer), specifier);
  return resolved === directory || resolved.startsWith(`${directory}${nodePath.sep}`);
}

async function verifySources() {
  const groups = [
    { kind: "core", root: coreRoot },
    { kind: "web", root: webRoot },
    { kind: "mcp", root: mcpRoot },
    { kind: "mcp-app", root: mcpAppRoot },
    { kind: "api", root: apiRoot },
  ];

  for (const { kind, root } of groups) {
    for (const file of await listSourceFiles(root)) {
      if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) {
        continue;
      }

      // 생성 모듈에는 번들 문자열이 들어 있으므로 아래 소스 정적 검사의 대상이 아니다.
      if (kind === "mcp-app" && file.startsWith(generatedMcpAppRoot)) {
        continue;
      }

      const source = await readFile(file, "utf8");
      const relativeFile = nodePath.relative(projectRoot, file);

      if (
        (kind === "core" || kind === "mcp" || kind === "mcp-app" || kind === "api") &&
        /Math\.random\s*\(/.test(source)
      ) {
        failures.push(`${relativeFile}: Math.random 사용 금지`);
      }

      if (
        (kind === "mcp" || kind === "mcp-app" || kind === "api") &&
        /console\.(?:log|error|warn|info|debug)\s*\(/.test(source)
      ) {
        failures.push(`${relativeFile}: payload 유출 가능성이 있는 console 호출 금지`);
      }

      if (
        kind === "mcp-app" &&
        /(?:\bfetch\s*\(|\blocalStorage\b|\bsessionStorage\b|\.(?:sendMessage|sendFollowUpMessage)\s*\()/.test(
          source,
        )
      ) {
        failures.push(`${relativeFile}: MCP App의 외부 요청·저장·메시지 전송 금지`);
      }

      const serverToolCalls = source.match(/\.callServerTool\s*\(/g) ?? [];
      if (
        kind === "mcp-app" &&
        serverToolCalls.length > 0 &&
        (serverToolCalls.length !== 1 ||
          !source.includes('const REDRAW_ROULETTE_TOOL_NAME = "redraw_roulette"') ||
          !source.includes("name: REDRAW_ROULETTE_TOOL_NAME"))
      ) {
        failures.push(
          `${relativeFile}: MCP App에서는 app-only redraw_roulette 호출 하나만 허용`,
        );
      }

      for (const specifier of findImports(source)) {
        if (kind === "core") {
          if (!specifier.startsWith(".") || !resolvesInside(file, specifier, coreRoot)) {
            failures.push(`${relativeFile}: core 외부 의존성 ${specifier}`);
          }
        }

        if (
          kind === "web" &&
          (resolvesInside(file, specifier, mcpRoot) ||
            resolvesInside(file, specifier, mcpAppRoot) ||
            resolvesInside(file, specifier, apiRoot) ||
            specifier === "mcp-handler" ||
            specifier.startsWith("@modelcontextprotocol/"))
        ) {
          failures.push(`${relativeFile}: 웹에서 MCP 의존성 ${specifier}`);
        }

        if (kind === "web") {
          for (const failure of findWebFeatureImportFailures({
            importer: file,
            specifier,
            webRoot,
          })) {
            failures.push(`${relativeFile}: ${failure}`);
          }
        }

        if (
          (kind === "mcp" || kind === "api") &&
          (resolvesInside(file, specifier, webRoot) ||
            specifier === "react" ||
            specifier === "react-dom" ||
            specifier === "html-to-image")
        ) {
          failures.push(`${relativeFile}: MCP에서 웹 의존성 ${specifier}`);
        }

        if (
          (kind === "mcp" || kind === "api") &&
          resolvesInside(file, specifier, mcpAppRoot) &&
          !resolvesInside(file, specifier, generatedMcpAppRoot)
        ) {
          failures.push(`${relativeFile}: MCP에서 MCP App 런타임 소스 의존성 ${specifier}`);
        }

        if (
          kind === "mcp-app" &&
          (resolvesInside(file, specifier, coreRoot) ||
            resolvesInside(file, specifier, webRoot) ||
            resolvesInside(file, specifier, mcpRoot) ||
            resolvesInside(file, specifier, apiRoot) ||
            specifier === "react" ||
            specifier === "react-dom" ||
            specifier === "html-to-image" ||
            specifier === "mcp-handler" ||
            specifier === "@modelcontextprotocol/server")
        ) {
          failures.push(`${relativeFile}: MCP App 경계 밖 의존성 ${specifier}`);
        }
      }
    }
  }

  const apiFiles = (await listSourceFiles(apiRoot)).map((file) =>
    nodePath.relative(apiRoot, file),
  );
  if (apiFiles.length !== 1 || apiFiles[0] !== "mcp.ts") {
    failures.push(
      `api에는 Vercel Function 엔트리 mcp.ts만 허용: ${apiFiles.join(", ")}`,
    );
  }
}

async function verifyMcpAppResource() {
  const generatedSource = await readFile(
    nodePath.join(generatedMcpAppRoot, "rouletteAppResource.ts"),
    "utf8",
  );
  const requiredMarkers = [
    "ui://roulette/roulette-v6.html",
    "text/html;profile=mcp-app",
    "redraw_roulette",
    '\"connectDomains\":[]',
    '\"resourceDomains\":[]',
  ];

  for (const marker of requiredMarkers) {
    if (!generatedSource.includes(marker)) {
      failures.push(`생성된 MCP App 리소스에 필수 표식 없음: ${marker}`);
    }
  }
}

async function verifyVercelConfiguration() {
  const configuration = JSON.parse(
    await readFile(nodePath.join(projectRoot, "vercel.json"), "utf8"),
  );

  if (
    configuration.framework !== null ||
    configuration.buildCommand !== "npm run build:mcp" ||
    configuration.outputDirectory !== "vercel-static"
  ) {
    failures.push("Vercel은 웹 빌드 없이 MCP Function 전용이어야 함");
  }
}

async function verifyWebBundle() {
  const assetsDirectory = nodePath.join(projectRoot, "dist/assets");
  const assetNames = await readdir(assetsDirectory);
  const javascriptNames = assetNames.filter((name) => name.endsWith(".js"));
  const bundle = (
    await Promise.all(
      javascriptNames.map((name) =>
        readFile(nodePath.join(assetsDirectory, name), "utf8"),
      ),
    )
  ).join("\n");
  const forbiddenMarkers = [
    "@modelcontextprotocol",
    "mcp-handler",
    "draw_roulette",
    "redraw_roulette",
    "roulette-remote-mcp",
    "ui://roulette/roulette-v6.html",
    "text/html;profile=mcp-app",
  ];

  for (const marker of forbiddenMarkers) {
    if (bundle.includes(marker)) {
      failures.push(`dist 웹 번들에 MCP 표식 포함: ${marker}`);
    }
  }
}

await verifySources();
await verifyMcpAppResource();
await verifyWebBundle();
await verifyVercelConfiguration();

if (failures.length > 0) {
  for (const failure of failures) {
    process.stderr.write(`경계 검증 실패: ${failure}\n`);
  }

  process.exitCode = 1;
} else {
  process.stdout.write("소스 및 웹 번들 경계 검증 통과\n");
}
