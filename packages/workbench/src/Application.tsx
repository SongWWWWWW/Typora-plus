import { MarkdownEditor, type MarkdownEditorHandle } from "@typora-plus/editor";
import { calculateMarkdownStats, extractOutline, type OutlineEntry } from "@typora-plus/markdown";
import type {
  FileSaveConflict,
  FileTreeEntry,
  MenuId,
  MenuItem,
  RecentResource,
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
  Command as CommandIcon,
  FileDown,
  FileText,
  FilePlus,
  Folder,
  FolderOpen,
  Hash,
  Link2,
  ListTree,
  Moon,
  PanelLeft,
  RefreshCw,
  Save,
  Search,
  Settings as SettingsIcon,
  Sun,
  Target,
  Type,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { filterCommandPaletteCommands } from "./commandPaletteModel";
import {
  isListNavigationKey,
  moveListSelection,
  normalizeListSelection
} from "./listNavigationModel";
import { SettingsDialog } from "./SettingsDialog";
import type { WorkbenchServices } from "./services";
import {
  executeWorkbenchCommand,
  runWorkbenchAction
} from "./workbenchActionRunner";
import { scheduleWorkbenchAutoSave } from "./workbenchAutoSave";
import { registerWorkbenchCommands } from "./workbenchCommandRegistration";
import {
  applyWorkbenchContextValues,
  createWorkbenchStateContextValues
} from "./workbenchContextModel";
import { createWorkbenchEditorAdapter } from "./workbenchEditorAdapter";
import {
  createWorkbenchFileTreeRows,
  type WorkbenchFileTreeRow
} from "./workbenchFileTreeModel";
import {
  overwriteWorkbenchSaveConflict,
  reloadWorkbenchFileAfterSaveConflict
} from "./workbenchSaveConflictResolution";
import {
  openWorkbenchLineResource,
  scrollWorkbenchLine
} from "./workbenchLineNavigation";
import { registerWorkbenchKeybindingDispatch } from "./workbenchKeybindingDispatch";
import {
  createWorkbenchMenuContext,
  isWorkbenchMenuItemActive,
  workbenchCommandTitle,
  workbenchMenuItemTitle
} from "./workbenchMenuModel";
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
  openWorkbenchFileResource,
  openWorkbenchQuickOpenFile,
  openWorkbenchRecentWorkspaceResource
} from "./workbenchResourceOpening";
import {
  defaultWorkbenchSideView,
  workbenchSideViewTitle,
  type WorkbenchSideView
} from "./workbenchSideViewModel";
import {
  createWorkbenchTagRows,
  nextWorkbenchSelectedTag
} from "./workbenchTagsModel";
import { registerWorkbenchStateSubscriptions } from "./workbenchStateSubscriptions";
import { applyWorkbenchTheme } from "./workbenchThemeApplication";

export interface WorkbenchApplicationProps {
  readonly services: WorkbenchServices;
}

type TreeStyle = CSSProperties & {
  readonly "--tp-tree-depth": number;
};

