import { URI } from "@typora-plus/base";
import type { FileTreeEntry, TextFileModel, WorkspaceFileTree } from "@typora-plus/platform";
import { describe, expect, it } from "vitest";
import { updateSavedFileIndex, type SavedFileIndexingServices } from "./savedFileIndexing";

describe("saved file indexing", () => {
  it("updates a saved file already present in the workspace tree without refreshing", async () => {
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("C:/Notes/a.md", "a.md")]);
    const calls: string[] = [];
    const services = createServices({
      async refreshWorkspace() {
        throw new Error("Refresh should not be called for an indexed file");
      },
      async indexFile(file, value) {
        calls.push(`${file.relativePath}:${value}`);
      }
    });

    const refreshed = await updateSavedFileIndex(services, workspaceFiles, createModel("C:/Notes/a.md", "# A"));

    expect(refreshed).toBeUndefined();
    expect(calls).toEqual(["a.md:# A"]);
  });

  it("refreshes the workspace tree and indexes a saved file that was not listed yet", async () => {
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("C:/Notes/a.md", "a.md")]);
    const refreshedWorkspace = createWorkspaceFileTree([
      createFileEntry("C:/Notes/a.md", "a.md"),
      createFileEntry("C:/Notes/new.md", "new.md")
    ]);
    const calls: string[] = [];
    const services = createServices({
      async refreshWorkspace() {
        return refreshedWorkspace;
      },
      async indexFile(file, value) {
        calls.push(`${file.relativePath}:${value}`);
      }
    });

    const refreshed = await updateSavedFileIndex(services, workspaceFiles, createModel("C:/Notes/new.md", "# New"));

    expect(refreshed).toBe(refreshedWorkspace);
    expect(calls).toEqual(["new.md:# New"]);
  });
});

function createServices(overrides: {
  readonly refreshWorkspace: () => Promise<WorkspaceFileTree | undefined>;
  readonly indexFile: SavedFileIndexingServices["indexService"]["indexFile"];
}): SavedFileIndexingServices {
  return {
    fileService: {
      refreshWorkspace: overrides.refreshWorkspace
    },
    indexService: {
      indexFile: overrides.indexFile
    }
  };
}

function createWorkspaceFileTree(files: readonly FileTreeEntry[]): WorkspaceFileTree {
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

function createFileEntry(path: string, relativePath: string): FileTreeEntry {
  return {
    uri: URI.file(path),
    name: relativePath.split("/").at(-1) ?? relativePath,
    relativePath,
    kind: "file"
  };
}

function createModel(path: string, value: string): TextFileModel {
  return {
    uri: URI.file(path),
    name: path.split("/").at(-1) ?? path,
    languageId: "markdown",
    value,
    dirty: false,
    version: 1
  };
}
