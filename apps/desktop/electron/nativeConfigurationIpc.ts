import fs from "node:fs";
import path from "node:path";
import { app, ipcMain } from "electron";
import { isSafeNativeConfigurationStorageKey } from "./nativeStorageKeys.js";

export const nativeConfigurationIpcChannels = {
  read: "typora-plus:configuration:read",
  write: "typora-plus:configuration:write"
} as const;

export interface NativeConfigurationConfig {
  readonly storageFile: string;
  readonly maxValueBytes: number;
}

export function registerNativeConfigurationIpc(config: NativeConfigurationConfig): void {
  ipcMain.on(nativeConfigurationIpcChannels.read, (event, key: string) => {
    event.returnValue = readConfigurationValue(config, key);
  });

  ipcMain.on(nativeConfigurationIpcChannels.write, (event, key: string, value: string) => {
    writeConfigurationValue(config, key, value);
    event.returnValue = true;
  });
}

function readConfigurationValue(config: NativeConfigurationConfig, key: string): string | undefined {
  if (!isSafeNativeConfigurationStorageKey(key)) {
    return undefined;
  }

  return readConfigurationStore(config)[key];
}

function writeConfigurationValue(config: NativeConfigurationConfig, key: string, value: string): void {
  if (!isSafeNativeConfigurationStorageKey(key)) {
    throw new Error("Invalid configuration key");
  }

  if (Buffer.byteLength(value, "utf8") > config.maxValueBytes) {
    throw new Error("Configuration value is too large");
  }

  const store = {
    ...readConfigurationStore(config),
    [key]: value
  };
  const storagePath = configurationStoragePath(config);
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  fs.writeFileSync(storagePath, JSON.stringify({ version: 1, values: store }, null, 2), "utf8");
}

function readConfigurationStore(config: NativeConfigurationConfig): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(configurationStoragePath(config), "utf8")) as SerializedConfigurationStore;

    if (!isRecord(parsed.values)) {
      return {};
    }

    return Object.fromEntries(Object.entries(parsed.values).filter((entry): entry is [string, string] =>
      isSafeNativeConfigurationStorageKey(entry[0]) &&
      typeof entry[1] === "string" &&
      Buffer.byteLength(entry[1], "utf8") <= config.maxValueBytes
    ));
  } catch {
    return {};
  }
}

interface SerializedConfigurationStore {
  readonly values?: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configurationStoragePath(config: NativeConfigurationConfig): string {
  return path.join(app.getPath("userData"), config.storageFile);
}
