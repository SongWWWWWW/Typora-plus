import { MarkdownEditor, type MarkdownEditorHandle } from "@typora-plus/editor";
import {
  calculateMarkdownStats,
  createMarkdownPreviewHtml,
  extractOutline,
  type OutlineEntry
} from "@typora-plus/markdown";
import type {
  FileSaveConflict,
  FileTreeEntry,
  MenuId,
  MenuItem,
  RecentResource,
  RemoteSyncFolderBindingConfiguration,
  RemoteSyncOperation,
  RemoteSyncProviderConfiguration,
  RemoteSyncProgress,
  TextFileModel,
  TyporaPlusConfiguration,
  WorkspaceIndexedLink,
  WorkspaceIndexedTag,
  WorkspaceIndexedTagSummary,
  WorkspaceIndexStatus,
  WorkspaceState
} from "@typora-plus/platform";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  Cloud,
  Command as CommandIcon,
  Copy,
  Eye,
  FilePlus,
  FileText,
  Folder,
  FolderPlus,
  FolderOpen,
  HardDrive,
  LoaderCircle,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import {
  createCommandPaletteExecutionCallbacks,
  createCommandPaletteExecuteHandler,
  filterCommandPaletteCommands
} from "./commandPaletteModel";
import {
  isListNavigationKey,
  moveListSelection,
  normalizeListSelection
} from "./listNavigationModel";
import { SettingsDialog } from "./SettingsDialog";
import type { WorkbenchServices } from "./services";
import { createWorkbenchCommandExecutor, runWorkbenchAction } from "./workbenchActionRunner";
import {
  createWorkbenchAutoSaveScheduler,
  scheduleWorkbenchAutoSave
} from "./workbenchAutoSave";
import { registerWorkbenchCommands } from "./workbenchCommandRegistration";
import { createWorkbenchCommandSurface } from "./workbenchCommandSurface";
import { copyWorkbenchTextToClipboard } from "./workbenchClipboard";
import {
  resolveWorkbenchRemoteSyncPlanConflicts,
  runWorkbenchExecuteWorkspaceRemoteSyncAction,
  runWorkbenchPlanFolderRemoteSyncAction,
  runWorkbenchPlanWorkspaceRemoteSyncAction,
  workbenchRemoteSyncConflictResolutions,
  type WorkbenchRemoteSyncConflictResolution,
  type WorkbenchRemoteSyncExecutionResult,
  type WorkbenchRemoteSyncPlanResult
} from "./workbenchRemoteSyncActions";
import {
  appendWorkbenchRemoteSyncProgressHistory,
  createWorkbenchRemoteSyncDialogConflictPreview,
  createWorkbenchRemoteSyncDialogConflictResolutionState,
  createWorkbenchRemoteSyncDialogProgressPreview,
  createWorkbenchRemoteSyncDialogOperationPreview,
  createWorkbenchRemoteSyncDialogExecutionState,
  formatWorkbenchRemoteSyncDirection,
  formatWorkbenchRemoteSyncOperationKind,
  formatWorkbenchRemoteSyncOperationDetail,
  formatWorkbenchRemoteSyncProgress,
  formatWorkbenchRemoteSyncSummary,
  getWorkbenchRemoteSyncLatestProgress
} from "./workbenchRemoteSyncDialogModel";
import {
  applyWorkbenchStateContext,
  createWorkbenchCapabilityContext
} from "./workbenchContextModel";
import { createWorkbenchConfigurationUpdateHandler } from "./workbenchConfigurationUpdates";
import { createWorkbenchEditorAdapter } from "./workbenchEditorAdapter";
import { applyWorkbenchAiResponseToActiveNote } from "./workbenchAiActions";
import {
  createWorkbenchAiResponseMetadata,
  type WorkbenchAiResponse,
  type WorkbenchAiResponseApplyState
} from "./workbenchAiResponseModel";
import { createWorkbenchAiProviderDiagnosticActions } from "./workbenchAiProviderDiagnostics";
import { createWorkbenchAiSecretActions } from "./workbenchAiSecrets";
import { createWorkbenchRemoteSyncSecretActions } from "./workbenchRemoteSyncSecrets";
import {
  createWorkbenchRemoteSyncLarkAuthActions,
  type WorkbenchRemoteSyncLarkAuthActions,
  type WorkbenchRemoteSyncLarkFolder
} from "./workbenchRemoteSyncLarkAuth";
import {
  defaultWorkbenchRemoteSyncAutoStatus,
  formatWorkbenchRemoteSyncAutoStatus,
  shouldShowWorkbenchRemoteSyncAutoStatus,
  type WorkbenchRemoteSyncAutoStatus
} from "./workbenchRemoteSyncAutoStatus";
import {
  createWorkbenchFileTreeRows,
  type WorkbenchFileTreeRow
} from "./workbenchFileTreeModel";
import {
  createWorkbenchInitialState,
  type WorkbenchInitialState
} from "./workbenchInitialState";
import {
  createWorkbenchSaveConflictActionCallbacks,
  createWorkbenchSaveConflictDialogActionHandlers
} from "./workbenchSaveConflictResolution";
import {
  createWorkbenchLineNavigationCallbacks,
  createWorkbenchLineNavigationEnvironment,
  createWorkbenchLineTargetOpenHandler,
  scrollWorkbenchLine
} from "./workbenchLineNavigation";
import {
  createWorkbenchKeybindingDispatchTarget,
  registerWorkbenchKeybindingDispatch
} from "./workbenchKeybindingDispatch";
import {
  createWorkbenchMenuContext,
  getWorkbenchMenuItems,
  isWorkbenchMenuItemActive,
  registerWorkbenchMenuItemsSubscription,
  workbenchMenuIds
} from "./workbenchMenuModel";
import { renderWorkbenchMenuIcon } from "./workbenchMenuIcons";
import {
  getWorkbenchBacklinks,
  getWorkbenchSearchResults,
  getWorkbenchTaggedResources,
  getWorkbenchTags
} from "./workbenchNavigationQueries";
import { filterQuickOpenFiles } from "./workbenchQuickOpenModel";
import {
  createWorkbenchRecentResourceRows,
  createWorkbenchRecentResourceSections
} from "./workbenchRecentResourcesModel";
import {
  backlinkKey,
  formatBacklinkPreview,
  isWorkspaceSearchResult,
  searchResultKey,
  tagResourceKey,
  type WorkbenchSearchResult
} from "./workbenchSearchResultsModel";
import {
  createWorkbenchFileResourceOpenHandler,
  createWorkbenchQuickOpenFileOpenHandler,
  createWorkbenchRecentWorkspaceResourceOpenHandler,
  createWorkbenchResourceOpeningCallbacks
} from "./workbenchResourceOpening";
import {
  createWorkbenchWorkspaceDirectoryWithDefaultName,
  createWorkbenchWorkspaceFileWithDefaultName,
  deleteWorkbenchWorkspaceEntry,
  renameWorkbenchWorkspaceEntry
} from "./workbenchWorkspaceCreation";
import { scheduleWorkbenchOverlayFocus } from "./workbenchOverlayFocus";
import { createWorkbenchWorkspaceIndexingHandler } from "./workbenchWorkspaceIndexing";
import {
  defaultWorkbenchSideView,
  workbenchSideViews,
  type WorkbenchSideView
} from "./workbenchSideViewModel";
import {
  createWorkbenchMessages,
  formatLocalizedWorkbenchAiResponseApplyLabel,
  formatWorkbenchAiResponseCopyLabel,
  localizeWorkbenchCommandTitle,
  localizeWorkbenchCommands,
  localizeWorkbenchMenuItemTitle,
  type WorkbenchMessages
} from "./workbenchI18n";
import { createWorkbenchSidebarCommandHandlers } from "./workbenchSidebarCommands";
import {
  createWorkbenchTagRows,
  syncWorkbenchSelectedTag
} from "./workbenchTagsModel";
import { registerWorkbenchStateSubscriptions } from "./workbenchStateSubscriptions";
import {
  createWorkbenchThemeSynchronizationEnvironment,
  registerWorkbenchThemeSynchronization
} from "./workbenchThemeSynchronization";

const remoteSyncOperationPreviewLimit = 6;
const remoteSyncConflictPreviewLimit = 6;
const remoteSyncProgressHistoryLimit = 20;
const remoteSyncProgressPreviewLimit = 6;
const remoteSyncAutoDelayMs = 1200;

export interface WorkbenchApplicationProps {
  readonly services: WorkbenchServices;
}

type TreeStyle = CSSProperties & {
  readonly "--tp-tree-depth"?: number;
  readonly "--tp-menu-x"?: string;
  readonly "--tp-menu-y"?: string;
};

type MarkdownPreviewStyle = CSSProperties & {
  readonly "--tp-preview-font-size"?: string;
  readonly "--tp-preview-line-height"?: string;
  readonly "--tp-preview-max-width"?: string;
};

interface FolderSyncDialogState {
  readonly entry: FileTreeEntry;
  readonly provider: RemoteSyncProviderConfiguration;
  readonly binding?: RemoteSyncFolderBindingConfiguration;
}

interface RemoteSyncFolderPickerPathEntry {
  readonly name: string;
  readonly token: string;
}

interface RemoteSyncFolderPickerState {
  readonly status: "idle" | "loading" | "ready" | "creating" | "failed";
  readonly currentToken: string;
  readonly folders: readonly WorkbenchRemoteSyncLarkFolder[];
  readonly path: readonly RemoteSyncFolderPickerPathEntry[];
  readonly message?: string;
}

interface ActiveRemoteSyncFolderBinding {
  readonly binding: RemoteSyncFolderBindingConfiguration;
  readonly entry: FileTreeEntry;
}