export function WorkbenchApplication({ services }: WorkbenchApplicationProps) {
  const [configuration, setConfiguration] = useState<TyporaPlusConfiguration>(
    services.configurationService.getValue()
  );
  const [model, setModel] = useState<TextFileModel>(() => services.textFileService.openDefault());
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => services.workspaceService.getWorkspace());
  const [recents, setRecents] = useState<readonly RecentResource[]>(() => services.recentService.getRecents());
  const [themes, setThemes] = useState(() => services.themeService.getThemes());
  const [sideView, setSideView] = useState<WorkbenchSideView | null>(defaultWorkbenchSideView);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [operationError, setOperationError] = useState<string | undefined>();
  const [saveConflict, setSaveConflict] = useState<FileSaveConflict | undefined>();
  const [indexStatus, setIndexStatus] = useState<WorkspaceIndexStatus>(() => services.indexService.getStatus());
  const [markdownRendererRevision, setMarkdownRendererRevision] = useState(0);
  const editorRef = useRef<MarkdownEditorHandle | null>(null);
  const titlebarMenuItems = useMenuItems(services, "titlebar.primary");
  const activitybarPrimaryMenuItems = useMenuItems(services, "activitybar.primary");
  const activitybarSecondaryMenuItems = useMenuItems(services, "activitybar.secondary");
  const executeCommand = (id: string) => {
    executeWorkbenchCommand(services, id, setOperationError, setSaveConflict);
  };

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
      bumpMarkdownRendererRevision: () => setMarkdownRendererRevision((revision) => revision + 1),
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
    applyWorkbenchContextValues(
      services.contextKeyService,
      createWorkbenchStateContextValues(configuration, model, sideView, workspace)
    );
  }, [
    configuration.editor.focusMode,
    configuration.editor.typewriterMode,
    model.uri.scheme,
    services,
    sideView,
    workspace.files
  ]);

  useEffect(() => {
    const nextSelectedTag = nextWorkbenchSelectedTag(tags, selectedTag);

    if (nextSelectedTag !== selectedTag) {
      setSelectedTag(nextSelectedTag);
    }
  }, [selectedTag, tags]);

  useEffect(() => {
    const workspaceFiles = workspace.files;

    if (!workspaceFiles) {
      return;
    }

    void runWorkbenchAction(
      () => services.indexService.indexWorkspace(workspaceFiles),
      setOperationError,
      setSaveConflict
    );
  }, [configuration.workspace.searchMaxFileSizeBytes, services, workspace.files]);

  useEffect(() => {
    return scheduleWorkbenchAutoSave(
      services,
      workspace.files,
      { configuration, model, saveConflict },
      { setOperationError, setSaveConflict },
      {
        setTimeout: (callback, delayMs) => window.setTimeout(callback, delayMs),
        clearTimeout: (handle) => window.clearTimeout(handle as number)
      }
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
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      applyWorkbenchTheme(document.documentElement, configuration, services, media.matches);
    };

    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [configuration.appearance.colorScheme, configuration.appearance.themeId, services, themes]);

  useEffect(() => {
    const disposable = registerWorkbenchCommands(services, {
      configuration,
      workspaceFiles: workspace.files
    }, {
      getEditorHandle: () => editorRef.current,
      setOperationError,
      setPaletteOpen,
      setQuickOpen,
      setSaveConflict,
      setSettingsOpen,
      setSideView
    });

    return () => disposable.dispose();
  }, [configuration, services, workspace.files]);

  useEffect(() => {
    const disposable = registerWorkbenchKeybindingDispatch(window, services, {
      setOperationError,
      setSaveConflict
    });

    return () => disposable.dispose();
  }, [services]);

  const editorAdapter = useMemo(
    () => createWorkbenchEditorAdapter(configuration, services, model),
    [
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
  const resourceOpeningCallbacks = {
    clearSaveConflict: () => setSaveConflict(undefined),
    closeQuickOpen: () => setQuickOpen(false),
    showFilesView: () => setSideView("files")
  };
  const lineNavigationCallbacks = {
    clearSaveConflict: resourceOpeningCallbacks.clearSaveConflict,
    defer: (callback: () => void) => {
      window.setTimeout(callback, 0);
    },
    scrollToLine: (line: number) => editorRef.current?.scrollToLine(line)
  };

  return (
    <main className={[
      sideView ? "tp-shell tp-shell-with-sidebar" : "tp-shell",
      `tp-density-${configuration.appearance.density}`
    ].join(" ")}>
      <Titlebar
        model={model}
        workspaceName={workspace.name}
        configuration={configuration}
        menuItems={titlebarMenuItems}
        getCommandTitle={(id) => workbenchCommandTitle(services.commandService.getCommands(), id)}
        onCommand={executeCommand}
      />
      <div className="tp-body">
        <ActivityBar
          activeView={sideView}
          configuration={configuration}
          primaryMenuItems={activitybarPrimaryMenuItems}
          secondaryMenuItems={activitybarSecondaryMenuItems}
          getCommandTitle={(id) => workbenchCommandTitle(services.commandService.getCommands(), id)}
          onCommand={executeCommand}
        />
        {sideView ? (
          <Sidebar
            view={sideView}
            model={model}
            workspace={workspace}
            recents={recents}
            fileServiceAvailable={services.fileService.isAvailable()}
            outline={outline}
            searchQuery={searchQuery}
            searchResults={searchResults}
            backlinks={backlinks}
            tags={tags}
            selectedTag={selectedTag}
            taggedResources={taggedResources}
            indexStatus={indexStatus}
            onSearchQueryChange={setSearchQuery}
            onClose={() => setSideView(null)}
            onSelectLine={(line) => scrollWorkbenchLine(lineNavigationCallbacks, { line })}
            onOpenSearchResult={(result) => {
              if (!isWorkspaceSearchResult(result)) {
                scrollWorkbenchLine(lineNavigationCallbacks, result);
                return;
              }

              void runWorkbenchAction(
                () => openWorkbenchLineResource(services, result, lineNavigationCallbacks),
                setOperationError,
                setSaveConflict
              );
            }}
            onOpenBacklink={(link) => {
              void runWorkbenchAction(
                () => openWorkbenchLineResource(services, link, lineNavigationCallbacks),
                setOperationError,
                setSaveConflict
              );
            }}
            onSelectTag={setSelectedTag}
            onOpenTaggedResource={(tag) => {
              void runWorkbenchAction(
                () => openWorkbenchLineResource(services, tag, lineNavigationCallbacks),
                setOperationError,
                setSaveConflict
              );
            }}
            onOpenWorkspace={() => executeCommand("file.openWorkspace")}
            onOpenRecentWorkspace={(recent) => {
              void runWorkbenchAction(
                () => openWorkbenchRecentWorkspaceResource(services, recent, resourceOpeningCallbacks),
                setOperationError,
                setSaveConflict
              );
            }}
            onRefreshWorkspace={() => executeCommand("file.refreshWorkspace")}
            onOpenFile={(entry) => {
              void runWorkbenchAction(
                () => openWorkbenchFileResource(services, entry, resourceOpeningCallbacks),
                setOperationError,
                setSaveConflict
              );
            }}
          />
        ) : null}
        <section className="tp-editor-pane" aria-label="Editor">
          <MarkdownEditor
            ref={editorRef}
            value={model.value}
            configuration={editorAdapter.configuration}
            onChange={(value) => services.textFileService.updateContent(value)}
            resolveImageSource={editorAdapter.resolveImageSource}
            renderCodeFence={editorAdapter.renderCodeFence}
            renderInline={editorAdapter.renderInline}
            onPasteImage={services.attachmentService.isAvailable()
              ? async (image) => {
                const saved = await services.attachmentService.saveImage(model.uri, image);
                return saved?.markdown;
              }
              : undefined}
          />
        </section>
      </div>
      <Statusbar model={model} stats={stats} operationError={operationError} />
      {saveConflict ? (
        <SaveConflictDialog
          conflict={saveConflict}
          onClose={() => setSaveConflict(undefined)}
          onReload={() => {
            const conflict = saveConflict;
            void runWorkbenchAction(async () => {
              return reloadWorkbenchFileAfterSaveConflict(services, conflict, {
                clearSaveConflict: () => setSaveConflict(undefined)
              });
            }, setOperationError, setSaveConflict);
          }}
          onOverwrite={() => {
            void runWorkbenchAction(async () => {
              return overwriteWorkbenchSaveConflict(services, workspace.files, {
                clearSaveConflict: () => setSaveConflict(undefined)
              });
            }, setOperationError, setSaveConflict);
          }}
        />
      ) : null}
      <CommandPalette
        open={paletteOpen}
        commands={services.commandService.getCommands()}
        getKeybindingLabel={(id) => services.keybindingService.getKeybindingLabel(id)}
        onClose={() => setPaletteOpen(false)}
        onExecute={(id) => {
          executeCommand(id);
          setPaletteOpen(false);
        }}
      />
      <QuickOpen
        open={quickOpen}
        files={workspace.files?.files ?? []}
        maxResults={configuration.workspace.quickOpenMaxResults}
        onClose={() => setQuickOpen(false)}
        onOpen={(entry) => {
          void runWorkbenchAction(
            () => openWorkbenchQuickOpenFile(services, entry, resourceOpeningCallbacks),
            setOperationError,
            setSaveConflict
          );
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        configuration={configuration}
        commands={services.commandService.getCommands()}
        themes={themes}
        getCommandForKeybinding={(keybinding) => services.keybindingService.getCommandForKeybinding(keybinding)}
        getKeybindingLabel={(id) => services.keybindingService.getKeybindingLabel(id)}
        getKeybindingLabelForKeybinding={(keybinding) => services.keybindingService.getKeybindingLabelForKeybinding(keybinding)}
        onClose={() => setSettingsOpen(false)}
        onUpdate={(value) => services.configurationService.updateValue(value)}
      />
    </main>
  );
}

function useMenuItems(services: WorkbenchServices, menu: MenuId): readonly MenuItem[] {
  const [items, setItems] = useState<readonly MenuItem[]>(() => services.menuService.getMenuItems(menu));

  useEffect(() => services.menuService.onDidChangeMenu((changedMenu) => {
    if (changedMenu === menu) {
      setItems(services.menuService.getMenuItems(menu));
    }
  }).dispose, [menu, services]);

  return items;
}

function renderMenuIcon(item: MenuItem, configuration: TyporaPlusConfiguration, size: number): ReactNode {
  switch (item.icon) {
    case "command":
      return <CommandIcon size={size} />;
    case "file-down":
      return <FileDown size={size} />;
    case "file-plus":
      return <FilePlus size={size} />;
    case "file-text":
      return <FileText size={size} />;
    case "folder-open":
      return <FolderOpen size={size} />;
    case "hash":
      return <Hash size={size} />;
    case "link":
      return <Link2 size={size} />;
    case "list-tree":
      return <ListTree size={size} />;
    case "save":
      return <Save size={size} />;
    case "search":
      return <Search size={size} />;
    case "settings":
      return <SettingsIcon size={size} />;
    case "target":
      return <Target size={size} />;
    case "theme":
      return configuration.appearance.colorScheme === "dark" ? <Sun size={size} /> : <Moon size={size} />;
    case "type":
      return <Type size={size} />;
    default:
      return <CommandIcon size={size} />;
  }
}

function Titlebar({
  model,
  workspaceName,
  configuration,
  menuItems,
  getCommandTitle,
  onCommand
}: {
  readonly model: TextFileModel;
  readonly workspaceName: string;
  readonly configuration: TyporaPlusConfiguration;
  readonly menuItems: readonly MenuItem[];
  readonly getCommandTitle: (id: string) => string;
  readonly onCommand: (id: string) => void;
}) {
  return (
    <header className="tp-titlebar">
      <div className="tp-titlebar-identity">
        <span className="tp-product-name">{workspaceName}</span>
        <span className="tp-document-name">{model.name}</span>
        {model.dirty ? <span className="tp-dirty-dot" aria-label="Unsaved changes" /> : null}
      </div>
      <div className="tp-titlebar-actions">
        {menuItems.map((item) => (
          <IconButton
            title={workbenchMenuItemTitle(item, getCommandTitle)}
            active={isWorkbenchMenuItemActive(item, createWorkbenchMenuContext(configuration, null))}
            compactHidden={item.compactHidden ?? false}
            key={item.id}
            onClick={() => onCommand(item.command)}
          >
            {renderMenuIcon(item, configuration, 17)}
          </IconButton>
        ))}
      </div>
    </header>
  );
}

function ActivityBar({
  activeView,
  configuration,
  primaryMenuItems,
  secondaryMenuItems,
  getCommandTitle,
  onCommand
}: {
  readonly activeView: WorkbenchSideView | null;
  readonly configuration: TyporaPlusConfiguration;
  readonly primaryMenuItems: readonly MenuItem[];
  readonly secondaryMenuItems: readonly MenuItem[];
  readonly getCommandTitle: (id: string) => string;
  readonly onCommand: (id: string) => void;
}) {
  const context = createWorkbenchMenuContext(configuration, activeView);

  return (
    <nav className="tp-activitybar" aria-label="Primary">
      {primaryMenuItems.map((item) => (
        <IconButton
          title={workbenchMenuItemTitle(item, getCommandTitle)}
          active={isWorkbenchMenuItemActive(item, context)}
          key={item.id}
          onClick={() => onCommand(item.command)}
        >
          {renderMenuIcon(item, configuration, 19)}
        </IconButton>
      ))}
      <div className="tp-activitybar-spacer" />
      {secondaryMenuItems.map((item) => (
        <IconButton
          title={workbenchMenuItemTitle(item, getCommandTitle)}
          active={isWorkbenchMenuItemActive(item, context)}
          key={item.id}
          onClick={() => onCommand(item.command)}
        >
          {renderMenuIcon(item, configuration, 19)}
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
  onOpenFile
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
}) {
  return (
    <aside className="tp-sidebar">
      <div className="tp-sidebar-header">
        <span>{workbenchSideViewTitle(view)}</span>
        <IconButton title="Close Sidebar" onClick={onClose}>
          <PanelLeft size={17} />
        </IconButton>
      </div>
      {view === "files" ? (
        <FilesPanel
          model={model}
          workspace={workspace}
          recents={recents}
          fileServiceAvailable={fileServiceAvailable}
          onOpenWorkspace={onOpenWorkspace}
          onOpenRecentWorkspace={onOpenRecentWorkspace}
          onRefreshWorkspace={onRefreshWorkspace}
          onOpenFile={onOpenFile}
        />
      ) : null}
      {view === "search" ? (
        <SearchPanel
          query={searchQuery}
          results={searchResults}
          indexStatus={indexStatus}
          onQueryChange={onSearchQueryChange}
          onOpenResult={onOpenSearchResult}
        />
      ) : null}
      {view === "outline" ? <OutlinePanel outline={outline} onSelectLine={onSelectLine} /> : null}
      {view === "backlinks" ? (
        <BacklinksPanel
          backlinks={backlinks}
          indexStatus={indexStatus}
          onOpenBacklink={onOpenBacklink}
        />
      ) : null}
      {view === "tags" ? (
        <TagsPanel
          tags={tags}
          selectedTag={selectedTag}
          taggedResources={taggedResources}
          indexStatus={indexStatus}
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
  onOpenWorkspace,
  onOpenRecentWorkspace,
  onRefreshWorkspace,
  onOpenFile
}: {
  readonly model: TextFileModel;
  readonly workspace: WorkspaceState;
  readonly recents: readonly RecentResource[];
  readonly fileServiceAvailable: boolean;
  readonly onOpenWorkspace: () => void;
  readonly onOpenRecentWorkspace: (recent: RecentResource) => void;
  readonly onRefreshWorkspace: () => void;
  readonly onOpenFile: (entry: FileTreeEntry) => void;
}) {
  const workspaceFiles = workspace.files;
  const recentSections = createWorkbenchRecentResourceSections(recents);
  const fileTreeRows = workspaceFiles
    ? createWorkbenchFileTreeRows(workspaceFiles.root.children ?? [], {
        activeUri: model.uri.toString(),
        dirty: model.dirty
      })
    : [];

  return (
    <div className="tp-sidebar-content">
      <button
        className="tp-sidebar-action"
        type="button"
        disabled={!fileServiceAvailable}
        onClick={onOpenWorkspace}
      >
        <FolderOpen size={16} />
        <span>Open workspace</span>
      </button>
      <button
        className="tp-sidebar-action"
        type="button"
        disabled={!workspace.rootUri}
        onClick={onRefreshWorkspace}
      >
        <RefreshCw size={16} />
        <span>Refresh workspace</span>
      </button>
      {workspaceFiles ? (
        <div className="tp-file-tree">
          <FileTreeRows
            rows={fileTreeRows}
            onOpenFile={onOpenFile}
          />
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
          title="Recent files"
          recents={recentSections.files}
          activeUri={model.uri.toString()}
          onOpenFile={onOpenFile}
        />
      ) : null}
      {recentSections.workspaces.length > 0 ? (
        <RecentSection
          title="Recent workspaces"
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
  onOpenFile
}: {
  readonly rows: readonly WorkbenchFileTreeRow[];
  readonly onOpenFile: (entry: FileTreeEntry) => void;
}) {
  return (
    <>
      {rows.map((row) => (
        <div key={row.key}>
          {row.kind === "directory" ? (
            <div className="tp-folder-row" style={{ "--tp-tree-depth": row.depth } as TreeStyle}>
              <Folder size={16} />
              <span>{row.entry.name}</span>
            </div>
          ) : (
            <button
              className={row.active ? "tp-file-row tp-file-row-active" : "tp-file-row"}
              style={{ "--tp-tree-depth": row.depth } as TreeStyle}
              type="button"
              onClick={() => {
                if (row.fileEntry) {
                  onOpenFile(row.fileEntry);
                }
              }}
            >
              <FileText size={16} />
              <span>{row.entry.name}</span>
              {row.dirty ? <span className="tp-row-dot" /> : null}
            </button>
          )}
        </div>
      ))}
    </>
  );
}

function SearchPanel({
  query,
  results,
  indexStatus,
  onQueryChange,
  onOpenResult
}: {
  readonly query: string;
  readonly results: readonly WorkbenchSearchResult[];
  readonly indexStatus: WorkspaceIndexStatus;
  readonly onQueryChange: (value: string) => void;
  readonly onOpenResult: (result: WorkbenchSearchResult) => void;
}) {
  return (
    <div className="tp-sidebar-content">
      <div className="tp-search-field">
        <Search size={15} />
        <input
          value={query}
          aria-label="Search note"
          placeholder="Search"
          onChange={(event) => onQueryChange(event.target.value)}
        />
        {query ? (
          <button type="button" aria-label="Clear search" onClick={() => onQueryChange("")}>
            <X size={14} />
          </button>
        ) : null}
      </div>
      {indexStatus.state === "indexing" ? (
        <div className="tp-search-status">{indexStatus.indexedFiles}/{indexStatus.totalFiles} indexed</div>
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
  onOpenBacklink
}: {
  readonly backlinks: readonly WorkspaceIndexedLink[];
  readonly indexStatus: WorkspaceIndexStatus;
  readonly onOpenBacklink: (link: WorkspaceIndexedLink) => void;
}) {
  return (
    <div className="tp-sidebar-content">
      {indexStatus.state === "indexing" ? (
        <div className="tp-search-status">{indexStatus.indexedFiles}/{indexStatus.totalFiles} indexed</div>
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
        )) : <div className="tp-empty-row">No backlinks</div>}
      </div>
    </div>
  );
}

function TagsPanel({
  tags,
  selectedTag,
  taggedResources,
  indexStatus,
  onSelectTag,
  onOpenTaggedResource
}: {
  readonly tags: readonly WorkspaceIndexedTagSummary[];
  readonly selectedTag: string | undefined;
  readonly taggedResources: readonly WorkspaceIndexedTag[];
  readonly indexStatus: WorkspaceIndexStatus;
  readonly onSelectTag: (tag: string) => void;
  readonly onOpenTaggedResource: (tag: WorkspaceIndexedTag) => void;
}) {
  const tagRows = createWorkbenchTagRows(tags, selectedTag);

  return (
    <div className="tp-sidebar-content">
      {indexStatus.state === "indexing" ? (
        <div className="tp-search-status">{indexStatus.indexedFiles}/{indexStatus.totalFiles} indexed</div>
      ) : null}
      {tags.length > 0 ? (
        <>
          <section className="tp-tag-list" aria-label="Tags">
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
          <div className="tp-section-label">Notes</div>
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
      ) : <div className="tp-empty-row">No tags</div>}
    </div>
  );
}

function Statusbar({
  model,
  stats,
  operationError
}: {
  readonly model: TextFileModel;
  readonly stats: ReturnType<typeof calculateMarkdownStats>;
  readonly operationError: string | undefined;
}) {
  return (
    <footer className="tp-statusbar">
      {operationError ? <span className="tp-status-error">{operationError}</span> : null}
      <span>{model.dirty ? "Saving" : "Saved"}</span>
      <span>{stats.words} words</span>
      <span>{stats.lines} lines</span>
    </footer>
  );
}

function SaveConflictDialog({
  conflict,
  onClose,
  onReload,
  onOverwrite
}: {
  readonly conflict: FileSaveConflict;
  readonly onClose: () => void;
  readonly onReload: () => void;
  readonly onOverwrite: () => void;
}) {
  return (
    <div className="tp-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-dialog"
        role="alertdialog"
        aria-label="Save conflict"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-dialog-header">
          <div className="tp-dialog-title">
            <AlertTriangle size={18} />
            <span>File changed on disk</span>
          </div>
          <IconButton title="Close" onClick={onClose}>
            <X size={16} />
          </IconButton>
        </div>
        <p className="tp-dialog-message">{conflict.uri.path}</p>
        <div className="tp-dialog-actions">
          <button className="tp-dialog-button" type="button" onClick={onReload}>
            <RefreshCw size={15} />
            <span>Reload</span>
          </button>
          <button className="tp-dialog-button tp-dialog-button-primary" type="button" onClick={onOverwrite}>
            <Save size={15} />
            <span>Overwrite</span>
          </button>
        </div>
      </section>
    </div>
  );
}

function CommandPalette({
  open,
  commands,
  getKeybindingLabel,
  onClose,
  onExecute
}: {
  readonly open: boolean;
  readonly commands: readonly { readonly id: string; readonly title: string; readonly category?: string }[];
  readonly getKeybindingLabel: (id: string) => string | undefined;
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

    window.setTimeout(() => inputRef.current?.focus(), 0);
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
      <section className="tp-command-palette" role="dialog" aria-label="Command Palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="tp-command-input">
          <CommandIcon size={17} />
          <input
            ref={inputRef}
            value={query}
            aria-label="Command"
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
            <div className="tp-command-empty">No matching commands</div>
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
  onClose,
  onOpen
}: {
  readonly open: boolean;
  readonly files: readonly FileTreeEntry[];
  readonly maxResults: number;
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

    window.setTimeout(() => inputRef.current?.focus(), 0);
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
      <section className="tp-command-palette" role="dialog" aria-label="Quick Open" onMouseDown={(event) => event.stopPropagation()}>
        <div className="tp-command-input">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            aria-label="Quick Open"
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
