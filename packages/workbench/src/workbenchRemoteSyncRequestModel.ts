import type {
  RemoteSyncDirection,
  RemoteSyncPlanRequest,
  WorkspaceState
} from "@typora-plus/platform";
import { createRemoteSyncResourcesFromWorkspace } from "@typora-plus/platform";

export const workbenchRemoteSyncRequestActions = {
  executeWorkspace: "executeWorkspace",
  planWorkspace: "planWorkspace"
} as const;

export type WorkbenchRemoteSyncRequestAction =
  typeof workbenchRemoteSyncRequestActions[keyof typeof workbenchRemoteSyncRequestActions];

export interface WorkbenchWorkspaceRemoteSyncRequestOptions {
  readonly direction?: RemoteSyncDirection;
  readonly dryRun?: boolean;
  readonly includeDirectories?: boolean;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly remoteScopeId?: string;
  readonly signal?: AbortSignal;
}

export function createWorkbenchWorkspaceRemoteSyncPlanRequest(
  workspace: WorkspaceState,
  options: WorkbenchWorkspaceRemoteSyncRequestOptions = {}
): RemoteSyncPlanRequest {
  if (!workspace.files) {
    throw new Error("No workspace is open for remote sync planning");
  }

  const workspaceUri = workspace.rootUri ?? workspace.files.root.uri;

  return {
    workspaceUri,
    resources: createRemoteSyncResourcesFromWorkspace(workspace.files, {
      ...(options.includeDirectories !== undefined ? { includeDirectories: options.includeDirectories } : {})
    }),
    direction: options.direction ?? "push",
    dryRun: options.dryRun ?? true,
    ...(options.remoteScopeId ? { remoteScopeId: options.remoteScopeId } : {}),
    metadata: {
      ...options.metadata,
      action: workbenchRemoteSyncRequestActions.planWorkspace,
      source: "workspace",
      workspaceName: workspace.name,
      workspaceScheme: workspaceUri.scheme
    },
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  };
}
