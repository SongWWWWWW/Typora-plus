import type {
  FileSaveConflict,
  IRecentService,
  ITextFileService,
  TextFileModel,
  WorkspaceState
} from "@typora-plus/platform";
import type { SavedFileWorkspaceIndexingServices } from "./savedFileIndexing";
import { saveWorkbenchFile } from "./workbenchFileSaving";
import { openWorkbenchFile } from "./workbenchFileOpening";

export interface WorkbenchSaveConflictResolutionServices extends SavedFileWorkspaceIndexingServices {
  readonly recentService: Pick<IRecentService, "addRecentFile">;
  readonly textFileService: Pick<ITextFileService, "openFile" | "save" | "saveAs">;
}

export interface WorkbenchSaveConflictResolutionCallbacks {
  readonly clearSaveConflict?: () => void;
}

export async function reloadWorkbenchFileAfterSaveConflict(
  services: WorkbenchSaveConflictResolutionServices,
  conflict: FileSaveConflict,
  callbacks: WorkbenchSaveConflictResolutionCallbacks = {}
): Promise<TextFileModel> {
  const opened = await openWorkbenchFile(services, conflict.uri);
  callbacks.clearSaveConflict?.();
  return opened;
}

export async function overwriteWorkbenchSaveConflict(
  services: WorkbenchSaveConflictResolutionServices,
  workspaceFiles: WorkspaceState["files"],
  callbacks: WorkbenchSaveConflictResolutionCallbacks = {}
): Promise<TextFileModel> {
  const saved = await saveWorkbenchFile(services, workspaceFiles, { overwrite: true });
  callbacks.clearSaveConflict?.();
  return saved;
}
