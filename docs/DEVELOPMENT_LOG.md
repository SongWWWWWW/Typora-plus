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
