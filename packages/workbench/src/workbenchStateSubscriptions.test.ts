import { Emitter, URI } from "@typora-plus/base";
import {
  defaultConfiguration,
  type FileTreeEntry,
  type RecentResource,
  type RegisteredTheme,
  type TextFileModel,
  type TyporaPlusConfiguration,
  type WorkspaceFileTree,
  type WorkspaceIndexStatus,
  type WorkspaceState
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import type { WorkbenchServices } from "./services";
import {
  registerWorkbenchStateSubscriptions,
  type WorkbenchStateSubscriptionCallbacks
} from "./workbenchStateSubscriptions";

describe("workbench state subscriptions", () => {
  it("forwards service state changes and syncs configuration to runtime services", () => {
    const harness = createHarness();
    const callbacks = createCallbacks();
    const model = createModel("file:///workspace/a.md", "a.md");
    const workspace: WorkspaceState = {
      name: "Workspace"
    };
    const recents: readonly RecentResource[] = [{
      kind: "file",
      uri: URI.file("/workspace/a.md"),
      name: "a.md",
      lastOpenedAt: 1
    }];
    const themes: readonly RegisteredTheme[] = [{
      id: "ink-dark",
      label: "Ink Dark",
      tokens: {
        "--tp-bg": "#111"
      }
    }];
    const status: WorkspaceIndexStatus = {
      state: "indexing",
      indexedFiles: 3,
      totalFiles: 5,
      skippedFiles: 1,
      updatedAt: 10
    };
    const nextConfiguration: TyporaPlusConfiguration = {
      ...defaultConfiguration,
      workspace: {
        ...defaultConfiguration.workspace,
        defaultAssetFolder: "media",
        searchMaxFileSizeBytes: 1234,
        searchMaxResults: 8
      }
    };

    harness.services.themeService.getThemes = vi.fn(() => themes);
    registerWorkbenchStateSubscriptions(harness.services, callbacks);

    harness.emitters.configuration.fire(nextConfiguration);
    harness.emitters.model.fire(model);
    harness.emitters.workspace.fire(workspace);
    harness.emitters.recents.fire(recents);
    harness.emitters.themes.fire();
    harness.emitters.indexStatus.fire(status);
    harness.emitters.commands.fire();
    harness.emitters.markdownRenderers.fire();
    harness.emitters.aiProviders.fire();
    harness.emitters.remoteSyncProviders.fire();

    expect(callbacks.setConfiguration).toHaveBeenCalledWith(nextConfiguration);
    expect(harness.services.attachmentService.configure).toHaveBeenCalledWith({
      assetFolder: "media"
    });
    expect(harness.services.indexService.configure).toHaveBeenCalledWith({
      maxFileSizeBytes: 1234,
      maxResults: 8
    });
    expect(harness.services.keybindingService.setUserKeybindings)
      .toHaveBeenCalledWith(defaultConfiguration.keybindings.overrides);
    expect(callbacks.setModel).toHaveBeenCalledWith(model);
    expect(callbacks.setWorkspace).toHaveBeenCalledWith(workspace);
    expect(callbacks.setRecents).toHaveBeenCalledWith(recents);
    expect(callbacks.setThemes).toHaveBeenCalledWith(themes);
    expect(callbacks.setIndexStatus).toHaveBeenCalledWith(status);
    expect(callbacks.bumpCommandRevision).toHaveBeenCalledOnce();
    expect(callbacks.bumpMarkdownRendererRevision).toHaveBeenCalledOnce();
    expect(callbacks.bumpAiProviderRevision).toHaveBeenCalledOnce();
    expect(callbacks.bumpRemoteSyncProviderRevision).toHaveBeenCalledOnce();
  });

  it("maps native workspace file tree changes through the workspace service", () => {
    const harness = createHarness();
    const callbacks = createCallbacks();
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("notes/a.md")]);

    registerWorkbenchStateSubscriptions(harness.services, callbacks);

    harness.emitters.workspaceFiles.fire(undefined);
    expect(harness.services.workspaceService.setWorkspace).not.toHaveBeenCalled();

    harness.emitters.workspaceFiles.fire(workspaceFiles);
    expect(harness.services.workspaceService.setWorkspace).toHaveBeenCalledWith({
      name: "Notes",
      rootUri: workspaceFiles.root.uri,
      files: workspaceFiles
    });
  });

  it("disposes every service listener as one lifecycle unit", () => {
    const harness = createHarness();
    const callbacks = createCallbacks();
    const workspaceFiles = createWorkspaceFileTree([createFileEntry("notes/a.md")]);
    const disposable = registerWorkbenchStateSubscriptions(harness.services, callbacks);

    disposable.dispose();
    harness.emitters.configuration.fire(defaultConfiguration);
    harness.emitters.workspaceFiles.fire(workspaceFiles);
    harness.emitters.model.fire(createModel("file:///workspace/a.md", "a.md"));
    harness.emitters.workspace.fire({ name: "Workspace" });
    harness.emitters.recents.fire([]);
    harness.emitters.themes.fire();
    harness.emitters.commands.fire();
    harness.emitters.indexStatus.fire({
      state: "idle",
      indexedFiles: 0,
      totalFiles: 0,
      skippedFiles: 0,
      updatedAt: 1
    });
    harness.emitters.markdownRenderers.fire();
    harness.emitters.aiProviders.fire();
    harness.emitters.remoteSyncProviders.fire();

    expect(callbacks.setConfiguration).not.toHaveBeenCalled();
    expect(harness.services.attachmentService.configure).not.toHaveBeenCalled();
    expect(harness.services.workspaceService.setWorkspace).not.toHaveBeenCalled();
    expect(callbacks.setModel).not.toHaveBeenCalled();
    expect(callbacks.setWorkspace).not.toHaveBeenCalled();
    expect(callbacks.setRecents).not.toHaveBeenCalled();
    expect(callbacks.setThemes).not.toHaveBeenCalled();
    expect(callbacks.setIndexStatus).not.toHaveBeenCalled();
    expect(callbacks.bumpCommandRevision).not.toHaveBeenCalled();
    expect(callbacks.bumpMarkdownRendererRevision).not.toHaveBeenCalled();
    expect(callbacks.bumpAiProviderRevision).not.toHaveBeenCalled();
    expect(callbacks.bumpRemoteSyncProviderRevision).not.toHaveBeenCalled();
  });
});

