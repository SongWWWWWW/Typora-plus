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

Architecture boundary tests scan package source imports, workspace package dependency declarations, and TypeScript project references against this dependency direction. A package cannot start depending on a higher layer without failing the normal test suite.

The desktop renderer build uses manual chunks for the largest runtime families. CodeMirror core, CodeMirror language support, React, generic vendor code, and the built-in Mermaid renderer dependency graph are separated so Mermaid can remain a lazy-loaded preview feature instead of increasing the startup bundle.

## Services

Current services:

- `IConfigurationService`: centralized and persisted appearance, editor, and workspace defaults
- `IContextKeyService`: structured context values and expression evaluation for conditional contributions
- `ICommandService`: command metadata registration, command handler registration, async execution, and command activation bridging
- `IExtensionService`: static extension manifest registration, theme contributions, activation events, and constrained runtime command/context-key/export-provider/Markdown renderer APIs
- `IExtensionHostService`: extension host registration, unambiguous host routing, and activation dispatch
- `IKeybindingService`: keybinding registration, keyboard event resolution, and async command dispatch
- `IMenuService`: menu/action contribution registration for Workbench surfaces such as titlebar and activitybar
- `ITextFileService`: active Markdown model, dirty state, conflict-aware save lifecycle
- `IWorkspaceService`: workspace identity
- `IFileService`: native workspace file tree, trusted recent workspace reopen, workspace change events, file open, save, save-as
- `IAttachmentService`: pasted image persistence through a native bridge
- `IRecentService`: persisted recent files and workspaces
- `IIndexService`: asynchronous workspace indexing, cross-file search, Markdown metadata collection, backlink/link graph queries, and tag queries through a replaceable index provider
- `IResourceService`: workspace-backed preview resource resolution through a native bridge
- `IExportService`: registered export providers, exported document generation, and native/browser save routing
- `IMarkdownRendererService`: registered Markdown renderer metadata, provider lifecycle, rendering delegation, and change events
- `IThemeService`: registered theme contributions, theme change events, and theme token validation

Native workspace trust is owned by the Electron main process. The renderer may request a recent workspace by URI, but the main process only opens paths previously selected through the native directory picker and recorded in the main-process trust store.

Preview resources are also resolved by the platform layer. The renderer passes the active note URI and Markdown image source through `IResourceService`; the Electron main process rejects protocols, absolute paths, path traversal, unsupported extensions, and oversized images before returning a renderer-safe data URL.

Workbench navigation surfaces, including search, outline, files, backlinks, and tags, consume package/service contracts. Backlinks and tags are queried through `IIndexService`; Workbench opens indexed source notes and scrolls to indexed lines without resolving Markdown links or processing raw tag metadata itself.

Successful workspace saves refresh the saved file's index record through `IIndexService.indexFile(file, value?)`. Workbench maps the saved model to the current workspace file entry and passes saved content; when save-as creates a file that is not listed yet, Workbench refreshes the workspace tree once and retries the index update. Markdown search, tag, and backlink extraction remain owned by the platform index provider.

`WorkspaceIndexService` owns scan orchestration and status updates. Indexed storage and query behavior sit behind `WorkspaceIndexProvider`; `InMemoryWorkspaceIndexProvider` owns query behavior, while `PersistedWorkspaceIndexProvider` adds a versioned, workspace-scoped snapshot cache through an injected storage boundary without changing Workbench consumers. Workspace snapshot keys are derived from the workspace root URI, so multiple workspaces do not overwrite each other's cached index. Desktop builds resolve the snapshot storage boundary through a narrow Electron preload bridge into main-process app data files; browser builds fall back to local storage. Batch hooks keep full workspace scans from writing a snapshot for every indexed file, and generation checks prevent canceled scans from writing stale documents after a newer scan has started. A future SQLite provider should implement the same storage/query contract. Workspace search limits are applied through the index service configuration boundary so Settings changes affect query limits immediately and file-size changes trigger Workbench to reindex the current workspace.

Keyboard shortcuts are resolved through `IKeybindingService` instead of hard-coded Workbench key checks. Workbench registers its default shortcuts as keybinding rules and dispatches resolved commands through `ICommandService`; command palette rows can read and search active labels from the same service through a focused command palette model. `ICommandService` keeps command metadata separate from executable handlers: metadata feeds command palette and Settings surfaces, while execution only succeeds when a handler is registered. Command execution is asynchronous. When a command has metadata but no handler, the command service calls its injected activation handler, then retries handler lookup before failing with a no-handler error. User keybinding overrides are persisted as validated configuration and applied as higher-priority keybinding rules, keeping the VS Code-like split between default contributions and user preferences. A shortcut label is only returned when that binding is currently effective for the command, so shadowed defaults do not mislead the UI.

