import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const nativeChannelSourceFiles = [
  "nativeAiIpc.ts",
  "nativeConfigurationIpc.ts",
  "nativeExportIpc.ts",
  "nativeFileIpc.ts",
  "nativeIndexSnapshotIpc.ts",
  "nativeRemoteSyncManifestIpc.ts",
  "nativeRemoteSyncRequestIpc.ts",
  "nativeRemoteSyncSecretIpc.ts",
  "nativeWindowIpc.ts"
];

describe("preload native IPC channels", () => {
  it("keeps preload channel strings aligned with native IPC modules", () => {
    const preloadChannels = extractTyporaPlusChannels(readElectronSource("preload.cts"));
    const nativeChannels = nativeChannelSourceFiles
      .flatMap((fileName) => extractTyporaPlusChannels(readElectronSource(fileName)))
      .sort();

    expect(preloadChannels).toEqual(nativeChannels);
  });
});

function readElectronSource(fileName: string): string {
  return fs.readFileSync(path.join(currentDir, fileName), "utf8");
}

function extractTyporaPlusChannels(source: string): readonly string[] {
  return [...source.matchAll(/"(?<channel>typora-plus:[^"]+)"/g)]
    .map((match) => match.groups?.channel)
    .filter((channel): channel is string => typeof channel === "string")
    .sort();
}