export function WorkbenchApplication({ services }: WorkbenchApplicationProps) {
  const initialStateRef = useRef<WorkbenchInitialState | null>(null);

  if (!initialStateRef.current) {
    initialStateRef.current = createWorkbenchInitialState(services);
  }

  const initialState = initialStateRef.current;
  const [configuration, setConfiguration] = useState<TyporaPlusConfiguration>(
    initialState.configuration
  );
  const [model, setModel] = useState<TextFileModel>(initialState.model);
  const [workspace, setWorkspace] = useState<WorkspaceState>(initialState.workspace);
  const [recents, setRecents] = useState<readonly RecentResource[]>(initialState.recents);
  const [themes, setThemes] = useState(initialState.themes);
  const [sideView, setSideView] = useState<WorkbenchSideView | null>(defaultWorkbenchSideView);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [markdownPreviewOpen, setMarkdownPreviewOpen] = useState(false);
  const [markdownPreviewHtml, setMarkdownPreviewHtml] = useState("");
  const [markdownPreviewError, setMarkdownPreviewError] = useState<string | undefined>();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [operationError, setOperationError] = useState<string | undefined>();
  const [aiResponse, setAiResponse] = useState<WorkbenchAiResponse | undefined>();
  const [remoteSyncPlan, setRemoteSyncPlan] = useState<WorkbenchRemoteSyncPlanResult | undefined>();
  const [remoteSyncExecution, setRemoteSyncExecution] = useState<WorkbenchRemoteSyncExecutionResult | undefined>();
  const [remoteSyncExecuting, setRemoteSyncExecuting] = useState(false);
  const [remoteSyncProgressHistory, setRemoteSyncProgressHistory] = useState<readonly RemoteSyncProgress[]>([]);
  const [remoteSyncAutoStatus, setRemoteSyncAutoStatus] = useState<WorkbenchRemoteSyncAutoStatus>(
    defaultWorkbenchRemoteSyncAutoStatus
  );
  const [folderSyncDialog, setFolderSyncDialog] = useState<FolderSyncDialogState | undefined>();
  const [folderSyncStatuses, setFolderSyncStatuses] = useState<Readonly<Record<string, WorkbenchRemoteSyncAutoStatus>>>({});
  const [saveConflict, setSaveConflict] = useState<FileSaveConflict | undefined>();
  const [indexStatus, setIndexStatus] = useState<WorkspaceIndexStatus>(initialState.indexStatus);
  const [commandRevision, setCommandRevision] = useState(0);
  const [markdownRendererRevision, setMarkdownRendererRevision] = useState(0);
  const [aiProviderRevision, setAiProviderRevision] = useState(0);
  const [remoteSyncProviderRevision, setRemoteSyncProviderRevision] = useState(0);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const remoteSyncExecutionAbortRef = useRef<AbortController | null>(null);
  const remoteSyncAutoAbortRef = useRef<AbortController | null>(null);
  const remoteSyncAutoPendingRef = useRef(false);
  const remoteSyncAutoRunningRef = useRef(false);
  const remoteSyncAutoTimerRef = useRef<number | undefined>(undefined);
  const previousModelDirtyRef = useRef(model.dirty);
  const previousWorkspaceFilesRef = useRef(workspace.files);
  const titlebarMenuItems = useMenuItems(services, workbenchMenuIds.titlebarPrimary);
  const activitybarPrimaryMenuItems = useMenuItems(services, workbenchMenuIds.activitybarPrimary);
  const activitybarSecondaryMenuItems = useMenuItems(services, workbenchMenuIds.activitybarSecondary);
  const capabilityContext = createWorkbenchCapabilityContext(services);
  const commandSurface = useMemo(
    () => createWorkbenchCommandSurface(services),
    [commandRevision, services]
  );
  const messages = useMemo(
    () => createWorkbenchMessages(configuration.appearance.locale),
    [configuration.appearance.locale]
  );
  const localizedCommands = useMemo(
    () => localizeWorkbenchCommands(commandSurface.commands, messages),
    [commandSurface.commands, messages]
  );
  const getLocalizedCommandTitle = (id: string) =>
    localizeWorkbenchCommandTitle(id, commandSurface.getCommandTitle(id), messages);
  const executeCommand = createWorkbenchCommandExecutor(services, {
    messages: messages.actionRunner,
    setOperationError,
    setSaveConflict
  });
  const runAutoRemoteSync = useCallback(async function runAutoRemoteSyncTask() {
    if (remoteSyncAutoRunningRef.current) {
      remoteSyncAutoPendingRef.current = true;
      return;
    }

    const currentConfiguration = services.configurationService.getValue();
    const currentWorkspace = services.workspaceService.getWorkspace();
    const workspaceOpen = !!currentWorkspace.files;
    const providerAvailable = services.remoteSyncService.getProviders().length > 0;
    const folderSyncTargets = currentWorkspace.files
      ? getActiveRemoteSyncFolderBindings(currentConfiguration.remoteSync.folderBindings, currentWorkspace.files.root)
      : [];

    if (!workspaceOpen || !providerAvailable || folderSyncTargets.length === 0) {
      setRemoteSyncAutoStatus(defaultWorkbenchRemoteSyncAutoStatus);
      return;
    }

    if (remoteSyncPlan || remoteSyncExecuting) {
      remoteSyncAutoPendingRef.current = true;
      setRemoteSyncAutoStatus((status) => ({
        state: "pending",
        ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {})
      }));
      return;
    }

    const controller = new AbortController();
    remoteSyncAutoAbortRef.current = controller;
    remoteSyncAutoRunningRef.current = true;
    setRemoteSyncAutoStatus((status) => ({
      state: "syncing",
      ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {})
    }));

    try {
      if (folderSyncTargets.length > 0) {
        let failed = false;

        for (const target of folderSyncTargets) {
          if (controller.signal.aborted) {
            return;
          }

          setFolderSyncStatuses((statuses) => ({
            ...statuses,
            [target.binding.localUri]: {
              state: "syncing",
              ...(statuses[target.binding.localUri]?.lastSyncedAt !== undefined
                ? { lastSyncedAt: statuses[target.binding.localUri]!.lastSyncedAt }
                : target.binding.lastSyncedAt !== undefined
                  ? { lastSyncedAt: target.binding.lastSyncedAt }
                  : {})
            }
          }));

          try {
            const result = await runWorkbenchPlanFolderRemoteSyncAction(services, {
              actionMessages: messages.remoteSync.actions,
              binding: target.binding,
              includeDirectories: true,
              localFolder: target.entry,
              markdownAssetMessages: messages.remoteSync.markdownAssets,
              metadata: {
                surface: "auto"
              },
              requestMessages: messages.remoteSync.request,
              signal: controller.signal
            });

            if (controller.signal.aborted) {
              return;
            }

            if (result.plan.summary.conflicts > 0) {
              failed = true;
              setFolderSyncStatuses((statuses) => ({
                ...statuses,
                [target.binding.localUri]: {
                  state: "failed",
                  ...(statuses[target.binding.localUri]?.lastSyncedAt !== undefined
                    ? { lastSyncedAt: statuses[target.binding.localUri]!.lastSyncedAt }
                    : target.binding.lastSyncedAt !== undefined
                      ? { lastSyncedAt: target.binding.lastSyncedAt }
                      : {}),
                  message: messages.status.syncConflicts
                }
              }));
              continue;
            }

            if (result.plan.operations.length > 0) {
              await runWorkbenchExecuteWorkspaceRemoteSyncAction(services, result, {
                actionMessages: messages.remoteSync.actions,
                metadata: {
                  surface: "auto"
                },
                signal: controller.signal
              });
            }

            if (!controller.signal.aborted) {
              const syncedAt = Date.now();
              setFolderSyncStatuses((statuses) => ({
                ...statuses,
                [target.binding.localUri]: {
                  state: "synced",
                  lastSyncedAt: syncedAt
                }
              }));
              updateRemoteSyncFolderBindingLastSynced(services, target.binding, syncedAt);
            }
          } catch (error) {
            if (!controller.signal.aborted) {
              failed = true;
              const message = error instanceof Error ? error.message : messages.status.syncFailed;
              setFolderSyncStatuses((statuses) => ({
                ...statuses,
                [target.binding.localUri]: {
                  state: "failed",
                  ...(statuses[target.binding.localUri]?.lastSyncedAt !== undefined
                    ? { lastSyncedAt: statuses[target.binding.localUri]!.lastSyncedAt }
                    : target.binding.lastSyncedAt !== undefined
                      ? { lastSyncedAt: target.binding.lastSyncedAt }
                      : {}),
                  message
                }
              }));
              setOperationError(message);
            }
          }
        }

        if (!controller.signal.aborted) {
          setRemoteSyncAutoStatus({
            state: failed ? "failed" : "synced",
            lastSyncedAt: Date.now(),
            ...(failed ? { message: messages.status.syncFailed } : {})
          });
        }
        return;
      }

      const result = await runWorkbenchPlanWorkspaceRemoteSyncAction(services, {
        actionMessages: messages.remoteSync.actions,
        markdownAssetMessages: messages.remoteSync.markdownAssets,
        metadata: {
          surface: "auto"
        },
        requestMessages: messages.remoteSync.request,
        signal: controller.signal
      });

      if (controller.signal.aborted) {
        return;
      }

      if (result.plan.summary.conflicts > 0) {
        setRemoteSyncAutoStatus((status) => ({
          state: "failed",
          ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {}),
          message: messages.status.syncConflicts
        }));
        setOperationError(messages.status.syncConflicts);
        return;
      }

      if (result.plan.operations.length > 0) {
        await runWorkbenchExecuteWorkspaceRemoteSyncAction(services, result, {
          actionMessages: messages.remoteSync.actions,
          metadata: {
            surface: "auto"
          },
          signal: controller.signal
        });
      }

      if (!controller.signal.aborted) {
        setRemoteSyncAutoStatus({
          state: "synced",
          lastSyncedAt: Date.now()
        });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        const message = error instanceof Error ? error.message : messages.status.syncFailed;
        setRemoteSyncAutoStatus((status) => ({
          state: "failed",
          ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {}),
          message
        }));
        setOperationError(message);
      }
    } finally {
      if (remoteSyncAutoAbortRef.current === controller) {
        remoteSyncAutoAbortRef.current = null;
      }
      remoteSyncAutoRunningRef.current = false;

      if (remoteSyncAutoPendingRef.current && typeof window !== "undefined") {
        remoteSyncAutoPendingRef.current = false;
        remoteSyncAutoTimerRef.current = window.setTimeout(() => {
          remoteSyncAutoTimerRef.current = undefined;
          void runAutoRemoteSyncTask();
        }, remoteSyncAutoDelayMs);
      }
    }
  }, [messages, remoteSyncExecuting, remoteSyncPlan, services]);
  const scheduleAutoRemoteSync = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const currentConfiguration = services.configurationService.getValue();
    const currentWorkspace = services.workspaceService.getWorkspace();
    const workspaceOpen = !!currentWorkspace.files;
    const providerAvailable = services.remoteSyncService.getProviders().length > 0;
    const folderSyncTargets = currentWorkspace.files
      ? getActiveRemoteSyncFolderBindings(currentConfiguration.remoteSync.folderBindings, currentWorkspace.files.root)
      : [];

    if (!workspaceOpen || !providerAvailable || folderSyncTargets.length === 0) {
      return;
    }

    if (remoteSyncAutoRunningRef.current || remoteSyncPlan || remoteSyncExecuting) {
      remoteSyncAutoPendingRef.current = true;
      setRemoteSyncAutoStatus((status) => ({
        state: status.state === "syncing" ? "syncing" : "pending",
        ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {})
      }));
      return;
    }

    if (remoteSyncAutoTimerRef.current !== undefined) {
      window.clearTimeout(remoteSyncAutoTimerRef.current);
    }

    setRemoteSyncAutoStatus((status) => ({
      state: "pending",
      ...(status.lastSyncedAt !== undefined ? { lastSyncedAt: status.lastSyncedAt } : {})
    }));
    remoteSyncAutoTimerRef.current = window.setTimeout(() => {
      remoteSyncAutoTimerRef.current = undefined;
      void runAutoRemoteSync();
    }, remoteSyncAutoDelayMs);
  }, [remoteSyncExecuting, remoteSyncPlan, runAutoRemoteSync, services]);

  const outline = useMemo(() => extractOutline(model.value), [model.value]);
  const stats = useMemo(() => calculateMarkdownStats(model.value), [model.value]);
  const searchResults = useMemo(
    () => getWorkbenchSearchResults(services, workspace, model, searchQuery, {
      maxDocumentResults: configuration.workspace.searchMaxResults
    }),
    [configuration.workspace.searchMaxResults, indexStatus.updatedAt, model.value, searchQuery, services, workspace.files]
  );
  const backlinks = useMemo(
    () => getWorkbenchBacklinks(services, workspace, model),
    [indexStatus.updatedAt, model.uri, services, workspace.files]
  );
  const tags = useMemo(
    () => getWorkbenchTags(services, workspace),
    [indexStatus.updatedAt, services, workspace.files]
  );
  const taggedResources = useMemo(
    () => getWorkbenchTaggedResources(services, workspace, selectedTag),
    [indexStatus.updatedAt, selectedTag, services, workspace.files]
  );

  useEffect(() => {
    const disposable = registerWorkbenchStateSubscriptions(services, {
      bumpAiProviderRevision: () => setAiProviderRevision((revision) => revision + 1),
      bumpCommandRevision: () => setCommandRevision((revision) => revision + 1),
      bumpMarkdownRendererRevision: () => setMarkdownRendererRevision((revision) => revision + 1),
      bumpRemoteSyncProviderRevision: () => setRemoteSyncProviderRevision((revision) => revision + 1),
      setConfiguration,
      setIndexStatus,
      setModel,
      setRecents,
      setThemes,
      setWorkspace
    });

    return () => disposable.dispose();
  }, [services]);

  useEffect(() => {
    applyWorkbenchStateContext(services, configuration, model, sideView, workspace);
  }, [
    configuration.editor.focusMode,
    configuration.editor.typewriterMode,
    aiProviderRevision,
    model.uri.scheme,
    remoteSyncProviderRevision,
    services,
    sideView,
    workspace.files
  ]);

  useEffect(() => {
    syncWorkbenchSelectedTag(tags, selectedTag, { setSelectedTag });
  }, [selectedTag, tags]);

  useEffect(() => {
    const workspaceIndexingHandler = createWorkbenchWorkspaceIndexingHandler(services, {
      setOperationError,
      setSaveConflict
    });

    workspaceIndexingHandler(workspace.files);
  }, [configuration.workspace.searchMaxFileSizeBytes, services, workspace.files]);

  useEffect(() => {
    return scheduleWorkbenchAutoSave(
      services,
      workspace.files,
      { configuration, model, saveConflict },
      { setOperationError, setSaveConflict },
      createWorkbenchAutoSaveScheduler(window)
    );
  }, [
    configuration.editor.autoSave,
    configuration.editor.autoSaveDelayMs,
    model.dirty,
    model.uri,
    model.value,
    saveConflict,
    services,
    workspace.files
  ]);

  useEffect(() => {
    return () => {
      if (remoteSyncAutoTimerRef.current !== undefined) {
        window.clearTimeout(remoteSyncAutoTimerRef.current);
        remoteSyncAutoTimerRef.current = undefined;
      }

      remoteSyncAutoAbortRef.current?.abort();
      remoteSyncAutoAbortRef.current = null;
    };
  }, []);

  useEffect(() => {
    const wasDirty = previousModelDirtyRef.current;
    previousModelDirtyRef.current = model.dirty;

    if (wasDirty && !model.dirty && model.uri.scheme === "file" && saveConflict === undefined) {
      scheduleAutoRemoteSync();
    }
  }, [model.dirty, model.uri.scheme, saveConflict, scheduleAutoRemoteSync]);

  useEffect(() => {
    if (
      !workspace.files ||
      services.remoteSyncService.getProviders().length === 0 ||
      getActiveRemoteSyncFolderBindings(configuration.remoteSync.folderBindings, workspace.files.root).length === 0
    ) {
      setRemoteSyncAutoStatus(defaultWorkbenchRemoteSyncAutoStatus);
    }
  }, [configuration.remoteSync.folderBindings, remoteSyncProviderRevision, services, workspace.files]);

  useEffect(() => {
    if (!remoteSyncPlan && !remoteSyncExecuting && remoteSyncAutoPendingRef.current) {
      remoteSyncAutoPendingRef.current = false;
      scheduleAutoRemoteSync();
    }
  }, [remoteSyncExecuting, remoteSyncPlan, scheduleAutoRemoteSync]);

  useEffect(() => {
    const previousWorkspaceFiles = previousWorkspaceFilesRef.current;
    previousWorkspaceFilesRef.current = workspace.files;

    if (
      previousWorkspaceFiles &&
      workspace.files &&
      previousWorkspaceFiles !== workspace.files &&
      !model.dirty &&
      saveConflict === undefined
    ) {
      scheduleAutoRemoteSync();
    }
  }, [model.dirty, saveConflict, scheduleAutoRemoteSync, workspace.files]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return;
    }

    const disposable = registerWorkbenchThemeSynchronization(
      createWorkbenchThemeSynchronizationEnvironment(window, document),
      configuration,
      services
    );

    return () => disposable.dispose();
  }, [configuration.appearance.colorScheme, configuration.appearance.themeId, services, themes]);

  useEffect(() => {
    const disposable = registerWorkbenchCommands(services, {
      aiActionMessages: messages.ai.activeNoteAction,
      aiRequestMessages: messages.ai.activeNoteRequest,
      aiResponseMessages: messages.dialogs.aiResponse.extractedTasks,
      aiWorkspaceContextMessages: messages.ai.workspaceContext,
      actionRunnerMessages: messages.actionRunner,
      configuration,
      remoteSyncActionMessages: messages.remoteSync.actions,
      remoteSyncMarkdownAssetMessages: messages.remoteSync.markdownAssets,
      remoteSyncRequestMessages: messages.remoteSync.request,
      workspaceFiles: workspace.files
    }, {
      getAppliedColorScheme: () => {
        const theme = document.documentElement.getAttribute("data-theme");
        return theme === "light" || theme === "dark" ? theme : undefined;
      },
      getEditorHandle: () => editorRef.current,
      setAiResponse,
      setOperationError,
      setPaletteOpen,
      setQuickOpen,
      setRemoteSyncPlan: (result) => {
        remoteSyncExecutionAbortRef.current?.abort();
        remoteSyncExecutionAbortRef.current = null;
        setRemoteSyncExecuting(false);
        setRemoteSyncPlan(result);
        setRemoteSyncExecution(undefined);
        setRemoteSyncProgressHistory([]);
      },
      setSaveConflict,
      setSettingsOpen,
      setSideView
    });

    return () => disposable.dispose();
  }, [aiProviderRevision, configuration, messages, remoteSyncProviderRevision, services, workspace.files]);

  useEffect(() => {
    const disposable = registerWorkbenchKeybindingDispatch(
      createWorkbenchKeybindingDispatchTarget(window),
      services,
      {
        setOperationError,
        setSaveConflict
      }
    );

    return () => disposable.dispose();
  }, [services]);

  const editorAdapter = useMemo(
    () => createWorkbenchEditorAdapter(configuration, services, model),
    [
      configuration.appearance.locale,
      configuration.editor.focusMode,
      configuration.editor.fontSize,
      configuration.editor.lineHeight,
      configuration.editor.maxWidth,
      configuration.editor.rendererPreviewCacheEntries,
      configuration.editor.typewriterMode,
      configuration.markdown,
      markdownRendererRevision,
      model.uri,
      services
    ]
  );

  useEffect(() => {
    if (!markdownPreviewOpen) {
      return;
    }

    let disposed = false;
    setMarkdownPreviewError(undefined);

    void createMarkdownPreviewHtml({
      value: model.value,
      ...(editorAdapter.resolveImageSource ? { resolveImageSource: editorAdapter.resolveImageSource } : {})
    }).then((html) => {
      if (!disposed) {
        setMarkdownPreviewHtml(html);
      }
    }).catch((error: unknown) => {
      if (!disposed) {
        setMarkdownPreviewHtml("");
        setMarkdownPreviewError(error instanceof Error ? error.message : String(error));
      }
    });

    return () => {
      disposed = true;
    };
  }, [editorAdapter.resolveImageSource, markdownPreviewOpen, model.value]);

  const resourceOpeningCallbacks = createWorkbenchResourceOpeningCallbacks({
    setOperationError,
    setQuickOpen,
    setSaveConflict,
    setSideView
  });
  const quickOpenFileOpenHandler = createWorkbenchQuickOpenFileOpenHandler(
    services,
    resourceOpeningCallbacks
  );
  const fileResourceOpenHandler = createWorkbenchFileResourceOpenHandler(
    services,
    resourceOpeningCallbacks
  );
  const recentWorkspaceResourceOpenHandler = createWorkbenchRecentWorkspaceResourceOpenHandler(
    services,
    resourceOpeningCallbacks
  );
  const lineNavigationCallbacks = createWorkbenchLineNavigationCallbacks(
    createWorkbenchLineNavigationEnvironment(window),
    { getEditorHandle: () => editorRef.current },
    {
      clearSaveConflict: resourceOpeningCallbacks.clearSaveConflict,
      setOperationError,
      setSaveConflict
    }
  );
  const lineTargetOpenHandler = createWorkbenchLineTargetOpenHandler(
    services,
    lineNavigationCallbacks
  );
  const saveConflictActionCallbacks = createWorkbenchSaveConflictActionCallbacks({
    setOperationError,
    setSaveConflict
  });
  const saveConflictDialogActions = saveConflict
    ? createWorkbenchSaveConflictDialogActionHandlers(
        services,
        {
          conflict: saveConflict,
          workspaceFiles: workspace.files
        },
        saveConflictActionCallbacks
      )
    : undefined;
  const commandPaletteExecutionCallbacks = createCommandPaletteExecutionCallbacks({
    setOperationError,
    setPaletteOpen,
    setSaveConflict
  });
  const commandPaletteExecuteHandler = createCommandPaletteExecuteHandler(
    services,
    commandPaletteExecutionCallbacks
  );
  const settingsUpdateHandler = createWorkbenchConfigurationUpdateHandler(services, {
    setOperationError
  });
  const aiSecretActions = useMemo(
    () => createWorkbenchAiSecretActions({
      actionRunnerMessages: messages.actionRunner,
      messages: messages.ai.secrets,
      setOperationError
    }),
    [messages.actionRunner, messages.ai.secrets]
  );
  const remoteSyncSecretActions = useMemo(
    () => createWorkbenchRemoteSyncSecretActions({
      actionRunnerMessages: messages.actionRunner,
      messages: messages.remoteSync.secrets,
      setOperationError
    }),
    [messages.actionRunner, messages.remoteSync.secrets]
  );
  const remoteSyncLarkAuthActions = useMemo(
    () => createWorkbenchRemoteSyncLarkAuthActions({
      actionRunnerMessages: messages.actionRunner,
      messages: messages.remoteSync.larkAuth,
      setOperationError
    }),
    [messages.actionRunner, messages.remoteSync.larkAuth]
  );
  const openFolderSyncDialogHandler = (entry: FileTreeEntry) => {
    if (entry.kind !== "directory") {
      return;
    }

    const binding = findRemoteSyncFolderBinding(configuration.remoteSync.folderBindings, entry);
    const provider = findRemoteSyncFolderBindingProvider(configuration.remoteSync.providers, binding);

    if (!provider) {
      setOperationError(messages.shell.remoteSyncNoProvider);
      return;
    }

    setFolderSyncDialog({
      entry,
      provider,
      ...(binding ? { binding } : {})
    });
  };
  const bindRemoteSyncFolderHandler = (
    entry: FileTreeEntry,
    provider: RemoteSyncProviderConfiguration,
    folder: WorkbenchRemoteSyncLarkFolder
  ) => {
    const binding = createRemoteSyncFolderBinding(entry, provider, folder);
    const nextBindings = upsertRemoteSyncFolderBinding(configuration.remoteSync.folderBindings, binding);

    services.configurationService.updateValue({
      remoteSync: {
        ...configuration.remoteSync,
        folderBindings: nextBindings
      }
    });
    setFolderSyncStatuses((statuses) => ({
      ...statuses,
      [binding.localUri]: {
        state: "pending"
      }
    }));
    setFolderSyncDialog(undefined);
    scheduleAutoRemoteSync();
  };
  const unbindRemoteSyncFolderHandler = (entry: FileTreeEntry) => {
    const nextBindings = removeRemoteSyncFolderBinding(configuration.remoteSync.folderBindings, entry);

    services.configurationService.updateValue({
      remoteSync: {
        ...configuration.remoteSync,
        folderBindings: nextBindings
      }
    });
    setFolderSyncStatuses((statuses) => {
      const next = { ...statuses };
      delete next[entry.uri.toString()];
      return next;
    });
    if (workspace.files && getActiveRemoteSyncFolderBindings(nextBindings, workspace.files.root).length === 0) {
      setRemoteSyncAutoStatus(defaultWorkbenchRemoteSyncAutoStatus);
    }
  };
  const aiDiagnosticActions = useMemo(
    () => createWorkbenchAiProviderDiagnosticActions(services, {
      messages: messages.ai.providerDiagnostic,
      setOperationError
    }),
    [messages.ai.providerDiagnostic, services]
  );
  const sidebarCommandHandlers = createWorkbenchSidebarCommandHandlers(executeCommand);
  const createWorkspaceFileHandler = (parent: FileTreeEntry) => {
    void runWorkbenchAction(
      async () => {
        const entry = await createWorkbenchWorkspaceFileWithDefaultName(
          services,
          parent,
          messages.shell.defaultNewFileName,
          {
            clearSaveConflict: resourceOpeningCallbacks.clearSaveConflict
          }
        );
        scheduleAutoRemoteSync();
        return entry;
      },
      setOperationError,
      setSaveConflict,
      messages.actionRunner
    );
  };
  const createWorkspaceDirectoryHandler = (parent: FileTreeEntry) => {
    void runWorkbenchAction(
      async () => {
        await createWorkbenchWorkspaceDirectoryWithDefaultName(services, parent, messages.shell.defaultNewFolderName);
        scheduleAutoRemoteSync();
      },
      setOperationError,
      setSaveConflict,
      messages.actionRunner
    );
  };
  const renameWorkspaceEntryHandler = (entry: FileTreeEntry, name: string) => {
    if (!name || name === entry.name) {
      return;
    }

    void runWorkbenchAction(
      async () => {
        const renamed = await renameWorkbenchWorkspaceEntry(services, workspace, model, entry, name, {
          clearSaveConflict: resourceOpeningCallbacks.clearSaveConflict
        });
        if (entry.kind === "directory") {
          updateRenamedRemoteSyncFolderBinding(services, configuration, entry, renamed);
        }
        scheduleAutoRemoteSync();
        return renamed;
      },
      setOperationError,
      setSaveConflict,
      messages.actionRunner
    );
  };
  const deleteWorkspaceEntryHandler = (entry: FileTreeEntry) => {
    const confirmMessage = entry.kind === "directory"
      ? messages.shell.deleteFolderConfirm(entry.name)
      : messages.shell.deleteFileConfirm(entry.name);

    if (!window.confirm(confirmMessage)) {
      return;
    }

    void runWorkbenchAction(
      async () => {
        await deleteWorkbenchWorkspaceEntry(services, workspace, model, entry, {
          clearSaveConflict: resourceOpeningCallbacks.clearSaveConflict
        });
        if (entry.kind === "directory") {
          removeDeletedRemoteSyncFolderBindings(services, configuration, entry);
        }
        scheduleAutoRemoteSync();
      },
      setOperationError,
      setSaveConflict,
      messages.actionRunner
    );
  };
  const remoteSyncAutoStatusVisible = shouldShowWorkbenchRemoteSyncAutoStatus(remoteSyncAutoStatus, {
    providerAvailable: services.remoteSyncService.getProviders().length > 0,
    workspaceOpen: !!workspace.files
  });

  return (
    <main className={[
      sideView ? "tp-shell tp-shell-with-sidebar" : "tp-shell",
      `tp-density-${configuration.appearance.density}`
    ].join(" ")}>
      <Titlebar
        model={model}
        workspaceName={workspace.name}
        configuration={configuration}
        messages={messages}
        menuItems={titlebarMenuItems}
        markdownPreviewOpen={markdownPreviewOpen}
        getCommandTitle={getLocalizedCommandTitle}
        onCommand={executeCommand}
        onToggleMarkdownPreview={() => setMarkdownPreviewOpen((open) => !open)}
      />
      <div className="tp-body">
        <ActivityBar
          activeView={sideView}
          configuration={configuration}
          messages={messages}
          primaryMenuItems={activitybarPrimaryMenuItems}
          secondaryMenuItems={activitybarSecondaryMenuItems}
          getCommandTitle={getLocalizedCommandTitle}
          onCommand={executeCommand}
        />
        {sideView ? (
          <Sidebar
            view={sideView}
            model={model}
            workspace={workspace}
            recents={recents}
            fileServiceAvailable={capabilityContext.fileSystemAvailable}
            outline={outline}
            searchQuery={searchQuery}
            searchResults={searchResults}
            backlinks={backlinks}
            tags={tags}
            selectedTag={selectedTag}
            taggedResources={taggedResources}
            indexStatus={indexStatus}
            folderSyncBindings={configuration.remoteSync.folderBindings}
            folderSyncStatuses={folderSyncStatuses}
            messages={messages}
            onSearchQueryChange={setSearchQuery}
            onClose={() => setSideView(null)}
            onSelectLine={(line) => scrollWorkbenchLine(lineNavigationCallbacks, { line })}
            onOpenSearchResult={lineTargetOpenHandler}
            onOpenBacklink={lineTargetOpenHandler}
            onSelectTag={setSelectedTag}
            onOpenTaggedResource={lineTargetOpenHandler}
            onOpenWorkspace={sidebarCommandHandlers.openWorkspace}
            onOpenRecentWorkspace={recentWorkspaceResourceOpenHandler}
            onRefreshWorkspace={sidebarCommandHandlers.refreshWorkspace}
            onOpenFile={fileResourceOpenHandler}
            onCreateFile={createWorkspaceFileHandler}
            onCreateDirectory={createWorkspaceDirectoryHandler}
            onRenameEntry={renameWorkspaceEntryHandler}
            onDeleteEntry={deleteWorkspaceEntryHandler}
            onSyncDirectory={openFolderSyncDialogHandler}
            onUnsyncDirectory={unbindRemoteSyncFolderHandler}
          />
        ) : null}
        <section
          className={markdownPreviewOpen ? "tp-editor-pane tp-editor-pane-preview" : "tp-editor-pane"}
          aria-label={markdownPreviewOpen ? messages.shell.markdownPreviewAriaLabel : messages.shell.editorAriaLabel}
        >
          {markdownPreviewOpen ? (
            <MarkdownPreviewPane
              configuration={configuration}
              html={markdownPreviewHtml}
              error={markdownPreviewError}
            />
          ) : (
            <MarkdownEditor
              ref={editorRef}
              value={model.value}
              configuration={editorAdapter.configuration}
              onChange={editorAdapter.onChange}
              onPasteImage={editorAdapter.onPasteImage}
              resolveImageSource={editorAdapter.resolveImageSource}
              renderCodeFence={editorAdapter.renderCodeFence}
              renderInline={editorAdapter.renderInline}
            />
          )}
        </section>
      </div>
      <Statusbar
        model={model}
        stats={stats}
        operationError={operationError}
        messages={messages}
        remoteSyncStatus={remoteSyncAutoStatus}
        showRemoteSyncStatus={remoteSyncAutoStatusVisible}
      />
      {saveConflict && saveConflictDialogActions ? (
        <SaveConflictDialog
          conflict={saveConflict}
          messages={messages}
          onClose={saveConflictActionCallbacks.clearSaveConflict}
          onReload={saveConflictDialogActions.reload}
          onOverwrite={saveConflictDialogActions.overwrite}
        />
      ) : null}
      {aiResponse ? (
        <AiResponseDialog
          result={aiResponse}
          messages={messages}
          onApply={() => runWorkbenchAction(
            () => applyWorkbenchAiResponseToActiveNote(services, aiResponse.response, aiResponse.applyMode),
            setOperationError,
            setSaveConflict,
            messages.actionRunner
          ).then(Boolean)}
          onClose={() => setAiResponse(undefined)}
        />
      ) : null}
      {remoteSyncPlan ? (
        <RemoteSyncPlanDialog
          result={remoteSyncPlan}
          execution={remoteSyncExecution}
          executing={remoteSyncExecuting}
          progressEvents={remoteSyncProgressHistory}
          messages={messages}
          onClose={() => {
            remoteSyncExecutionAbortRef.current?.abort();
            remoteSyncExecutionAbortRef.current = null;
            setRemoteSyncExecuting(false);
            setRemoteSyncPlan(undefined);
            setRemoteSyncExecution(undefined);
            setRemoteSyncProgressHistory([]);
          }}
          onCancel={() => remoteSyncExecutionAbortRef.current?.abort()}
          onResolveConflicts={(resolution) => {
            setRemoteSyncPlan((current) => current
              ? {
                ...current,
                plan: resolveWorkbenchRemoteSyncPlanConflicts(
                  current.plan,
                  resolution,
                  messages.remoteSync.actions
                )
              }
              : current
            );
            setRemoteSyncExecution(undefined);
            setRemoteSyncProgressHistory([]);
          }}
          onExecute={() => {
            if (remoteSyncExecuting) {
              return Promise.resolve(false);
            }

            const controller = new AbortController();
            remoteSyncExecutionAbortRef.current = controller;
            setRemoteSyncExecuting(true);
            setRemoteSyncExecution(undefined);
            setRemoteSyncProgressHistory([]);

            return runWorkbenchAction(
              async () => {
                const execution = await runWorkbenchExecuteWorkspaceRemoteSyncAction(services, remoteSyncPlan, {
                  actionMessages: messages.remoteSync.actions,
                  metadata: {
                    surface: "dialog"
                  },
                  onProgress: (progress) => {
                    if (remoteSyncExecutionAbortRef.current === controller && !controller.signal.aborted) {
                      setRemoteSyncProgressHistory((progressEvents) =>
                        appendWorkbenchRemoteSyncProgressHistory(progressEvents, progress, {
                          maxEvents: remoteSyncProgressHistoryLimit
                        })
                      );
                    }
                  },
                  signal: controller.signal
                });

                if (remoteSyncExecutionAbortRef.current === controller && !controller.signal.aborted) {
                  setRemoteSyncExecution(execution);
                }

                return execution;
              },
              setOperationError,
              setSaveConflict,
              messages.actionRunner
            )
              .then(Boolean)
              .finally(() => {
                if (remoteSyncExecutionAbortRef.current === controller) {
                  remoteSyncExecutionAbortRef.current = null;
                  setRemoteSyncExecuting(false);
                }
              });
          }}
        />
      ) : null}
      <CommandPalette
        open={paletteOpen}
        commands={localizedCommands}
        getKeybindingLabel={commandSurface.getKeybindingLabel}
        messages={messages}
        onClose={commandPaletteExecutionCallbacks.closePalette}
        onExecute={commandPaletteExecuteHandler}
      />
      <QuickOpen
        open={quickOpen}
        files={workspace.files?.files ?? []}
        maxResults={configuration.workspace.quickOpenMaxResults}
        messages={messages}
        onClose={() => setQuickOpen(false)}
        onOpen={quickOpenFileOpenHandler}
      />
      {folderSyncDialog ? (
        <RemoteSyncFolderDialog
          state={folderSyncDialog}
          actions={remoteSyncLarkAuthActions}
          messages={messages}
          onBind={bindRemoteSyncFolderHandler}
          onClose={() => setFolderSyncDialog(undefined)}
        />
      ) : null}
      <SettingsDialog
        open={settingsOpen}
        configuration={configuration}
        commands={localizedCommands}
        themes={themes}
        messages={messages}
        aiDiagnosticActions={aiDiagnosticActions}
        aiSecretActions={aiSecretActions}
        remoteSyncLarkAuthActions={remoteSyncLarkAuthActions}
        remoteSyncSecretActions={remoteSyncSecretActions}
        getCommandForKeybinding={commandSurface.getCommandForKeybinding}
        getKeybindingLabel={commandSurface.getKeybindingLabel}
        getKeybindingLabelForKeybinding={commandSurface.getKeybindingLabelForKeybinding}
        onClose={() => setSettingsOpen(false)}
        onUpdate={settingsUpdateHandler}
      />
    </main>
  );
}