Titlebar and activitybar actions are resolved through `IMenuService` instead of fixed button lists inside React components. Workbench default actions live in `workbenchContributions.ts` with stable menu ids, command ids, icon ids, order metadata, compact visibility, toggle context, and optional `when` expressions. `IContextKeyService` owns structured context values and expression evaluation, and `MenuService` filters contributed items when context changes. The platform also exposes a constrained `when` parser for manifest-style strings with keys, `!`, `==`, `!=`, `&&`, `||`, parentheses, and primitive values; it creates structured expressions rather than executing code. `Application.tsx` synchronizes Workbench state such as active resource scheme, side view, editor modes, workspace availability, and native file-system availability into context keys, then renders the filtered contributions and maps icon ids to React icons locally. This mirrors VS Code-style contribution registration: commands, keybindings, menus, and context keys are separate contribution points that can later be fed by extensions without rewriting the shell.

`IExtensionService` is the current manifest and runtime API boundary. It accepts extension manifests with command, menu, keybinding, theme, Markdown renderer, and activation-event contributions, validates required ids and primitive fields, parses menu `when` strings into structured context expressions, registers contributions through the existing command/menu/keybinding/theme/Markdown renderer services, and returns one disposable that unregisters the whole extension. Registration failures roll back partial contributions. Manifest commands register command metadata and derive `onCommand:<command>` activation events. Manifest themes register through `IThemeService`, which validates Typora Plus CSS token names, rejects unsafe token values, and publishes theme changes before exposing theme metadata. Manifest Markdown renderers register through `IMarkdownRendererService`, derive `onMarkdownRenderer:<id>` activation events, and remain metadata-only until activation supplies a runtime provider. The Workbench listens for theme changes, stores the selected theme id in configuration, and applies selected themes as a safe CSS-variable overlay through the theme package; removing a theme or choosing Default clears previously applied token overrides. `activateByEvent()` indexes matching extensions, tracks inactive/activating/activated/failed states, creates an `ExtensionContext`, and delegates activation to `IExtensionHostService`. That context exposes a constrained command API for registering runtime command handlers, executing commands, and reading command metadata; a constrained context-key API for setting and reading extension-owned keys under the extension id namespace; a constrained export API for registering provider-backed export formats through `IExportService`; a constrained Markdown API for registering renderer providers through `IMarkdownRendererService`; and a subscription store owned by the extension record. Runtime command registrations, extension-owned context keys, extension export providers, and extension Markdown renderer providers are cleared when activation fails or when the extension is unregistered. `IExtensionHostService` registers extension hosts, rejects duplicate host ids, rejects missing hosts, and rejects ambiguous matches so activation routing stays explicit. Extension host protocol messages now define wire-safe activation request/result/error payloads plus command, context-key, export-provider, and Markdown-renderer broker payloads that can cross an out-of-process boundary. Protocol command messages cover runtime command registration, command unregistration, command execution with bounded JSON arguments, and command list requests; context-key messages cover extension-owned key set/clear/get requests with primitive values only; export messages cover provider registration, provider unregistration, export document requests, exported document results, bounded asset metadata, image MIME types, relative asset paths, and base64 payloads; Markdown-renderer messages cover provider registration, provider unregistration, render requests, render results, bounded source text, bounded HTML, renderer metadata, and language normalization. `ExtensionHostRuntimeBroker` consumes the runtime API side of those messages for one activated extension context, maps them onto the constrained context APIs, registers and unregisters proxy command/export/renderer providers, and calls an injected request function for future host-side command handlers and provider callbacks. `ExtensionHostProtocolSession` wraps a transport-shaped `send`/`onMessage` pair, owns request id generation, pending request correlation, activation request dispatch, inbound runtime API routing through the broker, response identity checks, error reporting, and broker lifetime. `ExtensionHostProtocolHost` implements the existing `ExtensionHost` interface, uses a caller-provided transport factory to create one protocol session per extension id, reuses that session across activations, and ties session disposal to both host disposal and the extension subscription lifecycle. The protocol host, session, and broker do not own IPC, load extension code, or expose internal services. These messages include request ids, extension ids, bounded strings, bounded JSON values where appropriate, and bounded error details, but intentionally exclude `ExtensionContext` functions and internal service instances. Workbench wires the command service activation handler to `activateByEvent("onCommand:<command>")`, so command palette, keybinding, and menu command execution can activate a matching extension before command execution is retried. Workbench also wires the Markdown renderer service activation handler to `activateByEvent("onMarkdownRenderer:<id>")`, so renderer execution can activate a matching extension before provider lookup is retried. Workbench default menus, shortcuts, the built-in Ink theme, and the built-in Mermaid and Status renderer metadata are supplied through a built-in extension manifest, while Workbench command handlers remain registered by `Application.tsx`. The in-process Workbench extension host only handles the built-in extension runtime and registers the Mermaid and Status providers through the same `ExtensionContext.markdown` API that future hosts will broker; a future out-of-process host can use the same context boundary without exposing internal services, DOM access, or unrestricted Node access.

