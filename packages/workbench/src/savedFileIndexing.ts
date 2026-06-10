import type {
  FileTreeEntry,
  IFileService,
  IIndexService,
  IWorkspaceService,
  TextFileModel,
  WorkspaceFileTree,
  WorkspaceState
} from "@typora-plus/platform";
import { workspaceStateFromFiles } from "./workbenchWorkspaceOpening";

export interface SavedFileIndexingServices {
  readonly fileService: Pick<IFileService, "refreshWorkspace">;
  readonly indexService: Pick<IIndexService, "indexFile">;
}

export interface SavedFileWorkspaceIndexingServices extends SavedFileIndexingServices {
  readonly workspaceService: Pick<IWorkspaceService, "setWorkspace">;
}

export async function updateSavedFileIndex(
  services: SavedFileIndexingServices,
  workspaceFiles: WorkspaceState["files"],
  model: TextFileModel
): Promise<WorkspaceFileTree | undefined> {
  if (model.uri.scheme !== "file" || !workspaceFiles) {
    return undefined;
  }

  const existingFile = findWorkspaceFile(workspaceFiles, model);

  if (existingFile) {
    await services.indexService.indexFile(existingFile, model.value);
    return undefined;
  }

  const refreshedWorkspace = await services.fileService.refreshWorkspace();

  if (!refreshedWorkspace) {
    return undefined;
  }

  const refreshedFile = findWorkspaceFile(refreshedWorkspace, model);

  if (refreshedFile) {
    await services.indexService.indexFile(refreshedFile, model.value);
  }

  return refreshedWorkspace;
}

export async function updateSavedFileIndexAndWorkspace(
  services: SavedFileWorkspaceIndexingServices,
  workspaceFiles: WorkspaceState["files"],
  model: TextFileModel
): Promise<void> {
  const refreshedWorkspace = await updateSavedFileIndex(services, workspaceFiles, model);

  if (!refreshedWorkspace) {
    return;
  }

  services.workspaceService.setWorkspace(workspaceStateFromFiles(refreshedWorkspace));
}

function findWorkspaceFile(workspaceFiles: WorkspaceFileTree, model: TextFileModel): FileTreeEntry | undefined {
  return workspaceFiles.files.find((entry) => entry.uri.toString() === model.uri.toString());
}
