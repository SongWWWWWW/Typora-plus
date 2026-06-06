# Development Log

## 2026-06-06 - P0/P1 Foundation

Completed:

- Created npm workspace monorepo.
- Added strict TypeScript project references.
- Implemented base lifecycle, event, URI helpers.
- Implemented platform service collection, command service, configuration service, workspace service, browser-backed text-file service.
- Implemented Markdown outline extraction and document stats with code-fence awareness.
- Added centralized theme tokens.
- Implemented CodeMirror 6 Markdown editor with live-preview-oriented styling.
- Implemented Workbench layout, activity bar, sidebar, outline, current-note search, command palette, statusbar, focus mode, typewriter mode, theme toggle.
- Added Electron main/preload skeleton with context isolation, sandbox, and disabled Node integration.
- Centralized Electron shell defaults in `apps/desktop/electron/shellConfig.ts`.
- Added build code splitting for editor/runtime dependencies.
- Added unit tests for base, platform, markdown, and editor behavior.

Quality gate:

- `npm run typecheck`: passed
- `npm test`: passed, 11 tests
- `npm run build`: passed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Browser verification: passed at `http://127.0.0.1:5173`
- Desktop viewport check: passed with stable editor/sidebar/titlebar/statusbar layout
- Mobile viewport check: passed without horizontal overflow

Review:

- No user content is stored in app-only proprietary structures; browser draft persistence is temporary for P1.
- Configuration defaults live in `packages/platform/src/configuration.ts`.
- Visual values live in `packages/theme/src/tokens.css` or editor theme configuration.
- Workbench consumes services instead of directly owning persistence.
- Editor does not depend on Workbench or Electron.
- Source directories were checked after build; generated artifacts remain in `dist` outputs.

Known limitations:

- Native filesystem service is not implemented yet.
- SQLite indexing is not implemented yet.
- Markdown live preview currently styles lines; inactive marker hiding and rich block widgets are planned.
- Extension host is architectural direction only at this stage.

Next stage:

- P2: native file workspace, file tree, quick open, real save/open flow, attachment/image paste service.

Repository handoff:

- Connected local project to `https://github.com/SongWWWWWW/Typora-plus.git`.
- Pushed P0/P1 stage work to `main` as separate feature commits.
- Future non-mainline work should use topic branches and pull requests after the main-stage milestone is complete.

## 2026-06-06 - P2 Main Progress

Completed:

- Added platform file service contracts and native host bridge.
- Added observable workspace state with file tree metadata.
- Added native Electron IPC for opening Markdown workspaces, reading files, saving files, and save-as.
- Added restricted IPC path validation so renderer code cannot directly access arbitrary files.
- Added Workbench file explorer with active note switching and browser fallback state.
- Added quick open overlay with fuzzy matching for workspace files.
- Added attachment service contract and Electron IPC for pasted images.
- Added editor paste handling that inserts Markdown image syntax after the attachment service saves the image.
- Added tests for workspace file services and attachment service behavior.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 14 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- File system access is behind `IFileService`; Workbench does not call Electron directly.
- Attachment persistence is behind `IAttachmentService`; the editor only inserts returned Markdown.
- Electron preload exposes a narrow IPC bridge with context isolation and sandbox still enabled.
- Workspace scanning limits depth and file count through shell configuration.
- Visual additions use existing theme tokens and stable row dimensions.

Known limitations:

- Recent files are not persisted yet; this should be handled as the next mainline feature before SQLite indexing.
- Native file dialog behavior was type/build verified, but automated dialog interaction was not exercised in the in-app browser.
- File conflict prompts and external file watcher refresh are not implemented yet.

Next stage:

- P2 continuation: persisted recent files, workspace refresh/watch, save conflict prompts, then SQLite indexing.

## 2026-06-06 - P2 Continuation

Completed:

- Added `IRecentService` for persisted recent files and workspaces.
- Added recent file and recent workspace sections to the file sidebar.
- Recorded recent workspaces after opening a workspace.
- Recorded recent files after opening, saving, and save-as operations.
- Prevented auto-save from triggering save-as dialogs for untitled notes.
- Added `IFileService.refreshWorkspace()` and Electron IPC for refreshing the active workspace scan.
- Added a Workbench command and file panel action for workspace refresh.

Quality gate:

- `npm run typecheck`: passed before documentation update
- `npm test`: passed, 15 tests before documentation update

Review:

- Recent state is isolated behind `IRecentService`; UI does not read local storage directly.
- Refresh still goes through the native file service bridge; Workbench does not access filesystem paths.
- Recent workspace rows are displayed as history but not reopened directly yet, avoiding a renderer-controlled arbitrary path read.

Known limitations:

- Recent workspaces are not directly reopenable until trusted recent paths move to the main process.
- File watcher and conflict prompts remain pending.

## 2026-06-06 - P2 Watcher and Save Conflict Handling

Completed:

- Added workspace file watcher events in the Electron main process.
- Added a safe preload subscription for workspace file tree changes.
- Updated `IFileService` so native workspace changes flow through the existing service event.
- Updated Workbench workspace state to refresh from file service events.
- Added mtime-based save conflict detection in the native write path.
- Added text-file model disk mtime tracking for conflict-aware saves.
- Added a compact save conflict dialog with reload and overwrite actions.
- Added platform tests for native workspace change events and conflict-aware save behavior.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 18 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- File watching remains in the Electron main process; renderer code still receives only serialized workspace trees.
- Save conflict checks happen in the restricted native write channel, not in Workbench UI code.
- Conflict handling preserves dirty editor content until the user explicitly reloads or overwrites.
- UI additions use existing theme tokens and stable modal dimensions.

Known limitations:

- Recent workspaces are still displayed as history only; trusted reopen remains a future native-main flow.
- Automated native dialog interaction is still not covered by browser verification.

## 2026-06-06 - P2 Trusted Recent Workspace Reopen

Completed:

- Added `IFileService.openRecentWorkspace()` for reopening workspace roots through the file service boundary.
- Added Electron IPC for recent workspace reopen.
- Added a main-process trusted workspace store populated only after native directory picker selection.
- Added shell configuration for trusted workspace storage file and maximum tracked entries.
- Enabled recent workspace rows in the file sidebar when the native file service is available.
- Added a platform test for native recent workspace reopening through `IFileService`.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 19 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- Renderer recent data is still treated as untrusted input.
- Main process validates recent workspace paths against its own trust store before scanning files.
- Workbench still coordinates workspace changes through `IFileService` and `IWorkspaceService`; it does not access local paths directly.

Known limitations:

- Existing recent workspace entries from before this trust store was introduced must be reopened once through the native picker before trusted reopen succeeds.
- Automated native dialog interaction is still not covered by browser verification.

## 2026-06-06 - P2 Workspace Index Search

Completed:

- Added `IIndexService` and `WorkspaceIndexService` for asynchronous workspace indexing.
- Added centralized workspace search limits in configuration.
- Indexed Markdown files through `IFileService` instead of direct file access.
- Added cross-file search results in the Workbench search panel when a workspace is open.
- Preserved current-note search behavior when no workspace is open.
- Added platform tests for cross-file indexing and configured large-file skipping.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 21 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- Workbench depends on the index service boundary, so a future SQLite-backed provider can replace the in-memory implementation without changing UI search flows.
- Indexing is asynchronous and yields during larger workspaces so editor input is not intentionally blocked by scanning.
- Search limits live in configuration rather than scattered UI constants.

Known limitations:

- The current provider is in-memory; SQLite persistence remains planned for durable search, links, tags, and headings.
- Saved-file updates rely on workspace refresh/watch to trigger reindexing.

## 2026-06-06 - P2 Live Preview Marker Refinement

Completed:

- Added inactive-line Markdown syntax marker soft hiding in the editor live preview layer.
- Covered headings, quotes, lists, code fences, links, images, and strong emphasis delimiters.
- Kept the active line fully source-visible for editing.
- Moved marker and passive-line opacity values into theme tokens.
- Added editor tests for marker range detection and active-line behavior.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 25 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- Marker detection lives in `packages/editor`; Workbench and platform services do not parse editor Markdown syntax.
- Visual strength is controlled by theme tokens instead of local hard-coded opacity values.
- The implementation uses CodeMirror decorations and preserves the plain Markdown document model.
- Mobile titlebar secondary actions collapse so the editor shell does not overflow narrow viewports.

Known limitations:

- Marker hiding is regex-based for the initial live preview pass; parser-backed position mapping remains planned.
- Rich block widgets for images, tables, math, and code fences remain future editor work.

## 2026-06-06 - P2 Code Fence Block Styling

Completed:

- Added code fence line-state analysis for open, content, and close lines.
- Styled fenced code blocks as cohesive blocks instead of styling only fence delimiter lines.
- Kept fence analysis inside `packages/editor` and exposed it for focused unit tests.
- Separated opening and closing fence detection so fence-like code content stays inside the block.
- Added theme tokens for code block background and border colors.
- Tightened fence-state tracking so editor decorations scan only the state needed for visible ranges.

Quality gate:

- `npm run typecheck`: passed
- `npm test`: passed, 29 tests
- `npm run verify`: passed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- Workbench and platform remain unaware of editor Markdown syntax details.
- Code block visual values are supplied by theme tokens.
- The plain Markdown text model remains unchanged; CodeMirror decorations only affect presentation.

Known limitations:

- Code fences are styled as blocks but do not yet have richer widgets such as language labels or copy controls.
- Parser-backed position mapping remains planned for more complex Markdown constructs.

## 2026-06-06 - P2 Table Block Styling

Completed:

- Added Markdown table line-state analysis for header, delimiter, and body rows.
- Styled table rows as cohesive blocks with header, delimiter, body, first, and last row classes.
- Kept table detection code-fence-aware so table-like code content is not restyled.
- Added table theme tokens for row, header, and border colors.
- Refactored line classification state into an object so future block roles can be added without positional parameters.

Quality gate:

- `npm run typecheck`: passed
- `npm test`: passed, 33 tests
- `npm run verify`: passed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- The table feature stays in the editor presentation layer and does not change the Markdown text model.
- Workbench, platform, and file services remain unaware of Markdown table syntax.
- Visual values are supplied by theme tokens, not inline hard-coded component colors.

Known limitations:

- Tables are visually grouped but do not yet provide structural editing controls.
- Escaped pipe parsing remains a future parser-backed Markdown enhancement.

## 2026-06-06 - P2 Image Preview Cards

Completed:

- Added standalone Markdown image line analysis with code-fence awareness.
- Added inactive-line image preview cards while keeping the active line editable as source Markdown.
- Rendered safe inline/blob image sources directly and represented relative or external sources as compact cards.
- Added image block, border, and preview theme tokens.
- Kept image preview state inside the editor presentation layer.

Quality gate:

- `npm run typecheck`: passed
- `npm test`: passed, 39 tests
- `npm run verify`: passed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- The editor still owns Markdown presentation details; workbench and platform contracts did not change.
- Image cards preserve the source text model and only replace inactive standalone image lines visually.
- Direct rendering is intentionally limited to inline/blob sources to avoid implicit remote or local file loading.

Known limitations:

- Workspace-relative image files are not yet resolved into safe renderer URLs.
- Remote image loading remains deferred until privacy controls and resource policy are defined.
