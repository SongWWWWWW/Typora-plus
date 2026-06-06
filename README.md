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
- inactive Markdown marker soft hiding
- code fence block styling with inactive language/copy widgets
- Markdown table block styling with escaped-pipe- and inline-code-aware inactive previews, targeted row/column insertion and deletion controls, column alignment controls, and source-focused cell navigation
- standalone image preview cards
- KaTeX-backed display math preview blocks with TeX copy controls, error diagnostics, and source-focused click editing
- KaTeX-backed inline math previews with error diagnostics and source-focused click editing
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
- hardened HTML note export through a platform export service, Markdown HTML provider, Electron save dialog bridge, and browser download fallback
- platform-level keybinding service for command execution, with Workbench shortcut defaults, active shortcut labels, user-editable overrides, and conflict confirmation
- persisted configuration service for appearance, editor, including auto-save delay, and workspace preferences, with platform-owned numeric constraints, stored-value clamping, Electron native storage, and browser fallback
- workspace search and attachment settings are applied to platform services when preferences change
- Settings preferences dialog with setting search and section navigation for appearance, editor, auto-save delay, workspace, and searchable keybinding options by command or shortcut label, including modified-only filtering, reset-all cleanup, and numeric controls derived from platform configuration bounds, opened from the activity bar, command palette, or `Ctrl+,`
- HTML export embeds resolved workspace-relative images as data URLs through the platform resource service, while preserving safe fallback behavior when a resource cannot be resolved

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

Do not add user-facing behavior through scattered constants. Defaults belong in configuration, visual values belong in theme tokens, and platform behavior belongs behind services.

## Git Workflow

- Commit each completed feature or process milestone separately.
- Keep `main` for reviewed stage progress.
- After a main-stage milestone is complete, continue new work on topic branches such as `feature/native-workspace`.
- Submit topic branch work through pull requests, review the changes before merge, and record meaningful stage outcomes in `docs/DEVELOPMENT_LOG.md`.
