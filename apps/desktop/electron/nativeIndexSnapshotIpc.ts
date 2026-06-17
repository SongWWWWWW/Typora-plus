import fs from "node:fs";
import path from "node:path";
import { app, ipcMain } from "electron";
import { isSafeNativeSnapshotStorageKey } from "./nativeStorageKeys.js";

export const nativeIndexSnapshotIpcChannels = {
  read: "typora-plus:index-snapshot:read",
  write: "typora-plus:index-snapshot:write"
} as const;

export interface NativeIndexSnapshotConfig {
  readonly storageDirectory: string;
  readonly maxValueBytes: number;
}

export function registerNativeIndexSnapshotIpc(config: NativeIndexSnapshotConfig): void {
  ipcMain.on(nativeIndexSnapshotIpcChannels.read, (event, key: string) => {
    event.returnValue = readIndexSnapshotValue(config, key);
  });

  ipcMain.on(nativeIndexSnapshotIpcChannels.write, (event, key: string, value: string) => {
    writeIndexSnapshotValue(config, key, value);
    event.returnValue = true;
  });
}

function readIndexSnapshotValue(config: NativeIndexSnapshotConfig, key: string): string | undefined {
  if (!isSafeNativeSnapshotStorageKey(key)) {
    return undefined;
  }

  const storagePath = indexSnapshotStoragePath(config, key);

  try {
    const value = fs.readFileSync(storagePath, "utf8");
    return Buffer.byteLength(value, "utf8") <= config.maxValueBytes ? value : undefined;
  } catch {
    return undefined;
  }
}

function writeIndexSnapshotValue(config: NativeIndexSnapshotConfig, key: string, value: string): void {
  if (!isSafeNativeSnapshotStorageKey(key)) {
    throw new Error("Invalid index snapshot key");
  }

  if (Buffer.byteLength(value, "utf8") > config.maxValueBytes) {
    throw new Error("Index snapshot value is too large");
  }

  const storagePath = indexSnapshotStoragePath(config, key);
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  fs.writeFileSync(storagePath, value, "utf8");
}

function indexSnapshotStoragePath(config: NativeIndexSnapshotConfig, key: string): string {
  return path.join(app.getPath("userData"), config.storageDirectory, `${key}.json`);
}
