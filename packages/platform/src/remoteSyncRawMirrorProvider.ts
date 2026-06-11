import type { URI as URIType } from "@typora-plus/base";
import type {
  RemoteSyncManifestResource,
  RemoteSyncOperation,
  RemoteSyncPlan,
  RemoteSyncPlanRequest,
  RemoteSyncProgress,
  RemoteSyncProvider,
  RemoteSyncRemoteResource,
  RemoteSyncResource,
  RemoteSyncResult,
  RemoteSyncSummary
} from "./remoteSync";
import {
  createRemoteSyncManifestResourcesFromExecution,
  createRemoteSyncPlanFromManifest,
  RemoteSyncManifestStore
} from "./remoteSync";

export interface RemoteSyncRawMirrorRequest {
  readonly workspaceUri: URIType;
  readonly remoteScopeId?: string;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly onProgress?: (progress: RemoteSyncProgress) => void;
  readonly signal?: AbortSignal;
}

export interface RemoteSyncRawMirrorListRequest extends RemoteSyncRawMirrorRequest {
  readonly direction: RemoteSyncPlanRequest["direction"];
}

export interface RemoteSyncRawMirrorExecuteRequest extends RemoteSyncRawMirrorRequest {
  readonly plan: RemoteSyncPlan;
  readonly operations: readonly RemoteSyncOperation[];
  readonly localResources: readonly RemoteSyncResource[];
  readonly remoteResources: readonly RemoteSyncRemoteResource[];
  readonly direction: RemoteSyncPlanRequest["direction"];
}

export interface RemoteSyncRawMirrorExecutionResult {
  readonly remoteResources: readonly RemoteSyncRemoteResource[];
  readonly operations?: readonly RemoteSyncOperation[];
  readonly completedAt?: number;
}

export interface RemoteSyncRawMirrorProviderAdapter {
  listResources(request: RemoteSyncRawMirrorListRequest):
    readonly RemoteSyncRemoteResource[] | Promise<readonly RemoteSyncRemoteResource[]>;
  executeOperations(request: RemoteSyncRawMirrorExecuteRequest):
    RemoteSyncRawMirrorExecutionResult | Promise<RemoteSyncRawMirrorExecutionResult>;
}

export interface RemoteSyncRawMirrorProviderOptions {
  readonly id: string;
  readonly title: string;
  readonly adapter: RemoteSyncRawMirrorProviderAdapter;
  readonly manifestStore: RemoteSyncManifestStore;
  readonly deleteMissing?: boolean;
}

export function createRemoteSyncRawMirrorProvider(options: RemoteSyncRawMirrorProviderOptions): RemoteSyncProvider {
  return {
    id: options.id,
    title: options.title,
    createPlan: async (request) => {
      throwIfRawMirrorAborted(request.signal);

      const remoteResources = await options.adapter.listResources(createRawMirrorListRequest(request));
      const manifestResources = readRawMirrorManifestResources(options, request);

      return createRemoteSyncPlanFromManifest({
        localResources: request.resources,
        remoteResources,
        manifestResources,
        direction: request.direction,
        deleteMissing: options.deleteMissing === true
      });
    },
    executePlan: async (plan, request) => {
      throwIfRawMirrorAborted(request.signal);
      throwIfRawMirrorDryRunExecution(request);
      throwIfRawMirrorConflicts(plan);

      const operations = getExecutableRawMirrorOperations(plan);

      if (operations.length === 0) {
        return {
          operations: plan.operations,
          summary: summarizeRawMirrorOperations(plan.operations)
        };
      }

      const remoteResources = await options.adapter.listResources(createRawMirrorListRequest(request));
      const execution = await options.adapter.executeOperations({
        ...createRawMirrorBaseRequest(request),
        plan,
        operations,
        localResources: request.resources,
        remoteResources,
        direction: request.direction
      });
      const executionOperations = execution.operations ?? operations;

      writeRawMirrorManifestResources(options, request, createRemoteSyncManifestResourcesFromExecution({
        manifestResources: readRawMirrorManifestResources(options, request),
        localResources: request.resources,
        remoteResources: execution.remoteResources,
        operations: executionOperations
      }));

      return {
        operations: executionOperations,
        summary: summarizeRawMirrorOperations(executionOperations),
        ...(execution.completedAt !== undefined ? { completedAt: execution.completedAt } : {})
      };
    }
  };
}

function createRawMirrorListRequest(request: RemoteSyncPlanRequest): RemoteSyncRawMirrorListRequest {
  return {
    ...createRawMirrorBaseRequest(request),
    direction: request.direction
  };
}

function createRawMirrorBaseRequest(request: RemoteSyncPlanRequest): RemoteSyncRawMirrorRequest {
  return {
    workspaceUri: request.workspaceUri,
    ...(request.remoteScopeId !== undefined ? { remoteScopeId: request.remoteScopeId } : {}),
    ...(request.metadata !== undefined ? { metadata: request.metadata } : {}),
    ...(request.onProgress !== undefined ? { onProgress: request.onProgress } : {}),
    ...(request.signal !== undefined ? { signal: request.signal } : {})
  };
}

function readRawMirrorManifestResources(
  options: RemoteSyncRawMirrorProviderOptions,
  request: RemoteSyncPlanRequest
): readonly RemoteSyncManifestResource[] {
  options.manifestStore.setScope({
    workspaceUri: request.workspaceUri,
    providerId: options.id,
    ...(request.remoteScopeId !== undefined ? { remoteScopeId: request.remoteScopeId } : {})
  });

  return options.manifestStore.readResources();
}

function writeRawMirrorManifestResources(
  options: RemoteSyncRawMirrorProviderOptions,
  request: RemoteSyncPlanRequest,
  resources: readonly RemoteSyncManifestResource[]
): void {
  options.manifestStore.setScope({
    workspaceUri: request.workspaceUri,
    providerId: options.id,
    ...(request.remoteScopeId !== undefined ? { remoteScopeId: request.remoteScopeId } : {})
  });
  options.manifestStore.writeResources(resources);
}

function getExecutableRawMirrorOperations(plan: RemoteSyncPlan): readonly RemoteSyncOperation[] {
  return plan.operations.filter((operation) =>
    operation.kind === "create" ||
    operation.kind === "update" ||
    operation.kind === "delete"
  );
}

function summarizeRawMirrorOperations(operations: readonly RemoteSyncOperation[]): RemoteSyncSummary {
  return {
    creates: operations.filter((operation) => operation.kind === "create").length,
    updates: operations.filter((operation) => operation.kind === "update").length,
    deletes: operations.filter((operation) => operation.kind === "delete").length,
    skips: operations.filter((operation) => operation.kind === "skip").length,
    conflicts: operations.filter((operation) => operation.kind === "conflict").length
  };
}

function throwIfRawMirrorAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Remote sync raw mirror request was aborted");
  }
}

function throwIfRawMirrorDryRunExecution(request: RemoteSyncPlanRequest): void {
  if (request.dryRun === true) {
    throw new Error("Remote sync raw mirror execution requires a non-dry-run request");
  }
}

function throwIfRawMirrorConflicts(plan: RemoteSyncPlan): void {
  if (plan.operations.some((operation) => operation.kind === "conflict")) {
    throw new Error("Remote sync raw mirror conflicts must be resolved before execution");
  }
}
