import { DisposableStore, type IDisposable } from "@typora-plus/base";
import type {
  FileTreeEntry,
  FileSaveConflict,
  RemoteSyncFolderBindingConfiguration,
  TyporaPlusConfiguration,
  WorkspaceState
} from "@typora-plus/platform";
import type { MarkdownEditorHandle } from "@typora-plus/editor";
import type { WorkbenchServices } from "./services";
import {
  runWorkbenchAction,
  type WorkbenchActionRunnerMessages,
  type WorkbenchOperationErrorSetter,
  type WorkbenchSaveConflictSetter
} from "./workbenchActionRunner";
import {
  editorTaskCommandMetadata,
  workbenchCommandMetadata
} from "./workbenchCommandMetadata";
import { runWorkbenchActiveNoteAiAction } from "./workbenchAiActions";
import type { WorkbenchAiActionMessages } from "./workbenchAiActions";
import type { WorkbenchAiWorkspaceContextMessages } from "./workbenchAiWorkspaceContext";
import {
  workbenchAiRequestActions,
  type WorkbenchAiRequestMessages,
  type WorkbenchAiRequestAction
} from "./workbenchAiRequestModel";
import {
  createWorkbenchAiResponse,
  type WorkbenchExtractedTaskMessages,
  type WorkbenchAiResponse
} from "./workbenchAiResponseModel";
import {
  runWorkbenchPlanFolderRemoteSyncAction,
  runWorkbenchPlanWorkspaceRemoteSyncAction,
  type WorkbenchRemoteSyncActionMessages,
  type WorkbenchRemoteSyncPlanResult
} from "./workbenchRemoteSyncActions";
import type { WorkbenchRemoteSyncMarkdownAssetMessages } from "./workbenchRemoteSyncMarkdownAssets";
import type { WorkbenchRemoteSyncRequestMessages } from "./workbenchRemoteSyncRequestModel";
import {
  saveWorkbenchFile,
  saveWorkbenchFileAs
} from "./workbenchFileSaving";
import {
  selectWorkbenchDefaultAiProviderId,
  selectWorkbenchDefaultRemoteSyncProviderId
} from "./workbenchProviderSelection";
import {
  openWorkbenchWorkspace,
  refreshWorkbenchWorkspace
} from "./workbenchWorkspaceOpening";
import {
  toggleWorkbenchSideView,
  workbenchFilesSideView,
  workbenchSideViews,
  type WorkbenchSideView
} from "./workbenchSideViewModel";

const workbenchActiveNoteAiCommandActions: readonly {
  readonly action: WorkbenchAiRequestAction;
  readonly metadata: typeof workbenchCommandMetadata.ai[keyof typeof workbenchCommandMetadata.ai];
}[] = [
  {
    action: workbenchAiRequestActions.continueActiveNote,
    metadata: workbenchCommandMetadata.ai.continueActiveNote
  },
  {
    action: workbenchAiRequestActions.extractTasksActiveNote,
    metadata: workbenchCommandMetadata.ai.extractTasksActiveNote
  },
  {
    action: workbenchAiRequestActions.rewriteActiveNote,
    metadata: workbenchCommandMetadata.ai.rewriteActiveNote
  },
  {
    action: workbenchAiRequestActions.summarizeActiveNote,
    metadata: workbenchCommandMetadata.ai.summarizeActiveNote
  }
];

export interface WorkbenchCommandRegistrationState {
  readonly actionRunnerMessages?: WorkbenchActionRunnerMessages;
  readonly aiActionMessages?: WorkbenchAiActionMessages;
  readonly aiRequestMessages?: WorkbenchAiRequestMessages;
  readonly aiResponseMessages?: WorkbenchExtractedTaskMessages;
  readonly aiWorkspaceContextMessages?: WorkbenchAiWorkspaceContextMessages;
  readonly configuration: TyporaPlusConfiguration;
  readonly remoteSyncActionMessages?: WorkbenchRemoteSyncActionMessages;
  readonly remoteSyncMarkdownAssetMessages?: WorkbenchRemoteSyncMarkdownAssetMessages;
  readonly remoteSyncRequestMessages?: WorkbenchRemoteSyncRequestMessages;
  readonly workspaceFiles: WorkspaceState["files"];
}

