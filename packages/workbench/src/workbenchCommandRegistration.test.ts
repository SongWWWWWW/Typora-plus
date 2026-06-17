import { URI } from "@typora-plus/base";
import {
  defaultConfiguration,
  type AiTextRequest,
  type Command,
  type RemoteSyncPlanRequest,
  type RemoteSyncWorkspaceResourceReadResult,
  type TextFileModel,
  type WorkspaceFileTree,
  type WorkspaceState,
  type WorkspaceIndexStatus,
  type WorkspaceSearchResult
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  registerWorkbenchCommands,
  resolveNextWorkbenchThemeToggleColorScheme,
  selectWorkbenchRemoteSyncCommandFolderTarget,
  type WorkbenchCommandRegistrationCallbacks
} from "./workbenchCommandRegistration";
import type { WorkbenchActionRunnerMessages } from "./workbenchActionRunner";
import type { WorkbenchServices } from "./services";
import { workbenchCommandIds } from "./workbenchCommandIds";
import type { WorkbenchSideView } from "./workbenchSideViewModel";
import type { WorkbenchAiActionMessages } from "./workbenchAiActions";
import type { WorkbenchExtractedTaskMessages } from "./workbenchAiResponseModel";
import type { WorkbenchAiWorkspaceContextMessages } from "./workbenchAiWorkspaceContext";
import type { WorkbenchRemoteSyncActionMessages } from "./workbenchRemoteSyncActions";
import type { WorkbenchRemoteSyncMarkdownAssetMessages } from "./workbenchRemoteSyncMarkdownAssets";
import {
  workbenchAiInstructions,
  type WorkbenchAiRequestMessages
} from "./workbenchAiRequestModel";
import type { WorkbenchRemoteSyncRequestMessages } from "./workbenchRemoteSyncRequestModel";

