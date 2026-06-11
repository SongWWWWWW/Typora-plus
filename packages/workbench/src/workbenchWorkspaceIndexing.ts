import type {
  FileSaveConflict,
  IIndexService,
  WorkspaceState
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchWorkspaceIndexingServices {
  readonly indexService: Pick<IIndexService, "indexWorkspace">;
}

export interface WorkbenchWorkspaceIndexingCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setSaveConflict?: (conflict: FileSaveConflict | undefined) => void;
}

export function createWorkbenchWorkspaceIndexingHandler(
  services: WorkbenchWorkspaceIndexingServices,
  callbacks: WorkbenchWorkspaceIndexingCallbacks
): (workspaceFiles: WorkspaceState["files"]) => void {
  return (workspaceFiles) => {
    void indexWorkbenchWorkspaceAction(services, workspaceFiles, callbacks);
  };
}

export async function indexWorkbenchWorkspace(
  services: WorkbenchWorkspaceIndexingServices,
  workspaceFiles: WorkspaceState["files"]
): Promise<void> {
  if (!workspaceFiles) {
    return;
  }

  await services.indexService.indexWorkspace(workspaceFiles);
}

export function indexWorkbenchWorkspaceAction(
  services: WorkbenchWorkspaceIndexingServices,
  workspaceFiles: WorkspaceState["files"],
  callbacks: WorkbenchWorkspaceIndexingCallbacks
): Promise<void | undefined> {
  if (!workspaceFiles) {
    return Promise.resolve(undefined);
  }

  return runWorkbenchAction(
    () => indexWorkbenchWorkspace(services, workspaceFiles),
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
}
