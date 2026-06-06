import { DisposableStore } from "@typora-plus/base";
import { MarkdownEditor, type MarkdownEditorHandle } from "@typora-plus/editor";
import { calculateMarkdownStats, extractOutline, type OutlineEntry } from "@typora-plus/markdown";
import type {
  FileSaveConflict,
  FileTreeEntry,
  RecentResource,
  TextFileModel,
  TyporaPlusConfiguration,
  WorkspaceIndexedLink,
  WorkspaceIndexedTag,
  WorkspaceIndexedTagSummary,
  WorkspaceIndexStatus,
  WorkspaceSearchResult,
  WorkspaceState
} from "@typora-plus/platform";
import { isFileSaveConflictError } from "@typora-plus/platform";
import { applyTheme, resolveThemeName } from "@typora-plus/theme";
import {
  AlertTriangle,
  Command as CommandIcon,
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
  Sun,
  Target,
  Type,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { WorkbenchServices } from "./services";

type SideView = "files" | "search" | "outline" | "backlinks" | "tags";

export interface WorkbenchApplicationProps {
  readonly services: WorkbenchServices;
}

interface SearchResult {
  readonly line: number;
  readonly preview: string;
}

type WorkbenchSearchResult = SearchResult | WorkspaceSearchResult;

type TreeStyle = CSSProperties & {
  readonly "--tp-tree-depth": number;
};

const autoSaveDelayMs = 800;

export function WorkbenchApplication({ services }: WorkbenchApplicationProps) {
  const [configuration, setConfiguration] = useState<TyporaPlusConfiguration>(
    services.configurationService.getValue()
  );
  const [model, setModel] = useState<TextFileModel>(() => services.textFileService.openDefault());
  const [workspace, setWorkspace] = useState<WorkspaceState>(() => services.workspaceService.getWorkspace());
  const [recents, setRecents] = useState<readonly RecentResource[]>(() => services.recentService.getRecents());
  const [sideView, setSideView] = useState<SideView | null>("outline");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | undefined>();
  const [operationError, setOperationError] = useState<string | undefined>();
  const [saveConflict, setSaveConflict] = useState<FileSaveConflict | undefined>();
  const [indexStatus, setIndexStatus] = useState<WorkspaceIndexStatus>(() => services.indexService.getStatus());
  const editorRef = useRef<MarkdownEditorHandle | null>(null);

  const outline = useMemo(() => extractOutline(model.value), [model.value]);
  const stats = useMemo(() => calculateMarkdownStats(model.value), [model.value]);
  const searchResults = useMemo(
    () => workspace.files
      ? services.indexService.query(searchQuery)
      : searchDocument(model.value, searchQuery),
    [indexStatus.updatedAt, model.value, searchQuery, services, workspace.files]
  );
  const backlinks = useMemo(
    () => workspace.files && model.uri.scheme === "file"
      ? services.indexService.getBacklinks(model.uri)
      : [],
    [indexStatus.updatedAt, model.uri, services, workspace.files]
  );
  const tags = useMemo(
    () => workspace.files ? services.indexService.getTags() : [],
    [indexStatus.updatedAt, services, workspace.files]
  );
  const taggedResources = useMemo(
    () => workspace.files && selectedTag ? services.indexService.getTaggedResources(selectedTag) : [],
    [indexStatus.updatedAt, selectedTag, services, workspace.files]
  );

  useEffect(() => services.configurationService.onDidChangeConfiguration(setConfiguration).dispose, [services]);

  useEffect(() => services.textFileService.onDidChangeModel(setModel).dispose, [services]);

  useEffect(() => services.workspaceService.onDidChangeWorkspace(setWorkspace).dispose, [services]);

  useEffect(() => services.fileService.onDidChangeWorkspaceFiles((workspaceFiles) => {
    if (!workspaceFiles) {
      return;
    }

    services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));
  }).dispose, [services]);

  useEffect(() => services.recentService.onDidChangeRecents(setRecents).dispose, [services]);

  useEffect(() => services.indexService.onDidChangeStatus(setIndexStatus).dispose, [services]);

  useEffect(() => {
    if (tags.length === 0) {
      setSelectedTag(undefined);
      return;
    }

    if (!selectedTag || !tags.some((tag) => tag.tag.toLowerCase() === selectedTag.toLowerCase())) {
      setSelectedTag(tags[0]?.tag);
    }
  }, [selectedTag, tags]);

  useEffect(() => {
    const workspaceFiles = workspace.files;

    if (!workspaceFiles) {
      services.indexService.clear();
      return;
    }

    void runWorkbenchAction(
      () => services.indexService.indexWorkspace(workspaceFiles),
      setOperationError,
      setSaveConflict
    );
  }, [services, workspace.files]);

  useEffect(() => {
    if (!configuration.editor.autoSave || !model.dirty || model.uri.scheme !== "file" || saveConflict) {
      return;
    }

    const handle = window.setTimeout(() => {
      void runWorkbenchAction(async () => {
        const saved = await services.textFileService.save();
        await updateIndexedFile(services.indexService, workspace.files, saved);
        return saved;
      }, setOperationError, setSaveConflict);
    }, autoSaveDelayMs);
    return () => window.clearTimeout(handle);
  }, [configuration.editor.autoSave, model.dirty, model.uri, model.value, saveConflict, services, workspace.files]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const syncTheme = () => {
      applyTheme(
        document.documentElement,
        resolveThemeName(configuration.appearance.colorScheme, media.matches)
      );
    };

    syncTheme();
    media.addEventListener("change", syncTheme);
    return () => media.removeEventListener("change", syncTheme);
  }, [configuration.appearance.colorScheme]);

  useEffect(() => {
    const disposables = new DisposableStore();

    disposables.add(services.commandService.registerCommand({
      id: "file.newUntitled",
      title: "New Note",
      category: "File",
      run: () => {
        setSaveConflict(undefined);
        return services.textFileService.newUntitled();
      }
    }));
    disposables.add(services.commandService.registerCommand({
      id: "file.openWorkspace",
      title: "Open Workspace",
      category: "File",
      run: () => runWorkbenchAction(async () => {
        const workspaceFiles = await services.fileService.openWorkspace();

        if (!workspaceFiles) {
          return;
        }

        services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));
        services.recentService.addRecentWorkspace(workspaceFiles.root.uri, workspaceFiles.root.name);
        setSideView("files");

        if (workspaceFiles.files[0]) {
          setSaveConflict(undefined);
          const opened = await services.textFileService.openFile(workspaceFiles.files[0].uri);
          services.recentService.addRecentFile(opened.uri, opened.name);
        }
      }, setOperationError, setSaveConflict)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "file.refreshWorkspace",
      title: "Refresh Workspace",
      category: "File",
      run: () => runWorkbenchAction(async () => {
        const workspaceFiles = await services.fileService.refreshWorkspace();

        if (!workspaceFiles) {
          return;
        }

        services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));
      }, setOperationError, setSaveConflict)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "workbench.quickOpen",
      title: "Quick Open",
      category: "Workbench",
      run: () => setQuickOpen(true)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "workbench.commandPalette.open",
      title: "Command Palette",
      category: "Workbench",
      run: () => setPaletteOpen(true)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "workbench.sidebar.files",
      title: "Show Files",
      category: "Workbench",
      run: () => toggleSideView("files", sideView, setSideView)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "workbench.sidebar.search",
      title: "Show Search",
      category: "Workbench",
      run: () => toggleSideView("search", sideView, setSideView)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "workbench.sidebar.outline",
      title: "Show Outline",
      category: "Workbench",
      run: () => toggleSideView("outline", sideView, setSideView)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "workbench.sidebar.backlinks",
      title: "Show Backlinks",
      category: "Workbench",
      run: () => toggleSideView("backlinks", sideView, setSideView)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "workbench.sidebar.tags",
      title: "Show Tags",
      category: "Workbench",
      run: () => toggleSideView("tags", sideView, setSideView)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "file.save",
      title: "Save",
      category: "File",
      run: () => runWorkbenchAction(async () => {
        const saved = await services.textFileService.save();

        if (saved.uri.scheme === "file") {
          services.recentService.addRecentFile(saved.uri, saved.name);
        }

        await updateIndexedFile(services.indexService, workspace.files, saved);
        return saved;
      }, setOperationError, setSaveConflict)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "file.saveAs",
      title: "Save As",
      category: "File",
      run: () => runWorkbenchAction(async () => {
        const saved = await services.textFileService.saveAs();

        if (saved) {
          services.recentService.addRecentFile(saved.uri, saved.name);
          await updateIndexedFile(services.indexService, workspace.files, saved);
        }

        return saved;
      }, setOperationError, setSaveConflict)
    }));
    disposables.add(services.commandService.registerCommand({
      id: "editor.focusMode.toggle",
      title: "Toggle Focus Mode",
      category: "Editor",
      run: () => services.configurationService.updateValue({
        editor: {
          focusMode: !configuration.editor.focusMode
        }
      })
    }));
    disposables.add(services.commandService.registerCommand({
      id: "editor.typewriterMode.toggle",
      title: "Toggle Typewriter Mode",
      category: "Editor",
      run: () => services.configurationService.updateValue({
        editor: {
          typewriterMode: !configuration.editor.typewriterMode
        }
      })
    }));
    disposables.add(services.commandService.registerCommand({
      id: "theme.toggle",
      title: "Toggle Theme",
      category: "Workbench",
      run: () => services.configurationService.updateValue({
        appearance: {
          colorScheme: configuration.appearance.colorScheme === "dark" ? "light" : "dark"
        }
      })
    }));

    return () => disposables.dispose();
  }, [configuration, services, sideView, workspace.files]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (modifier && !event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setQuickOpen(true);
        return;
      }

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        services.commandService.executeCommand("file.save");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [services]);

  const editorConfiguration = {
    fontSize: configuration.editor.fontSize,
    lineHeight: configuration.editor.lineHeight,
    maxWidth: configuration.editor.maxWidth,
    focusMode: configuration.editor.focusMode,
    typewriterMode: configuration.editor.typewriterMode
  };
  const resolveImageSource = useMemo(
    () => services.resourceService.isAvailable() && model.uri.scheme === "file"
      ? (source: string) => services.resourceService.resolveImageSource(model.uri, source)
      : undefined,
    [model.uri, services]
  );

  return (
    <main className={sideView ? "tp-shell tp-shell-with-sidebar" : "tp-shell"}>
      <Titlebar
        model={model}
        workspaceName={workspace.name}
        configuration={configuration}
        onCommand={(id) => services.commandService.executeCommand(id)}
      />
      <div className="tp-body">
        <ActivityBar
          activeView={sideView}
          onToggle={(view) => toggleSideView(view, sideView, setSideView)}
          onOpenPalette={() => setPaletteOpen(true)}
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
            onSelectLine={(line) => editorRef.current?.scrollToLine(line)}
            onOpenSearchResult={(result) => {
              if (!isWorkspaceSearchResult(result)) {
                editorRef.current?.scrollToLine(result.line);
                return;
              }

              void runWorkbenchAction(async () => {
                setSaveConflict(undefined);
                const opened = await services.textFileService.openFile(result.uri);
                services.recentService.addRecentFile(opened.uri, opened.name);
                window.setTimeout(() => editorRef.current?.scrollToLine(result.line), 0);
              }, setOperationError, setSaveConflict);
            }}
            onOpenBacklink={(link) => {
              void runWorkbenchAction(async () => {
                setSaveConflict(undefined);
                const opened = await services.textFileService.openFile(link.uri);
                services.recentService.addRecentFile(opened.uri, opened.name);
                window.setTimeout(() => editorRef.current?.scrollToLine(link.line), 0);
              }, setOperationError, setSaveConflict);
            }}
            onSelectTag={setSelectedTag}
            onOpenTaggedResource={(tag) => {
              void runWorkbenchAction(async () => {
                setSaveConflict(undefined);
                const opened = await services.textFileService.openFile(tag.uri);
                services.recentService.addRecentFile(opened.uri, opened.name);
                window.setTimeout(() => editorRef.current?.scrollToLine(tag.line), 0);
              }, setOperationError, setSaveConflict);
            }}
            onOpenWorkspace={() => services.commandService.executeCommand("file.openWorkspace")}
            onOpenRecentWorkspace={(recent) => {
              void runWorkbenchAction(async () => {
                const workspaceFiles = await services.fileService.openRecentWorkspace(recent.uri);

                if (!workspaceFiles) {
                  return;
                }

                services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));
                services.recentService.addRecentWorkspace(workspaceFiles.root.uri, workspaceFiles.root.name);
                setSideView("files");
                setSaveConflict(undefined);

                if (workspaceFiles.files[0]) {
                  const opened = await services.textFileService.openFile(workspaceFiles.files[0].uri);
                  services.recentService.addRecentFile(opened.uri, opened.name);
                }
              }, setOperationError, setSaveConflict);
            }}
            onRefreshWorkspace={() => services.commandService.executeCommand("file.refreshWorkspace")}
            onOpenFile={(entry) => {
              void runWorkbenchAction(async () => {
                setSaveConflict(undefined);
                const opened = await services.textFileService.openFile(entry.uri);
                services.recentService.addRecentFile(opened.uri, opened.name);
              }, setOperationError, setSaveConflict);
            }}
          />
        ) : null}
        <section className="tp-editor-pane" aria-label="Editor">
          <MarkdownEditor
            ref={editorRef}
            value={model.value}
            configuration={editorConfiguration}
            onChange={(value) => services.textFileService.updateContent(value)}
            resolveImageSource={resolveImageSource}
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
              const opened = await services.textFileService.openFile(conflict.uri);
              services.recentService.addRecentFile(opened.uri, opened.name);
              setSaveConflict(undefined);
              return opened;
            }, setOperationError, setSaveConflict);
          }}
          onOverwrite={() => {
            void runWorkbenchAction(async () => {
              const saved = await services.textFileService.save({ overwrite: true });

              if (saved.uri.scheme === "file") {
                services.recentService.addRecentFile(saved.uri, saved.name);
              }

              await updateIndexedFile(services.indexService, workspace.files, saved);
              setSaveConflict(undefined);
              return saved;
            }, setOperationError, setSaveConflict);
          }}
        />
      ) : null}
      <CommandPalette
        open={paletteOpen}
        commands={services.commandService.getCommands()}
        onClose={() => setPaletteOpen(false)}
        onExecute={(id) => {
          services.commandService.executeCommand(id);
          setPaletteOpen(false);
        }}
      />
      <QuickOpen
        open={quickOpen}
        files={workspace.files?.files ?? []}
        onClose={() => setQuickOpen(false)}
        onOpen={(entry) => {
          void runWorkbenchAction(async () => {
            setSaveConflict(undefined);
            const opened = await services.textFileService.openFile(entry.uri);
            services.recentService.addRecentFile(opened.uri, opened.name);
            setQuickOpen(false);
          }, setOperationError, setSaveConflict);
        }}
      />
    </main>
  );
}

