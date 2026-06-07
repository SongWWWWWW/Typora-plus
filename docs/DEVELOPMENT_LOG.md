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

## 2026-06-06 - P2 Workspace Image Resource Resolution

Completed:

- Added `IResourceService` and `NativeResourceService` for preview resource resolution.
- Exposed an Electron resource bridge that resolves Markdown image sources relative to the active note.
- Added main-process checks for protocol sources, absolute paths, path traversal, supported image extensions, and maximum preview size.
- Connected workbench and editor image cards so workspace images can resolve asynchronously without changing the Markdown text model.
- Kept browser builds safe: without a native bridge, relative images remain compact placeholders.

Quality gate:

- `npm run typecheck`: passed
- `npm test`: passed, 41 tests
- `npm run verify`: passed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- File-system access remains in Electron main and platform services; the editor only receives an optional source resolver.
- Resource constraints are centralized in shell configuration instead of being hard-coded in the editor.
- Remote image loading is still intentionally disabled.

Known limitations:

- Native workspace image resolution is covered by service and build verification; full Electron visual verification remains future desktop QA.
- Images are still represented by inline data URLs; a streaming or custom-protocol resource provider is planned for larger previews.

## 2026-06-06 - P2 Unified Live Preview Block Analysis

Completed:

- Added `analyzeMarkdownLineBlocks` as the shared block-state analysis entry point.
- Reused the unified analyzer for code fence, image, and table public analysis helpers.
- Replaced separate visible-range scans for code fences, images, and tables with one visible block-state pass.
- Removed obsolete live preview scanner helpers.
- Added tests for mixed block ordering and code-fence exclusion behavior.

Quality gate:

- `npm run typecheck`: passed
- `npm test`: passed, 43 tests
- `npm run verify`: passed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- This stage is a maintainability pass rather than a new visual feature.
- Future math, richer code fences, and table editing affordances can share one analysis contract.
- The editor package remains the only layer that understands Markdown live preview block state.

Known limitations:

- The analyzer is still regex-based; parser-backed position mapping remains planned.
- Visible-range analysis still scans preceding lines to recover fence/table context.

## 2026-06-06 - P2 Display Math Preview Blocks

Completed:

- Added display math block state to the unified live preview analyzer.
- Added `analyzeMarkdownMathBlocks` for focused math block tests.
- Rendered inactive `$$` blocks through KaTeX using MathML output.
- Kept the full math source editable whenever the cursor is inside the math block.
- Added math block theme tokens and preview styling.

Quality gate:

- `npm run typecheck`: passed
- `npm test`: passed, 47 tests
- `npm run verify`: passed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`

Review:

- Math rendering uses KaTeX rather than a hand-rolled formula renderer.
- The feature stays in the editor presentation layer and does not change the Markdown text model.
- Code fences still take precedence, so math-like text inside code blocks is not restyled.

Known limitations:

- Inline math is not yet rendered.
- The display math parser remains regex-based pending parser-backed position mapping.
- KaTeX is currently rendered as MathML without the full KaTeX CSS layer.

## 2026-06-06 - P2 Inline Math Preview

Completed:

- Added inactive-line inline math range detection for `$...$` expressions.
- Rendered inline math through KaTeX while keeping active lines fully editable as Markdown source.
- Skipped escaped dollars, `$$` display math delimiters, and inline code spans.
- Kept inline math previews out of fenced code blocks and display math blocks.
- Added a theme token for inline math preview styling.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 52 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Desktop and 390px viewport checks: passed without horizontal overflow or console errors

Review:

- Inline math remains an editor presentation feature and does not change the Markdown text model.
- KaTeX continues to own formula rendering; no hand-rolled renderer was added.
- Theme styling uses centralized tokens rather than local color constants.
- Parser logic is isolated in `packages/editor`, keeping Workbench and platform services unaware of Markdown inline syntax.

Known limitations:

- Inline math parsing is still lightweight and regex/scan based; parser-backed position mapping remains planned.
- KaTeX is still rendered as MathML without the full KaTeX CSS layer.

## 2026-06-06 - P2 Code Fence Widgets

Completed:

- Added richer code fence block state with language, info string, content, and block range metadata.
- Rendered inactive code fence opening lines as compact language/copy widgets.
- Kept code content visible while hiding inactive fence delimiter source.
- Kept the full code fence source visible whenever the cursor is inside the block.
- Added a guarded copy interaction with browser Clipboard API and textarea fallback.
- Added a code toolbar theme token and focused tests for code fence metadata and replacement rules.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 55 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Desktop 1280px and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- Code fence rendering remains inside `packages/editor`; Workbench and platform services do not parse Markdown code fences.
- The plain Markdown text model is unchanged; widgets are CodeMirror decorations only.
- Visual additions use centralized theme tokens.
- Visible-range analysis now avoids constructing code fence line states for non-visible lines when a visible-range filter is available.

Known limitations:

- Clipboard contents could not be asserted in the in-app browser because its virtual clipboard is unavailable; button presence and stable click behavior were verified without console errors.
- Code fence parsing remains scanner-based pending parser-backed position mapping.

## 2026-06-06 - P2 Table Preview Widgets

Completed:

- Added table block state with header cells, body rows, alignments, block range, and visible preview line metadata.
- Rendered inactive Markdown tables as compact table previews.
- Kept full Markdown table source visible whenever the cursor is inside the table block.
- Preserved code-fence and display-math precedence so table-like text inside those blocks is not restyled.
- Added focused tests for table metadata and inactive/active replacement rules.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 57 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Desktop 1280px and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- Table preview remains an editor decoration and does not alter the Markdown text model.
- Workbench, platform, and file services remain unaware of Markdown table syntax.
- Table styling reuses existing theme tokens; preview dimensions are centralized in named editor constants.
- Visible preview line metadata keeps large table rendering usable when the header is not the first visible table line.

Known limitations:

- Table parsing remains lightweight and does not yet handle escaped pipes.
- Structural table editing controls such as row/column insert and alignment menus are still future work.

## 2026-06-06 - P2 Math Preview Tools

Completed:

- Added a compact TeX toolbar to inactive display math previews.
- Added a shared preview copy button path used by code fence and math previews.
- Kept non-button preview clicks editable so clicking the math body restores Markdown source.
- Added named constants for preview copy and math preview dimensions.
- Added a focused test for preview event handling.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 58 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Desktop 1280px and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- Math tooling remains inside `packages/editor`; no Workbench or platform dependency was added.
- Code fence and math copy controls share one helper, reducing duplicated widget behavior.
- The Markdown text model is unchanged; preview tools are still CodeMirror decorations.
- Visual additions reuse existing theme tokens and named editor constants.

Known limitations:

- Clipboard contents could not be asserted in the in-app browser because its virtual clipboard is unavailable; button presence and stable click behavior were verified without console errors.
- KaTeX is still rendered as MathML without the full KaTeX CSS layer.

## 2026-06-06 - P2 Viewport-Aware Block Analysis

Completed:

- Extracted visible-range live preview analysis into `analyzeMarkdownLineBlocksForVisibleRanges`.
- Normalized unordered, overlapping, adjacent, and out-of-bounds visible line ranges before scanning.
- Preserved block context while returning states only for visible lines.
- Added focused tests for unordered visible ranges, invalid ranges, and large table previews where the header is outside the visible viewport.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 61 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Desktop 1280px and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- The viewport analyzer is pure and testable, keeping CodeMirror view details out of Markdown block-state logic.
- Workbench and platform boundaries did not change; live preview syntax knowledge remains in `packages/editor`.
- The implementation keeps the plain Markdown text model unchanged and only affects editor decoration analysis.
- No new visual constants or platform assumptions were introduced.

Known limitations:

- Visible-range analysis still scans preceding source lines to recover block context for scanner-based Markdown constructs.
- Parser-backed position mapping remains planned for more complex Markdown syntax and escaped table pipes.

## 2026-06-06 - P2 Table Editing Tools

Completed:

- Added compact row and column insert tools to inactive table previews.
- Added pure Markdown table transformation helpers for empty body row creation and blank column insertion.
- Re-read the full current table before applying table edit transactions so visible-range truncation cannot rewrite only part of a large table.
- Added focused tests for row creation, column insertion, alignment preservation, and requested insertion indexes.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 64 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: row and column buttons correctly rewrote Markdown source
- Desktop 1280px and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- Table editing remains inside `packages/editor`; Workbench, platform, and file services remain unaware of table syntax.
- The plain Markdown text model remains the source of truth; table tools dispatch CodeMirror text edits only.
- Visual values use named editor constants and existing theme tokens.
- Column insertion normalizes table source to pipe-delimited Markdown while preserving existing column alignments.

Known limitations:

- Table editing is limited to inserting a row below and inserting a column to the right.
- Alignment menus, row/column deletion, and cell-level editing remain future work.
- Escaped pipe parsing still depends on the planned parser-backed position mapping pass.

## 2026-06-06 - P2 Table Alignment Controls

Completed:

- Added per-column alignment controls to inactive table preview headers.
- Added a stable alignment cycle: auto, left, center, right.
- Added pure Markdown table transformation helpers for updating delimiter alignment cells.
- Reused the full-table re-read and replacement path so alignment changes do not depend on the current visible range.
- Added focused tests for alignment cycling, delimiter rewriting, content preservation, and out-of-range column clamping.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 67 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: first-column alignment button rewrote `---` to `:---`
- Desktop 1280px and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- Alignment behavior remains a pure editor-layer Markdown transformation.
- Workbench, platform, and file services still do not parse or mutate table syntax.
- The plain Markdown table remains the source of truth; controls dispatch CodeMirror text edits only.
- Visual values use named editor constants and existing theme tokens.

Known limitations:

- Alignment controls cycle state by clicking each header button; there is no expanded alignment menu yet.
- Row/column deletion and direct cell editing remain future work.
- Escaped pipe parsing still depends on the planned parser-backed position mapping pass.

## 2026-06-06 - P2 Math Render Diagnostics

Completed:

- Added a pure `renderMarkdownMathExpression` helper around KaTeX rendering.
- Classified math render output as valid, empty, or error before widget rendering.
- Added display math error feedback with a `TeX error` toolbar label and visible invalid TeX message.
- Added inline math error feedback while preserving the original source text.
- Added focused tests for valid MathML output, empty expressions, and invalid TeX.

Quality gate:

- `npm run verify`: passed
- `npm test`: passed, 70 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: valid math rendered as MathML; invalid display and inline math showed error states
- Desktop 1280px and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- KaTeX rendering remains inside `packages/editor`; Workbench and platform services remain unaware of math syntax.
- Widget code now consumes a testable render result instead of directly owning parse/error branching.
- The Markdown text model remains unchanged; diagnostics are presentation-only decorations.
- No new visual token family was needed; diagnostics reuse the existing math preview styles.

Known limitations:

- Error feedback is inline text and tooltip-based; no dedicated diagnostics panel exists yet.
- KaTeX is still rendered as MathML without the full KaTeX CSS layer.
- Parser-backed position mapping remains planned for more complex inline math cases.

## 2026-06-06 - P2 Table Deletion Tools

Completed:

- Added compact row and column deletion tools to inactive table previews.
- Added pure Markdown table transformation helpers for deleting body rows and columns.
- Disabled row deletion for tables without body rows.
- Disabled column deletion at the default two-column minimum so preview tools do not collapse tables into a poor editing shape.
- Reused the full-table re-read and replacement path so deletion does not depend on the current visible range.
- Added focused tests for last-row deletion, clamped row deletion, empty-body behavior, last-column deletion, requested column deletion, and minimum-width protection.

Quality gate:

- `npm run test -- --run packages/editor/src/livePreview.test.ts`: passed, 56 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 76 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: `Row -` removed the last body row; `Col -` removed the last column and became disabled at two columns.
- Desktop default viewport and mobile 390px checks: passed without horizontal overflow or console errors

Review:

- Table deletion remains inside `packages/editor`; Workbench, platform, and file services remain unaware of table syntax.
- The plain Markdown table remains the source of truth; preview controls dispatch CodeMirror text edits only.
- Transformation helpers are pure and covered by unit tests, keeping transaction wiring thin.
- Visual behavior uses named editor constants and existing theme tokens; no new theme family or platform assumption was introduced.

Known limitations:

- Deletion controls currently target the last row or last column from the preview toolbar; direct row/column selection is still future work.
- Direct table cell editing remains planned.
- Escaped pipe parsing still depends on the planned parser-backed position mapping pass.

## 2026-06-06 - P2 Escaped Pipe Table Parsing

Completed:

- Replaced direct pipe splitting with a small table-cell scanner that ignores escaped `\|` separators.
- Kept escaped pipe source text in the table block model so insert, delete, and alignment tools preserve Markdown source.
- Rendered escaped pipe cells in table previews as normal `|` characters for a closer Markdown preview experience.
- Added inline-size containment to table preview widgets so wide tables scroll internally without pushing toolbar controls off mobile viewports.
- Added focused tests for escaped-pipe table parsing, escaped-only non-table lines, and escaped source preservation through column edits.

Quality gate:

- `npm run test -- --run packages/editor/src/livePreview.test.ts`: passed, 59 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 79 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: escaped pipe cells rendered as normal `|`; column insertion preserved `\|` in source Markdown.
- Desktop default viewport and mobile 390px checks: passed without horizontal overflow or console errors; wide table toolbars stayed visible on mobile.

Review:

- Table parsing remains isolated in `packages/editor`; Workbench, platform, and file services remain unaware of Markdown table syntax.
- The plain Markdown source remains the durable model; preview display unescapes only for visual rendering.
- The scanner is small, deterministic, and covered by unit tests instead of scattering pipe-handling branches across editing tools.
- The mobile layout fix keeps table content scrollable inside the preview while preserving the toolbar as a stable control surface.

Known limitations:

- More complex Markdown table cases, such as inline code spans containing pipes and full parser-backed source mapping, remain planned.
- Deletion controls still target the last row or last column from the preview toolbar.
- Direct table cell editing remains planned.

## 2026-06-06 - P2 Targeted Table Deletion Controls

Completed:

- Added per-column delete controls to inactive table preview headers.
- Added per-row delete controls to inactive table preview body rows.
- Reused the existing pure row and column deletion transforms with explicit row and column indexes.
- Kept the existing toolbar actions for quick last-row and last-column deletion.
- Added shared preview button event wiring so table tool, alignment, and inline delete buttons use the same guarded interaction path.
- Added focused coverage for deleting a requested body row index.

Quality gate:

- `npm run test -- --run packages/editor/src/livePreview.test.ts`: passed, 60 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 80 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: `Delete row 2` removed only the middle body row; `Delete column 2` removed only the middle column and preserved remaining alignment.
- Desktop default viewport and mobile 390px checks: passed without horizontal overflow or console errors; all table controls stayed visible on mobile.

Review:

- Targeted deletion remains inside `packages/editor`; Workbench, platform, and file services remain unaware of Markdown table syntax.
- The plain Markdown table remains the source of truth; preview controls dispatch CodeMirror text edits only.
- UI controls feed explicit indexes into tested pure transforms instead of duplicating table rewrite logic.
- Visual additions reuse existing theme tokens and table button dimensions, with no new hard-coded platform assumptions.

Known limitations:

- Direct table cell editing remains planned.
- Row insertion and column insertion are still quick toolbar actions rather than targeted per-row/per-column insert controls.
- More complex Markdown table cases still depend on the planned parser-backed source mapping pass.

## 2026-06-06 - P2 Targeted Table Insertion Controls

Completed:

- Added per-column insert controls to inactive table preview headers.
- Added per-row insert controls to inactive table preview body rows.
- Added a pure `createMarkdownTableWithInsertedBodyRow` transform that mirrors the existing column insertion helper.
- Reused explicit row and column insertion indexes so UI controls only choose targets and do not own Markdown rewrite logic.
- Kept the existing toolbar actions for quick append-row and append-column workflows.
- Added focused tests for appending a body row and inserting a body row at a requested index.

Quality gate:

- `npm run test -- --run packages/editor/src/livePreview.test.ts`: passed, 62 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 82 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: `Insert row below row 2` inserted a blank row between Beta and Gamma; `Insert column after column 2` inserted a blank column between Count and Status.
- Desktop default viewport and mobile 390px checks: passed without page horizontal overflow or console errors; wide tables remained internally scrollable.

Review:

- Targeted insertion remains inside `packages/editor`; Workbench, platform, and file services remain unaware of Markdown table syntax.
- The plain Markdown table remains the source of truth; preview controls dispatch CodeMirror text edits only.
- Row and column insertion now share the same pure-transform pattern as deletion and alignment.
- Visual additions reuse existing inline table control styling and theme tokens instead of adding a new visual system.

Known limitations:

- Direct table cell editing remains planned.
- Wide tables expose later column controls through the internal table scroll area rather than fitting every column on narrow screens.
- More complex Markdown table cases still depend on the planned parser-backed source mapping pass.

## 2026-06-06 - P2 Table Cell Source Navigation

Completed:

- Added source-range mapping for Markdown table cells, including tables without outer pipes and escaped `\|` content.
- Added inactive-preview cell clicks that focus the editor and select the corresponding source cell text.
- Kept preview button interactions separate from cell navigation so row/column tools remain guarded controls.
- Added focused tests for cell source range detection and escaped-pipe behavior.

Quality gate:

- `npm run verify`: passed, 86 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: clicking `Ready` selected the source `Ready`; clicking `Name | Alias` selected source `Name \| Alias`; inline table buttons did not trigger cell selection.
- Desktop default viewport and mobile 390px checks: passed without page horizontal overflow or console errors.

Review:

- Cell source navigation remains inside `packages/editor`; Workbench, platform, and file services remain unaware of table syntax.
- The Markdown text model remains the source of truth; preview cells only dispatch editor selections.
- Source-range detection reuses the table cell scanner instead of adding a parallel parser or hard-coded string split path.
- Visual additions reuse existing theme tokens and table preview styling.

Known limitations:

- Cell clicks select source text rather than editing inline inside the preview.
- More complex Markdown table cases beyond escaped pipes and inline code spans still depend on parser-backed position mapping.

## 2026-06-06 - P2 Inline-Code-Aware Table Parsing

Completed:

- Made the shared Markdown table cell scanner ignore `|` separators inside inline code spans.
- Reused the same range membership helper for inline math and table parsing to avoid duplicate boundary checks.
- Preserved inline code cells containing pipes through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for inline-code-aware table detection, non-table code-span pipes, source ranges, and column edits.

Quality gate:

- `npm run test -- --run packages/editor/src/livePreview.test.ts`: passed, 70 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 90 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: inline code cells such as `` `left | right` `` remained one table cell, source navigation selected the full code span, and column insertion preserved source text.
- Desktop default viewport and mobile 390px checks: passed without page horizontal overflow or console errors.

Review:

- Table parsing remains isolated in `packages/editor`; no Workbench, platform, or Electron dependency was added.
- The single scanner still feeds preview rendering, source navigation, and pure table transforms, keeping behavior consistent.
- The Markdown source model remains unchanged; parsing improvements only affect editor decorations and transform helpers.
- No new visual tokens, platform paths, or hard-coded behavior constants were introduced.

Known limitations:

- The scanner handles escaped pipes and inline code spans, but a full Markdown parser-backed mapping is still planned for deeper inline syntax cases.

## 2026-06-06 - P2 Inline Math Source Navigation

Completed:

- Added source-focused click editing for inactive inline math previews.
- Inline math preview clicks now focus the editor and select only the TeX expression inside `$...$`, preserving the delimiters.
- Kept widget identity tied to source ranges so repeated formulas with the same expression keep distinct edit targets.
- Added a focused test for repeated inline math source ranges.

Quality gate:

- `npm run test -- --run packages/editor/src/livePreview.test.ts`: passed, 71 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 91 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: clicking rendered `$x+y$` selected `x+y`; clicking rendered `$a^2+b^2=c^2$` selected `a^2+b^2=c^2`.
- Desktop default viewport and mobile 390px checks: passed without page horizontal overflow or console errors.

Review:

- Inline math navigation remains inside `packages/editor`; Workbench, platform, and Electron boundaries did not change.
- The Markdown source model remains unchanged; preview clicks dispatch editor selections only.
- The interaction follows the same lightweight source navigation pattern as table cell previews.
- Visual behavior reuses the existing inline math preview style with a text cursor affordance; no new token family was needed.

Known limitations:

- Inline math parsing remains scanner-based pending parser-backed position mapping.

## 2026-06-06 - P2 Display Math Source Navigation

Completed:

- Added a pure source-range helper for display math blocks.
- Added source-focused click editing for inactive display math preview bodies.
- Display math body clicks now focus the editor and select only the TeX content inside `$$` fences.
- Kept the existing Copy TeX button path isolated so copy actions do not trigger source selection.
- Added focused tests for single-line, multiline, empty, and non-math source-range behavior.

Quality gate:

- `npm run test -- --run packages/editor/src/livePreview.test.ts`: passed, 75 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 95 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Production browser preview: passed at `http://127.0.0.1:4173`
- Browser interaction check: clicking the display math body selected the multiline TeX source inside `$$`; clicking `Copy TeX` did not select source text.
- Desktop default viewport and mobile 390px checks: passed without page horizontal overflow or console errors.

