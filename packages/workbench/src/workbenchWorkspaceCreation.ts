import type { FileTreeEntry, IFileService, ITextFileService, IWorkspaceService, TextFileModel, WorkspaceState } from "@typora-plus/platform";
import {
  openWorkbenchFile,
  type WorkbenchFileOpeningCallbacks,
  type WorkbenchFileOpeningServices
} from "./workbenchFileOpening";
import { workspaceStateFromFiles } from "./workbenchWorkspaceOpening";

export interface WorkbenchWorkspaceCreationServices extends WorkbenchFileOpeningServices {
  readonly fileService: Pick<IFileService, "createDirectory" | "createFile" | "deleteEntry" | "renameEntry">;
  readonly textFileService: Pick<ITextFileService, "newUntitled" | "openFile">;
  readonly workspaceService: Pick<IWorkspaceService, "setWorkspace">;
}

export async function createWorkbenchWorkspaceFile(
  services: WorkbenchWorkspaceCreationServices,
  parent: FileTreeEntry,
  name: string,
  callbacks: WorkbenchFileOpeningCallbacks = {}
): Promise<FileTreeEntry> {
  const result = await services.fileService.createFile({
    parentUri: parent.uri,
    name
  });

  services.workspaceService.setWorkspace(workspaceStateFromFiles(result.workspace));
  await openWorkbenchFile(services, result.entry.uri, callbacks);

  return result.entry;
}

export async function createWorkbenchWorkspaceFileWithDefaultName(
  services: WorkbenchWorkspaceCreationServices,
  parent: FileTreeEntry,
  defaultName: string,
  callbacks: WorkbenchFileOpeningCallbacks = {}
): Promise<FileTreeEntry> {
  return createWorkbenchWorkspaceFile(
    services,
    parent,
    createAvailableWorkspaceEntryName(parent, defaultName),
    callbacks
  );
}

export async function createWorkbenchWorkspaceDirectory(
  services: WorkbenchWorkspaceCreationServices,
  parent: FileTreeEntry,
  name: string
): Promise<void> {
  const workspace = await services.fileService.createDirectory({
    parentUri: parent.uri,
    name
  });

  services.workspaceService.setWorkspace(workspaceStateFromFiles(workspace));
}

export async function createWorkbenchWorkspaceDirectoryWithDefaultName(
  services: WorkbenchWorkspaceCreationServices,
  parent: FileTreeEntry,
  defaultName: string
): Promise<void> {
  await createWorkbenchWorkspaceDirectory(
    services,
    parent,
    createAvailableWorkspaceEntryName(parent, defaultName)
  );
}

export async function renameWorkbenchWorkspaceEntry(
  services: WorkbenchWorkspaceCreationServices,
  workspace: WorkspaceState,
  model: TextFileModel,
  entry: FileTreeEntry,
  name: string,
  callbacks: WorkbenchFileOpeningCallbacks = {}
): Promise<FileTreeEntry> {
  const result = await services.fileService.renameEntry({
    uri: entry.uri,
    name
  });
  services.workspaceService.setWorkspace(workspaceStateFromFiles(result.workspace));

  const currentFile = findWorkspaceFileByUri(workspace, model.uri.toString());
  const renamedCurrentFile = currentFile
    ? findRenamedCurrentFile(result.workspace.files, entry, result.entry, currentFile)
    : undefined;

  if (renamedCurrentFile) {
    await openWorkbenchFile(services, renamedCurrentFile.uri, callbacks);
  }

  return result.entry;
}

export async function deleteWorkbenchWorkspaceEntry(
  services: WorkbenchWorkspaceCreationServices,
  workspace: WorkspaceState,
  model: TextFileModel,
  entry: FileTreeEntry,
  callbacks: WorkbenchFileOpeningCallbacks = {}
): Promise<void> {
  const workspaceFiles = await services.fileService.deleteEntry(entry.uri);
  services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));

  if (!isActiveFileInsideEntry(workspace, model.uri.toString(), entry)) {
    return;
  }

  const nextFile = workspaceFiles.files[0];

  if (nextFile) {
    await openWorkbenchFile(services, nextFile.uri, callbacks);
    return;
  }

  callbacks.clearSaveConflict?.();
  services.textFileService.newUntitled();
}

function findWorkspaceFileByUri(workspace: WorkspaceState, uri: string): FileTreeEntry | undefined {
  return workspace.files?.files.find((file) => file.uri.toString() === uri);
}

function isActiveFileInsideEntry(workspace: WorkspaceState, activeUri: string, entry: FileTreeEntry): boolean {
  const activeFile = findWorkspaceFileByUri(workspace, activeUri);

  if (!activeFile) {
    return false;
  }

  if (entry.kind === "file") {
    return activeFile.uri.toString() === entry.uri.toString();
  }

  return activeFile.relativePath === entry.relativePath ||
    activeFile.relativePath.startsWith(`${entry.relativePath}/`);
}

function findRenamedCurrentFile(
  nextFiles: readonly FileTreeEntry[],
  oldEntry: FileTreeEntry,
  renamedEntry: FileTreeEntry,
  currentFile: FileTreeEntry
): FileTreeEntry | undefined {
  if (oldEntry.kind === "file") {
    return currentFile.uri.toString() === oldEntry.uri.toString() ? renamedEntry : undefined;
  }

  const oldPrefix = oldEntry.relativePath ? `${oldEntry.relativePath}/` : "";
  const newPrefix = renamedEntry.relativePath ? `${renamedEntry.relativePath}/` : "";

  if (!oldPrefix || !currentFile.relativePath.startsWith(oldPrefix)) {
    return undefined;
  }

  const nextRelativePath = `${newPrefix}${currentFile.relativePath.slice(oldPrefix.length)}`;
  return nextFiles.find((file) => file.relativePath === nextRelativePath);
}

export function createAvailableWorkspaceEntryName(parent: FileTreeEntry, defaultName: string): string {
  const trimmed = defaultName.trim() || "Untitled.md";
  const extension = trimmed.includes(".") ? trimmed.slice(trimmed.lastIndexOf(".")) : "";
  const baseName = extension ? trimmed.slice(0, -extension.length) : trimmed;
  const existingNames = new Set((parent.children ?? []).map((entry) => entry.name.toLowerCase()));

  if (!existingNames.has(trimmed.toLowerCase())) {
    return trimmed;
  }

  for (let index = 2; index < 10_000; index += 1) {
    const candidate = `${baseName} ${index}${extension}`;

    if (!existingNames.has(candidate.toLowerCase())) {
      return candidate;
    }
  }

  return `${baseName} ${Date.now()}${extension}`;
}
