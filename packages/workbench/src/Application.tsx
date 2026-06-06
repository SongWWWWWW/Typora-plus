import { DisposableStore } from "@typora-plus/base";
import { MarkdownEditor, type MarkdownEditorHandle } from "@typora-plus/editor";
import { calculateMarkdownStats, extractOutline, type OutlineEntry } from "@typora-plus/markdown";
import type { TextFileModel, TyporaPlusConfiguration } from "@typora-plus/platform";
import { applyTheme, resolveThemeName } from "@typora-plus/theme";
import {
  Command as CommandIcon,
  FileText,
  ListTree,
  Moon,
  PanelLeft,
  Save,
  Search,
  Sun,
  Target,
  Type,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { WorkbenchServices } from "./services";

type SideView = "files" | "search" | "outline";

export interface WorkbenchApplicationProps {
  readonly services: WorkbenchServices;
}

interface SearchResult {
  readonly line: number;
  readonly preview: string;
}

const autoSaveDelayMs = 800;

export function WorkbenchApplication({ services }: WorkbenchApplicationProps) {
  const [configuration, setConfiguration] = useState<TyporaPlusConfiguration>(
    services.configurationService.getValue()
  );
  const [model, setModel] = useState<TextFileModel>(() => services.textFileService.openDefault());
  const [sideView, setSideView] = useState<SideView | null>("outline");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const editorRef = useRef<MarkdownEditorHandle | null>(null);

  const outline = useMemo(() => extractOutline(model.value), [model.value]);
  const stats = useMemo(() => calculateMarkdownStats(model.value), [model.value]);
  const searchResults = useMemo(() => searchDocument(model.value, searchQuery), [model.value, searchQuery]);
  const workspace = services.workspaceService.getWorkspace();

  useEffect(() => services.configurationService.onDidChangeConfiguration(setConfiguration).dispose, [services]);

  useEffect(() => services.textFileService.onDidChangeModel(setModel).dispose, [services]);

  useEffect(() => {
    if (!configuration.editor.autoSave || !model.dirty) {
      return;
    }

    const handle = window.setTimeout(() => services.textFileService.save(), autoSaveDelayMs);
    return () => window.clearTimeout(handle);
  }, [configuration.editor.autoSave, model.dirty, model.value, services]);

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
      id: "file.save",
      title: "Save",
      category: "File",
      run: () => services.textFileService.save()
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
  }, [configuration, services, sideView]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const modifier = event.metaKey || event.ctrlKey;

      if (modifier && event.shiftKey && event.key.toLowerCase() === "p") {
        event.preventDefault();
        setPaletteOpen(true);
        return;
      }

      if (modifier && event.key.toLowerCase() === "s") {
        event.preventDefault();
        services.textFileService.save();
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
            outline={outline}
            searchQuery={searchQuery}
            searchResults={searchResults}
            onSearchQueryChange={setSearchQuery}
            onClose={() => setSideView(null)}
            onSelectLine={(line) => editorRef.current?.scrollToLine(line)}
          />
        ) : null}
        <section className="tp-editor-pane" aria-label="Editor">
          <MarkdownEditor
            ref={editorRef}
            value={model.value}
            configuration={editorConfiguration}
            onChange={(value) => services.textFileService.updateContent(value)}
          />
        </section>
      </div>
      <Statusbar model={model} stats={stats} />
      <CommandPalette
        open={paletteOpen}
        commands={services.commandService.getCommands()}
        onClose={() => setPaletteOpen(false)}
        onExecute={(id) => {
          services.commandService.executeCommand(id);
          setPaletteOpen(false);
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
        <IconButton title="Save" onClick={() => onCommand("file.save")}>
          <Save size={17} />
        </IconButton>
        <IconButton
          title="Focus Mode"
          active={configuration.editor.focusMode}
          onClick={() => onCommand("editor.focusMode.toggle")}
        >
          <Target size={17} />
        </IconButton>
        <IconButton
          title="Typewriter Mode"
          active={configuration.editor.typewriterMode}
          onClick={() => onCommand("editor.typewriterMode.toggle")}
        >
          <Type size={17} />
        </IconButton>
        <IconButton title="Theme" onClick={() => onCommand("theme.toggle")}>
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
  outline,
  searchQuery,
  searchResults,
  onSearchQueryChange,
  onClose,
  onSelectLine
}: {
  readonly view: SideView;
  readonly model: TextFileModel;
  readonly outline: readonly OutlineEntry[];
  readonly searchQuery: string;
  readonly searchResults: readonly SearchResult[];
  readonly onSearchQueryChange: (value: string) => void;
  readonly onClose: () => void;
  readonly onSelectLine: (line: number) => void;
}) {
  return (
    <aside className="tp-sidebar">
      <div className="tp-sidebar-header">
        <span>{sidebarTitle(view)}</span>
        <IconButton title="Close Sidebar" onClick={onClose}>
          <PanelLeft size={17} />
        </IconButton>
      </div>
      {view === "files" ? <FilesPanel model={model} /> : null}
      {view === "search" ? (
        <SearchPanel
          query={searchQuery}
          results={searchResults}
          onQueryChange={onSearchQueryChange}
          onSelectLine={onSelectLine}
        />
      ) : null}
      {view === "outline" ? <OutlinePanel outline={outline} onSelectLine={onSelectLine} /> : null}
    </aside>
  );
}

function FilesPanel({ model }: { readonly model: TextFileModel }) {
  return (
    <div className="tp-sidebar-content">
      <button className="tp-file-row" type="button">
        <FileText size={16} />
        <span>{model.name}</span>
        {model.dirty ? <span className="tp-row-dot" /> : null}
      </button>
    </div>
  );
}

function SearchPanel({
  query,
  results,
  onQueryChange,
  onSelectLine
}: {
  readonly query: string;
  readonly results: readonly SearchResult[];
  readonly onQueryChange: (value: string) => void;
  readonly onSelectLine: (line: number) => void;
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
      <div className="tp-result-list">
        {results.map((result) => (
          <button
            className="tp-result-row"
            key={`${result.line}-${result.preview}`}
            type="button"
            onClick={() => onSelectLine(result.line)}
          >
            <span className="tp-result-line">{result.line}</span>
            <span>{result.preview}</span>
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

function Statusbar({
  model,
  stats
}: {
  readonly model: TextFileModel;
  readonly stats: ReturnType<typeof calculateMarkdownStats>;
}) {
  return (
    <footer className="tp-statusbar">
      <span>{model.dirty ? "Saving" : "Saved"}</span>
      <span>{stats.words} words</span>
      <span>{stats.lines} lines</span>
    </footer>
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

function IconButton({
  title,
  active = false,
  children,
  onClick
}: {
  readonly title: string;
  readonly active?: boolean;
  readonly children: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button
      className={active ? "tp-icon-button tp-icon-button-active" : "tp-icon-button"}
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
  }
}