describe("workbench command registration", () => {
  it("resolves theme toggle targets from the applied color scheme first", () => {
    expect(resolveNextWorkbenchThemeToggleColorScheme("dark", "system")).toBe("light");
    expect(resolveNextWorkbenchThemeToggleColorScheme("light", "system")).toBe("dark");
    expect(resolveNextWorkbenchThemeToggleColorScheme(undefined, "dark")).toBe("light");
    expect(resolveNextWorkbenchThemeToggleColorScheme(undefined, "light")).toBe("dark");
  });

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

  it("passes localized workspace context formatting to active-note AI requests", async () => {
    const registered = new Map<string, Command>();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI" }]
    });

    vi.mocked(services.indexService.query).mockReturnValue([
      searchResult("C:/Notes/related.md", "related.md", 7, "Related implementation detail")
    ]);

    registerWorkbenchCommands(services, state({
      aiWorkspaceContextMessages: zhWorkspaceContextMessages
    }), callbacks());

    await registered.get(workbenchCommandIds.ai.summarizeActiveNote)?.run({} as never);

    const request = vi.mocked(services.aiService.requestText).mock.calls[0]?.[1] as AiTextRequest;

    expect(request.context).toEqual([{
      kind: "workspace-search",
      title: "related.md:7",
      uri: URI.file("C:/Notes/related.md"),
      value: [
        "路径：related.md",
        "行：7",
        "Related implementation detail"
      ].join("\n")
    }]);
  });

  it("passes localized active-note request instructions to AI commands", async () => {
    const registered = new Map<string, Command>();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI" }]
    });
    const aiRequestMessages: WorkbenchAiRequestMessages = {
      instructions: {
        ...workbenchAiInstructions,
        summarizeActiveNote: "总结当前笔记，保留关键决定。"
      }
    };

    registerWorkbenchCommands(services, state({ aiRequestMessages }), callbacks());

    await registered.get(workbenchCommandIds.ai.summarizeActiveNote)?.run({} as never);

    const request = vi.mocked(services.aiService.requestText).mock.calls[0]?.[1] as AiTextRequest;

    expect(request.instruction).toBe("总结当前笔记，保留关键决定。");
    expect(request.metadata).toMatchObject({
      surface: "command",
      action: "summarizeActiveNote",
      source: "active-note"
    });
  });

  it("passes localized active-note action errors to AI commands", async () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI" }]
    });

    vi.mocked(services.aiService.getProviders)
      .mockReturnValueOnce([{ id: "openai.responses", title: "OpenAI" }])
      .mockReturnValueOnce([]);

    registerWorkbenchCommands(services, state({
      aiActionMessages: zhAiActionMessages
    }), testCallbacks);

    await registered.get(workbenchCommandIds.ai.summarizeActiveNote)?.run({} as never);

    expect(testCallbacks.setOperationError).toHaveBeenLastCalledWith("没有可用于总结当前笔记的 AI 服务商");
    expect(testCallbacks.setAiResponse).not.toHaveBeenCalled();
  });

  it("surfaces malformed structured task extraction responses as operation errors", async () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI Responses" }],
      aiResponseValue: "not json"
    });

    registerWorkbenchCommands(services, state(), testCallbacks);

    await registered.get(workbenchCommandIds.ai.extractTasksActiveNote)?.run({} as never);

    expect(testCallbacks.setAiResponse).not.toHaveBeenCalled();
    expect(testCallbacks.setOperationError).toHaveBeenNthCalledWith(1, undefined);
    expect(testCallbacks.setOperationError)
      .toHaveBeenLastCalledWith("AI task extraction response must be valid JSON");
  });

  it("forwards localized structured task extraction validation errors through AI commands", async () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI Responses" }],
      aiResponseValue: "not json"
    });

    registerWorkbenchCommands(services, state({ aiResponseMessages: zhExtractedTaskMessages }), testCallbacks);

    await registered.get(workbenchCommandIds.ai.extractTasksActiveNote)?.run({} as never);

    expect(testCallbacks.setAiResponse).not.toHaveBeenCalled();
    expect(testCallbacks.setOperationError)
      .toHaveBeenLastCalledWith("AI 任务提取响应必须是有效 JSON");
  });

  it("forwards localized structured task field validation errors through AI commands", async () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI Responses" }],
      aiResponseValue: JSON.stringify({
        groups: [{
          topic: null,
          tasks: [{
            title: "Ship",
            owner: null,
            due: null,
            blocker: null,
            done: "no"
          }]
        }]
      })
    });

    registerWorkbenchCommands(services, state({ aiResponseMessages: zhExtractedTaskMessages }), testCallbacks);

    await registered.get(workbenchCommandIds.ai.extractTasksActiveNote)?.run({} as never);

    expect(testCallbacks.setAiResponse).not.toHaveBeenCalled();
    expect(testCallbacks.setOperationError)
      .toHaveBeenLastCalledWith("AI 任务提取任务 1 的完成状态必须是布尔值");
  });

  it("uses injected AI response messages for structured task extraction output", async () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      aiProviders: [{ id: "openai.responses", title: "OpenAI Responses" }],
      aiResponseValue: JSON.stringify({
        groups: [
          {
            topic: "发布",
            tasks: [
              {
                title: "确认同步计划",
                owner: "Maya",
                due: "周五",
                blocker: null,
                done: false
              }
            ]
          }
        ]
      })
    });

    registerWorkbenchCommands(services, state({ aiResponseMessages: zhExtractedTaskMessages }), testCallbacks);

    await registered.get(workbenchCommandIds.ai.extractTasksActiveNote)?.run({} as never);

    expect(testCallbacks.setAiResponse).toHaveBeenCalledWith(expect.objectContaining({
      action: "extractTasksActiveNote",
      response: {
        providerId: "openai.responses",
        value: [
          "### 发布",
          "- [ ] 确认同步计划 （负责人：Maya；截止：周五）"
        ].join("\n")
      }
    }));
  });

  it("uses injected action runner messages for command operation fallbacks", async () => {
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered);

    vi.mocked(services.exportService.exportAndSave).mockRejectedValueOnce("failed");

    registerWorkbenchCommands(services, state({
      actionRunnerMessages: zhActionRunnerMessages
    }), testCallbacks);

    await registered.get(workbenchCommandIds.file.exportHtml)?.run({} as never);

    expect(testCallbacks.setOperationError).toHaveBeenLastCalledWith("操作失败");
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

  it("plans the bound folder instead of the workspace root from the remote sync command", async () => {
    const workspaceFiles = createNestedWorkspaceFileTree();
    const binding = {
      id: "binding-typora-plus",
      localUri: URI.file("C:/Notes/Typora-plus").toString(),
      localRelativePath: "Typora-plus",
      localName: "Typora-plus",
      providerId: "feishu.raw",
      remoteScopeId: "remote-typora-plus",
      remoteName: "Typora Plus"
    };
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      remoteSyncProviders: [{ id: "feishu.raw", title: "Feishu Raw Mirror" }],
      workspaceFiles
    });

    registerWorkbenchCommands(services, state({
      configuration: {
        remoteSync: {
          folderBindings: [binding]
        }
      },
      workspaceFiles
    }), testCallbacks);

    await registered.get(workbenchCommandIds.remoteSync.planWorkspace)?.run({} as never);

    expect(services.remoteSyncService.createPlan).toHaveBeenCalledOnce();
    expect(services.remoteSyncService.createPlan).toHaveBeenCalledWith("feishu.raw", {
      workspaceUri: URI.file("C:/Notes/Typora-plus"),
      resources: [
        {
          uri: URI.file("C:/Notes/Typora-plus/bbb"),
          relativePath: "bbb",
          kind: "directory",
          name: "bbb"
        },
        {
          uri: URI.file("C:/Notes/Typora-plus/bbb/bbb.md"),
          relativePath: "bbb/bbb.md",
          kind: "file",
          name: "bbb.md"
        }
      ],
      direction: "push",
      dryRun: true,
      remoteScopeId: "remote-typora-plus",
      metadata: {
        surface: "command",
        action: "planWorkspace",
        source: "folder",
        providerId: "feishu.raw",
        workspaceName: "Notes",
        workspaceScheme: "file",
        localFolderName: "Typora-plus",
        localFolderPath: "Typora-plus"
      }
    });
  });

  it("selects only existing directory folder bindings for the remote sync command", () => {
    const workspaceFiles = createNestedWorkspaceFileTree();

    expect(selectWorkbenchRemoteSyncCommandFolderTarget([{
      id: "missing",
      localUri: URI.file("C:/Notes/Missing").toString(),
      localRelativePath: "Missing",
      localName: "Missing",
      providerId: "feishu.raw",
      remoteScopeId: "remote-missing",
      remoteName: "Missing"
    }, {
      id: "file",
      localUri: URI.file("C:/Notes/Loose.md").toString(),
      localRelativePath: "Loose.md",
      localName: "Loose.md",
      providerId: "feishu.raw",
      remoteScopeId: "remote-file",
      remoteName: "File"
    }, {
      id: "folder",
      localUri: URI.file("C:/Notes/Typora-plus").toString(),
      localRelativePath: "Typora-plus",
      localName: "Typora-plus",
      providerId: "feishu.raw",
      remoteScopeId: "remote-typora-plus",
      remoteName: "Typora Plus"
    }], workspaceFiles.root)).toMatchObject({
      binding: {
        id: "folder",
        remoteScopeId: "remote-typora-plus"
      },
      entry: {
        name: "Typora-plus",
        kind: "directory"
      }
    });
  });

  it("forwards localized remote sync action errors through registered commands", async () => {
    const workspaceFiles = createWorkspaceFileTree();
    const remoteSyncProviders = [{ id: "feishu.raw", title: "Feishu Raw Mirror" }];
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      remoteSyncProviders,
      workspaceFiles
    });

    registerWorkbenchCommands(services, state({
      remoteSyncActionMessages: localizedRemoteSyncActionMessages,
      remoteSyncRequestMessages: localizedRemoteSyncRequestMessages,
      workspaceFiles
    }), testCallbacks);

    remoteSyncProviders.length = 0;

    await registered.get(workbenchCommandIds.remoteSync.planWorkspace)?.run({} as never);

    expect(testCallbacks.setOperationError).toHaveBeenLastCalledWith("Localized sync provider unavailable");
    expect(services.remoteSyncService.createPlan).not.toHaveBeenCalled();
  });

  it("forwards localized remote sync request errors through registered commands", async () => {
    const workspaceFiles = createWorkspaceFileTree();
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      remoteSyncProviders: [{ id: "feishu.raw", title: "Feishu Raw Mirror" }],
      workspace: {
        name: "Typora Plus"
      },
      workspaceFiles
    });

    registerWorkbenchCommands(services, state({
      remoteSyncActionMessages: localizedRemoteSyncActionMessages,
      remoteSyncRequestMessages: localizedRemoteSyncRequestMessages,
      workspaceFiles
    }), testCallbacks);

    await registered.get(workbenchCommandIds.remoteSync.planWorkspace)?.run({} as never);

    expect(testCallbacks.setOperationError).toHaveBeenLastCalledWith("Localized missing workspace");
    expect(services.remoteSyncService.createPlan).not.toHaveBeenCalled();
  });

  it("forwards localized remote sync Markdown asset errors through registered commands", async () => {
    const workspaceFiles = createWorkspaceFileTree();
    const registered = new Map<string, Command>();
    const testCallbacks = callbacks();
    const services = createServices(registered, [], {
      remoteSyncProviders: [{ id: "feishu.raw", title: "Feishu Raw Mirror" }],
      remoteSyncReadResource: async () => ({
        workspaceUri: URI.file("C:/Notes"),
        relativePath: "A.md",
        value: "!!!!",
        encoding: "base64",
        size: 4
      }),
      workspaceFiles
    });

    registerWorkbenchCommands(services, state({
      remoteSyncMarkdownAssetMessages: localizedMarkdownAssetMessages,
      workspaceFiles
    }), testCallbacks);

    await registered.get(workbenchCommandIds.remoteSync.planWorkspace)?.run({} as never);

    expect(testCallbacks.setOperationError).toHaveBeenLastCalledWith("Localized valid base64 required");
    expect(services.remoteSyncService.createPlan).not.toHaveBeenCalled();
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
        colorScheme: "light",
        themeId: undefined
      }
    });
    expect(editorHandle.toggleTaskListLines).toHaveBeenCalledOnce();
    expect(editorHandle.removeTaskListMarkers).toHaveBeenCalledOnce();
  });

  it("toggles theme from the applied system result and clears custom theme overrides", () => {
    const registered = new Map<string, Command>();
    const services = createServices(registered);
    const testCallbacks = callbacks({
      getAppliedColorScheme: () => "dark"
    });

    registerWorkbenchCommands(services, state({
      configuration: {
        appearance: {
          colorScheme: "system",
          themeId: "typora-plus.theme.ink"
        }
      }
    }), testCallbacks);

    registered.get(workbenchCommandIds.theme.toggle)?.run({} as never);

    expect(services.configurationService.updateValue).toHaveBeenCalledWith({
      appearance: {
        colorScheme: "light",
        themeId: undefined
      }
    });
  });
});

