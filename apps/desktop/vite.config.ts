import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const appRoot = fileURLToPath(new URL(".", import.meta.url));
const workspaceRoot = path.resolve(appRoot, "../..");
const mermaidChunkPackageNames = [
  "@braintree/sanitize-url",
  "@iconify",
  "@mermaid-js",
  "@upsetjs",
  "cytoscape",
  "cytoscape-cose-bilkent",
  "cytoscape-fcose",
  "d3",
  "d3-",
  "dagre-d3-es",
  "dayjs",
  "dompurify",
  "es-toolkit",
  "elkjs",
  "khroma",
  "mermaid",
  "roughjs",
  "stylis",
  "ts-dedent",
  "uuid"
];

export default defineConfig({
  base: "./",
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@typora-plus/theme/tokens.css", replacement: path.resolve(workspaceRoot, "packages/theme/src/tokens.css") },
      { find: "@typora-plus/base", replacement: path.resolve(workspaceRoot, "packages/base/src/index.ts") },
      { find: "@typora-plus/platform", replacement: path.resolve(workspaceRoot, "packages/platform/src/index.ts") },
      { find: "@typora-plus/markdown", replacement: path.resolve(workspaceRoot, "packages/markdown/src/index.ts") },
      { find: "@typora-plus/theme", replacement: path.resolve(workspaceRoot, "packages/theme/src/index.ts") },
      { find: "@typora-plus/editor", replacement: path.resolve(workspaceRoot, "packages/editor/src/index.ts") },
      { find: "@typora-plus/workbench", replacement: path.resolve(workspaceRoot, "packages/workbench/src/index.ts") }
    ]
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: false
  },
  build: {
    outDir: "dist/renderer",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (isMermaidChunkModule(id)) {
            return "mermaid";
          }

          if (id.includes("@codemirror/view") || id.includes("@codemirror/state")) {
            return "cm-core";
          }

          if (id.includes("@codemirror") || id.includes("@lezer")) {
            return "cm-language";
          }

          if (id.includes("react") || id.includes("react-dom")) {
            return "react";
          }

          if (id.includes("lucide-react")) {
            return "icons";
          }

          return "vendor";
        }
      }
    }
  }
});

function isMermaidChunkModule(id: string): boolean {
  const normalizedId = id.replaceAll("\\", "/");

  return mermaidChunkPackageNames.some((packageName) =>
    normalizedId.includes(`/node_modules/${packageName}`)
  );
}
