import { URI } from "@typora-plus/base";
import {
  defaultConfiguration,
  type AiTextRequest,
  type Command,
  type RemoteSyncPlanRequest,
  type TextFileModel,
  type WorkspaceFileTree,
  type WorkspaceIndexStatus
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  registerWorkbenchCommands,
  type WorkbenchCommandRegistrationCallbacks
} from "./workbenchCommandRegistration";
import type { WorkbenchServices } from "./services";
import { workbenchCommandIds } from "./workbenchCommandIds";
import type { WorkbenchSideView } from "./workbenchSideViewModel";

describe("workbench command registration", () => {
  it("registers the Workbench command handler set and disposes registrations", () => {
    const registered = new Map<string, Command>();
    const disposeCalls: string[] = [];
    const services = createServices(registered, disposeCalls);
    const disposable = registerWorkbenchCommands(services, state(), callbacks());

    expect([...registered.keys()]).toEqual([
      workbenchCommandIds.file.newUntitled,
      workbenchCommandIds.file.openWorkspace,
      workbenchCommandIds.file.refreshWorkspace,
      workbenchCommandIds.workbench.quickOpen,
      workbenchCommandIds.workbench.commandPaletteOpen,
      workbenchCommandIds.workbench.settingsOpen,
      workbenchCommandIds.workbench.sidebarFiles,
      workbenchCommandIds.workbench.sidebarSearch,
      workbenchCommandIds.workbench.sidebarOutline,
      workbenchCommandIds.workbench.sidebarBacklinks,
      workbenchCommandIds.workbench.sidebarTags,
      workbenchCommandIds.file.save,
      workbenchCommandIds.file.saveAs,
      workbenchCommandIds.file.exportHtml,
      workbenchCommandIds.editor.focusModeToggle,
      workbenchCommandIds.editor.typewriterModeToggle,
      workbenchCommandIds.editor.taskToggleLines,
      workbenchCommandIds.editor.taskRemoveMarkers,
      workbenchCommandIds.theme.toggle
    ]);

    disposable.dispose();

    expect(disposeCalls).toEqual([...registered.keys()]);
  });

  it("wires simple UI commands through callbacks", () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();

    registerWorkbenchCommands(createServices(registered), state(), testCallbacks);

    registered.get(workbenchCommandIds.workbench.quickOpen)?.run({} as never);
    registered.get(workbenchCommandIds.workbench.commandPaletteOpen)?.run({} as never);
    registered.get(workbenchCommandIds.workbench.settingsOpen)?.run({} as never);
    registered.get(workbenchCommandIds.workbench.sidebarFiles)?.run({} as never);

    expect(testCallbacks.setQuickOpen).toHaveBeenCalledWith(true);
    expect(testCallbacks.setPaletteOpen).toHaveBeenCalledWith(true);
    expect(testCallbacks.setSettingsOpen).toHaveBeenCalledWith(true);
    const sideViewUpdate = vi.mocked(testCallbacks.setSideView).mock.calls[0]?.[0];
    expect(typeof sideViewUpdate).toBe("function");
    expect((sideViewUpdate as (activeView: WorkbenchSideView | null) => WorkbenchSideView | null)("files"))
      .toBeNull();
    expect((sideViewUpdate as (activeView: WorkbenchSideView | null) => WorkbenchSideView | null)("search"))
      .toBe("files");
  });

  it("registers active-note AI writing commands only when an AI provider is available", async () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI Responses" }]
    });

    registerWorkbenchCommands(services, state(), testCallbacks);

    expect(registered.has(workbenchCommandIds.ai.summarizeActiveNote)).toBe(true);
    expect(registered.has(workbenchCommandIds.ai.rewriteActiveNote)).toBe(true);
    expect(registered.has(workbenchCommandIds.ai.continueActiveNote)).toBe(true);
    expect(registered.has(workbenchCommandIds.ai.extractTasksActiveNote)).toBe(true);

    await registered.get(workbenchCommandIds.ai.rewriteActiveNote)?.run({} as never);

    expect(services.aiService.requestText).toHaveBeenCalledWith("openai.responses", {
      instruction: expect.stringContaining("Rewrite"),
      input: "# A",
      metadata: {
        surface: "command",
        action: "rewriteActiveNote",
        source: "active-note",
        sourceName: "a.md",
        sourceScheme: "file",
        languageId: "markdown"
      }
    });
    expect(testCallbacks.setAiResponse).toHaveBeenCalledWith({
      action: "rewriteActiveNote",
      applyMode: "replace",
      response: {
        providerId: "openai.responses",
        value: "Summary"
      },
      title: "Rewrite Active Note"
    });
    expect(services.indexService.query).toHaveBeenCalledWith("a", {
      maxPreviewLength: defaultConfiguration.ai.workspaceContextMaxPreviewLength,
      maxResults: defaultConfiguration.ai.workspaceContextMaxResults + 1
    });

    const noProviderCommands = new Map<string, Command>();
    registerWorkbenchCommands(createServices(noProviderCommands), state(), callbacks());

    expect(noProviderCommands.has(workbenchCommandIds.ai.summarizeActiveNote)).toBe(false);
    expect(noProviderCommands.has(workbenchCommandIds.ai.rewriteActiveNote)).toBe(false);
    expect(noProviderCommands.has(workbenchCommandIds.ai.continueActiveNote)).toBe(false);
    expect(noProviderCommands.has(workbenchCommandIds.ai.extractTasksActiveNote)).toBe(false);
  });

  it("registers the remote sync plan command only when a provider and workspace are available", async () => {
    const workspaceFiles = createWorkspaceFileTree();
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      remoteSyncProviders: [{ id: "feishu.raw", title: "Feishu Raw Mirror" }],
      workspaceFiles
    });

    registerWorkbenchCommands(services, state({ workspaceFiles }), testCallbacks);

    expect(registered.has(workbenchCommandIds.remoteSync.planWorkspace)).toBe(true);

    await registered.get(workbenchCommandIds.remoteSync.planWorkspace)?.run({} as never);

    const request = vi.mocked(services.remoteSyncService.createPlan).mock.calls[0]?.[1] as RemoteSyncPlanRequest;

    expect(services.remoteSyncService.createPlan).toHaveBeenCalledWith("feishu.raw", {
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file",
        name: "A.md"
      }],
      direction: "push",
      dryRun: true,
      metadata: {
        surface: "command",
        action: "planWorkspace",
        source: "workspace",
        workspaceName: "Notes",
        workspaceScheme: "file"
      }
    });
    expect(testCallbacks.setRemoteSyncPlan).toHaveBeenCalledWith({
      providerId: "feishu.raw",
      request,
      plan: {
        operations: [{
          kind: "create",
          target: "remote",
          relativePath: "A.md",
          localUri: URI.file("C:/Notes/A.md")
        }],
        summary: {
          creates: 1,
          updates: 0,
          deletes: 0,
          skips: 0,
          conflicts: 0
        }
      }
    });

    const noProviderCommands = new Map<string, Command>();
    registerWorkbenchCommands(createServices(noProviderCommands, [], {
      workspaceFiles
    }), state({ workspaceFiles }), callbacks());
    expect(noProviderCommands.has(workbenchCommandIds.remoteSync.planWorkspace)).toBe(false);

    const noWorkspaceCommands = new Map<string, Command>();
    registerWorkbenchCommands(createServices(noWorkspaceCommands, [], {
      remoteSyncProviders: [{ id: "feishu.raw", title: "Feishu Raw Mirror" }],
      workspaceFiles
    }), state(), callbacks());
    expect(noWorkspaceCommands.has(workbenchCommandIds.remoteSync.planWorkspace)).toBe(false);
  });

  it("exports the active model through the export service", async () => {
    const registered = new Map<string, Command>();
    const services = createServices(registered);

    registerWorkbenchCommands(services, state(), callbacks());

    await registered.get(workbenchCommandIds.file.exportHtml)?.run({} as never);

    expect(services.exportService.exportAndSave).toHaveBeenCalledWith({
      uri: URI.file("C:/Notes/a.md"),
      name: "a.md",
      value: "# A"
    }, "html");
  });

  it("updates configuration and delegates editor task commands", () => {
    const registered = new Map<string, Command>();
    const editorHandle = {
      removeTaskListMarkers: vi.fn(() => true),
      toggleTaskListLines: vi.fn(() => true)
    };
    const services = createServices(registered);
    const testCallbacks = callbacks({
      getEditorHandle: () => editorHandle
    });

    registerWorkbenchCommands(services, state({
      configuration: {
        editor: {
          focusMode: false,
          typewriterMode: true
        },
        appearance: {
          colorScheme: "dark"
        }
      }
    }), testCallbacks);

    expect(registered.get(workbenchCommandIds.editor.focusModeToggle)?.run({} as never)).toBeUndefined();
    expect(registered.get(workbenchCommandIds.editor.typewriterModeToggle)?.run({} as never)).toBeUndefined();
    expect(registered.get(workbenchCommandIds.theme.toggle)?.run({} as never)).toBeUndefined();
    expect(registered.get(workbenchCommandIds.editor.taskToggleLines)?.run({} as never)).toBe(true);
    expect(registered.get(workbenchCommandIds.editor.taskRemoveMarkers)?.run({} as never)).toBe(true);

    expect(services.configurationService.updateValue).toHaveBeenCalledWith({
      editor: {
        focusMode: true
      }
    });
    expect(services.configurationService.updateValue).toHaveBeenCalledWith({
      editor: {
        typewriterMode: false
      }
    });
    expect(services.configurationService.updateValue).toHaveBeenCalledWith({
      appearance: {
        colorScheme: "light"
      }
    });
    expect(editorHandle.toggleTaskListLines).toHaveBeenCalledOnce();
    expect(editorHandle.removeTaskListMarkers).toHaveBeenCalledOnce();
  });
});