User preferences are owned by `IConfigurationService`. The service reads and writes validated configuration through an injected storage boundary, so Workbench commands update preferences through the service without accessing storage directly. Editor behavior defaults, including auto-save timing and renderer preview cache size, live in configuration rather than Workbench constants. Markdown workflow defaults, including the Status badge vocabulary, also live in configuration with bounded validation so built-in renderers do not carry private alias tables. Appearance preferences include the base color scheme and an optional selected theme id; clearing the selected theme id removes the custom token overlay rather than leaving stale CSS variables. Numeric configuration bounds are platform-owned, persisted numeric values are clamped by the configuration layer before consumers read them, and defaults stay aligned with control steps so Settings does not display divergent slider and number values. Workspace preference changes are synchronized into the affected platform services, including index limits and attachment asset folders. In Electron, the preload bridge routes configuration storage to a main-process file under the app data directory; browser builds fall back to browser storage.

The settings UI is a Workbench contribution, not a storage owner. `SettingsDialog` renders appearance, custom theme, editor, renderer preview cache, workspace, and keybinding controls, then sends partial updates to `IConfigurationService`. Settings section definitions, section anchors, searchable setting entries, asset-folder normalization, keybinding command/shortcut-label search, modified filtering, and keybinding override list updates live in focused Workbench models so the dialog can grow without scattering UI constants. Numeric Settings controls reuse platform configuration constraints, including megabyte display conversion for workspace file-size limits, so UI bounds and stored-value validation stay aligned. When a recorded shortcut is already active for another command, Settings shows an inline conflict confirmation before writing the override. Batch keybinding reset clears persisted user overrides through the same configuration boundary instead of mutating keybinding service state directly.

Keyboard-driven list surfaces share a small Workbench navigation model. Command Palette and Quick Open keep local active-row state, but bounds normalization and Arrow/Home/End movement live in `listNavigationModel.ts`, so new palette-like surfaces can reuse the same behavior without copying key handling into JSX.

Export is a provider-backed platform service. `IExportService` owns provider registration, duplicate-format rejection, save routing, and provider context such as resource resolution and asset mode. The Markdown package contributes the current HTML provider using `marked`, while the Electron main process owns the save dialog and bounded file writes. When export providers need note resources, `IExportService` injects a resolver backed by `IResourceService` into provider input. When native saving is available, providers receive file asset mode; browser fallback uses inline mode so a single downloaded document remains usable. Extension runtime export providers register through `ExtensionContext.exports` and share the same provider lifecycle and cleanup path as other runtime contributions. The HTML provider uses a safe renderer that escapes raw HTML, drops unsafe link/image targets, pre-collects safe relative Markdown image tokens, and either rewrites resolved workspace images to sibling export assets or embeds them as data URLs. Missing or unavailable resources fall back to the existing safe relative image path instead of blocking export. Native export asset writes are bounded by shell configuration, reject invalid paths, reject non-image MIME types, and keep all asset paths inside the chosen export directory. Native saving only supports formats present in the desktop export configuration, so new runtime formats need matching shell support before they can use the native save dialog. Workbench registers an `Export HTML` command and toolbar action but does not render Markdown, resolve image paths, or write exported files directly.

