import { readFile, readdir } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";

/** Vercel Build Output이 MCP Function 전용 경계를 지키는지 검사한다. */
const outputDirectory = resolve(process.argv[2] ?? ".vercel/output");
const functionDirectory = join(
  outputDirectory,
  "functions",
  "api",
  "mcp.func",
);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(path)));
    else files.push(path);
  }

  return files;
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const outputConfig = JSON.parse(
  await readFile(join(outputDirectory, "config.json"), "utf8"),
);
const functionConfig = JSON.parse(
  await readFile(join(functionDirectory, ".vc-config.json"), "utf8"),
);
const functionFiles = (await listFiles(functionDirectory)).map((path) =>
  relative(functionDirectory, path),
);
const staticFiles = (await listFiles(join(outputDirectory, "static"))).map(
  (path) => relative(join(outputDirectory, "static"), path),
);

assert(
  outputConfig.routes.some(
    (route) => route.src === "^/mcp$" && route.dest === "/api/mcp",
  ),
  "공개 /mcp rewrite가 Build Output에 없습니다.",
);
assert(functionConfig.handler === "api/mcp.js", "MCP Function handler가 다릅니다.");
assert(functionConfig.maxDuration === 10, "MCP Function 제한 시간이 10초가 아닙니다.");
assert(
  staticFiles.every((path) => basename(path) === ".gitkeep"),
  `예상하지 못한 Vercel 정적 파일이 있습니다: ${staticFiles.join(", ")}`,
);

const forbiddenFunctionPaths = [
  "src/web/",
  "src/mcp-apps/",
  "node_modules/react/",
  "node_modules/react-dom/",
  "node_modules/html-to-image/",
];
for (const forbiddenPath of forbiddenFunctionPaths) {
  assert(
    !functionFiles.some((path) => path.startsWith(forbiddenPath)),
    `MCP Function에 웹 전용 코드가 포함됐습니다: ${forbiddenPath}`,
  );
}

assert(
  functionFiles.includes("src/core/draw.js") &&
    functionFiles.includes("src/mcp/server.js") &&
    functionFiles.includes(
      "src/mcp/resources/generated/rouletteAppResource.js",
    ),
  "MCP Function에 필요한 공통 코어, 서버 또는 생성 UI 리소스가 없습니다.",
);

console.info("Vercel Function 전용 Build Output 검증 통과");