export interface WorkbenchCommandRegistrationCallbacks {
  readonly getAppliedColorScheme: () => "light" | "dark" | undefined;
  readonly getEditorHandle: () => Pick<
    MarkdownEditorHandle,
    "removeTaskListMarkers" | "toggleTaskListLines"
  > | null;
  readonly setAiResponse: (response: WorkbenchAiResponse | undefined) => void;
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setPaletteOpen: (open: boolean) => void;
  readonly setQuickOpen: (open: boolean) => void;
  readonly setRemoteSyncPlan: (result: WorkbenchRemoteSyncPlanResult | undefined) => void;
  readonly setSaveConflict: WorkbenchSaveConflictSetter;
  readonly setSettingsOpen: (open: boolean) => void;
  readonly setSideView: (
    value: WorkbenchSideView | null | ((activeView: WorkbenchSideView | null) => WorkbenchSideView | null)
  ) => void;
}

export function resolveNextWorkbenchThemeToggleColorScheme(
  appliedColorScheme: "light" | "dark" | undefined,
  configuredColorScheme: TyporaPlusConfiguration["appearance"]["colorScheme"]
): "light" | "dark" {
  const activeColorScheme = appliedColorScheme
    ?? (configuredColorScheme === "dark" ? "dark" : "light");

  return activeColorScheme === "dark" ? "light" : "dark";
}

