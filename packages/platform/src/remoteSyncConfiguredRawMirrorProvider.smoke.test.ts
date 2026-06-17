import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { RemoteSyncProviderConfiguration } from "./configuration";
import {
  createConfiguredRemoteSyncProviders,
  createRemoteSyncConfiguredRawMirrorProviderFactory,
  remoteSyncConfiguredRawMirrorAdapterName,
  remoteSyncConfiguredRawMirrorMetadataKeys,
  type RemoteSyncNativeRequestInput,
  type RemoteSyncNativeRequestTransport
} from "./index";
import type { RemoteSyncManifestStorage } from "./remoteSync";
import type { RemoteSyncResource } from "./remoteSync";

interface RemoteSyncRawMirrorSmokeEnvironment {
  readonly providerId: string;
  readonly providerTitle: string;
  readonly baseUrl: string;
  readonly workspaceUri: string;
  readonly listPath: string;
  readonly uploadPath: string;
  readonly downloadPath: string;
  readonly deletePath: string;
  readonly direction: "bidirectional" | "pull" | "push";
  readonly localResources: readonly RemoteSyncResource[];
  readonly remoteScopeId?: string;
  readonly listPageSize?: string;
  readonly secret?: {
    readonly name: string;
    readonly ref: string;
    readonly value: string;
    readonly headerName: string;
    readonly headerScheme?: string;
  };
}

type RemoteSyncRawMirrorSmokeEnvironmentSource = Record<string, string | undefined>;

const remoteSyncSmokeEnvironmentLimits = {
  baseUrlLength: 2000,
  headerSchemeLength: 128,
  providerIdLength: 256,
  providerTitleLength: 160,
  rawMirrorPathLength: 512,
  remoteScopeIdLength: 256,
  secretNameLength: 64,
  secretRefLength: 256,
  secretValueBytes: 64 * 1024,
  workspaceUriLength: 2000
} as const;

const environment = readRemoteSyncRawMirrorSmokeEnvironment();
const remoteSyncSmokeRequired = isEnabledEnvironmentFlag("TYPORA_PLUS_REMOTE_SYNC_SMOKE_REQUIRED");
const describeRemoteSyncSmoke = environment || remoteSyncSmokeRequired ? describe : describe.skip;

describeRemoteSyncSmoke("configured raw mirror remote sync local smoke", () => {
  it("creates an environment-configured dry-run plan without mutating remote or local files", async () => {
    if (!environment) {
      throw new Error("Remote sync smoke environment was not configured");
    }

    const requests: RemoteSyncNativeRequestInput[] = [];
    const providers = createConfiguredRemoteSyncProviders([
      createSmokeProviderConfiguration(environment)
    ], {
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({
        manifestStorage: createMemoryManifestStorage()
      }),
      transport: createSmokeTransport(environment, requests),
      workspaceResources: createDryRunWorkspaceResources()
    });

    expect(providers).toHaveLength(1);

    const progressMessages: string[] = [];
    const plan = await providers[0]!.createPlan({
      workspaceUri: URI.parse(environment.workspaceUri),
      resources: environment.localResources,
      direction: environment.direction,
      dryRun: true,
      onProgress: (progress) => progressMessages.push(progress.message)
    });

    expect(requests.length).toBeGreaterThan(0);
    expect(progressMessages.length).toBeGreaterThan(0);
    expect(plan.summary).toEqual({
      creates: plan.operations.filter((operation) => operation.kind === "create").length,
      updates: plan.operations.filter((operation) => operation.kind === "update").length,
      deletes: plan.operations.filter((operation) => operation.kind === "delete").length,
      skips: plan.operations.filter((operation) => operation.kind === "skip").length,
      conflicts: plan.operations.filter((operation) => operation.kind === "conflict").length
    });
  });
});

