import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const source = join(workspaceRoot, "scripts", "lark-cli-raw-mirror-gateway.mjs");
const target = join(
  workspaceRoot,
  "apps",
  "desktop",
  "dist-electron",
  "scripts",
  "lark-cli-raw-mirror-gateway.mjs"
);

await mkdir(dirname(target), { recursive: true });
await copyFile(source, target);
