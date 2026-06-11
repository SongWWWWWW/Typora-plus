import { URI, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";
import type { RemoteSyncProgress, RemoteSyncResource } from "./remoteSync";

export type RemoteSyncWorkspaceResourceEncoding = "base64";
export const remoteSyncWorkspaceResourceHashDefaultConcurrency = 4;

export interface RemoteSyncWorkspaceResourceReadRequest {
  readonly workspaceUri: URIType;
  readonly relativePath: string;
}

export interface RemoteSyncWorkspaceResourceWriteRequest {
  readonly workspaceUri: URIType;
  readonly relativePath: string;
  readonly value: string;
  readonly encoding: RemoteSyncWorkspaceResourceEncoding;
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

export interface RemoteSyncWorkspaceResourceDeleteRequest {
  readonly workspaceUri: URIType;
  readonly relativePath: string;
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

export interface RemoteSyncWorkspaceResourceReadResult {
  readonly workspaceUri: URIType;
  readonly relativePath: string;
  readonly value: string;
  readonly encoding: RemoteSyncWorkspaceResourceEncoding;
  readonly size: number;
  readonly mtime?: number;
  readonly contentHash?: string;
}

export interface RemoteSyncWorkspaceResourceWriteResult {
  readonly workspaceUri: URIType;
  readonly relativePath: string;
  readonly size: number;
  readonly mtime?: number;
}

export interface SerializedRemoteSyncWorkspaceResourceReadRequest {
  readonly workspaceUri: string;
  readonly relativePath: string;
}

export interface SerializedRemoteSyncWorkspaceResourceWriteRequest {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly value: string;
  readonly encoding: RemoteSyncWorkspaceResourceEncoding;
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

export interface SerializedRemoteSyncWorkspaceResourceDeleteRequest {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

export interface SerializedRemoteSyncWorkspaceResourceReadResult {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly value: string;
  readonly encoding: RemoteSyncWorkspaceResourceEncoding;
  readonly size: number;
  readonly mtime?: number;
  readonly contentHash?: string;
}

export interface SerializedRemoteSyncWorkspaceResourceWriteResult {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly size: number;
  readonly mtime?: number;
}

export interface NativeRemoteSyncWorkspaceResourceBridge {
  readonly isAvailable: boolean;
  readResource(
    request: SerializedRemoteSyncWorkspaceResourceReadRequest
  ): Promise<SerializedRemoteSyncWorkspaceResourceReadResult>;
  writeResource(
    request: SerializedRemoteSyncWorkspaceResourceWriteRequest
  ): Promise<SerializedRemoteSyncWorkspaceResourceWriteResult>;
  deleteResource(request: SerializedRemoteSyncWorkspaceResourceDeleteRequest): Promise<boolean>;
}

export interface IRemoteSyncWorkspaceResourceService {
  isAvailable(): boolean;
  readResource(request: RemoteSyncWorkspaceResourceReadRequest): Promise<RemoteSyncWorkspaceResourceReadResult>;
  writeResource(request: RemoteSyncWorkspaceResourceWriteRequest): Promise<RemoteSyncWorkspaceResourceWriteResult>;
  deleteResource(request: RemoteSyncWorkspaceResourceDeleteRequest): Promise<boolean>;
}

export interface RemoteSyncWorkspaceResourceHashInput {
  readonly workspaceUri: URIType;
  readonly resources: readonly RemoteSyncResource[];
  readonly resourceService: Pick<IRemoteSyncWorkspaceResourceService, "readResource">;
  readonly maxConcurrency?: number;
  readonly onProgress?: (progress: RemoteSyncProgress) => void;
  readonly signal?: AbortSignal;
}

export const IRemoteSyncWorkspaceResourceService =
  createServiceIdentifier<IRemoteSyncWorkspaceResourceService>("remoteSyncWorkspaceResource");

export class NativeRemoteSyncWorkspaceResourceService implements IRemoteSyncWorkspaceResourceService {
  constructor(
    private readonly bridge: NativeRemoteSyncWorkspaceResourceBridge | undefined =
      createNativeRemoteSyncWorkspaceResourceBridge()
  ) {}

  isAvailable(): boolean {
    return this.bridge?.isAvailable ?? false;
  }

  async readResource(
    request: RemoteSyncWorkspaceResourceReadRequest
  ): Promise<RemoteSyncWorkspaceResourceReadResult> {
    const bridge = this.requireBridge();
    return reviveRemoteSyncWorkspaceReadResult(await bridge.readResource(
      serializeRemoteSyncWorkspaceReadRequest(request)
    ));
  }

  async writeResource(
    request: RemoteSyncWorkspaceResourceWriteRequest
  ): Promise<RemoteSyncWorkspaceResourceWriteResult> {
    const bridge = this.requireBridge();
    return reviveRemoteSyncWorkspaceWriteResult(await bridge.writeResource(
      serializeRemoteSyncWorkspaceWriteRequest(request)
    ));
  }

  async deleteResource(request: RemoteSyncWorkspaceResourceDeleteRequest): Promise<boolean> {
    const bridge = this.requireBridge();
    return bridge.deleteResource(serializeRemoteSyncWorkspaceDeleteRequest(request));
  }

  private requireBridge(): NativeRemoteSyncWorkspaceResourceBridge {
    if (!this.bridge?.isAvailable) {
      throw new Error("Native remote sync workspace resource bridge is not available");
    }

    return this.bridge;
  }
}

export function createNativeRemoteSyncWorkspaceResourceBridge():
  NativeRemoteSyncWorkspaceResourceBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly remoteSyncWorkspaceResources?: NativeRemoteSyncWorkspaceResourceBridge;
    };
  };
  const bridge = candidate.typoraPlus?.remoteSyncWorkspaceResources;

  return bridge?.isAvailable ? bridge : undefined;
}

export async function createRemoteSyncResourcesWithContentHashes(
  input: RemoteSyncWorkspaceResourceHashInput
): Promise<readonly RemoteSyncResource[]> {
  const resources = [...input.resources];
  const hashedResources = new Array<RemoteSyncResource>(resources.length);
  const maxConcurrency = normalizeRemoteSyncWorkspaceHashConcurrency(input.maxConcurrency, resources.length);
  let nextIndex = 0;
  let completed = 0;

  const workers = Array.from({ length: maxConcurrency }, async () => {
    while (nextIndex < resources.length) {
      throwIfRemoteSyncWorkspaceHashingAborted(input.signal);

      const resourceIndex = nextIndex;
      nextIndex += 1;

      const resource = resources[resourceIndex]!;
      const hashedResource = resource.kind === "file" && !resource.contentHash
        ? await createRemoteSyncResourceWithContentHash(input.workspaceUri, resource, input.resourceService, input.signal)
        : resource;

      hashedResources[resourceIndex] = hashedResource;
      completed += 1;
      input.onProgress?.({
        message: "Hashed workspace resource",
        completed,
        total: resources.length
      });
    }
  });

  await Promise.all(workers);
  return hashedResources;
}

export async function createRemoteSyncContentHash(
  value: string,
  encoding: RemoteSyncWorkspaceResourceEncoding
): Promise<string> {
  if (encoding !== "base64") {
    throw new Error("Remote sync workspace resource hashing requires base64 content");
  }

  const digest = await digestRemoteSyncWorkspaceBytes(decodeBase64RemoteSyncWorkspaceResource(value));
  return `sha256:${hexRemoteSyncWorkspaceBytes(digest)}`;
}

async function createRemoteSyncResourceWithContentHash(
  workspaceUri: URIType,
  resource: RemoteSyncResource,
  resourceService: Pick<IRemoteSyncWorkspaceResourceService, "readResource">,
  signal: AbortSignal | undefined
): Promise<RemoteSyncResource> {
  throwIfRemoteSyncWorkspaceHashingAborted(signal);

  const content = await resourceService.readResource({
    workspaceUri,
    relativePath: resource.relativePath
  });

  throwIfRemoteSyncWorkspaceHashingAborted(signal);

  const contentHash = normalizeRemoteSyncWorkspaceContentHash(content.contentHash)
    ?? await createRemoteSyncContentHash(content.value, content.encoding);

  throwIfRemoteSyncWorkspaceHashingAborted(signal);

  return {
    ...resource,
    size: content.size,
    ...(content.mtime !== undefined ? { mtime: content.mtime } : {}),
    contentHash
  };
}

function serializeRemoteSyncWorkspaceReadRequest(
  request: RemoteSyncWorkspaceResourceReadRequest
): SerializedRemoteSyncWorkspaceResourceReadRequest {
  return {
    workspaceUri: normalizeRemoteSyncWorkspaceUri(request.workspaceUri),
    relativePath: normalizeRemoteSyncWorkspaceRelativePath(request.relativePath)
  };
}

function serializeRemoteSyncWorkspaceWriteRequest(
  request: RemoteSyncWorkspaceResourceWriteRequest
): SerializedRemoteSyncWorkspaceResourceWriteRequest {
  const expectedMtime = normalizeOptionalNonNegativeFiniteNumber(
    request.expectedMtime,
    "Remote sync workspace resource expected mtime"
  );

  return {
    workspaceUri: normalizeRemoteSyncWorkspaceUri(request.workspaceUri),
    relativePath: normalizeRemoteSyncWorkspaceRelativePath(request.relativePath),
    value: normalizeRemoteSyncWorkspaceResourceValue(request.value),
    encoding: normalizeRemoteSyncWorkspaceResourceEncoding(request.encoding),
    ...(expectedMtime !== undefined ? { expectedMtime } : {}),
    ...(typeof request.overwrite === "boolean" ? { overwrite: request.overwrite } : {})
  };
}

function serializeRemoteSyncWorkspaceDeleteRequest(
  request: RemoteSyncWorkspaceResourceDeleteRequest
): SerializedRemoteSyncWorkspaceResourceDeleteRequest {
  const expectedMtime = normalizeOptionalNonNegativeFiniteNumber(
    request.expectedMtime,
    "Remote sync workspace resource expected mtime"
  );

  return {
    workspaceUri: normalizeRemoteSyncWorkspaceUri(request.workspaceUri),
    relativePath: normalizeRemoteSyncWorkspaceRelativePath(request.relativePath),
    ...(expectedMtime !== undefined ? { expectedMtime } : {}),
    ...(typeof request.overwrite === "boolean" ? { overwrite: request.overwrite } : {})
  };
}

function reviveRemoteSyncWorkspaceReadResult(
  result: SerializedRemoteSyncWorkspaceResourceReadResult
): RemoteSyncWorkspaceResourceReadResult {
  const mtime = normalizeOptionalNonNegativeFiniteNumber(
    result.mtime,
    "Remote sync workspace resource result mtime"
  );

  return {
    workspaceUri: normalizeResultWorkspaceUri(result.workspaceUri),
    relativePath: normalizeRemoteSyncWorkspaceRelativePath(result.relativePath),
    value: normalizeRemoteSyncWorkspaceResourceValue(result.value),
    encoding: normalizeRemoteSyncWorkspaceResourceEncoding(result.encoding),
    size: normalizeNonNegativeFiniteNumber(result.size, "Remote sync workspace resource result size"),
    ...(mtime !== undefined ? { mtime } : {}),
    ...normalizeOptionalRemoteSyncWorkspaceContentHashResult(result.contentHash)
  };
}

function reviveRemoteSyncWorkspaceWriteResult(
  result: SerializedRemoteSyncWorkspaceResourceWriteResult
): RemoteSyncWorkspaceResourceWriteResult {
  const mtime = normalizeOptionalNonNegativeFiniteNumber(
    result.mtime,
    "Remote sync workspace resource result mtime"
  );

  return {
    workspaceUri: normalizeResultWorkspaceUri(result.workspaceUri),
    relativePath: normalizeRemoteSyncWorkspaceRelativePath(result.relativePath),
    size: normalizeNonNegativeFiniteNumber(result.size, "Remote sync workspace resource result size"),
    ...(mtime !== undefined ? { mtime } : {})
  };
}

function normalizeRemoteSyncWorkspaceUri(value: URIType): string {
  if (typeof value !== "object" || value === null || typeof value.toString !== "function") {
    throw new Error("Remote sync workspace URI must be a URI");
  }

  const normalized = value.toString().trim();

  if (!normalized) {
    throw new Error("Remote sync workspace URI must not be empty");
  }

  return normalized;
}

function normalizeResultWorkspaceUri(value: unknown): URIType {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Remote sync workspace resource result workspace URI must be a string");
  }

  return URI.parse(value.trim());
}

function normalizeRemoteSyncWorkspaceRelativePath(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Remote sync workspace resource relative path must be a string");
  }

  const normalized = value.trim().replaceAll("\\", "/");

  if (normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    throw new Error("Remote sync workspace resource relative path must be workspace-relative");
  }

  const segments: string[] = [];

  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      throw new Error("Remote sync workspace resource relative path must not contain parent traversal");
    }

    segments.push(segment);
  }

  const relativePath = segments.join("/");

  if (!relativePath) {
    throw new Error("Remote sync workspace resource relative path must not be empty");
  }

  return relativePath;
}