function useMenuItems(services: WorkbenchServices, menu: MenuId): readonly MenuItem[] {
  const [items, setItems] = useState<readonly MenuItem[]>(() => getWorkbenchMenuItems(services, menu));

  useEffect(() => {
    const disposable = registerWorkbenchMenuItemsSubscription(services, menu, setItems);

    return () => disposable.dispose();
  }, [menu, services]);

  return items;
}

function MarkdownPreviewPane({
  configuration,
  error,
  html
}: {
  readonly configuration: TyporaPlusConfiguration;
  readonly error: string | undefined;
  readonly html: string;
}) {
  const style: MarkdownPreviewStyle = {
    "--tp-preview-font-size": `${configuration.editor.fontSize}px`,
    "--tp-preview-line-height": String(configuration.editor.lineHeight),
    "--tp-preview-max-width": `${configuration.editor.maxWidth}px`
  };

  return (
    <div className="tp-markdown-preview" style={style}>
      {error ? (
        <div className="tp-markdown-preview-error">{error}</div>
      ) : (
        <article
          className="tp-markdown-preview-body"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      )}
    </div>
  );
}

function Titlebar({
  model,
  workspaceName,
  configuration,
  messages,
  menuItems,
  markdownPreviewOpen,
  getCommandTitle,
  onCommand,
  onToggleMarkdownPreview
}: {
  readonly model: TextFileModel;
  readonly workspaceName: string;
  readonly configuration: TyporaPlusConfiguration;
  readonly messages: WorkbenchMessages;
  readonly menuItems: readonly MenuItem[];
  readonly markdownPreviewOpen: boolean;
  readonly getCommandTitle: (id: string) => string;
  readonly onCommand: (id: string) => void;
  readonly onToggleMarkdownPreview: () => void;
}) {
  return (
    <header className="tp-titlebar">
      <div className="tp-titlebar-identity">
        <span className="tp-product-name">{workspaceName}</span>
        <span className="tp-document-name">{model.name}</span>
        {model.dirty ? <span className="tp-dirty-dot" aria-label={messages.shell.unsavedChanges} /> : null}
      </div>
      <div className="tp-titlebar-actions">
        <IconButton
          title={markdownPreviewOpen ? messages.shell.markdownEditorMode : messages.shell.markdownPreviewMode}
          active={markdownPreviewOpen}
          onClick={onToggleMarkdownPreview}
        >
          {markdownPreviewOpen ? <Pencil size={17} /> : <Eye size={17} />}
        </IconButton>
        {menuItems.map((item) => (
          <IconButton
            title={localizeWorkbenchMenuItemTitle(item, getCommandTitle, messages)}
            active={isWorkbenchMenuItemActive(item, createWorkbenchMenuContext(configuration, null))}
            compactHidden={item.compactHidden ?? false}
            key={item.id}
            onClick={() => onCommand(item.command)}
          >
            {renderWorkbenchMenuIcon(item, configuration, 17)}
          </IconButton>
        ))}
      </div>
    </header>
  );
}