Review:

- Display math navigation remains inside `packages/editor`; Workbench, platform, and Electron boundaries did not change.
- Source range calculation is pure and testable, keeping widget code focused on mapping ranges into CodeMirror selections.
- The Markdown source model remains unchanged; preview clicks only dispatch editor selections.
- Visual behavior reuses the existing math preview body with a text cursor affordance; no new token family or hard-coded platform behavior was introduced.

Known limitations:

- Display math source ranges are scanner-based and select content lines as written; parser-backed math position mapping remains planned for deeper syntax-aware editing.

## 2026-06-06 - P2 Workspace Index Metadata

Completed:

- Extended `IIndexService` with `getMetadata()` for indexed headings, tags, and links.
- Added indexed resource metadata carrying URI, note name, relative path, and line number.
- Collected Markdown headings, `#tags`, Markdown links, and wiki links while skipping fenced code and inline code spans.
- Kept Workbench search behavior unchanged; metadata is exposed through the service boundary for future backlinks, tags, and persisted indexing.
- Added platform tests for metadata extraction and metadata clearing.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 16 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 97 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser search regression: current-note search for `topic` returned line 3 with `Alpha searchable topic`.
- Browser layout check: search panel had no page horizontal overflow and no console errors.

Review:

- Metadata extraction remains in `packages/platform` behind `IIndexService`; Workbench does not parse Markdown metadata directly.
- The existing in-memory index provider now has a shape that can be replaced by a SQLite-backed provider without UI contract churn.
- Parsing is intentionally lightweight and skips code contexts to avoid obvious false positives.
- No file-system assumptions, new hard-coded paths, or extra documentation files were introduced.

Known limitations:

- Metadata is still in-memory; SQLite persistence remains planned.
- Link and tag extraction is scanner-based and should be replaced or backed by a fuller Markdown parser for more complex inline syntax.

## 2026-06-06 - P2 Workspace Backlink Queries

Completed:

- Extended `IIndexService` with `getBacklinks(uri)` for querying indexed inbound note links.
- Resolved Markdown links against source note paths, including sibling paths, workspace-root paths, optional `.md` targets, fragments, queries, and URL-decoded paths.
- Resolved wiki links against note names and workspace-relative paths.
- Excluded self-links and external/protocol links from backlink results.
- Added platform tests for Markdown backlinks, wiki backlinks, missing targets, and clear-state behavior.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 17 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 98 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser search regression: current-note search for `topic` returned line 3 with `Alpha searchable topic`.
- Browser layout check: search panel had no page horizontal overflow and no console errors.

Review:

- Backlink resolution remains in `packages/platform` behind `IIndexService`; Workbench still consumes indexed data through service contracts instead of parsing Markdown links.
- The query returns stable sorted link records, keeping future backlinks UI work independent from the in-memory provider implementation.
- The implementation reuses indexed metadata and does not introduce new filesystem access paths or hard-coded workspace paths.
- SQLite persistence can replace the current provider without changing the `IIndexService` call shape.

Known limitations:

- Backlinks are still computed from the in-memory index; SQLite persistence remains planned.
- Wiki-link disambiguation is name/path based and does not yet model duplicate-note resolution policies.
- Link resolution remains scanner-based until a fuller Markdown parser-backed metadata pass is introduced.

## 2026-06-06 - P2 Backlinks Sidebar

Completed:

- Added a Backlinks activity bar entry and sidebar view for the active note.
- Wired the view to `IIndexService.getBacklinks(model.uri)` instead of parsing Markdown in Workbench.
- Rendered inbound link rows with source line, source relative path, and link label.
- Added backlink row navigation that opens the source note and scrolls to the indexed line.
- Kept the empty state compact and reused existing result-list styling.

Quality gate:

- `npm run verify`: passed, 98 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser Backlinks regression: activity entry rendered, sidebar title switched to `Backlinks`, empty state rendered, and no console errors occurred.
- Browser search regression: current-note search for `topic` returned line 3 with `Alpha searchable topic`.
- Browser layout check: desktop preview and 390px mobile viewport had no page horizontal overflow.

Review:

- Workbench consumes the backlink service contract only; link resolution remains in `packages/platform`.
- The new view follows the existing activity bar/sidebar pattern instead of introducing a separate panel framework.
- Visual behavior reuses existing list and status styles with one small empty-row style.
- No new hard-coded file paths, workspace assumptions, or extra documentation files were introduced.

Known limitations:

- Browser verification covers the no-workspace fallback; full inbound-link navigation still depends on native workspace fixture coverage or future Workbench component tests.
- Backlinks are based on the current in-memory index, so saved-file updates still rely on workspace refresh/watch until SQLite persistence and incremental indexing land.

## 2026-06-06 - P2 Workspace Tag Queries

Completed:

- Extended `IIndexService` with `getTags()` for indexed tag summaries.
- Added `getTaggedResources(tag)` for case-insensitive exact tag lookups.
- Preserved first-seen tag casing in summaries while sorting summaries by normalized tag text.
- Sorted tagged resources by source relative path and line number for stable future UI navigation.
- Added platform tests for tag summaries, tagged resource lookup, inline-code exclusion, missing tags, and clear-state behavior.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 18 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 99 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser verification: not required for this stage because no Workbench or UI behavior changed.

Review:

- Tag aggregation remains in `packages/platform` behind `IIndexService`; future tag UI should not process raw metadata arrays directly.
- The service contract keeps casing, normalization, grouping, and ordering rules in one provider-owned place.
- The implementation reuses indexed metadata and introduces no new filesystem access paths or hard-coded workspace paths.
- SQLite persistence can implement the same tag query contract without Workbench API churn.

Known limitations:

- Tag queries are still backed by the in-memory index.
- Tag extraction remains scanner-based and should be parser-backed for more complex Markdown syntax.

## 2026-06-06 - P2 Tags Sidebar

Completed:

- Added a Tags activity bar entry and sidebar view.
- Wired tag summaries to `IIndexService.getTags()` and selected-tag resources to `IIndexService.getTaggedResources(tag)`.
- Added automatic selected-tag stabilization when the index updates or the workspace changes.
- Added tagged resource navigation that opens the source note and scrolls to the indexed line.
- Added compact tag-row styling with count badges while reusing the existing result-list surface for matching notes.

Quality gate:

- `npm run verify`: passed, 99 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser Tags regression: activity entry rendered, sidebar title switched to `Tags`, empty state rendered, and no console errors occurred.
- Browser search regression: current-note search for `topic` returned line 3 with `Alpha searchable topic`.
- Browser layout check: desktop preview and 390px mobile viewport had no page horizontal overflow.

Review:

- Workbench consumes tag service queries and does not group, normalize, or sort raw metadata itself.
- The new view follows the existing activity bar/sidebar pattern, keeping navigation surfaces consistent.
- Tag selection state is local UI state; indexing, normalization, and resource lookup remain provider-owned.
- Visual additions use existing theme tokens and fixed row dimensions; no hard-coded workspace paths or platform assumptions were introduced.

Known limitations:

- Browser verification covers the no-workspace fallback; full tagged-resource navigation still depends on native workspace fixture coverage or future Workbench component tests.
- Tags are based on the current in-memory index, so saved-file updates still rely on workspace refresh/watch until SQLite persistence and incremental indexing land.

## 2026-06-06 - P2 Saved File Index Refresh

Completed:

- Added `IIndexService.indexFile(file, value?)` for single-file index refresh.
- Updated saved workspace file records without forcing a full workspace reindex.
- Refreshed the index after auto-save, manual save, save-as, and conflict overwrite success paths.
- Added platform coverage proving saved content updates search results, tags, and backlinks.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 19 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 100 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser search regression: current-note search for `Project` returned line 1 with `# Project note`; the earlier `topic` query had no match because the current browser fallback note did not contain that text.
- Browser layout and save-button checks: no page horizontal overflow and no console errors.

Review:

- Incremental refresh stays behind the platform index service; Workbench does not parse Markdown metadata.
- Workbench only locates the saved file in the current workspace tree and passes the saved model content.
- Search, tag, and backlink data now update immediately after a successful save instead of relying only on watcher or refresh timing.

Known limitations:

- The index remains in memory; SQLite-backed incremental persistence is still planned.

## 2026-06-06 - P2 Save-As Index Catch-Up

Completed:

- Moved saved-file index synchronization into a focused Workbench helper.
- Kept normal saves fast by indexing from the current workspace tree without refreshing.
- Added a workspace refresh-and-retry path when a saved file is not present in the current file tree yet.
- Added Workbench tests for existing-file indexing and new save-as file catch-up.

Quality gate:

- `npm run test -- --run packages/workbench/src/savedFileIndexing.test.ts`: passed, 2 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 102 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Browser regression: current-note search for `Project` returned line 1 with `# Project note`; save button check had no console errors or page horizontal overflow.

Review:

- The helper coordinates file-tree freshness only; Markdown extraction still stays behind `IIndexService`.
- Save-as catch-up uses the existing `IFileService.refreshWorkspace()` boundary rather than renderer path inspection or hard-coded workspace path rules.
- The refreshed workspace tree is pushed back through `IWorkspaceService`, keeping the file explorer and index source aligned.

Known limitations:

- Save-as files outside the active workspace are intentionally not indexed into the active workspace.
- The index remains in memory; SQLite-backed incremental persistence is still planned.

## 2026-06-06 - P2 Workspace Index Provider Boundary

Completed:

- Added `WorkspaceIndexProvider` as the storage/query boundary behind `IIndexService`.
- Added `InMemoryWorkspaceIndexProvider` as the current provider implementation.
- Refactored `WorkspaceIndexService` to orchestrate scanning, generation, and status while delegating search, metadata, tags, and backlinks to the provider.
- Added a platform test proving `WorkspaceIndexService` can delegate storage and query work through a custom provider.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 20 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 103 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: current-note search for `Project` returned line 1 with `# Project note`; no console errors or page horizontal overflow.

Review:

- The Workbench-facing `IIndexService` contract stayed stable.
- Query and storage behavior are no longer hidden inside `WorkspaceIndexService`, which reduces the blast radius for a future SQLite provider.
- Platform still owns Markdown metadata extraction and link/tag/backlink semantics; Workbench did not gain Markdown parsing or filesystem assumptions.

Known limitations:

- The default provider is still in memory; this stage prepares the replacement boundary but does not add persisted SQLite storage yet.
- Full-text ranking remains the current lightweight line scoring model.

## 2026-06-06 - P2 Keybinding Service Boundary

Completed:

- Added `IKeybindingService` and `KeybindingService` for keybinding registration, resolution, labels, and command dispatch.
- Registered Workbench defaults for command palette, quick open, save, and save-as through the keybinding service.
- Replaced Workbench's hard-coded global shortcut checks with service-based dispatch through `ICommandService`.
- Added shortcut labels in the command palette so keyboard affordances are visible.
- Added platform tests for primary modifier resolution, rule precedence, disposal, and label formatting.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 23 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 106 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Browser regression: `Ctrl+Shift+P` opened Command Palette, `Ctrl+P` opened Quick Open, shortcut labels rendered, and no console errors or page horizontal overflow occurred.

Review:

- Keyboard behavior is now a platform service instead of UI-local conditional logic.
- Workbench still owns its default shortcut contributions, keeping platform command/keybinding services generic.
- Command execution continues through `ICommandService`, matching the existing service-bound architecture and leaving room for future user-editable keybindings.

Known limitations:

- Keybindings are registered as Workbench defaults only; user-customizable keybinding persistence is not implemented yet.
- Shortcut conflict handling uses deterministic rule weight/order, but there is no user-facing conflict editor yet.

## 2026-06-06 - P2 Persisted Configuration Service

Completed:

- Added a configuration storage boundary to `ConfigurationService`.
- Persisted appearance, editor, and workspace preferences through the configuration service.
- Restored stored configuration on service startup while merging against centralized defaults.
- Added validation so invalid stored values do not replace known-good defaults.
- Added platform tests for persisted updates, reload restoration, and invalid stored configuration handling.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 25 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 108 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Browser regression: toggling theme through the command palette changed `data-theme` from `dark` to `light`, reload preserved `light`, and no console errors or page horizontal overflow occurred.

Review:

- Workbench still updates preferences only through `IConfigurationService`; it does not touch browser storage.
- Configuration defaults remain centralized, and persisted data is merged over defaults rather than replacing the full schema blindly.
- Invalid persisted values are ignored at the field level, keeping future schema changes safer.

Known limitations:

- Configuration storage is browser-local for now; native app-level settings storage is still planned.
- There is no dedicated settings UI yet; preferences are currently changed by existing commands and defaults.

## 2026-06-06 - P2 Native Configuration Storage Bridge

Completed:

- Added Electron main-process configuration storage backed by a file under the app data directory.
- Exposed a narrow preload configuration bridge for reading and writing configuration values.
- Updated `ConfigurationService` to prefer the native configuration bridge when available and keep browser storage as fallback.
- Added shell configuration for the native configuration storage file and maximum value size.
- Added platform coverage proving default configuration storage uses the native bridge when present.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 26 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 109 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Browser fallback regression: toggling theme through the command palette changed `data-theme` from `light` to `dark`, reload preserved `dark`, and no console errors or page horizontal overflow occurred.

Review:

- Renderer code still consumes `IConfigurationService`; it does not choose storage backends directly.
- Native storage is owned by the Electron main process and exposed through a narrow preload API.
- Stored values remain validated by the platform configuration service before they affect application behavior.

Known limitations:

- The native bridge is build-verified but not yet covered by an automated Electron runtime test.
- There is still no dedicated settings UI; preferences are changed through existing commands and defaults.

## 2026-06-06 - P2 Settings Preferences Dialog

Completed:

- Added a dedicated Workbench settings dialog for appearance, editor, and workspace preferences.
- Added an activity bar Settings entry, `workbench.settings.open` command, and `Ctrl+,` keybinding.
- Wired all setting changes through `IConfigurationService` partial updates.
- Added compact density styling so the existing density preference has visible UI effect.
- Added a settings model for numeric UI bounds, search file-size conversion, and asset folder normalization.
- Added focused Workbench tests for settings model behavior.

Quality gate:

- `npm run test -- --run packages/workbench/src/settingsModel.test.ts`: passed, 3 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 112 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: Settings opened from the activity bar, theme/density/auto-save changes applied, reload preserved persisted values, and no console errors or horizontal overflow occurred.
- Mobile 390px viewport check: Settings dialog collapsed to single-column fields without horizontal overflow.

Review:

- Workbench still does not access configuration storage directly; settings updates stay behind `IConfigurationService`.
- The settings dialog is split into its own component, keeping `Application.tsx` focused on shell assembly and command registration.
- Numeric limits and path input normalization are centralized in `settingsModel.ts`, avoiding scattered UI constants.
- The dialog reuses existing modal/button styling and theme tokens; no new platform assumptions or extra documentation files were introduced.

Known limitations:

- The browser automation environment could not exercise text entry into the numeric spinbutton because its fill/type helper requires a virtual clipboard. The control rendered correctly and non-text setting paths were verified interactively.

## 2026-06-06 - P2 Editable Keybinding Overrides

Completed:

- Added user keybinding overrides to persisted, validated configuration.
- Split keybinding resolution into default Workbench contributions and higher-priority user rules.
- Added keybinding event capture helpers and duplicate override replacement behavior.
- Added a Keybindings section to Settings with command labels, current shortcuts, Record, and Reset actions.
- Synced configuration changes into `IKeybindingService` before Workbench rerenders shortcut labels.
- Added platform tests for persisted keybinding overrides, runtime validation, user-rule priority, replacement, and event conversion.
- Added Workbench tests for override insertion, duplicate shortcut movement, reset behavior, and recordable shortcut constraints.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 33 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 119 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: recorded `Quick Open` as `Ctrl+Alt+O`, verified it opened Quick Open, reload preserved the override, Reset restored `Ctrl+P`, and no console errors or horizontal overflow occurred.
- Mobile 390px viewport check: keybinding rows collapsed to two-column layout without horizontal overflow.

Review:

- Default keybindings remain Workbench contributions; user overrides are configuration-backed and applied as higher-priority rules rather than mutating defaults.
- Workbench still executes keyboard shortcuts through `ICommandService`; Settings only edits persisted preference data.
- Override list updates are centralized in `keybindingSettings.ts`, avoiding scattered duplicate-removal logic.
- The browser verification reset the temporary shortcut after testing, so no local test override was left behind.

Known limitations:

- The keybinding editor records single-stroke shortcuts only; multi-step chord shortcuts remain future work.

## 2026-06-06 - P2 Keybinding Conflict Confirmation

Completed:

- Added `IKeybindingService` queries for active command ownership and arbitrary keybinding label formatting.
- Changed shortcut labels to report only bindings that are currently effective for a command, so shadowed defaults render as unassigned.
- Added inline conflict confirmation in Settings when a recorded shortcut is already active for another command.
- Added Replace and Cancel actions for keybinding conflicts before any override is persisted.
- Kept override writes behind `IConfigurationService`; Settings still does not mutate keybinding service state directly.
- Added platform coverage for active binding ownership, arbitrary label formatting, and shadowed default labels.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 34 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 120 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: recording Settings as `Ctrl+P` showed `Ctrl+P is used by Quick Open`, Cancel left both shortcuts unchanged, Replace assigned Settings and rendered Quick Open as Unassigned, Reset restored Settings to `Ctrl+,` and Quick Open to `Ctrl+P`.
- Mobile 390px viewport check: keybinding rows had no horizontal overflow and no console errors were reported.

Review:

- Conflict detection is service-backed, not string-label based, so it follows the same priority rules used for actual dispatch.
- Command Palette and Settings now consume active shortcut labels, preventing UI from advertising shortcuts that will not dispatch to that command.
- The conflict confirmation remains inline within Settings and reuses existing compact controls.
- The browser verification reset the temporary `Ctrl+P` Settings override before finishing.

Known limitations:

- The keybinding editor still records single-stroke shortcuts only; multi-step chord shortcuts remain future work.

## 2026-06-06 - P2 Keybinding Settings Search

Completed:

- Added a searchable Keybindings section in Settings.
- Filtered keybinding commands by command title, category, and command id.
- Added a clear action and compact empty state for unmatched searches.
- Kept filtering logic in `keybindingSettings.ts` instead of embedding search rules in `SettingsDialog`.
- Added focused Workbench tests for keybinding command filtering.

Quality gate:

- `npm run test -- --run packages/workbench/src/keybindingSettings.test.ts`: passed, 5 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 121 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: searching `quick` reduced the list to Quick Open, clearing restored all 16 command rows, searching `ZZZ` showed the empty state, and no console errors occurred.
- Mobile 390px viewport check: keybinding search and empty state had no horizontal overflow.

Review:

- Search rules use the same command data already supplied by `ICommandService`; no duplicated command registry was introduced.
- Settings keeps local query state only and does not write search data into persistent configuration.
- Filtering, override updates, and recordable shortcut constraints remain centralized in the Workbench keybinding settings model.
- The added controls reuse existing compact settings styling and theme tokens.

Known limitations:

- The keybinding editor still records single-stroke shortcuts only; multi-step chord shortcuts remain future work.
- Search is simple substring matching; fuzzy ranking can be added later if the command surface grows substantially.

## 2026-06-06 - P2 Modified Keybinding Filter

Completed:

- Added a modified-only filter to the Settings Keybindings section.
- Added a Reset All action that clears persisted user keybinding overrides through configuration updates.
- Extended the centralized keybinding filtering model so search and modified-only filtering compose without duplicating command logic in the dialog.
- Added focused Workbench coverage for filtering commands to modified overrides.
- Added compact toolbar styling that holds the modified filter and reset action without changing the existing row layout.

Quality gate:

- `npm run test -- --run packages/workbench/src/keybindingSettings.test.ts`: passed, 6 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 122 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: recorded `New Note` as `Ctrl+Alt+N`, verified Modified showed only that row, Reset All cleared the override, the empty state changed to `No modified shortcuts`, and the default `Unassigned` label was restored.
- Desktop 1280px and mobile 390px viewport checks: keybinding toolbar, search, rows, and empty state had no horizontal overflow and no console errors were reported.

Review:

- Filtering remains in `keybindingSettings.ts`; `SettingsDialog` only coordinates UI state and configuration updates.
- Reset All clears the override list through `IConfigurationService`, preserving the service-backed split between user preferences and keybinding dispatch.
- The temporary browser-test shortcut was reset before finishing, so no local keybinding override was left behind.
- The toolbar uses existing compact settings controls and stable grid sizing; no new hard-coded workspace paths or platform assumptions were introduced.

Known limitations:

- The keybinding editor still records single-stroke shortcuts only; multi-step chord shortcuts remain future work.
- Modified filtering is exact to persisted override commands; richer auditing such as showing shadowed defaults can be added later if the keybinding surface expands.

## 2026-06-06 - P2 Settings Section Navigation

Completed:

- Added section navigation to the Settings dialog for Appearance, Editor, Workspace, and Keybindings.
- Moved settings section metadata and stable anchors into `settingsModel.ts` so navigation and content use the same model.
- Added scroll-to-section behavior and active-section synchronization when the settings content is scrolled manually.
- Updated desktop layout to use a compact navigation rail and mobile layout to use a two-column section switcher without hidden horizontal scrolling.
- Added focused Workbench model coverage for stable section definitions and unique section anchors.

Quality gate:

- `npm run test -- --run packages/workbench/src/settingsModel.test.ts`: passed, 5 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 124 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: Settings rendered the section navigation, clicking Keybindings scrolled to the keybinding section, manual scroll synchronized the active navigation item, and no console errors were reported.
- Desktop 1280px and mobile 390px viewport checks: dialog, navigation, content, keybinding search, and toolbar had no horizontal overflow.

Review:

- Section names and anchor IDs are centralized in the settings model instead of duplicated between navigation and content.
- The dialog still writes preferences only through `IConfigurationService`; the new navigation is local UI state and does not touch persistence.
- The layout keeps settings as one dialog contribution while making future sections easier to add without a long unstructured surface.
- Mobile navigation keeps all four sections visible at once, avoiding hidden horizontal scroll and preserving the simple settings experience.

Known limitations:

- Section navigation is limited to the current top-level settings sections; nested settings groups can be introduced later if the settings surface grows.

## 2026-06-06 - P2 Settings Search

Completed:

- Added a Settings-level search box above the section navigation.
- Added searchable settings entry metadata in `settingsModel.ts` so section navigation and field filtering share one model.
- Filtered Settings sections and individual controls for queries such as `font`, `workspace`, `shortcut`, and multi-term search like `search limit`.
- Added a compact empty state for unmatched settings queries and a clear action that restores the full settings surface.
- Added focused Workbench model coverage for empty, section-level, field-level, multi-term, and no-result settings search behavior.

Quality gate:

- `npm run test -- --run packages/workbench/src/settingsModel.test.ts`: passed, 8 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 127 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: `font` showed only Editor / Font Size, `workspace` showed the whole Workspace section, `shortcut` showed Keybindings, no-match showed `No matching settings`, and clear restored all sections.
- Desktop 1280px and mobile 390px viewport checks: dialog, settings search, navigation, content, keybinding search, and toolbar had no horizontal overflow and no console errors were reported.

Review:

- Search metadata is centralized in `settingsModel.ts`; `SettingsDialog` consumes visible section and entry IDs instead of embedding matching rules in JSX.
- Settings search is local UI state and does not touch persisted configuration.
- Section-title matches intentionally show a full section, while field matches narrow to individual controls, keeping the surface compact without hiding expected section context.
- The top-level settings search remains separate from the Keybindings command search, preserving focused command filtering inside the Keybindings section.

Known limitations:

- Settings search uses deterministic substring and multi-term matching; fuzzy ranking can be added later if the settings surface grows substantially.

## 2026-06-06 - P2 Keybinding Shortcut Label Search

Completed:

- Extended Keybindings search to include the active shortcut label shown in each row.
- Added `Unassigned` as a searchable row state for commands without an active shortcut.
- Normalized shortcut labels so both `ctrl+p` and `ctrl shift p` style queries can match displayed shortcuts.
- Kept the expanded matching logic in `keybindingSettings.ts` and passed active labels from `SettingsDialog`.
- Added focused Workbench coverage for shortcut-label, expanded-label, unassigned, and multi-term matching.

Quality gate:

- `npm run test -- --run packages/workbench/src/keybindingSettings.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 128 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: `ctrl shift p` found Command Palette, `ctrl+p` found Quick Open, `unassigned` found unbound commands, `workbench ctrl` found matching Workbench shortcuts, and clear restored all 16 rows.
- Desktop 1280px and mobile 390px viewport checks: keybinding search, filtered rows, and Settings dialog had no horizontal overflow and no console errors were reported.

Review:

- Search still uses the same command data and active labels supplied by `IKeybindingService`; no duplicate shortcut registry was introduced.
- `SettingsDialog` remains a coordinator and does not own shortcut matching rules.
- The shortcut search understands the label the user sees, which keeps the settings experience discoverable without adding more controls.

Known limitations:

- Keybinding search is deterministic term matching rather than fuzzy ranking.
- The keybinding editor still records single-stroke shortcuts only; multi-step chord shortcuts remain future work.

## 2026-06-06 - P2 Command Palette Shortcut Search

Completed:

- Added a focused command palette model for filtering command rows.
- Extended command palette search to include command title, category, command id, active shortcut labels, and expanded shortcut labels.
- Added an explicit `No matching commands` empty state when command palette search has no results.
- Removed the inline command filtering helper from `Application.tsx`.
- Added focused Workbench model coverage for command/category/id matching and shortcut-label matching.

Quality gate:

- `npm run test -- --run packages/workbench/src/commandPaletteModel.test.ts`: passed, 3 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 131 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: `ctrl shift p` found Command Palette, `ctrl+p` found Quick Open, `workbench ctrl` found matching Workbench shortcuts, and `zzzz` showed `No matching commands`.
- Desktop 1280px and mobile 390px viewport checks: command palette input, list, rows, and empty state had no horizontal overflow and no console errors were reported.

Review:

- Command palette filtering now lives in `commandPaletteModel.ts`, keeping `Application.tsx` focused on shell composition.
- The model consumes active labels supplied by `IKeybindingService`; it does not maintain a duplicate shortcut registry.
- The empty state keeps the palette informative without adding extra controls or persistent state.

Known limitations:

- Command palette search remains deterministic term matching rather than fuzzy ranking.

## 2026-06-06 - P2 Palette List Keyboard Navigation

Completed:

- Added a shared Workbench list navigation model for active-row normalization and Arrow/Home/End movement.
- Added Command Palette active-row state, visual selection, mouse hover synchronization, query-reset behavior, and Enter execution for the active command.
- Added Quick Open active-row state, visual selection, mouse hover synchronization, query-reset behavior, and Enter opening for the active file when files are present.
- Reused theme tokens for the active row treatment instead of introducing new color constants.
- Added focused Workbench coverage for supported navigation keys, bounds normalization, and bounded movement.

Quality gate:

- `npm run test -- --run packages/workbench/src/listNavigationModel.test.ts packages/workbench/src/commandPaletteModel.test.ts`: passed, 6 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 134 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: Command Palette opened with `Ctrl+Shift+P`, focused the input, selected the first row, moved selection with ArrowDown/Home/End, reset selection after searching `ctrl`, and Enter on the selected Quick Open command opened Quick Open.
- Quick Open browser regression: in the current browser preview without a mounted workspace file list, ArrowDown/Home/End/input/Enter on the empty list stayed stable and produced no console errors.
- Desktop 1280px and mobile 390px viewport checks: Command Palette and Quick Open fit within the viewport, had no horizontal overflow, and reported no console errors.

Review:

- Navigation rules are centralized in `listNavigationModel.ts`; `Application.tsx` only wires component state to commands and files.
- Command Palette and Quick Open now follow the same bounded selection semantics, which keeps future palette-like surfaces extensible.
- Query changes reset selection to the first visible result, preserving predictable keyboard flow.
- The active-row styling uses existing surface and accent tokens, so theme work remains centralized.

Known limitations:

- Quick Open non-empty file-row navigation still needs a browser regression with a mounted native workspace fixture.

## 2026-06-06 - P2 Configurable Auto Save Delay

Completed:

- Added `editor.autoSaveDelayMs` to the persisted configuration model with a centralized default.
- Removed the Workbench-level fixed auto-save delay and wired the save timer to configuration state.
- Added an Auto Save Delay numeric setting with Settings search metadata and bounded UI constraints.
- Added platform coverage for persisting and rejecting invalid auto-save delay values.
- Added Workbench settings model coverage for delay search and numeric bounds.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/settingsModel.test.ts`: passed, 38 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 134 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: Settings search for `save delay` showed only Auto Save Delay, changing 800 ms to 1250 ms updated the UI, reload preserved 1250 ms, and the value was restored to 800 ms afterward.
- Desktop 1280px and mobile 390px viewport checks: the filtered Settings dialog fit within the viewport, had no horizontal overflow, and reported no console errors.

Review:

- Auto-save timing now belongs to `IConfigurationService`, matching the rule that behavior defaults should not sit in Workbench component constants.
- `SettingsDialog` stays a coordinator; labels, search metadata, and numeric constraints are still in `settingsModel.ts`.
- The timer effect includes the configured delay in its dependency list, so changing the setting reschedules pending auto-save work.
- No new platform paths, theme colors, or documentation files were introduced.

Known limitations:

- Configuration sanitization accepts any positive stored delay; the Settings UI clamps normal user edits to 250-5000 ms.

## 2026-06-06 - P2 Live Workspace Settings

Completed:

- Added a configuration entry point to `IIndexService` for workspace search file-size and result-count limits.
- Added a configuration entry point to `IAttachmentService` for the default pasted-image asset folder.
- Synchronized workspace preference changes from Workbench into the affected platform services through the configuration listener.
- Reindexed the active workspace when the search file-size limit changes, so previously skipped files can be included after a larger limit.
- Recomputed workspace search results when the result-count limit changes.
- Added platform coverage for updated index limits and updated attachment asset folders.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 32 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 136 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser regression: Settings changed Search Results from 120 to 140, reload preserved 140, and the value was restored to 120; Asset Folder changed from `assets` to `media-test`, reload preserved it, and it was restored to `assets`.
- Desktop 1280px and mobile 390px viewport checks: Workspace settings fields fit within the dialog, had no horizontal overflow, and the clean verification run produced no new console errors.

Review:

- Settings still writes only to `IConfigurationService`; Workbench translates configuration changes into service configuration calls.
- Indexing and attachment behavior remain behind platform services; Workbench does not inspect file paths or attachment destinations.
- Search-result limit changes affect queries without reindexing, while file-size limit changes reindex only the active workspace through the existing index service path.
- No new visual tokens, storage backends, or documentation files were introduced.

Known limitations:

- Browser verification covers Settings persistence and layout; native workspace reindex behavior is covered by platform tests rather than a mounted Electron workspace fixture.

## 2026-06-07 - P2 Centralized Configuration Bounds

Completed:

- Added platform-owned numeric constraints for editor font size, line height, editor width, auto-save delay, workspace search file size, and workspace search result count.
- Updated persisted configuration sanitization so out-of-range stored positive numeric values are clamped before consumers read them.
- Reused platform numeric constraints in the Workbench Settings model instead of duplicating local UI bounds.
- Centralized megabyte conversion constants for workspace search file-size display and storage conversion.
- Reused `defaultConfiguration.workspace` values for default workspace index service limits.
- Added platform coverage for clamping out-of-range stored numeric configuration values.

Quality gate:

- `npm run verify`: passed, 137 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser regression: Settings numeric fields clamped Font Size `999` to `24` and Search File Limit `100` to `20`, then restored and persisted the original values.
- Desktop 1280px and mobile 390px viewport checks: filtered Settings surfaces fit without horizontal overflow or new console errors.

Review:

- Numeric behavior defaults and bounds now live in `packages/platform/src/configuration.ts`, matching the rule that platform behavior should not be owned by Workbench JSX.
- Settings remains a presentation and coordination surface; it imports configuration constraints and delegates number clamping to the platform helper.
- Stored configuration, UI controls, and index service defaults now read from the same platform source for shared workspace limits.
- No new visual tokens, storage backends, hard-coded paths, or documentation files were introduced.

Known limitations:

- Numeric constraints are static platform metadata for now; a future extension or policy layer could expose contributed setting schemas if the settings system grows.

## 2026-06-07 - P2 Workspace Index Snapshot Persistence

Completed:

- Added a versioned workspace index snapshot format for indexed documents.
- Added `PersistedWorkspaceIndexProvider` with injected storage, snapshot size limits, and safe fallback when storage writes fail.
- Added provider batch hooks so full workspace scans persist once per batch instead of once per indexed file.
- Restored index service status to `ready` when a provider starts with restored documents.
- Tightened workspace indexing generation checks so canceled scans cannot write stale documents after a newer scan starts.
- Wired Workbench service creation to use a persisted snapshot provider when browser storage is available.
- Avoided clearing restored index snapshots during the initial no-workspace render path.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 35 tests
- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/savedFileIndexing.test.ts`: passed, 37 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 139 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173`: Workbench rendered, no horizontal overflow, and no console errors were reported.

Review:

- Query and storage behavior remain behind `WorkspaceIndexProvider`; Workbench still consumes only `IIndexService`.
- Snapshot persistence is explicitly a cache boundary, not a source-of-truth data model; Markdown files remain the source of truth.
- Storage keys and snapshot size limits are centralized in platform index options rather than embedded in Workbench UI.
- The cancellation fix reduces stale index risk during rapid workspace refreshes or reconfiguration-triggered reindexing.
- No new documentation files, visual tokens, or direct filesystem assumptions were introduced.

Known limitations:

- The snapshot cache is still browser/local storage backed in the renderer; the planned SQLite provider remains the durable desktop index backend.
- Opening a workspace still performs a normal scan that replaces the cached index; SQLite remains the planned durable desktop index backend.

## 2026-06-07 - P2 Workspace-Scoped Index Snapshots

Completed:

- Added snapshot scope support to `WorkspaceIndexProvider`.
- Derived persisted index snapshot storage keys from the workspace root URI.
- Updated `WorkspaceIndexService.indexWorkspace()` to set the provider scope before workspace scans.
- Included optional snapshot scope metadata in the versioned snapshot payload.
- Cleared in-memory provider state when switching to a scope with no stored snapshot, preventing stale results from a previous workspace.
- Added platform coverage proving two workspace roots persist and restore separate index snapshots.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 36 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 140 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only

Review:

- Workspace identity now belongs to the platform index provider boundary, not Workbench UI code.
- Storage key derivation is centralized in `packages/platform/src/indexing.ts`, avoiding hard-coded workspace paths or UI-owned cache keys.
- The snapshot cache remains a replaceable provider implementation detail; `IIndexService` consumers did not change.
- The change directly resolves the previous stage limitation where all snapshot data shared one global storage key.

Known limitations:

- Snapshot persistence is still a renderer-side cache; the planned SQLite provider remains the durable backend for larger workspaces and richer incremental indexing.

## 2026-06-07 - P2 Native Index Snapshot Storage

Completed:

- Added a dedicated Electron IPC bridge for workspace index snapshot storage.
- Stored native index snapshots as bounded app data files keyed by the platform-derived snapshot key.
- Added centralized shell configuration for the native snapshot directory and maximum snapshot size.
- Updated preload typings and bridge exposure so platform storage selection can detect native snapshot storage.
- Added `createDefaultWorkspaceIndexSnapshotStorage()` to prefer native storage and fall back to browser storage.
- Updated Workbench service creation to depend on the platform default storage resolver instead of browser-specific storage.
- Added platform coverage proving native index snapshot storage is selected when available.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/savedFileIndexing.test.ts`: passed, 39 tests
- `npm run typecheck`: passed
- `npm run build -w @typora-plus/desktop`: passed
- `npm run verify`: passed, 141 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173`: browser fallback started without an Electron index bridge, rendered the Workbench, had no horizontal overflow, and reported no console errors.

Review:

- Snapshot storage resolution remains in the platform layer; Workbench still only asks for the default index snapshot storage.
- Native snapshot paths and size limits are centralized in `desktopShellConfig`, not scattered through UI or platform consumers.
- The Electron bridge stays narrow: renderer code can only read/write validated snapshot keys through preload, not arbitrary files.
- Browser builds keep the same fallback behavior, so web preview verification remains valid.

Known limitations:

- Native snapshot files are still a cache of Markdown-derived index data; SQLite remains the planned backend for durable, query-optimized indexing at larger scale.

## 2026-06-07 - P2 HTML Export Service

Completed:

- Added `IExportService` with provider registration, exported document generation, native save routing, and browser download fallback.
- Added a Markdown HTML export provider using `marked` instead of a hand-rolled Markdown renderer.
- Added complete HTML document generation with safe title escaping, normalized output filenames, and a restrictive content security policy.
- Added an Electron export IPC bridge that writes exported files only through a user-selected save dialog with centralized size and format limits.
- Registered the HTML export provider in Workbench services.
- Added an `Export HTML` command, `Ctrl+Shift+E` default shortcut, and titlebar icon action.
- Added platform and Markdown coverage for export provider behavior, native save routing, provider disposal, HTML rendering, and filename normalization.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/markdown/src/exportHtml.test.ts packages/markdown/src/outline.test.ts`: passed, 44 tests
- `npm run typecheck`: passed
- `npm run build -w @typora-plus/desktop`: passed
- `npm run verify`: passed, 145 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173`: `Export HTML` was visible in the titlebar, Workbench rendered without horizontal overflow, and no console errors were reported.

Review:

- Export behavior now sits behind a platform service and provider contract, matching the VS Code-style contribution boundary.
- Markdown rendering remains in the Markdown package; Workbench only wires commands and UI entry points.
- Native file writes stay in Electron main process IPC and require a save dialog-selected destination.
- Export size and supported format metadata live in shell configuration rather than Workbench UI.
- The new dependency is limited to `@typora-plus/markdown`, where Markdown rendering belongs.

Known limitations:

- HTML is the first export provider; PDF and DOCX remain future providers on the same `IExportService` boundary.

## 2026-06-07 - P2 Hardened HTML Export Rendering

Completed:

- Replaced default HTML passthrough in the Markdown HTML export provider with a safe `marked` renderer.
- Escaped raw Markdown HTML before it enters exported documents.
- Dropped unsafe link targets such as script protocols while preserving visible link text.
- Dropped unsafe image sources while preserving visible image alt text.
- Added tests for raw HTML escaping, safe links, unsafe links, safe image sources, and unsafe image sources.

Quality gate:

- `npm run test -- --run packages/markdown/src/exportHtml.test.ts`: passed, 4 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 147 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only

Review:

- The hardening stays inside the Markdown export provider; platform export service and Workbench command wiring did not change.
- Markdown rendering still uses `marked`, but provider-owned renderer rules enforce the export security policy.
- Exported HTML keeps the restrictive content security policy added in the previous stage and now also avoids embedding raw user HTML.
- No new packages, UI surface, storage backend, or documentation file was introduced.

Known limitations:

- HTML export still preserves allowed relative image paths rather than embedding workspace images; richer asset handling remains future export-provider work.

## 2026-06-07 - P2 HTML Export Workspace Images

Completed:

- Added an export image source resolver context to `IExportService` provider input.
- Wired `ExportService` to inject the existing `IResourceService` resolver into export providers when available.
- Updated the Markdown HTML export provider to pre-collect safe relative image tokens and embed resolved workspace images as data URLs.
- Kept unsafe image targets dropped and unresolved local image sources on the previous safe fallback path.
- Added platform and Markdown tests for resolver injection, data URL embedding, deduplicated image resolution, remote image non-resolution, and failed-resource fallback.

Quality gate:

- `npm run test -- --run packages/markdown/src/exportHtml.test.ts`: passed, 6 tests
- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 40 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 150 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only

Review:

- Workbench still only triggers export; it does not parse Markdown, resolve image paths, or read local files.
- Local resource reads remain behind `IResourceService` and the existing Electron main-process path, extension, traversal, and size checks.
- The Markdown provider owns export rendering policy and caches resolved image sources per export, avoiding repeated reads for duplicate image references.
- Missing or unreadable images do not block exporting the note, preserving a smooth fallback path.
- No new documentation files, packages, UI surface, or hard-coded filesystem paths were introduced.

Known limitations:

- HTML export embeds images as data URLs, which is portable but not ideal for very large assets; a future export asset pipeline can add copied asset folders or streamed resource packaging behind the same provider boundary.
- Native dialog export behavior remains covered by build and IPC contract tests rather than automated desktop dialog interaction.

## 2026-06-07 - P2 Export Asset Pipeline

Completed:

- Added optional exported asset metadata to the platform export document contract.
- Added export asset mode context so providers can choose file assets when native saving is available and inline assets for browser fallback.
- Updated the Markdown HTML provider to rewrite resolved workspace images into sibling export asset references in file asset mode.
- Kept duplicate Markdown image references on a single exported asset path.
- Added native export asset writing with centralized maximum asset count and per-asset size limits in shell configuration.
- Added native asset path, MIME type, and base64 validation before writing assets beside the selected export document.
- Updated exported HTML CSP to allow same-directory/sibling image assets while keeping the restrictive default policy.
- Added Markdown and platform coverage for file asset mode, inline fallback mode, explicit asset mode overrides, duplicate image reuse, and non-base64 fallback behavior.

Quality gate:

- `npm run test -- --run packages/markdown/src/exportHtml.test.ts packages/platform/src/platform.test.ts`: passed, 50 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 154 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only

Review:

- Export asset behavior remains behind `IExportService`; Workbench still only triggers commands and does not parse Markdown or write files.
- Markdown export owns rendering and asset-reference generation; Electron owns bounded file and asset writes.
- Asset size/count limits live in `desktopShellConfig`, not in Workbench UI.
- Browser export remains usable because provider context defaults to inline mode when no native save bridge is available.
- No new documentation files, UI surface, packages, or direct filesystem assumptions were introduced.

Known limitations:

- Native save dialog interaction is still not covered by an automated desktop test; native asset writing is verified through type/build checks and contract-level tests.
- Export assets are written as sibling files, not zipped or streamed; a future provider can add archive packaging behind the same `IExportService` boundary.

## 2026-06-07 - P2 Workbench Menu Contributions

Completed:

- Added `IMenuService` and `MenuService` for menu/action contribution registration, stable ordering, change events, and disposable removal.
- Moved Workbench titlebar and activitybar action definitions into `workbenchContributions.ts`.
- Moved default Workbench keybinding contributions into the same contribution module.
- Updated Workbench service creation to register default menu and keybinding contributions through platform services.
- Updated `Titlebar` and `ActivityBar` to render menu items from `IMenuService` instead of fixed button lists.
- Kept icon rendering in Workbench with icon ids, so the platform menu service remains renderer-agnostic.
- Added platform coverage for menu registration, ordering, change events, and disposal.
- Added Workbench coverage for default menu contribution order, unique menu item ids, and default keybinding contribution uniqueness.

Quality gate:

- `npm run test -- --run packages/workbench/src/workbenchContributions.test.ts packages/platform/src/platform.test.ts`: passed, 48 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 160 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser desktop smoke check at `http://127.0.0.1:5173`: titlebar actions and activitybar actions rendered in the expected order, no horizontal overflow, and no console errors.
- Browser 390px viewport smoke check: compact titlebar actions were hidden as expected, activitybar actions rendered, no horizontal overflow, and no console errors.

Review:

- Command execution, keybinding dispatch, and menu rendering are now separate contribution points, matching the VS Code-style direction already used by export and index providers.
- Workbench React components still own visual rendering and icon mapping, while platform menu data remains serializable and UI-framework independent.
- The ordering regression found during browser smoke testing was fixed by encoding default contribution group order and by making tests assert the `MenuService` sorted output rather than raw array order.
- No new packages, storage paths, or documentation files were introduced.

Known limitations:

- Menu item visibility now supports Workbench-owned context keys; extension-owned context keys remain future extension-host work.
- Extension-contributed menus are still architectural direction only until `IExtensionService` is implemented.

## 2026-06-07 - P2 Menu Context Keys

Completed:

- Added `IContextKeyService` and `ContextKeyService` with structured context values, change events, and expression helpers for defined, equals, not-equals, not, and/or conditions.
- Added context expression key extraction so menu refreshes can be scoped to affected menus.
- Added optional `when` expressions to `MenuItem`.
- Updated `MenuService` to filter contributed items through context keys and publish menu change events when relevant context values change.
- Wired Workbench service creation to provide context keys to menu service.
- Synced Workbench state into context keys for file-system availability, attachment/resource availability, active resource scheme, side view, editor focus/typewriter mode, and workspace-open state.
- Added `when` clauses to hide native file actions when the file system bridge is unavailable and hide workspace-only backlinks/tags actions until a workspace is open.
- Added platform tests for context expression evaluation, context change publishing, menu filtering, and context-driven menu refresh.
- Added Workbench tests for native/full context ordering and browser-context hidden actions.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 53 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 165 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser desktop smoke check at `http://127.0.0.1:5173`: browser context hid native file entries and workspace-only actions, no horizontal overflow, and no console errors.
- Browser 390px viewport smoke check: filtered titlebar/activitybar actions fit, compact titlebar actions hid as expected, no horizontal overflow, and no console errors.

Review:

- Context evaluation stays in the platform layer; Workbench only contributes expressions and synchronizes state values.
- Menu visibility no longer requires ad hoc conditionals inside `Titlebar` or `ActivityBar`.
- Browser builds now avoid exposing no-op native file actions while keeping New Note, Export HTML, Search, Outline, Settings, and Command Palette available.
- The expression model is structured rather than a string parser, which keeps the first implementation testable and avoids hard-coded parsing rules.
- No new packages, storage paths, or documentation files were introduced.

Known limitations:

- Context keys are owned by built-in Workbench services for now; extension-owned context mutation waits for `IExtensionService`.
- Extension manifests can now target the platform string parser for menu `when` clauses, but extension-owned context mutation still waits for `IExtensionService`.

## 2026-06-07 - P2 Context Key When Parser

Completed:

- Added `parseContextKeyExpression()` to convert controlled manifest-style `when` strings into structured context key expressions.
- Supported bare truthy keys, `!`, `==`, `!=`, `&&`, `||`, parentheses, quoted strings, bare string values, booleans, numbers, and `null`.
- Kept parsing in the platform layer and avoided evaluating user-authored strings as JavaScript.
- Added parser tests for operator precedence, quoted and bare values, numeric values, empty expressions, and invalid syntax errors.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 51 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 168 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only

Review:

- The parser emits the same structured expression model already used by `IMenuService`, so menu filtering remains centralized and testable.
- The supported syntax is intentionally narrow and deterministic, matching future extension manifest needs without introducing dynamic code execution.
- Workbench did not change in this stage; no browser UI regression was required.
- No new packages, UI surface, storage path, or documentation file was introduced.

Known limitations:

- The parser intentionally does not support arbitrary operators or custom functions; any future manifest expansion should add explicit grammar cases with tests.
- Extension manifest loading and extension-owned context updates remain future `IExtensionService` work.

## 2026-06-07 - P2 Extension Manifest Registration

Completed:

- Added `IExtensionService` and `ExtensionService` for static extension manifest registration.
- Supported manifest contributions for commands, menus, and keybindings.
- Validated extension ids, contribution ids, command titles, menu fields, keybinding fields, primitive option types, and duplicate ids before registration.
- Parsed menu `when` strings through the existing structured context-key parser instead of executing user-authored strings.
- Registered all contributions through `ICommandService`, `IMenuService`, and `IKeybindingService` with one disposable that unregisters the whole extension.
- Kept manifest command contributions metadata-only with a clear no-handler error until an extension runtime exists.
- Moved Workbench default menu and keybinding contributions behind a built-in extension manifest while keeping real built-in command handlers in `Application.tsx`.
- Added platform and Workbench coverage for manifest registration, context-filtered menus, disposable unregister, duplicate ids, invalid manifest rollback, and built-in command-handler separation.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 62 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 174 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser desktop smoke check at `http://127.0.0.1:5173`: browser-context menu filtering remained correct, no horizontal overflow, and no console errors.
- Browser 390px viewport smoke check: menu actions rendered without horizontal overflow and no console errors.

Review:

- Extension registration is a platform boundary; Workbench consumes registered menus and keybindings without knowing whether they came from built-ins or future extensions.
- The implementation does not add dynamic code execution, `eval`, direct DOM access, or unrestricted Node access.
- Static manifest parsing stays deterministic and covered by tests; invalid manifests fail before partial state is exposed.
- Built-in Workbench command handlers remain outside the manifest, avoiding placeholder command handlers shadowing real commands.
- No new packages, storage paths, visual tokens, or extra documentation files were introduced.

Known limitations:

- There is no extension host, activation event handling, extension code execution, or extension-owned context mutation yet.
- Manifest commands are metadata placeholders only; runtime command handlers need a future out-of-process extension host and command activation flow.
- Themes, Markdown renderers, and export providers are still future manifest contribution points.

## 2026-06-07 - P2 Command Metadata Boundary

Completed:

- Split `ICommandService` command data into display metadata and executable handlers.
- Added `registerCommandMetadata()` so extension manifests can contribute command palette and Settings entries without registering placeholder execution functions.
- Kept `registerCommand()` compatible for built-in commands by automatically providing implicit command metadata when no explicit metadata exists.
- Allowed runtime handlers to attach to an existing command metadata id without overwriting its manifest-provided title/category.
- Updated `ExtensionService` so manifest command contributions register metadata only.
- Updated Settings keybinding models to depend on command metadata instead of executable command handlers.
- Added platform coverage for metadata-only commands, later handler registration, handler disposal, metadata disposal, and duplicate metadata/handler rejection.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/commandPaletteModel.test.ts packages/workbench/src/keybindingSettings.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 74 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 176 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser desktop smoke check at `http://127.0.0.1:5173`: command palette opened through `Ctrl+Shift+P`, 17 commands rendered from metadata, no horizontal overflow, and no console errors.
- Browser 390px viewport smoke check: no horizontal overflow and no console errors.

Review:

- Command contribution metadata is now separate from command execution, matching the VS Code-style split between manifest contributions and runtime handlers.
- Extension manifests no longer install executable placeholder command handlers, reducing the risk of shadowing a future runtime command handler.
- Workbench UI surfaces consume metadata-only command records, so command palette and Settings remain usable before extension activation exists.
- No dynamic code execution, new package, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- Metadata-only extension commands still cannot execute until an out-of-process extension host registers real handlers.
- Command activation events and extension-owned context mutation remain future extension runtime work.

## 2026-06-07 - P2 Extension Activation Events

Completed:

- Added manifest-level `activationEvents` support to `IExtensionService`.
- Derived `onCommand:<command>` activation events from manifest command contributions.
- Added an activation-event index that is removed with the extension disposable.
- Added `activateByEvent()` with inactive, activating, activated, and failed state tracking.
- Added an injected activation handler boundary so the platform can test activation flow without executing extension code.
- Preserved static contribution registration when activation fails, matching the separation between manifest contributions and runtime handlers.
- Added platform coverage for explicit activation events, command-derived activation events, duplicate event normalization, no-handler protection, unregister cleanup, and failed activation state.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 62 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 180 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not required for this stage because only platform extension service and platform tests changed.

Review:

- Activation events are now a platform registration and dispatch boundary, not extension code execution.
- The implementation follows the VS Code-style split between manifest-declared activation events and a later extension host that performs runtime activation.
- Command-contributed activation is derived from command metadata, so future command execution can trigger activation without duplicating manifest declarations.
- No dynamic code execution, new package, UI surface, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- There is still no out-of-process extension host, extension code execution, or runtime API surface.
- Command dispatch does not yet auto-activate metadata-only extension commands; it needs a future command activation bridge to call `activateByEvent("onCommand:<id>")` before retrying execution.
- Extension-owned context mutation remains future extension runtime work.

## 2026-06-07 - P2 Command Activation Bridge

Completed:

- Made `ICommandService.executeCommand()` asynchronous so command execution can wait for activation work before running handlers.
- Added an injected command activation handler to `CommandService`.
- Updated metadata-only command execution to trigger activation, retry handler lookup, and then fail with a no-handler error only when activation did not register a handler.
- Wired Workbench command activation to `IExtensionService.activateByEvent("onCommand:<command>")`.
- Updated `IKeybindingService.dispatch()` and Workbench command UI paths to handle asynchronous command execution without delaying keyboard default prevention.
- Added platform coverage for metadata-only command activation and extension command contribution activation before execution.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/commandPaletteModel.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 73 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 182 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser desktop smoke check at `http://127.0.0.1:5173`: command palette opened through `Ctrl+Shift+P`, 17 commands rendered, theme command executed, no status error, no horizontal overflow, and no console errors.
- Browser 390px viewport smoke check: no horizontal overflow and no console errors.

Review:

- Command activation is now a platform boundary; Workbench only wires services and does not know extension internals.
- Metadata-only extension commands can become executable after activation without placeholder handlers or command metadata replacement.
- Keyboard and UI command paths now share the same asynchronous execution helper, reducing drift between palette, menu, and shortcut behavior.
- The implementation still avoids dynamic code execution, direct DOM access by extensions, new packages, storage paths, visual tokens, and extra documentation files.

Known limitations:

- Activation still delegates to an injected handler; there is no out-of-process extension host, runtime API surface, or extension code loading yet.
- Extension-owned context mutation remains future extension runtime work.

## 2026-06-07 - P2 Extension Runtime Command Context

Completed:

- Added `ExtensionContext` to activation requests.
- Added a constrained extension command API for runtime command registration, command execution, and command metadata reads.
- Added extension-owned subscriptions so runtime registrations are tied to extension lifecycle instead of external closures.
- Made runtime command registration reuse manifest command metadata when available.
- Required explicit titles for runtime commands that were not contributed through the manifest.
- Disposed runtime registrations when extension activation fails and when an extension is unregistered.
- Updated platform tests to activate extension commands through the context API instead of directly touching the command service.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 68 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 186 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not required for this stage because only platform extension API boundaries and platform tests changed.

Review:

- Extension activation code now receives a narrow API surface rather than relying on direct service closures, moving closer to a VS Code-style extension host boundary.
- Runtime command handlers can attach to manifest metadata without replacing titles/categories or installing placeholder handlers.
- Runtime registrations are lifecycle-owned by the extension record, so unload and failed activation do not leak command handlers.
- The implementation still does not load external extension code, expose DOM access, expose unrestricted Node access, add packages, add storage paths, or introduce new documentation files.

Known limitations:

- The activation handler is still injected in-process; an out-of-process extension host is still needed before third-party extension code can run safely.
- Extension-owned context keys, themes, Markdown renderers, and export-provider contributions remain future extension runtime work.

## 2026-06-07 - P2 Extension Context Key Runtime API

Completed:

- Added a constrained `contextKeys` API to `ExtensionContext`.
- Allowed activated extensions to set, clear, and read context keys under their own extension id namespace.
- Wired Workbench service creation so extension runtime context keys use the platform `IContextKeyService` boundary.
- Made extension-owned context keys drive contributed menu `when` clauses through the existing menu service.
- Cleared extension-owned context keys when activation fails and when an extension is unregistered.
- Rejected runtime context keys outside the extension namespace to avoid overwriting Workbench-owned context.
- Added platform tests for menu visibility, runtime clearing, failed activation cleanup, unload cleanup, and namespace enforcement.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 72 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 190 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not required for this stage because the user-facing Workbench UI did not change; Workbench service composition is covered by type/build verification.

Review:

- Extension-owned menu visibility now flows through the same context-key and menu services as built-in Workbench actions.
- Runtime context keys are namespace-scoped by extension id, preventing extensions from mutating Workbench-owned state such as `workspace.open`.
- Context key cleanup is owned by the extension record lifecycle, so failed activation and unload do not leave stale menu state.
- No dynamic code loading, unrestricted Node access, direct DOM access, new package, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- The activation handler is still injected in-process; a future out-of-process extension host must broker the same command and context-key APIs.
- Themes, Markdown renderers, and export-provider contributions remain future extension runtime work.

## 2026-06-07 - P2 Extension Export Provider API

Completed:

- Added a constrained `exports` API to `ExtensionContext`.
- Allowed activated extensions to register provider-backed export formats through the existing `IExportService` boundary.
- Wired Workbench service creation so extension export providers share the same platform export service as built-in HTML export.
- Made runtime export providers lifecycle-owned by the extension record, so they are removed when activation fails or when an extension is unregistered.
- Relaxed the platform export format type to support future provider formats while keeping native save support constrained by desktop export configuration.
- Added duplicate-format rejection and provider field normalization to `ExportService`.
- Added platform tests for extension export provider registration, failed activation cleanup, disposal cleanup, and duplicate provider rejection.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 75 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 193 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not required for this stage because the user-facing Workbench UI did not change; Workbench service composition is covered by type/build verification.

Review:

- Export providers now follow the same extension runtime lifecycle pattern as commands and context keys.
- Workbench still only triggers built-in export commands; it does not render Markdown, resolve resources, write files, or special-case extension formats.
- Duplicate provider rejection prevents runtime providers from replacing built-in formats and leaving the export service in a broken state after disposal.
- No dynamic code loading, unrestricted Node access, direct DOM access, new package, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- The activation handler is still injected in-process; a future out-of-process extension host must broker the same export-provider API.
- Native save dialogs only support formats listed in the desktop export configuration; extension formats need shell support before native save can handle them.
- Themes and Markdown renderer contributions remain future extension runtime work.

## 2026-06-07 - P2 Extension Theme Contributions

Completed:

- Added platform `IThemeService` and `ThemeService` for registering theme contributions.
- Added theme contribution support to extension manifests.
- Wired Workbench service creation so extension manifests register themes through the platform theme service.
- Added duplicate theme id rejection, normalized theme metadata, cloned query results, and disposable cleanup.
- Restricted theme token names to Typora Plus CSS tokens and rejected unsafe CSS declaration syntax in token values.
- Added rollback behavior when theme registration fails after earlier extension contributions were registered.
- Added platform tests for theme service registration/disposal, duplicate and unsafe token rejection, extension theme registration, missing theme service errors, and rollback.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 80 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 198 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not required for this stage because theme application UI did not change; Workbench service composition is covered by type/build verification.

Review:

- Theme contributions now have a platform registration boundary instead of future ad hoc Workbench constants.
- Theme token validation keeps contributed values aligned with the existing `--tp-*` design token system.
- Extension registration rollback covers theme failures, so command/menu/keybinding metadata does not leak after invalid theme manifests.
- No theme application UI, dynamic code loading, unrestricted Node access, direct DOM access, new package, storage path, visual token file, or extra documentation file was introduced.

Known limitations:

- Registered extension themes are not yet selectable or applied to the document; a future stage needs a theme selection model and safe CSS variable application path.
- The activation handler is still injected in-process; a future out-of-process extension host must broker the same manifest contribution boundary.
- Markdown renderer contributions remain future extension runtime work.

## 2026-06-07 - P2 Selectable Theme Contributions

Completed:

- Added persisted optional `appearance.themeId` configuration, including explicit clearing under strict optional typing.
- Added safe `applyThemeTokens()` overlay and cleanup in the theme package.
- Added theme change events to `IThemeService`.
- Wired Workbench theme state to refresh from theme service changes and apply selected theme tokens.
- Added a Custom Theme Settings control with Default fallback.
- Added the built-in Ink theme through the built-in extension manifest.
- Added tests for configuration clearing, theme token overlay cleanup, settings search, and built-in theme contribution metadata.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts packages/theme/src/theme.test.ts packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 98 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 202 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: desktop Settings can select Ink and apply dark `--tp-*` tokens; Default clears token overrides; 390px Settings remains usable without horizontal overflow; no console errors were observed.

Review:

- Theme application now flows through the theme package, configuration service, and `IThemeService` instead of scattered Workbench constants.
- Custom themes only apply validated Typora Plus `--tp-*` tokens.
- Clearing or losing a selected theme removes the prior CSS-variable overlay instead of leaving stale visual state.
- The built-in Ink theme is contributed through the manifest boundary, keeping the path compatible with future extension themes.

Known limitations:

- Third-party extension host code loading is still not implemented.
- There is no marketplace, theme import, or external theme management UI yet.
- Markdown renderer contributions remain future extension runtime work.

## 2026-06-07 - P2 Markdown Renderer Contributions

Completed:

- Added platform `IMarkdownRendererService` and `MarkdownRendererService`.
- Split Markdown renderer metadata from runtime providers, following the same contribution/runtime separation as commands and exports.
- Added renderer contribution support to extension manifests.
- Derived `onMarkdownRenderer:<id>` activation events from manifest renderer contributions.
- Added constrained `ExtensionContext.markdown` runtime API for registering renderer providers.
- Wired Workbench service creation so extension manifests and runtime APIs share one Markdown renderer service instance.
- Added duplicate registration rejection, renderer metadata normalization, provider cleanup, runtime metadata support, and disposable lifecycle cleanup.
- Added platform tests for renderer registration, provider rendering, invalid registrations, manifest registration, rollback, missing service errors, runtime provider registration, and failed activation cleanup.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 89 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 210 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Workbench loaded with shell, titlebar, activitybar, and editor; no horizontal overflow; no console errors.

Review:

- Markdown renderer extensibility now has a platform service boundary instead of future ad hoc editor constants.
- Manifest renderer metadata can activate extensions lazily, while runtime providers are lifecycle-owned by the extension record.
- Provider output is not inserted into the DOM by the platform service; future editor integration must sanitize and place rendered output before preview use.
- No dynamic code loading, unrestricted Node access, direct DOM access, visual token, storage path, or extra documentation file was introduced.

Known limitations:

- Registered Markdown renderer providers are not connected to the CodeMirror live-preview surface yet.
- Third-party extension host code loading is still not implemented.
- Marketplace or extension package installation remains future work.

## 2026-06-07 - P2 Architecture Boundary Guard

Completed:

- Added automated architecture boundary tests for workspace package source imports.
- Added checks for workspace package dependency declarations.
- Added checks for TypeScript project references.
- Encoded the documented package direction in test rules: base and platform stay below Workbench/app code, editor depends on Markdown only, and desktop remains the outer app layer.
- Kept the guard inside the existing test suite instead of adding another toolchain or documentation surface.

Quality gate:

- `npm run test -- --run packages/platform/src/architectureBoundaries.test.ts`: passed, 3 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 213 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed
- Browser smoke check: not required for this stage because runtime UI code did not change; the desktop renderer build is covered by `npm run verify`.

Review:

- The stage review rule for dependency-boundary drift is now enforced automatically instead of relying only on manual inspection.
- The guard checks imports, package metadata, and TypeScript references, so architectural drift in code or project setup is caught early.
- No runtime behavior, visual token, platform path, dynamic extension loading, or extra documentation file was introduced.

Known limitations:

- The guard enforces current package direction only; it does not validate runtime service usage inside allowed layers.
- Future package-layer changes must update both `docs/ARCHITECTURE.md` and the boundary test together.

## 2026-06-07 - P2 On-Demand Markdown Renderer Activation

Completed:

- Added an activation handler option to `MarkdownRendererService`.
- Made renderer `render()` calls activate known metadata-only renderer contributions before retrying provider lookup.
- Kept unknown renderer ids from triggering activation, preserving clear missing-contribution errors.
- Wired Workbench service creation so Markdown renderer requests activate `onMarkdownRenderer:<id>` through `IExtensionService`.
- Updated platform test helpers to match Workbench's renderer activation bridge.
- Added platform tests for service-level lazy activation, unknown renderer errors, missing-provider errors after activation, and extension renderer activation before rendering.

Quality gate:

- `npm run test -- --run packages/platform/src/platform.test.ts`: passed, 93 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 217 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Workbench loaded with shell, titlebar, activitybar, and editor; no horizontal overflow; no console errors.

Review:

- Markdown renderer activation now mirrors command activation: metadata can be registered early, while executable providers are supplied lazily by activation.
- Provider lookup remains platform-owned and lifecycle cleanup remains extension-record-owned.
- Unknown renderer ids fail before activation, so renderer calls do not wake unrelated extensions.
- No direct DOM insertion, dynamic extension loading, unrestricted Node access, visual token, storage path, or extra documentation file was introduced.

Known limitations:

- Registered Markdown renderer providers are still not connected to CodeMirror live-preview surfaces.
- Future editor integration must sanitize provider output before any preview DOM insertion.
- Third-party extension host code loading remains future work.

## 2026-06-07 - P2 Markdown Renderer Preview Bridge

Completed:

- Added an editor `MarkdownCodeFenceRenderer` callback contract with a synchronous capability gate and asynchronous render path.
- Connected Workbench to `IMarkdownRendererService` through a focused adapter that selects matching block renderers by code-fence language and preserves the active document URI.
- Rendered matching inactive code fences as live-preview widgets with loading, fallback, error, copy, and source-focused click editing states.
- Sanitized provider HTML inside the editor before DOM insertion, with tag, attribute, and `tp-renderer-*` class allowlists.
- Kept unmatched code fences on the existing source-oriented preview path instead of routing every fence through provider fallback.
- Made long code-fence previews visible-range-aware so the preview widget can mount on the first visible line when the opening fence is outside the viewport.
- Added editor tests for code-fence source ranges and renderer HTML sanitization.
- Added Workbench tests for renderer selection, lazy activation through the platform service, and active document context propagation.

Quality gate:

- `npm run verify`: passed, 225 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- Browser smoke check at `http://127.0.0.1:5173/`: Workbench loaded with shell and editor, no renderer runtime errors, and no console errors.

Review:

- The editor still has no dependency on platform or Workbench services; it receives a narrow renderer callback.
- Workbench adapts platform renderer metadata/providers without parsing or sanitizing provider HTML.
- The platform renderer service still owns metadata/provider activation only and never writes DOM.
- Provider HTML is sanitized before preview insertion, so renderer providers cannot inject scripts, event handlers, styles, links, images, or arbitrary classes into the editor surface.
- No hard-coded renderer ids, languages, filesystem paths, storage paths, new packages, or extra documentation files were introduced.

Known limitations:

- No built-in Markdown renderer provider is contributed yet, so browser smoke currently verifies shell/editor stability while unit tests cover the renderer bridge.
- Inline renderer contributions are registered by the platform but are not connected to an editor preview surface yet.
- Third-party extension host code loading remains future work.

## 2026-06-07 - P2 Built-In Mermaid Renderer

Completed:

- Added Mermaid as the first built-in block Markdown renderer provider.
- Contributed Mermaid renderer metadata through the built-in Workbench extension manifest.
- Added a Workbench activation handler that registers the Mermaid provider through `ExtensionContext.markdown` on `onMarkdownRenderer:<id>`.
- Lazy-loaded Mermaid only when a matching inactive `mermaid` code fence is previewed.
- Rendered Mermaid SVG as an encoded data image so provider output remains inert before editor insertion.
- Extended the editor renderer sanitizer to allow only encoded data image sources and safe renderer classes while still dropping raw SVG data, scripts, event handlers, style attributes, and external image URLs.
- Added renderer-specific preview image styling that preserves aspect ratio inside the editor preview block.
- Split the Mermaid dependency graph into a dedicated production chunk so it does not inflate the startup vendor bundle.
- Added tests for Mermaid provider output, built-in activation registration, manifest metadata, and stricter sanitizer image handling.

Quality gate:

- `npm run verify`: passed, 231 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: typed a Mermaid code fence through the editor, observed one ready renderer block, one loaded Mermaid image, `flowchart-v2` label, no renderer errors, and no console errors.
- Production build split check: startup vendor chunk stayed around 412 KB minified while Mermaid emitted as a separate lazy chunk around 3.1 MB minified.

Review:

- Mermaid uses the same manifest metadata, activation event, extension context, renderer service, Workbench adapter, and editor sanitizer boundaries as future extension renderers.
- The editor still does not import Mermaid or platform services.
- Workbench owns built-in runtime activation, but rejects unknown extension runtime activation instead of silently swallowing unsupported external extension work.
- The Mermaid SVG is not inserted as raw DOM; it is encoded into a data image and then passed through the editor sanitizer.
- No hard-coded file paths, storage paths, extra documentation files, or direct DOM access by renderer providers were introduced.

Known limitations:

- Mermaid's dependency graph is large; it is isolated behind lazy loading, but the lazy chunk still needs future measurement on lower-end machines.
- Inline renderer contributions are registered by the platform but are not connected to an editor preview surface yet.
- Third-party extension host code loading remains future work.

## 2026-06-07 - P2 Renderer Preview Cache

Completed:

- Added a bounded LRU cache to the Workbench Markdown code-fence renderer adapter.
- Reused successful preview render results for identical renderer id, active document URI, code-fence info, language, and content.
- Kept cache entries isolated by document URI so the same code fence in different notes can still receive document-aware provider output.
- Evicted least-recently-used entries when the cache reaches its configured limit.
- Removed failed render attempts from the cache so transient renderer failures can recover on the next render.
- Added tests for cache reuse, document isolation, LRU eviction, failed render cleanup, and the bounded default limit.

Quality gate:

- `npm run test -- --run packages/workbench/src/markdownRendererPreview.test.ts`: passed, 8 tests
- `npm run verify`: passed, 236 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Mermaid preview stayed ready after reload, loaded one preview image, and reported no renderer or console errors.

Review:

- The cache stays in the Workbench adapter, so the editor still only receives a narrow callback and the platform renderer service stays stateless.
- Renderer and document changes rebuild the adapter through existing Workbench memoization and naturally clear stale preview cache state.
- The cache is bounded and keyed on all provider-visible source inputs, avoiding unbounded growth and cross-document result reuse.
- No new dependency, storage path, visual token, extra documentation file, or renderer-specific editor dependency was introduced.

Known limitations:

- The cache is in-memory only; previews are recomputed after app reload.
- Cache size is an internal adapter default; there is no user-facing setting yet.
- Inline renderer contributions are registered by the platform but are not connected to an editor preview surface yet.

## 2026-06-07 - P2 Configurable Renderer Preview Cache

Completed:

- Added `editor.rendererPreviewCacheEntries` to persisted platform configuration.
- Moved the Workbench renderer preview cache default to platform configuration instead of a Workbench-only constant.
- Wired the configured cache limit into the Markdown code-fence renderer adapter.
- Added a searchable `Renderer Cache` numeric setting with platform-derived bounds.
- Allowed `0` cache entries as a validated setting so caching can be disabled for diagnostics.
- Aligned numeric setting steps with default values so Settings sliders and number inputs display the same values.
- Added tests for persisted cache configuration, invalid value filtering, clamping, searchable settings metadata, default cache ownership, and default numeric step alignment.

Quality gate:

- `npm run typecheck`: passed
- `npm run test -- --run packages/platform/src/platform.test.ts packages/workbench/src/settingsModel.test.ts packages/workbench/src/markdownRendererPreview.test.ts`: passed, 110 tests
- `npm run verify`: passed, 237 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Settings opened, `renderer cache` search showed the new editor setting, cache value controls rendered consistently, auto-save delay and line-height sliders matched their number inputs, no horizontal overflow, and no console errors.

Review:

- Renderer cache sizing now follows the same configuration boundary as other editor behavior defaults.
- Workbench consumes the cache limit through configuration and still keeps the cache adapter-scoped and in-memory.
- Settings uses platform constraints rather than local UI bounds, keeping persisted validation and controls aligned.
- No new dependency, storage path, visual token, renderer-specific editor dependency, or extra documentation file was introduced.

Known limitations:

- The cache is still in-memory only; previews are recomputed after app reload.
- Inline renderer contributions are registered by the platform but are not connected to an editor preview surface yet.
- Mermaid remains isolated behind lazy loading, but its lazy chunk still needs future lower-end machine measurement.

## 2026-06-07 - P2 Inline Markdown Renderer Preview Bridge

Completed:

- Added an editor `MarkdownInlineRenderer` callback contract separate from the code-fence renderer callback.
- Added inactive-line parsing for language-qualified inline code spans such as `` `badge:done` ``.
- Connected registered inline Markdown renderer providers to those spans through the Workbench adapter.
- Preserved active-line source editing and source-focused click editing for rendered inline spans.
- Added inline-only renderer HTML sanitization so inline providers cannot insert block layouts or unsafe attributes into the editor line.
- Reused the configuration-driven renderer preview cache for inline renderer results, keyed by renderer id, active document URI, language, and value.
- Added tests for inline span parsing, ordinary inline-code exclusion, active-line source visibility, inline sanitizer behavior, inline renderer selection, lazy activation, document context propagation, and inline cache reuse.

Quality gate:

- `npm run typecheck`: passed
- `npm run test -- --run packages/editor/src/livePreview.test.ts packages/workbench/src/markdownRendererPreview.test.ts`: passed, 99 tests
- `npm run verify`: passed, 246 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Workbench loaded, Mermaid preview remained ready with one rendered image, no inline previews appeared without an inline provider, no horizontal overflow, and no console errors.

Review:

- The editor still has no dependency on platform or Workbench services; it receives narrow block and inline renderer callbacks.
- Inline renderer activation, provider lookup, and document context remain Workbench/platform responsibilities.
- Ordinary inline code is not routed to renderers, keeping the writing surface predictable.
- Inline provider output uses a stricter sanitizer than block output, preventing provider HTML from changing line layout with tables, figures, or other block elements.
- No new dependency, storage path, built-in inline effect, visual token, renderer-specific editor dependency, or extra documentation file was introduced.

Known limitations:

- There is no built-in inline renderer provider yet; the bridge is ready for future extension-host or built-in contributions with clear product value.
- The cache is still in-memory only; previews are recomputed after app reload.
- Mermaid remains isolated behind lazy loading, but its lazy chunk still needs future lower-end machine measurement.

## 2026-06-07 - P2 Built-In Status Inline Renderer

Completed:

- Added the built-in Status inline Markdown renderer provider for language-qualified spans such as `` `status:done` ``.
- Contributed Status renderer metadata through the built-in Workbench extension manifest.
- Registered the Status provider lazily through the Workbench activation handler on `onMarkdownRenderer:<id>`.
- Rendered compact escaped status badges for done, in-progress, pending, blocked, todo, and unknown neutral states.
- Styled badges with existing theme tokens inside the editor inline renderer shell, without adding new color tokens.
- Added tests for status rendering, escaping, custom labels, manifest contribution, activation registration, and existing editor inline renderer parsing/sanitizer behavior.

Quality gate:

- `npm run typecheck`: passed
- `npm run test -- --run packages/workbench/src/statusMarkdownRenderer.test.ts packages/workbench/src/workbenchContributions.test.ts packages/workbench/src/workbenchExtensionActivation.test.ts packages/editor/src/livePreview.test.ts`: passed, 103 tests
- `npm run verify`: passed, 251 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Workbench loaded, existing Mermaid preview remained ready, no horizontal overflow, and no console errors. Direct bulk editor input was blocked by the in-app browser clipboard shim, so status rendering itself is covered by provider, manifest, activation, parser, adapter, and sanitizer tests.

Review:

- Status is a Workbench built-in extension contribution, not an editor hard-code.
- The editor still only knows the generic inline renderer callback and sanitizer path.
- Status output is escaped before it reaches the editor sanitizer, and the sanitizer still strips unsupported attributes/classes.
- Visual styling reuses existing `--tp-*` tokens and keeps the badge compact enough for a Typora-like writing surface.
- No new dependency, storage path, extra documentation file, or direct DOM access by renderer providers was introduced.

Known limitations:

- Status aliases are intentionally small and built-in; future user-defined badge vocabularies would need a settings or extension contribution schema.
- The renderer preview cache is still in-memory only; previews are recomputed after app reload.
- Mermaid remains isolated behind lazy loading, but its lazy chunk still needs future lower-end machine measurement.

## 2026-06-07 - P2 Configurable Status Badge Vocabulary

Completed:

- Added `markdown.statusBadges` to persisted platform configuration.
- Moved the built-in Status badge vocabulary into validated configuration defaults instead of a Workbench-only alias table.
- Added bounded validation for badge keys, labels, tones, aliases, duplicate keys, duplicate aliases, and empty override lists.
- Injected the current configuration into the Workbench built-in extension activation handler so the Status provider reads the latest badge vocabulary at render time.
- Rebuilt Markdown renderer adapters when Markdown configuration changes, naturally dropping preview cache entries that depended on older renderer preferences.
- Added tests for persisted status badge configuration, invalid stored-value fallback, empty vocabulary overrides, dynamic provider reads, and Workbench activation wiring.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/platform.test.ts packages/workbench/src/statusMarkdownRenderer.test.ts packages/workbench/src/workbenchExtensionActivation.test.ts`: passed, 103 tests
- `npm run verify`: passed, 253 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Workbench and editor loaded, no horizontal overflow, and no console errors.

Review:

- Status remains a built-in extension-style Markdown renderer, not editor-specific syntax.
- The editor still receives only generic inline renderer callbacks and owns sanitization before preview insertion.
- Status badge defaults and bounds now live in the platform configuration boundary, so the renderer provider does not carry a private hard-coded vocabulary.
- Configuration changes are read through service injection and do not expose storage, DOM, or platform internals to the renderer provider.
- No new dependency, storage path, visual token, extra documentation file, or direct DOM access by renderer providers was introduced.

Known limitations:

- The Settings UI does not yet expose a dedicated Status badge vocabulary editor; the validated configuration path is ready for a future compact settings surface or extension contribution schema.
- The renderer preview cache is still in-memory only; previews are recomputed after app reload.
- Mermaid remains isolated behind lazy loading, but its lazy chunk still needs future lower-end machine measurement.

## 2026-06-07 - P2 Extension Host Routing Boundary

Completed:

- Added `IExtensionHostService` and `ExtensionHostService` for registering extension hosts and dispatching activation requests.
- Added explicit duplicate-host, missing-host, and ambiguous-host rejection so runtime activation routing remains deterministic.
- Moved the built-in Workbench runtime from a direct activation handler into a registered in-process Workbench extension host.
- Wired Workbench service creation so `IExtensionService` delegates activation through `IExtensionHostService` while command and Markdown renderer activation events keep their existing flow.
- Kept the built-in Mermaid and Status providers on the same constrained `ExtensionContext.markdown` API that future hosts will broker.
- Added platform tests for host registration, disposal, duplicate ids, missing hosts, and ambiguous matches, plus Workbench tests for built-in host activation.

Quality gate:

- `npm run verify`: passed, 257 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check at `http://127.0.0.1:5173/`: Workbench and editor loaded, no horizontal overflow, and no console errors.

Review:

- `IExtensionService` still owns manifest registration, activation state, lifecycle cleanup, and runtime context creation.
- `IExtensionHostService` now owns only host selection and dispatch; it does not load code, expose DOM, expose Node, or own extension contributions.
- Workbench's built-in host is exact-match scoped to the built-in extension id, so external extension activation cannot be silently handled by the wrong runtime.
- The platform/editor/workbench dependency direction remains unchanged and is still covered by the architecture boundary tests inside `npm run verify`.
- No new dependency, storage path, visual token, extra documentation file, or direct DOM access by extension runtimes was introduced.

Known limitations:

- External extension package loading is still not implemented.
- The current Workbench host is still in-process; an out-of-process host implementation should plug into the same host service before third-party code can run.
- Extension host transport and IPC are not implemented yet.

## 2026-06-07 - P2 Extension Host Protocol Messages

Completed:

- Added platform-level extension host protocol message types for activation requests, activation results, and activation errors.
- Added bounded protocol limits for request ids, extension ids, activation events, activation-event lists, display names, and error details.
- Added serializers, deserializers, and unknown-input validators that normalize protocol messages before they cross a future out-of-process host boundary.
- Kept `ExtensionContext` functions, runtime command handlers, renderer providers, and internal services out of the serializable activation request payload.
- Added tests for activation request serialization, response normalization, bounded error serialization, unknown-input reads, invalid type rejection, invalid activation-state rejection, and activation-event list bounds.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocol.test.ts packages/platform/src/extensionHosts.test.ts`: passed, 9 tests
- `npm run verify`: passed, 262 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only

Review:

- The protocol layer is platform-only and does not depend on Workbench, Electron, DOM, Node, or dynamic code loading.
- Activation protocol payloads are JSON-safe data instead of service objects or closures, matching the intended VS Code-style main-thread/extension-host split.
- Existing in-process Workbench activation remains unchanged; the new protocol is a preparation boundary for future host transport.
- No new dependency, storage path, visual token, extra documentation file, or direct DOM access by extension runtimes was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- Runtime API broker messages for exports and Markdown renderer providers remain future work.

## 2026-06-07 - P2 Extension Host Command and Context Broker Messages

Completed:

- Added extension host protocol messages for runtime command registration, command execution, and command list requests.
- Added extension host protocol messages for extension-owned context key set, clear, and get requests.
- Added shared runtime API result and error messages for future broker responses.
- Added bounded JSON value validation for command arguments and API results, including finite numbers, string length limits, array length limits, object property limits, recursion depth limits, and plain-object checks.
- Enforced extension-owned context key namespaces in protocol messages so external hosts cannot directly mutate global Workbench context keys.
- Added tests for command registration, command execution, command list requests, context key set/clear/get, API result/error serialization, non-serializable argument rejection, invalid context values, argument-count bounds, and non-plain object rejection.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocol.test.ts`: passed, 9 tests
- `npm run verify`: passed, 266 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only

Review:

- The broker protocol remains platform-only and does not depend on Workbench, Electron, DOM, Node, or dynamic code loading.
- Runtime command handlers and context-key service functions are still not serialized; protocol messages only describe bounded requests and JSON-safe payloads.
- Context keys keep the existing extension-id namespace rule before any future IPC transport can touch platform context.
- No new dependency, storage path, visual token, extra documentation file, or direct DOM access by extension runtimes was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- Broker protocol messages for export providers and Markdown renderer providers remain future work.

## 2026-06-07 - P2 Extension Host Export and Renderer Broker Messages

Completed:

- Added extension host protocol messages for export provider registration, export document requests, and exported document results.
- Added extension host protocol messages for Markdown renderer provider registration, render requests, and render results.
- Added bounded protocol validation for export formats, document URIs, document names, source/exported text, default file names, MIME types, asset counts, relative asset paths, image asset MIME types, base64 payloads, renderer ids, renderer metadata, renderer languages, priorities, source text, and rendered HTML.
- Kept non-serializable export and renderer runtime functions out of protocol payloads, including `resolveImageSource`, provider functions, DOM objects, Node objects, and internal platform services.
- Added tests for export provider registration, export document request/result serialization, export asset validation, Markdown renderer registration/render serialization, and renderer metadata/HTML bounds.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocol.test.ts`: passed, 13 tests
- `npm run verify`: passed, 270 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform protocol types and documentation.

Review:

- The broker protocol remains platform-only and does not depend on Workbench, Electron, DOM, Node, or dynamic code loading.
- Export provider registration is represented as bounded metadata, while export execution is represented as document request/result data; provider functions and resource resolver functions are still not serialized.
- Export asset payloads are constrained before any future IPC transport can write sibling export assets.
- Markdown renderer output is still just bounded HTML data at the protocol layer; Workbench/editor sanitizer boundaries remain responsible for preview insertion.
- No new dependency, storage path, visual token, extra documentation file, or direct DOM access by extension runtimes was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- Out-of-process export providers will need a future resource-resolution broker if they must resolve workspace-relative images during export.

## 2026-06-07 - P2 Extension Host Runtime Broker Boundary

Completed:

- Added `ExtensionHostRuntimeBroker` as a platform-level bridge from validated runtime API protocol messages to one activated `ExtensionContext`.
- Mapped command registration, command execution, command listing, extension-owned context key set/clear/get, export provider registration, and Markdown renderer provider registration messages onto the existing constrained context APIs.
- Registered proxy command handlers, export providers, and Markdown renderer providers that call an injected request function for future host-side callbacks.
- Added request id generation injection so tests and future transports can control correlation without hard-coded transport behavior.
- Added lifecycle cleanup so disposing the broker unregisters its proxy runtime contributions.
- Added focused tests for command/context broker handling, remote command callback forwarding, export provider proxy forwarding, Markdown renderer proxy forwarding, extension-id mismatch errors, remote API error propagation, and broker disposal cleanup.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostRuntimeBroker.test.ts packages/platform/src/extensionHostProtocol.test.ts`: passed, 17 tests
- `npm run verify`: passed, 274 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform broker/protocol code and documentation.

Review:

- The broker remains platform-only and does not depend on Workbench, Electron, DOM, Node, dynamic imports, or external extension package loading.
- Protocol validation, service invocation, and future transport request correlation are separated: protocol messages stay in `extensionHostProtocol`, platform API mapping stays in `ExtensionHostRuntimeBroker`, and IPC remains future work.
- Remote provider callbacks receive only serializable document/render inputs; provider functions and resource resolver functions are not serialized.
- Runtime proxy contributions are disposable, avoiding stale commands/providers if a future host session is torn down.
- No new dependency, storage path, visual token, extra documentation file, or direct DOM access by extension runtimes was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- The broker is not wired into an extension host implementation yet; the next step is a transport/session adapter that owns message correlation and broker lifetime.

## 2026-06-07 - P2 Extension Host Protocol Session Boundary

Completed:

- Added `ExtensionHostProtocolSession` as a platform-level session adapter around a transport-shaped `send`/`onMessage` boundary.
- Added activation request dispatch with request id generation, pending request correlation, activation result handling, and activation error propagation.
- Routed inbound runtime API messages through `ExtensionHostRuntimeBroker` and sent broker API responses back through the injected transport.
- Added response identity checks so mismatched extension ids or request ids reject the pending request instead of being accepted silently.
- Added disposal behavior that rejects all pending requests and disposes the broker-owned proxy runtime contributions.
- Added focused tests for activation success, activation errors, response mismatches, inbound command registration, remote command callback correlation, main-thread command execution, export/renderer proxy callback correlation, unhandled inbound messages, invalid inbound payloads, and pending rejection on dispose.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocolSession.test.ts packages/platform/src/extensionHostRuntimeBroker.test.ts packages/platform/src/extensionHostProtocol.test.ts`: passed, 23 tests
- `npm run verify`: passed, 280 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform session/protocol code and documentation.

Review:

- The session remains platform-only and depends only on base events/lifecycle plus platform extension contracts.
- Transport behavior is abstracted as `send` and `onMessage`; Electron IPC, worker messaging, and external extension package loading remain outside this boundary.
- Request correlation is owned by the session instead of being scattered through future hosts or Workbench code.
- Runtime API mapping remains owned by `ExtensionHostRuntimeBroker`, keeping protocol validation, session correlation, and service invocation separate.
- No new dependency, storage path, visual token, extra documentation file, or direct DOM access by extension runtimes was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- No concrete out-of-process extension host implementation is wired to the session yet.

## 2026-06-07 - P2 Extension Host Protocol Host Adapter

Completed:

- Added `ExtensionHostProtocolHost` as a platform implementation of the existing `ExtensionHost` interface.
- Added a caller-provided transport factory so future worker, process, or Electron IPC transports can plug in without changing `IExtensionHostService`.
- Created one `ExtensionHostProtocolSession` per extension id, reused sessions across repeated activation calls, and exposed session ids for lightweight diagnostics.
- Tied protocol session cleanup to host disposal and the extension subscription lifecycle so unregistering an extension tears down its transport-backed runtime state.
- Disposed failed activation sessions immediately so failed remote activations do not leave stale proxy providers or pending request state.
- Added focused tests for matching activation, non-matching rejection, per-extension session reuse, activation failure cleanup, extension subscription cleanup, host disposal cleanup, and option validation.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocolHost.test.ts packages/platform/src/extensionHostProtocolSession.test.ts packages/platform/src/extensionHostRuntimeBroker.test.ts`: passed, 16 tests
- `npm run verify`: passed, 286 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform extension-host adapter code and documentation.

Review:

- The adapter remains platform-only and implements the same host interface already used by the in-process Workbench host.
- Host selection, session correlation, runtime API mapping, and future transport implementation now sit in separate units, matching the intended VS Code-style layering.
- No transport implementation, external code loader, DOM access, Node access, storage path, visual token, or extra documentation file was introduced.
- The host id, activation selector, transport factory, request id generation, and error handling are injected instead of hidden in hard-coded behavior.
- Session lifecycle is tied to extension subscriptions so runtime contributions remain removable through the existing extension cleanup path.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- The protocol host is not registered by Workbench or Electron yet; the next stage should introduce a concrete transport boundary only when the runtime environment is clear.

## 2026-06-07 - P2 Extension Host Runtime Contribution Unregister

Completed:

- Added protocol messages for command unregister, export provider unregister, and Markdown renderer unregister.
- Extended protocol serialization and unknown-input readers for bounded unregister payloads.
- Extended `ExtensionHostRuntimeBroker` with per-command, per-export-format, and per-renderer proxy disposable registries.
- Routed unregister messages through the broker so individual remote runtime contributions can be disposed without waiting for the whole extension session to end.
- Kept session routing aware of unregister messages so future transports can deliver them through the same runtime API path.
- Added tests for unregister message serialization, proxy disposal, and unknown proxy unregister errors.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocol.test.ts packages/platform/src/extensionHostRuntimeBroker.test.ts packages/platform/src/extensionHostProtocolSession.test.ts`: passed, 24 tests
- `npm run verify`: passed, 287 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform protocol/broker lifecycle code and documentation.

Review:

- Runtime contribution lifecycle is now explicit at protocol level instead of relying only on whole-session cleanup.
- Broker proxy registries are keyed by normalized protocol ids and formats, avoiding hidden hard-coded contribution ownership.
- The unregister path still stays platform-only and does not depend on Workbench, Electron, DOM, Node, dynamic imports, or external package loading.
- No transport implementation, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- A future protocol runtime facade should use these unregister messages when remote extension code disposes registered commands, export providers, or renderers.

## 2026-06-07 - P2 Extension Host Protocol Runtime Facade

Completed:

- Added `ExtensionHostProtocolRuntime` as the protocol peer for a future remote extension runtime.
- Created a constrained proxy `ExtensionContext` from activation messages and invoked an injected activation handler.
- Sent command, context-key, export-provider, and Markdown-renderer registration messages from remote context APIs through the transport boundary.
- Sent unregister messages when remote command/export/renderer disposables are disposed.
- Handled main-side callback requests for registered remote commands, export providers, and Markdown renderer providers.
- Converted callback failures into API error responses so main-side pending requests do not hang.
- Added request correlation and API error handling for remote `executeCommand()` calls and fire-and-forget registration failures.
- Added focused tests for activation, proxy context state, runtime contribution registration, main-side callbacks, remote command execution, unregister disposal, activation failure cleanup, and protocol error reporting.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocolRuntime.test.ts packages/platform/src/extensionHostProtocolHost.test.ts packages/platform/src/extensionHostProtocolSession.test.ts packages/platform/src/extensionHostRuntimeBroker.test.ts`: passed, 23 tests
- `npm run verify`: passed, 293 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform protocol runtime code and documentation.

Review:

- The runtime facade remains platform-only and uses only transport-shaped `send`/`onMessage` messaging; it does not load extension packages or bind to Electron IPC.
- Main-side host/session/broker responsibilities and remote-side runtime facade responsibilities are now separated, matching the intended VS Code-style split.
- Remote runtime contribution lifecycle is explicit through register/unregister messages and local disposable tracking.
- Synchronous context readers currently expose local runtime state only; cross-boundary reads remain future API design work if needed.
- No new dependency, storage path, visual token, extra documentation file, DOM access, or unrestricted Node access was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- The runtime facade is not wired to a worker/process transport yet.

## 2026-06-07 - P2 Extension Host Linked Protocol Transport

Completed:

- Added `createLinkedExtensionHostProtocolTransports()` as a platform-only linked transport pair for protocol integration tests.
- Made the linked transport JSON round-trip every message through the protocol serializer/deserializer so tests do not pass object references across the boundary.
- Added disposal checks for local and peer endpoints so closed transports fail fast.
- Added end-to-end tests wiring `ExtensionHostProtocolHost`, `ExtensionHostProtocolSession`, `ExtensionHostRuntimeBroker`, `ExtensionHostProtocolRuntime`, and the linked transport together.
- Verified remote runtime command, export provider, and Markdown renderer registrations appear as main-side proxies.
- Verified main-side proxy command execution, export document calls, and Markdown render calls travel back to the runtime facade and return results.
- Verified remote disposable cleanup sends unregister messages and removes main-side proxy contributions.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocolTransport.test.ts packages/platform/src/extensionHostProtocolRuntime.test.ts packages/platform/src/extensionHostProtocolHost.test.ts`: passed, 15 tests
- `npm run verify`: passed, 296 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform protocol transport test utilities and documentation.

Review:

- This transport is a test/integration helper, not a production IPC implementation.
- The protocol stack is now verified as a closed loop from host activation through runtime registration, main-side proxy invocation, remote callback handling, and unregister cleanup.
- JSON round-trip delivery keeps the tests honest about serializable protocol payloads.
- No Electron IPC, worker transport, external code loader, DOM access, unrestricted Node access, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- A production transport adapter still needs to decide between worker, process, or Electron IPC based on runtime constraints.

## 2026-06-07 - P2 Extension Host Protocol Request Timeout Lifecycle

Completed:

- Added `ExtensionHostProtocolRequestTimer` as an injectable protocol timer boundary.
- Added optional `requestTimeoutMs` handling to `ExtensionHostProtocolSession` for activation and broker callback requests.
- Added optional `requestTimeoutMs` handling to `ExtensionHostProtocolRuntime` for proxy context commands and fire-and-forget runtime contribution requests.
- Ensured normal responses, transport send failures, timeouts, and dispose all remove pending requests and clear request timers.
- Kept late responses after timeout on the unhandled-message path instead of resolving already-rejected promises.
- Passed protocol host timeout options into per-extension sessions for future transport-backed hosts.
- Added focused tests for activation timeouts, request id reuse after timeout, proxy callback timeouts, runtime command timeouts, fire-and-forget registration timeout reporting, late responses, and dispose cleanup.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocolSession.test.ts packages/platform/src/extensionHostProtocolRuntime.test.ts packages/platform/src/extensionHostProtocolTransport.test.ts`: passed, 21 tests
- `npm run verify`: passed, 302 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform protocol lifecycle code and documentation.

Review:

- Timeout policy is injected and optional; no transport, IPC channel, or extension runtime is forced to use a hard-coded clock.
- Pending request cleanup is centralized in the session/runtime request lifecycle, avoiding scattered timeout handling across brokers or future adapters.
- Platform code remains independent of Workbench, Electron IPC, DOM access, Node APIs, dynamic imports, and external package loading.
- No new dependency, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- External extension package loading is still not implemented.
- Extension host transport and IPC are still not implemented.
- Future production transports still need an explicit default timeout policy based on worker/process/Electron runtime constraints.

## 2026-06-07 - P2 Extension Host Protocol Wire Transport

Completed:

- Added `ExtensionHostProtocolWireTransport` as a platform adapter from protocol messages to an injected string channel.
- Added outbound protocol serialization and inbound protocol deserialization at the transport boundary.
- Added invalid inbound wire-message reporting without firing malformed messages into sessions or runtimes.
- Added optional injected maximum wire-message length checks for both send and receive paths.
- Kept channel ownership external so future Electron IPC, worker, or process adapters can decide their own lifecycle.
- Added tests for outbound serialization, inbound deserialization, invalid inbound messages, message length limits, disposal behavior, option validation, and host/runtime integration over a string wire-channel pair.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocolWireTransport.test.ts packages/platform/src/extensionHostProtocolTransport.test.ts`: passed, 10 tests
- `npm run verify`: passed, 309 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform protocol transport code and documentation.

Review:

- The adapter is still platform-only and does not depend on Workbench, Electron IPC, DOM APIs, Node streams, dynamic imports, or external extension package loading.
- Serialization/deserialization is centralized at one transport boundary instead of being left to future adapters to duplicate.
- Length policy is injected and disabled by default, so future runtime-specific hosts can configure limits from their own shell policy rather than inheriting a hidden constant.
- No new dependency, storage path, visual token, or extra documentation file was introduced.

Known limitations:

- External extension package loading is still not implemented.
- A concrete worker/process/Electron IPC extension host adapter is still not implemented.
- Future production adapters still need runtime-specific lifecycle, trust, and default timeout/message-size policy.

## 2026-06-07 - P2 Extension Host Protocol Configuration Policy

Completed:

- Added an `extensionHost` platform configuration group for protocol request timeout and wire-message length policy.
- Added platform-owned numeric constraints and defaults for extension host protocol policy.
- Added sanitization, persistence, invalid-value rejection, and out-of-range clamping for extension host protocol configuration.
- Added `ExtensionHostProtocolConfiguration` helpers that map configuration into session, runtime, and wire transport options.
- Preserved explicit protocol adapter options ahead of configured defaults so tests and specialized hosts can override policy intentionally.
- Added tests for default alignment, persistence, invalid stored values, out-of-range clamping, disabled zero values, and option precedence.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocolConfiguration.test.ts packages/platform/src/platform.test.ts`: passed, 98 tests
- `npm run verify`: passed, 312 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform configuration/protocol policy and documentation.

Review:

- Protocol timeout and message-size policy now lives in configuration instead of being scattered through future transport adapters.
- The configuration mapper is platform-only and does not depend on Workbench, Electron IPC, DOM APIs, Node streams, dynamic imports, or external extension package loading.
- Zero-valued policy disables the limit deliberately, while persisted invalid values are ignored and out-of-range values are clamped by the configuration layer.
- No new dependency, storage path, visual token, user-facing Settings surface, or extra documentation file was introduced.

Known limitations:

- External extension package loading is still not implemented.
- A concrete worker/process/Electron IPC extension host adapter is still not implemented.
- Future production adapters still need runtime-specific lifecycle and trust handling.

## 2026-06-07 - P2 Extension Host Protocol Handshake

Completed:

- Added protocol handshake request/result messages carrying protocol version and bounded capability ids.
- Added protocol validation for handshake version ranges, capability count, capability length, capability syntax, and duplicate capability normalization.
- Added reusable `ExtensionHostProtocolSession.handshake()` with response identity checks, protocol version checks, required capability checks, and retry after failed handshakes.
- Added `requireHandshake` session/host option so future transport-backed hosts can require compatibility checks before activation.
- Added runtime-side automatic handshake responses and incompatible-version API error responses.
- Updated linked transport integration to activate through a required handshake path.
- Added tests for handshake serialization, invalid handshake payloads, session handshake reuse, forced handshake-before-activation, retry after handshake failure, runtime success/error responses, and linked host/runtime integration.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/platform/src/extensionHostProtocol.test.ts packages/platform/src/extensionHostProtocolSession.test.ts packages/platform/src/extensionHostProtocolRuntime.test.ts packages/platform/src/extensionHostProtocolTransport.test.ts packages/platform/src/extensionHostProtocolWireTransport.test.ts`: passed, 47 tests
- `npm run verify`: passed, 318 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage only changes platform protocol compatibility code and documentation.

Review:

- Handshake is optional by default for existing in-process and test flows, but can be required by future transport adapters before activation.
- Protocol compatibility now fails with explicit version/capability errors rather than relying only on request timeouts.
- The implementation remains platform-only and does not depend on Workbench, Electron IPC, DOM APIs, Node streams, dynamic imports, or external extension package loading.
- No new dependency, storage path, visual token, user-facing Settings surface, or extra documentation file was introduced.

Known limitations:

- External extension package loading is still not implemented.
- A concrete worker/process/Electron IPC extension host adapter is still not implemented.
- Future production adapters still need runtime-specific lifecycle and trust handling.

## 2026-06-07 - P2 Table Link Target Pipe Mapping

Completed:

- Made the shared Markdown table cell scanner ignore `|` inside inline link and image target parentheses, including title text.
- Added balanced label and target scanning so nested brackets or parentheses do not split table cells prematurely.
- Preserved link and image target cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for link/image target pipes, link-target-only non-table lines, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 93 tests
- `npm run verify`: passed, 323 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Table parsing remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Preview rendering, source navigation, and pure table transforms still share one scanner path, avoiding divergent hard-coded table behavior.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Pipes in link labels and reference-style links still rely on the planned parser-backed table mapping pass.
- Parser-backed math position mapping remains planned.

## 2026-06-07 - P2 Table Linked Label Pipe Mapping

Completed:

- Promoted table protected ranges from link/image targets to complete inline and reference-style link/image syntax.
- Kept `|` inside linked labels, reference-style link labels, and image alt text from splitting Markdown table cells.
- Preserved linked-label cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for inline linked-label pipes, reference-style link/image pipes, linked-label-only non-table lines, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 98 tests
- `npm run verify`: passed, 328 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Table parsing remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The scanner only protects bracket spans that resolve to inline `(...)` or reference-style `[...]` link/image syntax, avoiding an unconditional hard-coded bracket rule.
- Preview rendering, source navigation, and pure table transforms still share one scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Shortcut reference links and broader nested inline edge cases still rely on the planned parser-backed table mapping pass.
- Parser-backed math position mapping remains planned.

## 2026-06-07 - P2 Math Source Range Refinement

Completed:

- Trimmed display math source ranges so clicking an inactive math preview selects the actual TeX content instead of leading or trailing blank padding.
- Kept whitespace-only display math blocks editable by placing the insertion point on the first content line.
- Preserved existing closed, multiline, empty, and unclosed math block source behavior.
- Added focused tests for padded and whitespace-only display math source ranges.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 100 tests
- `npm run verify`: passed, 330 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure math source mapping and is covered by unit and full build verification.

Review:

- Math source mapping remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The range helper reuses existing whitespace index utilities instead of adding a parallel hard-coded column calculation path.
- The Markdown text model remains the source of truth; preview clicks still dispatch only CodeMirror selection changes.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Display math detection covers fenced `$$` blocks and the follow-up single-line `$$ ... $$` stage; the later bracket-delimiter stage narrows delimiter coverage further, while broader inline edge cases remain planned for parser-backed mapping.
- Parser-backed table mapping remained planned for shortcut references until the later shortcut-reference stage, and remains planned for nested inline edge cases.

## 2026-06-07 - P2 Single-Line Display Math Preview

Completed:

- Added single-line display math detection for lines such as `$$ E = mc^2 $$`.
- Routed single-line display math through the existing math block preview widget instead of adding a parallel UI path.
- Added source-range mapping for single-line display math so preview clicks select the TeX between the delimiters.
- Kept whitespace-only single-line display math editable by placing the insertion point immediately after the opening delimiter.
- Added focused tests for single-line math block analysis and source range behavior.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 103 tests
- `npm run verify`: passed, 333 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure math block analysis and is covered by unit and full build verification.

Review:

- Math detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Single-line and multiline display math now share the same block state, KaTeX render path, source navigation, and copy control.
- The helper derives source columns from delimiters and whitespace rather than hard-coded offsets outside the parser boundary.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed math mapping remains planned for additional delimiter variants and deeper inline edge cases; the follow-up bracket-delimiter stage narrows the current delimiter gap.
- Parser-backed table mapping remained planned for shortcut references until the later shortcut-reference stage, and remains planned for nested inline edge cases.

## 2026-06-07 - P2 Bracket Display Math Preview

Completed:

- Added display math support for bracket delimiters, including multiline `\[` ... `\]` blocks and single-line `\[ ... \]` blocks.
- Replaced the `$$`-only math fence check with a small fence descriptor model shared by block detection, close-fence matching, and single-line source mapping.
- Routed bracket-delimited display math through the existing math block state, KaTeX render path, source navigation, and copy control.
- Added focused tests for bracket-delimited multiline, single-line, unclosed, and source-range behavior.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 109 tests
- `npm run verify`: passed, 339 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure math block analysis and is covered by unit and full build verification.

Review:

- Math parsing remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Delimiter support now lives in one descriptor list rather than separate hard-coded `$$` branches.
- Display math delimiter variants share one block model and preview widget, keeping the UI path maintainable.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed math mapping remains planned for additional delimiter variants and deeper inline edge cases.
- Parser-backed table mapping remained planned for shortcut references until the later shortcut-reference stage, and remains planned for nested inline edge cases.

## 2026-06-07 - P2 Table Shortcut Reference Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside shortcut-reference-style labels such as `[Guide|Docs]`.
- Covered shortcut image labels such as `![Alt|Text]` through the same protected-range path.
- Kept shortcut-reference-only lines from being mistaken for tables when all visible pipes are inside protected labels.
- Preserved shortcut reference cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for shortcut reference preview parsing, non-table detection, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 113 tests
- `npm run verify`: passed, 343 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Table parsing remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The shortcut path only protects bracket labels that actually contain a table-separator candidate, avoiding a blanket rule for every bracketed span.
- Preview rendering, source navigation, and pure table transforms still share one scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.
- Parser-backed math mapping remains planned for additional delimiter variants and deeper inline edge cases.
