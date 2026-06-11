import { DisposableStore, type IDisposable } from "@typora-plus/base";
import type {
  AiTextResponse,
  FileSaveConflict,
  TyporaPlusConfiguration,
  WorkspaceState
} from "@typora-plus/platform";
import type { MarkdownEditorHandle } from "@typora-plus/editor";
import type { WorkbenchServices } from "./services";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter,
  type WorkbenchSaveConflictSetter
} from "./workbenchActionRunner";
import {
  editorTaskCommandMetadata,
  workbenchCommandMetadata
} from "./workbenchCommandMetadata";
import { runWorkbenchSummarizeActiveNoteAiAction } from "./workbenchAiActions";
import {
  runWorkbenchPlanWorkspaceRemoteSyncAction,
  type WorkbenchRemoteSyncPlanResult
} from "./workbenchRemoteSyncActions";
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

export interface WorkbenchCommandRegistrationState {
  readonly configuration: TyporaPlusConfiguration;
  readonly workspaceFiles: WorkspaceState["files"];
}

export interface WorkbenchCommandRegistrationCallbacks {
  readonly getEditorHandle: () => Pick<
    MarkdownEditorHandle,
    "removeTaskListMarkers" | "toggleTaskListLines"
  > | null;
  readonly setAiResponse: (response: AiTextResponse | undefined) => void;
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

export function registerWorkbenchCommands(
  services: WorkbenchServices,
  state: WorkbenchCommandRegistrationState,
  callbacks: WorkbenchCommandRegistrationCallbacks
): IDisposable {
  const disposables = new DisposableStore();

  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.newUntitled,
    run: () => {
      callbacks.setSaveConflict(undefined);
      return services.textFileService.newUntitled();
    }
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.openWorkspace,
    run: () => runWorkbenchAction(async () => {
      await openWorkbenchWorkspace(services, {
        didOpenWorkspace: () => callbacks.setSideView(workbenchFilesSideView),
        clearSaveConflict: () => callbacks.setSaveConflict(undefined)
      });
    }, callbacks.setOperationError, callbacks.setSaveConflict)
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.refreshWorkspace,
    run: () => runWorkbenchAction(
      () => refreshWorkbenchWorkspace(services),
      callbacks.setOperationError,
      callbacks.setSaveConflict
    )
  }));
  if (selectWorkbenchDefaultAiProviderId(services)) {
    disposables.add(services.commandService.registerCommand({
      ...workbenchCommandMetadata.ai.summarizeActiveNote,
      run: () => runWorkbenchAction(async () => {
        const response = await runWorkbenchSummarizeActiveNoteAiAction(services, {
          metadata: {
            surface: "command"
          },
          workspaceContext: {
            maxPreviewLength: state.configuration.ai.workspaceContextMaxPreviewLength,
            maxResults: state.configuration.ai.workspaceContextMaxResults
          }
        });
        callbacks.setAiResponse(response);
      }, callbacks.setOperationError, callbacks.setSaveConflict)
    }));
  }
  if (state.workspaceFiles && selectWorkbenchDefaultRemoteSyncProviderId(services)) {
    disposables.add(services.commandService.registerCommand({
      ...workbenchCommandMetadata.remoteSync.planWorkspace,
      run: () => runWorkbenchAction(async () => {
        const result = await runWorkbenchPlanWorkspaceRemoteSyncAction(services, {
          metadata: {
            surface: "command"
          }
        });
        callbacks.setRemoteSyncPlan(result);
      }, callbacks.setOperationError, callbacks.setSaveConflict)
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
    run: () => runWorkbenchAction(
      () => saveWorkbenchFile(services, state.workspaceFiles),
      callbacks.setOperationError,
      callbacks.setSaveConflict
    )
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.saveAs,
    run: () => runWorkbenchAction(
      () => saveWorkbenchFileAs(services, state.workspaceFiles),
      callbacks.setOperationError,
      callbacks.setSaveConflict
    )
  }));
  disposables.add(services.commandService.registerCommand({
    ...workbenchCommandMetadata.file.exportHtml,
    run: () => runWorkbenchAction(async () => {
      const activeModel = services.textFileService.getActiveModel();

      await services.exportService.exportAndSave({
        uri: activeModel.uri,
        name: activeModel.name,
        value: activeModel.value
      }, "html");
    }, callbacks.setOperationError, callbacks.setSaveConflict)
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
    run: () => services.configurationService.updateValue({
      appearance: {
        colorScheme: state.configuration.appearance.colorScheme === "dark" ? "light" : "dark"
      }
    })
  }));

  return disposables;
}