describe("configured raw mirror remote sync smoke environment", () => {
  it("defaults omitted optional direction to pull", () => {
    expect(readRemoteSyncRawMirrorSmokeEnvironment(completeSmokeEnvironment())?.direction).toBe("pull");
  });

  it("reads injected optional local resource snapshots through the full environment reader", () => {
    const environment = readRemoteSyncRawMirrorSmokeEnvironment({
      ...completeSmokeEnvironment(),
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: JSON.stringify([{
        relativePath: "notes/injected.md",
        kind: "file",
        size: 12
      }])
    });

    expect(environment?.localResources).toEqual([{
      uri: URI.file("C:/Workspace/notes/injected.md"),
      relativePath: "notes/injected.md",
      kind: "file",
      size: 12
    }]);
  });

  it("rejects invalid required profile values before provider registration", () => {
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID: "bad provider"
    }, "Remote sync smoke provider id must use provider id characters and be at most 256 characters", "bad provider");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL: ["http://remote.example", "/raw-mirror"].join("")
    }, "Remote sync smoke base URL must be HTTPS or loopback HTTP and at most 2000 characters", "remote.example");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI: "not-a-uri"
    }, "Remote sync smoke workspace URI must be an absolute URI and at most 2000 characters", "not-a-uri");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH: "../secret/list"
    }, "Remote sync smoke list path must be a relative raw mirror path at most 512 characters", "secret/list");
  });

  it("rejects invalid optional direction instead of silently falling back", () => {
    expect(() => readRemoteSyncRawMirrorSmokeEnvironment({
      ...completeSmokeEnvironment(),
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_DIRECTION: "sideways"
    })).toThrow("Remote sync smoke direction must be push, pull, or bidirectional");
  });

  it("rejects incomplete optional secret header configuration", () => {
    expect(() => readRemoteSyncRawMirrorSmokeEnvironment({
      ...completeSmokeEnvironment(),
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "session",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: "secret"
    })).toThrow("Remote sync smoke secret header configuration must be complete");
    expect(() => readRemoteSyncRawMirrorSmokeEnvironment({
      ...completeSmokeEnvironment(),
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_SCHEME: "Bearer"
    })).toThrow("Remote sync smoke secret header configuration must be complete");
  });

  it("rejects invalid optional list page size before provider registration", () => {
    expect(() => readRemoteSyncRawMirrorSmokeEnvironment({
      ...completeSmokeEnvironment(),
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PAGE_SIZE: "0"
    })).toThrow("Remote sync smoke list page size must be an integer from 1 to 1000");
  });

  it("rejects invalid optional profile and secret values before provider registration", () => {
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_REMOTE_SCOPE_ID: "r".repeat(remoteSyncSmokeEnvironmentLimits.remoteScopeIdLength + 1)
    }, "Remote sync smoke remote scope id must be at most 256 characters", "rrrr");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "bad secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF: "configured.ref",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: "configured-secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME: "Authorization"
    }, "Remote sync smoke secret binding name must use secret binding characters and be at most 64 characters", "bad secret");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "configured.secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF: "../secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: "configured-secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME: "Authorization"
    }, "Remote sync smoke secret reference must use secret reference characters and be at most 256 characters", "../secret");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "configured.secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF: "configured.ref",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: "s".repeat(remoteSyncSmokeEnvironmentLimits.secretValueBytes + 1),
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME: "Authorization"
    }, "Remote sync smoke secret value must be at most 65536 UTF-8 bytes", "ssss");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "configured.secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF: "configured.ref",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: "configured-secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME: "Bad Header"
    }, "Remote sync smoke secret header name must be a valid HTTP header name", "Bad Header");
    expectInvalidRemoteSyncSmokeEnvironment({
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "configured.secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF: "configured.ref",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: "configured-secret",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME: "Authorization",
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_SCHEME: "Bearer\nleak"
    }, "Remote sync smoke secret header scheme must be at most 128 characters and must not contain line breaks", "Bearer\nleak");
  });
});

function expectInvalidRemoteSyncSmokeEnvironment(
  overrides: RemoteSyncRawMirrorSmokeEnvironmentSource,
  expectedMessage: string,
  rawValue: string
): void {
  let error: unknown;

  try {
    readRemoteSyncRawMirrorSmokeEnvironment({
      ...completeSmokeEnvironment(),
      ...overrides
    });
  } catch (candidate) {
    error = candidate;
  }

  expect(error).toBeInstanceOf(Error);
  const message = error instanceof Error ? error.message : String(error);

  expect(message).toContain(expectedMessage);
  expect(message).not.toContain(rawValue);
}

