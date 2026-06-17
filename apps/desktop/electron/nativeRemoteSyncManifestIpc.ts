import fs from "node:fs";
import path from "node:path";
import { app, ipcMain } from "electron";
import { isSafeNativeSnapshotStorageKey } from "./nativeStorageKeys.js";

export const nativeRemoteSyncManifestIpcChannels = {
  read: "typora-plus:remote-sync-manifest:read",
  write: "typora-plus:remote-sync-manifest:write"
} as const;

export interface NativeRemoteSyncManifestConfig {
  readonly storageDirectory: string;
  readonly maxValueBytes: number;
}

export function registerNativeRemoteSyncManifestIpc(config: NativeRemoteSyncManifestConfig): void {
  ipcMain.on(nativeRemoteSyncManifestIpcChannels.read, (event, key: string) => {
    event.returnValue = readRemoteSyncManifestValue(config, key);
  });

  ipcMain.on(nativeRemoteSyncManifestIpcChannels.write, (event, key: string, value: string) => {
    writeRemoteSyncManifestValue(config, key, value);
    event.returnValue = true;
  });
}

function readRemoteSyncManifestValue(config: NativeRemoteSyncManifestConfig, key: string): string | undefined {
  if (!isSafeNativeSnapshotStorageKey(key)) {
    return undefined;
  }

  const storagePath = remoteSyncManifestStoragePath(config, key);

  try {
    const value = fs.readFileSync(storagePath, "utf8");
    return Buffer.byteLength(value, "utf8") <= config.maxValueBytes ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeRemoteSyncManifestValue(
  config: NativeRemoteSyncManifestConfig,
  key: string,
  value: string
): void {
  if (!isSafeNativeSnapshotStorageKey(key)) {
    throw new Error("Invalid remote sync manifest key");
  }

  if (Buffer.byteLength(value, "utf8") > config.maxValueBytes) {
    throw new Error("Remote sync manifest value is too large");
  }

  const storagePath = remoteSyncManifestStoragePath(config, key);
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  fs.writeFileSync(storagePath, value, "utf8");
}

function remoteSyncManifestStoragePath(config: NativeRemoteSyncManifestConfig, key: string): string {
  return path.join(app.getPath("userData"), config.storageDirectory, `${key}.json`);
}
