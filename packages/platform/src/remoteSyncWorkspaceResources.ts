import { URI, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type RemoteSyncWorkspaceResourceEncoding = "base64";

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
    ...(mtime !== undefined ? { mtime } : {})
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
