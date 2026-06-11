import { DisposableStore, type IDisposable } from "@typora-plus/base";
import type {
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
import { workbenchCommandIds } from "./workbenchCommandIds";
import { editorTaskCommandMetadata } from "./workbenchContributions";
import {
  saveWorkbenchFile,
  saveWorkbenchFileAs
} from "./workbenchFileSaving";
import {
  openWorkbenchWorkspace,
  refreshWorkbenchWorkspace
} from "./workbenchWorkspaceOpening";
import {
  toggleWorkbenchSideView,
  workbenchFilesSideView,
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
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setPaletteOpen: (open: boolean) => void;
  readonly setQuickOpen: (open: boolean) => void;
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
    id: workbenchCommandIds.file.newUntitled,
    title: "New Note",
    category: "File",
    run: () => {
      callbacks.setSaveConflict(undefined);
      return services.textFileService.newUntitled();
    }
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.file.openWorkspace,
    title: "Open Workspace",
    category: "File",
    run: () => runWorkbenchAction(async () => {
      await openWorkbenchWorkspace(services, {
        didOpenWorkspace: () => callbacks.setSideView(workbenchFilesSideView),
        clearSaveConflict: () => callbacks.setSaveConflict(undefined)
      });
    }, callbacks.setOperationError, callbacks.setSaveConflict)
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.file.refreshWorkspace,
    title: "Refresh Workspace",
    category: "File",
    run: () => runWorkbenchAction(
      () => refreshWorkbenchWorkspace(services),
      callbacks.setOperationError,
      callbacks.setSaveConflict
    )
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.quickOpen,
    title: "Quick Open",
    category: "Workbench",
    run: () => callbacks.setQuickOpen(true)
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.commandPaletteOpen,
    title: "Command Palette",
    category: "Workbench",
    run: () => callbacks.setPaletteOpen(true)
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.settingsOpen,
    title: "Settings",
    category: "Workbench",
    run: () => callbacks.setSettingsOpen(true)
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.sidebarFiles,
    title: "Show Files",
    category: "Workbench",
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView(workbenchFilesSideView, activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.sidebarSearch,
    title: "Show Search",
    category: "Workbench",
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView("search", activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.sidebarOutline,
    title: "Show Outline",
    category: "Workbench",
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView("outline", activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.sidebarBacklinks,
    title: "Show Backlinks",
    category: "Workbench",
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView("backlinks", activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.workbench.sidebarTags,
    title: "Show Tags",
    category: "Workbench",
    run: () => callbacks.setSideView((activeView) => toggleWorkbenchSideView("tags", activeView))
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.file.save,
    title: "Save",
    category: "File",
    run: () => runWorkbenchAction(
      () => saveWorkbenchFile(services, state.workspaceFiles),
      callbacks.setOperationError,
      callbacks.setSaveConflict
    )
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.file.saveAs,
    title: "Save As",
    category: "File",
    run: () => runWorkbenchAction(
      () => saveWorkbenchFileAs(services, state.workspaceFiles),
      callbacks.setOperationError,
      callbacks.setSaveConflict
    )
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.file.exportHtml,
    title: "Export HTML",
    category: "File",
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
    id: workbenchCommandIds.editor.focusModeToggle,
    title: "Toggle Focus Mode",
    category: "Editor",
    run: () => services.configurationService.updateValue({
      editor: {
        focusMode: !state.configuration.editor.focusMode
      }
    })
  }));
  disposables.add(services.commandService.registerCommand({
    id: workbenchCommandIds.editor.typewriterModeToggle,
    title: "Toggle Typewriter Mode",
    category: "Editor",
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
    id: workbenchCommandIds.theme.toggle,
    title: "Toggle Theme",
    category: "Workbench",
    run: () => services.configurationService.updateValue({
      appearance: {
        colorScheme: state.configuration.appearance.colorScheme === "dark" ? "light" : "dark"
      }
    })
  }));

  return disposables;
}
