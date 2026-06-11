import fs from "node:fs";
import path from "node:path";
import { app, ipcMain, safeStorage } from "electron";

export const nativeAiIpcChannels = {
  deleteSecret: "typora-plus:ai:secret:delete",
  requestResponses: "typora-plus:ai:responses:request",
  setSecret: "typora-plus:ai:secret:set"
} as const;

export interface NativeAiConfig {
  readonly secretsStorageFile: string;
  readonly maxSecretBytes: number;
  readonly maxRequestBytes: number;
  readonly maxResponseBytes: number;
  readonly requestTimeoutMs: number;
}

interface SerializedNativeResponsesRequest {
  readonly endpointUrl: string;
  readonly secretRef: string;
  readonly body: string;
}

interface SerializedAiSecretStore {
  readonly version?: number;
  readonly values?: unknown;
}

export function registerNativeAiIpc(config: NativeAiConfig): void {
  ipcMain.handle(nativeAiIpcChannels.setSecret, async (_event, secretRef: string, value: string) => {
    setNativeAiSecret(config, secretRef, value);
    return true;
  });

  ipcMain.handle(nativeAiIpcChannels.deleteSecret, async (_event, secretRef: string) => {
    deleteNativeAiSecret(config, secretRef);
    return true;
  });

  ipcMain.handle(nativeAiIpcChannels.requestResponses, async (_event, request: SerializedNativeResponsesRequest) =>
    requestNativeResponses(config, request)
  );
}

function setNativeAiSecret(config: NativeAiConfig, secretRef: unknown, value: unknown): void {
  const normalizedSecretRef = normalizeSecretRef(secretRef);
  const normalizedValue = normalizeSecretValue(value, config);
  const encryptedValue = encryptSecret(normalizedValue);
  const store = {
    ...readSecretStore(config),
    [normalizedSecretRef]: encryptedValue
  };

  writeSecretStore(config, store);
}

function deleteNativeAiSecret(config: NativeAiConfig, secretRef: unknown): void {
  const normalizedSecretRef = normalizeSecretRef(secretRef);
  const store = readSecretStore(config);

  if (!(normalizedSecretRef in store)) {
    return;
  }

  const nextStore = { ...store };
  delete nextStore[normalizedSecretRef];
  writeSecretStore(config, nextStore);
}

async function requestNativeResponses(
  config: NativeAiConfig,
  request: unknown
): Promise<unknown> {
  const normalizedRequest = normalizeResponsesRequest(config, request);
  const apiKey = readNativeAiSecret(config, normalizedRequest.secretRef);

  if (!apiKey) {
    throw new Error("Missing AI secret");
  }

  const controller = new AbortController();
  const timeout = config.requestTimeoutMs > 0
    ? setTimeout(() => controller.abort(), config.requestTimeoutMs)
    : undefined;

  try {
    const response = await fetch(normalizedRequest.endpointUrl, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: normalizedRequest.body,
      signal: controller.signal
    });
    const responseText = await response.text();

    if (Buffer.byteLength(responseText, "utf8") > config.maxResponseBytes) {
      throw new Error("AI response is too large");
    }

    const parsed = responseText ? JSON.parse(responseText) : {};

    if (!response.ok && !hasErrorPayload(parsed)) {
      return {
        error: {
          message: `HTTP ${response.status} ${response.statusText}`.trim()
        }
      };
    }

    return parsed;
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

function readNativeAiSecret(config: NativeAiConfig, secretRef: string): string | undefined {
  const encryptedValue = readSecretStore(config)[secretRef];

  if (!encryptedValue) {
    return undefined;
  }

  return decryptSecret(encryptedValue);
}

function readSecretStore(config: NativeAiConfig): Record<string, string> {
  try {
    const parsed = JSON.parse(fs.readFileSync(secretStoragePath(config), "utf8")) as SerializedAiSecretStore;

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

function writeSecretStore(config: NativeAiConfig, values: Readonly<Record<string, string>>): void {
  const storagePath = secretStoragePath(config);
  fs.mkdirSync(path.dirname(storagePath), { recursive: true });
  fs.writeFileSync(storagePath, JSON.stringify({ version: 1, values }, null, 2), "utf8");
}

function normalizeResponsesRequest(
  config: NativeAiConfig,
  value: unknown
): SerializedNativeResponsesRequest {
  if (!isRecord(value)) {
    throw new Error("AI Responses request must be an object");
  }

  const endpointUrl = normalizeEndpointUrl(value.endpointUrl);
  const body = normalizeRequestBody(config, value.body);

  return {
    endpointUrl,
    secretRef: normalizeSecretRef(value.secretRef),
    body
  };
}

function normalizeEndpointUrl(value: unknown): string {
  if (typeof value !== "string" || value.length > 2000) {
    throw new Error("AI endpoint URL is invalid");
  }

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && !isLoopbackHttpUrl(url)) {
      throw new Error("AI endpoint URL protocol is not allowed");
    }

    return url.toString();
  } catch {
    throw new Error("AI endpoint URL is invalid");
  }
}

function normalizeRequestBody(config: NativeAiConfig, value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("AI request body must be a string");
  }

  if (Buffer.byteLength(value, "utf8") > config.maxRequestBytes) {
    throw new Error("AI request body is too large");
  }

  JSON.parse(value);
  return value;
}

function normalizeSecretRef(value: unknown): string {
  if (typeof value !== "string" || !isValidSecretRef(value)) {
    throw new Error("AI secret reference is invalid");
  }

  return value;
}

function normalizeSecretValue(value: unknown, config: NativeAiConfig): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("AI secret value must not be empty");
  }

  if (Buffer.byteLength(value, "utf8") > config.maxSecretBytes) {
    throw new Error("AI secret value is too large");
  }

  return value;
}

function encryptSecret(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("AI secret storage is unavailable");
  }

  return safeStorage.encryptString(value).toString("base64");
}

function decryptSecret(value: string): string | undefined {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error("AI secret storage is unavailable");
  }

  return safeStorage.decryptString(Buffer.from(value, "base64"));
}

function hasErrorPayload(value: unknown): boolean {
  return isRecord(value) && isRecord(value.error);
}

function isLoopbackHttpUrl(url: URL): boolean {
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

function isValidSecretRef(value: string): boolean {
  return value.length <= 256 && /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function secretStoragePath(config: NativeAiConfig): string {
  return path.join(app.getPath("userData"), config.secretsStorageFile);
}