Markdown renderer extensibility is also provider-backed. `IMarkdownRendererService` keeps renderer metadata separate from executable providers, mirroring the command metadata/handler split and the export provider boundary. Manifest contributions describe renderer id, label, block/inline kind, optional language, and priority; runtime providers register through `ExtensionContext.markdown` after activation. When `render()` is called for a known renderer without a provider, the service invokes its activation handler and retries provider lookup before failing. Unknown renderers do not trigger activation. `getRenderers()` reports whether a provider is available without exposing provider functions to Workbench callers. The platform service never inserts provider output into the DOM. Workbench adapts registered block renderers with matching code-fence languages into the editor through a `MarkdownCodeFenceRenderer` callback; the editor owns the capability gate, async preview widget lifecycle, source navigation, and HTML sanitization before provider output reaches the live-preview surface. Workbench also adapts registered inline renderers through a separate `MarkdownInlineRenderer` callback. Inline renderer previews are opt-in through language-qualified inline code spans such as `` `status:done` ``; ordinary inline code is left untouched. The editor sanitizes inline renderer output with a smaller inline-only allowlist before insertion, while still preserving source-focused click editing. The Workbench adapter keeps bounded LRU caches keyed by renderer id, active document URI, renderer language, and source content so viewport remounts reuse successful heavy render results; block cache keys also include code-fence info. The cache entry limit comes from editor configuration and `0` disables caching for diagnostics. Markdown configuration changes recreate the renderer adapters, naturally dropping cache entries that depended on old renderer preferences. Failed render attempts are removed from the cache so transient provider failures can recover. The built-in Mermaid provider lazy-loads Mermaid only when a `mermaid` code fence is previewed, renders SVG through Mermaid's engine with strict security settings, wraps the SVG as an encoded `data:image/svg+xml` image, and relies on the editor sanitizer to accept only safe encoded data-image sources and `tp-renderer-*` classes. The built-in Status provider renders `status` inline spans into compact escaped badges with existing theme tokens and reads its sanitized badge vocabulary from configuration at render time, keeping note workflow markers useful without adding editor-specific parsing logic beyond the generic inline renderer syntax.

Planned services:

- SQLite-backed index provider for `IIndexService`: durable search, metadata, link graph queries, and tag queries beyond the current snapshot cache
- out-of-process extension host transport and implementation for loading external extension code through the existing host routing, protocol message, and runtime API boundaries

## Editor Model

The editor is backed by CodeMirror 6. The current P1 implementation styles Markdown lines in a live-preview direction while preserving source text as the editable model.

Current features:

- Markdown language support
- history, search, selection, bracket matching
- unified live preview block-state analysis with normalized visible editor ranges
- heading/quote/list/fence line styling
- inactive Markdown marker soft hiding for headings, lists, quotes, fences, links, and strong emphasis
- code fence block styling with visible-range-aware fence state tracking, inactive language/copy widgets, and provider-backed previews for matching code-fence languages with sanitized HTML and source-focused click editing
- provider-backed inline renderer previews for language-qualified inline code spans, using inline-only sanitized HTML and source-focused click editing
- built-in Status inline badge preview for `` `status:done` ``, `` `status:blocked: Waiting on API` ``, and configuration-backed workflow markers through the Markdown renderer provider path
- built-in Mermaid preview for inactive `mermaid` code fences through the Markdown renderer provider path
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

Extensions should run out of process once external extension code loading is implemented. The current platform supports:

- commands
- menus
- keybindings
- themes
- Markdown renderer contributions, runtime renderer providers, and sanitized code-fence and inline preview integration
- activation events
- extension host routing for built-in and future external runtimes
- wire-safe activation protocol messages for future out-of-process hosts
- wire-safe command and context-key broker protocol messages for future out-of-process hosts
- wire-safe export-provider and Markdown-renderer broker protocol messages for future out-of-process hosts
- platform runtime broker for mapping validated runtime API messages to constrained extension context APIs and remote callbacks
- platform protocol session for request correlation, inbound broker routing, activation dispatch, and future transport adapters
- protocol `ExtensionHost` adapter for registering transport-backed hosts with `IExtensionHostService`
- activation context with constrained command registration, command execution, command metadata reads, extension-owned context keys, export-provider registration, Markdown renderer provider registration, and extension-owned subscriptions

Registered block and inline Markdown renderer providers are connected to preview surfaces through the Workbench adapter and editor-owned sanitizers. Future renderer work should extend additional preview surfaces without giving extensions direct DOM access.

Extensions must not receive direct DOM or unrestricted Node access.

## Stage Review Rules

At the end of every stage:

- run the full quality gate
- review package dependencies for boundary drift; the architecture boundary tests must stay aligned with the documented layer direction
- move repeated visual values into theme tokens
- move repeated behavior defaults into configuration
- reject hard-coded file paths and platform assumptions
- record only meaningful decisions in `docs/DEVELOPMENT_LOG.md`