function ActivityBar({
  activeView,
  configuration,
  messages,
  primaryMenuItems,
  secondaryMenuItems,
  getCommandTitle,
  onCommand
}: {
  readonly activeView: WorkbenchSideView | null;
  readonly configuration: TyporaPlusConfiguration;
  readonly messages: WorkbenchMessages;
  readonly primaryMenuItems: readonly MenuItem[];
  readonly secondaryMenuItems: readonly MenuItem[];
  readonly getCommandTitle: (id: string) => string;
  readonly onCommand: (id: string) => void;
}) {
  const context = createWorkbenchMenuContext(configuration, activeView);

  return (
    <nav className="tp-activitybar" aria-label={messages.shell.primaryNavigation}>
      {primaryMenuItems.map((item) => (
        <IconButton
          title={localizeWorkbenchMenuItemTitle(item, getCommandTitle, messages)}
          active={isWorkbenchMenuItemActive(item, context)}
          key={item.id}
          onClick={() => onCommand(item.command)}
        >
          {renderWorkbenchMenuIcon(item, configuration, 19)}
        </IconButton>
      ))}
      <div className="tp-activitybar-spacer" />
      {secondaryMenuItems.map((item) => (
        <IconButton
          title={localizeWorkbenchMenuItemTitle(item, getCommandTitle, messages)}
          active={isWorkbenchMenuItemActive(item, context)}
          key={item.id}
          onClick={() => onCommand(item.command)}
        >
          {renderWorkbenchMenuIcon(item, configuration, 19)}
        </IconButton>
      ))}
    </nav>
  );
}

function Sidebar({
  view,
  model,
  workspace,
  recents,
  fileServiceAvailable,
  outline,
  searchQuery,
  searchResults,
  backlinks,
  tags,
  selectedTag,
  taggedResources,
  indexStatus,
  folderSyncBindings,
  folderSyncStatuses,
  messages,
  onSearchQueryChange,
  onClose,
  onSelectLine,
  onOpenSearchResult,
  onOpenBacklink,
  onSelectTag,
  onOpenTaggedResource,
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onRefreshWorkspace,
  onOpenFile,
  onCreateFile,
  onCreateDirectory,
  onRenameEntry,
  onDeleteEntry,
  onSyncDirectory,
  onUnsyncDirectory
}: {
  readonly view: WorkbenchSideView;
  readonly model: TextFileModel;
  readonly workspace: WorkspaceState;
  readonly recents: readonly RecentResource[];
  readonly fileServiceAvailable: boolean;
  readonly outline: readonly OutlineEntry[];
  readonly searchQuery: string;
  readonly searchResults: readonly WorkbenchSearchResult[];
  readonly backlinks: readonly WorkspaceIndexedLink[];
  readonly tags: readonly WorkspaceIndexedTagSummary[];
  readonly selectedTag: string | undefined;
  readonly taggedResources: readonly WorkspaceIndexedTag[];
  readonly indexStatus: WorkspaceIndexStatus;
  readonly folderSyncBindings: readonly RemoteSyncFolderBindingConfiguration[];
  readonly folderSyncStatuses: Readonly<Record<string, WorkbenchRemoteSyncAutoStatus>>;
  readonly messages: WorkbenchMessages;
  readonly onSearchQueryChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onSelectLine: (line: number) => void;
  readonly onOpenSearchResult: (result: WorkbenchSearchResult) => void;
  readonly onOpenBacklink: (link: WorkspaceIndexedLink) => void;
  readonly onSelectTag: (tag: string) => void;
  readonly onOpenTaggedResource: (tag: WorkspaceIndexedTag) => void;
  readonly onOpenWorkspace: () => void;
  readonly onOpenRecentWorkspace: (recent: RecentResource) => void;
  readonly onRefreshWorkspace: () => void;
  readonly onOpenFile: (entry: FileTreeEntry) => void;
  readonly onCreateFile: (parent: FileTreeEntry) => void;
  readonly onCreateDirectory: (parent: FileTreeEntry) => void;
  readonly onRenameEntry: (entry: FileTreeEntry, name: string) => void;
  readonly onDeleteEntry: (entry: FileTreeEntry) => void;
  readonly onSyncDirectory: (entry: FileTreeEntry) => void;
  readonly onUnsyncDirectory: (entry: FileTreeEntry) => void;
}) {
  return (
    <aside className="tp-sidebar">
      <div className="tp-sidebar-header">
        <span>{messages.sideViews[view]}</span>
        <IconButton title={messages.shell.closeSidebar} onClick={onClose}>
          <PanelLeft size={17} />
        </IconButton>
      </div>
      {view === workbenchSideViews.files ? (
        <FilesPanel
          model={model}
          workspace={workspace}
          recents={recents}
          fileServiceAvailable={fileServiceAvailable}
          folderSyncBindings={folderSyncBindings}
          folderSyncStatuses={folderSyncStatuses}
          messages={messages}
          onOpenWorkspace={onOpenWorkspace}
          onOpenRecentWorkspace={onOpenRecentWorkspace}
          onRefreshWorkspace={onRefreshWorkspace}
          onOpenFile={onOpenFile}
          onCreateFile={onCreateFile}
          onCreateDirectory={onCreateDirectory}
          onRenameEntry={onRenameEntry}
          onDeleteEntry={onDeleteEntry}
          onSyncDirectory={onSyncDirectory}
          onUnsyncDirectory={onUnsyncDirectory}
        />
      ) : null}
      {view === workbenchSideViews.search ? (
        <SearchPanel
          query={searchQuery}
          results={searchResults}
          indexStatus={indexStatus}
          messages={messages}
          onQueryChange={onSearchQueryChange}
          onOpenResult={onOpenSearchResult}
        />
      ) : null}
      {view === workbenchSideViews.outline ? <OutlinePanel outline={outline} onSelectLine={onSelectLine} /> : null}
      {view === workbenchSideViews.backlinks ? (
        <BacklinksPanel
          backlinks={backlinks}
          indexStatus={indexStatus}
          messages={messages}
          onOpenBacklink={onOpenBacklink}
        />
      ) : null}
      {view === workbenchSideViews.tags ? (
        <TagsPanel
          tags={tags}
          selectedTag={selectedTag}
          taggedResources={taggedResources}
          indexStatus={indexStatus}
          messages={messages}
          onSelectTag={onSelectTag}
          onOpenTaggedResource={onOpenTaggedResource}
        />
      ) : null}
    </aside>
  );
}