export function registerWorkbenchCommands(
  services: WorkbenchServices,
  state: WorkbenchCommandRegistrationState,
  callbacks: WorkbenchCommandRegistrationCallbacks
): IDisposable {
  const disposables = new DisposableStore();
  const runRegisteredAction = <T>(action: () => Promise<T> | T) =>
    runWorkbenchAction(
      action,
      callbacks.setOperationError,
      callbacks.setSaveConflict,
      state.actionRunnerMessages
    );

  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.newUntitled,
    run: () => {
      callbacks.setSaveConflict(undefined);
      return services.textFileService.newUntitled();
    }
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.openWorkspace,
    run: () => runRegisteredAction(async () => {
      await openWorkbenchWorkspace(services, {
        didOpenWorkspace: () => callbacks.setSideView(workbenchFilesSideView),
        clearSaveConflict: () => callbacks.setSaveConflict(undefined)
      });
    })
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.refreshWorkspace,
    run: () => runRegisteredAction(() => refreshWorkbenchWorkspace(services))
  }));
  if (selectWorkbenchDefaultAiProviderId(services)) {
    for (const command of workbenchActiveNoteAiCommandActions) {
      disposables.add(services.commandService.registerCommand({
        ...command.metadata,
        run: () => runRegisteredAction(async () => {
          const response = await runWorkbenchActiveNoteAiAction(services, command.action, {
            ...(state.aiActionMessages ? { actionMessages: state.aiActionMessages } : {}),
            metadata: {
              surface: "command"
            },
            ...(state.aiRequestMessages ? { requestMessages: state.aiRequestMessages } : {}),
            workspaceContext: {
              maxPreviewLength: state.configuration.ai.workspaceContextMaxPreviewLength,
              maxResults: state.configuration.ai.workspaceContextMaxResults,
              ...(state.aiWorkspaceContextMessages ? { messages: state.aiWorkspaceContextMessages } : {})
            }
          });
          callbacks.setAiResponse(createWorkbenchAiResponse(command.action, response, state.aiResponseMessages));
        })
      }));
    }
  }
  const workspaceFiles = state.workspaceFiles;

  if (workspaceFiles && selectWorkbenchDefaultRemoteSyncProviderId(services)) {
    disposables.add(services.commandService.registerCommand({
      ...workbenchCommandMetadata.remoteSync.planWorkspace,
      run: () => runRegisteredAction(async () => {
        const folderTarget = selectWorkbenchRemoteSyncCommandFolderTarget(
          state.configuration.remoteSync.folderBindings,
          workspaceFiles.root
        );
        const result = folderTarget
          ? await runWorkbenchPlanFolderRemoteSyncAction(services, {
            ...(state.remoteSyncActionMessages ? { actionMessages: state.remoteSyncActionMessages } : {}),
            binding: folderTarget.binding,
            includeDirectories: true,
            localFolder: folderTarget.entry,
            ...(state.remoteSyncMarkdownAssetMessages
              ? { markdownAssetMessages: state.remoteSyncMarkdownAssetMessages }
              : {}),
            metadata: {
              surface: "command"
            },
            ...(state.remoteSyncRequestMessages ? { requestMessages: state.remoteSyncRequestMessages } : {})
          })
          : await runWorkbenchPlanWorkspaceRemoteSyncAction(services, {
          ...(state.remoteSyncActionMessages ? { actionMessages: state.remoteSyncActionMessages } : {}),
          ...(state.remoteSyncMarkdownAssetMessages
            ? { markdownAssetMessages: state.remoteSyncMarkdownAssetMessages }
            : {}),
          metadata: {
            surface: "command"
          },
          ...(state.remoteSyncRequestMessages ? { requestMessages: state.remoteSyncRequestMessages } : {})
        });
        callbacks.setRemoteSyncPlan(result);
      })
    }));
  }
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.quickOpen,
    run: () => callbacks.setQuickOpen(true)
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.commandPaletteOpen,
    run: () => callbacks.setPaletteOpen(true)
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.settingsOpen,
    run: () => callbacks.setSettingsOpen(true)
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.sidebarFiles,
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView(workbenchFilesSideView, activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.sidebarSearch,
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView(workbenchSideViews.search, activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.sidebarOutline,
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView(workbenchSideViews.outline, activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.sidebarBacklinks,
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView(workbenchSideViews.backlinks, activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.workbench.sidebarTags,
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView(workbenchSideViews.tags, activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.save,
    run: () => runRegisteredAction(() => saveWorkbenchFile(services, state.workspaceFiles))
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.saveAs,
    run: () => runRegisteredAction(() => saveWorkbenchFileAs(services, state.workspaceFiles))
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.exportHtml,
    run: () => runRegisteredAction(async () => {
      const activeModel = services.textFileService.getActiveModel();

      await services.exportService.exportAndSave({
        uri: activeModel.uri,
        name: activeModel.name,
        value: activeModel.value
      }, "html");
    })
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.editor.focusModeToggle,
    run: () => services.configurationService.updateValue({
      editor: {
        focusMode: !state.configuration.editor.focusMode
      }
    })
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.editor.typewriterModeToggle,
    run: () => services.configurationService.updateValue({
      editor: {
        typewriterMode: !state.configuration.editor.typewriterMode
      }
    })
  }));
  disposables.add(services.commandService.registerCommand({
    ...editorTaskCommandMetadata.toggleTaskLines,
    run: () => callbacks.getEditorHandle()?.toggleTaskListLines() ?? false
  }));
  disposables.add(services.commandService.registerCommand({
    ...editorTaskCommandMetadata.removeTaskMarkers,
    run: () => callbacks.getEditorHandle()?.removeTaskListMarkers() ?? false
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.theme.toggle,
    run: () => {
      const colorScheme = resolveNextWorkbenchThemeToggleColorScheme(
        callbacks.getAppliedColorScheme(),
        state.configuration.appearance.colorScheme
      );

      return services.configurationService.updateValue({
        appearance: {
          colorScheme,
          themeId: undefined
        }
      });
    }
  }));

  return disposables;
}

interface WorkbenchRemoteSyncCommandFolderTarget {
  readonly binding: RemoteSyncFolderBindingConfiguration;
  readonly entry: FileTreeEntry;
}

export function selectWorkbenchRemoteSyncCommandFolderTarget(
  bindings: readonly RemoteSyncFolderBindingConfiguration[],
  root: FileTreeEntry
): WorkbenchRemoteSyncCommandFolderTarget | undefined {
  for (const binding of bindings) {
    const entry = findWorkbenchRemoteSyncCommandFileTreeEntry(root, binding.localUri);

    if (entry?.kind === "directory") {
      return { binding, entry };
    }
  }

  return undefined;
}

function findWorkbenchRemoteSyncCommandFileTreeEntry(
  entry: FileTreeEntry,
  uri: string
): FileTreeEntry | undefined {
  if (entry.uri.toString() === uri) {
    return entry;
  }

  for (const child of entry.children ?? []) {
    const match = findWorkbenchRemoteSyncCommandFileTreeEntry(child, uri);

    if (match) {
      return match;
    }
  }

  return undefined;
}
