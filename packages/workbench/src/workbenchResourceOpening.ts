import type {
  FileTreeEntry,
  RecentResource,
  WorkspaceFileTree
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter,
  type WorkbenchSaveConflictSetter
} from "./workbenchActionRunner";
import {
  openWorkbenchFile,
  type WorkbenchFileOpeningServices
} from "./workbenchFileOpening";
import {
  openRecentWorkbenchWorkspace,
  type WorkbenchRecentWorkspaceOpeningServices
} from "./workbenchWorkspaceOpening";

export interface WorkbenchResourceOpeningCallbacks {
  readonly clearSaveConflict: () => void;
  readonly closeQuickOpen: () => void;
  readonly showFilesView: () => void;
}

export interface WorkbenchResourceOpeningActionCallbacks extends WorkbenchResourceOpeningCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setSaveConflict?: WorkbenchSaveConflictSetter;
}

export async function openWorkbenchFileResource(
  services: WorkbenchFileOpeningServices,
  entry: FileTreeEntry,
  callbacks: Pick<WorkbenchResourceOpeningCallbacks, "clearSaveConflict">
): Promise<void> {
  await openWorkbenchFile(services, entry.uri, {
    clearSaveConflict: callbacks.clearSaveConflict
  });
}

export function openWorkbenchFileResourceAction(
  services: WorkbenchFileOpeningServices,
  entry: FileTreeEntry,
  callbacks: WorkbenchResourceOpeningActionCallbacks
): Promise<void | undefined> {
  return runWorkbenchAction(
    () => openWorkbenchFileResource(services, entry, callbacks),
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
}

export function openWorkbenchQuickOpenFileAction(
  services: WorkbenchFileOpeningServices,
  entry: FileTreeEntry,
  callbacks: WorkbenchResourceOpeningActionCallbacks
): Promise<void | undefined> {
  return runWorkbenchAction(
    () => openWorkbenchQuickOpenFile(services, entry, callbacks),
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
}

export function openWorkbenchRecentWorkspaceResourceAction(
  services: WorkbenchRecentWorkspaceOpeningServices,
  recent: Pick<RecentResource, "uri">,
  callbacks: WorkbenchResourceOpeningActionCallbacks
): Promise<WorkspaceFileTree | undefined> {
  return runWorkbenchAction(
    () => openWorkbenchRecentWorkspaceResource(services, recent, callbacks),
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
}

export async function openWorkbenchQuickOpenFile(
  services: WorkbenchFileOpeningServices,
  entry: FileTreeEntry,
  callbacks: Pick<WorkbenchResourceOpeningCallbacks, "clearSaveConflict" | "closeQuickOpen">
): Promise<void> {
  await openWorkbenchFileResource(services, entry, callbacks);
  callbacks.closeQuickOpen();
}

export async function openWorkbenchRecentWorkspaceResource(
  services: WorkbenchRecentWorkspaceOpeningServices,
  recent: Pick<RecentResource, "uri">,
  callbacks: Pick<WorkbenchResourceOpeningCallbacks, "clearSaveConflict" | "showFilesView">
): Promise<WorkspaceFileTree | undefined> {
  return openRecentWorkbenchWorkspace(services, recent.uri, {
    didOpenWorkspace: () => {
      callbacks.showFilesView();
      callbacks.clearSaveConflict();
    }
  });
}
