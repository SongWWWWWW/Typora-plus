# Typora Plus

Typora Plus is a local-first Markdown notes app built around a clean live-editing surface and an industrial, VS Code-inspired architecture.

## Current Stage

P0/P1 are implemented:

- npm workspace monorepo
- strict TypeScript project references
- layered packages for base, platform, markdown, theme, editor, workbench, desktop
- CodeMirror 6 Markdown editor
- live-preview-oriented line styling
- unified live preview block-state analysis
- inactive Markdown marker soft hiding for block prefixes, task list state markers, closing heading markers, inline code, inline/reference links and images, autolinks, emphasis, and strikethrough
- source-backed task list creation, toggling, and restoration through inactive checkboxes, focused checkbox keys, editor commands, `Mod-Enter`, and `Mod-Shift-Enter` on current, multi-selected, or range-selected list/task lines
- shared core inline syntax scanning for marker hiding and table source mapping
- code fence block styling with inactive language/copy widgets
- Markdown table block styling with inactive previews that preserve escaped pipes, inline code, emphasis, strikethrough, inline math, autolinks, inline HTML syntax, and full/collapsed/shortcut link-image syntax, plus targeted row/column insertion and deletion controls, column alignment controls, and source-focused cell navigation
- standalone image preview cards
- KaTeX-backed multiline and single-line display math preview blocks for `$$` and `\[` delimiters, with TeX copy controls, error diagnostics, and trimmed source-focused click editing
- KaTeX-backed inline math previews for `$` and `\(` delimiters, with error diagnostics and source-focused click editing
- focus mode and typewriter mode
- command palette with command/category/shortcut search, keyboard list navigation, sidebar, outline, current-note search
- browser draft persistence
- Electron shell skeleton
- unit tests and build verification

P2 main progress is implemented:

- native Electron workspace picker and Markdown file tree scanning
- restricted file read/write/save-as IPC
- workbench file explorer and active file switching
- quick open overlay with fuzzy file matching and keyboard list navigation
- pasted image attachment bridge and editor insertion path
- persisted recent files and workspaces
- active workspace refresh
- workspace file watcher refresh events
- save conflict detection with reload/overwrite handling
- trusted recent workspace reopening
- workspace-wide search, Markdown metadata collection, backlink queries, and tag queries through an index service boundary
- current-note backlinks sidebar backed by the workspace index service
- workspace tags sidebar backed by the workspace index service
- workspace-backed image preview resource resolution
- saved workspace files, including new save-as files after workspace catch-up, refresh their search, tag, and backlink index entries immediately after successful save
- workspace index storage and query behavior sit behind a provider boundary, with an in-memory provider, workspace-scoped persisted snapshot provider, Electron native snapshot storage, browser fallback storage, and a contract ready for a future SQLite provider
- automated architecture boundary tests for package source imports, workspace dependency declarations, and TypeScript project references
- hardened HTML note export through a platform export service, Markdown HTML provider, Electron save dialog bridge, and browser download fallback
- platform-level command service with separated command metadata, executable handlers, observable command metadata changes, Workbench command surface refresh, async execution, and `onCommand:<id>` activation before retrying metadata-only command execution; keybinding service support for command execution, Workbench shortcut defaults, active shortcut labels, user-editable overrides, and conflict confirmation
- platform-level menu contribution and context-key services for titlebar and activitybar actions, with structured and string-parsed `when` clauses for future manifest-style contributions
- platform-level extension and extension-host services for static manifest registration of commands, menus, keybindings, themes, Markdown renderers, activation events, host-routed runtime activation, wire-safe activation plus handshake, command/context-key/AI-provider/export-provider/Markdown-renderer/remote-sync broker protocol messages, a protocol host/session/runtime-broker/runtime-facade boundary with linked transport testing and string wire transport adaptation for constrained extension APIs, remote provider callbacks, runtime contribution unregister, request correlation, configuration-backed request timeout and wire-message limits, and future host adapters, a selectable built-in Ink theme contribution, and Workbench default menu/keybinding contributions supplied by a built-in extension manifest
- registered block Markdown renderer providers can render matching inactive code fences in the live preview through a Workbench adapter, with editor-owned HTML sanitization, loading/error/fallback states, source-focused click editing, and lazy provider activation
- registered inline Markdown renderer providers can render language-qualified inline code spans such as `` `status:done` `` through the same Workbench adapter boundary, with editor-owned inline HTML sanitization and source-focused click editing
- renderer preview results are cached with a bounded, configuration-driven LRU in the Workbench adapter so repeated viewport remounts do not re-run heavy providers for identical code fences or inline renderer spans
- platform-level AI service boundary, registered and observed in Workbench, for provider-backed text requests, configuration-backed Responses provider definitions with Electron-owned secret storage and request execution, Settings provider diagnostics, extension/runtime provider registration, active-note request construction, summarize-active-note command execution with visible copyable and explicitly appendable response feedback, provider-gated titlebar discovery, observable provider lifecycle changes, provider-availability context keys, and stable default provider selection, keeping future OpenAI, Codex, local-model, or workspace-grounded assistants behind registered providers instead of UI-owned integrations
- built-in Mermaid code-fence preview and configuration-backed Status inline badges through the extension-style Markdown renderer path, with Mermaid lazy-loaded into a separate production chunk
- persisted configuration service for appearance, including custom theme selection, editor, including auto-save delay and renderer preview cache size, Markdown status badge vocabulary, and workspace preferences, with platform-owned numeric constraints, stored-value clamping, Electron native storage, and browser fallback
- workspace search and attachment settings are applied to platform services when preferences change
- Settings preferences dialog with setting search and section navigation for appearance, custom theme selection, editor, auto-save delay, renderer preview cache size, AI provider definitions with native secret write/delete controls and saved-provider connection testing, workspace, and searchable keybinding options by command or shortcut label, including modified-only filtering, reset-all cleanup, and numeric controls derived from platform configuration bounds, opened from the activity bar, command palette, or `Ctrl+,`
- HTML export resolves workspace-relative images through the platform resource service, writes sibling asset files when the native save bridge is available, and keeps data URL or safe-path fallback behavior for browser export and unresolved resources
- platform-level remote sync service boundary, registered and observed in Workbench, and exposed to extensions/runtime hosts for provider-backed workspace mirroring, observable provider lifecycle changes, provider-availability context keys, stable default provider selection, workspace resource normalization, stable diff planning with explicit operation targets, dry-run workspace sync plan command/result feedback, workspace/provider-gated titlebar discovery, execution, and conflict reporting so future Feishu Drive raw Markdown/assets mirroring or other cloud integrations stay out of UI code

## Commands

```bash
npm install
npm run dev
npm run typecheck
npm test
npm run build
npm run verify
```

The dev server runs the renderer at `http://127.0.0.1:5173`.

## Maintained Docs

- `README.md`: project entry and commands
- `docs/ARCHITECTURE.md`: package boundaries, services, extension direction
- `docs/DEVELOPMENT_LOG.md`: stage reviews and next work

## Quality Gate

Every stage must pass:

- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit --audit-level=moderate`

`npm test` includes package architecture boundary tests, so dependency-direction drift fails with the normal quality gate.

Do not add user-facing behavior through scattered constants. Defaults belong in configuration, visual values belong in theme tokens, and platform behavior belongs behind services.

## Git Workflow

- Commit each completed feature or process milestone separately.
- Keep `main` for reviewed stage progress.
- After a main-stage milestone is complete, continue new work on topic branches such as `feature/native-workspace`.
- Submit topic branch work through pull requests, review the changes before merge, and record meaningful stage outcomes in `docs/DEVELOPMENT_LOG.md`.
