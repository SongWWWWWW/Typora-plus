import { URI } from "@typora-plus/base";
import type { FileTreeEntry, WorkspaceFileTree } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createAvailableWorkspaceEntryName,
  createWorkbenchWorkspaceDirectoryWithDefaultName,
  createWorkbenchWorkspaceFileWithDefaultName
} from "./workbenchWorkspaceCreation";

describe("workbench workspace creation", () => {
  it("chooses the next available default file name in the selected folder", () => {
    const parent = directory("C:/Notes", "Notes", "", [
      file("C:/Notes/未命名.md", "未命名.md", "未命名.md"),
      file("C:/Notes/未命名 2.md", "未命名 2.md", "未命名 2.md")
    ]);

    expect(createAvailableWorkspaceEntryName(parent, "未命名.md")).toBe("未命名 3.md");
  });

  it("creates a real default-named workspace file and opens it immediately", async () => {
    const root = directory("C:/Notes", "Notes", "", [
      file("C:/Notes/未命名.md", "未命名.md", "未命名.md")
    ]);
    const created = file("C:/Notes/未命名 2.md", "未命名 2.md", "未命名 2.md");
    const workspace = workspaceTree(root, [root.children![0]!, created]);
    const services = createServices({
      createFile: async (request) => {
        expect(request.parentUri.toString()).toBe("file://C:/Notes");
        expect(request.name).toBe("未命名 2.md");
        return {
          entry: created,
          workspace
        };
      }
    });

    await expect(createWorkbenchWorkspaceFileWithDefaultName(
      services,
      root,
      "未命名.md",
      { clearSaveConflict: services.callbacks.clearSaveConflict }
    )).resolves.toBe(created);

    expect(services.workspaceService.setWorkspace).toHaveBeenCalledWith({
      name: "Notes",
      rootUri: root.uri,
      files: workspace
    });
    expect(services.textFileService.openFile).toHaveBeenCalledWith(created.uri);
    expect(services.recentService.addRecentFile).toHaveBeenCalledWith(created.uri, created.name);
    expect(services.callbacks.clearSaveConflict).toHaveBeenCalledOnce();
  });

  it("creates a real default-named workspace folder without prompting for a save", async () => {
    const root = directory("C:/Notes", "Notes", "", [
      directory("C:/Notes/新建文件夹", "新建文件夹", "新建文件夹")
    ]);
    const created = directory("C:/Notes/新建文件夹 2", "新建文件夹 2", "新建文件夹 2");
    const workspace = workspaceTree({
      ...root,
      children: [...(root.children ?? []), created]
    }, [root.children![0]!, created]);
    const services = createServices({
      createDirectory: async (request) => {
        expect(request.parentUri.toString()).toBe("file://C:/Notes");
        expect(request.name).toBe("新建文件夹 2");
        return workspace;
      }
    });

    await createWorkbenchWorkspaceDirectoryWithDefaultName(services, root, "新建文件夹");

    expect(services.workspaceService.setWorkspace).toHaveBeenCalledWith({
      name: "Notes",
      rootUri: root.uri,
      files: workspace
    });
  });
});

function createServices(overrides: {
  readonly createFile?: (request: { readonly parentUri: URI; readonly name: string }) => Promise<{
    readonly entry: FileTreeEntry;
    readonly workspace: WorkspaceFileTree;
  }>;
  readonly createDirectory?: (request: { readonly parentUri: URI; readonly name: string }) => Promise<WorkspaceFileTree>;
}) {
  const callbacks = {
    clearSaveConflict: vi.fn()
  };
  const services = {
    callbacks,
    fileService: {
      createDirectory: vi.fn(overrides.createDirectory ?? (async () => workspaceTree())),
      createFile: vi.fn(overrides.createFile ?? (async () => {
        const entry = file("C:/Notes/Untitled.md", "Untitled.md", "Untitled.md");
        return { entry, workspace: workspaceTree(directory("C:/Notes", "Notes", "", [entry]), [entry]) };
      })),
      renameEntry: vi.fn(),
      deleteEntry: vi.fn()
    },
    textFileService: {
      openFile: vi.fn(async (uri: URI) => ({
        uri,
        name: uri.path.split("/").pop() ?? "Untitled.md",
        languageId: "markdown" as const,
        value: "",
        dirty: false,
        version: 1
      })),
      newUntitled: vi.fn()
    },
    recentService: {
      addRecentFile: vi.fn()
    },
    workspaceService: {
      setWorkspace: vi.fn()
    }
  };

  return services;
}

function workspaceTree(
  root = directory("C:/Notes", "Notes", ""),
  files: readonly FileTreeEntry[] = []
): WorkspaceFileTree {
  return {
    root,
    files
  };
}

function directory(
  path: string,
  name: string,
  relativePath: string,
  children: readonly FileTreeEntry[] = []
): FileTreeEntry {
  return {
    uri: URI.file(path),
    name,
    relativePath,
    kind: "directory",
    children
  };
}

function file(path: string, name: string, relativePath: string): FileTreeEntry {
  return {
    uri: URI.file(path),
    name,
    relativePath,
    kind: "file"
  };
}
