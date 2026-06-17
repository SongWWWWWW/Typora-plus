import { Emitter, toDisposable, type Event, type IDisposable, type URI as URIType } from "@typora-plus/base";
import {
  configurationBytesPerMegabyte,
  configurationMaxRemoteSyncProviderIdLength,
  configurationMaxRemoteSyncProviderTitleLength
} from "./configuration";
import { createServiceIdentifier } from "./instantiation";
import type { FileKind, FileTreeEntry, WorkspaceFileTree } from "./files";

export type RemoteSyncProviderId = string;
export type RemoteSyncDirection = "push" | "pull" | "bidirectional";
export type RemoteSyncOperationKind = "create" | "update" | "delete" | "skip" | "conflict";
export type RemoteSyncOperationTarget = "local" | "remote" | "both" | "none";
export type RemoteSyncResourcePresence = "present" | "missing" | "unknown";

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
  readonly onProgress?: (progress: RemoteSyncProgress) => void;
  readonly signal?: AbortSignal;
}

export interface RemoteSyncOperation {
  readonly kind: RemoteSyncOperationKind;
  readonly target: RemoteSyncOperationTarget;
  readonly relativePath: string;
  readonly localPresence?: RemoteSyncResourcePresence;
  readonly localUri?: URIType;
  readonly remotePresence?: RemoteSyncResourcePresence;
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

export interface RemoteSyncProgress {
  readonly message: string;
  readonly completed?: number;
  readonly total?: number;
  readonly operation?: RemoteSyncOperation;
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

export interface RemoteSyncManifestResource {
  readonly relativePath: string;
  readonly kind: FileKind;
  readonly remoteId?: string;
  readonly size?: number;
  readonly mtime?: number;
  readonly contentHash?: string;
}

export interface RemoteSyncManifestPlanInput extends RemoteSyncDiffPlanInput {
  readonly manifestResources: readonly RemoteSyncManifestResource[];
}

export interface RemoteSyncManifestExecutionUpdateInput {
  readonly manifestResources: readonly RemoteSyncManifestResource[];
  readonly localResources: readonly RemoteSyncResource[];
  readonly remoteResources: readonly RemoteSyncRemoteResource[];
  readonly operations: readonly RemoteSyncOperation[];
}

export const remoteSyncManifestSnapshotVersion = 1;

export interface RemoteSyncManifestSnapshot {
  readonly version: typeof remoteSyncManifestSnapshotVersion;
  readonly scope?: string;
  readonly providerId?: string;
  readonly remoteScopeId?: string;
  readonly resources: readonly RemoteSyncManifestResource[];
}

export interface RemoteSyncManifestStoreScope {
  readonly workspaceUri?: URIType | string;
  readonly providerId?: string;
  readonly remoteScopeId?: string;
}

export interface RemoteSyncManifestStorage {
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

export interface NativeRemoteSyncManifestBridge {
  readonly isAvailable: boolean;
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

export interface NativeRemoteSyncSecretBridge {
  readonly isAvailable: boolean;
  setSecret(secretRef: string, value: string): Promise<boolean>;
  deleteSecret(secretRef: string): Promise<boolean>;
}

export const remoteSyncMaxSecretRefLength = 256;
export const remoteSyncRequestMetadataLimits = {
  entries: 100,
  keyLength: 120,
  valueLength: 4000
} as const;
export const remoteSyncPayloadLimits = {
  completedAtMax: 10_000_000_000_000,
  manifestScopeLength: 4000,
  messageLength: 4000,
  operationCount: 10_000,
  relativePathLength: 1000,
  remoteIdLength: 512,
  resourceCount: 10_000,
  uriLength: 2000
} as const;
export const remoteSyncManifestStorageKeyLimits = {
  baseKeyLength: 240,
  storageKeyLength: 260
} as const;

export interface RemoteSyncManifestStoreOptions {
  readonly storage: RemoteSyncManifestStorage;
  readonly storageKey?: string;
  readonly maxSnapshotBytes?: number;
}

export const defaultRemoteSyncManifestStoreOptions = {
  storageKey: "typora-plus.remoteSync.manifest",
  maxSnapshotBytes: configurationBytesPerMegabyte
} as const;

export interface RegisteredRemoteSyncProvider {
  readonly id: RemoteSyncProviderId;
  readonly title: string;
}

export interface IRemoteSyncService {
  readonly onDidChangeRemoteSyncProviders: Event<void>;
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

export class RemoteSyncManifestStore {
  private readonly storage: RemoteSyncManifestStorage;
  private readonly baseStorageKey: string;
  private readonly maxSnapshotBytes: number;
  private storageKey: string;
  private currentScope: NormalizedRemoteSyncManifestStoreScope = {};

  constructor(options: RemoteSyncManifestStoreOptions) {
    this.storage = options.storage;
    this.baseStorageKey = normalizeRemoteSyncManifestStorageBaseKey(
      options.storageKey ?? defaultRemoteSyncManifestStoreOptions.storageKey
    );
    this.storageKey = this.baseStorageKey;
    this.maxSnapshotBytes = options.maxSnapshotBytes ?? defaultRemoteSyncManifestStoreOptions.maxSnapshotBytes;
  }

  setScope(scope: RemoteSyncManifestStoreScope | string | undefined): void {
    this.currentScope = normalizeRemoteSyncManifestStoreScope(scope);
    this.storageKey = createRemoteSyncManifestStorageKey(this.baseStorageKey, this.currentScope.scope);
  }

  readResources(): readonly RemoteSyncManifestResource[] {
    const snapshot = this.readSnapshot();
    return snapshot?.resources ?? [];
  }

  writeResources(resources: readonly RemoteSyncManifestResource[]): void {
    this.writeSnapshot(createRemoteSyncManifestSnapshot(
      normalizeUniqueRemoteSyncManifestResources(resources, "manifest store"),
      this.currentScope
    ));
  }