function createServices(
  registered: Map<string, Command>,
  disposeCalls: string[] = [],
  options: {
    readonly aiProviders?: readonly { readonly id: string; readonly title: string }[];
    readonly aiResponseValue?: string;
    readonly remoteSyncProviders?: readonly { readonly id: string; readonly title: string }[];
    readonly remoteSyncReadResource?: (
      request: { readonly relativePath: string }
    ) => Promise<RemoteSyncWorkspaceResourceReadResult>;
    readonly workspace?: WorkspaceState;
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
        value: options.aiResponseValue ?? "Summary"
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
    remoteSyncWorkspaceResourceService: {
      isAvailable: vi.fn(() => !!options.remoteSyncReadResource),
      readResource: vi.fn(options.remoteSyncReadResource ?? (async () => {
        throw new Error("remote sync workspace resource bridge unavailable");
      })),
      writeResource: vi.fn(),
      deleteResource: vi.fn()
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
      getWorkspace: vi.fn(() => options.workspace ?? {
        name: workspaceFiles?.root.name ?? "Typora Plus",
        ...(workspaceFiles ? { rootUri: workspaceFiles.root.uri, files: workspaceFiles } : {})
      }),
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
    getAppliedColorScheme: vi.fn(() => undefined),
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
  readonly actionRunnerMessages?: WorkbenchActionRunnerMessages;
  readonly aiActionMessages?: WorkbenchAiActionMessages;
  readonly aiRequestMessages?: WorkbenchAiRequestMessages;
  readonly aiResponseMessages?: WorkbenchExtractedTaskMessages;
  readonly aiWorkspaceContextMessages?: WorkbenchAiWorkspaceContextMessages;
  readonly configuration?: {
    readonly appearance?: Partial<typeof defaultConfiguration.appearance>;
    readonly editor?: Partial<typeof defaultConfiguration.editor>;
    readonly remoteSync?: Partial<typeof defaultConfiguration.remoteSync>;
  };
  readonly remoteSyncActionMessages?: WorkbenchRemoteSyncActionMessages;
  readonly remoteSyncMarkdownAssetMessages?: WorkbenchRemoteSyncMarkdownAssetMessages;
  readonly remoteSyncRequestMessages?: WorkbenchRemoteSyncRequestMessages;
  readonly workspaceFiles?: WorkspaceFileTree;
} = {}) {
  return {
    ...(overrides.actionRunnerMessages ? { actionRunnerMessages: overrides.actionRunnerMessages } : {}),
    ...(overrides.aiActionMessages ? { aiActionMessages: overrides.aiActionMessages } : {}),
    ...(overrides.aiRequestMessages ? { aiRequestMessages: overrides.aiRequestMessages } : {}),
    ...(overrides.aiResponseMessages ? { aiResponseMessages: overrides.aiResponseMessages } : {}),
    ...(overrides.aiWorkspaceContextMessages ? { aiWorkspaceContextMessages: overrides.aiWorkspaceContextMessages } : {}),
    ...(overrides.remoteSyncActionMessages ? { remoteSyncActionMessages: overrides.remoteSyncActionMessages } : {}),
    ...(overrides.remoteSyncMarkdownAssetMessages
      ? { remoteSyncMarkdownAssetMessages: overrides.remoteSyncMarkdownAssetMessages }
      : {}),
    ...(overrides.remoteSyncRequestMessages ? { remoteSyncRequestMessages: overrides.remoteSyncRequestMessages } : {}),
    configuration: {
      ...defaultConfiguration,
      appearance: {
        ...defaultConfiguration.appearance,
        ...overrides.configuration?.appearance
      },
      editor: {
        ...defaultConfiguration.editor,
        ...overrides.configuration?.editor
      },
      remoteSync: {
        ...defaultConfiguration.remoteSync,
        ...overrides.configuration?.remoteSync
      }
    },
    workspaceFiles: overrides.workspaceFiles
  };
}

const zhExtractedTaskMessages: WorkbenchExtractedTaskMessages = {
  detailLabels: {
    owner: "负责人",
    due: "截止",
    blocker: "阻塞"
  },
  detail: (label, value) => `${label}：${value}`,
  detailList: (details) => details.length > 0 ? ` （${details.join("；")}）` : "",
  noActionableTasksFound: "没有找到可执行任务。",
  validation: {
    labels: {
      response: "AI 任务提取响应",
      responseGroups: "AI 任务提取响应分组",
      group: (index) => `AI 任务提取分组 ${index + 1}`,
      groupTasks: (index) => `AI 任务提取分组 ${index + 1} 的任务`,
      groupTopic: (index) => `AI 任务提取分组 ${index + 1} 的主题`,
      task: (index) => `AI 任务提取任务 ${index + 1}`,
      taskBlocker: (index) => `AI 任务提取任务 ${index + 1} 的阻塞项`,
      taskDone: (index) => `AI 任务提取任务 ${index + 1} 的完成状态`,
      taskDue: (index) => `AI 任务提取任务 ${index + 1} 的截止时间`,
      taskOwner: (index) => `AI 任务提取任务 ${index + 1} 的负责人`,
      taskTitle: (index) => `AI 任务提取任务 ${index + 1} 的标题`
    },
    mustBeArray: (label) => `${label}必须是数组`,
    mustBeBoolean: (label) => `${label}必须是布尔值`,
    mustBeObject: (label) => `${label}必须是对象`,
    mustBeString: (label) => `${label}必须是字符串`,
    mustBeValidJson: "AI 任务提取响应必须是有效 JSON",
    mustContainAtMostItems: (label, maxItems) => `${label}最多只能包含 ${maxItems} 项`,
    mustContainAtMostCharacters: (label, maxLength) => `${label}最多只能包含 ${maxLength} 个字符`
  }
};

const zhWorkspaceContextMessages: WorkbenchAiWorkspaceContextMessages = {
  detailList: (details) => details.join("\n"),
  line: (line) => `行：${line}`,
  path: (relativePath) => `路径：${relativePath}`
};

const zhActionRunnerMessages: WorkbenchActionRunnerMessages = {
  fileChangedOnDisk: "磁盘上的文件已变更",
  operationFailed: "操作失败"
};

const zhAiActionMessages: WorkbenchAiActionMessages = {
  noProviderAvailable: (actionTitle) => `没有可用于${actionTitle}的 AI 服务商`,
  titles: {
    continueActiveNote: "续写当前笔记",
    extractTasksActiveNote: "从当前笔记提取任务",
    rewriteActiveNote: "重写当前笔记",
    summarizeActiveNote: "总结当前笔记"
  }
};

const localizedRemoteSyncActionMessages: WorkbenchRemoteSyncActionMessages = {
  conflictResolutionMessages: {
    useLocal: "Localized use local",
    useRemote: "Localized use remote"
  },
  executionBlockReasons: {
    conflicts: "Localized resolve conflicts",
    empty: "Localized no changes"
  },
  noProviderAvailable: "Localized sync provider unavailable"
};

const localizedRemoteSyncRequestMessages: WorkbenchRemoteSyncRequestMessages = {
  noWorkspaceOpen: "Localized missing workspace"
};

const localizedMarkdownAssetMessages: WorkbenchRemoteSyncMarkdownAssetMessages = {
  aborted: "Localized asset discovery aborted",
  contentEncodingInvalid: "Localized valid base64 required",
  contentEncodingRequired: "Localized base64 required"
};

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

function searchResult(
  path: string,
  relativePath: string,
  line: number,
  preview: string
): WorkspaceSearchResult {
  return {
    uri: URI.file(path),
    name: path.split("/").at(-1) ?? relativePath,
    relativePath,
    line,
    preview,
    score: 10
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

function createNestedWorkspaceFileTree(): WorkspaceFileTree {
  const looseFile = {
    uri: URI.file("C:/Notes/Loose.md"),
    name: "Loose.md",
    relativePath: "Loose.md",
    kind: "file" as const
  };
  const nestedFile = {
    uri: URI.file("C:/Notes/Typora-plus/bbb/bbb.md"),
    name: "bbb.md",
    relativePath: "Typora-plus/bbb/bbb.md",
    kind: "file" as const
  };
  const nestedFolder = {
    uri: URI.file("C:/Notes/Typora-plus/bbb"),
    name: "bbb",
    relativePath: "Typora-plus/bbb",
    kind: "directory" as const,
    children: [nestedFile]
  };
  const boundFolder = {
    uri: URI.file("C:/Notes/Typora-plus"),
    name: "Typora-plus",
    relativePath: "Typora-plus",
    kind: "directory" as const,
    children: [nestedFolder]
  };

  return {
    root: {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: ".",
      kind: "directory",
      children: [looseFile, boundFolder]
    },
    files: [looseFile, nestedFile]
  };
}
