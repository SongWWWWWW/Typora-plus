import type {
  FileTreeEntry,
  IRemoteSyncService,
  IRemoteSyncWorkspaceResourceService,
  IWorkspaceService,
  RemoteSyncFolderBindingConfiguration,
  RemoteSyncOperation,
  RemoteSyncPlan,
  RemoteSyncPlanRequest,
  RemoteSyncProgress,
  RemoteSyncResult
} from "@typora-plus/platform";
import { createRemoteSyncResourcesWithContentHashes } from "@typora-plus/platform";
import {
  createWorkbenchRemoteSyncResourcesWithMarkdownAssets,
  type WorkbenchRemoteSyncMarkdownAssetMessages
} from "./workbenchRemoteSyncMarkdownAssets";
import {
  createWorkbenchWorkspaceRemoteSyncPlanRequest,
  createWorkbenchFolderRemoteSyncPlanRequest,
  defaultWorkbenchRemoteSyncRequestMessages,
  workbenchRemoteSyncRequestActions,
  type WorkbenchRemoteSyncRequestMessages,
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
  readonly actionMessages?: WorkbenchRemoteSyncActionMessages;
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

export const workbenchRemoteSyncPlanExecutionBlockReasons = {
  conflicts: "conflicts",
  empty: "empty"
} as const;

export type WorkbenchRemoteSyncPlanExecutionBlockReason =
  typeof workbenchRemoteSyncPlanExecutionBlockReasons[keyof typeof workbenchRemoteSyncPlanExecutionBlockReasons];

export interface WorkbenchRemoteSyncActionMessages {
  readonly conflictResolutionMessages: Readonly<Record<WorkbenchRemoteSyncConflictResolution, string>>;
  readonly executionBlockReasons: Readonly<Record<WorkbenchRemoteSyncPlanExecutionBlockReason, string>>;
  readonly noProviderAvailable: string;
}

export const defaultWorkbenchRemoteSyncActionMessages: WorkbenchRemoteSyncActionMessages = {
  conflictResolutionMessages: {
    [workbenchRemoteSyncConflictResolutions.useLocal]: "Resolved by using local resource",
    [workbenchRemoteSyncConflictResolutions.useRemote]: "Resolved by using remote resource"
  },
  executionBlockReasons: {
    [workbenchRemoteSyncPlanExecutionBlockReasons.conflicts]: "Resolve remote sync conflicts before execution",
    [workbenchRemoteSyncPlanExecutionBlockReasons.empty]: "No remote sync changes to execute"
  },
  noProviderAvailable: "No remote sync provider available for workspace sync planning"
};

export interface WorkbenchPlanWorkspaceRemoteSyncActionOptions
  extends WorkbenchWorkspaceRemoteSyncRequestOptions {
  readonly actionMessages?: WorkbenchRemoteSyncActionMessages;
  readonly markdownAssetMessages?: WorkbenchRemoteSyncMarkdownAssetMessages;
  readonly requestMessages?: WorkbenchRemoteSyncRequestMessages;
}

export interface WorkbenchPlanFolderRemoteSyncActionOptions
  extends Omit<WorkbenchWorkspaceRemoteSyncRequestOptions, "remoteScopeId"> {
  readonly actionMessages?: WorkbenchRemoteSyncActionMessages;
  readonly binding: RemoteSyncFolderBindingConfiguration;
  readonly localFolder: FileTreeEntry;
  readonly markdownAssetMessages?: WorkbenchRemoteSyncMarkdownAssetMessages;
  readonly requestMessages?: WorkbenchRemoteSyncRequestMessages;
}

export async function runWorkbenchPlanWorkspaceRemoteSyncAction(
  services: WorkbenchRemoteSyncActionServices,
  options: WorkbenchPlanWorkspaceRemoteSyncActionOptions = {}
): Promise<WorkbenchRemoteSyncPlanResult> {
  const providerId = selectWorkbenchDefaultRemoteSyncProviderId(services);
  const actionMessages = options.actionMessages ?? defaultWorkbenchRemoteSyncActionMessages;

  if (!providerId) {
    throw new Error(actionMessages.noProviderAvailable);
  }

  const requestMessages = options.requestMessages ?? options.messages ?? defaultWorkbenchRemoteSyncRequestMessages;
  const request = await createWorkbenchRemoteSyncPlanRequestWithContentHashes(
    services,
    createWorkbenchWorkspaceRemoteSyncPlanRequest(
      services.workspaceService.getWorkspace(),
      {
        ...options,
        messages: requestMessages
      }
    ),
    {
      ...(options.markdownAssetMessages ? { markdownAssetMessages: options.markdownAssetMessages } : {})
    }
  );

  return {
    providerId,
    request,
    plan: await services.remoteSyncService.createPlan(providerId, request)
  };
}

export async function runWorkbenchPlanFolderRemoteSyncAction(
  services: WorkbenchRemoteSyncActionServices,
  options: WorkbenchPlanFolderRemoteSyncActionOptions
): Promise<WorkbenchRemoteSyncPlanResult> {
  const actionMessages = options.actionMessages ?? defaultWorkbenchRemoteSyncActionMessages;
  const providerAvailable = services.remoteSyncService.getProviders()
    .some((provider) => provider.id === options.binding.providerId);

  if (!providerAvailable) {
    throw new Error(actionMessages.noProviderAvailable);
  }

  const requestMessages = options.requestMessages ?? options.messages ?? defaultWorkbenchRemoteSyncRequestMessages;
  const request = await createWorkbenchRemoteSyncPlanRequestWithContentHashes(
    services,
    createWorkbenchFolderRemoteSyncPlanRequest(
      services.workspaceService.getWorkspace(),
      {
        ...options,
        localFolder: options.localFolder,
        providerId: options.binding.providerId,
        remoteScopeId: options.binding.remoteScopeId,
        messages: requestMessages
      }
    ),
    {
      ...(options.markdownAssetMessages ? { markdownAssetMessages: options.markdownAssetMessages } : {})
    }
  );

  return {
    providerId: options.binding.providerId,
    request,
    plan: await services.remoteSyncService.createPlan(options.binding.providerId, request)
  };
}

async function createWorkbenchRemoteSyncPlanRequestWithContentHashes(
  services: WorkbenchRemoteSyncActionServices,
  request: RemoteSyncPlanRequest,
  options: {
    readonly markdownAssetMessages?: WorkbenchRemoteSyncMarkdownAssetMessages;
  } = {}
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
      ...(options.markdownAssetMessages ? { messages: options.markdownAssetMessages } : {}),
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
  const blockReason = getWorkbenchRemoteSyncPlanExecutionBlockReason(
    planResult.plan,
    options.actionMessages
  );

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

export function getWorkbenchRemoteSyncPlanExecutionBlockReason(
  plan: RemoteSyncPlan,
  messages: WorkbenchRemoteSyncActionMessages = defaultWorkbenchRemoteSyncActionMessages
): string | undefined {
  const reason = getWorkbenchRemoteSyncPlanExecutionBlockReasonCode(plan);

  return reason ? messages.executionBlockReasons[reason] : undefined;
}

export function getWorkbenchRemoteSyncPlanExecutionBlockReasonCode(
  plan: RemoteSyncPlan
): WorkbenchRemoteSyncPlanExecutionBlockReason | undefined {
  if (plan.operations.some((operation) => operation.kind === "conflict")) {
    return workbenchRemoteSyncPlanExecutionBlockReasons.conflicts;
  }

  if (plan.operations.length === 0) {
    return workbenchRemoteSyncPlanExecutionBlockReasons.empty;
  }

  return undefined;
}

export function isWorkbenchRemoteSyncBaselineRefreshPlan(plan: RemoteSyncPlan): boolean {
  return plan.operations.length > 0 && plan.operations.every((operation) => operation.kind === "skip");
}

export function resolveWorkbenchRemoteSyncPlanConflicts(
  plan: RemoteSyncPlan,
  resolution: WorkbenchRemoteSyncConflictResolution,
  messages: WorkbenchRemoteSyncActionMessages = defaultWorkbenchRemoteSyncActionMessages
): RemoteSyncPlan {
  const operations = plan.operations.map((operation) =>
    operation.kind === "conflict"
      ? resolveWorkbenchRemoteSyncConflictOperation(operation, resolution, messages)
      : operation
  );

  return {
    operations,
    summary: summarizeWorkbenchRemoteSyncOperations(operations)
  };
}

function resolveWorkbenchRemoteSyncConflictOperation(
  operation: RemoteSyncOperation,
  resolution: WorkbenchRemoteSyncConflictResolution,
  messages: WorkbenchRemoteSyncActionMessages
): RemoteSyncOperation {
  return resolution === workbenchRemoteSyncConflictResolutions.useLocal
    ? resolveWorkbenchRemoteSyncConflictWithLocal(operation, messages)
    : resolveWorkbenchRemoteSyncConflictWithRemote(operation, messages);
}

function resolveWorkbenchRemoteSyncConflictWithLocal(
  operation: RemoteSyncOperation,
  messages: WorkbenchRemoteSyncActionMessages
): RemoteSyncOperation {
  const message = messages.conflictResolutionMessages[workbenchRemoteSyncConflictResolutions.useLocal];
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

function resolveWorkbenchRemoteSyncConflictWithRemote(
  operation: RemoteSyncOperation,
  messages: WorkbenchRemoteSyncActionMessages
): RemoteSyncOperation {
  const message = messages.conflictResolutionMessages[workbenchRemoteSyncConflictResolutions.useRemote];
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
  const presenceShape = classifyWorkbenchRemoteSyncConflictPresence(operation);

  if (presenceShape !== "unknown") {
    return presenceShape;
  }

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

function classifyWorkbenchRemoteSyncConflictPresence(
  operation: RemoteSyncOperation
): WorkbenchRemoteSyncConflictOperationShape {
  if (!operation.localPresence && !operation.remotePresence) {
    return "unknown";
  }

  const localPresence = operation.localPresence ?? "unknown";
  const remotePresence = operation.remotePresence ?? "unknown";

  if (localPresence === "present" && remotePresence === "present") {
    return "localAndRemote";
  }

  if (localPresence === "present" && remotePresence === "missing") {
    return "localOnly";
  }

  if (localPresence === "missing" && remotePresence === "present") {
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