describe("configured raw mirror remote sync smoke local resources", () => {
  it("parses optional local resource snapshots without reading file content", () => {
    const workspaceUri = "file://C:/Workspace";
    const resources = readRemoteSyncSmokeLocalResources(workspaceUri, {
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: JSON.stringify([
        {
          relativePath: "notes/daily.md",
          kind: "file",
          size: 42,
          mtime: 100,
          contentHash: "sha256:daily",
          name: "daily.md"
        },
        {
          relativePath: "assets",
          kind: "directory"
        }
      ])
    });

    expect(resources).toEqual([
      {
        uri: URI.file("C:/Workspace/notes/daily.md"),
        relativePath: "notes/daily.md",
        kind: "file",
        size: 42,
        mtime: 100,
        contentHash: "sha256:daily",
        name: "daily.md"
      },
      {
        uri: URI.file("C:/Workspace/assets"),
        relativePath: "assets",
        kind: "directory"
      }
    ]);
  });

  it("rejects invalid local resource snapshot JSON before planning", () => {
    expect(() => readRemoteSyncSmokeLocalResources("file://C:/Workspace", {
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: "{bad"
    })).toThrow("Remote sync smoke local resources must be valid JSON");
    expect(() => readRemoteSyncSmokeLocalResources("file://C:/Workspace", {
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: JSON.stringify([{ relativePath: "../escape.md" }])
    })).toThrow("Remote sync smoke local resource 0 relative path must not contain parent traversal");
    expect(() => readRemoteSyncSmokeLocalResources("file://C:/Workspace", {
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: JSON.stringify([{ relativePath: "bad.md", size: -1 }])
    })).toThrow("Remote sync smoke local resource 0 size must be a non-negative finite number");
  });
});

function readRemoteSyncRawMirrorSmokeEnvironment(
  environment: RemoteSyncRawMirrorSmokeEnvironmentSource = process.env
): RemoteSyncRawMirrorSmokeEnvironment | undefined {
  const providerId = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID");
  const providerTitle = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE");
  const baseUrl = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL");
  const workspaceUri = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI");
  const listPath = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH");
  const uploadPath = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH");
  const downloadPath = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH");
  const deletePath = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH");
  const remoteScopeId = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_REMOTE_SCOPE_ID");

  if (!providerId || !providerTitle || !baseUrl || !workspaceUri || !listPath || !uploadPath || !downloadPath || !deletePath) {
    return undefined;
  }

  validateRemoteSyncSmokeProviderId(providerId);
  validateRemoteSyncSmokeBoundedText(
    providerTitle,
    "provider title",
    remoteSyncSmokeEnvironmentLimits.providerTitleLength
  );
  validateRemoteSyncSmokeBaseUrl(baseUrl);
  validateRemoteSyncSmokeWorkspaceUri(workspaceUri);
  validateRemoteSyncSmokeRawMirrorPath(listPath, "list path");
  validateRemoteSyncSmokeRawMirrorPath(uploadPath, "upload path");
  validateRemoteSyncSmokeRawMirrorPath(downloadPath, "download path");
  validateRemoteSyncSmokeRawMirrorPath(deletePath, "delete path");
  if (remoteScopeId !== undefined) {
    validateRemoteSyncSmokeBoundedText(
      remoteScopeId,
      "remote scope id",
      remoteSyncSmokeEnvironmentLimits.remoteScopeIdLength
    );
  }

  return {
    providerId,
    providerTitle,
    baseUrl,
    workspaceUri,
    listPath,
    uploadPath,
    downloadPath,
    deletePath,
    direction: readRemoteSyncSmokeDirection(environment),
    localResources: readRemoteSyncSmokeLocalResources(workspaceUri, environment),
    ...(remoteScopeId !== undefined ? { remoteScopeId } : {}),
    ...readOptionalListPageSizeProperty(environment),
    ...readRemoteSyncSmokeSecret(environment)
  };
}

function readRemoteSyncSmokeDirection(
  environment: RemoteSyncRawMirrorSmokeEnvironmentSource
): RemoteSyncRawMirrorSmokeEnvironment["direction"] {
  const direction = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_DIRECTION");

  if (!direction) {
    return "pull";
  }

  if (direction === "bidirectional" || direction === "pull" || direction === "push") {
    return direction;
  }

  throw new Error("Remote sync smoke direction must be push, pull, or bidirectional");
}

