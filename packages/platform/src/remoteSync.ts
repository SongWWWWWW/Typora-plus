import { toDisposable, type IDisposable, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";
import type { FileKind, FileTreeEntry, WorkspaceFileTree } from "./files";

export type RemoteSyncProviderId = string;
export type RemoteSyncDirection = "push" | "pull" | "bidirectional";
export type RemoteSyncOperationKind = "create" | "update" | "delete" | "skip" | "conflict";
export type RemoteSyncOperationTarget = "local" | "remote" | "both" | "none";

export interface RemoteSyncResource {
  readonly uri: URIType;
  readonly relativePath: string;
  readonly kind: FileKind;
  readonly name?: string;
  readonly size?: number;
  readonly mtime?: number;
  readonly contentHash?: string;
}

export interface RemoteSyncPlanRequest {
  readonly workspaceUri: URIType;
  readonly resources: readonly RemoteSyncResource[];
  readonly direction: RemoteSyncDirection;
  readonly remoteScopeId?: string;
  readonly dryRun?: boolean;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface RemoteSyncOperation {
  readonly kind: RemoteSyncOperationKind;
  readonly target: RemoteSyncOperationTarget;
  readonly relativePath: string;
  readonly localUri?: URIType;
  readonly remoteId?: string;
  readonly message?: string;
}

export interface RemoteSyncSummary {
  readonly creates: number;
  readonly updates: number;
  readonly deletes: number;
  readonly skips: number;
  readonly conflicts: number;
}

export interface RemoteSyncPlan {
  readonly operations: readonly RemoteSyncOperation[];
  readonly summary: RemoteSyncSummary;
}

export interface RemoteSyncResult {
  readonly operations: readonly RemoteSyncOperation[];
  readonly summary: RemoteSyncSummary;
  readonly completedAt?: number;
}

export interface RemoteSyncProvider {
  readonly id: RemoteSyncProviderId;
  readonly title: string;
  createPlan(request: RemoteSyncPlanRequest): RemoteSyncPlan | Promise<RemoteSyncPlan>;
  executePlan(plan: RemoteSyncPlan, request: RemoteSyncPlanRequest): RemoteSyncResult | Promise<RemoteSyncResult>;
}

export interface RemoteSyncWorkspaceResourceOptions {
  readonly includeDirectories?: boolean;
}

export interface RemoteSyncRemoteResource {
  readonly relativePath: string;
  readonly kind: FileKind;
  readonly remoteId?: string;
  readonly size?: number;
  readonly mtime?: number;
  readonly contentHash?: string;
}

export interface RemoteSyncDiffPlanInput {
  readonly localResources: readonly RemoteSyncResource[];
  readonly remoteResources: readonly RemoteSyncRemoteResource[];
  readonly direction: RemoteSyncDirection;
  readonly deleteMissing?: boolean;
}

export interface RegisteredRemoteSyncProvider {
  readonly id: RemoteSyncProviderId;
  readonly title: string;
}

export interface IRemoteSyncService {
  registerProvider(provider: RemoteSyncProvider): IDisposable;
  getProviders(): readonly RegisteredRemoteSyncProvider[];
  createPlan(providerId: RemoteSyncProviderId, request: RemoteSyncPlanRequest): Promise<RemoteSyncPlan>;
  executePlan(
    providerId: RemoteSyncProviderId,
    plan: RemoteSyncPlan,
    request: RemoteSyncPlanRequest
  ): Promise<RemoteSyncResult>;
}

export const IRemoteSyncService = createServiceIdentifier<IRemoteSyncService>("remoteSync");

export function createRemoteSyncResourcesFromWorkspace(
  workspace: WorkspaceFileTree,
  options: RemoteSyncWorkspaceResourceOptions = {}
): readonly RemoteSyncResource[] {
  const entries = options.includeDirectories
    ? flattenWorkspaceSyncEntries(workspace.root.children ?? [])
    : workspace.files;

  return normalizeRemoteSyncResources(entries.map(remoteSyncResourceFromFileEntry));
}

export function createRemoteSyncPlanFromDiff(input: RemoteSyncDiffPlanInput): RemoteSyncPlan {
  const record = expectRecord(input, "Remote sync diff input");
  const direction = normalizeRemoteSyncDirection(record.direction);
  const deleteMissing = record.deleteMissing === true;
  const localResources = normalizeRemoteSyncResources(record.localResources);
  const remoteResources = normalizeRemoteSyncRemoteResources(record.remoteResources);
  const localByPath = mapRemoteSyncResources(localResources, "local");
  const remoteByPath = mapRemoteSyncResources(remoteResources, "remote");
  const operations: RemoteSyncOperation[] = [];

  for (const relativePath of sortRemoteSyncPaths(localByPath, remoteByPath)) {
    const local = localByPath.get(relativePath);
    const remote = remoteByPath.get(relativePath);

    operations.push(createRemoteSyncDiffOperation(relativePath, direction, deleteMissing, local, remote));
  }

  return normalizeRemoteSyncPlan({
    operations,
    summary: summarizeRemoteSyncOperations(operations)
  });
}

export class RemoteSyncService implements IRemoteSyncService {
  private readonly providers = new Map<RemoteSyncProviderId, RemoteSyncProvider>();

  registerProvider(provider: RemoteSyncProvider): IDisposable {
    const normalizedProvider = normalizeRemoteSyncProvider(provider);

    if (this.providers.has(normalizedProvider.id)) {
      throw new Error(`Remote sync provider already registered: ${normalizedProvider.id}`);
    }

    this.providers.set(normalizedProvider.id, normalizedProvider);
    return toDisposable(() => {
      if (this.providers.get(normalizedProvider.id) === normalizedProvider) {
        this.providers.delete(normalizedProvider.id);
      }
    });
  }

  getProviders(): readonly RegisteredRemoteSyncProvider[] {
    return [...this.providers.values()]
      .map((provider) => ({ id: provider.id, title: provider.title }))
      .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id));
  }

  async createPlan(providerId: RemoteSyncProviderId, request: RemoteSyncPlanRequest): Promise<RemoteSyncPlan> {
    const provider = this.getProvider(providerId);
    return normalizeRemoteSyncPlan(await provider.createPlan(normalizeRemoteSyncPlanRequest(request)));
  }

  async executePlan(
    providerId: RemoteSyncProviderId,
    plan: RemoteSyncPlan,
    request: RemoteSyncPlanRequest
  ): Promise<RemoteSyncResult> {
    const provider = this.getProvider(providerId);
    const normalizedPlan = normalizeRemoteSyncPlan(plan);
    const normalizedRequest = normalizeRemoteSyncPlanRequest(request);

    return normalizeRemoteSyncResult(await provider.executePlan(normalizedPlan, normalizedRequest));
  }

  private getProvider(providerId: RemoteSyncProviderId): RemoteSyncProvider {
    const normalizedProviderId = readRequiredString(providerId, "Remote sync provider id");
    const provider = this.providers.get(normalizedProviderId);

    if (!provider) {
      throw new Error(`No remote sync provider registered: ${normalizedProviderId}`);
    }

    return provider;
  }
}

