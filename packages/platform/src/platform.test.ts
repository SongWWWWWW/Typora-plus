import { Emitter, URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import {
  CommandService,
  ConfigurationService,
  FileSaveConflictError,
  NativeFileService,
  NativeAttachmentService,
  WorkspaceTextFileService,
  RecentService,
  flattenFileTree,
  mergeConfiguration,
  ServiceCollection,
  type FileTreeEntry,
  type NativeFileSystemHost,
  type SaveFileOptions,
  type WorkspaceFileTree
} from "./index";

describe("configuration", () => {
  it("merges nested configuration without dropping unrelated groups", () => {
    const service = new ConfigurationService();
    const next = mergeConfiguration(service.getValue(), {
      editor: {
        maxWidth: 720
      }
    });

    expect(next.editor.maxWidth).toBe(720);
    expect(next.appearance.colorScheme).toBe("system");
  });
});

describe("commands", () => {
  it("executes registered commands through the service accessor", () => {
    const services = new ServiceCollection();
    const commandService = new CommandService(services);

    commandService.registerCommand({
      id: "test.echo",
      title: "Echo",
      run: (_accessor, value) => value
    });

    expect(commandService.executeCommand("test.echo", "ok")).toBe("ok");
  });
});

describe("file tree", () => {
  it("flattens nested markdown files in stable tree order", () => {
    const root: FileTreeEntry = {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: "",
      kind: "directory",
      children: [
        {
          uri: URI.file("C:/Notes/a.md"),
          name: "a.md",
          relativePath: "a.md",
          kind: "file"
        },
        {
          uri: URI.file("C:/Notes/folder"),
          name: "folder",
          relativePath: "folder",
          kind: "directory",
          children: [
            {
              uri: URI.file("C:/Notes/folder/b.md"),
              name: "b.md",
              relativePath: "folder/b.md",
              kind: "file"
            }
          ]
        }
      ]
    };

    expect(flattenFileTree(root).map((entry) => entry.relativePath)).toEqual(["a.md", "folder/b.md"]);
  });

  it("publishes native workspace file changes", () => {
    const emitter = new Emitter<WorkspaceFileTree | undefined>();
    const workspaceFiles = createWorkspaceFileTree();
    const host: NativeFileSystemHost = {
      isAvailable: true,
      onDidChangeWorkspaceFiles: emitter.event,
      async openWorkspace() {
        return workspaceFiles;
      },
      async openRecentWorkspace() {
        return workspaceFiles;
      },
      async refreshWorkspace() {
        return workspaceFiles;
      },
      async readFile() {
        throw new Error("Not used");
      },
      async writeFile() {
        throw new Error("Not used");
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const service = new NativeFileService(host);
    let observed: WorkspaceFileTree | undefined;

    service.onDidChangeWorkspaceFiles((workspace) => {
      observed = workspace;
    });

    emitter.fire(workspaceFiles);

    expect(observed?.root.name).toBe("Notes");
    expect(service.getWorkspaceFiles()?.files.map((entry) => entry.name)).toEqual(["a.md"]);
  });

  it("opens recent workspaces through the native file host", async () => {
    const workspaceFiles = createWorkspaceFileTree();
    let requestedUri: string | undefined;
    const host: NativeFileSystemHost = {
      isAvailable: true,
      async openWorkspace() {
        return undefined;
      },
      async openRecentWorkspace(uri) {
        requestedUri = uri;
        return workspaceFiles;
      },
      async refreshWorkspace() {
        return undefined;
      },
      async readFile() {
        throw new Error("Not used");
      },
      async writeFile() {
        throw new Error("Not used");
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const service = new NativeFileService(host);
    let observed: WorkspaceFileTree | undefined;

    service.onDidChangeWorkspaceFiles((workspace) => {
      observed = workspace;
    });

    const opened = await service.openRecentWorkspace(URI.file("C:/Notes"));

    expect(requestedUri).toBe("file://C:/Notes");
    expect(opened?.root.name).toBe("Notes");
    expect(observed?.files.map((entry) => entry.name)).toEqual(["a.md"]);
  });
});

describe("workspace text files", () => {
  it("opens and saves native files through the file service", async () => {
    const host = createMemoryHost();
    const fileService = new NativeFileService(host);
    const textFileService = new WorkspaceTextFileService(fileService, {
      storageKey: "test-draft",
      defaultName: "Untitled.md",
      defaultContent: "# Untitled"
    });

    const opened = await textFileService.openFile(URI.file("C:/Notes/a.md"));
    expect(opened.value).toBe("# A");

    textFileService.updateContent("# Updated");
    const saved = await textFileService.save();

    expect(saved.dirty).toBe(false);
    expect(host.files.get("file://C:/Notes/a.md")).toBe("# Updated");
  });

  it("uses the last disk mtime when saving native files", async () => {
    const writes: SaveFileOptions[] = [];
    const host: NativeFileSystemHost = {
      isAvailable: true,
      async openWorkspace() {
        return undefined;
      },
      async openRecentWorkspace() {
        return undefined;
      },
      async refreshWorkspace() {
        return undefined;
      },
      async readFile(uri) {
        return {
          uri: URI.parse(uri),
          name: "a.md",
          value: "# A",
          mtime: 10
        };
      },
      async writeFile(uri, value, options) {
        writes.push(options ?? {});
        return {
          uri: URI.parse(uri),
          name: "a.md",
          value,
          mtime: 20
        };
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const fileService = new NativeFileService(host);
    const textFileService = new WorkspaceTextFileService(fileService, {
      storageKey: "test-mtime-draft",
      defaultName: "Untitled.md",
      defaultContent: "# Untitled"
    });

    const opened = await textFileService.openFile(URI.file("C:/Notes/a.md"));
    textFileService.updateContent("# Local");
    const saved = await textFileService.save();

    expect(opened.lastSavedMtime).toBe(10);
    expect(writes[0]).toEqual({ expectedMtime: 10 });
    expect(saved.lastSavedMtime).toBe(20);
  });

  it("keeps the active model dirty when native save reports a conflict", async () => {
    const uri = URI.file("C:/Notes/a.md");
    const host: NativeFileSystemHost = {
      isAvailable: true,
      async openWorkspace() {
        return undefined;
      },
      async openRecentWorkspace() {
        return undefined;
      },
      async refreshWorkspace() {
        return undefined;
      },
      async readFile() {
        return {
          uri,
          name: "a.md",
          value: "# A",
          mtime: 10
        };
      },
      async writeFile() {
        throw new FileSaveConflictError({
          uri,
          expectedMtime: 10,
          diskMtime: 20
        });
      },
      async saveFileAs() {
        return undefined;
      }
    };
    const fileService = new NativeFileService(host);
    const textFileService = new WorkspaceTextFileService(fileService, {
      storageKey: "test-conflict-draft",
      defaultName: "Untitled.md",
      defaultContent: "# Untitled"
    });

    await textFileService.openFile(uri);
    textFileService.updateContent("# Local");

    await expect(textFileService.save()).rejects.toBeInstanceOf(FileSaveConflictError);
    expect(textFileService.getActiveModel().dirty).toBe(true);
    expect(textFileService.getActiveModel().value).toBe("# Local");
  });
});

describe("attachments", () => {
  it("saves images through the native bridge", async () => {
    const service = new NativeAttachmentService("assets", {
      isAvailable: true,
      async saveImage(noteUri, image, assetFolder) {
        return {
          uri: "file://C:/Notes/assets/a/image.png",
          relativePath: `${assetFolder}/a/${image.name}`,
          markdown: `![image](${assetFolder}/a/${image.name})`
        };
      }
    });

    const saved = await service.saveImage(URI.file("C:/Notes/a.md"), {
      name: "image.png",
      mimeType: "image/png",
      base64: "AA=="
    });

    expect(saved?.uri.toString()).toBe("file://C:/Notes/assets/a/image.png");
    expect(saved?.markdown).toBe("![image](assets/a/image.png)");
  });
});

describe("recents", () => {
  it("deduplicates and persists recent resources", () => {
    const storage = createMemoryStorage();
    const service = new RecentService({
      storageKey: "recents",
      maxEntries: 2,
      now: createCounterClock(),
      storage
    });

    service.addRecentFile(URI.file("C:/Notes/a.md"), "a.md");
    service.addRecentWorkspace(URI.file("C:/Notes"), "Notes");
    service.addRecentFile(URI.file("C:/Notes/a.md"), "a.md");

    expect(service.getRecents().map((recent) => recent.name)).toEqual(["a.md", "Notes"]);

    const restored = new RecentService({
      storageKey: "recents",
      maxEntries: 2,
      storage
    });

    expect(restored.getRecentFiles()[0]?.uri.toString()).toBe("file://C:/Notes/a.md");
  });
});

function createMemoryHost() {
  const files = new Map<string, string>([["file://C:/Notes/a.md", "# A"]]);
  const host: NativeFileSystemHost & { readonly files: Map<string, string> } = {
    files,
    isAvailable: true,
    async openWorkspace() {
      return undefined;
    },
    async openRecentWorkspace() {
      return undefined;
    },
    async refreshWorkspace() {
      return undefined;
    },
    async readFile(uri) {
      const value = files.get(uri);

      if (value === undefined) {
        throw new Error(`Missing file: ${uri}`);
      }

      return {
        uri: URI.parse(uri),
        name: "a.md",
        value
      };
    },
    async writeFile(uri, value) {
      files.set(uri, value);
      return {
        uri: URI.parse(uri),
        name: "a.md",
        value
      };
    },
    async saveFileAs(defaultName, value) {
      const uri = URI.file(`C:/Notes/${defaultName}`);
      files.set(uri.toString(), value);
      return {
        uri,
        name: defaultName,
        value
      };
    }
  };

  return host;
}

function createWorkspaceFileTree(): WorkspaceFileTree {
  const file: FileTreeEntry = {
    uri: URI.file("C:/Notes/a.md"),
    name: "a.md",
    relativePath: "a.md",
    kind: "file"
  };

  return {
    root: {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: "",
      kind: "directory",
      children: [file]
    },
    files: [file]
  };
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    read(key: string) {
      return values.get(key);
    },
    write(key: string, value: string) {
      values.set(key, value);
    }
  };
}

function createCounterClock() {
  let value = 0;
  return () => {
    value += 1;
    return value;
  };
}