function createServices(
  registered: Map<string, Command>,
  disposeCalls: string[] = [],
  options: {
    readonly aiProviders?: readonly { readonly id: string; readonly title: string }[];
    readonly remoteSyncProviders?: readonly { readonly id: string; readonly title: string }[];
    readonly workspaceFiles?: WorkspaceFileTree;
  } = {}
): WorkbenchServices {
  const activeModel = model("C:/Notes/a.md", "# A");
  const workspaceFiles = options.workspaceFiles;

  return {
    aiService: {
      onDidChangeAiProviders: vi.fn(),
      registerProvider: vi.fn(),
      getProviders: vi.fn(() => options.aiProviders ?? []),
      requestText: vi.fn(async (providerId: string, _request: AiTextRequest) => ({
        providerId,
        value: "Summary"
      }))
    },
    commandService: {
      registerCommand: vi.fn((command: Command) => {
        registered.set(command.id, command);
        return {
          dispose: () => disposeCalls.push(command.id)
        };
      }),
      registerCommandMetadata: vi.fn(),
      executeCommand: vi.fn(),
      getCommands: vi.fn(() => [])
    },
    textFileService: {
      openDefault: vi.fn(() => activeModel),
      onDidChangeModel: vi.fn(),
      getActiveModel: vi.fn(() => activeModel),
      updateContent: vi.fn(),
      newUntitled: vi.fn(() => activeModel),
      openFile: vi.fn(async () => activeModel),
      save: vi.fn(async () => activeModel),
      saveAs: vi.fn(async () => activeModel)
    },
    configurationService: {
      onDidChangeConfiguration: vi.fn(),
      getValue: vi.fn(() => defaultConfiguration),
      updateValue: vi.fn()
    },
    exportService: {
      registerProvider: vi.fn(),
      exportDocument: vi.fn(),
      exportAndSave: vi.fn()
    },
    fileService: {
      isAvailable: vi.fn(() => true),
      openWorkspace: vi.fn(async () => undefined),
      openRecentWorkspace: vi.fn(async () => undefined),
      refreshWorkspace: vi.fn(async () => undefined),
      openFile: vi.fn(),
      save: vi.fn(),
      saveAs: vi.fn(),
      onDidChangeWorkspaceFiles: vi.fn()
    },
    recentService: {
      onDidChangeRecents: vi.fn(),
      getRecents: vi.fn(() => []),
      addRecentFile: vi.fn(),
      addRecentWorkspace: vi.fn()
    },
    remoteSyncService: {
      onDidChangeRemoteSyncProviders: vi.fn(),
      registerProvider: vi.fn(),
      getProviders: vi.fn(() => options.remoteSyncProviders ?? []),
      createPlan: vi.fn(async () => ({
        operations: [{
          kind: "create",
          target: "remote",
          relativePath: "A.md",
          localUri: URI.file("C:/Notes/A.md")
        }],
        summary: {
          creates: 1,
          updates: 0,
          deletes: 0,
          skips: 0,
          conflicts: 0
        }
      })),
      executePlan: vi.fn()
    },
    indexService: {
      onDidChangeStatus: vi.fn(),
      configure: vi.fn(),
      getStatus: vi.fn(() => indexStatus("ready")),
      indexWorkspace: vi.fn(),
      indexFile: vi.fn(),
      query: vi.fn(() => []),
      getMetadata: vi.fn(),
      getTags: vi.fn(() => []),
      getTaggedResources: vi.fn(() => []),
      getBacklinks: vi.fn(() => []),
      clear: vi.fn()
    },
    workspaceService: {
      onDidChangeWorkspace: vi.fn(),
      getWorkspace: vi.fn(() => ({
        name: workspaceFiles?.root.name ?? "Typora Plus",
        ...(workspaceFiles ? { rootUri: workspaceFiles.root.uri, files: workspaceFiles } : {})
      })),
      setWorkspace: vi.fn()
    },
    attachmentService: {
      configure: vi.fn(),
      isAvailable: vi.fn(() => false),
      saveImage: vi.fn()
    },
    contextKeyService: {
      setValue: vi.fn(),
      getValue: vi.fn(),
      match: vi.fn()
    },
    extensionHostService: {
      registerHost: vi.fn(),
      activate: vi.fn()
    },
    extensionService: {
      registerExtension: vi.fn(),
      activateByEvent: vi.fn(),
      getExtensionStatus: vi.fn()
    },
    keybindingService: {
      registerKeybinding: vi.fn(),
      setUserKeybindings: vi.fn(),
      resolve: vi.fn(),
      dispatch: vi.fn(),
      getKeybindings: vi.fn(() => []),
      getKeybindingLabel: vi.fn(),
      getKeybindingLabelForKeybinding: vi.fn(),
      getCommandForKeybinding: vi.fn()
    },
    markdownRendererService: {
      onDidChangeMarkdownRenderers: vi.fn(),
      registerRendererContribution: vi.fn(),
      registerRendererProvider: vi.fn(),
      render: vi.fn(),
      getRenderers: vi.fn(() => [])
    },
    menuService: {
      onDidChangeMenu: vi.fn(),
      registerMenuItem: vi.fn(),
      getMenuItems: vi.fn(() => [])
    },
    themeService: {
      onDidChangeThemes: vi.fn(),
      registerTheme: vi.fn(),
      getThemes: vi.fn(() => []),
      getTheme: vi.fn()
    },
    resourceService: {
      isAvailable: vi.fn(),
      resolveImageSource: vi.fn()
    },
    serviceCollection: {
      set: vi.fn(),
      get: vi.fn(),
      has: vi.fn()
    }
  } as unknown as WorkbenchServices;
}