function createRemoteSyncDiffOperation(
  relativePath: string,
  direction: RemoteSyncDirection,
  deleteMissing: boolean,
  local: RemoteSyncResource | undefined,
  remote: RemoteSyncRemoteResource | undefined
): RemoteSyncOperation {
  if (local && !remote) {
    if (direction === "pull") {
      return deleteMissing
        ? createRemoteSyncOperation("delete", "local", relativePath, {
          localUri: local.uri,
          message: "Remote resource is missing"
        })
        : createRemoteSyncOperation("skip", "none", relativePath, {
          localUri: local.uri,
          message: "Remote resource is missing"
        });
    }

    return createRemoteSyncOperation("create", "remote", relativePath, { localUri: local.uri });
  }

  if (!local && remote) {
    if (direction === "push") {
      return deleteMissing
        ? createRemoteSyncOperation("delete", "remote", relativePath, {
          remoteId: remote.remoteId,
          message: "Local resource is missing"
        })
        : createRemoteSyncOperation("skip", "none", relativePath, {
          remoteId: remote.remoteId,
          message: "Local resource is missing"
        });
    }

    return createRemoteSyncOperation("create", "local", relativePath, { remoteId: remote.remoteId });
  }

  if (!local || !remote) {
    return createRemoteSyncOperation("skip", "none", relativePath);
  }

  if (local.kind !== remote.kind) {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localUri: local.uri,
      remoteId: remote.remoteId,
      message: "Resource kind differs"
    });
  }

  const comparison = compareRemoteSyncResources(local, remote);

  if (comparison === "same") {
    return createRemoteSyncOperation("skip", "none", relativePath, {
      localUri: local.uri,
      remoteId: remote.remoteId
    });
  }

  if (direction === "bidirectional") {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localUri: local.uri,
      remoteId: remote.remoteId,
      message: comparison === "unknown" ? "Resource state cannot be compared" : "Resource differs on both sides"
    });
  }

  return createRemoteSyncOperation("update", direction === "push" ? "remote" : "local", relativePath, {
    localUri: local.uri,
    remoteId: remote.remoteId
  });
}