function Titlebar({
  model,
  workspaceName,
  configuration,
  onCommand
}: {
  readonly model: TextFileModel;
  readonly workspaceName: string;
  readonly configuration: TyporaPlusConfiguration;
  readonly onCommand: (id: string) => void;
}) {
  const themeIsDark = configuration.appearance.colorScheme === "dark";

  return (
    <header className="tp-titlebar">
      <div className="tp-titlebar-identity">
        <span className="tp-product-name">{workspaceName}</span>
        <span className="tp-document-name">{model.name}</span>
        {model.dirty ? <span className="tp-dirty-dot" aria-label="Unsaved changes" /> : null}
      </div>
      <div className="tp-titlebar-actions">
        <IconButton title="New Note" onClick={() => onCommand("file.newUntitled")}>
          <FilePlus size={17} />
        </IconButton>
        <IconButton title="Open Workspace" onClick={() => onCommand("file.openWorkspace")}>
          <FolderOpen size={17} />
        </IconButton>
        <IconButton title="Save" onClick={() => onCommand("file.save")}>
          <Save size={17} />
        </IconButton>
        <IconButton title="Save As" compactHidden onClick={() => onCommand("file.saveAs")}>
          <FileText size={17} />
        </IconButton>
        <IconButton
          title="Focus Mode"
          active={configuration.editor.focusMode}
          compactHidden
          onClick={() => onCommand("editor.focusMode.toggle")}
        >
          <Target size={17} />
        </IconButton>
        <IconButton
          title="Typewriter Mode"
          active={configuration.editor.typewriterMode}
          compactHidden
          onClick={() => onCommand("editor.typewriterMode.toggle")}
        >
          <Type size={17} />
        </IconButton>
        <IconButton title="Theme" compactHidden onClick={() => onCommand("theme.toggle")}>
          {themeIsDark ? <Sun size={17} /> : <Moon size={17} />}
        </IconButton>
        <IconButton title="Command Palette" onClick={() => onCommand("workbench.commandPalette.open")}>
          <CommandIcon size={17} />
        </IconButton>
      </div>
    </header>
  );
}

