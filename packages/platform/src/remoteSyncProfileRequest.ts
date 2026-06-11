import {
  createNativeRemoteSyncRequestTransport,
  type RemoteSyncNativeRequestBodyEncoding,
  type RemoteSyncNativeRequestInput,
  type RemoteSyncNativeRequestMethod,
  type RemoteSyncNativeMultipartPart,
  type RemoteSyncNativeRequestTransport,
  type RemoteSyncNativeResponse,
  type RemoteSyncNativeResponseType
} from "./remoteSyncNativeRequest";
import {
  normalizeRemoteSyncProviderConfiguration,
  type RemoteSyncProviderConfiguration
} from "./configuration";

export type RemoteSyncProfileQueryValue = boolean | number | string | null | undefined;

export interface RemoteSyncProfileSecretHeader {
  readonly name: string;
  readonly secretName: string;
  readonly prefix?: string;
}

export interface RemoteSyncProfileSecretJsonField {
  readonly name: string;
  readonly secretName: string;
}

export interface RemoteSyncProfileRequestInput {
  readonly path?: string;
  readonly query?: Readonly<Record<string, RemoteSyncProfileQueryValue>>;
  readonly method: RemoteSyncNativeRequestMethod;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
  readonly bodyEncoding?: RemoteSyncNativeRequestBodyEncoding;
  readonly multipart?: readonly RemoteSyncNativeMultipartPart[];
  readonly responseType?: RemoteSyncNativeResponseType;
  readonly secretHeaders?: readonly RemoteSyncProfileSecretHeader[];
  readonly secretJsonFields?: readonly RemoteSyncProfileSecretJsonField[];
  readonly signal?: AbortSignal;
}

export type RemoteSyncProfileRequestTransport =
  (request: RemoteSyncProfileRequestInput) => Promise<RemoteSyncNativeResponse>;

type RemoteSyncNativeSecretHeaders = NonNullable<RemoteSyncNativeRequestInput["secretHeaders"]>;
type RemoteSyncNativeSecretJsonFields = NonNullable<RemoteSyncNativeRequestInput["secretJsonFields"]>;

const remoteSyncProfileRequestLimits = {
  maxPathLength: 2000,
  maxQueryEntries: 64,
  maxQueryKeyLength: 128,
  maxQueryValueLength: 1024
} as const;

export function createRemoteSyncProfileRequestTransport(
  profile: RemoteSyncProviderConfiguration,
  transport: RemoteSyncNativeRequestTransport | undefined = createNativeRemoteSyncRequestTransport()
): RemoteSyncProfileRequestTransport | undefined {
  if (!transport) {
    return undefined;
  }

  const normalizedProfile = normalizeRemoteSyncProviderProfile(profile);

  return async (request) => transport(createRemoteSyncNativeRequestFromProfile(normalizedProfile, request));
}

function createRemoteSyncNativeRequestFromProfile(
  profile: RemoteSyncProviderConfiguration,
  request: RemoteSyncProfileRequestInput
): RemoteSyncNativeRequestInput {
  const secretHeaders = createProfileSecretHeaders(profile, request.secretHeaders);
  const secretJsonFields = createProfileSecretJsonFields(profile, request.secretJsonFields);

  return {
    url: resolveRemoteSyncProfileRequestUrl(profile, request.path, request.query),
    method: request.method,
    ...(request.headers !== undefined ? { headers: request.headers } : {}),
    ...(request.body !== undefined ? { body: request.body } : {}),
    ...(request.bodyEncoding !== undefined ? { bodyEncoding: request.bodyEncoding } : {}),
    ...(request.multipart !== undefined ? { multipart: request.multipart } : {}),
    ...(request.responseType !== undefined ? { responseType: request.responseType } : {}),
    ...(secretHeaders !== undefined ? { secretHeaders } : {}),
    ...(secretJsonFields !== undefined ? { secretJsonFields } : {}),
    ...(request.signal !== undefined ? { signal: request.signal } : {})
  };
}

function resolveRemoteSyncProfileRequestUrl(
  profile: RemoteSyncProviderConfiguration,
  path: string | undefined,
  query: Readonly<Record<string, RemoteSyncProfileQueryValue>> | undefined
): string {
  const baseUrl = createDirectoryBaseUrl(profile.baseUrl);
  const url = new URL(normalizeRemoteSyncProfileRequestPath(path), baseUrl);

  appendRemoteSyncProfileQuery(url, query);
  return url.toString();
}

