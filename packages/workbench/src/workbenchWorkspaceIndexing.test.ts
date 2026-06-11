import { URI } from "@typora-plus/base";
import type {
  FileTreeEntry,
  WorkspaceFileTree
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  indexWorkbenchWorkspace,
  indexWorkbenchWorkspaceAction,
  type WorkbenchWorkspaceIndexingServices
} from "./workbenchWorkspaceIndexing";

describe("workbench workspace indexing", () => {
  it("does not index when no workspace files are available", async () => {
    const services = createServices();

    await expect(indexWorkbenchWorkspace(services, undefined)).resolves.toBeUndefined();

    expect(services.indexService.indexWorkspace).not.toHaveBeenCalled();
  });

  it("indexes available workspace files", async () => {
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("notes/a.md")]);
    const services = createServices();

    await expect(indexWorkbenchWorkspace(services, workspaceFiles)).resolves.toBeUndefined();

    expect(services.indexService.indexWorkspace).toHaveBeenCalledWith(workspaceFiles);
  });

  it("runs workspace indexing through Workbench action handling", async () => {
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("notes/a.md")]);
    const services = createServices();
    const setOperationError = vi.fn();
    const setSaveConflict = vi.fn();

    await expect(indexWorkbenchWorkspaceAction(services, workspaceFiles, {
      setOperationError,
      setSaveConflict
    })).resolves.toBeUndefined();

    expect(setOperationError).toHaveBeenCalledWith(undefined);
    expect(services.indexService.indexWorkspace).toHaveBeenCalledWith(workspaceFiles);
    expect(setSaveConflict).not.toHaveBeenCalled();
  });

  it("does not clear stale errors when workspace files are unavailable", async () => {
    const services = createServices();
    const setOperationError = vi.fn();

    await expect(indexWorkbenchWorkspaceAction(services, undefined, {
      setOperationError
    })).resolves.toBeUndefined();

    expect(setOperationError).not.toHaveBeenCalled();
    expect(services.indexService.indexWorkspace).not.toHaveBeenCalled();
  });

  it("maps workspace indexing failures into operation errors", async () => {
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("notes/a.md")]);
    const services = createServices({
      indexWorkspace: async () => {
        throw new Error("index failed");
      }
    });
    const setOperationError = vi.fn();

    await expect(indexWorkbenchWorkspaceAction(services, workspaceFiles, {
      setOperationError
    })).resolves.toBeUndefined();

    expect(setOperationError).toHaveBeenCalledWith(undefined);
    expect(setOperationError).toHaveBeenCalledWith("index failed");
  });
});

function createServices(overrides: {
  readonly indexWorkspace?: WorkbenchWorkspaceIndexingServices["indexService"]["indexWorkspace"];
} = {}): WorkbenchWorkspaceIndexingServices {
  return {
    indexService: {
      indexWorkspace: vi.fn(overrides.indexWorkspace ?? (async () => undefined))
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