  clear(): void {
    this.writeSnapshot(createRemoteSyncManifestSnapshot([], this.currentScope));
  }

  private readSnapshot(): RemoteSyncManifestSnapshot | undefined {
    const snapshot = readRemoteSyncManifestSnapshot(this.storage.read(this.storageKey));

    if (!snapshot) {
      return undefined;
    }

    if (snapshot.scope !== this.currentScope.scope) {
      return undefined;
    }

    return snapshot;
  }

  private writeSnapshot(snapshot: RemoteSyncManifestSnapshot): void {
    const value = JSON.stringify(snapshot);
    const persistedValue = value.length <= this.maxSnapshotBytes
      ? value
      : JSON.stringify(createRemoteSyncManifestSnapshot([], this.currentScope));

    try {
      this.storage.write(this.storageKey, persistedValue);
    } catch {
      try {
        this.storage.write(this.storageKey, JSON.stringify(createRemoteSyncManifestSnapshot([], this.currentScope)));
      } catch {
        // Storage backends such as localStorage can reject writes when quota is exhausted.
      }
    }
  }
}

export function createRemoteSyncManifestStorageKey(
  baseKey: string,
  scope: RemoteSyncManifestStoreScope | string | undefined
): string {
  const normalizedBaseKey = normalizeRemoteSyncManifestStorageBaseKey(baseKey);
  const normalizedScope = normalizeRemoteSyncManifestStoreScope(scope).scope;

  if (!normalizedScope) {
    return normalizedBaseKey;
  }

  return normalizeRemoteSyncManifestStorageKey(
    `${normalizedBaseKey}.${hashRemoteSyncManifestScope(normalizedScope)}`
  );
}

export function createDefaultRemoteSyncManifestStorage(): RemoteSyncManifestStorage | undefined {
  return createNativeRemoteSyncManifestStorage() ?? createBrowserRemoteSyncManifestStorage();
}

export function createBrowserRemoteSyncManifestStorage(): RemoteSyncManifestStorage | undefined {
  if (!hasLocalStorage()) {
    return undefined;
  }

  return {
    read(key) {
      return window.localStorage.getItem(normalizeRemoteSyncManifestStorageKey(key)) ?? undefined;
    },
    write(key, value) {
      window.localStorage.setItem(normalizeRemoteSyncManifestStorageKey(key), value);
    }
  };
}

function createNativeRemoteSyncManifestStorage(): RemoteSyncManifestStorage | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly remoteSyncManifests?: NativeRemoteSyncManifestBridge;
    };
  };
  const bridge = candidate.typoraPlus?.remoteSyncManifests;

  if (!bridge?.isAvailable) {
    return undefined;
  }

  return {
    read: (key) => bridge.read(normalizeRemoteSyncManifestStorageKey(key)),
    write: (key, value) => bridge.write(normalizeRemoteSyncManifestStorageKey(key), value)
  };
}

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

export function createRemoteSyncPlanFromManifest(input: RemoteSyncManifestPlanInput): RemoteSyncPlan {
  const record = expectRecord(input, "Remote sync manifest plan input");
  const direction = normalizeRemoteSyncDirection(record.direction);

  if (direction === "push") {
    return createRemoteSyncPushPlanFromManifest(input);
  }

  if (direction !== "bidirectional") {
    return createRemoteSyncPlanFromDiff(input);
  }

  const deleteMissing = record.deleteMissing === true;
  const localResources = normalizeRemoteSyncResources(record.localResources);
  const remoteResources = normalizeRemoteSyncRemoteResources(record.remoteResources);
  const manifestResources = normalizeRemoteSyncManifestResources(record.manifestResources);
  const localByPath = mapRemoteSyncResources(localResources, "local");
  const remoteByPath = mapRemoteSyncResources(remoteResources, "remote");
  const manifestByPath = mapRemoteSyncResources(manifestResources, "manifest");
  const operations: RemoteSyncOperation[] = [];

  for (const relativePath of sortRemoteSyncPaths(localByPath, remoteByPath, manifestByPath)) {
    operations.push(createRemoteSyncManifestOperation(
      relativePath,
      deleteMissing,
      localByPath.get(relativePath),
      remoteByPath.get(relativePath),
      manifestByPath.get(relativePath)
    ));
  }

  return normalizeRemoteSyncPlan({
    operations,
    summary: summarizeRemoteSyncOperations(operations)
  });
}

function createRemoteSyncPushPlanFromManifest(input: RemoteSyncManifestPlanInput): RemoteSyncPlan {
  const record = expectRecord(input, "Remote sync push manifest plan input");
  const deleteMissing = record.deleteMissing === true;
  const localResources = normalizeRemoteSyncResources(record.localResources);
  const remoteResources = normalizeRemoteSyncRemoteResources(record.remoteResources);
  const manifestResources = normalizeRemoteSyncManifestResources(record.manifestResources);
  const localByPath = mapRemoteSyncResources(localResources, "local");
  const remoteByPath = mapRemoteSyncResources(remoteResources, "remote");
  const manifestByPath = mapRemoteSyncResources(manifestResources, "manifest");
  const operations: RemoteSyncOperation[] = [];

  for (const relativePath of sortRemoteSyncPaths(localByPath, remoteByPath, manifestByPath)) {
    operations.push(createRemoteSyncPushManifestOperation(
      relativePath,
      deleteMissing,
      localByPath.get(relativePath),
      remoteByPath.get(relativePath),
      manifestByPath.get(relativePath)
    ));
  }

  return normalizeRemoteSyncPlan({
    operations,
    summary: summarizeRemoteSyncOperations(operations)
  });
}

export function createRemoteSyncManifestResourcesFromExecution(
  input: RemoteSyncManifestExecutionUpdateInput
): readonly RemoteSyncManifestResource[] {
  const record = expectRecord(input, "Remote sync manifest execution update input");
  const manifestResources = normalizeUniqueRemoteSyncManifestResources(record.manifestResources, "manifest");
  const localByPath = mapRemoteSyncResources(normalizeRemoteSyncResources(record.localResources), "local");
  const remoteByPath = mapRemoteSyncResources(normalizeRemoteSyncRemoteResources(record.remoteResources), "remote");
  const operations = normalizeRemoteSyncOperations(record.operations);
  const manifestByPath = new Map<string, RemoteSyncManifestResource>(
    manifestResources.map((resource) => [resource.relativePath, resource])
  );

  for (const operation of operations) {
    switch (operation.kind) {
      case "create":
      case "update":
        manifestByPath.set(operation.relativePath, createRemoteSyncManifestResourceFromExecutedOperation(
          operation,
          localByPath.get(operation.relativePath),
          remoteByPath.get(operation.relativePath)
        ));
        break;
      case "delete":
        if (operation.target === "local" || operation.target === "remote" || operation.target === "both") {
          manifestByPath.delete(operation.relativePath);
        }
        break;
      case "skip":
        if (operation.target === "none") {
          const local = localByPath.get(operation.relativePath);
          const remote = remoteByPath.get(operation.relativePath);

          if (local && remote) {
            manifestByPath.set(operation.relativePath, createRemoteSyncManifestResourceFromExecutedSkip(
              operation,
              local,
              remote
            ));
          }
        }
        break;
      case "conflict":
        break;
    }
  }

  return [...manifestByPath.values()]
    .sort((first, second) => first.relativePath.localeCompare(second.relativePath));
}

export class RemoteSyncService implements IRemoteSyncService {
  private readonly providers = new Map<RemoteSyncProviderId, RemoteSyncProvider>();
  private readonly onDidChangeRemoteSyncProvidersEmitter = new Emitter<void>();