function FilesPanel({
  model,
  workspace,
  recents,
  fileServiceAvailable,
  folderSyncBindings,
  folderSyncStatuses,
  messages,
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onRefreshWorkspace,
  onOpenFile,
  onCreateFile,
  onCreateDirectory,
  onRenameEntry,
  onDeleteEntry,
  onSyncDirectory,
  onUnsyncDirectory
}: {
  readonly model: TextFileModel;
  readonly workspace: WorkspaceState;
  readonly recents: readonly RecentResource[];
  readonly fileServiceAvailable: boolean;
  readonly folderSyncBindings: readonly RemoteSyncFolderBindingConfiguration[];
  readonly folderSyncStatuses: Readonly<Record<string, WorkbenchRemoteSyncAutoStatus>>;
  readonly messages: WorkbenchMessages;
  readonly onOpenWorkspace: () => void;
  readonly onOpenRecentWorkspace: (recent: RecentResource) => void;
  readonly onRefreshWorkspace: () => void;
  readonly onOpenFile: (entry: FileTreeEntry) => void;
  readonly onCreateFile: (parent: FileTreeEntry) => void;
  readonly onCreateDirectory: (parent: FileTreeEntry) => void;
  readonly onRenameEntry: (entry: FileTreeEntry, name: string) => void;
  readonly onDeleteEntry: (entry: FileTreeEntry) => void;
  readonly onSyncDirectory: (entry: FileTreeEntry) => void;
  readonly onUnsyncDirectory: (entry: FileTreeEntry) => void;
}) {
  const workspaceFiles = workspace.files;
  const recentSections = createWorkbenchRecentResourceSections(recents);
  const [collapsedDirectoryUris, setCollapsedDirectoryUris] = useState<ReadonlySet<string>>(() => new Set());
  const [renamingEntry, setRenamingEntry] = useState<FileTreeEntry | undefined>();
  const [renameDraft, setRenameDraft] = useState("");
  const renameClosedRef = useRef(false);
  const rootDirectoryCollapsed = workspaceFiles
    ? collapsedDirectoryUris.has(workspaceFiles.root.uri.toString())
    : false;
  const fileTreeRows = workspaceFiles && !rootDirectoryCollapsed
    ? createWorkbenchFileTreeRows(workspaceFiles.root.children ?? [], {
        activeUri: model.uri.toString(),
        collapsedDirectoryUris,
        dirty: model.dirty
    })
    : [];
  const folderSyncBindingByUri = useMemo(
    () => mapRemoteSyncFolderBindingsByLocalUri(folderSyncBindings),
    [folderSyncBindings]
  );
  const [entryMenu, setEntryMenu] = useState<WorkspaceEntryMenuState | undefined>();

  useEffect(() => {
    if (!entryMenu) {
      return;
    }

    const closeMenu = () => setEntryMenu(undefined);
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    window.addEventListener("click", closeMenu);
    window.addEventListener("contextmenu", closeMenu);
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("contextmenu", closeMenu);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [entryMenu]);

  const openEntryMenu = (entry: FileTreeEntry, x: number, y: number) => {
    setEntryMenu({ entry, x, y });
  };
  const openEntryMenuFromEvent = (event: ReactMouseEvent, entry: FileTreeEntry) => {
    event.preventDefault();
    event.stopPropagation();
    openEntryMenu(entry, event.clientX, event.clientY);
  };
  const runEntryMenuAction = (action: () => void) => {
    setEntryMenu(undefined);
    action();
  };
  const revealDirectory = (entry: FileTreeEntry) => {
    if (entry.kind !== "directory") {
      return;
    }

    setCollapsedDirectoryUris((current) => {
      const uri = entry.uri.toString();

      if (!current.has(uri)) {
        return current;
      }

      const next = new Set(current);
      next.delete(uri);
      return next;
    });
  };
  const createFileInEntry = (entry: FileTreeEntry) => {
    revealDirectory(entry);
    onCreateFile(entry);
  };
  const createDirectoryInEntry = (entry: FileTreeEntry) => {
    revealDirectory(entry);
    onCreateDirectory(entry);
  };
  const startRenamingEntry = (entry: FileTreeEntry) => {
    setEntryMenu(undefined);
    renameClosedRef.current = false;
    setRenamingEntry(entry);
    setRenameDraft(entry.name);
  };
  const commitRenamingEntry = () => {
    if (renameClosedRef.current) {
      return;
    }

    renameClosedRef.current = true;
    const entry = renamingEntry;
    const name = renameDraft.trim();

    setRenamingEntry(undefined);
    setRenameDraft("");

    if (!entry || !name || name === entry.name) {
      return;
    }

    onRenameEntry(entry, name);
  };
  const cancelRenamingEntry = () => {
    renameClosedRef.current = true;
    setRenamingEntry(undefined);
    setRenameDraft("");
  };
  const toggleDirectoryExpanded = (entry: FileTreeEntry) => {
    if (entry.kind !== "directory") {
      return;
    }

    setCollapsedDirectoryUris((current) => {
      const next = new Set(current);
      const uri = entry.uri.toString();

      if (next.has(uri)) {
        next.delete(uri);
      } else {
        next.add(uri);
      }

      return next;
    });
  };

  return (
    <div className="tp-sidebar-content">
      <button
        className="tp-sidebar-action"
        type="button"
        disabled={!fileServiceAvailable}
        onClick={onOpenWorkspace}
      >
        <FolderOpen size={16} />
        <span>{messages.shell.openWorkspace}</span>
      </button>
      <button
        className="tp-sidebar-action"
        type="button"
        disabled={!workspace.rootUri}
        onClick={onRefreshWorkspace}
      >
        <RefreshCw size={16} />
        <span>{messages.shell.refreshWorkspace}</span>
      </button>
      {workspaceFiles ? (
        <div
          className="tp-file-tree-shell"
          onContextMenu={(event) => openEntryMenuFromEvent(event, workspaceFiles.root)}
        >
          <div
            className="tp-workspace-root-row"
            role="button"
            tabIndex={0}
            aria-expanded={!rootDirectoryCollapsed}
            onClick={() => toggleDirectoryExpanded(workspaceFiles.root)}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                toggleDirectoryExpanded(workspaceFiles.root);
              }
            }}
            onContextMenu={(event) => openEntryMenuFromEvent(event, workspaceFiles.root)}
          >
            <span className="tp-tree-disclosure" aria-hidden="true">
              {rootDirectoryCollapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
            </span>
            <Folder size={16} />
            <span className="tp-tree-entry-name">{workspaceFiles.root.name}</span>
            <FolderSyncBadge
              binding={folderSyncBindingByUri.get(workspaceFiles.root.uri.toString())}
              status={folderSyncStatuses[workspaceFiles.root.uri.toString()]}
              messages={messages}
            />
            <TreeActionButton
              title={messages.shell.showWorkspaceActions}
              onClick={(event) => openEntryMenu(workspaceFiles.root, event.clientX, event.clientY)}
            >
              <MoreHorizontal size={15} />
            </TreeActionButton>
          </div>
          <div className="tp-file-tree">
          <FileTreeRows
            rows={fileTreeRows}
            onOpenFile={onOpenFile}
            onOpenEntryMenu={openEntryMenuFromEvent}
            onToggleDirectory={toggleDirectoryExpanded}
            renamingEntryUri={renamingEntry?.uri.toString()}
            renameDraft={renameDraft}
            onRenameDraftChange={setRenameDraft}
            onCommitRename={commitRenamingEntry}
            onCancelRename={cancelRenamingEntry}
            folderSyncBindingByUri={folderSyncBindingByUri}
            folderSyncStatuses={folderSyncStatuses}
            messages={messages}
          />
          </div>
          {entryMenu ? (
            <WorkspaceEntryMenu
              state={entryMenu}
              rootUri={workspaceFiles.root.uri.toString()}
              binding={folderSyncBindingByUri.get(entryMenu.entry.uri.toString())}
              messages={messages}
              onCreateFile={(entry) => runEntryMenuAction(() => createFileInEntry(entry))}
              onCreateDirectory={(entry) => runEntryMenuAction(() => createDirectoryInEntry(entry))}
              onRenameEntry={startRenamingEntry}
              onDeleteEntry={(entry) => runEntryMenuAction(() => onDeleteEntry(entry))}
              onSyncDirectory={(entry) => runEntryMenuAction(() => onSyncDirectory(entry))}
              onUnsyncDirectory={(entry) => runEntryMenuAction(() => onUnsyncDirectory(entry))}
            />
          ) : null}
        </div>
      ) : (
        <button className="tp-file-row tp-file-row-active" type="button">
          <FileText size={16} />
          <span>{model.name}</span>
          {model.dirty ? <span className="tp-row-dot" /> : null}
        </button>
      )}
      {recentSections.files.length > 0 ? (
        <RecentSection
          title={messages.shell.recentFiles}
          recents={recentSections.files}
          activeUri={model.uri.toString()}
          onOpenFile={onOpenFile}
        />
      ) : null}
      {recentSections.workspaces.length > 0 ? (
        <RecentSection
          title={messages.shell.recentWorkspaces}
          recents={recentSections.workspaces}
          activeUri={workspace.rootUri?.toString()}
          {...(fileServiceAvailable ? { onOpenWorkspace: onOpenRecentWorkspace } : {})}
        />
      ) : null}
    </div>
  );
}

function RecentSection({
  title,
  recents,
  activeUri,
  onOpenFile,
  onOpenWorkspace
}: {
  readonly title: string;
  readonly recents: readonly RecentResource[];
  readonly activeUri: string | undefined;
  readonly onOpenFile?: (entry: FileTreeEntry) => void;
  readonly onOpenWorkspace?: (recent: RecentResource) => void;
}) {
  const rows = createWorkbenchRecentResourceRows(recents, activeUri);

  return (
    <section className="tp-recent-section">
      <div className="tp-section-label">{title}</div>
      {rows.map((row) => {
        return (
          <button
            className={row.active ? "tp-file-row tp-file-row-active" : "tp-file-row"}
            key={row.key}
            type="button"
            disabled={(row.kind === "file" && !onOpenFile) || (row.kind === "workspace" && !onOpenWorkspace)}
            onClick={() => {
              if (row.fileEntry && onOpenFile) {
                onOpenFile(row.fileEntry);
                return;
              }

              if (row.kind === "workspace" && onOpenWorkspace) {
                onOpenWorkspace(row.resource);
              }
            }}
          >
            {row.kind === "file" ? <FileText size={16} /> : <Folder size={16} />}
            <span>{row.resource.name}</span>
          </button>
        );
      })}
    </section>
  );
}

