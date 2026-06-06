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
