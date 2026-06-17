import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@typora-plus/base": path.resolve(root, "packages/base/src/index.ts"),
      "@typora-plus/platform": path.resolve(root, "packages/platform/src/index.ts"),
      "@typora-plus/markdown": path.resolve(root, "packages/markdown/src/index.ts"),
      "@typora-plus/theme": path.resolve(root, "packages/theme/src/index.ts"),
      "@typora-plus/editor": path.resolve(root, "packages/editor/src/index.ts"),
      "@typora-plus/workbench": path.resolve(root, "packages/workbench/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "apps/**/*.test.ts", "scripts/**/*.test.mjs"],
    passWithNoTests: false
  }
});
