import { URI } from "@typora-plus/base";
import type {
  FileTreeEntry,
  TextFileModel,
  WorkspaceFileTree
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  openWorkbenchFileResource,
  openWorkbenchQuickOpenFile,
  openWorkbenchRecentWorkspaceResource,
  type WorkbenchResourceOpeningCallbacks
} from "./workbenchResourceOpening";
import { workspaceStateFromFiles } from "./workbenchWorkspaceOpening";

describe("workbench resource opening", () => {
  it("opens file resources through the shared file opening path", async () => {
    const entry = createFileEntry("notes/a.md");
    const openedModel = createModel(entry.uri, "a.md");
    const callbacks = createCallbacks();
    const services = createServices({
      openFile: async () => openedModel
    });

    await expect(openWorkbenchFileResource(services, entry, callbacks)).resolves.toBeUndefined();

    expect(callbacks.clearSaveConflict).toHaveBeenCalledOnce();
    expect(services.textFileService.openFile).toHaveBeenCalledWith(entry.uri);
    expect(services.recentService.addRecentFile).toHaveBeenCalledWith(openedModel.uri, openedModel.name);
  });

  it("closes Quick Open only after the selected file has opened and been recorded", async () => {
    const entry = createFileEntry("notes/a.md");
    const calls: string[] = [];
    const callbacks = createCallbacks({
      clearSaveConflict: () => calls.push("clear"),
      closeQuickOpen: () => calls.push("close")
    });
    const services = createServices({
      openFile: async (uri) => {
        calls.push(`open:${uri.toString()}`);
        return createModel(uri, "a.md");
      },
      addRecentFile: (_uri, name) => calls.push(`recent:${name}`)
    });

    await expect(openWorkbenchQuickOpenFile(services, entry, callbacks)).resolves.toBeUndefined();

    expect(calls).toEqual([
      "clear",
      "open:file:///workspace/notes/a.md",
      "recent:a.md",
      "close"
    ]);
  });

  it("opens recent workspaces and reports shell follow-up before opening the first file", async () => {
    const firstFile = createFileEntry("notes/a.md");
    const workspaceFiles = createWorkspaceFileTree([firstFile]);
    const calls: string[] = [];
    const callbacks = createCallbacks({
      clearSaveConflict: () => calls.push("clear"),
      showFilesView: () => calls.push("showFiles")
    });
    const services = createServices({
      openRecentWorkspace: async () => {
        calls.push("openRecentWorkspace");
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

    await expect(openWorkbenchRecentWorkspaceResource(
      services,
      { uri: workspaceFiles.root.uri },
      callbacks
    )).resolves.toBe(workspaceFiles);

    expect(services.workspaceService.setWorkspace).toHaveBeenCalledWith(workspaceStateFromFiles(workspaceFiles));
    expect(calls).toEqual([
      "openRecentWorkspace",
      "setWorkspace",
      "recentWorkspace:Notes",
      "showFiles",
      "clear",
      "openFile:file:///workspace/notes/a.md",
      "recentFile:a.md"
    ]);
  });

  it("does not report shell follow-up when recent workspace opening is unavailable", async () => {
    const callbacks = createCallbacks();
    const services = createServices({
      openRecentWorkspace: async () => undefined
    });

    await expect(openWorkbenchRecentWorkspaceResource(
      services,
      { uri: URI.file("/workspace") },
      callbacks
    )).resolves.toBeUndefined();

    expect(callbacks.showFilesView).not.toHaveBeenCalled();
    expect(callbacks.clearSaveConflict).not.toHaveBeenCalled();
    expect(services.workspaceService.setWorkspace).not.toHaveBeenCalled();
    expect(services.recentService.addRecentWorkspace).not.toHaveBeenCalled();
    expect(services.textFileService.openFile).not.toHaveBeenCalled();
  });
});

function createServices(overrides: {
  readonly openRecentWorkspace?: (uri: URI) => Promise<WorkspaceFileTree | undefined>;
  readonly setWorkspace?: (state: ReturnType<typeof workspaceStateFromFiles>) => void;
  readonly addRecentWorkspace?: (uri: URI, name: string) => void;
  readonly openFile?: (uri: URI) => Promise<TextFileModel>;
  readonly addRecentFile?: (uri: URI, name: string) => void;
} = {}) {
  return {
    fileService: {
      openRecentWorkspace: vi.fn(overrides.openRecentWorkspace ?? (async () => undefined))
    },
    recentService: {
      addRecentFile: vi.fn(overrides.addRecentFile ?? (() => undefined)),
      addRecentWorkspace: vi.fn(overrides.addRecentWorkspace ?? (() => undefined))
    },
    textFileService: {
      openFile: vi.fn(overrides.openFile ?? (async (uri) => createModel(uri, "note.md")))
    },
    workspaceService: {
      setWorkspace: vi.fn(overrides.setWorkspace ?? (() => undefined))
    }
  };
}

function createCallbacks(
  overrides: Partial<WorkbenchResourceOpeningCallbacks> = {}
): WorkbenchResourceOpeningCallbacks {
  return {
    clearSaveConflict: vi.fn(),
    closeQuickOpen: vi.fn(),
    showFilesView: vi.fn(),
    ...overrides
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