function createRemoteSyncOperation(
  kind: RemoteSyncOperationKind,
  target: RemoteSyncOperationTarget,
  relativePath: string,
  details: {
    readonly localUri?: URIType | undefined;
    readonly remoteId?: string | undefined;
    readonly message?: string | undefined;
  } = {}
): RemoteSyncOperation {
  return {
    kind,
    target,
    relativePath,
    ...(details.localUri ? { localUri: details.localUri } : {}),
    ...(details.remoteId ? { remoteId: details.remoteId } : {}),
    ...(details.message ? { message: details.message } : {})
  };
}

function compareRemoteSyncResources(
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource
): "same" | "changed" | "unknown" {
  if (local.contentHash && remote.contentHash) {
    return local.contentHash === remote.contentHash ? "same" : "changed";
  }

  if (local.size !== undefined && remote.size !== undefined && local.mtime !== undefined && remote.mtime !== undefined) {
    return local.size === remote.size && local.mtime === remote.mtime ? "same" : "changed";
  }

  return "unknown";
}

function summarizeRemoteSyncOperations(operations: readonly RemoteSyncOperation[]): RemoteSyncSummary {
  return {
    creates: operations.filter((operation) => operation.kind === "create").length,
    updates: operations.filter((operation) => operation.kind === "update").length,
    deletes: operations.filter((operation) => operation.kind === "delete").length,
    skips: operations.filter((operation) => operation.kind === "skip").length,
    conflicts: operations.filter((operation) => operation.kind === "conflict").length
  };
}

function mapRemoteSyncResources<Resource extends { readonly relativePath: string }>(
  resources: readonly Resource[],
  label: string
): ReadonlyMap<string, Resource> {
  const mapped = new Map<string, Resource>();

  for (const resource of resources) {
    if (mapped.has(resource.relativePath)) {
      throw new Error(`Duplicate ${label} remote sync resource: ${resource.relativePath}`);
    }

    mapped.set(resource.relativePath, resource);
  }

  return mapped;
}

function sortRemoteSyncPaths(
  localByPath: ReadonlyMap<string, RemoteSyncResource>,
  remoteByPath: ReadonlyMap<string, RemoteSyncRemoteResource>
): readonly string[] {
  return [...new Set([...localByPath.keys(), ...remoteByPath.keys()])]
    .sort((first, second) => first.localeCompare(second));
}

function remoteSyncResourceFromFileEntry(entry: FileTreeEntry): RemoteSyncResource {
  return {
    uri: entry.uri,
    relativePath: entry.relativePath,
    kind: entry.kind,
    name: entry.name,
    ...(entry.size === undefined ? {} : { size: entry.size }),
    ...(entry.mtime === undefined ? {} : { mtime: entry.mtime })
  };
}

function flattenWorkspaceSyncEntries(entries: readonly FileTreeEntry[]): readonly FileTreeEntry[] {
  const flattened: FileTreeEntry[] = [];

  for (const entry of entries) {
    flattened.push(entry);

    if (entry.children) {
      flattened.push(...flattenWorkspaceSyncEntries(entry.children));
    }
  }

  return flattened;
}

function normalizeRemoteSyncProvider(provider: RemoteSyncProvider): RemoteSyncProvider {
  const record = expectRecord(provider, "Remote sync provider");
  const id = readRequiredString(record.id, "Remote sync provider id");
  const title = readRequiredString(record.title, `Remote sync provider title for ${id}`);

  if (typeof provider.createPlan !== "function") {
    throw new Error(`Remote sync provider for ${id} must provide createPlan`);
  }

  if (typeof provider.executePlan !== "function") {
    throw new Error(`Remote sync provider for ${id} must provide executePlan`);
  }

  return {
    id,
    title,
    createPlan: (request) => provider.createPlan(request),
    executePlan: (plan, request) => provider.executePlan(plan, request)
  };
}