function normalizeRemoteSyncWorkspaceResourceValue(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Remote sync workspace resource value must be a string");
  }

  return value;
}

function normalizeRemoteSyncWorkspaceResourceEncoding(
  value: unknown
): RemoteSyncWorkspaceResourceEncoding {
  if (value !== "base64") {
    throw new Error("Remote sync workspace resource encoding must be base64");
  }

  return value;
}

function normalizeRemoteSyncWorkspaceContentHash(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Remote sync workspace resource content hash must be a string");
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > 160 || !/^[A-Za-z0-9][A-Za-z0-9_.:+/-]*$/.test(normalized)) {
    throw new Error("Remote sync workspace resource content hash is invalid");
  }

  return normalized;
}

function normalizeOptionalRemoteSyncWorkspaceContentHashResult(
  value: unknown
): { readonly contentHash?: string } {
  const contentHash = normalizeRemoteSyncWorkspaceContentHash(value);
  return contentHash ? { contentHash } : {};
}

function normalizeNonNegativeFiniteNumber(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }

  return value;
}

function normalizeOptionalNonNegativeFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeNonNegativeFiniteNumber(value, label);
}

function normalizeRemoteSyncWorkspaceHashConcurrency(value: unknown, resourceCount: number): number {
  if (resourceCount === 0) {
    return 0;
  }

  if (value === undefined) {
    return Math.min(remoteSyncWorkspaceResourceHashDefaultConcurrency, resourceCount);
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
    throw new Error("Remote sync workspace resource hash concurrency must be a positive integer");
  }

  return Math.min(value, resourceCount);
}

function throwIfRemoteSyncWorkspaceHashingAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Remote sync workspace resource hashing was aborted");
  }
}

function decodeBase64RemoteSyncWorkspaceResource(value: string): Uint8Array {
  const normalized = normalizeRemoteSyncWorkspaceResourceValue(value);

  if (normalized === "") {
    return new Uint8Array();
  }

  if (
    normalized !== normalized.trim() ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    throw new Error("Remote sync workspace resource value must be base64");
  }

  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return bytes;
}

async function digestRemoteSyncWorkspaceBytes(value: Uint8Array): Promise<Uint8Array> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("Remote sync workspace resource hashing requires Web Crypto");
  }

  const copy = new Uint8Array(value.byteLength);
  copy.set(value);
  return new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", copy.buffer));
}

function hexRemoteSyncWorkspaceBytes(value: Uint8Array): string {
  return [...value]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