function createHarness(): {
  readonly emitters: {
    readonly aiProviders: Emitter<void>;
    readonly commands: Emitter<void>;
    readonly configuration: Emitter<TyporaPlusConfiguration>;
    readonly indexStatus: Emitter<WorkspaceIndexStatus>;
    readonly markdownRenderers: Emitter<void>;
    readonly model: Emitter<TextFileModel>;
    readonly recents: Emitter<readonly RecentResource[]>;
    readonly themes: Emitter<void>;
    readonly workspace: Emitter<WorkspaceState>;
    readonly workspaceFiles: Emitter<WorkspaceFileTree | undefined>;
    readonly remoteSyncProviders: Emitter<void>;
  };
  readonly services: WorkbenchServices;
} {
  const emitters = {
    aiProviders: new Emitter<void>(),
    commands: new Emitter<void>(),
    configuration: new Emitter<TyporaPlusConfiguration>(),
    indexStatus: new Emitter<WorkspaceIndexStatus>(),
    markdownRenderers: new Emitter<void>(),
    model: new Emitter<TextFileModel>(),
    recents: new Emitter<readonly RecentResource[]>(),
    themes: new Emitter<void>(),
    workspace: new Emitter<WorkspaceState>(),
    workspaceFiles: new Emitter<WorkspaceFileTree | undefined>(),
    remoteSyncProviders: new Emitter<void>()
  };
  const services = {
    aiService: {
      onDidChangeAiProviders: emitters.aiProviders.event
    },
    attachmentService: {
      configure: vi.fn()
    },
    commandService: {
      onDidChangeCommands: emitters.commands.event
    },
    configurationService: {
      onDidChangeConfiguration: emitters.configuration.event
    },
    fileService: {
      onDidChangeWorkspaceFiles: emitters.workspaceFiles.event
    },
    indexService: {
      configure: vi.fn(),
      onDidChangeStatus: emitters.indexStatus.event
    },
    keybindingService: {
      setUserKeybindings: vi.fn()
    },
    markdownRendererService: {
      onDidChangeMarkdownRenderers: emitters.markdownRenderers.event
    },
    recentService: {
      onDidChangeRecents: emitters.recents.event
    },
    remoteSyncService: {
      onDidChangeRemoteSyncProviders: emitters.remoteSyncProviders.event
    },
    textFileService: {
      onDidChangeModel: emitters.model.event
    },
    themeService: {
      getThemes: vi.fn(() => []),
      onDidChangeThemes: emitters.themes.event
    },
    workspaceService: {
      onDidChangeWorkspace: emitters.workspace.event,
      setWorkspace: vi.fn()
    }
  } as unknown as WorkbenchServices;

  return {
    emitters,
    services
  };
}

function createCallbacks(): WorkbenchStateSubscriptionCallbacks {
  return {
    bumpAiProviderRevision: vi.fn(),
    bumpCommandRevision: vi.fn(),
    bumpMarkdownRendererRevision: vi.fn(),
    bumpRemoteSyncProviderRevision: vi.fn(),
    setConfiguration: vi.fn(),
    setIndexStatus: vi.fn(),
    setModel: vi.fn(),
    setRecents: vi.fn(),
    setThemes: vi.fn(),
    setWorkspace: vi.fn()
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

function createModel(uri: string, name: string): TextFileModel {
  return {
    uri: URI.parse(uri),
    name,
    languageId: "markdown",
    value: "",
    dirty: false,
    version: 1
  };
}