function createDirectoryBaseUrl(value: string): string {
  const url = new URL(value);

  if (!url.pathname.endsWith("/")) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

function normalizeRemoteSyncProfileRequestPath(value: string | undefined): string {
  if (value === undefined) {
    return "";
  }

  if (typeof value !== "string" || value.length > remoteSyncProfileRequestLimits.maxPathLength) {
    throw new Error("Remote sync profile request path is invalid");
  }

  const normalized = value.trim();

  if (!normalized) {
    return "";
  }

  if (
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    normalized.includes("\\")
  ) {
    throw new Error("Remote sync profile request path must be relative");
  }

  if (/[?#]/.test(normalized)) {
    throw new Error("Remote sync profile request path must not contain query or fragment data");
  }

  if (hasRemoteSyncProfileParentTraversal(normalized)) {
    throw new Error("Remote sync profile request path must not contain parent traversal");
  }

  return normalized;
}

function appendRemoteSyncProfileQuery(
  url: URL,
  query: Readonly<Record<string, RemoteSyncProfileQueryValue>> | undefined
): void {
  if (query === undefined) {
    return;
  }

  if (!isRecord(query)) {
    throw new Error("Remote sync profile request query must be an object");
  }

  const entries = Object.entries(query);

  if (entries.length > remoteSyncProfileRequestLimits.maxQueryEntries) {
    throw new Error("Remote sync profile request query has too many entries");
  }

  for (const [rawKey, rawValue] of entries) {
    if (rawValue === undefined || rawValue === null) {
      continue;
    }

    const key = normalizeRemoteSyncProfileQueryKey(rawKey);
    const value = normalizeRemoteSyncProfileQueryValue(rawValue);

    url.searchParams.set(key, value);
  }
}

function normalizeRemoteSyncProfileQueryKey(value: string): string {
  const normalized = value.trim();

  if (!normalized || normalized.length > remoteSyncProfileRequestLimits.maxQueryKeyLength) {
    throw new Error("Remote sync profile request query key is invalid");
  }

  return normalized;
}

function normalizeRemoteSyncProfileQueryValue(value: Exclude<RemoteSyncProfileQueryValue, null | undefined>): string {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Remote sync profile request query value is invalid");
  }

  const normalized = String(value);

  if (normalized.length > remoteSyncProfileRequestLimits.maxQueryValueLength) {
    throw new Error("Remote sync profile request query value is too large");
  }

  return normalized;
}

function createProfileSecretHeaders(
  profile: RemoteSyncProviderConfiguration,
  headers: readonly RemoteSyncProfileSecretHeader[] | undefined
): RemoteSyncNativeSecretHeaders | undefined {
  if (!headers) {
    return undefined;
  }

  const secretByName = createRemoteSyncProfileSecretMap(profile);

  return headers.map((header) => ({
    name: header.name,
    secretRef: readRemoteSyncProfileSecretRef(secretByName, header.secretName),
    ...(header.prefix !== undefined ? { prefix: header.prefix } : {})
  }));
}

function createProfileSecretJsonFields(
  profile: RemoteSyncProviderConfiguration,
  fields: readonly RemoteSyncProfileSecretJsonField[] | undefined
): RemoteSyncNativeSecretJsonFields | undefined {
  if (!fields) {
    return undefined;
  }

  const secretByName = createRemoteSyncProfileSecretMap(profile);

  return fields.map((field) => ({
    name: field.name,
    secretRef: readRemoteSyncProfileSecretRef(secretByName, field.secretName)
  }));
}

function createRemoteSyncProfileSecretMap(profile: RemoteSyncProviderConfiguration): ReadonlyMap<string, string> {
  return new Map(profile.secrets.map((secret) => [secret.name, secret.secretRef]));
}

function readRemoteSyncProfileSecretRef(secretByName: ReadonlyMap<string, string>, name: string): string {
  const normalizedName = normalizeRemoteSyncProfileSecretName(name);
  const secretRef = secretByName.get(normalizedName);

  if (!secretRef) {
    throw new Error(`Remote sync profile secret is not configured: ${normalizedName}`);
  }

  return secretRef;
}

function normalizeRemoteSyncProfileSecretName(value: string): string {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    throw new Error("Remote sync profile secret name is invalid");
  }

  return normalized;
}

function hasRemoteSyncProfileParentTraversal(path: string): boolean {
  return path.split("/").some((segment) => {
    if (segment === "..") {
      return true;
    }

    try {
      return decodeURIComponent(segment) === "..";
    } catch {
      return false;
    }
  });
}

function normalizeRemoteSyncProviderProfile(
  profile: RemoteSyncProviderConfiguration
): RemoteSyncProviderConfiguration {
  const normalized = normalizeRemoteSyncProviderConfiguration(profile);

  if (!normalized) {
    throw new Error("Remote sync provider profile is invalid");
  }

  return normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
