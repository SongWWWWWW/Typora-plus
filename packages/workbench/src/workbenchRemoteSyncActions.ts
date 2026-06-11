import type {
  IRemoteSyncService,
  IWorkspaceService,
  RemoteSyncPlan,
  RemoteSyncPlanRequest,
  RemoteSyncResult
} from "@typora-plus/platform";
import {
  createWorkbenchWorkspaceRemoteSyncPlanRequest,
  workbenchRemoteSyncRequestActions,
  type WorkbenchWorkspaceRemoteSyncRequestOptions
} from "./workbenchRemoteSyncRequestModel";
import { selectWorkbenchDefaultRemoteSyncProviderId } from "./workbenchProviderSelection";

export interface WorkbenchRemoteSyncActionServices {
  readonly remoteSyncService: Pick<IRemoteSyncService, "createPlan" | "executePlan" | "getProviders">;
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
  readonly signal?: AbortSignal;
}

export interface WorkbenchRemoteSyncExecutionResult {
  readonly providerId: string;
  readonly request: RemoteSyncPlanRequest;
  readonly plan: RemoteSyncPlan;
  readonly result: RemoteSyncResult;
}

export async function runWorkbenchPlanWorkspaceRemoteSyncAction(
  services: WorkbenchRemoteSyncActionServices,
  options: WorkbenchWorkspaceRemoteSyncRequestOptions = {}
): Promise<WorkbenchRemoteSyncPlanResult> {
  const providerId = selectWorkbenchDefaultRemoteSyncProviderId(services);

  if (!providerId) {
    throw new Error("No remote sync provider available for workspace sync planning");
  }

  const request = createWorkbenchWorkspaceRemoteSyncPlanRequest(
    services.workspaceService.getWorkspace(),
    options
  );

  return {
    providerId,
    request,
    plan: await services.remoteSyncService.createPlan(providerId, request)
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

  if (!plan.operations.some((operation) =>
    operation.kind === "create" || operation.kind === "update" || operation.kind === "delete"
  )) {
    return "No remote sync changes to execute";
  }

  return undefined;
}

function createWorkbenchRemoteSyncExecutionRequest(
  planRequest: RemoteSyncPlanRequest,
  options: WorkbenchRemoteSyncExecutionOptions
): RemoteSyncPlanRequest {
  const {
    dryRun: _dryRun,
    metadata,
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
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  };
}
