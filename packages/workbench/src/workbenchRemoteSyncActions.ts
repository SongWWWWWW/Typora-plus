import type {
  IRemoteSyncService,
  IWorkspaceService,
  RemoteSyncPlan,
  RemoteSyncPlanRequest
} from "@typora-plus/platform";
import { createWorkbenchWorkspaceRemoteSyncPlanRequest, type WorkbenchWorkspaceRemoteSyncRequestOptions } from "./workbenchRemoteSyncRequestModel";
import { selectWorkbenchDefaultRemoteSyncProviderId } from "./workbenchProviderSelection";

export interface WorkbenchRemoteSyncActionServices {
  readonly remoteSyncService: Pick<IRemoteSyncService, "createPlan" | "getProviders">;
  readonly workspaceService: Pick<IWorkspaceService, "getWorkspace">;
}

export interface WorkbenchRemoteSyncPlanResult {
  readonly providerId: string;
  readonly request: RemoteSyncPlanRequest;
  readonly plan: RemoteSyncPlan;
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