function readRemoteSyncSmokeSecret(environment: RemoteSyncRawMirrorSmokeEnvironmentSource):
  | { readonly secret: NonNullable<RemoteSyncRawMirrorSmokeEnvironment["secret"]> }
  | Record<string, never> {
  const name = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME");
  const ref = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF");
  const value = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE");
  const headerName = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME");
  const headerScheme = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_SCHEME");

  if (!name && !ref && !value && !headerName && !headerScheme) {
    return {};
  }

  if (!name || !ref || !value || !headerName) {
    throw new Error("Remote sync smoke secret header configuration must be complete");
  }

  validateRemoteSyncSmokeSecretName(name);
  validateRemoteSyncSmokeSecretRef(ref);
  validateRemoteSyncSmokeSecretValue(value);
  validateRemoteSyncSmokeHeaderName(headerName);
  validateRemoteSyncSmokeHeaderScheme(headerScheme);

  return {
    secret: {
      name,
      ref,
      value,
      headerName,
      ...(headerScheme !== undefined ? { headerScheme } : {})
    }
  };
}

function readEnvironmentValue(environment: RemoteSyncRawMirrorSmokeEnvironmentSource, name: string): string | undefined {
  const value = environment[name]?.trim();

  return value || undefined;
}

function validateRemoteSyncSmokeProviderId(value: string): void {
  if (
    value.length <= remoteSyncSmokeEnvironmentLimits.providerIdLength &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
  ) {
    return;
  }

  throw new Error(
    `Remote sync smoke provider id must use provider id characters and be at most ${remoteSyncSmokeEnvironmentLimits.providerIdLength} characters`
  );
}

function validateRemoteSyncSmokeBoundedText(value: string, label: string, maxLength: number): void {
  if (value.length <= maxLength) {
    return;
  }

  throw new Error(`Remote sync smoke ${label} must be at most ${maxLength} characters`);
}

function validateRemoteSyncSmokeBaseUrl(value: string): void {
  if (value.length > remoteSyncSmokeEnvironmentLimits.baseUrlLength) {
    throw new Error(
      `Remote sync smoke base URL must be HTTPS or loopback HTTP and at most ${remoteSyncSmokeEnvironmentLimits.baseUrlLength} characters`
    );
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || isLoopbackHttpUrl(url)) {
      return;
    }
  } catch {
    // Fall through to the redacted diagnostic below.
  }

  throw new Error(
    `Remote sync smoke base URL must be HTTPS or loopback HTTP and at most ${remoteSyncSmokeEnvironmentLimits.baseUrlLength} characters`
  );
}

function validateRemoteSyncSmokeWorkspaceUri(value: string): void {
  if (value.length > remoteSyncSmokeEnvironmentLimits.workspaceUriLength) {
    throw new Error(
      `Remote sync smoke workspace URI must be an absolute URI and at most ${remoteSyncSmokeEnvironmentLimits.workspaceUriLength} characters`
    );
  }

  try {
    const url = new URL(value);

    if (url.protocol) {
      return;
    }
  } catch {
    // Fall through to the redacted diagnostic below.
  }

  throw new Error(
    `Remote sync smoke workspace URI must be an absolute URI and at most ${remoteSyncSmokeEnvironmentLimits.workspaceUriLength} characters`
  );
}

function validateRemoteSyncSmokeRawMirrorPath(value: string, label: string): void {
  if (isRemoteSyncSmokeRawMirrorPath(value)) {
    return;
  }

  throw new Error(
    `Remote sync smoke ${label} must be a relative raw mirror path at most ${remoteSyncSmokeEnvironmentLimits.rawMirrorPathLength} characters`
  );
}

function validateRemoteSyncSmokeSecretName(value: string): void {
  if (
    value.length <= remoteSyncSmokeEnvironmentLimits.secretNameLength &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
  ) {
    return;
  }

  throw new Error(
    `Remote sync smoke secret binding name must use secret binding characters and be at most ${remoteSyncSmokeEnvironmentLimits.secretNameLength} characters`
  );
}

function validateRemoteSyncSmokeSecretRef(value: string): void {
  if (
    value.length <= remoteSyncSmokeEnvironmentLimits.secretRefLength &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
  ) {
    return;
  }

  throw new Error(
    `Remote sync smoke secret reference must use secret reference characters and be at most ${remoteSyncSmokeEnvironmentLimits.secretRefLength} characters`
  );
}

function validateRemoteSyncSmokeSecretValue(value: string): void {
  if (new TextEncoder().encode(value).length <= remoteSyncSmokeEnvironmentLimits.secretValueBytes) {
    return;
  }

  throw new Error(
    `Remote sync smoke secret value must be at most ${remoteSyncSmokeEnvironmentLimits.secretValueBytes} UTF-8 bytes`
  );
}

