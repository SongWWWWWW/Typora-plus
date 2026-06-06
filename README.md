# Typora Plus

Typora Plus is a local-first Markdown notes app built around a clean live-editing surface and an industrial, VS Code-inspired architecture.

## Current Stage

P0/P1 are implemented:

- npm workspace monorepo
- strict TypeScript project references
- layered packages for base, platform, markdown, theme, editor, workbench, desktop
- CodeMirror 6 Markdown editor
- live-preview-oriented line styling
- focus mode and typewriter mode
- command palette, sidebar, outline, current-note search
- browser draft persistence
- Electron shell skeleton
- unit tests and build verification

P2 main progress is implemented:

- native Electron workspace picker and Markdown file tree scanning
- restricted file read/write/save-as IPC
- workbench file explorer and active file switching
- quick open overlay with fuzzy file matching
- pasted image attachment bridge and editor insertion path
- persisted recent files and workspaces
- active workspace refresh
- workspace file watcher refresh events
- save conflict detection with reload/overwrite handling

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
