# Typora Plus Architecture

## Principles

Typora Plus keeps the writing surface simple while keeping the system extensible:

- Markdown files are the future source of truth.
- UI consumes services and tokens instead of owning platform behavior.
- Core packages stay small; feature growth should move through contrib or extension-style boundaries.
- Configuration defaults are centralized.
- Theme values are centralized as CSS tokens.
- Heavy work such as indexing, export, and extension execution must not block editor input.

## Package Layers

```text
packages/base        lifecycle, events, URI, low-level utilities
packages/platform    service container, configuration, commands, text-file model
packages/markdown    Markdown outline, stats, document helpers
packages/theme       theme resolution and CSS design tokens
packages/editor      CodeMirror-backed Markdown editor
packages/workbench   application layout, commands, sidebar, statusbar
apps/desktop         renderer entry, Vite config, Electron shell
```

Dependency direction is upward only:

```text
base -> platform -> workbench -> app
markdown -> editor -> workbench -> app
theme -> workbench/app
```

The editor package does not know about files, windows, Electron, or sidebars. The workbench does not parse Markdown manually beyond calling the Markdown package. The desktop app only bootstraps services and shell entry points.

## Services

Current services:

- `IConfigurationService`: centralized and persisted appearance, editor, and workspace defaults
- `ICommandService`: command registration and execution
- `IKeybindingService`: keybinding registration, keyboard event resolution, and command dispatch
- `ITextFileService`: active Markdown model, dirty state, conflict-aware save lifecycle
- `IWorkspaceService`: workspace identity
- `IFileService`: native workspace file tree, trusted recent workspace reopen, workspace change events, file open, save, save-as
- `IAttachmentService`: pasted image persistence through a native bridge
- `IRecentService`: persisted recent files and workspaces
- `IIndexService`: asynchronous workspace indexing, cross-file search, Markdown metadata collection, backlink/link graph queries, and tag queries through a replaceable index provider
- `IResourceService`: workspace-backed preview resource resolution through a native bridge

Native workspace trust is owned by the Electron main process. The renderer may request a recent workspace by URI, but the main process only opens paths previously selected through the native directory picker and recorded in the main-process trust store.

Preview resources are also resolved by the platform layer. The renderer passes the active note URI and Markdown image source through `IResourceService`; the Electron main process rejects protocols, absolute paths, path traversal, unsupported extensions, and oversized images before returning a renderer-safe data URL.

Workbench navigation surfaces, including search, outline, files, backlinks, and tags, consume package/service contracts. Backlinks and tags are queried through `IIndexService`; Workbench opens indexed source notes and scrolls to indexed lines without resolving Markdown links or processing raw tag metadata itself.

Successful workspace saves refresh the saved file's index record through `IIndexService.indexFile(file, value?)`. Workbench maps the saved model to the current workspace file entry and passes saved content; when save-as creates a file that is not listed yet, Workbench refreshes the workspace tree once and retries the index update. Markdown search, tag, and backlink extraction remain owned by the platform index provider.

`WorkspaceIndexService` owns scan orchestration and status updates. Indexed storage and query behavior sit behind `WorkspaceIndexProvider`; `InMemoryWorkspaceIndexProvider` is the default provider for the current stage, and a future SQLite provider should implement the same storage/query contract without changing Workbench consumers.

Keyboard shortcuts are resolved through `IKeybindingService` instead of hard-coded Workbench key checks. Workbench registers its default shortcuts as keybinding rules and dispatches resolved commands through `ICommandService`; command palette rows can read and search active labels from the same service through a focused command palette model. User keybinding overrides are persisted as validated configuration and applied as higher-priority keybinding rules, keeping the VS Code-like split between default contributions and user preferences. A shortcut label is only returned when that binding is currently effective for the command, so shadowed defaults do not mislead the UI.

User preferences are owned by `IConfigurationService`. The service reads and writes validated configuration through an injected storage boundary, so Workbench commands update preferences through the service without accessing storage directly. In Electron, the preload bridge routes configuration storage to a main-process file under the app data directory; browser builds fall back to browser storage.

The settings UI is a Workbench contribution, not a storage owner. `SettingsDialog` renders appearance, editor, workspace, and keybinding controls, then sends partial updates to `IConfigurationService`. Settings section definitions, section anchors, searchable setting entries, numeric setting bounds, asset-folder normalization, keybinding command/shortcut-label search, modified filtering, and keybinding override list updates live in focused Workbench models so the dialog can grow without scattering UI constants. When a recorded shortcut is already active for another command, Settings shows an inline conflict confirmation before writing the override. Batch keybinding reset clears persisted user overrides through the same configuration boundary instead of mutating keybinding service state directly.

Keyboard-driven list surfaces share a small Workbench navigation model. Command Palette and Quick Open keep local active-row state, but bounds normalization and Arrow/Home/End movement live in `listNavigationModel.ts`, so new palette-like surfaces can reuse the same behavior without copying key handling into JSX.

Planned services:

- SQLite-backed index provider for `IIndexService`: persisted search, metadata, link graph queries, and tag queries
- `IExportService`: PDF/HTML/DOCX export providers
- `IExtensionService`: manifest, activation events, contribution points

## Editor Model

The editor is backed by CodeMirror 6. The current P1 implementation styles Markdown lines in a live-preview direction while preserving source text as the editable model.

Current features:

- Markdown language support
- history, search, selection, bracket matching
- unified live preview block-state analysis with normalized visible editor ranges
- heading/quote/list/fence line styling
- inactive Markdown marker soft hiding for headings, lists, quotes, fences, links, and strong emphasis
- code fence block styling with visible-range-aware fence state tracking and inactive language/copy widgets
- table block styling with code-fence-aware table detection, escaped-pipe- and inline-code-aware inactive previews, targeted row/column insertion and deletion controls, column alignment controls, and source-focused cell navigation
- standalone image preview cards with workspace-backed local image resolution and direct inline/blob rendering
- KaTeX-backed display math preview blocks with TeX copy controls, render diagnostics, and source-focused click editing
- KaTeX-backed inline math previews with render diagnostics and source-focused click editing for inactive lines
- focus mode dimming
- typewriter mode top spacing
- imperative line scrolling for outline and search

Next editor work:

- parser-backed table position mapping for more complex inline syntax
- parser-backed math position mapping

## Extension Direction

Extensions should run out of process once implemented. They should contribute through a manifest:

- commands
- menus
- keybindings
- themes
- Markdown renderers
- export providers

Extensions must not receive direct DOM or unrestricted Node access.

## Stage Review Rules

At the end of every stage:

- run the full quality gate
- review package dependencies for boundary drift
- move repeated visual values into theme tokens
- move repeated behavior defaults into configuration
- reject hard-coded file paths and platform assumptions
- record only meaningful decisions in `docs/DEVELOPMENT_LOG.md`
