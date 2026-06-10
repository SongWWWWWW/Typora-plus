import { URI } from "@typora-plus/base";
import type {
  FileTreeEntry,
  TextFileModel,
  TextFileSaveOptions,
  WorkspaceFileTree
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  recordSavedWorkbenchFile,
  saveWorkbenchFile,
  saveWorkbenchFileAs,
  type WorkbenchFileSavingServices
} from "./workbenchFileSaving";
import { workspaceStateFromFiles } from "./workbenchWorkspaceOpening";

describe("workbench file saving", () => {
  it("saves, records recent file, indexes the saved file, and returns the model", async () => {
    const saved = model("C:/Notes/a.md", "# A");
    const workspaceFiles = workspace([file("C:/Notes/a.md", "a.md")]);
    const calls: string[] = [];
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

    await expect(saveWorkbenchFile(services, workspaceFiles)).resolves.toBe(saved);

    expect(calls).toEqual([
      "save:undefined",
      `recent:${saved.uri.toString()}:a.md`,
      "index:a.md:# A"
    ]);
  });

  it("can save without recording a recent file for auto-save", async () => {
    const saved = model("C:/Notes/a.md", "# A");
    const workspaceFiles = workspace([file("C:/Notes/a.md", "a.md")]);
    const services = createServices({
      save: vi.fn(async () => saved)
    });

    await saveWorkbenchFile(services, workspaceFiles, { recordRecent: false });

    expect(services.recentService.addRecentFile).not.toHaveBeenCalled();
    expect(services.indexService.indexFile).toHaveBeenCalledWith(workspaceFiles.files[0], "# A");
  });

  it("passes overwrite options through conflict overwrite saves", async () => {
    const saved = model("C:/Notes/a.md", "# A");
    const services = createServices({
      save: vi.fn(async () => saved)
    });

    await saveWorkbenchFile(services, undefined, { overwrite: true });

    expect(services.textFileService.save).toHaveBeenCalledWith({ overwrite: true });
  });

  it("save-as records and indexes saved files", async () => {
    const saved = model("C:/Notes/new.md", "# New");
    const workspaceFiles = workspace([file("C:/Notes/new.md", "new.md")]);
    const services = createServices({
      saveAs: vi.fn(async () => saved)
    });

    await expect(saveWorkbenchFileAs(services, workspaceFiles)).resolves.toBe(saved);

    expect(services.recentService.addRecentFile).toHaveBeenCalledWith(saved.uri, "new.md");
    expect(services.indexService.indexFile).toHaveBeenCalledWith(workspaceFiles.files[0], "# New");
  });

  it("save-as cancellation returns undefined without recording or indexing", async () => {
    const workspaceFiles = workspace([file("C:/Notes/a.md", "a.md")]);
    const services = createServices({
      saveAs: vi.fn(async () => undefined)
    });

    await expect(saveWorkbenchFileAs(services, workspaceFiles)).resolves.toBeUndefined();

    expect(services.recentService.addRecentFile).not.toHaveBeenCalled();
    expect(services.indexService.indexFile).not.toHaveBeenCalled();
  });

  it("does not record untitled saved models as recent files", () => {
    const services = createServices({});
    const untitled = {
      ...model("C:/Notes/a.md", "# A"),
      uri: URI.parse("untitled://default"),
      name: "Untitled.md"
    };

    recordSavedWorkbenchFile(services, untitled, true);

    expect(services.recentService.addRecentFile).not.toHaveBeenCalled();
  });

  it("updates workspace state when save-as refreshes a newly listed file", async () => {
    const saved = model("C:/Notes/new.md", "# New");
    const workspaceFiles = workspace([file("C:/Notes/a.md", "a.md")]);
    const refreshedWorkspace = workspace([
      file("C:/Notes/a.md", "a.md"),
      file("C:/Notes/new.md", "new.md")
    ]);
    const services = createServices({
      saveAs: vi.fn(async () => saved),
      refreshWorkspace: vi.fn(async () => refreshedWorkspace)
    });

    await saveWorkbenchFileAs(services, workspaceFiles);

    expect(services.workspaceService.setWorkspace)
      .toHaveBeenCalledWith(workspaceStateFromFiles(refreshedWorkspace));
  });
});

function createServices(overrides: {
  readonly save?: (options?: TextFileSaveOptions) => Promise<TextFileModel>;
  readonly saveAs?: () => Promise<TextFileModel | undefined>;
  readonly addRecentFile?: WorkbenchFileSavingServices["recentService"]["addRecentFile"];
  readonly indexFile?: WorkbenchFileSavingServices["indexService"]["indexFile"];
  readonly refreshWorkspace?: WorkbenchFileSavingServices["fileService"]["refreshWorkspace"];
}): WorkbenchFileSavingServices {
  return {
    textFileService: {
      save: vi.fn(overrides.save ?? (async () => model("C:/Notes/a.md", "# A"))),
      saveAs: vi.fn(overrides.saveAs ?? (async () => model("C:/Notes/a.md", "# A")))
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
  return {
    uri: URI.file(path),
    name: path.split("/").at(-1) ?? path,
    languageId: "markdown",
    value,
    dirty: false,
    version: 1
  };
}
