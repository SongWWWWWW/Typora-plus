import { URI } from "@typora-plus/base";
import type {
  FileSaveConflict,
  FileTreeEntry,
  TextFileModel,
  TextFileSaveOptions,
  WorkspaceFileTree
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  overwriteWorkbenchSaveConflict,
  reloadWorkbenchFileAfterSaveConflict,
  type WorkbenchSaveConflictResolutionServices
} from "./workbenchSaveConflictResolution";

describe("workbench save conflict resolution", () => {
  it("reloads the conflicted file, records it as recent, clears the conflict, and returns the model", async () => {
    const conflict = saveConflict("C:/Notes/a.md");
    const opened = model("C:/Notes/a.md", "# Disk");
    const calls: string[] = [];
    const clearSaveConflict = vi.fn(() => calls.push("clear"));
    const services = createServices({
      openFile: vi.fn(async (uri) => {
        calls.push(`open:${uri.toString()}`);
        return opened;
      }),
      addRecentFile: vi.fn((uri, name) => calls.push(`recent:${uri.toString()}:${name}`))
    });

    await expect(reloadWorkbenchFileAfterSaveConflict(services, conflict, { clearSaveConflict }))
      .resolves.toBe(opened);

    expect(calls).toEqual([
      `open:${conflict.uri.toString()}`,
      `recent:${opened.uri.toString()}:a.md`,
      "clear"
    ]);
  });

  it("does not clear the conflict when reload fails", async () => {
    const clearSaveConflict = vi.fn();
    const services = createServices({
      openFile: vi.fn(async () => {
        throw new Error("open failed");
      })
    });

    await expect(reloadWorkbenchFileAfterSaveConflict(
      services,
      saveConflict("C:/Notes/a.md"),
      { clearSaveConflict }
    )).rejects.toThrow("open failed");

    expect(clearSaveConflict).not.toHaveBeenCalled();
    expect(services.recentService.addRecentFile).not.toHaveBeenCalled();
  });

  it("overwrites the conflicted save, records and indexes the file, clears the conflict, and returns the model", async () => {
    const saved = model("C:/Notes/a.md", "# Local");
    const workspaceFiles = workspace([file("C:/Notes/a.md", "a.md")]);
    const calls: string[] = [];
    const clearSaveConflict = vi.fn(() => calls.push("clear"));
    const services = createServices({
      save: vi.fn(async (options) => {
        calls.push(`save:${JSON.stringify(options)}`);
        return saved;
      }),
      addRecentFile: vi.fn((uri, name) => calls.push(`recent:${uri.toString()}:${name}`)),
      indexFile: vi.fn(async (entry, value) => {
        calls.push(`index:${entry.relativePath}:${value}`);
      })
    });

    await expect(overwriteWorkbenchSaveConflict(services, workspaceFiles, { clearSaveConflict }))
      .resolves.toBe(saved);

    expect(calls).toEqual([
      "save:{\"overwrite\":true}",
      `recent:${saved.uri.toString()}:a.md`,
      "index:a.md:# Local",
      "clear"
    ]);
  });

  it("does not clear the conflict when overwrite fails", async () => {
    const clearSaveConflict = vi.fn();
    const services = createServices({
      save: vi.fn(async () => {
        throw new Error("save failed");
      })
    });

    await expect(overwriteWorkbenchSaveConflict(services, undefined, { clearSaveConflict }))
      .rejects.toThrow("save failed");

    expect(clearSaveConflict).not.toHaveBeenCalled();
    expect(services.recentService.addRecentFile).not.toHaveBeenCalled();
    expect(services.indexService.indexFile).not.toHaveBeenCalled();
  });
});

function createServices(overrides: {
  readonly openFile?: WorkbenchSaveConflictResolutionServices["textFileService"]["openFile"];
  readonly save?: (options?: TextFileSaveOptions) => Promise<TextFileModel>;
  readonly addRecentFile?: WorkbenchSaveConflictResolutionServices["recentService"]["addRecentFile"];
  readonly indexFile?: WorkbenchSaveConflictResolutionServices["indexService"]["indexFile"];
  readonly refreshWorkspace?: WorkbenchSaveConflictResolutionServices["fileService"]["refreshWorkspace"];
}): WorkbenchSaveConflictResolutionServices {
  return {
    textFileService: {
      openFile: vi.fn(overrides.openFile ?? (async (uri) => model(uri.toString(), ""))),
      save: vi.fn(overrides.save ?? (async () => model("C:/Notes/a.md", "# A"))),
      saveAs: vi.fn(async () => model("C:/Notes/a.md", "# A"))
    },
    recentService: {
      addRecentFile: vi.fn(overrides.addRecentFile ?? (() => undefined))
    },
    indexService: {
      indexFile: vi.fn(overrides.indexFile ?? (async () => undefined))
    },
    fileService: {
      refreshWorkspace: vi.fn(overrides.refreshWorkspace ?? (async () => undefined))
    },
    workspaceService: {
      setWorkspace: vi.fn()
    }
  };
}

function saveConflict(path: string): FileSaveConflict {
  return {
    uri: URI.file(path),
    diskMtime: 2,
    expectedMtime: 1
  };
}

function workspace(files: readonly FileTreeEntry[]): WorkspaceFileTree {
  return {
    root: {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: "",
      kind: "directory",
      children: files
    },
    files
  };
}

function file(path: string, relativePath: string): FileTreeEntry {
  return {
    uri: URI.file(path),
    name: relativePath.split("/").at(-1) ?? relativePath,
    relativePath,
    kind: "file"
  };
}

function model(path: string, value: string): TextFileModel {
  const uri = path.includes("://") ? URI.parse(path) : URI.file(path);

  return {
    uri,
    name: path.split("/").at(-1) ?? path,
    languageId: "markdown",
    value,
    dirty: false,
    version: 1
  };
}