function normalizeRemoteSyncPlanRequest(request: RemoteSyncPlanRequest): RemoteSyncPlanRequest {
  const record = expectRecord(request, "Remote sync plan request");
  const resources = normalizeRemoteSyncResources(record.resources);
  const direction = normalizeRemoteSyncDirection(record.direction);
  const remoteScopeId = readOptionalString(record.remoteScopeId, "Remote sync scope id");
  const metadata = normalizeRemoteSyncMetadata(record.metadata);

  return {
    workspaceUri: readRequiredUri(record.workspaceUri, "Remote sync workspace URI"),
    resources,
    direction,
    ...(remoteScopeId ? { remoteScopeId } : {}),
    ...(typeof record.dryRun === "boolean" ? { dryRun: record.dryRun } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(record.signal !== undefined ? { signal: record.signal as AbortSignal } : {})
  };
}

function normalizeRemoteSyncResources(value: unknown): readonly RemoteSyncResource[] {
  if (!Array.isArray(value)) {
    throw new Error("Remote sync resources must be an array");
  }

  return value.map((resource, index) => {
    const record = expectRecord(resource, `Remote sync resource ${index}`);
    const relativePath = normalizeRelativePath(record.relativePath, `Remote sync resource ${index} relative path`);
    const name = readOptionalString(record.name, `Remote sync resource ${index} name`);
    const contentHash = readOptionalString(record.contentHash, `Remote sync resource ${index} content hash`);

    return {
      uri: readRequiredUri(record.uri, `Remote sync resource ${index} URI`),
      relativePath,
      kind: normalizeFileKind(record.kind, `Remote sync resource ${index} kind`),
      ...(name ? { name } : {}),
      ...readOptionalNonNegativeNumber("size", record.size, `Remote sync resource ${index} size`),
      ...readOptionalNonNegativeNumber("mtime", record.mtime, `Remote sync resource ${index} mtime`),
      ...(contentHash ? { contentHash } : {})
    };
  });
}

function normalizeRemoteSyncRemoteResources(value: unknown): readonly RemoteSyncRemoteResource[] {
  if (!Array.isArray(value)) {
    throw new Error("Remote sync remote resources must be an array");
  }

  return value.map((resource, index) => {
    const record = expectRecord(resource, `Remote sync remote resource ${index}`);
    const remoteId = readOptionalString(record.remoteId, `Remote sync remote resource ${index} remote id`);
    const contentHash = readOptionalString(record.contentHash, `Remote sync remote resource ${index} content hash`);

    return {
      relativePath: normalizeRelativePath(record.relativePath, `Remote sync remote resource ${index} relative path`),
      kind: normalizeFileKind(record.kind, `Remote sync remote resource ${index} kind`),
      ...(remoteId ? { remoteId } : {}),
      ...readOptionalNonNegativeNumber("size", record.size, `Remote sync remote resource ${index} size`),
      ...readOptionalNonNegativeNumber("mtime", record.mtime, `Remote sync remote resource ${index} mtime`),
      ...(contentHash ? { contentHash } : {})
    };
  });
}

function normalizeRemoteSyncPlan(plan: RemoteSyncPlan): RemoteSyncPlan {
  const record = expectRecord(plan, "Remote sync plan");

  return {
    operations: normalizeRemoteSyncOperations(record.operations),
    summary: normalizeRemoteSyncSummary(record.summary)
  };
}

function normalizeRemoteSyncResult(result: RemoteSyncResult): RemoteSyncResult {
  const record = expectRecord(result, "Remote sync result");
  const completedAt = readOptionalFiniteNumber(record.completedAt, "Remote sync completed timestamp");

  return {
    operations: normalizeRemoteSyncOperations(record.operations),
    summary: normalizeRemoteSyncSummary(record.summary),
    ...(completedAt !== undefined ? { completedAt } : {})
  };
}

function normalizeRemoteSyncOperations(value: unknown): readonly RemoteSyncOperation[] {
  if (!Array.isArray(value)) {
    throw new Error("Remote sync operations must be an array");
  }

  return value.map((operation, index) => {
    const record = expectRecord(operation, `Remote sync operation ${index}`);
    const remoteId = readOptionalString(record.remoteId, `Remote sync operation ${index} remote id`);
    const message = readOptionalString(record.message, `Remote sync operation ${index} message`);

    return {
      kind: normalizeRemoteSyncOperationKind(record.kind),
      target: normalizeRemoteSyncOperationTarget(record.target),
      relativePath: normalizeRelativePath(record.relativePath, `Remote sync operation ${index} relative path`),
      ...(record.localUri !== undefined
        ? { localUri: readRequiredUri(record.localUri, `Remote sync operation ${index} local URI`) }
        : {}),
      ...(remoteId ? { remoteId } : {}),
      ...(message ? { message } : {})
    };
  });
}

function normalizeRemoteSyncSummary(value: unknown): RemoteSyncSummary {
  const record = expectRecord(value, "Remote sync summary");

  return {
    creates: readSummaryCount(record.creates, "creates"),
    updates: readSummaryCount(record.updates, "updates"),
    deletes: readSummaryCount(record.deletes, "deletes"),
    skips: readSummaryCount(record.skips, "skips"),
    conflicts: readSummaryCount(record.conflicts, "conflicts")
  };
}

function normalizeRemoteSyncMetadata(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, "Remote sync metadata");
  const metadata: Record<string, string> = {};

  for (const [key, metadataValue] of Object.entries(record)) {
    const normalizedKey = key.trim();

    if (!normalizedKey) {
      throw new Error("Remote sync metadata keys must not be empty");
    }

    metadata[normalizedKey] = readString(metadataValue, `Remote sync metadata ${normalizedKey}`);
  }

  return metadata;
}

