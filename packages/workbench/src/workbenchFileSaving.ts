import type {
  IRecentService,
  ITextFileService,
  TextFileModel,
  TextFileSaveOptions,
  WorkspaceState
} from "@typora-plus/platform";
import {
  updateSavedFileIndexAndWorkspace,
  type SavedFileWorkspaceIndexingServices
} from "./savedFileIndexing";

export interface WorkbenchFileSavingServices extends SavedFileWorkspaceIndexingServices {
  readonly recentService: Pick<IRecentService, "addRecentFile">;
  readonly textFileService: Pick<ITextFileService, "save" | "saveAs">;
}

export interface WorkbenchFileSaveOptions extends TextFileSaveOptions {
  readonly recordRecent?: boolean;
}

export interface WorkbenchFileSaveAsOptions {
  readonly recordRecent?: boolean;
}

export async function saveWorkbenchFile(
  services: WorkbenchFileSavingServices,
  workspaceFiles: WorkspaceState["files"],
  options: WorkbenchFileSaveOptions = {}
): Promise<TextFileModel> {
  const saved = await services.textFileService.save(createTextFileSaveOptions(options));
  recordSavedWorkbenchFile(services, saved, options.recordRecent ?? true);
  await updateSavedFileIndexAndWorkspace(services, workspaceFiles, saved);
  return saved;
}

export async function saveWorkbenchFileAs(
  services: WorkbenchFileSavingServices,
  workspaceFiles: WorkspaceState["files"],
  options: WorkbenchFileSaveAsOptions = {}
): Promise<TextFileModel | undefined> {
  const saved = await services.textFileService.saveAs();

  if (!saved) {
    return undefined;
  }

  recordSavedWorkbenchFile(services, saved, options.recordRecent ?? true);
  await updateSavedFileIndexAndWorkspace(services, workspaceFiles, saved);
  return saved;
}

export function recordSavedWorkbenchFile(
  services: Pick<WorkbenchFileSavingServices, "recentService">,
  model: TextFileModel,
  recordRecent: boolean
): void {
  if (recordRecent && model.uri.scheme === "file") {
    services.recentService.addRecentFile(model.uri, model.name);
  }
}

function createTextFileSaveOptions(options: WorkbenchFileSaveOptions): TextFileSaveOptions | undefined {
  return options.overwrite === undefined ? undefined : { overwrite: options.overwrite };
}
