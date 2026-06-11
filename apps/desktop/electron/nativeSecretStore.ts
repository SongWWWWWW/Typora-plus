import fs from "node:fs";
import path from "node:path";
import { app, safeStorage } from "electron";

export interface NativeSecretStoreConfig {
  readonly secretsStorageFile: string;
  readonly maxSecretBytes: number;
}

interface SerializedNativeSecretStore {
  readonly version?: number;
  readonly values?: unknown;
}

export function setNativeSecret(
  config: NativeSecretStoreConfig,
  label: string,
  secretRef: unknown,
  value: unknown
): void {
  const normalizedSecretRef = normalizeNativeSecretRef(label, secretRef);
  const normalizedValue = normalizeNativeSecretValue(label, value, config);
  const encryptedValue = encryptSecret(label, normalizedValue);
  const store = {
    ...readSecretStore(config),
    [normalizedSecretRef]: encryptedValue
  };

  writeSecretStore(config, store);
}

export function deleteNativeSecret(
  config: NativeSecretStoreConfig,
  label: string,
  secretRef: unknown
): void {
  const normalizedSecretRef = normalizeNativeSecretRef(label, secretRef);
  const store = readSecretStore(config);

  if (!(normalizedSecretRef in store)) {
    return;
  }

  const nextStore = { ...store };
  delete nextStore[normalizedSecretRef];
  writeSecretStore(config, nextStore);
}

export function readNativeSecret(
  config: NativeSecretStoreConfig,
  label: string,
  secretRef: string
): string | undefined {
  const encryptedValue = readSecretStore(config)[secretRef];

  if (!encryptedValue) {
    return undefined;
  }

  return decryptSecret(label, encryptedValue);
}

export function normalizeNativeSecretRef(label: string, value: unknown): string {
  if (typeof value !== "string" || !isValidSecretRef(value)) {
    throw new Error(`${label} secret reference is invalid`);
  }

  return value;
}

function normalizeNativeSecretValue(
  label: string,
  value: unknown,
  config: NativeSecretStoreConfig
): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`${label} secret value must not be empty`);
  }

  if (Buffer.byteLength(value, "utf8") > config.maxSecretBytes) {
    throw new Error(`${label} secret value is too large`);
  }

  return value;
}

function readSecretStore(config: NativeSecretStoreConfig): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(secretStoragePath(config), "utf8")) as SerializedNativeSecretStore;

    if (!isRecord(parsed.values)) {
      return {};
    }

    return Object.fromEntries(Object.entries(parsed.values).filter((entry): entry is [string, string] =>
      isValidSecretRef(entry[0]) && typeof entry[1] === "string" && entry[1].length > 0
    ));
  } catch {
    return {};
  }
}

function writeSecretStore(config: NativeSecretStoreConfig, values: Readonly<Record<string, string>>): void {
  const storagePath = secretStoragePath(config);
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  fs.writeFileSync(storagePath, JSON.stringify({ version: 1, values }, null, 2), "utf8");
}

function encryptSecret(label: string, value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(`${label} secret storage is unavailable`);
  }

  return safeStorage.encryptString(value).toString("base64");
}

function decryptSecret(label: string, value: string): string | undefined {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error(`${label} secret storage is unavailable`);
  }

  return safeStorage.decryptString(Buffer.from(value, "base64"));
}

function isValidSecretRef(value: string): boolean {
  return value.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function secretStoragePath(config: NativeSecretStoreConfig): string {
  return path.join(app.getPath("userData"), config.secretsStorageFile);
}
