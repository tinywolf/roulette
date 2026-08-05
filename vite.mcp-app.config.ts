import { fileURLToPath, URL } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const appRoot = fileURLToPath(
  new URL("./src/mcp-apps/roulette", import.meta.url),
);
const outputDirectory = fileURLToPath(
  new URL("./dist/mcp-apps/roulette", import.meta.url),
);

/** MCP Apps sandbox가 외부 자산 없이 읽을 수 있는 단일 HTML을 만든다. */
export default defineConfig({
  root: appRoot,
  base: "./",
  plugins: [viteSingleFile()],
  build: {
    modulePreload: { polyfill: false },
    outDir: outputDirectory,
    emptyOutDir: true,
    rollupOptions: {
      input: path.join(appRoot, "index.html"),
    },
  },
});