function FileTreeRows({
  rows,
  onOpenFile,
  onOpenEntryMenu,
  onToggleDirectory,
  renamingEntryUri,
  renameDraft,
  onRenameDraftChange,
  onCommitRename,
  onCancelRename,
  folderSyncBindingByUri,
  folderSyncStatuses,
  messages
}: {
  readonly rows: readonly WorkbenchFileTreeRow[];
  readonly onOpenFile: (entry: FileTreeEntry) => void;
  readonly onOpenEntryMenu: (event: ReactMouseEvent, entry: FileTreeEntry) => void;
  readonly onToggleDirectory: (entry: FileTreeEntry) => void;
  readonly renamingEntryUri: string | undefined;
  readonly renameDraft: string;
  readonly onRenameDraftChange: (value: string) => void;
  readonly onCommitRename: () => void;
  readonly onCancelRename: () => void;
  readonly folderSyncBindingByUri: ReadonlyMap<string, RemoteSyncFolderBindingConfiguration>;
  readonly folderSyncStatuses: Readonly<Record<string, WorkbenchRemoteSyncAutoStatus>>;
  readonly messages: WorkbenchMessages;
}) {
  return (
    <>
      {rows.map((row) => {
        const isRenaming = row.entry.uri.toString() === renamingEntryUri;
        const entryUri = row.entry.uri.toString();
        const folderSyncBinding = row.kind === "directory" ? folderSyncBindingByUri.get(entryUri) : undefined;
        const nameCell = isRenaming ? (
          <TreeRenameInput
            value={renameDraft}
            onChange={onRenameDraftChange}
            onCommit={onCommitRename}
            onCancel={onCancelRename}
          />
        ) : (
          <span className="tp-tree-entry-name">{row.entry.name}</span>
        );

        return (
          <div key={row.key}>
            {row.kind === "directory" ? (
              <div
                className="tp-folder-row"
                style={{ "--tp-tree-depth": row.depth } as TreeStyle}
                data-depth={row.depth}
                role="button"
                tabIndex={0}
                aria-expanded={row.expanded}
                onContextMenu={(event) => onOpenEntryMenu(event, row.entry)}
                onClick={() => {
                  if (!isRenaming) {
                    onToggleDirectory(row.entry);
                  }
                }}
                onKeyDown={(event) => {
                  if (!isRenaming && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault();
                    onToggleDirectory(row.entry);
                  }
                }}
              >
                <span className="tp-tree-disclosure" aria-hidden="true">
                  {row.expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                </span>
                <Folder size={16} />
                {nameCell}
                <FolderSyncBadge
                  binding={folderSyncBinding}
                  status={folderSyncStatuses[entryUri]}
                  messages={messages}
                />
                <span className="tp-folder-row-actions">
                  <TreeActionButton
                    title={messages.shell.showEntryActions(row.entry.name)}
                    onClick={(event) => onOpenEntryMenu(event, row.entry)}
                  >
                    <MoreHorizontal size={14} />
                  </TreeActionButton>
                </span>
              </div>
            ) : (
              <div
                className={row.active ? "tp-file-row tp-tree-file-row tp-file-row-active" : "tp-file-row tp-tree-file-row"}
                style={{ "--tp-tree-depth": row.depth } as TreeStyle}
                data-depth={row.depth}
                role="button"
                tabIndex={0}
                onContextMenu={(event) => onOpenEntryMenu(event, row.entry)}
                onClick={() => {
                  if (!isRenaming && row.fileEntry) {
                    onOpenFile(row.fileEntry);
                  }
                }}
                onKeyDown={(event) => {
                  if (!isRenaming && (event.key === "Enter" || event.key === " ") && row.fileEntry) {
                    event.preventDefault();
                    onOpenFile(row.fileEntry);
                  }
                }}
              >
                <span className="tp-tree-disclosure-spacer" aria-hidden="true" />
                <FileText size={16} />
                {nameCell}
                <span className="tp-file-row-actions">
                  {row.dirty ? <span className="tp-row-dot" /> : null}
                  <TreeActionButton
                    title={messages.shell.showEntryActions(row.entry.name)}
                    onClick={(event) => onOpenEntryMenu(event, row.entry)}
                  >
                    <MoreHorizontal size={14} />
                  </TreeActionButton>
                </span>
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

function TreeRenameInput({
  value,
  onChange,
  onCommit,
  onCancel
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly onCommit: () => void;
  readonly onCancel: () => void;
}) {
  return (
    <input
      className="tp-tree-rename-input"
      value={value}
      autoFocus
      onFocus={(event) => event.currentTarget.select()}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
      onChange={(event) => onChange(event.currentTarget.value)}
      onBlur={() => onCommit()}
      onKeyDown={(event) => {
        event.stopPropagation();

        if (event.key === "Enter") {
          event.preventDefault();
          onCommit();
          return;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    />
  );
}

function FolderSyncBadge({
  binding,
  status,
  messages
}: {
  readonly binding: RemoteSyncFolderBindingConfiguration | undefined;
  readonly status: WorkbenchRemoteSyncAutoStatus | undefined;
  readonly messages: WorkbenchMessages;
}) {
  if (!binding) {
    return null;
  }

  const effectiveStatus = status ?? (binding.lastSyncedAt !== undefined
    ? { state: "synced", lastSyncedAt: binding.lastSyncedAt }
    : { state: "idle" }) satisfies WorkbenchRemoteSyncAutoStatus;
  const title = [
    messages.shell.cloudSyncedFolder(binding.remoteName ?? binding.remoteScopeId),
    formatWorkbenchRemoteSyncAutoStatus(effectiveStatus, messages.status)
  ].filter(Boolean).join(" - ");

  return (
    <span className={`tp-folder-sync-badge tp-folder-sync-badge-${effectiveStatus.state}`} title={title}>
      {renderFolderSyncBadgeIcon(effectiveStatus)}
    </span>
  );
}

function renderFolderSyncBadgeIcon(status: WorkbenchRemoteSyncAutoStatus): ReactNode {
  switch (status.state) {
    case "failed":
      return <CircleAlert size={14} />;
    case "pending":
    case "syncing":
      return <LoaderCircle size={14} />;
    case "synced":
      return <CheckCircle2 size={14} />;
    case "idle":
      return <Cloud size={14} />;
  }
}

interface WorkspaceEntryMenuState {
  readonly entry: FileTreeEntry;
  readonly x: number;
  readonly y: number;
}

function WorkspaceEntryMenu({
  state,
  rootUri,
  binding,
  messages,
  onCreateFile,
  onCreateDirectory,
  onRenameEntry,
  onDeleteEntry,
  onSyncDirectory,
  onUnsyncDirectory
}: {
  readonly state: WorkspaceEntryMenuState;
  readonly rootUri: string;
  readonly binding: RemoteSyncFolderBindingConfiguration | undefined;
  readonly messages: WorkbenchMessages;
  readonly onCreateFile: (entry: FileTreeEntry) => void;
  readonly onCreateDirectory: (entry: FileTreeEntry) => void;
  readonly onRenameEntry: (entry: FileTreeEntry) => void;
  readonly onDeleteEntry: (entry: FileTreeEntry) => void;
  readonly onSyncDirectory: (entry: FileTreeEntry) => void;
  readonly onUnsyncDirectory: (entry: FileTreeEntry) => void;
}) {
  const entry = state.entry;
  const isRoot = entry.uri.toString() === rootUri;
  const menuStyle = {
    "--tp-menu-x": `${state.x}px`,
    "--tp-menu-y": `${state.y}px`
  } as TreeStyle;

  return (
    <div
      className="tp-entry-menu"
      role="menu"
      style={menuStyle}
      onClick={(event) => event.stopPropagation()}
      onContextMenu={(event) => event.stopPropagation()}
    >
      {entry.kind === "directory" ? (
        <>
          <button className="tp-entry-menu-item" type="button" role="menuitem" onClick={() => onCreateFile(entry)}>
            <FilePlus size={14} />
            <span>{messages.shell.newFile}</span>
          </button>
          <button className="tp-entry-menu-item" type="button" role="menuitem" onClick={() => onCreateDirectory(entry)}>
            <FolderPlus size={14} />
            <span>{messages.shell.newFolder}</span>
          </button>
          <button className="tp-entry-menu-item" type="button" role="menuitem" onClick={() => onSyncDirectory(entry)}>
            <Cloud size={14} />
            <span>{messages.shell.syncDirectory}</span>
          </button>
          {binding ? (
            <button className="tp-entry-menu-item" type="button" role="menuitem" onClick={() => onUnsyncDirectory(entry)}>
              <X size={14} />
              <span>{messages.shell.unsyncDirectory}</span>
            </button>
          ) : null}
        </>
      ) : null}
      {!isRoot ? (
        <>
          <button className="tp-entry-menu-item" type="button" role="menuitem" onClick={() => onRenameEntry(entry)}>
            <Pencil size={14} />
            <span>{messages.shell.renameEntry}</span>
          </button>
          <button className="tp-entry-menu-item tp-entry-menu-item-danger" type="button" role="menuitem" onClick={() => onDeleteEntry(entry)}>
            <Trash2 size={14} />
            <span>{messages.common.delete}</span>
          </button>
        </>
      ) : null}
    </div>
  );
}

function RemoteSyncFolderDialog({
  state,
  actions,
  messages,
  onBind,
  onClose
}: {
  readonly state: FolderSyncDialogState;
  readonly actions: WorkbenchRemoteSyncLarkAuthActions;
  readonly messages: WorkbenchMessages;
  readonly onBind: (
    entry: FileTreeEntry,
    provider: RemoteSyncProviderConfiguration,
    folder: WorkbenchRemoteSyncLarkFolder
  ) => void;
  readonly onClose: () => void;
}) {
  const initialToken = state.binding?.remoteScopeId ?? state.provider.remoteScopeId ?? "";
  const initialPath = useMemo(
    () => createRemoteSyncFolderPickerPath(
      initialToken,
      messages,
      state.binding?.remoteName
    ),
    [initialToken, messages, state.binding?.remoteName]
  );
  const [picker, setPicker] = useState<RemoteSyncFolderPickerState>({
    status: "idle",
    currentToken: initialToken,
    folders: [],
    path: initialPath
  });
  const [folderNameDraft, setFolderNameDraft] = useState("");

  const listFolders = useCallback((
    token: string,
    path: readonly RemoteSyncFolderPickerPathEntry[]
  ) => {
    if (!actions.isAvailable) {
      setPicker({
        status: "failed",
        currentToken: token,
        folders: [],
        path,
        message: messages.remoteSync.larkAuth.requestUnavailable
      });
      return;
    }

    setPicker({
      status: "loading",
      currentToken: token,
      folders: [],
      path
    });

    void actions.listFolders(state.provider, token).then((folders) => {
      setPicker({
        status: folders ? "ready" : "failed",
        currentToken: token,
        folders: folders ?? [],
        path,
        ...(folders ? {} : { message: messages.settings.larkFolderListFailed })
      });
    });
  }, [actions, messages.remoteSync.larkAuth.requestUnavailable, messages.settings.larkFolderListFailed, state.provider]);

  useEffect(() => {
    listFolders(initialToken, initialPath);
  }, [initialPath, initialToken, listFolders]);

  const openFolder = (folder: WorkbenchRemoteSyncLarkFolder) => {
    listFolders(folder.token, appendRemoteSyncFolderPickerPath(picker.path, folder));
  };
  const chooseFolder = (folder: WorkbenchRemoteSyncLarkFolder) => {
    onBind(state.entry, state.provider, folder);
  };
  const chooseCurrentFolder = () => {
    const current = picker.path[picker.path.length - 1];
    onBind(state.entry, state.provider, {
      token: picker.currentToken,
      name: current?.name ?? messages.shell.folderSyncRoot
    });
  };
  const createAndChooseFolder = () => {
    if (!actions.isAvailable || picker.status === "creating") {
      return;
    }

    const name = folderNameDraft.trim();

    if (!name) {
      setPicker((current) => ({
        ...current,
        status: "failed",
        message: messages.settings.larkFolderCreatePrompt
      }));
      return;
    }

    setPicker((current) => ({
      ...current,
      status: "creating"
    }));

    void actions.createFolder(state.provider, {
      name,
      parentToken: picker.currentToken
    }).then((folder) => {
      if (!folder) {
        setPicker((current) => ({
          ...current,
          status: "failed",
          message: messages.settings.larkFolderListFailed
        }));
        return;
      }

      setFolderNameDraft("");
      onBind(state.entry, state.provider, folder);
    });
  };
  const statusMessage = formatRemoteSyncFolderPickerStatusMessage(picker, messages);

  return (
    <div className="tp-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-dialog tp-folder-sync-dialog"
        role="dialog"
        aria-label={messages.shell.folderSyncDialogTitle(state.entry.name)}
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-dialog-header">
          <div className="tp-dialog-title tp-folder-sync-dialog-title">
            <Cloud size={18} />
            <span>{messages.shell.folderSyncDialogTitle(state.entry.name)}</span>
          </div>
          <IconButton title={messages.common.close} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="tp-folder-sync-body">
          <div className="tp-folder-sync-meta">
            <span>{messages.shell.folderSyncProvider}</span>
            <strong>{state.provider.title}</strong>
          </div>
          <div className="tp-folder-sync-meta">
            <span>{messages.shell.folderSyncLocalTarget}</span>
            <strong>{state.entry.relativePath || state.entry.name}</strong>
          </div>
          <div className="tp-folder-sync-create">
            <input
              value={folderNameDraft}
              aria-label={messages.shell.folderSyncCreateName}
              placeholder={messages.shell.folderSyncCreateName}
              disabled={!actions.isAvailable || picker.status === "creating"}
              onChange={(event) => setFolderNameDraft(event.currentTarget.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  createAndChooseFolder();
                }
              }}
            />
            <button
              className="tp-dialog-button"
              type="button"
              disabled={!actions.isAvailable || picker.status === "creating" || !folderNameDraft.trim()}
              onClick={createAndChooseFolder}
            >
              <FolderPlus size={15} />
              <span>{messages.shell.folderSyncCreateFolder}</span>
            </button>
          </div>
          <div className="tp-folder-sync-current">
            <span>{messages.shell.folderSyncCurrentRemote}</span>
            <span className="tp-folder-sync-breadcrumb">
              {picker.path.map((entry, index) => (
                <button
                  key={`${entry.token}:${index}`}
                  type="button"
                  disabled={picker.status === "loading" || picker.status === "creating"}
                  onClick={() => listFolders(entry.token, picker.path.slice(0, index + 1))}
                >
                  {entry.name}
                </button>
              ))}
            </span>
            <button
              className="tp-dialog-button"
              type="button"
              disabled={!actions.isAvailable || picker.status === "loading" || picker.status === "creating"}
              onClick={chooseCurrentFolder}
            >
              <CheckCircle2 size={15} />
              <span>{messages.shell.folderSyncSelectCurrent}</span>
            </button>
          </div>
          <div className="tp-folder-sync-list" aria-label={messages.shell.folderSyncRemoteFolders}>
            {picker.folders.length > 0 ? picker.folders.map((folder) => (
              <div className="tp-folder-sync-row" key={folder.token}>
                <button
                  className="tp-folder-sync-open"
                  type="button"
                  disabled={picker.status === "loading" || picker.status === "creating"}
                  onClick={() => openFolder(folder)}
                >
                  <FolderOpen size={15} />
                  <span>{folder.name}</span>
                </button>
                <button
                  className="tp-dialog-button"
                  type="button"
                  disabled={picker.status === "loading" || picker.status === "creating"}
                  onClick={() => chooseFolder(folder)}
                >
                  <CheckCircle2 size={15} />
                  <span>{messages.shell.folderSyncSelectFolder}</span>
                </button>
              </div>
            )) : (
              <div className="tp-empty-row">{messages.shell.folderSyncNoFolders}</div>
            )}
          </div>
          {statusMessage ? (
            <div className={`tp-folder-sync-status tp-folder-sync-status-${picker.status}`}>
              {picker.status === "loading" || picker.status === "creating" ? <LoaderCircle size={13} /> : null}
              <span>{statusMessage}</span>
            </div>
          ) : null}
        </div>
        <div className="tp-dialog-actions">
          <button className="tp-dialog-button tp-dialog-button-primary" type="button" onClick={onClose}>
            <span>{messages.common.close}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function getActiveRemoteSyncFolderBindings(
  bindings: readonly RemoteSyncFolderBindingConfiguration[],
  root: FileTreeEntry
): readonly ActiveRemoteSyncFolderBinding[] {
  return bindings.flatMap((binding) => {
    const entry = findFileTreeEntryByUri(root, binding.localUri);

    if (!entry || entry.kind !== "directory") {
      return [];
    }

    return [{ binding, entry }];
  });
}

function findFileTreeEntryByUri(entry: FileTreeEntry, uri: string): FileTreeEntry | undefined {
  if (entry.uri.toString() === uri) {
    return entry;
  }

  for (const child of entry.children ?? []) {
    const match = findFileTreeEntryByUri(child, uri);

    if (match) {
      return match;
    }
  }

  return undefined;
}

function findFileTreeEntryByRelativePath(entry: FileTreeEntry, relativePath: string): FileTreeEntry | undefined {
  if (entry.relativePath === relativePath) {
    return entry;
  }

  for (const child of entry.children ?? []) {
    const match = findFileTreeEntryByRelativePath(child, relativePath);

    if (match) {
      return match;
    }
  }

  return undefined;
}

function findRemoteSyncFolderBinding(
  bindings: readonly RemoteSyncFolderBindingConfiguration[],
  entry: FileTreeEntry
): RemoteSyncFolderBindingConfiguration | undefined {
  const localUri = entry.uri.toString();
  return bindings.find((binding) => binding.localUri === localUri);
}

function findRemoteSyncFolderBindingProvider(
  providers: readonly RemoteSyncProviderConfiguration[],
  binding: RemoteSyncFolderBindingConfiguration | undefined
): RemoteSyncProviderConfiguration | undefined {
  if (binding) {
    return providers.find((provider) => provider.id === binding.providerId);
  }

  return providers[0];
}

function createRemoteSyncFolderBinding(
  entry: FileTreeEntry,
  provider: RemoteSyncProviderConfiguration,
  folder: WorkbenchRemoteSyncLarkFolder
): RemoteSyncFolderBindingConfiguration {
  const localUri = entry.uri.toString();

  return {
    id: createRemoteSyncFolderBindingId(localUri, provider.id, folder.token),
    localUri,
    localRelativePath: entry.relativePath,
    localName: entry.name,
    providerId: provider.id,
    remoteScopeId: folder.token,
    remoteName: folder.name,
    ...(folder.url ? { remoteUrl: folder.url } : {})
  };
}

function upsertRemoteSyncFolderBinding(
  bindings: readonly RemoteSyncFolderBindingConfiguration[],
  binding: RemoteSyncFolderBindingConfiguration
): readonly RemoteSyncFolderBindingConfiguration[] {
  const next = bindings.filter((candidate) =>
    candidate.localUri !== binding.localUri && candidate.id !== binding.id
  );

  return [...next, binding];
}

function removeRemoteSyncFolderBinding(
  bindings: readonly RemoteSyncFolderBindingConfiguration[],
  entry: FileTreeEntry
): readonly RemoteSyncFolderBindingConfiguration[] {
  const localUri = entry.uri.toString();
  return bindings.filter((binding) => binding.localUri !== localUri);
}

function updateRemoteSyncFolderBindingLastSynced(
  services: Pick<WorkbenchServices, "configurationService">,
  binding: RemoteSyncFolderBindingConfiguration,
  syncedAt: number
): void {
  const configuration = services.configurationService.getValue();
  const folderBindings = configuration.remoteSync.folderBindings.map((candidate) =>
    candidate.localUri === binding.localUri
      ? { ...candidate, lastSyncedAt: syncedAt }
      : candidate
  );

  services.configurationService.updateValue({
    remoteSync: {
      ...configuration.remoteSync,
      folderBindings
    }
  });
}

function updateRenamedRemoteSyncFolderBinding(
  services: Pick<WorkbenchServices, "configurationService">,
  configuration: TyporaPlusConfiguration,
  oldEntry: FileTreeEntry,
  newEntry: FileTreeEntry
): void {
  const oldUri = oldEntry.uri.toString();
  const oldPrefix = oldEntry.relativePath ? `${oldEntry.relativePath}/` : "";
  const newPrefix = newEntry.relativePath ? `${newEntry.relativePath}/` : "";
  let changed = false;

  const folderBindings = configuration.remoteSync.folderBindings.map((binding) => {
    if (binding.localUri === oldUri || binding.localRelativePath === oldEntry.relativePath) {
      changed = true;
      return {
        ...binding,
        localUri: newEntry.uri.toString(),
        localRelativePath: newEntry.relativePath,
        localName: newEntry.name
      };
    }

    if (!oldPrefix || !binding.localRelativePath.startsWith(oldPrefix)) {
      return binding;
    }

    const nextRelativePath = `${newPrefix}${binding.localRelativePath.slice(oldPrefix.length)}`;
    const nextEntry = findFileTreeEntryByRelativePath(newEntry, nextRelativePath);

    if (!nextEntry || nextEntry.kind !== "directory") {
      return binding;
    }

    changed = true;
    return {
      ...binding,
      localUri: nextEntry.uri.toString(),
      localRelativePath: nextEntry.relativePath,
      localName: nextEntry.name
    };
  });

  if (!changed) {
    return;
  }

  services.configurationService.updateValue({
    remoteSync: {
      ...configuration.remoteSync,
      folderBindings
    }
  });
}

function removeDeletedRemoteSyncFolderBindings(
  services: Pick<WorkbenchServices, "configurationService">,
  configuration: TyporaPlusConfiguration,
  entry: FileTreeEntry
): void {
  const deletedUri = entry.uri.toString();
  const folderBindings = configuration.remoteSync.folderBindings.filter((binding) =>
    binding.localUri !== deletedUri &&
    !isRelativePathInside(binding.localRelativePath, entry.relativePath)
  );

  if (folderBindings.length === configuration.remoteSync.folderBindings.length) {
    return;
  }

  services.configurationService.updateValue({
    remoteSync: {
      ...configuration.remoteSync,
      folderBindings
    }
  });
}

function mapRemoteSyncFolderBindingsByLocalUri(
  bindings: readonly RemoteSyncFolderBindingConfiguration[]
): ReadonlyMap<string, RemoteSyncFolderBindingConfiguration> {
  return new Map(bindings.map((binding) => [binding.localUri, binding]));
}

function createRemoteSyncFolderBindingId(localUri: string, providerId: string, remoteScopeId: string): string {
  return `folder:${hashRemoteSyncFolderBindingPart(localUri)}:${hashRemoteSyncFolderBindingPart(providerId)}:${hashRemoteSyncFolderBindingPart(remoteScopeId)}`;
}

function hashRemoteSyncFolderBindingPart(value: string): string {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function isRelativePathInside(relativePath: string, parentRelativePath: string): boolean {
  if (!parentRelativePath) {
    return true;
  }

  return relativePath === parentRelativePath || relativePath.startsWith(`${parentRelativePath}/`);
}

function createRemoteSyncFolderPickerPath(
  token: string,
  messages: WorkbenchMessages,
  name?: string
): readonly RemoteSyncFolderPickerPathEntry[] {
  const root = {
    token: "",
    name: messages.shell.folderSyncRoot
  };

  if (!token) {
    return [root];
  }

  return [
    root,
    {
      token,
      name: name || token
    }
  ];
}

function appendRemoteSyncFolderPickerPath(
  path: readonly RemoteSyncFolderPickerPathEntry[],
  folder: WorkbenchRemoteSyncLarkFolder
): readonly RemoteSyncFolderPickerPathEntry[] {
  return [
    ...path,
    {
      token: folder.token,
      name: folder.name
    }
  ];
}

function formatRemoteSyncFolderPickerStatusMessage(
  picker: RemoteSyncFolderPickerState,
  messages: WorkbenchMessages
): string {
  if (picker.message) {
    return picker.message;
  }

  switch (picker.status) {
    case "loading":
      return messages.shell.folderSyncLoading;
    case "creating":
      return messages.shell.folderSyncCreating;
    case "failed":
      return messages.settings.larkFolderListFailed;
    case "idle":
    case "ready":
      return "";
  }
}

function TreeActionButton({
  title,
  children,
  onClick
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClick: (event: ReactMouseEvent<HTMLButtonElement>) => void;
}) {
  return (
    <button
      className="tp-tree-action-button"
      type="button"
      aria-label={title}
      title={title}
      onClick={(event) => {
        event.stopPropagation();
        onClick(event);
      }}
    >
      {children}
    </button>
  );
}

function promptForWorkspaceEntryName(message: string, defaultValue: string): string | undefined {
  const value = window.prompt(message, defaultValue);
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function SearchPanel({
  query,
  results,
  indexStatus,
  messages,
  onQueryChange,
  onOpenResult
}: {
  readonly query: string;
  readonly results: readonly WorkbenchSearchResult[];
  readonly indexStatus: WorkspaceIndexStatus;
  readonly messages: WorkbenchMessages;
  readonly onQueryChange: (value: string) => void;
  readonly onOpenResult: (result: WorkbenchSearchResult) => void;
}) {
  return (
    <div className="tp-sidebar-content">
      <div className="tp-search-field">
        <Search size={15} />
        <input
          value={query}
          aria-label={messages.shell.searchNote}
          placeholder={messages.shell.search}
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query ? (
          <button type="button" aria-label={messages.shell.clearSearch} onClick={() => onQueryChange("")}>
            <X size={14} />
          </button>
        ) : null}
      </div>
      {indexStatus.state === "indexing" ? (
        <div className="tp-search-status">
          {messages.shell.indexedStatus(indexStatus.indexedFiles, indexStatus.totalFiles)}
        </div>
      ) : null}
      <div className="tp-result-list">
        {results.map((result) => (
          <button
            className="tp-result-row"
            key={searchResultKey(result)}
            type="button"
            onClick={() => onOpenResult(result)}
          >
            <span className="tp-result-line">{result.line}</span>
            <span className="tp-result-body">
              {isWorkspaceSearchResult(result) ? <small>{result.relativePath}</small> : null}
              <span className="tp-result-preview">{result.preview}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function OutlinePanel({
  outline,
  onSelectLine
}: {
  readonly outline: readonly OutlineEntry[];
  readonly onSelectLine: (line: number) => void;
}) {
  return (
    <div className="tp-sidebar-content">
      {outline.map((entry) => (
        <button
          className="tp-outline-row"
          data-level={entry.level}
          key={entry.id}
          type="button"
          onClick={() => onSelectLine(entry.line)}
        >
          {entry.text}
        </button>
      ))}
    </div>
  );
}

function BacklinksPanel({
  backlinks,
  indexStatus,
  messages,
  onOpenBacklink
}: {
  readonly backlinks: readonly WorkspaceIndexedLink[];
  readonly indexStatus: WorkspaceIndexStatus;
  readonly messages: WorkbenchMessages;
  readonly onOpenBacklink: (link: WorkspaceIndexedLink) => void;
}) {
  return (
    <div className="tp-sidebar-content">
      {indexStatus.state === "indexing" ? (
        <div className="tp-search-status">
          {messages.shell.indexedStatus(indexStatus.indexedFiles, indexStatus.totalFiles)}
        </div>
      ) : null}
      <div className="tp-result-list">
        {backlinks.length > 0 ? backlinks.map((link, index) => (
          <button
            className="tp-result-row"
            key={backlinkKey(link, index)}
            type="button"
            onClick={() => onOpenBacklink(link)}
          >
            <span className="tp-result-line">{link.line}</span>
            <span className="tp-result-body">
              <small>{link.relativePath}</small>
              <span className="tp-result-preview">{formatBacklinkPreview(link)}</span>
            </span>
          </button>
        )) : <div className="tp-empty-row">{messages.shell.noBacklinks}</div>}
      </div>
    </div>
  );
}

function TagsPanel({
  tags,
  selectedTag,
  taggedResources,
  indexStatus,
  messages,
  onSelectTag,
  onOpenTaggedResource
}: {
  readonly tags: readonly WorkspaceIndexedTagSummary[];
  readonly selectedTag: string | undefined;
  readonly taggedResources: readonly WorkspaceIndexedTag[];
  readonly indexStatus: WorkspaceIndexStatus;
  readonly messages: WorkbenchMessages;
  readonly onSelectTag: (tag: string) => void;
  readonly onOpenTaggedResource: (tag: WorkspaceIndexedTag) => void;
}) {
  const tagRows = createWorkbenchTagRows(tags, selectedTag);

  return (
    <div className="tp-sidebar-content">
      {indexStatus.state === "indexing" ? (
        <div className="tp-search-status">
          {messages.shell.indexedStatus(indexStatus.indexedFiles, indexStatus.totalFiles)}
        </div>
      ) : null}
      {tags.length > 0 ? (
        <>
          <section className="tp-tag-list" aria-label={messages.shell.tagsAriaLabel}>
            {tagRows.map((row) => {
              return (
                <button
                  className={row.active ? "tp-tag-row tp-tag-row-active" : "tp-tag-row"}
                  key={row.key}
                  type="button"
                  onClick={() => onSelectTag(row.tag.tag)}
                >
                  <span>#{row.tag.tag}</span>
                  <small>{row.tag.count}</small>
                </button>
              );
            })}
          </section>
          <div className="tp-section-label">{messages.shell.notes}</div>
          <div className="tp-result-list">
            {taggedResources.map((tag, index) => (
              <button
                className="tp-result-row"
                key={tagResourceKey(tag, index)}
                type="button"
                onClick={() => onOpenTaggedResource(tag)}
              >
                <span className="tp-result-line">{tag.line}</span>
                <span className="tp-result-body">
                  <small>{tag.relativePath}</small>
                  <span className="tp-result-preview">#{tag.tag}</span>
                </span>
              </button>
            ))}
          </div>
        </>
      ) : <div className="tp-empty-row">{messages.shell.noTags}</div>}
    </div>
  );
}

function Statusbar({
  model,
  stats,
  operationError,
  messages,
  remoteSyncStatus,
  showRemoteSyncStatus
}: {
  readonly model: TextFileModel;
  readonly stats: ReturnType<typeof calculateMarkdownStats>;
  readonly operationError: string | undefined;
  readonly messages: WorkbenchMessages;
  readonly remoteSyncStatus: WorkbenchRemoteSyncAutoStatus;
  readonly showRemoteSyncStatus: boolean;
}) {
  return (
    <footer className="tp-statusbar">
      {operationError ? <span className="tp-status-error">{operationError}</span> : null}
      {showRemoteSyncStatus ? (
        <RemoteSyncStatusbarItem messages={messages} status={remoteSyncStatus} />
      ) : null}
      <span>{model.dirty ? messages.status.saving : messages.status.saved}</span>
      <span>{messages.status.words(stats.words)}</span>
      <span>{messages.status.lines(stats.lines)}</span>
    </footer>
  );
}

function RemoteSyncStatusbarItem({
  messages,
  status
}: {
  readonly messages: WorkbenchMessages;
  readonly status: WorkbenchRemoteSyncAutoStatus;
}) {
  const label = formatWorkbenchRemoteSyncAutoStatus(status, messages.status);
  const className = `tp-sync-status tp-sync-status-${status.state}`;
  const icon = createRemoteSyncStatusbarIcon(status.state);

  return (
    <span className={className} title={label}>
      {icon}
      <span>{label}</span>
    </span>
  );
}

function createRemoteSyncStatusbarIcon(state: WorkbenchRemoteSyncAutoStatus["state"]): ReactNode {
  switch (state) {
    case "failed":
      return <AlertTriangle className="tp-sync-status-icon" size={13} />;
    case "pending":
    case "syncing":
      return <LoaderCircle className="tp-sync-status-icon" size={13} />;
    case "synced":
      return <CheckCircle2 className="tp-sync-status-icon" size={13} />;
    case "idle":
      return <Cloud className="tp-sync-status-icon" size={13} />;
  }
}

function SaveConflictDialog({
  conflict,
  messages,
  onClose,
  onReload,
  onOverwrite
}: {
  readonly conflict: FileSaveConflict;
  readonly messages: WorkbenchMessages;
  readonly onClose: () => void;
  readonly onReload: () => void;
  readonly onOverwrite: () => void;
}) {
  return (
    <div className="tp-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-dialog"
        role="alertdialog"
        aria-label={messages.dialogs.saveConflict.ariaLabel}
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-dialog-header">
          <div className="tp-dialog-title">
            <AlertTriangle size={18} />
            <span>{messages.dialogs.saveConflict.title}</span>
          </div>
          <IconButton title={messages.common.close} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <p className="tp-dialog-message">{conflict.uri.path}</p>
        <div className="tp-dialog-actions">
          <button className="tp-dialog-button" type="button" onClick={onReload}>
            <RefreshCw size={15} />
            <span>{messages.dialogs.saveConflict.reload}</span>
          </button>
          <button className="tp-dialog-button tp-dialog-button-primary" type="button" onClick={onOverwrite}>
            <Save size={15} />
            <span>{messages.dialogs.saveConflict.overwrite}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function AiResponseDialog({
  result,
  messages,
  onApply,
  onClose
}: {
  readonly result: WorkbenchAiResponse;
  readonly messages: WorkbenchMessages;
  readonly onApply: () => Promise<boolean>;
  readonly onClose: () => void;
}) {
  const [copyState, setCopyState] = useState<"idle" | "copied" | "failed">("idle");
  const [applyState, setApplyState] = useState<WorkbenchAiResponseApplyState>("idle");
  const canCopyResponse = result.response.value.length > 0;
  const canApplyResponse = canCopyResponse && applyState !== "applied";
  const metadata = createWorkbenchAiResponseMetadata(result.response, messages.dialogs.aiResponse.tokenUsage);

  useEffect(() => {
    setCopyState("idle");
    setApplyState("idle");
  }, [result.applyMode, result.response.value]);

  const onCopy = () => {
    void copyWorkbenchTextToClipboard(result.response.value).then((copied) => {
      setCopyState(copied ? "copied" : "failed");
    });
  };
  const onApplyResponse = () => {
    void onApply().then((applied) => {
      setApplyState(applied ? "applied" : "failed");
    });
  };

  return (
    <div className="tp-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-dialog tp-ai-dialog"
        role="dialog"
        aria-label={messages.dialogs.aiResponse.ariaLabel}
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-dialog-header">
          <div className="tp-dialog-title tp-ai-dialog-title">
            <FileText size={18} />
            <span>{messages.dialogs.aiResponse.titles[result.action] ?? result.title}</span>
          </div>
          <IconButton title={messages.common.close} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="tp-ai-dialog-body">
          <div className="tp-ai-dialog-meta">
            {metadata.map((item) => <span key={item.id}>{item.value}</span>)}
          </div>
          <p className="tp-ai-response">{result.response.value || messages.dialogs.aiResponse.noContent}</p>
        </div>
        <div className="tp-dialog-actions">
          <button
            className="tp-dialog-button"
            type="button"
            disabled={!canCopyResponse}
            onClick={onCopy}
          >
            <Copy size={15} />
            <span>{formatWorkbenchAiResponseCopyLabel(copyState, messages)}</span>
          </button>
          <button
            className="tp-dialog-button"
            type="button"
            disabled={!canApplyResponse}
            onClick={onApplyResponse}
          >
            <Plus size={15} />
            <span>{formatLocalizedWorkbenchAiResponseApplyLabel(result.applyMode, applyState, messages)}</span>
          </button>
          <button className="tp-dialog-button tp-dialog-button-primary" type="button" onClick={onClose}>
            <span>{messages.common.close}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function RemoteSyncPlanDialog({
  execution,
  executing,
  messages,
  onCancel,
  onExecute,
  onResolveConflicts,
  progressEvents,
  result,
  onClose
}: {
  readonly execution: WorkbenchRemoteSyncExecutionResult | undefined;
  readonly executing: boolean;
  readonly messages: WorkbenchMessages;
  readonly onCancel: () => void;
  readonly onExecute: () => Promise<boolean>;
  readonly onResolveConflicts: (resolution: WorkbenchRemoteSyncConflictResolution) => void;
  readonly progressEvents: readonly RemoteSyncProgress[];
  readonly result: WorkbenchRemoteSyncPlanResult;
  readonly onClose: () => void;
}) {
  const planOperationPreview = createWorkbenchRemoteSyncDialogOperationPreview(result.plan.operations, {
    emptyMessage: messages.dialogs.remoteSync.noOperationsPlanned,
    maxOperations: remoteSyncOperationPreviewLimit
  });
  const conflictOperationPreview = result.plan.summary.conflicts > 0
    ? createWorkbenchRemoteSyncDialogConflictPreview(result.plan.operations, {
      emptyMessage: messages.dialogs.remoteSync.noConflicts,
      maxOperations: remoteSyncConflictPreviewLimit
    })
    : undefined;
  const executionOperationPreview = execution
    ? createWorkbenchRemoteSyncDialogOperationPreview(execution.result.operations, {
      emptyMessage: messages.dialogs.remoteSync.noOperationsExecuted,
      maxOperations: remoteSyncOperationPreviewLimit
    })
    : undefined;
  const progressPreview = progressEvents.length > 0
    ? createWorkbenchRemoteSyncDialogProgressPreview(progressEvents, {
      emptyMessage: messages.dialogs.remoteSync.noProgressReported,
      maxEvents: remoteSyncProgressPreviewLimit
    })
    : undefined;
  const executionState = createWorkbenchRemoteSyncDialogExecutionState(result.plan, {
    executing,
    execution,
    messages: messages.dialogs.remoteSync,
    progress: getWorkbenchRemoteSyncLatestProgress(progressEvents)
  });
  const conflictResolutionState = createWorkbenchRemoteSyncDialogConflictResolutionState(result.plan, {
    executing,
    execution,
    messages: messages.dialogs.remoteSync
  });
  const remoteScopeId = result.request.remoteScopeId?.trim()
    ? result.request.remoteScopeId
    : messages.dialogs.remoteSync.defaultRemoteScope;

  return (
    <div className="tp-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-dialog tp-ai-dialog tp-remote-sync-dialog"
        role="dialog"
        aria-label={messages.dialogs.remoteSync.ariaLabel}
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-dialog-header">
          <div className="tp-dialog-title tp-ai-dialog-title">
            <RefreshCw size={18} />
            <span>{messages.dialogs.remoteSync.title}</span>
          </div>
          <IconButton title={messages.common.close} onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <div className="tp-ai-dialog-body">
          <div className="tp-ai-dialog-meta">
            <span>{messages.dialogs.remoteSync.providerLabel(result.providerId)}</span>
            <span>{formatWorkbenchRemoteSyncDirection(result.request.direction, messages.dialogs.remoteSync)}</span>
            <span>{messages.dialogs.remoteSync.remoteScopeLabel(remoteScopeId)}</span>
            <span>{messages.dialogs.remoteSync.workspaceLabel(result.request.workspaceUri.toString())}</span>
            {result.request.dryRun ? <span>{messages.dialogs.remoteSync.dryRun}</span> : null}
            {execution?.result.completedAt !== undefined ? (
              <span>{messages.dialogs.remoteSync.completedAt(execution.result.completedAt)}</span>
            ) : null}
          </div>
          <p className="tp-dialog-summary">
            {formatWorkbenchRemoteSyncSummary(result.plan.summary, messages.dialogs.remoteSync)}
          </p>
          <RemoteSyncOperationPreviewList
            label={messages.dialogs.remoteSync.planOperations}
            messages={messages}
            preview={planOperationPreview}
          />
          {conflictOperationPreview ? (
            <RemoteSyncOperationPreviewList
              label={messages.dialogs.remoteSync.conflicts}
              messages={messages}
              preview={conflictOperationPreview}
            />
          ) : null}
          {executionState.statusMessage ? (
            execution ? (
              <p className="tp-dialog-status">{executionState.statusMessage}</p>
            ) : (
              <div className="tp-dialog-status">{executionState.statusMessage}</div>
            )
          ) : null}
          {progressPreview ? (
            <RemoteSyncProgressPreviewList
              label={messages.dialogs.remoteSync.progress}
              messages={messages}
              preview={progressPreview}
            />
          ) : null}
          {executionOperationPreview ? (
            <RemoteSyncOperationPreviewList
              label={messages.dialogs.remoteSync.executedOperations}
              messages={messages}
              preview={executionOperationPreview}
            />
          ) : null}
        </div>
        <div className="tp-dialog-actions">
          {executionState.canCancel ? (
            <button
              className="tp-dialog-button"
              type="button"
              onClick={onCancel}
            >
              <span>{messages.dialogs.remoteSync.cancel}</span>
            </button>
          ) : null}
          {conflictResolutionState.canResolve ? (
            <>
              <button
                className="tp-dialog-button"
                type="button"
                onClick={() => onResolveConflicts(workbenchRemoteSyncConflictResolutions.useLocal)}
              >
                <HardDrive size={15} />
                <span>{conflictResolutionState.useLocalLabel}</span>
              </button>
              <button
                className="tp-dialog-button"
                type="button"
                onClick={() => onResolveConflicts(workbenchRemoteSyncConflictResolutions.useRemote)}
              >
                <Cloud size={15} />
                <span>{conflictResolutionState.useRemoteLabel}</span>
              </button>
            </>
          ) : null}
          <button
            className="tp-dialog-button"
            type="button"
            onClick={onExecute}
            disabled={!executionState.canExecute}
          >
            <span>{executionState.executeLabel}</span>
          </button>
          <button className="tp-dialog-button tp-dialog-button-primary" type="button" onClick={onClose}>
            <span>{messages.common.close}</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function RemoteSyncOperationPreviewList({
  label,
  messages,
  preview
}: {
  readonly label?: string;
  readonly messages: WorkbenchMessages;
  readonly preview: {
    readonly emptyMessage: string;
    readonly hiddenOperationCount: number;
    readonly operations: readonly RemoteSyncOperation[];
  };
}) {
  if (preview.operations.length === 0) {
    return <div className="tp-empty-row">{preview.emptyMessage}</div>;
  }

  return (
    <div className="tp-result-list">
      {label ? <div className="tp-empty-row">{label}</div> : null}
      {preview.operations.map((operation, index) => (
        <div className="tp-result-row" key={`${operation.relativePath}:${operation.kind}:${index}`}>
          <span className="tp-result-line">
            {formatWorkbenchRemoteSyncOperationKind(operation.kind, messages.dialogs.remoteSync)}
          </span>
          <span className="tp-result-body">
            <small>{formatWorkbenchRemoteSyncOperationDetail(operation, messages.dialogs.remoteSync)}</small>
            <span className="tp-result-preview">{operation.relativePath}</span>
          </span>
        </div>
      ))}
      {preview.hiddenOperationCount > 0 ? (
        <div className="tp-empty-row">
          {messages.dialogs.remoteSync.moreOperations(preview.hiddenOperationCount)}
        </div>
      ) : null}
    </div>
  );
}

function RemoteSyncProgressPreviewList({
  label,
  messages,
  preview
}: {
  readonly label?: string;
  readonly messages: WorkbenchMessages;
  readonly preview: {
    readonly emptyMessage: string;
    readonly hiddenProgressCount: number;
    readonly progressEvents: readonly RemoteSyncProgress[];
  };
}) {
  if (preview.progressEvents.length === 0) {
    return <div className="tp-empty-row">{preview.emptyMessage}</div>;
  }

  return (
    <div className="tp-result-list">
      {label ? <div className="tp-empty-row">{label}</div> : null}
      {preview.progressEvents.map((progress, index) => (
        <div className="tp-result-row" key={`${progress.message}:${index}`}>
          <span className="tp-result-line">{messages.dialogs.remoteSync.progress}</span>
          <span className="tp-result-body">
            <span className="tp-result-preview">
              {formatWorkbenchRemoteSyncProgress(progress, messages.dialogs.remoteSync)}
            </span>
          </span>
        </div>
      ))}
      {preview.hiddenProgressCount > 0 ? (
        <div className="tp-empty-row">
          {messages.dialogs.remoteSync.earlierProgressEvents(preview.hiddenProgressCount)}
        </div>
      ) : null}
    </div>
  );
}

function CommandPalette({
  open,
  commands,
  getKeybindingLabel,
  messages,
  onClose,
  onExecute
}: {
  readonly open: boolean;
  readonly commands: readonly { readonly id: string; readonly title: string; readonly category?: string }[];
  readonly getKeybindingLabel: (id: string) => string | undefined;
  readonly messages: WorkbenchMessages;
  readonly onClose: () => void;
  readonly onExecute: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredCommands = useMemo(
    () => filterCommandPaletteCommands(commands, query, {
      getKeybindingLabel: (command) => getKeybindingLabel(command.id)
    }),
    [commands, getKeybindingLabel, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    return scheduleWorkbenchOverlayFocus(window, {
      getFocusTarget: () => inputRef.current
    });
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) => normalizeListSelection(index, filteredCommands.length));
  }, [filteredCommands.length]);

  if (!open) {
    return null;
  }

  const activeCommandIndex = normalizeListSelection(activeIndex, filteredCommands.length);

  return (
    <div className="tp-command-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-command-palette"
        role="dialog"
        aria-label={messages.dialogs.commandPalette.ariaLabel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-command-input">
          <CommandIcon size={17} />
          <input
            ref={inputRef}
            value={query}
            aria-label={messages.dialogs.commandPalette.commandInput}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              const key = event.key;

              if (key === "Escape") {
                onClose();
                return;
              }
              if (isListNavigationKey(key)) {
                event.preventDefault();
                setActiveIndex((index) => moveListSelection(index, filteredCommands.length, key));
                return;
              }
              if (key === "Enter" && filteredCommands[activeCommandIndex]) {
                onExecute(filteredCommands[activeCommandIndex].id);
              }
            }}
          />
        </div>
        <div className="tp-command-list">
          {filteredCommands.map((command, index) => {
            const keybindingLabel = getKeybindingLabel(command.id);
            const active = index === activeCommandIndex;

            return (
              <button
                className={active ? "tp-command-row tp-command-row-active" : "tp-command-row"}
                key={command.id}
                type="button"
                aria-selected={active}
                onClick={() => onExecute(command.id)}
                onMouseEnter={() => setActiveIndex(index)}
              >
                <span className="tp-command-title">{command.title}</span>
                <span className="tp-command-meta">
                  {command.category ? <small>{command.category}</small> : null}
                  {keybindingLabel ? <kbd>{keybindingLabel}</kbd> : null}
                </span>
              </button>
            );
          })}
          {filteredCommands.length === 0 ? (
            <div className="tp-command-empty">{messages.dialogs.commandPalette.noMatchingCommands}</div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function QuickOpen({
  open,
  files,
  maxResults,
  messages,
  onClose,
  onOpen
}: {
  readonly open: boolean;
  readonly files: readonly FileTreeEntry[];
  readonly maxResults: number;
  readonly messages: WorkbenchMessages;
  readonly onClose: () => void;
  readonly onOpen: (entry: FileTreeEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredFiles = useMemo(
    () => filterQuickOpenFiles(files, query, { maxResults }),
    [files, maxResults, query]
  );

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    return scheduleWorkbenchOverlayFocus(window, {
      getFocusTarget: () => inputRef.current
    });
  }, [open]);

  useEffect(() => {
    setActiveIndex((index) => normalizeListSelection(index, filteredFiles.length));
  }, [filteredFiles.length]);

  if (!open) {
    return null;
  }

  const activeFileIndex = normalizeListSelection(activeIndex, filteredFiles.length);

  return (
    <div className="tp-command-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-command-palette"
        role="dialog"
        aria-label={messages.dialogs.quickOpen.ariaLabel}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-command-input">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            aria-label={messages.dialogs.quickOpen.ariaLabel}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              const key = event.key;

              if (key === "Escape") {
                onClose();
                return;
              }
              if (isListNavigationKey(key)) {
                event.preventDefault();
                setActiveIndex((index) => moveListSelection(index, filteredFiles.length, key));
                return;
              }
              if (key === "Enter" && filteredFiles[activeFileIndex]) {
                onOpen(filteredFiles[activeFileIndex]);
              }
            }}
          />
        </div>
        <div className="tp-command-list">
          {filteredFiles.map((entry, index) => (
            <button
              className={index === activeFileIndex ? "tp-quick-row tp-quick-row-active" : "tp-quick-row"}
              key={entry.uri.toString()}
              type="button"
              aria-selected={index === activeFileIndex}
              onClick={() => onOpen(entry)}
              onMouseEnter={() => setActiveIndex(index)}
            >
              <FileText size={15} />
              <span>{entry.name}</span>
              <small>{entry.relativePath}</small>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function IconButton({
  title,
  active = false,
  compactHidden = false,
  children,
  onClick
}: {
  readonly title: string;
  readonly active?: boolean;
  readonly compactHidden?: boolean;
  readonly children: ReactNode;
  readonly onClick: () => void;
}) {
  const className = [
    active ? "tp-icon-button tp-icon-button-active" : "tp-icon-button",
    compactHidden ? "tp-icon-button-compact-hidden" : ""
  ].filter(Boolean).join(" ");

  return (
    <button
      className={className}
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