  readonly onDidChangeRemoteSyncProviders = this.onDidChangeRemoteSyncProvidersEmitter.event;

  registerProvider(provider: RemoteSyncProvider): IDisposable {
    const normalizedProvider = normalizeRemoteSyncProvider(provider);

    if (this.providers.has(normalizedProvider.id)) {
      throw new Error(`Remote sync provider already registered: ${normalizedProvider.id}`);
    }

    this.providers.set(normalizedProvider.id, normalizedProvider);
    this.onDidChangeRemoteSyncProvidersEmitter.fire();

    return toDisposable(() => {
      if (this.providers.get(normalizedProvider.id) === normalizedProvider) {
        this.providers.delete(normalizedProvider.id);
        this.onDidChangeRemoteSyncProvidersEmitter.fire();
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
    const normalizedProviderId = normalizeRemoteSyncProviderId(providerId, "Remote sync provider id");
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
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "present",
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
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "present",
      remoteId: remote.remoteId,
      message: comparison === "unknown" ? "Resource state cannot be compared" : "Resource differs on both sides"
    });
  }

  return createRemoteSyncOperation("update", direction === "push" ? "remote" : "local", relativePath, {
    localUri: local.uri,
    remoteId: remote.remoteId
  });
}

function createRemoteSyncManifestOperation(
  relativePath: string,
  deleteMissing: boolean,
  local: RemoteSyncResource | undefined,
  remote: RemoteSyncRemoteResource | undefined,
  manifest: RemoteSyncManifestResource | undefined
): RemoteSyncOperation {
  if (local && remote) {
    return createRemoteSyncManifestPresentOperation(relativePath, local, remote, manifest);
  }

  if (local && !remote) {
    return createRemoteSyncManifestLocalOnlyOperation(relativePath, deleteMissing, local, manifest);
  }

  if (!local && remote) {
    return createRemoteSyncManifestRemoteOnlyOperation(relativePath, deleteMissing, remote, manifest);
  }

  return createRemoteSyncOperation("skip", "none", relativePath, {
    ...(manifest?.remoteId ? { remoteId: manifest.remoteId } : {}),
    message: "Resource is missing locally and remotely"
  });
}

function createRemoteSyncPushManifestOperation(
  relativePath: string,
  deleteMissing: boolean,
  local: RemoteSyncResource | undefined,
  remote: RemoteSyncRemoteResource | undefined,
  manifest: RemoteSyncManifestResource | undefined
): RemoteSyncOperation {
  if (local && remote) {
    return createRemoteSyncPushManifestPresentOperation(relativePath, local, remote, manifest);
  }

  if (local && !remote) {
    return createRemoteSyncOperation("create", "remote", relativePath, { localUri: local.uri });
  }

  if (!local && remote) {
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

  return createRemoteSyncOperation("skip", "none", relativePath, {
    ...(manifest?.remoteId ? { remoteId: manifest.remoteId } : {}),
    message: "Resource is missing locally and remotely"
  });
}

function createRemoteSyncPushManifestPresentOperation(
  relativePath: string,
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource,
  manifest: RemoteSyncManifestResource | undefined
): RemoteSyncOperation {
  if (local.kind !== remote.kind) {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "present",
      remoteId: remote.remoteId,
      message: "Resource kind differs"
    });
  }

  if (manifest && manifest.kind === local.kind) {
    const localState = compareRemoteSyncResourceToManifest(local, manifest);

    if (localState === "same") {
      return createRemoteSyncOperation("skip", "none", relativePath, {
        localUri: local.uri,
        remoteId: remote.remoteId
      });
    }

    if (localState === "changed") {
      return createRemoteSyncOperation("update", "remote", relativePath, {
        localUri: local.uri,
        remoteId: remote.remoteId
      });
    }
  }

  return createRemoteSyncDiffOperation(relativePath, "push", false, local, remote);
}

function createRemoteSyncManifestPresentOperation(
  relativePath: string,
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource,
  manifest: RemoteSyncManifestResource | undefined
): RemoteSyncOperation {
  if (local.kind !== remote.kind) {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "present",
      remoteId: remote.remoteId,
      message: "Resource kind differs"
    });
  }

