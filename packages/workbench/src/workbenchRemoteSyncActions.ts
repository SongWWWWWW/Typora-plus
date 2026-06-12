import type {
  IRemoteSyncService,
  IRemoteSyncWorkspaceResourceService,
  IWorkspaceService,
  RemoteSyncOperation,
  RemoteSyncPlan,
  RemoteSyncPlanRequest,
  RemoteSyncProgress,
  RemoteSyncResult
} from "@typora-plus/platform";
import { createRemoteSyncResourcesWithContentHashes } from "@typora-plus/platform";
import { createWorkbenchRemoteSyncResourcesWithMarkdownAssets } from "./workbenchRemoteSyncMarkdownAssets";
import {
  createWorkbenchWorkspaceRemoteSyncPlanRequest,
  workbenchRemoteSyncRequestActions,
  type WorkbenchWorkspaceRemoteSyncRequestOptions
} from "./workbenchRemoteSyncRequestModel";
import { selectWorkbenchDefaultRemoteSyncProviderId } from "./workbenchProviderSelection";

export interface WorkbenchRemoteSyncActionServices {
  readonly remoteSyncService: Pick<IRemoteSyncService, "createPlan" | "executePlan" | "getProviders">;
  readonly remoteSyncWorkspaceResourceService?: Pick<
    IRemoteSyncWorkspaceResourceService,
    "isAvailable" | "readResource"
  >;
  readonly workspaceService: Pick<IWorkspaceService, "getWorkspace">;
}

export interface WorkbenchRemoteSyncExecutionServices {
  readonly remoteSyncService: Pick<IRemoteSyncService, "executePlan">;
}

export interface WorkbenchRemoteSyncPlanResult {
  readonly providerId: string;
  readonly request: RemoteSyncPlanRequest;
  readonly plan: RemoteSyncPlan;
}

export interface WorkbenchRemoteSyncExecutionOptions {
  readonly metadata?: Readonly<Record<string, string>>;
  readonly onProgress?: (progress: RemoteSyncProgress) => void;
  readonly signal?: AbortSignal;
}

export interface WorkbenchRemoteSyncExecutionResult {
  readonly providerId: string;
  readonly request: RemoteSyncPlanRequest;
  readonly plan: RemoteSyncPlan;
  readonly result: RemoteSyncResult;
}

export const workbenchRemoteSyncConflictResolutions = {
  useLocal: "useLocal",
  useRemote: "useRemote"
} as const;

export type WorkbenchRemoteSyncConflictResolution =
  typeof workbenchRemoteSyncConflictResolutions[keyof typeof workbenchRemoteSyncConflictResolutions];

export async function runWorkbenchPlanWorkspaceRemoteSyncAction(
  services: WorkbenchRemoteSyncActionServices,
  options: WorkbenchWorkspaceRemoteSyncRequestOptions = {}
): Promise<WorkbenchRemoteSyncPlanResult> {
  const providerId = selectWorkbenchDefaultRemoteSyncProviderId(services);

  if (!providerId) {
    throw new Error("No remote sync provider available for workspace sync planning");
  }

  const request = await createWorkbenchRemoteSyncPlanRequestWithContentHashes(
    services,
    createWorkbenchWorkspaceRemoteSyncPlanRequest(
      services.workspaceService.getWorkspace(),
      options
    )
  );

  return {
    providerId,
    request,
    plan: await services.remoteSyncService.createPlan(providerId, request)
  };
}

async function createWorkbenchRemoteSyncPlanRequestWithContentHashes(
  services: WorkbenchRemoteSyncActionServices,
  request: RemoteSyncPlanRequest
): Promise<RemoteSyncPlanRequest> {
  if (!services.remoteSyncWorkspaceResourceService?.isAvailable()) {
    return request;
  }

  const requestWithAssets = {
    ...request,
    resources: await createWorkbenchRemoteSyncResourcesWithMarkdownAssets({
      workspaceUri: request.workspaceUri,
      resources: request.resources,
      resourceService: services.remoteSyncWorkspaceResourceService,
      ...(request.signal !== undefined ? { signal: request.signal } : {})
    })
  };

  return {
    ...requestWithAssets,
    resources: await createRemoteSyncResourcesWithContentHashes({
      workspaceUri: requestWithAssets.workspaceUri,
      resources: requestWithAssets.resources,
      resourceService: services.remoteSyncWorkspaceResourceService,
      ...(requestWithAssets.signal !== undefined ? { signal: requestWithAssets.signal } : {})
    })
  };
}

export async function runWorkbenchExecuteWorkspaceRemoteSyncAction(
  services: WorkbenchRemoteSyncExecutionServices,
  planResult: WorkbenchRemoteSyncPlanResult,
  options: WorkbenchRemoteSyncExecutionOptions = {}
): Promise<WorkbenchRemoteSyncExecutionResult> {
  const blockReason = getWorkbenchRemoteSyncPlanExecutionBlockReason(planResult.plan);

  if (blockReason) {
    throw new Error(blockReason);
  }

  const request = createWorkbenchRemoteSyncExecutionRequest(planResult.request, options);

  return {
    providerId: planResult.providerId,
    request,
    plan: planResult.plan,
    result: await services.remoteSyncService.executePlan(
      planResult.providerId,
      planResult.plan,
      request
    )
  };
}

export function getWorkbenchRemoteSyncPlanExecutionBlockReason(plan: RemoteSyncPlan): string | undefined {
  if (plan.operations.some((operation) => operation.kind === "conflict")) {
    return "Resolve remote sync conflicts before execution";
  }

  if (plan.operations.length === 0) {
    return "No remote sync changes to execute";
  }

  return undefined;
}