function indexStatus(state: WorkspaceIndexStatus["state"]): WorkspaceIndexStatus {
  return {
    state,
    indexedFiles: 0,
    totalFiles: 0,
    skippedFiles: 0,
    updatedAt: 1
  };
}

function callbacks(
  overrides: Partial<WorkbenchCommandRegistrationCallbacks> = {}
): WorkbenchCommandRegistrationCallbacks {
  return {
    getEditorHandle: vi.fn(() => null),
    setAiResponse: vi.fn(),
    setOperationError: vi.fn(),
    setPaletteOpen: vi.fn(),
    setQuickOpen: vi.fn(),
    setRemoteSyncPlan: vi.fn(),
    setSaveConflict: vi.fn(),
    setSettingsOpen: vi.fn(),
    setSideView: vi.fn(),
    ...overrides
  };
}

function state(overrides: {
  readonly configuration?: {
    readonly appearance?: Partial<typeof defaultConfiguration.appearance>;
    readonly editor?: Partial<typeof defaultConfiguration.editor>;
  };
  readonly workspaceFiles?: WorkspaceFileTree;
} = {}) {
  return {
    configuration: {
      ...defaultConfiguration,
      appearance: {
        ...defaultConfiguration.appearance,
        ...overrides.configuration?.appearance
      },
      editor: {
        ...defaultConfiguration.editor,
        ...overrides.configuration?.editor
      }
    },
    workspaceFiles: overrides.workspaceFiles
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

function createWorkspaceFileTree(): WorkspaceFileTree {
  return {
    root: {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: ".",
      kind: "directory",
      children: [{
        uri: URI.file("C:/Notes/A.md"),
        name: "A.md",
        relativePath: "A.md",
        kind: "file"
      }]
    },
    files: [{
      uri: URI.file("C:/Notes/A.md"),
      name: "A.md",
      relativePath: "A.md",
      kind: "file"
    }]
  };
}