function ActivityBar({
  activeView,
  onToggle,
  onOpenPalette
}: {
  readonly activeView: SideView | null;
  readonly onToggle: (view: SideView) => void;
  readonly onOpenPalette: () => void;
}) {
  return (
    <nav className="tp-activitybar" aria-label="Primary">
      <IconButton title="Files" active={activeView === "files"} onClick={() => onToggle("files")}>
        <FileText size={19} />
      </IconButton>
      <IconButton title="Search" active={activeView === "search"} onClick={() => onToggle("search")}>
        <Search size={19} />
      </IconButton>
      <IconButton title="Outline" active={activeView === "outline"} onClick={() => onToggle("outline")}>
        <ListTree size={19} />
      </IconButton>
      <IconButton title="Backlinks" active={activeView === "backlinks"} onClick={() => onToggle("backlinks")}>
        <Link2 size={19} />
      </IconButton>
      <IconButton title="Tags" active={activeView === "tags"} onClick={() => onToggle("tags")}>
        <Hash size={19} />
      </IconButton>
      <div className="tp-activitybar-spacer" />
      <IconButton title="Command Palette" onClick={onOpenPalette}>
        <CommandIcon size={19} />
      </IconButton>
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
  readonly view: SideView;
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
        <span>{sidebarTitle(view)}</span>
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
  const recentFiles = recents.filter((recent) => recent.kind === "file");
  const recentWorkspaces = recents.filter((recent) => recent.kind === "workspace");

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
            entries={workspaceFiles.root.children ?? []}
            activeUri={model.uri.toString()}
            dirty={model.dirty}
            depth={0}
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
      {recentFiles.length > 0 ? (
        <RecentSection
          title="Recent files"
          recents={recentFiles}
          activeUri={model.uri.toString()}
          onOpenFile={onOpenFile}
        />
      ) : null}
      {recentWorkspaces.length > 0 ? (
        <RecentSection
          title="Recent workspaces"
          recents={recentWorkspaces}
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
  return (
    <section className="tp-recent-section">
      <div className="tp-section-label">{title}</div>
      {recents.slice(0, 8).map((recent) => {
        const isFile = recent.kind === "file";
        const isActive = recent.uri.toString() === activeUri;

        return (
          <button
            className={isActive ? "tp-file-row tp-file-row-active" : "tp-file-row"}
            key={`${recent.kind}-${recent.uri.toString()}`}
            type="button"
            disabled={(isFile && !onOpenFile) || (!isFile && !onOpenWorkspace)}
            onClick={() => {
              if (isFile && onOpenFile) {
                onOpenFile({
                  uri: recent.uri,
                  name: recent.name,
                  relativePath: recent.name,
                  kind: "file"
                });
                return;
              }

              if (!isFile && onOpenWorkspace) {
                onOpenWorkspace(recent);
              }
            }}
          >
            {isFile ? <FileText size={16} /> : <Folder size={16} />}
            <span>{recent.name}</span>
          </button>
        );
      })}
    </section>
  );
}

function FileTreeRows({
  entries,
  activeUri,
  dirty,
  depth,
  onOpenFile
}: {
  readonly entries: readonly FileTreeEntry[];
  readonly activeUri: string;
  readonly dirty: boolean;
  readonly depth: number;
  readonly onOpenFile: (entry: FileTreeEntry) => void;
}) {
  return (
    <>
      {entries.map((entry) => (
        <div key={entry.uri.toString()}>
          {entry.kind === "directory" ? (
            <div className="tp-folder-row" style={{ "--tp-tree-depth": depth } as TreeStyle}>
              <Folder size={16} />
              <span>{entry.name}</span>
            </div>
          ) : (
            <button
              className={entry.uri.toString() === activeUri ? "tp-file-row tp-file-row-active" : "tp-file-row"}
              style={{ "--tp-tree-depth": depth } as TreeStyle}
              type="button"
              onClick={() => onOpenFile(entry)}
            >
              <FileText size={16} />
              <span>{entry.name}</span>
              {entry.uri.toString() === activeUri && dirty ? <span className="tp-row-dot" /> : null}
            </button>
          )}
          {entry.kind === "directory" && entry.children ? (
            <FileTreeRows
              entries={entry.children}
              activeUri={activeUri}
              dirty={dirty}
              depth={depth + 1}
              onOpenFile={onOpenFile}
            />
          ) : null}
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
  return (
    <div className="tp-sidebar-content">
      {indexStatus.state === "indexing" ? (
        <div className="tp-search-status">{indexStatus.indexedFiles}/{indexStatus.totalFiles} indexed</div>
      ) : null}
      {tags.length > 0 ? (
        <>
          <section className="tp-tag-list" aria-label="Tags">
            {tags.map((tag) => {
              const active = selectedTag?.toLowerCase() === tag.tag.toLowerCase();

              return (
                <button
                  className={active ? "tp-tag-row tp-tag-row-active" : "tp-tag-row"}
                  key={tag.tag}
                  type="button"
                  onClick={() => onSelectTag(tag.tag)}
                >
                  <span>#{tag.tag}</span>
                  <small>{tag.count}</small>
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
  onClose,
  onExecute
}: {
  readonly open: boolean;
  readonly commands: readonly { readonly id: string; readonly title: string; readonly category?: string }[];
  readonly onClose: () => void;
  readonly onExecute: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredCommands = useMemo(() => filterCommands(commands, query), [commands, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="tp-command-overlay" role="presentation" onMouseDown={onClose}>
      <section className="tp-command-palette" role="dialog" aria-label="Command Palette" onMouseDown={(event) => event.stopPropagation()}>
        <div className="tp-command-input">
          <CommandIcon size={17} />
          <input
            ref={inputRef}
            value={query}
            aria-label="Command"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
              if (event.key === "Enter" && filteredCommands[0]) {
                onExecute(filteredCommands[0].id);
              }
            }}
          />
        </div>
        <div className="tp-command-list">
          {filteredCommands.map((command) => (
            <button className="tp-command-row" key={command.id} type="button" onClick={() => onExecute(command.id)}>
              <span>{command.title}</span>
              {command.category ? <small>{command.category}</small> : null}
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

function QuickOpen({
  open,
  files,
  onClose,
  onOpen
}: {
  readonly open: boolean;
  readonly files: readonly FileTreeEntry[];
  readonly onClose: () => void;
  readonly onOpen: (entry: FileTreeEntry) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);
  const filteredFiles = useMemo(() => filterFiles(files, query), [files, query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="tp-command-overlay" role="presentation" onMouseDown={onClose}>
      <section className="tp-command-palette" role="dialog" aria-label="Quick Open" onMouseDown={(event) => event.stopPropagation()}>
        <div className="tp-command-input">
          <Search size={17} />
          <input
            ref={inputRef}
            value={query}
            aria-label="Quick Open"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
              if (event.key === "Enter" && filteredFiles[0]) {
                onOpen(filteredFiles[0]);
              }
            }}
          />
        </div>
        <div className="tp-command-list">
          {filteredFiles.map((entry) => (
            <button className="tp-quick-row" key={entry.uri.toString()} type="button" onClick={() => onOpen(entry)}>
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

function searchDocument(markdown: string, query: string): SearchResult[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return [];
  }

  return markdown
    .split(/\r?\n/)
    .map((line, index) => ({
      line: index + 1,
      preview: line.trim()
    }))
    .filter((result) => result.preview.toLowerCase().includes(normalizedQuery))
    .slice(0, 50);
}

function isWorkspaceSearchResult(result: WorkbenchSearchResult): result is WorkspaceSearchResult {
  return "uri" in result;
}

function searchResultKey(result: WorkbenchSearchResult): string {
  return isWorkspaceSearchResult(result)
    ? `${result.uri.toString()}-${result.line}-${result.preview}`
    : `${result.line}-${result.preview}`;
}

function backlinkKey(link: WorkspaceIndexedLink, index: number): string {
  return `${link.uri.toString()}-${link.line}-${link.kind}-${link.target}-${link.label}-${index}`;
}

function formatBacklinkPreview(link: WorkspaceIndexedLink): string {
  return link.label.trim() || link.target;
}

function tagResourceKey(tag: WorkspaceIndexedTag, index: number): string {
  return `${tag.uri.toString()}-${tag.line}-${tag.tag}-${index}`;
}

function filterCommands(
  commands: readonly { readonly id: string; readonly title: string; readonly category?: string }[],
  query: string
) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return commands;
  }

  return commands.filter((command) => {
    const haystack = `${command.title} ${command.category ?? ""} ${command.id}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}

function filterFiles(files: readonly FileTreeEntry[], query: string): FileTreeEntry[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return files.slice(0, 80);
  }

  return files
    .map((file) => ({
      file,
      score: scoreFile(file, normalizedQuery)
    }))
    .filter((result) => result.score > 0)
    .sort((first, second) => second.score - first.score || first.file.relativePath.localeCompare(second.file.relativePath))
    .slice(0, 80)
    .map((result) => result.file);
}

function scoreFile(file: FileTreeEntry, query: string): number {
  const path = file.relativePath.toLowerCase();
  const name = file.name.toLowerCase();

  if (name === query) {
    return 100;
  }

  if (name.startsWith(query)) {
    return 80;
  }

  if (path.includes(query)) {
    return 60;
  }

  let cursor = 0;
  for (const character of query) {
    cursor = path.indexOf(character, cursor);
    if (cursor === -1) {
      return 0;
    }
    cursor += 1;
  }

  return 30;
}

function toggleSideView(
  view: SideView,
  activeView: SideView | null,
  setActiveView: (view: SideView | null) => void
): void {
  setActiveView(activeView === view ? null : view);
}

function sidebarTitle(view: SideView): string {
  switch (view) {
    case "files":
      return "Files";
    case "search":
      return "Search";
    case "outline":
      return "Outline";
    case "backlinks":
      return "Backlinks";
    case "tags":
      return "Tags";
  }
}

function workspaceStateFromFiles(workspaceFiles: NonNullable<WorkspaceState["files"]>): WorkspaceState {
  return {
    name: workspaceFiles.root.name,
    rootUri: workspaceFiles.root.uri,
    files: workspaceFiles
  };
}

async function updateIndexedFile(
  indexService: WorkbenchServices["indexService"],
  workspaceFiles: WorkspaceState["files"],
  model: TextFileModel
): Promise<void> {
  if (model.uri.scheme !== "file" || !workspaceFiles) {
    return;
  }

  const file = workspaceFiles.files.find((entry) => entry.uri.toString() === model.uri.toString());

  if (!file) {
    return;
  }

  await indexService.indexFile(file, model.value);
}

async function runWorkbenchAction<T>(
  action: () => Promise<T> | T,
  setOperationError: (value: string | undefined) => void,
  setSaveConflict?: (value: FileSaveConflict | undefined) => void
): Promise<T | undefined> {
  try {
    setOperationError(undefined);
    return await action();
  } catch (error) {
    if (isFileSaveConflictError(error)) {
      setSaveConflict?.(error.conflict);
      setOperationError("File changed on disk");
      return undefined;
    }

    setOperationError(error instanceof Error ? error.message : "Operation failed");
    return undefined;
  }
}