export function isWorkbenchRemoteSyncBaselineRefreshPlan(plan: RemoteSyncPlan): boolean {
  return plan.operations.length > 0 && plan.operations.every((operation) => operation.kind === "skip");
}

export function resolveWorkbenchRemoteSyncPlanConflicts(
  plan: RemoteSyncPlan,
  resolution: WorkbenchRemoteSyncConflictResolution
): RemoteSyncPlan {
  const operations = plan.operations.map((operation) =>
    operation.kind === "conflict"
      ? resolveWorkbenchRemoteSyncConflictOperation(operation, resolution)
      : operation
  );

  return {
    operations,
    summary: summarizeWorkbenchRemoteSyncOperations(operations)
  };
}

function resolveWorkbenchRemoteSyncConflictOperation(
  operation: RemoteSyncOperation,
  resolution: WorkbenchRemoteSyncConflictResolution
): RemoteSyncOperation {
  return resolution === workbenchRemoteSyncConflictResolutions.useLocal
    ? resolveWorkbenchRemoteSyncConflictWithLocal(operation)
    : resolveWorkbenchRemoteSyncConflictWithRemote(operation);
}

function resolveWorkbenchRemoteSyncConflictWithLocal(operation: RemoteSyncOperation): RemoteSyncOperation {
  const message = "Resolved by using local resource";
  const shape = classifyWorkbenchRemoteSyncConflictOperation(operation);

  if (shape === "localAndRemote" && operation.localUri) {
    return {
      kind: "update",
      target: "remote",
      relativePath: operation.relativePath,
      localUri: operation.localUri,
      ...(operation.remoteId ? { remoteId: operation.remoteId } : {}),
      message
    };
  }

  if (shape === "localOnly" && operation.localUri) {
    return {
      kind: "create",
      target: "remote",
      relativePath: operation.relativePath,
      localUri: operation.localUri,
      message
    };
  }

  if (shape === "remoteOnly") {
    return {
      kind: "delete",
      target: "remote",
      relativePath: operation.relativePath,
      ...(operation.remoteId ? { remoteId: operation.remoteId } : {}),
      message
    };
  }

  return operation;
}

function resolveWorkbenchRemoteSyncConflictWithRemote(operation: RemoteSyncOperation): RemoteSyncOperation {
  const message = "Resolved by using remote resource";
  const shape = classifyWorkbenchRemoteSyncConflictOperation(operation);

  if (shape === "localAndRemote" && operation.localUri) {
    return {
      kind: "update",
      target: "local",
      relativePath: operation.relativePath,
      localUri: operation.localUri,
      ...(operation.remoteId ? { remoteId: operation.remoteId } : {}),
      message
    };
  }

  if (shape === "remoteOnly") {
    return {
      kind: "create",
      target: "local",
      relativePath: operation.relativePath,
      ...(operation.remoteId ? { remoteId: operation.remoteId } : {}),
      message
    };
  }

  if (shape === "localOnly" && operation.localUri) {
    return {
      kind: "delete",
      target: "local",
      relativePath: operation.relativePath,
      localUri: operation.localUri,
      message
    };
  }

  return operation;
}

type WorkbenchRemoteSyncConflictOperationShape = "localAndRemote" | "localOnly" | "remoteOnly" | "unknown";

function classifyWorkbenchRemoteSyncConflictOperation(
  operation: RemoteSyncOperation
): WorkbenchRemoteSyncConflictOperationShape {
  // A remoteId can be a historical manifest id, so missing-side conflicts are resolved only when explicit.
  if (operation.message === "Remote resource is missing and local resource changed") {
    return operation.localUri ? "localOnly" : "unknown";
  }

  if (operation.message === "Local resource is missing and remote resource changed") {
    return "remoteOnly";
  }

  if (
    operation.localUri &&
    operation.message !== "Resource state cannot be compared" &&
    (operation.remoteId || isKnownWorkbenchRemoteSyncTwoSidedConflictMessage(operation.message))
  ) {
    return "localAndRemote";
  }

  if (!operation.localUri && operation.remoteId) {
    return "remoteOnly";
  }

  return "unknown";
}

function isKnownWorkbenchRemoteSyncTwoSidedConflictMessage(message: string | undefined): boolean {
  return message === "Resource kind differs" ||
    message === "Resource differs on both sides" ||
    message === "Resource has no synced baseline" ||
    message === "Synced baseline kind differs" ||
    message === "Resource changed on both sides";
}

function summarizeWorkbenchRemoteSyncOperations(operations: readonly RemoteSyncOperation[]): RemoteSyncPlan["summary"] {
  return {
    creates: operations.filter((operation) => operation.kind === "create").length,
    updates: operations.filter((operation) => operation.kind === "update").length,
    deletes: operations.filter((operation) => operation.kind === "delete").length,
    skips: operations.filter((operation) => operation.kind === "skip").length,
    conflicts: operations.filter((operation) => operation.kind === "conflict").length
  };
}

function createWorkbenchRemoteSyncExecutionRequest(
  planRequest: RemoteSyncPlanRequest,
  options: WorkbenchRemoteSyncExecutionOptions
): RemoteSyncPlanRequest {
  const {
    dryRun: _dryRun,
    metadata,
    onProgress: _onProgress,
    signal: _signal,
    ...request
  } = planRequest;

  return {
    ...request,
    dryRun: false,
    metadata: {
      ...metadata,
      ...options.metadata,
      action: workbenchRemoteSyncRequestActions.executeWorkspace
    },
    ...(options.signal !== undefined ? { signal: options.signal } : {}),
    ...(options.onProgress !== undefined ? { onProgress: options.onProgress } : {})
  };
}