function validateRemoteSyncSmokeHeaderName(value: string): void {
  if (/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value)) {
    return;
  }

  throw new Error("Remote sync smoke secret header name must be a valid HTTP header name");
}

function validateRemoteSyncSmokeHeaderScheme(value: string | undefined): void {
  if (
    value === undefined ||
    (value.length <= remoteSyncSmokeEnvironmentLimits.headerSchemeLength && !/[\r\n]/.test(value))
  ) {
    return;
  }

  throw new Error(
    `Remote sync smoke secret header scheme must be at most ${remoteSyncSmokeEnvironmentLimits.headerSchemeLength} characters and must not contain line breaks`
  );
}

function isRemoteSyncSmokeRawMirrorPath(value: string): boolean {
  const normalized = value.trim();

  return !(
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.length > remoteSyncSmokeEnvironmentLimits.rawMirrorPathLength ||
    /[?#]/.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    hasRemoteSyncSmokeParentTraversal(normalized)
  );
}

function hasRemoteSyncSmokeParentTraversal(path: string): boolean {
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

function isLoopbackHttpUrl(url: URL): boolean {
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

function readRemoteSyncSmokeLocalResources(
  workspaceUriText: string,
  environment: { readonly TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON?: string } = process.env
): readonly RemoteSyncResource[] {
  const rawResources = environment.TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON?.trim();

  if (!rawResources) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawResources) as unknown;
  } catch {
    throw new Error("Remote sync smoke local resources must be valid JSON");
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Remote sync smoke local resources must be a JSON array");
  }

  const workspaceUri = URI.parse(workspaceUriText);

  return parsed.map((resource, index) => readRemoteSyncSmokeLocalResource(workspaceUri, resource, index));
}

function readRemoteSyncSmokeLocalResource(
  workspaceUri: URI,
  value: unknown,
  index: number
): RemoteSyncResource {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Remote sync smoke local resource ${index} must be an object`);
  }

  const record = value as Record<string, unknown>;
  const relativePath = readRemoteSyncSmokeRelativePath(
    record.relativePath,
    `Remote sync smoke local resource ${index} relative path`
  );
  const kind = readRemoteSyncSmokeLocalResourceKind(record.kind, index);
  const name = readOptionalRemoteSyncSmokeText(record.name, `Remote sync smoke local resource ${index} name`);
  const contentHash = readOptionalRemoteSyncSmokeText(
    record.contentHash,
    `Remote sync smoke local resource ${index} content hash`
  );

  return {
    uri: createRemoteSyncSmokeLocalResourceUri(workspaceUri, relativePath),
    relativePath,
    kind,
    ...(name !== undefined ? { name } : {}),
    ...readOptionalRemoteSyncSmokeNumber("size", record.size, `Remote sync smoke local resource ${index} size`),
    ...readOptionalRemoteSyncSmokeNumber("mtime", record.mtime, `Remote sync smoke local resource ${index} mtime`),
    ...(contentHash !== undefined ? { contentHash } : {})
  };
}

function readRemoteSyncSmokeRelativePath(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim().replaceAll("\\", "/");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)
  ) {
    throw new Error(`${label} must be workspace-relative`);
  }

  const segments = normalized.split("/").filter((segment) => segment.length > 0 && segment !== ".");

  if (segments.some((segment) => segment === "..")) {
    throw new Error(`${label} must not contain parent traversal`);
  }

  return segments.join("/");
}

function readRemoteSyncSmokeLocalResourceKind(value: unknown, index: number): RemoteSyncResource["kind"] {
  if (value === undefined) {
    return "file";
  }

  if (value !== "file" && value !== "directory") {
    throw new Error(`Remote sync smoke local resource ${index} kind must be file or directory`);
  }

  return value;
}

function readOptionalRemoteSyncSmokeText(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value.trim() || undefined;
}

function readOptionalRemoteSyncSmokeNumber<Key extends string>(
  key: Key,
  value: unknown,
  label: string
): Partial<Record<Key, number>> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }

  return { [key]: value } as Partial<Record<Key, number>>;
}

function createRemoteSyncSmokeLocalResourceUri(workspaceUri: URI, relativePath: string): URI {
  const workspacePath = workspaceUri.path.replace(/\/+$/, "");

  if (workspaceUri.scheme === "file") {
    return URI.file(`${workspacePath}/${relativePath}`);
  }

  return URI.parse(`${workspaceUri.toString().replace(/\/+$/, "")}/${relativePath}`);
}

function readOptionalListPageSizeProperty(
  environment: RemoteSyncRawMirrorSmokeEnvironmentSource
): { readonly listPageSize: string } | Record<string, never> {
  const value = readEnvironmentValue(environment, "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PAGE_SIZE");

  if (!value) {
    return {};
  }

  const parsed = Number(value);

  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
    throw new Error("Remote sync smoke list page size must be an integer from 1 to 1000");
  }

  return { listPageSize: value };
}

function isEnabledEnvironmentFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes";
}

function completeSmokeEnvironment(): RemoteSyncRawMirrorSmokeEnvironmentSource {
  return {
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID: "configured.provider",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE: "Configured Provider",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL: "http://127.0.0.1:8765/raw-mirror",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI: "file:///C:/Workspace",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH: "mirror/list",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH: "mirror/upload",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH: "mirror/download",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH: "mirror/delete"
  };
}

function createSmokeProviderConfiguration(
  environment: RemoteSyncRawMirrorSmokeEnvironment
): RemoteSyncProviderConfiguration {
  const metadata: Record<string, string> = {
    [remoteSyncConfiguredRawMirrorMetadataKeys.adapter]: remoteSyncConfiguredRawMirrorAdapterName,
    [remoteSyncConfiguredRawMirrorMetadataKeys.listPath]: environment.listPath,
    [remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath]: environment.uploadPath,
    [remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath]: environment.downloadPath,
    [remoteSyncConfiguredRawMirrorMetadataKeys.deletePath]: environment.deletePath
  };

  if (environment.listPageSize !== undefined) {
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize] = environment.listPageSize;
  }

  if (environment.secret !== undefined) {
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding] = environment.secret.name;
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerName] = environment.secret.headerName;
    if (environment.secret.headerScheme !== undefined) {
      metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme] = environment.secret.headerScheme;
    }
  }

  return {
    id: environment.providerId,
    title: environment.providerTitle,
    kind: "native-request",
    baseUrl: environment.baseUrl,
    ...(environment.remoteScopeId !== undefined ? { remoteScopeId: environment.remoteScopeId } : {}),
    metadata,
    secrets: environment.secret !== undefined
      ? [{ name: environment.secret.name, secretRef: environment.secret.ref }]
      : []
  };
}

function createSmokeTransport(
  environment: RemoteSyncRawMirrorSmokeEnvironment,
  requests: RemoteSyncNativeRequestInput[]
): RemoteSyncNativeRequestTransport {
  return async (request) => {
    requests.push(request);
    const headers = new Headers(request.headers);

    for (const secretHeader of request.secretHeaders ?? []) {
      if (environment.secret === undefined || secretHeader.secretRef !== environment.secret.ref) {
        throw new Error("Remote sync smoke request referenced an unconfigured secret");
      }

      headers.set(secretHeader.name, `${secretHeader.prefix ?? ""}${environment.secret.value}`);
    }

    const response = await fetch(request.url, {
      method: request.method,
      headers,
      ...(request.body !== undefined ? { body: request.body } : {}),
      ...(request.signal !== undefined ? { signal: request.signal } : {})
    });
    const responseText = await response.text();

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: readSmokeResponseBody(responseText, request.responseType, response.ok)
    };
  };
}

function readSmokeResponseBody(
  responseText: string,
  responseType: RemoteSyncNativeRequestInput["responseType"],
  ok: boolean
): unknown {
  if (responseType !== "json") {
    return responseText;
  }

  if (!responseText.trim()) {
    return undefined;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    if (ok) {
      throw new Error("Remote sync smoke response was not valid JSON");
    }

    return responseText;
  }
}

function createDryRunWorkspaceResources() {
  return {
    async readResource() {
      throw new Error("Remote sync smoke dry-run must not read local file content");
    },
    async writeResource() {
      throw new Error("Remote sync smoke dry-run must not write local files");
    },
    async deleteResource() {
      throw new Error("Remote sync smoke dry-run must not delete local files");
    }
  };
}

function createMemoryManifestStorage(): RemoteSyncManifestStorage {
  const values = new Map<string, string>();

  return {
    read: (key) => values.get(key),
    write: (key, value) => {
      values.set(key, value);
    }
  };
}