  const currentComparison = compareRemoteSyncResources(local, remote);

  if (currentComparison === "same") {
    return createRemoteSyncOperation("skip", "none", relativePath, {
      localUri: local.uri,
      remoteId: remote.remoteId
    });
  }

  if (!manifest) {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "present",
      remoteId: remote.remoteId,
      message: currentComparison === "unknown"
        ? "Resource state cannot be compared"
        : "Resource has no synced baseline"
    });
  }

  if (manifest.kind !== local.kind || manifest.kind !== remote.kind) {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "present",
      remoteId: remote.remoteId,
      message: "Synced baseline kind differs"
    });
  }

  const localState = compareRemoteSyncResourceToManifest(local, manifest);
  const remoteState = compareRemoteSyncResourceToManifest(remote, manifest);

  if (localState === "unknown" || remoteState === "unknown") {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "present",
      remoteId: remote.remoteId,
      message: "Resource state cannot be compared"
    });
  }

  if (localState === "same" && remoteState === "changed") {
    return createRemoteSyncOperation("update", "local", relativePath, {
      localUri: local.uri,
      remoteId: remote.remoteId
    });
  }

  if (localState === "changed" && remoteState === "same") {
    return createRemoteSyncOperation("update", "remote", relativePath, {
      localUri: local.uri,
      remoteId: remote.remoteId
    });
  }

  return createRemoteSyncOperation("conflict", "both", relativePath, {
    localPresence: "present",
    localUri: local.uri,
    remotePresence: "present",
    remoteId: remote.remoteId,
    message: "Resource changed on both sides"
  });
}

function createRemoteSyncManifestLocalOnlyOperation(
  relativePath: string,
  deleteMissing: boolean,
  local: RemoteSyncResource,
  manifest: RemoteSyncManifestResource | undefined
): RemoteSyncOperation {
  if (!manifest) {
    return createRemoteSyncOperation("create", "remote", relativePath, { localUri: local.uri });
  }

  const localState = compareRemoteSyncResourceToManifest(local, manifest);

  if (localState === "changed" || localState === "unknown") {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localPresence: "present",
      localUri: local.uri,
      remotePresence: "missing",
      remoteId: manifest.remoteId,
      message: localState === "unknown"
        ? "Resource state cannot be compared"
        : "Remote resource is missing and local resource changed"
    });
  }

  return deleteMissing
    ? createRemoteSyncOperation("delete", "local", relativePath, {
      localUri: local.uri,
      remoteId: manifest.remoteId,
      message: "Remote resource is missing"
    })
    : createRemoteSyncOperation("skip", "none", relativePath, {
      localUri: local.uri,
      remoteId: manifest.remoteId,
      message: "Remote resource is missing"
    });
}

