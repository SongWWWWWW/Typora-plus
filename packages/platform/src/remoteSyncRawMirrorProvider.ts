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
  readonly localResources?: readonly RemoteSyncResource[];
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
        await refreshRawMirrorManifestFromNoOpPlan(options, request, plan);

        return {
          operations: plan.operations,
          summary: summarizeRawMirrorOperations(plan.operations)
        };
      }

      const remoteResources = await options.adapter.listResources(createRawMirrorListRequest(request));
      validateRawMirrorPlannedOperations(operations, request.resources, remoteResources);
      const execution = await options.adapter.executeOperations({
        ...createRawMirrorBaseRequest(request),
        plan,
        operations,
        localResources: request.resources,
        remoteResources,
        direction: request.direction
      });
      const executionOperations = validateRawMirrorExecutionOperations(
        operations,
        execution.operations ?? operations
      );

      writeRawMirrorManifestResources(options, request, createRemoteSyncManifestResourcesFromExecution({
        manifestResources: readRawMirrorManifestResources(options, request),
        localResources: execution.localResources ?? request.resources,
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

async function refreshRawMirrorManifestFromNoOpPlan(
  options: RemoteSyncRawMirrorProviderOptions,
  request: RemoteSyncPlanRequest,
  plan: RemoteSyncPlan
): Promise<void> {
  if (!canRefreshRawMirrorManifestFromNoOpPlan(plan, request)) {
    return;
  }

  const manifestResources = readRawMirrorManifestResources(options, request);
  const refreshedResources = createRemoteSyncManifestResourcesFromExecution({
    manifestResources,
    localResources: request.resources,
    remoteResources: await options.adapter.listResources(createRawMirrorListRequest(request)),
    operations: plan.operations
  });

  if (!areRawMirrorManifestResourcesEqual(manifestResources, refreshedResources)) {
    writeRawMirrorManifestResources(options, request, refreshedResources);
  }
}

function canRefreshRawMirrorManifestFromNoOpPlan(
  plan: RemoteSyncPlan,
  request: RemoteSyncPlanRequest
): boolean {
  const localPaths = new Set(request.resources.map((resource) => resource.relativePath));

  return plan.operations.some((operation) =>
    operation.kind === "skip" &&
    operation.target === "none" &&
    localPaths.has(operation.relativePath)
  );
}

function areRawMirrorManifestResourcesEqual(
  left: readonly RemoteSyncManifestResource[],
  right: readonly RemoteSyncManifestResource[]
): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
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

function validateRawMirrorExecutionOperations(
  planned: readonly RemoteSyncOperation[],
  returned: readonly RemoteSyncOperation[]
): readonly RemoteSyncOperation[] {
  const plannedKeys = new Set(planned.map(createRawMirrorExecutableOperationKey));
  const returnedKeys = new Set<string>();

  if (returned.length !== planned.length) {
    throw new Error("Remote sync raw mirror execution must return every planned operation exactly once");
  }

  for (const operation of returned) {
    if (!isRawMirrorExecutableOperation(operation)) {
      throw new Error("Remote sync raw mirror execution returned a non-executable operation");
    }

    const key = createRawMirrorExecutableOperationKey(operation);

    if (!plannedKeys.has(key)) {
      throw new Error(`Remote sync raw mirror execution returned an unplanned operation: ${operation.relativePath}`);
    }

    if (returnedKeys.has(key)) {
      throw new Error(`Remote sync raw mirror execution returned a duplicate operation: ${operation.relativePath}`);
    }

    returnedKeys.add(key);
  }

  return returned;
}

function validateRawMirrorPlannedOperations(
  operations: readonly RemoteSyncOperation[],
  localResources: readonly RemoteSyncResource[],
  remoteResources: readonly RemoteSyncRemoteResource[]
): void {
  const localByPath = new Map(localResources.map((resource) => [resource.relativePath, resource]));
  const remoteByPath = new Map(remoteResources.map((resource) => [resource.relativePath, resource]));

  for (const operation of operations) {
    const local = localByPath.get(operation.relativePath);
    const remote = remoteByPath.get(operation.relativePath);

    validateRawMirrorOperationTarget(operation);

    switch (operation.kind) {
      case "create":
        validateRawMirrorCreateOperation(operation, local, remote);
        break;
      case "update":
        validateRawMirrorUpdateOperation(operation, local, remote);
        break;
      case "delete":
        validateRawMirrorDeleteOperation(operation, local, remote);
        break;
      case "skip":
      case "conflict":
        throw new Error("Remote sync raw mirror execution included a non-executable planned operation");
    }
  }
}

function validateRawMirrorOperationTarget(operation: RemoteSyncOperation): void {
  if (operation.target !== "local" && operation.target !== "remote") {
    throw new Error(`Remote sync raw mirror operation ${operation.relativePath} must target local or remote`);
  }
}

function validateRawMirrorCreateOperation(
  operation: RemoteSyncOperation,
  local: RemoteSyncResource | undefined,
  remote: RemoteSyncRemoteResource | undefined
): void {
  if (operation.target === "remote") {
    if (!local) {
      throw new Error(`Remote sync raw mirror create ${operation.relativePath} requires a local resource`);
    }

    if (remote) {
      throw new Error(`Remote sync raw mirror create ${operation.relativePath} found an existing remote resource`);
    }

    return;
  }

  if (!remote) {
    throw new Error(`Remote sync raw mirror create ${operation.relativePath} requires a remote resource`);
  }

  if (local) {
    throw new Error(`Remote sync raw mirror create ${operation.relativePath} found an existing local resource`);
  }
}

function validateRawMirrorUpdateOperation(
  operation: RemoteSyncOperation,
  local: RemoteSyncResource | undefined,
  remote: RemoteSyncRemoteResource | undefined
): void {
  if (!local || !remote) {
    throw new Error(`Remote sync raw mirror update ${operation.relativePath} requires local and remote resources`);
  }
}

function validateRawMirrorDeleteOperation(
  operation: RemoteSyncOperation,
  local: RemoteSyncResource | undefined,
  remote: RemoteSyncRemoteResource | undefined
): void {
  if (operation.target === "local" && !local) {
    throw new Error(`Remote sync raw mirror delete ${operation.relativePath} requires a local resource`);
  }

  if (operation.target === "remote" && !remote) {
    throw new Error(`Remote sync raw mirror delete ${operation.relativePath} requires a remote resource`);
  }
}

function isRawMirrorExecutableOperation(operation: RemoteSyncOperation): boolean {
  return operation.kind === "create" ||
    operation.kind === "update" ||
    operation.kind === "delete";
}

function createRawMirrorExecutableOperationKey(operation: RemoteSyncOperation): string {
  return `${operation.kind}\n${operation.target}\n${operation.relativePath}`;
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
