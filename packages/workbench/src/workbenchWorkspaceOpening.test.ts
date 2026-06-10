import { URI } from "@typora-plus/base";
import type { FileTreeEntry, TextFileModel, WorkspaceFileTree } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  openRecentWorkbenchWorkspace,
  openWorkbenchWorkspace,
  refreshWorkbenchWorkspace,
  workspaceStateFromFiles
} from "./workbenchWorkspaceOpening";

describe("workbench workspace opening", () => {
  it("maps workspace file trees into workspace state", () => {
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("notes/a.md")]);

    expect(workspaceStateFromFiles(workspaceFiles)).toEqual({
      name: "Notes",
      rootUri: workspaceFiles.root.uri,
      files: workspaceFiles
    });
  });

  it("opens a selected workspace, records it, notifies the shell, and opens the first file", async () => {
    const workspaceFiles = createWorkspaceFileTree([
      createFileEntry("notes/a.md"),
      createFileEntry("notes/b.md")
    ]);
    const calls: string[] = [];
    const services = createServices({
      openWorkspace: async () => {
        calls.push("openWorkspace");
        return workspaceFiles;
      },
      setWorkspace: () => calls.push("setWorkspace"),
      addRecentWorkspace: (_uri, name) => calls.push(`recentWorkspace:${name}`),
      openFile: async (uri) => {
        calls.push(`openFile:${uri.toString()}`);
        return createModel(uri, "a.md");
      },
      addRecentFile: (_uri, name) => calls.push(`recentFile:${name}`)
    });
    const didOpenWorkspace = vi.fn(() => calls.push("didOpenWorkspace"));
    const clearSaveConflict = vi.fn(() => calls.push("clearSaveConflict"));

    await expect(openWorkbenchWorkspace(services, {
      clearSaveConflict,
      didOpenWorkspace
    })).resolves.toBe(workspaceFiles);

    expect(didOpenWorkspace).toHaveBeenCalledWith(workspaceFiles);
    expect(clearSaveConflict).toHaveBeenCalledTimes(1);
    expect(calls).toEqual([
      "openWorkspace",
      "setWorkspace",
      "recentWorkspace:Notes",
      "didOpenWorkspace",
      "clearSaveConflict",
      "openFile:file:///workspace/notes/a.md",
      "recentFile:a.md"
    ]);
  });

  it("does not mutate workspace state when workspace selection is canceled", async () => {
    const services = createServices({
      openWorkspace: async () => undefined
    });

    await expect(openWorkbenchWorkspace(services)).resolves.toBeUndefined();

    expect(services.workspaceService.setWorkspace).not.toHaveBeenCalled();
    expect(services.recentService.addRecentWorkspace).not.toHaveBeenCalled();
    expect(services.textFileService.openFile).not.toHaveBeenCalled();
  });

  it("opens trusted recent workspaces through the file service boundary", async () => {
    const workspaceFiles = createWorkspaceFileTree([]);
    const recentUri = URI.file("/workspace");
    const services = createServices({
      openRecentWorkspace: async (uri) => uri.toString() === recentUri.toString() ? workspaceFiles : undefined
    });
    const didOpenWorkspace = vi.fn();
    const clearSaveConflict = vi.fn();

    await expect(openRecentWorkbenchWorkspace(services, recentUri, {
      clearSaveConflict,
      didOpenWorkspace
    })).resolves.toBe(workspaceFiles);

    expect(services.fileService.openRecentWorkspace).toHaveBeenCalledWith(recentUri);
    expect(didOpenWorkspace).toHaveBeenCalledWith(workspaceFiles);
    expect(clearSaveConflict).not.toHaveBeenCalled();
    expect(services.textFileService.openFile).not.toHaveBeenCalled();
  });

  it("refreshes workspace state without recording recents or opening files", async () => {
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("notes/a.md")]);
    const services = createServices({
      refreshWorkspace: async () => workspaceFiles
    });

    await expect(refreshWorkbenchWorkspace(services)).resolves.toBe(workspaceFiles);

    expect(services.workspaceService.setWorkspace).toHaveBeenCalledWith(workspaceStateFromFiles(workspaceFiles));
    expect(services.recentService.addRecentWorkspace).not.toHaveBeenCalled();
    expect(services.textFileService.openFile).not.toHaveBeenCalled();
  });
});

function createServices(overrides: {
  readonly openWorkspace?: () => Promise<WorkspaceFileTree | undefined>;
  readonly openRecentWorkspace?: (uri: URI) => Promise<WorkspaceFileTree | undefined>;
  readonly refreshWorkspace?: () => Promise<WorkspaceFileTree | undefined>;
  readonly setWorkspace?: (state: ReturnType<typeof workspaceStateFromFiles>) => void;
  readonly addRecentWorkspace?: (uri: URI, name: string) => void;
  readonly openFile?: (uri: URI) => Promise<TextFileModel>;
  readonly addRecentFile?: (uri: URI, name: string) => void;
}) {
  return {
    fileService: {
      openWorkspace: vi.fn(overrides.openWorkspace ?? (async () => undefined)),
      openRecentWorkspace: vi.fn(overrides.openRecentWorkspace ?? (async () => undefined)),
      refreshWorkspace: vi.fn(overrides.refreshWorkspace ?? (async () => undefined))
    },
    workspaceService: {
      setWorkspace: vi.fn(overrides.setWorkspace ?? (() => undefined))
    },
    recentService: {
      addRecentWorkspace: vi.fn(overrides.addRecentWorkspace ?? (() => undefined)),
      addRecentFile: vi.fn(overrides.addRecentFile ?? (() => undefined))
    },
    textFileService: {
      openFile: vi.fn(overrides.openFile ?? (async (uri) => createModel(uri, "note.md")))
    }
  };
}

function createWorkspaceFileTree(files: readonly FileTreeEntry[]): WorkspaceFileTree {
  return {
    root: {
      uri: URI.file("/workspace"),
      name: "Notes",
      relativePath: "",
      kind: "directory",
      children: files
    },
    files
  };
}

function createFileEntry(relativePath: string): FileTreeEntry {
  const name = relativePath.split("/").at(-1) ?? relativePath;

  return {
    uri: URI.file(`/workspace/${relativePath}`),
    name,
    relativePath,
    kind: "file"
  };
}

function createModel(uri: URI, name: string): TextFileModel {
  return {
    uri,
    name,
    languageId: "markdown",
    value: "",
    dirty: false,
    version: 1
  };
}