function createRemoteSyncManifestRemoteOnlyOperation(
  relativePath: string,
  deleteMissing: boolean,
  remote: RemoteSyncRemoteResource,
  manifest: RemoteSyncManifestResource | undefined
): RemoteSyncOperation {
  if (!manifest) {
    return createRemoteSyncOperation("create", "local", relativePath, { remoteId: remote.remoteId });
  }

  const remoteState = compareRemoteSyncResourceToManifest(remote, manifest);

  if (remoteState === "changed" || remoteState === "unknown") {
    return createRemoteSyncOperation("conflict", "both", relativePath, {
      localPresence: "missing",
      remotePresence: "present",
      remoteId: remote.remoteId,
      message: remoteState === "unknown"
        ? "Resource state cannot be compared"
        : "Local resource is missing and remote resource changed"
    });
  }

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

function createRemoteSyncManifestResourceFromExecutedOperation(
  operation: RemoteSyncOperation,
  local: RemoteSyncResource | undefined,
  remote: RemoteSyncRemoteResource | undefined
): RemoteSyncManifestResource {
  if (operation.target !== "local" && operation.target !== "remote") {
    throw new Error(`Remote sync manifest update ${operation.relativePath} must target local or remote`);
  }

  if (!local || !remote) {
    throw new Error(`Remote sync manifest update ${operation.relativePath} requires local and remote resources`);
  }

  if (local.kind !== remote.kind) {
    throw new Error(`Remote sync manifest update ${operation.relativePath} resource kind differs`);
  }

  if (hasRemoteSyncExecutedResourceMismatch(local, remote)) {
    throw new Error(
      `Remote sync manifest update ${operation.relativePath} resources are not synchronized`
    );
  }

  const resource = createRemoteSyncManifestResourceFromExecutedResources(
    operation,
    local,
    remote,
    operation.remoteId ?? remote.remoteId
  );

  if (!hasRemoteSyncComparableResource(resource)) {
    throw new Error(`Remote sync manifest update ${operation.relativePath} resource state cannot be compared`);
  }

  return resource;
}

function createRemoteSyncManifestResourceFromExecutedSkip(
  operation: RemoteSyncOperation,
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource
): RemoteSyncManifestResource {
  if (local.kind !== remote.kind) {
    throw new Error(`Remote sync manifest update ${operation.relativePath} resource kind differs`);
  }

  const comparison = compareRemoteSyncResources(local, remote);

  if (comparison !== "same") {
    const fallback = createRemoteSyncManifestResourceFromSyncedResources(
      local,
      remote,
      operation.remoteId ?? remote.remoteId
    );

    if (comparison === "unknown" && hasRemoteSyncComparableResource(fallback)) {
      return fallback;
    }

    throw new Error(
      comparison === "unknown"
        ? `Remote sync manifest update ${operation.relativePath} resource state cannot be compared`
        : `Remote sync manifest update ${operation.relativePath} resources are not synchronized`
    );
  }

  return createRemoteSyncManifestResourceFromSyncedResources(
    local,
    remote,
    operation.remoteId ?? remote.remoteId
  );
}

function createRemoteSyncManifestResourceFromSyncedResources(
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource,
  remoteId: string | undefined
): RemoteSyncManifestResource {
  const contentHash = local.contentHash && remote.contentHash
    ? local.contentHash
    : local.contentHash ?? remote.contentHash;

  return {
    relativePath: local.relativePath,
    kind: local.kind,
    ...(remoteId ? { remoteId } : {}),
    ...(local.size !== undefined && local.size === remote.size ? { size: local.size } : {}),
    ...(local.mtime !== undefined && local.mtime === remote.mtime ? { mtime: local.mtime } : {}),
    ...(contentHash ? { contentHash } : {})
  };
}

function createRemoteSyncManifestResourceFromExecutedResources(
  operation: RemoteSyncOperation,
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource,
  remoteId: string | undefined
): RemoteSyncManifestResource {
  const source = operation.target === "remote" ? local : remote;
  const target = operation.target === "remote" ? remote : local;
  const contentHash = source.contentHash ?? target.contentHash;
  const size = source.size ?? target.size;
  const mtime = contentHash
    ? target.mtime ?? source.mtime
    : local.mtime !== undefined && local.mtime === remote.mtime
      ? local.mtime
      : undefined;

  return {
    relativePath: local.relativePath,
    kind: local.kind,
    ...(remoteId ? { remoteId } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(mtime !== undefined ? { mtime } : {}),
    ...(contentHash ? { contentHash } : {})
  };
}

function hasRemoteSyncExecutedResourceMismatch(
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource
): boolean {
  if (local.contentHash && remote.contentHash && local.contentHash !== remote.contentHash) {
    return true;
  }

  return local.size !== undefined && remote.size !== undefined && local.size !== remote.size;
}

function hasRemoteSyncComparableResource(
  resource: Pick<RemoteSyncManifestResource, "contentHash" | "kind" | "mtime" | "size">
): boolean {
  if (resource.kind === "directory") {
    return true;
  }

  return !!resource.contentHash || (resource.size !== undefined && resource.mtime !== undefined);
}

function createRemoteSyncOperation(
  kind: RemoteSyncOperationKind,
  target: RemoteSyncOperationTarget,
  relativePath: string,
  details: {
    readonly localPresence?: RemoteSyncResourcePresence | undefined;
    readonly localUri?: URIType | undefined;
    readonly remotePresence?: RemoteSyncResourcePresence | undefined;
    readonly remoteId?: string | undefined;
    readonly message?: string | undefined;
  } = {}
): RemoteSyncOperation {
  return {
    kind,
    target,
    relativePath,
    ...(details.localPresence ? { localPresence: details.localPresence } : {}),
    ...(details.localUri ? { localUri: details.localUri } : {}),
    ...(details.remotePresence ? { remotePresence: details.remotePresence } : {}),
    ...(details.remoteId ? { remoteId: details.remoteId } : {}),
    ...(details.message ? { message: details.message } : {})
  };
}

function compareRemoteSyncResources(
  local: RemoteSyncResource,
  remote: RemoteSyncRemoteResource
): "same" | "changed" | "unknown" {
  if (local.kind === "directory" && remote.kind === "directory") {
    return "same";
  }

  return compareRemoteSyncResourceMetadata(local, remote);
}

function compareRemoteSyncResourceToManifest(
  resource: RemoteSyncResource | RemoteSyncRemoteResource,
  manifest: RemoteSyncManifestResource
): "same" | "changed" | "unknown" {
  if (resource.kind !== manifest.kind) {
    return "changed";
  }

  if (resource.kind === "directory") {
    return "same";
  }

  return compareRemoteSyncResourceMetadata(resource, manifest);
}

function compareRemoteSyncResourceMetadata(
  first: Pick<RemoteSyncResource, "contentHash" | "mtime" | "size">,
  second: Pick<RemoteSyncRemoteResource, "contentHash" | "mtime" | "size">
): "same" | "changed" | "unknown" {
  if (first.contentHash && second.contentHash) {
    return first.contentHash === second.contentHash ? "same" : "changed";
  }

  if (first.size !== undefined && second.size !== undefined && first.mtime !== undefined && second.mtime !== undefined) {
    return first.size === second.size && first.mtime === second.mtime ? "same" : "changed";
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
  remoteByPath: ReadonlyMap<string, RemoteSyncRemoteResource>,
  manifestByPath?: ReadonlyMap<string, RemoteSyncManifestResource>
): readonly string[] {
  return [...new Set([
    ...localByPath.keys(),
    ...remoteByPath.keys(),
    ...(manifestByPath ? manifestByPath.keys() : [])
  ])]
    .sort((first, second) => first.localeCompare(second));
}

interface NormalizedRemoteSyncManifestStoreScope {
  readonly scope?: string;
  readonly providerId?: string;
  readonly remoteScopeId?: string;
}

function normalizeRemoteSyncManifestStoreScope(
  scope: RemoteSyncManifestStoreScope | string | undefined
): NormalizedRemoteSyncManifestStoreScope {
  if (scope === undefined) {
    return {};
  }

  if (typeof scope === "string") {
    const normalizedScope = normalizeRemoteSyncManifestScopeValue(scope);
    return normalizedScope ? { scope: normalizedScope } : {};
  }

  const record = expectRecord(scope, "Remote sync manifest store scope");
  const workspaceUri = readOptionalUriString(record.workspaceUri, "Remote sync manifest workspace URI");
  const providerId = normalizeOptionalRemoteSyncProviderId(record.providerId, "Remote sync manifest provider id");
  const remoteScopeId = readOptionalString(
    record.remoteScopeId,
    "Remote sync manifest remote scope id",
    remoteSyncPayloadLimits.remoteIdLength
  );
  const normalizedScope = createRemoteSyncManifestScopeValue({
    ...(workspaceUri ? { workspaceUri } : {}),
    ...(providerId ? { providerId } : {}),
    ...(remoteScopeId ? { remoteScopeId } : {})
  });

  return {
    ...(normalizedScope ? { scope: normalizedScope } : {}),
    ...(providerId ? { providerId } : {}),
    ...(remoteScopeId ? { remoteScopeId } : {})
  };
}

function createRemoteSyncManifestScopeValue(scope: {
  readonly workspaceUri?: string;
  readonly providerId?: string;
  readonly remoteScopeId?: string;
}): string | undefined {
  if (!scope.workspaceUri && !scope.providerId && !scope.remoteScopeId) {
    return undefined;
  }

  const scopeValue = JSON.stringify(scope);

  if (scopeValue.length > remoteSyncPayloadLimits.manifestScopeLength) {
    throw new Error(`Remote sync manifest scope must be at most ${remoteSyncPayloadLimits.manifestScopeLength} characters`);
  }

  return scopeValue;
}

function normalizeRemoteSyncManifestScopeValue(value: string): string | undefined {
  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > remoteSyncPayloadLimits.manifestScopeLength) {
    throw new Error(`Remote sync manifest scope must be at most ${remoteSyncPayloadLimits.manifestScopeLength} characters`);
  }

  return normalized;
}

function normalizeRemoteSyncManifestStorageBaseKey(value: unknown): string {
  const normalized = readTrimmedRequiredString(
    value,
    "Remote sync manifest storage key",
    remoteSyncManifestStorageKeyLimits.baseKeyLength
  );

  return validateRemoteSyncManifestStorageKey(normalized);
}

function normalizeRemoteSyncManifestStorageKey(value: unknown): string {
  const normalized = readTrimmedRequiredString(
    value,
    "Remote sync manifest storage key",
    remoteSyncManifestStorageKeyLimits.storageKeyLength
  );

  return validateRemoteSyncManifestStorageKey(normalized);
}

function validateRemoteSyncManifestStorageKey(normalized: string): string {
  if (!/^[A-Za-z0-9][A-Za-z0-9.-]*$/.test(normalized)) {
    throw new Error(`Remote sync manifest storage key is invalid: ${normalized}`);
  }

  return normalized;
}

function createRemoteSyncManifestSnapshot(
  resources: readonly RemoteSyncManifestResource[],
  scope: NormalizedRemoteSyncManifestStoreScope
): RemoteSyncManifestSnapshot {
  return {
    version: remoteSyncManifestSnapshotVersion,
    ...(scope.scope ? { scope: scope.scope } : {}),
    ...(scope.providerId ? { providerId: scope.providerId } : {}),
    ...(scope.remoteScopeId ? { remoteScopeId: scope.remoteScopeId } : {}),
    resources
  };
}

function readRemoteSyncManifestSnapshot(value: string | undefined): RemoteSyncManifestSnapshot | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return sanitizeRemoteSyncManifestSnapshot(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function sanitizeRemoteSyncManifestSnapshot(value: unknown): RemoteSyncManifestSnapshot | undefined {
  try {
    const record = expectRecord(value, "Remote sync manifest snapshot");

    if (record.version !== remoteSyncManifestSnapshotVersion || !Array.isArray(record.resources)) {
      return undefined;
    }

    const scope = readOptionalString(
      record.scope,
      "Remote sync manifest snapshot scope",
      remoteSyncPayloadLimits.manifestScopeLength
    );
    const providerId = normalizeOptionalRemoteSyncProviderId(
      record.providerId,
      "Remote sync manifest snapshot provider id"
    );
    const remoteScopeId = readOptionalString(
      record.remoteScopeId,
      "Remote sync manifest snapshot remote scope id",
      remoteSyncPayloadLimits.remoteIdLength
    );

    return {
      version: remoteSyncManifestSnapshotVersion,
      ...(scope ? { scope } : {}),
      ...(providerId ? { providerId } : {}),
      ...(remoteScopeId ? { remoteScopeId } : {}),
      resources: normalizeUniqueRemoteSyncManifestResources(record.resources, "manifest snapshot")
    };
  } catch {
    return undefined;
  }
}

function normalizeUniqueRemoteSyncManifestResources(value: unknown, label: string): readonly RemoteSyncManifestResource[] {
  const resources = normalizeRemoteSyncManifestResources(value);
  mapRemoteSyncResources(resources, label);

  return [...resources].sort((first, second) => first.relativePath.localeCompare(second.relativePath));
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
  const id = normalizeRemoteSyncProviderId(record.id, "Remote sync provider id");
  const title = readTrimmedRequiredString(
    record.title,
    `Remote sync provider title for ${id}`,
    configurationMaxRemoteSyncProviderTitleLength
  );

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
  const remoteScopeId = readOptionalStringAllowEmpty(
    record.remoteScopeId,
    "Remote sync scope id",
    remoteSyncPayloadLimits.remoteIdLength
  );
  const metadata = normalizeRemoteSyncMetadata(record.metadata);
  const onProgress = readOptionalRemoteSyncProgressCallback(record.onProgress);

  return {
    workspaceUri: readRequiredUri(record.workspaceUri, "Remote sync workspace URI"),
    resources,
    direction,
    ...(remoteScopeId !== undefined ? { remoteScopeId } : {}),
    ...(typeof record.dryRun === "boolean" ? { dryRun: record.dryRun } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(onProgress ? { onProgress } : {}),
    ...(record.signal !== undefined ? { signal: record.signal as AbortSignal } : {})
  };
}

function normalizeRemoteSyncResources(value: unknown): readonly RemoteSyncResource[] {
  if (!Array.isArray(value)) {
    throw new Error("Remote sync resources must be an array");
  }

  if (value.length > remoteSyncPayloadLimits.resourceCount) {
    throw new Error(`Remote sync resources must contain at most ${remoteSyncPayloadLimits.resourceCount} items`);
  }

  return value.map((resource, index) => {
    const record = expectRecord(resource, `Remote sync resource ${index}`);
    const relativePath = normalizeRelativePath(record.relativePath, `Remote sync resource ${index} relative path`);
    const name = readOptionalString(
      record.name,
      `Remote sync resource ${index} name`,
      remoteSyncPayloadLimits.relativePathLength
    );
    const contentHash = readOptionalString(
      record.contentHash,
      `Remote sync resource ${index} content hash`,
      remoteSyncPayloadLimits.remoteIdLength
    );

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

  if (value.length > remoteSyncPayloadLimits.resourceCount) {
    throw new Error(`Remote sync remote resources must contain at most ${remoteSyncPayloadLimits.resourceCount} items`);
  }

  return value.map((resource, index) => {
    const record = expectRecord(resource, `Remote sync remote resource ${index}`);
    const remoteId = readOptionalString(
      record.remoteId,
      `Remote sync remote resource ${index} remote id`,
      remoteSyncPayloadLimits.remoteIdLength
    );
    const contentHash = readOptionalString(
      record.contentHash,
      `Remote sync remote resource ${index} content hash`,
      remoteSyncPayloadLimits.remoteIdLength
    );

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

function normalizeRemoteSyncManifestResources(value: unknown): readonly RemoteSyncManifestResource[] {
  if (!Array.isArray(value)) {
    throw new Error("Remote sync manifest resources must be an array");
  }

  if (value.length > remoteSyncPayloadLimits.resourceCount) {
    throw new Error(`Remote sync manifest resources must contain at most ${remoteSyncPayloadLimits.resourceCount} items`);
  }

  return value.map((resource, index) => {
    const record = expectRecord(resource, `Remote sync manifest resource ${index}`);
    const remoteId = readOptionalString(
      record.remoteId,
      `Remote sync manifest resource ${index} remote id`,
      remoteSyncPayloadLimits.remoteIdLength
    );
    const contentHash = readOptionalString(
      record.contentHash,
      `Remote sync manifest resource ${index} content hash`,
      remoteSyncPayloadLimits.remoteIdLength
    );

    return {
      relativePath: normalizeRelativePath(record.relativePath, `Remote sync manifest resource ${index} relative path`),
      kind: normalizeFileKind(record.kind, `Remote sync manifest resource ${index} kind`),
      ...(remoteId ? { remoteId } : {}),
      ...readOptionalNonNegativeNumber("size", record.size, `Remote sync manifest resource ${index} size`),
      ...readOptionalNonNegativeNumber("mtime", record.mtime, `Remote sync manifest resource ${index} mtime`),
      ...(contentHash ? { contentHash } : {})
    };
  });
}

function normalizeRemoteSyncPlan(plan: RemoteSyncPlan): RemoteSyncPlan {
  const record = expectRecord(plan, "Remote sync plan");
  const operations = normalizeRemoteSyncOperations(record.operations);
  const summary = normalizeRemoteSyncSummary(record.summary);

  assertRemoteSyncSummaryMatchesOperations(summary, operations, "Remote sync plan summary");

  return {
    operations,
    summary
  };
}

function normalizeRemoteSyncResult(result: RemoteSyncResult): RemoteSyncResult {
  const record = expectRecord(result, "Remote sync result");
  const completedAt = readOptionalBoundedNumber(
    record.completedAt,
    "Remote sync completed timestamp",
    remoteSyncPayloadLimits.completedAtMax
  );
  const operations = normalizeRemoteSyncOperations(record.operations);
  const summary = normalizeRemoteSyncSummary(record.summary);

  assertRemoteSyncSummaryMatchesOperations(summary, operations, "Remote sync result summary");

  return {
    operations,
    summary,
    ...(completedAt !== undefined ? { completedAt } : {})
  };
}

function assertRemoteSyncSummaryMatchesOperations(
  summary: RemoteSyncSummary,
  operations: readonly RemoteSyncOperation[],
  label: string
): void {
  const expected = summarizeRemoteSyncOperations(operations);

  for (const key of Object.keys(expected) as (keyof RemoteSyncSummary)[]) {
    if (summary[key] !== expected[key]) {
      throw new Error(`${label} ${key} must match operation count`);
    }
  }
}

function normalizeRemoteSyncOperations(value: unknown): readonly RemoteSyncOperation[] {
  if (!Array.isArray(value)) {
    throw new Error("Remote sync operations must be an array");
  }

  if (value.length > remoteSyncPayloadLimits.operationCount) {
    throw new Error(`Remote sync operations must contain at most ${remoteSyncPayloadLimits.operationCount} items`);
  }

  return value.map((operation, index) => normalizeRemoteSyncOperation(operation, index));
}

function normalizeRemoteSyncOperation(value: unknown, index: number): RemoteSyncOperation {
  const record = expectRecord(value, `Remote sync operation ${index}`);
  const localPresence = normalizeOptionalRemoteSyncResourcePresence(
    record.localPresence,
    `Remote sync operation ${index} local presence`
  );
  const remotePresence = normalizeOptionalRemoteSyncResourcePresence(
    record.remotePresence,
    `Remote sync operation ${index} remote presence`
  );
  const remoteId = readOptionalString(
    record.remoteId,
    `Remote sync operation ${index} remote id`,
    remoteSyncPayloadLimits.remoteIdLength
  );
  const message = readOptionalString(
    record.message,
    `Remote sync operation ${index} message`,
    remoteSyncPayloadLimits.messageLength
  );

  return {
    kind: normalizeRemoteSyncOperationKind(record.kind),
    target: normalizeRemoteSyncOperationTarget(record.target),
    relativePath: normalizeRelativePath(record.relativePath, `Remote sync operation ${index} relative path`),
    ...(localPresence ? { localPresence } : {}),
    ...(record.localUri !== undefined
      ? { localUri: readRequiredUri(record.localUri, `Remote sync operation ${index} local URI`) }
      : {}),
    ...(remotePresence ? { remotePresence } : {}),
    ...(remoteId ? { remoteId } : {}),
    ...(message ? { message } : {})
  };
}

function normalizeRemoteSyncProgress(value: unknown): RemoteSyncProgress {
  const record = expectRecord(value, "Remote sync progress");
  const message = readRequiredString(
    record.message,
    "Remote sync progress message",
    remoteSyncPayloadLimits.messageLength
  );
  const completed = readOptionalRemoteSyncProgressCount(record.completed, "Remote sync progress completed");
  const total = readOptionalRemoteSyncProgressCount(record.total, "Remote sync progress total");

  if (completed !== undefined && total !== undefined && completed > total) {
    throw new Error("Remote sync progress completed must not exceed total");
  }

  return {
    message,
    ...(completed !== undefined ? { completed } : {}),
    ...(total !== undefined ? { total } : {}),
    ...(record.operation !== undefined ? { operation: normalizeRemoteSyncOperation(record.operation, 0) } : {})
  };
}

function readOptionalRemoteSyncProgressCallback(value: unknown): ((progress: RemoteSyncProgress) => void) | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "function") {
    throw new Error("Remote sync progress callback must be a function");
  }

  return (progress) => value(normalizeRemoteSyncProgress(progress));
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

  const record = expectRecord(value, "Remote sync request metadata");
  const entries = Object.entries(record);
  const metadata: Record<string, string> = {};

  if (entries.length > remoteSyncRequestMetadataLimits.entries) {
    throw new Error(
      `Remote sync request metadata must contain at most ${remoteSyncRequestMetadataLimits.entries} entries`
    );
  }

  for (const [key, metadataValue] of entries) {
    const normalizedKey = key.trim();

    if (!normalizedKey) {
      throw new Error("Remote sync request metadata keys must not be empty");
    }

    if (normalizedKey.length > remoteSyncRequestMetadataLimits.keyLength) {
      throw new Error(
        `Remote sync request metadata key must be at most ${remoteSyncRequestMetadataLimits.keyLength} characters`
      );
    }

    if (Object.hasOwn(metadata, normalizedKey)) {
      throw new Error(`Remote sync request metadata must not contain duplicate key: ${normalizedKey}`);
    }

    const normalizedValue = readString(metadataValue, `Remote sync request metadata ${normalizedKey}`);

    if (normalizedValue.length > remoteSyncRequestMetadataLimits.valueLength) {
      throw new Error(
        `Remote sync request metadata value for ${normalizedKey} must be at most ${remoteSyncRequestMetadataLimits.valueLength} characters`
      );
    }

    metadata[normalizedKey] = normalizedValue;
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

function normalizeOptionalRemoteSyncResourcePresence(
  value: unknown,
  label: string
): RemoteSyncResourcePresence | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "present" && value !== "missing" && value !== "unknown") {
    throw new Error(`${label} must be present, missing, or unknown`);
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
  const normalized = readRequiredString(value, label, remoteSyncPayloadLimits.relativePathLength).replaceAll("\\", "/");

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

  const uriText = (value as { toString(): string }).toString();

  if (uriText.length > remoteSyncPayloadLimits.uriLength) {
    throw new Error(`${label} must be at most ${remoteSyncPayloadLimits.uriLength} characters`);
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

function readOptionalBoundedNumber(value: unknown, label: string, maxValue: number): number | undefined {
  const normalizedValue = readOptionalFiniteNumber(value, label);

  if (normalizedValue === undefined) {
    return undefined;
  }

  if (normalizedValue < 0 || normalizedValue > maxValue) {
    throw new Error(`${label} must be between 0 and ${maxValue}`);
  }

  return normalizedValue;
}

function readSummaryCount(value: unknown, key: keyof RemoteSyncSummary): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`Remote sync summary ${key} must be a non-negative integer`);
  }

  if (value > remoteSyncPayloadLimits.operationCount) {
    throw new Error(`Remote sync summary ${key} must be at most ${remoteSyncPayloadLimits.operationCount}`);
  }

  return value;
}

function readOptionalRemoteSyncProgressCount(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }

  if (value > remoteSyncPayloadLimits.operationCount) {
    throw new Error(`${label} must be at most ${remoteSyncPayloadLimits.operationCount}`);
  }

  return value;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string, maxLength?: number): string {
  const normalized = readString(value, label, maxLength).trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}

function normalizeRemoteSyncProviderId(value: unknown, label: string): string {
  const id = readTrimmedRequiredString(value, label, configurationMaxRemoteSyncProviderIdLength);

  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id)) {
    throw new Error(`${label} is invalid: ${id}`);
  }

  return id;
}

function normalizeOptionalRemoteSyncProviderId(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeRemoteSyncProviderId(value, label);
}

function readTrimmedRequiredString(value: unknown, label: string, maxLength: number): string {
  const normalized = readRequiredString(value, label);

  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }

  return normalized;
}

function readString(value: unknown, label: string, maxLength?: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }

  return value;
}

function readOptionalString(value: unknown, label: string, maxLength?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, label, maxLength).trim() || undefined;
}

function readOptionalStringAllowEmpty(value: unknown, label: string, maxLength?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, label, maxLength).trim();
}

function readOptionalUriString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value === "string") {
    return normalizeOptionalLengthBoundedString(value, label, remoteSyncPayloadLimits.uriLength);
  }

  if (typeof value !== "object" || value === null || typeof (value as { toString?: unknown }).toString !== "function") {
    throw new Error(`${label} must be a URI or string`);
  }

  return normalizeOptionalLengthBoundedString(
    (value as { toString(): string }).toString(),
    label,
    remoteSyncPayloadLimits.uriLength
  );
}

function normalizeOptionalLengthBoundedString(value: string, label: string, maxLength: number): string | undefined {
  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }

  return normalized;
}

function hashRemoteSyncManifestScope(scope: string): string {
  let hash = 2166136261;

  for (let index = 0; index < scope.length; index += 1) {
    hash ^= scope.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}
