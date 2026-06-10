import type { URI } from "@typora-plus/base";
import type {
  IFileService,
  IRecentService,
  ITextFileService,
  IWorkspaceService,
  WorkspaceFileTree,
  WorkspaceState
} from "@typora-plus/platform";
import { openWorkbenchFile } from "./workbenchFileOpening";

export interface WorkbenchWorkspaceOpeningServices {
  readonly fileService: Pick<IFileService, "openRecentWorkspace" | "openWorkspace" | "refreshWorkspace">;
  readonly recentService: Pick<IRecentService, "addRecentFile" | "addRecentWorkspace">;
  readonly textFileService: Pick<ITextFileService, "openFile">;
  readonly workspaceService: Pick<IWorkspaceService, "setWorkspace">;
}

export interface WorkbenchWorkspaceOpeningCallbacks {
  readonly clearSaveConflict?: () => void;
  readonly didOpenWorkspace?: (workspaceFiles: WorkspaceFileTree) => void;
}

export async function openWorkbenchWorkspace(
  services: WorkbenchWorkspaceOpeningServices,
  callbacks: WorkbenchWorkspaceOpeningCallbacks = {}
): Promise<WorkspaceFileTree | undefined> {
  const workspaceFiles = await services.fileService.openWorkspace();

  if (!workspaceFiles) {
    return undefined;
  }

  await applyOpenedWorkbenchWorkspace(services, workspaceFiles, callbacks);
  return workspaceFiles;
}

export async function openRecentWorkbenchWorkspace(
  services: WorkbenchWorkspaceOpeningServices,
  uri: URI,
  callbacks: WorkbenchWorkspaceOpeningCallbacks = {}
): Promise<WorkspaceFileTree | undefined> {
  const workspaceFiles = await services.fileService.openRecentWorkspace(uri);

  if (!workspaceFiles) {
    return undefined;
  }

  await applyOpenedWorkbenchWorkspace(services, workspaceFiles, callbacks);
  return workspaceFiles;
}

export async function refreshWorkbenchWorkspace(
  services: Pick<WorkbenchWorkspaceOpeningServices, "fileService" | "workspaceService">
): Promise<WorkspaceFileTree | undefined> {
  const workspaceFiles = await services.fileService.refreshWorkspace();

  if (!workspaceFiles) {
    return undefined;
  }

  services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));
  return workspaceFiles;
}

export function workspaceStateFromFiles(workspaceFiles: WorkspaceFileTree): WorkspaceState {
  return {
    name: workspaceFiles.root.name,
    rootUri: workspaceFiles.root.uri,
    files: workspaceFiles
  };
}

async function applyOpenedWorkbenchWorkspace(
  services: WorkbenchWorkspaceOpeningServices,
  workspaceFiles: WorkspaceFileTree,
  callbacks: WorkbenchWorkspaceOpeningCallbacks
): Promise<void> {
  services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));
  services.recentService.addRecentWorkspace(workspaceFiles.root.uri, workspaceFiles.root.name);
  callbacks.didOpenWorkspace?.(workspaceFiles);

  const firstFile = workspaceFiles.files[0];

  if (!firstFile) {
    return;
  }

  await openWorkbenchFile(
    services,
    firstFile.uri,
    callbacks.clearSaveConflict ? { clearSaveConflict: callbacks.clearSaveConflict } : {}
  );
}
