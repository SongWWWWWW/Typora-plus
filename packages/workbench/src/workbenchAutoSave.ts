import type {
  FileSaveConflict,
  TextFileModel,
  TyporaPlusConfiguration,
  WorkspaceState
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter,
  type WorkbenchSaveConflictSetter
} from "./workbenchActionRunner";
import {
  saveWorkbenchFile,
  type WorkbenchFileSavingServices
} from "./workbenchFileSaving";

export interface WorkbenchAutoSaveScheduler<Handle = unknown> {
  setTimeout(callback: () => void, delayMs: number): Handle;
  clearTimeout(handle: Handle): void;
}

export interface WorkbenchAutoSaveTimer<Handle = unknown> {
  setTimeout(callback: () => void, delayMs: number): Handle;
  clearTimeout(handle: Handle): void;
}

export interface WorkbenchAutoSaveState {
  readonly configuration: Pick<TyporaPlusConfiguration, "editor">;
  readonly model: Pick<TextFileModel, "dirty" | "uri">;
  readonly saveConflict: FileSaveConflict | undefined;
}

export interface WorkbenchAutoSaveCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setSaveConflict: WorkbenchSaveConflictSetter;
}

export function shouldScheduleWorkbenchAutoSave(state: WorkbenchAutoSaveState): boolean {
  return state.configuration.editor.autoSave &&
    state.model.dirty &&
    state.model.uri.scheme === "file" &&
    state.saveConflict === undefined;
}

export function createWorkbenchAutoSaveScheduler<Handle>(
  timer: WorkbenchAutoSaveTimer<Handle>
): WorkbenchAutoSaveScheduler<Handle> {
  return {
    setTimeout(callback, delayMs) {
      return timer.setTimeout(callback, delayMs);
    },
    clearTimeout(handle) {
      timer.clearTimeout(handle);
    }
  };
}

export function scheduleWorkbenchAutoSave<Handle>(
  services: WorkbenchFileSavingServices,
  workspaceFiles: WorkspaceState["files"],
  state: WorkbenchAutoSaveState,
  callbacks: WorkbenchAutoSaveCallbacks,
  scheduler: WorkbenchAutoSaveScheduler<Handle>
): (() => void) | undefined {
  if (!shouldScheduleWorkbenchAutoSave(state)) {
    return undefined;
  }

  const handle = scheduler.setTimeout(() => {
    void runWorkbenchAutoSave(services, workspaceFiles, callbacks);
  }, state.configuration.editor.autoSaveDelayMs);

  return () => scheduler.clearTimeout(handle);
}

export async function runWorkbenchAutoSave(
  services: WorkbenchFileSavingServices,
  workspaceFiles: WorkspaceState["files"],
  callbacks: WorkbenchAutoSaveCallbacks
): Promise<TextFileModel | undefined> {
  return runWorkbenchAction(
    () => saveWorkbenchFile(services, workspaceFiles, { recordRecent: false }),
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
}