function normalizeRemoteSyncDirection(value: unknown): RemoteSyncDirection {
  if (value !== "push" && value !== "pull" && value !== "bidirectional") {
    throw new Error("Remote sync direction must be push, pull, or bidirectional");
  }

  return value;
}

function normalizeRemoteSyncOperationKind(value: unknown): RemoteSyncOperationKind {
  if (value !== "create" && value !== "update" && value !== "delete" && value !== "skip" && value !== "conflict") {
    throw new Error("Remote sync operation kind must be create, update, delete, skip, or conflict");
  }

  return value;
}

function normalizeRemoteSyncOperationTarget(value: unknown): RemoteSyncOperationTarget {
  if (value !== "local" && value !== "remote" && value !== "both" && value !== "none") {
    throw new Error("Remote sync operation target must be local, remote, both, or none");
  }

  return value;
}

function normalizeFileKind(value: unknown, label: string): FileKind {
  if (value !== "file" && value !== "directory") {
    throw new Error(`${label} must be file or directory`);
  }

  return value;
}

function normalizeRelativePath(value: unknown, label: string): string {
  const normalized = readRequiredString(value, label).replaceAll("\\", "/");

  if (normalized.startsWith("/") || /^[a-z][a-z0-9+.-]*:/i.test(normalized)) {
    throw new Error(`${label} must be workspace-relative`);
  }

  const segments: string[] = [];

  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      throw new Error(`${label} must not contain parent traversal`);
    }

    segments.push(segment);
  }

  const relativePath = segments.join("/");

  if (!relativePath) {
    throw new Error(`${label} must not be empty`);
  }

  return relativePath;
}

function readRequiredUri(value: unknown, label: string): URIType {
  if (typeof value !== "object" || value === null || typeof (value as { toString?: unknown }).toString !== "function") {
    throw new Error(`${label} must be a URI`);
  }

  return value as URIType;
}

function readOptionalNonNegativeNumber<Key extends string>(
  key: Key,
  value: unknown,
  label: string
): Partial<Record<Key, number>> {
  if (value === undefined) {
    return {};
  }

  const normalizedValue = readOptionalFiniteNumber(value, label);

  if (normalizedValue === undefined || normalizedValue < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }

  return { [key]: normalizedValue } as Partial<Record<Key, number>>;
}

function readOptionalFiniteNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }

  return value;
}

function readSummaryCount(value: unknown, key: keyof RemoteSyncSummary): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Remote sync summary ${key} must be a non-negative integer`);
  }

  return value;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  const normalized = readString(value, label).trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, label).trim() || undefined;
}
