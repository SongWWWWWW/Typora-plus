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

## 2026-06-07 - P2 Table Inline Math Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside inline math expressions such as `$a | b$`.
- Extracted inline math range detection into a private reader shared by inactive inline math previews and table parsing.
- Kept inline-math-only pipes from making ordinary text look like a Markdown table.
- Preserved inline math cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for inline math preview parsing, non-table detection, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 117 tests
- `npm run verify`: passed, 347 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Table parsing remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Inline math range detection now has one implementation shared by preview rendering and table cell splitting.
- Preview rendering, source navigation, and pure table transforms still share one scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.
- Parser-backed math mapping remained planned for additional inline delimiter variants until the later bracket-inline stage, and remains planned for deeper inline edge cases.

## 2026-06-07 - P2 Bracket Inline Math Preview

Completed:

- Added inactive-line inline math preview support for bracket delimiters such as `\(x+y\)`.
- Generalized inline math delimiter scanning so `$...$` and `\(...\)` use one range reader.
- Kept bracket-delimited inline math out of code spans and active lines through the existing preview gates.
- Updated inline math source navigation so preview clicks select the TeX expression inside either one-character or two-character delimiters.
- Reused the same range reader for table cell splitting, so `\(a | b\)` stays one table cell.
- Added focused tests for bracket-delimited inline ranges, code-span exclusion, table parsing, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 119 tests
- `npm run verify`: passed, 349 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure inline math range detection and source mapping covered by unit and full build verification.

Review:

- Inline math parsing remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- `$...$` and `\(...\)` share one scanner and one preview widget, keeping delimiter growth out of the UI layer.
- Source navigation now receives explicit expression ranges instead of assuming one-character delimiters.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed math mapping remains planned for deeper inline edge cases.
- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Structural Link Marker Soft Hiding

Completed:

- Replaced inactive link and image marker hiding's regex scan with structured inline link syntax ranges shared with table source mapping.
- Added inactive marker soft hiding for reference-style and collapsed-reference link/image punctuation.
- Skipped link and image punctuation inside inline code spans through the shared ignored-range path.
- Kept shortcut-reference-looking labels out of generic marker hiding unless table parsing explicitly requests separator protection.
- Added focused tests for inline-code exclusion, reference links, collapsed references, reference images, and shortcut-looking non-links.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 163 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 393 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure marker-range detection and is covered by unit and full build verification.

Review:

- Link marker detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Marker hiding now consumes scanner-owned marker ranges instead of recalculating punctuation positions from a separate regular expression.
- Table shortcut-reference pipe protection remains an explicit table-scanner option, avoiding a broad hard-coded rule that would fade ordinary bracket text.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Generic shortcut-reference marker hiding still needs document-aware reference resolution before ordinary `[label]` text can be hidden safely.
- Parser-backed inline marker mapping remains planned for deeper nested link and emphasis edge cases.

## 2026-06-07 - P2 Autolink Marker Soft Hiding

Completed:

- Added inactive-line marker soft hiding for URI and email autolink angle brackets such as `<https://example.com>` and `<user@example.com>`.
- Reused the existing validated autolink scanner instead of treating every angle-bracket span as Markdown syntax.
- Added a small enclosed-marker collector for delimiters whose opening and closing markers differ.
- Skipped autolinks inside inline code spans through the shared ignored-range path.
- Added focused tests for URI autolinks, email autolinks, code-span exclusion, invalid angle text, and inline HTML tags.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 165 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 395 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure marker-range detection and is covered by unit and full build verification.

Review:

- Autolink marker detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The autolink validation path is shared with table source mapping, keeping preview marker hiding and table protected ranges aligned.
- Invalid angle text and inline HTML remain visible source text, avoiding a broad hard-coded angle-bracket rule.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed inline marker mapping remains planned for deeper nested link and HTML edge cases.

## 2026-06-07 - P2 Inline Code Marker Soft Hiding

Completed:

- Added inactive-line marker soft hiding for inline code backtick delimiters.
- Reused the existing code span scanner and its parsed content boundaries instead of adding a second backtick parser.
- Supported multi-backtick code spans through the same marker collector.
- Preserved the behavior that unclosed backtick runs are not hidden while editing.
- Updated focused tests for active-line exclusion, inline code delimiters, multi-backtick spans, unclosed spans, and syntax inside code spans.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 166 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 396 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure marker-range detection and is covered by unit and full build verification.

Review:

- Inline code marker detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Marker hiding now uses the same code span ranges that table parsing, math/link exclusion, and inline renderer detection already consume.
- The implementation only hides delimiters from closed code spans, avoiding hard-coded backtick matching while the user is still typing incomplete source.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed inline marker mapping remains planned for deeper nested inline syntax edge cases.

## 2026-06-07 - P2 Shared Core Inline Syntax Ranges

Completed:

- Added a private `readMarkdownCoreInlineSyntaxRanges()` model for code spans, strong emphasis, strikethrough, emphasis, inline/reference links, and autolinks.
- Rewired inactive marker hiding to consume the shared range model instead of rebuilding the same scan sequence locally.
- Rewired Markdown table cell splitting to consume the same range model while still opting into table-only shortcut-reference pipe protection.
- Kept inline math and inline HTML table protection on their existing specialized paths.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 166 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 396 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage refactors pure scanner composition and is covered by unit and full build verification.

Review:

- The shared scanner model remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Marker hiding and table source mapping now share one core range construction path, reducing drift as inline Markdown syntax support grows.
- Table-only shortcut-reference handling remains explicit through scanner options, avoiding broader hard-coded bracket handling in generic marker hiding.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed inline marker mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Closing Heading Marker Soft Hiding

Completed:

- Added inactive-line marker soft hiding for optional ATX heading closing markers such as `## Title ##`.
- Kept the existing heading prefix marker handling in the same block marker collector.
- Required valid line-end closing markers with whitespace separation so literal trailing hashes such as `Heading#`, `#1`, or mid-line hashes remain visible source text.
- Added focused tests for closed headings, trailing whitespace after closing markers, and literal trailing hash non-matches.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 167 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 397 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure marker-range detection and is covered by unit and full build verification.

Review:

- Heading marker detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Closing marker detection stays in the block marker collector with the existing heading prefix logic, keeping block syntax handling centralized.
- Literal trailing hashes remain visible unless they form a valid line-end ATX closing marker, avoiding a broad hard-coded `#` rule.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed block marker mapping remains planned for deeper CommonMark edge cases.

## 2026-06-07 - P2 Task List Marker Soft Hiding

Completed:

- Added inactive-line marker soft hiding for task-list state markers such as `[ ]`, `[x]`, and `[X]`.
- Kept task marker detection inside the existing list block marker branch, so it only applies after a valid bullet or ordered-list prefix.
- Required a following space or line end after the task marker so malformed `- [x]Done` remains visible source text.
- Added focused tests for bullet tasks, ordered tasks, empty task lines, malformed task markers, and ordinary paragraph brackets.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 169 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 399 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure marker-range detection and is covered by unit and full build verification.

Review:

- Task list marker detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The block marker collector continues to own list syntax, keeping task-state handling near the list prefix rule instead of scattering it across UI code.
- Ordinary paragraph brackets and malformed task markers stay visible, avoiding a broad hard-coded bracket rule.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Task list states remained source-backed soft markers until the later checkbox preview stage.

## 2026-06-07 - P2 Task List Checkbox Preview

Completed:

- Rendered inactive task-list state markers as compact source-backed checkbox widgets.
- Added click-to-toggle behavior that replaces only the parsed `[ ]`, `[x]`, or `[X]` marker source with `[x]` or `[ ]`.
- Kept active lines as editable Markdown source so the writer can still edit the raw task marker directly.
- Added a public task-marker range reader with checked state for focused testing and future task-list behavior.
- Added JSDOM coverage proving an inactive task checkbox renders and toggles the backing Markdown text.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 173 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 403 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: reloaded the local app, verified the editor mounted, no console errors were reported, and the current document contained no task markers to render.

Review:

- Task checkbox rendering remains isolated in `packages/editor`; no Workbench, platform, Electron, storage, or filesystem dependency was added.
- The widget consumes scanner-owned task marker ranges and dispatches a bounded text edit, keeping Markdown source as the single source of truth.
- Marker hiding filters out task ranges when the checkbox widget is active, preventing overlapping soft markers and replacement widgets.
- The generic syntax marker normalizer now strips scanner-specific metadata from public marker ranges, avoiding accidental state leakage.
- No new dependency, configuration value, storage path, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Task checkbox interaction was mouse/click oriented until the later focused-keyboard toggle stage.

## 2026-06-07 - P2 Task Checkbox Keyboard Toggle

Completed:

- Added focused-keyboard toggling for inactive task checkbox widgets.
- Supported `Space` and `Enter` on the focused checkbox, dispatching the same bounded Markdown marker edit as mouse clicks.
- Prevented the browser's default checkbox key behavior from racing the source-backed editor update.
- Added JSDOM coverage proving a focused checked task checkbox can toggle back to `[ ]` through `Enter`.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 174 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 404 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes the same widget event path already covered by JSDOM interaction tests and full build verification.

Review:

- Keyboard task toggling remains isolated in `packages/editor`; no Workbench command, platform keybinding, Electron, storage, or filesystem dependency was added.
- The widget owns only focused `Space`/`Enter` handling, preserving the broader Workbench keybinding architecture for app-level commands.
- The source-backed edit path is shared with mouse toggling, so task marker state remains a Markdown text concern.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Cursor-line task toggling remained future work until the later editor-local `Mod-Enter` stage.

## 2026-06-07 - P2 Cursor Task Line Toggle

Completed:

- Added an editor-local `Mod-Enter` key binding that toggles the task marker on the current cursor line.
- Added a reusable `findMarkdownTaskListMarkerRange()` helper for source-backed task behavior independent of inactive-line rendering.
- Added `toggleMarkdownTaskListLineAtSelection()` so the task-line edit path is testable without React or Workbench.
- Preserved the existing behavior that non-task lines do not consume the shortcut.
- Added focused JSDOM coverage for toggling unchecked and checked task lines from the cursor and ignoring ordinary paragraph brackets.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 177 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 407 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes editor-local keymap behavior covered by JSDOM interaction tests and full build verification.

Review:

- Cursor task toggling remains isolated in `packages/editor`; no Workbench command, platform keybinding, Electron, storage, or filesystem dependency was added.
- `Mod-Enter` is registered inside the editor keymap, preserving the platform keybinding service for application-level commands.
- The edit path consumes the same parsed task marker model as inactive checkboxes, keeping Markdown source as the single source of truth.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Multi-cursor batch task toggling remained future work until the later multi-selection task-line stage.

## 2026-06-07 - P2 Table Autolink Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside URI and email autolinks such as `<https://example.com/a|b>` and `<user|name@example.com>`.
- Validated angle-bracket content before protecting it, so invalid text such as `<A|B>` does not change table detection.
- Preserved autolink cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for autolink preview parsing, autolink-only non-table lines, invalid angle text, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 126 tests
- `npm run verify`: passed, 356 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Table autolink range detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Autolink validation avoids a blanket hard-coded rule for every angle-bracket span.
- Preview rendering, source navigation, and pure table transforms still share one scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Table Inline HTML Tag Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside inline HTML tag attributes such as `<span data-value="a|b">`.
- Added generic open/self-closing/closing tag validation instead of a fixed tag-name list or blanket angle-bracket rule.
- Preserved inline HTML tag cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for inline HTML tag preview parsing, tag-only non-table lines, invalid closing tags, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 131 tests
- `npm run verify`: passed, 361 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Inline HTML tag detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The scanner validates tag shape before protecting a range, so arbitrary angle-bracket text does not gain special table behavior.
- Preview rendering, source navigation, and pure table transforms still share one scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax, HTML comments/CDATA, and full document-aware reference resolution.

## 2026-06-07 - P2 Table HTML Comment Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside HTML comments and CDATA sections such as `<!-- a|b -->` and `<![CDATA[x|y]]>`.
- Added a small delimited-inline-HTML range reader driven by open/close marker definitions instead of per-string special cases.
- Kept unclosed comments and CDATA sections unprotected so incomplete syntax does not hide real table separators while editing.
- Preserved comment and CDATA cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for preview parsing, comment/CDATA-only non-table lines, unclosed syntax, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 136 tests
- `npm run verify`: passed, 366 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- HTML comment and CDATA range detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The delimited syntax reader shares the same protected-range path as code spans, math, links, autolinks, and HTML tags, keeping preview rendering, source navigation, and pure table transforms aligned.
- The implementation protects only closed marker ranges and ignores openings inside code spans, avoiding broad angle-bracket hard-coding.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax, processing instructions/declarations, and full document-aware reference resolution.

## 2026-06-07 - P2 Table HTML Declaration Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside HTML processing instructions and declarations such as `<?pi a|b?>` and `<!DOCTYPE html|svg>`.
- Reused the delimited-inline-HTML range reader for processing instructions and added a declaration reader that only accepts `<!` followed by an uppercase ASCII declaration name.
- Kept unclosed processing instructions, unclosed declarations, and invalid lowercase declarations unprotected so incomplete or invalid syntax does not hide real table separators.
- Preserved processing-instruction and declaration cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for preview parsing, processing-instruction/declaration-only non-table lines, unclosed syntax, invalid declarations, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 142 tests
- `npm run verify`: passed, 372 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- HTML processing-instruction and declaration range detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The declaration scanner validates the declaration shape instead of treating every `<!...>` span as protected syntax.
- Preview rendering, source navigation, and pure table transforms still share one protected-range scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Table Strong Emphasis Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside strong emphasis spans such as `**left | right**` and `__alpha | beta__`.
- Added a delimiter-driven strong-emphasis range reader for table protected ranges instead of duplicating individual `**` and `__` branches.
- Kept unclosed strong emphasis unprotected, so incomplete syntax does not hide real table separators while editing.
- Preserved strong-emphasis cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for preview parsing, strong-emphasis-only non-table lines, unclosed syntax, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 147 tests
- `npm run verify`: passed, 377 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Strong-emphasis range detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The scanner reuses a delimiter definition list and skips code spans, avoiding scattered syntax-specific table branches.
- Preview rendering, source navigation, and pure table transforms still share one protected-range scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Table Emphasis Pipe Mapping

Completed:

- Made the shared Markdown table scanner preserve `|` inside ordinary emphasis spans such as `*left | right*` and `_alpha | beta_`.
- Added a delimiter-driven emphasis range reader that ignores code spans and previously detected strong-emphasis ranges.
- Kept unclosed emphasis unprotected, and avoided treating intraword underscores such as `a_b|c_d` as emphasis.
- Preserved emphasis cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for preview parsing, emphasis-only non-table lines, unclosed syntax, intraword underscores, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 153 tests
- `npm run verify`: passed, 383 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure table source mapping and is covered by unit and full build verification.

Review:

- Emphasis range detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The scanner shares the protected-range pipeline with code spans, strong emphasis, math, links, autolinks, and inline HTML syntax.
- Underscore handling avoids a broad hard-coded rule that would hide separators inside ordinary identifier-like words.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Table Strikethrough Pipe Mapping

Completed:

- Added inactive-line marker soft hiding for paired strikethrough delimiters such as `~~done~~`.
- Made the shared Markdown table scanner preserve `|` inside strikethrough spans such as `~~left | right~~`.
- Refactored the strong-emphasis protected-range reader into a reusable paired-delimiter reader and reused it for strikethrough.
- Kept unclosed strikethrough unprotected, so incomplete syntax does not hide real table separators while editing.
- Preserved strikethrough cells through table preview, source-cell navigation, column insertion, and column deletion.
- Added focused tests for marker hiding, preview parsing, strikethrough-only non-table lines, unclosed syntax, source ranges, and column edits.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 159 tests
- `npm run verify`: passed, 389 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure marker/table source mapping and is covered by unit and full build verification.

Review:

- Strikethrough handling remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Paired delimiter handling is now shared by strong emphasis and strikethrough, reducing duplicated scanner mechanics.
- Preview rendering, source navigation, and pure table transforms still share one protected-range scanner path.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Emphasis Marker Soft Hiding

Completed:

- Added inactive-line marker soft hiding for paired ordinary emphasis delimiters such as `*it*` and `_it_`.
- Reworked inline delimiter marker hiding to consume the same range scanners used by table source mapping instead of doing independent raw string searches.
- Skipped inline code spans when hiding emphasis, strong-emphasis, and strikethrough markers.
- Avoided treating intraword underscores such as `a_b_c` as emphasis markers.
- Added focused tests for ordinary emphasis markers, inline-code exclusion, and intraword underscores.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 161 tests
- `npm run verify`: passed, 391 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure marker-range detection and is covered by unit and full build verification.

Review:

- Marker detection remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Marker hiding and table source mapping now share delimiter range scanners, reducing drift between preview styling and table parsing.
- The change avoids broad hard-coded delimiter matching inside code spans or identifier-like words.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed inline marker mapping remains planned for deeper nested emphasis edge cases.

## 2026-06-07 - P2 Inline Math Expression Range Model

Completed:

- Added `expressionFrom` and `expressionTo` to inline math range records so the parser owns the editable TeX source span.
- Trimmed bracket-delimited inline math expression ranges such as `\(  x+y  \)` while preserving the full replacement range.
- Updated inline math preview widgets to consume parsed expression ranges instead of deriving delimiter lengths in UI code.
- Added focused tests for `$...$`, `\(...\)`, trimmed bracket-delimited expressions, repeated ranges, and code-span exclusion.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 120 tests
- `npm run verify`: passed, 350 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes parser-owned source mapping and is covered by unit and full build verification.

Review:

- Inline math source mapping remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- The widget now consumes parser-owned expression ranges, so future delimiter variants do not require UI-specific offset rules.
- The full source range is still retained for decoration replacement and table protected-range behavior.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed math mapping remains planned for deeper inline edge cases.
- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Inline Math Scanner Recovery

Completed:

- Let inline math scanning continue after an unclosed `$` or `\(` delimiter instead of stopping the rest of the inactive line.
- Preserved the existing behavior that an isolated unclosed expression does not render a preview.
- Added focused tests showing later valid `$...$` or `\(...\)` expressions still preview after an earlier incomplete expression.

Quality gate:

- `npm run typecheck`: passed
- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 121 tests
- `npm run verify`: passed, 351 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: not run because this stage changes pure inline math scanner recovery and is covered by unit and full build verification.

Review:

- Inline math recovery remains isolated in `packages/editor`; no Workbench, platform, Electron, DOM, or filesystem dependency was added.
- Recovery happens inside the shared range reader, so inline preview and table protected-range behavior stay aligned.
- The change improves typing resilience without adding UI-specific fallback behavior.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Parser-backed math mapping remains planned for deeper inline edge cases.
- Parser-backed table mapping remains planned for deeper nested inline syntax and full document-aware reference resolution.

## 2026-06-07 - P2 Multi-Selection Task Line Toggle

Completed:

- Enabled CodeMirror multiple selections in the editor base extensions.
- Updated editor-local `Mod-Enter` task toggling to scan every selection range instead of only the main cursor.
- Deduplicated selected task lines before dispatching edits, so multiple cursors on one line do not flip the same marker twice.
- Kept non-task selected lines ignored while still toggling any task lines in the same multi-selection command.
- Added focused JSDOM coverage for multi-line task toggling and same-line selection deduplication.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 179 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 409 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: passed at `http://127.0.0.1:5173`; editor mounted, no console errors, and no horizontal overflow.

Review:

- Multi-selection task toggling remains isolated in `packages/editor`; no Workbench command, platform keybinding, Electron, storage, or filesystem dependency was added.
- The batch edit path still consumes the parsed task marker helper, so Markdown source remains the single source of truth.
- The command dispatches one ordered CodeMirror transaction with bounded marker replacements, avoiding cursor-position drift and duplicate same-line edits.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Range-wide task operations remained future editor work until the later selected task-line range stage.

## 2026-06-07 - P2 Selected Task Line Range Toggle

Completed:

- Updated editor-local `Mod-Enter` task toggling so non-empty selections scan every covered document line.
- Kept cursor-only behavior unchanged for single and multiple cursors.
- Preserved line deduplication across overlapping cursors and selection ranges.
- Avoided toggling a trailing task line when the selection ends exactly at that line's start.
- Added focused JSDOM coverage for range-selected task lines and trailing line-start boundaries.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 181 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 411 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: passed at `http://127.0.0.1:5173`; editor mounted, no console errors, and no horizontal overflow.

Review:

- Selected-range task toggling remains isolated in `packages/editor`; no Workbench command, platform keybinding, Electron, storage, or filesystem dependency was added.
- The range scan feeds the same parsed task marker helper and ordered CodeMirror transaction as cursor toggling, keeping Markdown source as the single source of truth.
- Non-task lines inside the selection are ignored through the parser-owned task marker check rather than a UI-specific bracket rule.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Converting arbitrary selected list items into tasks remained future editor work until the later list-item task conversion stage.

## 2026-06-07 - P2 List Item Task Conversion

Completed:

- Added a reusable Markdown list item content-start scanner for editor source operations.
- Reused that scanner in task marker detection, marker hiding, and editor-local `Mod-Enter` task behavior.
- Updated `Mod-Enter` so ordinary bullet or ordered-list items become unchecked task items by inserting `[ ] ` at the parsed content start.
- Preserved existing task marker toggling for checked and unchecked task lines.
- Added focused tests for list content-start scanning, single-list-item conversion, and mixed range selections containing ordinary list items, existing task items, and non-list text.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 184 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 414 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: passed at `http://127.0.0.1:5173`; editor mounted, no console errors, and no horizontal overflow.

Review:

- List item task conversion remains isolated in `packages/editor`; no Workbench command, platform keybinding, Electron, storage, or filesystem dependency was added.
- The command consumes scanner-owned list content positions instead of duplicating UI-side list prefix parsing.
- Existing task toggling and new task insertion both dispatch bounded CodeMirror text edits, keeping Markdown source as the single source of truth.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Task marker removal remained future editor work until the later selected task marker removal stage.

## 2026-06-07 - P2 Selected Task Marker Removal

Completed:

- Added an editor-local `Mod-Shift-Enter` key binding for returning task items to ordinary list items.
- Added `removeMarkdownTaskListMarkersAtSelection()` so marker removal is testable without React or Workbench.
- Reused the existing selection line enumeration and parsed task marker range helper for single cursor, multi-cursor, and range selections.
- Removed task markers plus trailing marker padding while preserving the list prefix and content text.
- Added focused JSDOM coverage for single-line removal, range removal, duplicate same-line selections, padding normalization, and non-task selections.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts`: passed, 189 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 419 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: passed at `http://127.0.0.1:5173`; editor mounted, no console errors, and no horizontal overflow.

Review:

- Task marker removal remains isolated in `packages/editor`; no Workbench command, platform keybinding, Electron, storage, or filesystem dependency was added.
- The removal command consumes scanner-owned task marker ranges rather than using UI-side bracket matching.
- The edit path dispatches one ordered CodeMirror transaction with bounded marker deletions, keeping Markdown source as the single source of truth.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Task shortcuts remained editor-local until the later Workbench editor task command stage exposed command palette entries through `MarkdownEditorHandle`.

## 2026-06-07 - P2 Workbench Editor Task Commands

Completed:

- Added `MarkdownEditorHandle` methods for toggling list/task lines and removing task markers.
- Registered Workbench command handlers for `editor.task.toggleLines` and `editor.task.removeMarkers`.
- Added shared command metadata so command palette and Settings command surfaces can discover the editor task actions.
- Kept default `Mod-Enter` and `Mod-Shift-Enter` handling editor-local to avoid duplicate global and CodeMirror dispatch.
- Added Workbench contribution coverage for the task command metadata.

Quality gate:

- `npx vitest run packages/editor/src/livePreview.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 198 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 420 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Browser smoke check: passed at `http://127.0.0.1:5173`; editor mounted, command palette showed `Toggle Task Lines` and `Remove Task Markers`, no console errors, and no horizontal overflow.

Review:

- Workbench consumes `MarkdownEditorHandle`; it does not parse Markdown or calculate marker ranges.
- Command metadata is centralized in Workbench contributions, while executable handlers remain in `Application.tsx`, matching the existing command metadata/handler split.
- No global keybinding was added for these editor actions, preserving CodeMirror ownership of focused editor shortcuts until keybinding context rules can prevent duplicate dispatch.
- No new dependency, configuration value, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- The task commands are command-palette discoverable but do not yet show shortcut labels because their default shortcuts remain editor-local.

## 2026-06-11 - P2 Quick Open Result Model

Completed:

- Added a focused Workbench Quick Open model for file filtering, ranking, stable tie sorting, and result limiting.
- Replaced the previous `Application.tsx` inline Quick Open scoring and hard-coded result window with the shared model.
- Added `workspace.quickOpenMaxResults` to platform configuration with bounds, defaults, persistence, validation, and a Settings control.
- Added focused coverage for Quick Open ranking, result limits, Settings search/constraints, and configuration validation.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchQuickOpenModel.test.ts packages/workbench/src/settingsModel.test.ts packages/platform/src/platform.test.ts`: passed, 107 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 424 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Quick Open matching remains Workbench-local and consumes platform `FileTreeEntry` data without touching filesystem, Electron, or index internals.
- Result limits now come from platform configuration and Settings constraints instead of a React-local literal.
- The shell component keeps only local overlay state and delegates filtering to a testable model.
- No new dependency, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Quick Open still uses a lightweight scorer rather than a workspace symbol/search index; that remains appropriate until larger workspace ranking requirements appear.

## 2026-06-11 - P2 Workbench Search Results Model

Completed:

- Added a focused Workbench search results model for local document search, workspace-result detection, search result keys, backlink previews, and tag/backlink keys.
- Removed search result formatting and local document search helpers from `Application.tsx`.
- Reused `workspace.searchMaxResults` for local document search, so the Settings search result limit now affects both current-note and workspace search paths.
- Added focused tests for case-insensitive local search, configured result limits, workspace result detection, backlink fallback previews, and stable keys.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSearchResultsModel.test.ts`: passed, 6 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 430 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Search matching and formatting remain Workbench-local and consume platform result contracts without reading files, parsing backlinks in UI components, or depending on Electron.
- The previous local search hard-coded result limit was removed; the model consumes the platform configuration value already used by workspace search.
- `Application.tsx` keeps shell coordination and rendering while the pure result model owns testable matching and key behavior.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Local document search is still simple line matching; deeper parser-backed search can be introduced later behind the same model boundary if needed.

## 2026-06-11 - P2 Workbench File Opening Coordinator

Completed:

- Added a focused Workbench file-opening helper for ordinary open flows.
- Centralized the repeated save-conflict clearing, `ITextFileService.openFile()`, and recent-file tracking sequence.
- Reused the helper from workspace first-file open, recent workspace first-file open, file tree open, Quick Open, workspace search results, backlinks, and tagged resource opens.
- Added focused tests for side-effect order, returned models, and operation without a conflict callback.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchFileOpening.test.ts`: passed, 2 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 432 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- The helper remains Workbench-local and consumes platform service contracts rather than reaching into Electron, storage, or filesystem code.
- Save, save-as, overwrite, and save-conflict reload flows remain outside the helper because they have save-specific or conflict-dialog-specific semantics.
- UI follow-up such as scrolling to indexed lines and closing Quick Open remains in `Application.tsx`.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Workspace opening orchestration still lives in `Application.tsx`; a later stage can move workspace state/recent workspace coordination into its own focused helper.

## 2026-06-11 - P2 Workbench Workspace Opening Coordinator

Completed:

- Added a focused Workbench workspace-opening helper for selected workspace open, trusted recent workspace reopen, workspace refresh, and file-tree-to-workspace-state mapping.
- Centralized workspace state updates, recent workspace recording, and first-file opening through the existing file-opening helper.
- Kept UI-specific follow-up such as opening the Files side view in `Application.tsx` via callbacks.
- Added focused tests for workspace state mapping, selected workspace open ordering, canceled workspace selection, trusted recent workspace reopen, and refresh behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchWorkspaceOpening.test.ts packages/workbench/src/workbenchFileOpening.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 437 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workspace opening remains Workbench-local and consumes platform `IFileService`, `IWorkspaceService`, `IRecentService`, and `ITextFileService` contracts without reaching into Electron or storage.
- Refresh only updates workspace state; it does not record recent workspaces or open files.
- Selected and trusted recent workspace opens record recent workspaces and reuse the same ordinary file-open helper for the first file, reducing drift between entry points.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Save-related workspace index refresh still uses a small adapter in `Application.tsx`; a later stage can fold that into the saved-file indexing helper if it continues to grow.

## 2026-06-11 - P2 Saved File Workspace Update Coordinator

Completed:

- Moved the save/save-as index refresh plus refreshed workspace state update adapter out of `Application.tsx` and into `savedFileIndexing.ts`.
- Kept existing saved-file indexing behavior: index listed saved files directly, refresh once for newly saved files, and update workspace state only when a refreshed tree is returned.
- Added focused tests for existing-file saves that do not update workspace state and save-as flows that refresh and synchronize workspace state.

Quality gate:

- `npx vitest run packages/workbench/src/savedFileIndexing.test.ts packages/workbench/src/workbenchWorkspaceOpening.test.ts`: passed, 9 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 439 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Saved-file indexing remains Workbench-local and consumes platform `IFileService`, `IIndexService`, and `IWorkspaceService` contracts.
- `Application.tsx` now coordinates save commands and conflict dialogs, while the helper owns the index/workspace synchronization detail.
- The helper reuses the same `workspaceStateFromFiles()` mapping as workspace opening, avoiding duplicate workspace-state construction.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Save-conflict reload still records recent files directly in `Application.tsx` because it is tied to the conflict dialog lifecycle.

## 2026-06-11 - P2 Workbench Action Runner

Completed:

- Moved Workbench async action execution and command dispatch error handling out of `Application.tsx`.
- Added a focused action runner that clears stale operation errors, maps save conflicts into save-conflict state, preserves regular error messages, and falls back to a generic operation error for non-Error failures.
- Kept existing command execution call sites stable while making the error boundary directly testable.
- Added focused tests for successful actions, regular errors, non-Error failures, save conflicts, and command dispatch failures.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchActionRunner.test.ts`: passed, 5 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 444 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- The action runner remains Workbench-local and consumes platform command/save-conflict contracts without owning command registration or UI rendering.
- `Application.tsx` keeps action call sites and state setters, while the repeated async error semantics live in one helper.
- Save-conflict dialog content and lifecycle remain in the shell; the helper only classifies the failure and sets state.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Individual command handlers still live in `Application.tsx`; future stages can move larger command groups behind focused coordinators when their behavior grows.

## 2026-06-11 - P2 Workbench Side View Model

Completed:

- Added a focused Workbench side-view model for side-view ids, the default view, toggle behavior, and sidebar titles.
- Replaced `Application.tsx` inline `SideView`, `toggleSideView()`, and `sidebarTitle()` logic with the shared model.
- Updated sidebar command handlers to use functional state updates so rapid command dispatch uses the latest active side view.
- Added focused tests for the default side view, close-on-repeat toggle behavior, view switching, and stable titles.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSideViewModel.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 13 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 448 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Side-view behavior remains Workbench-local and does not introduce platform, storage, or Electron dependencies.
- Activity bar toggled menu state, command handlers, and sidebar labels now consume a shared typed model instead of separate component-local rules.
- The change removes the last sidebar-title switch from `Application.tsx` while preserving UI rendering ownership in the shell.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Menu icon rendering still lives in `Application.tsx`; it remains tied to React icons and can be revisited if contributed icon handling grows.

## 2026-06-11 - P2 Workbench Menu Model

Completed:

- Added a focused Workbench menu model for command title fallback, menu item title resolution, menu context construction, and toggled active-state checks.
- Removed menu title/context/active helpers from `Application.tsx`.
- Kept React icon rendering in the shell because it depends on lucide components and theme state.
- Added focused tests for title fallback, contributed menu titles, context values, and toggled active-state behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchMenuModel.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 13 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 452 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Menu behavior remains Workbench-local and consumes platform `CommandMetadata`, `MenuItem`, and configuration contracts without introducing platform or storage dependencies.
- Titlebar and activitybar now share one tested menu context/active-state model instead of duplicating assumptions in JSX.
- The shell still owns rendering and icon mapping; the model owns only pure contribution interpretation.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Icon id to React icon mapping remains in `Application.tsx`; if extension-contributed icons expand beyond current ids, that should become its own constrained rendering adapter.

## 2026-06-11 - P2 Workbench Recent Resources Model

Completed:

- Added a focused Workbench recent resources model for recent file/workspace grouping, per-section limits, row keys, active-state checks, file type narrowing, and recent-file-to-file-tree-entry mapping.
- Removed recent resource filtering, row key construction, active checks, file entry mapping, and the inline section limit from `Application.tsx`.
- Kept sidebar rendering and click dispatch in the shell because those still depend on React icons and Workbench callbacks.
- Added focused tests for grouping order, limit normalization, row metadata, active-state checks, type narrowing, and file-entry mapping.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchRecentResourcesModel.test.ts packages/workbench/src/workbenchMenuModel.test.ts packages/workbench/src/workbenchSideViewModel.test.ts`: passed, 12 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 456 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Recent resource behavior remains Workbench-local and consumes platform `RecentResource` and `FileTreeEntry` contracts without introducing storage, Electron, or service dependencies.
- Files sidebar history now uses one tested model for section shaping and row identity instead of embedding display policy directly in JSX.
- The per-section display limit is named and normalized in the model boundary, so future Settings or service-backed limits can be wired without changing the renderer.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- The recent section display limit is still a Workbench default rather than a user setting; if users need control over sidebar density, it should move behind platform configuration like Quick Open result limits.

## 2026-06-11 - P2 Workbench File Tree Model

Completed:

- Added a focused Workbench file tree model for flattening nested file trees into renderable rows.
- Moved file tree depth calculation, row keys, active-state checks, dirty indicators, and file-entry narrowing out of `Application.tsx`.
- Replaced recursive file tree rendering state logic with a simple row renderer that still owns React icons and click callbacks.
- Added focused tests for nested preorder rows, depth normalization, active/dirty state, row keys, and file type guards.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchFileTreeModel.test.ts packages/workbench/src/workbenchRecentResourcesModel.test.ts packages/workbench/src/workbenchQuickOpenModel.test.ts`: passed, 12 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 460 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- File tree behavior remains Workbench-local and consumes platform `FileTreeEntry` without introducing storage, Electron, or index dependencies.
- The Files sidebar now consumes one tested row model for tree shape and active/dirty display state instead of deriving those rules while rendering.
- The row model preserves UI ownership in React while making traversal and row identity reusable for future file-tree features such as collapse state or keyboard navigation.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Directory expand/collapse state is still not modeled; the current file tree remains fully expanded until a later navigation stage adds persisted or session-scoped tree state.

## 2026-06-11 - P2 Workbench Tags Model

Completed:

- Added a focused Workbench tags model for tag name normalization, selected-tag fallback, row keys, and active row state.
- Replaced `Application.tsx` tag-selection effect logic with a tested `nextWorkbenchSelectedTag()` helper.
- Replaced inline Tags panel active-state checks with model-generated tag rows.
- Added focused tests for empty tag lists, blank selections, case-insensitive selection preservation, invalid-selection fallback, row metadata, and normalization.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchTagsModel.test.ts packages/workbench/src/workbenchSearchResultsModel.test.ts packages/workbench/src/workbenchFileTreeModel.test.ts`: passed, 16 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 466 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Tag selection behavior remains Workbench-local and consumes platform `WorkspaceIndexedTagSummary` without adding index, storage, or Electron dependencies.
- Case-insensitive matching now lives in one tested model, aligned with the platform index provider's normalized tag lookup instead of being copied into JSX.
- The model preserves the original tag string for React row keys and user-facing labels while using normalized names only for matching policy.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Tagged resource row keys still live with the shared search result helpers because resource rows use indexed source metadata; they can move into a dedicated tag resource model if the Tags panel gains richer grouping or sorting.

## 2026-06-11 - P2 Workbench Context Model

Completed:

- Added a focused Workbench context model for context key names, native capability context values, dynamic Workbench state context values, and the `IContextKeyService` apply boundary.
- Replaced direct context key writes in `Application.tsx` with model-generated state snapshots.
- Replaced direct native capability context key writes in Workbench service creation with model-generated capability snapshots.
- Reused the same context key constants from Workbench menu toggle context and built-in menu `when` contributions.
- Added focused tests for capability values, active resource scheme, editor modes, side view state, workspace-open state, and context service application order.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchContextModel.test.ts packages/workbench/src/workbenchMenuModel.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 17 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 470 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Context key naming and snapshot construction remain Workbench-local while still applying values through platform `IContextKeyService`.
- Built-in menu `when` clauses, toggle contexts, and shell state synchronization now share one context key source, reducing drift between contribution metadata and runtime state.
- Native capability keys remain initialized during service creation; dynamic document/workspace/editor/sidebar keys remain synchronized by the shell as state changes.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Extension-owned context keys remain separate in the platform extension context API; this model only owns built-in Workbench keys.

## 2026-06-11 - P2 Workbench File Saving Coordinator

Completed:

- Added a focused Workbench file-saving helper for save, save-as, recent-file recording, and saved-file index/workspace synchronization.
- Replaced duplicated save, save-as, auto-save, and save-conflict overwrite coordination in `Application.tsx`.
- Kept UI-specific save-conflict clearing in the shell while moving service orchestration behind a reusable helper.
- Added focused tests for regular saves, auto-save without recent tracking, overwrite options, save-as success, save-as cancellation, untitled recent suppression, and save-as workspace refresh.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchFileSaving.test.ts packages/workbench/src/savedFileIndexing.test.ts packages/workbench/src/workbenchFileOpening.test.ts`: passed, 13 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 477 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Save coordination remains Workbench-local and consumes platform `ITextFileService`, `IRecentService`, saved-file indexing, and workspace update contracts without introducing new storage or Electron access.
- Auto-save, command save, save-as, and conflict overwrite now share one tested post-save path, reducing drift in recent tracking and index refresh behavior.
- The helper keeps recent tracking configurable so auto-save does not pollute recent files while explicit saves still do.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Save-conflict reload still uses the existing file-opening flow directly from the conflict dialog; a later conflict-specific coordinator can own both reload and overwrite UI callbacks if that dialog grows.

## 2026-06-11 - P2 Workbench Save Conflict Resolution

Completed:

- Added a focused Workbench save-conflict resolution helper for reload and overwrite actions.
- Replaced direct conflict-dialog service orchestration in `Application.tsx` with helper calls.
- Reused the existing file-opening helper for reload and the file-saving helper for overwrite.
- Preserved shell ownership of dialog visibility by clearing save conflict state only after successful reload or overwrite.
- Added focused tests for reload success, reload failure, overwrite success, overwrite failure, recent tracking, indexing, and clear-callback ordering.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSaveConflictResolution.test.ts packages/workbench/src/workbenchFileSaving.test.ts packages/workbench/src/workbenchFileOpening.test.ts`: passed, 13 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 481 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Save-conflict action behavior remains Workbench-local and consumes platform file, recent, index, and workspace contracts through existing helpers.
- The dialog now delegates reload/overwrite orchestration instead of duplicating service calls inline.
- Failure paths keep the conflict dialog state intact so users can retry or choose another resolution.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Conflict detection and conflict error classification still belong to the platform text-file/file-service layer and the shared Workbench action runner; this helper only owns user-selected resolution actions.

## 2026-06-11 - P2 Workbench Navigation Queries

Completed:

- Added a focused Workbench navigation query helper for search results, backlinks, tags, and tagged resources.
- Moved local-document-versus-workspace search selection out of `Application.tsx`.
- Moved workspace/file-resource guards for backlinks, tags, and tagged resources into a tested query boundary.
- Kept UI rendering and result-opening behavior in the shell.
- Added focused tests for local document search, workspace index search, backlink availability, tag availability, and tagged-resource availability.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchNavigationQueries.test.ts packages/workbench/src/workbenchSearchResultsModel.test.ts packages/workbench/src/workbenchTagsModel.test.ts`: passed, 17 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 486 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Navigation query behavior remains Workbench-local and consumes platform `IIndexService`, `TextFileModel`, and `WorkspaceState` contracts without adding storage or Electron dependencies.
- Search now has one tested decision point for falling back to local document search when no workspace index is available.
- Backlinks and tag queries now share tested workspace-open guards instead of embedding availability policy in React memo callbacks.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Query results are still read synchronously from the current in-memory/index service boundary; a future async or remote index provider may need loading/cancellation state in this helper.

## 2026-06-11 - P2 Workbench Theme Application Model

Completed:

- Added a focused Workbench theme application helper for selected-theme lookup, system color-scheme fallback, CSS theme attribute application, and custom token overlay application.
- Replaced inline theme resolution in `Application.tsx` with the helper while keeping `matchMedia` subscription ownership in the shell.
- Preserved behavior for selected themes, selected themes without an explicit color scheme, missing theme ids, and token cleanup when overlays are cleared.
- Added focused tests for base scheme resolution, selected theme application, fallback color schemes, and stale token cleanup.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchThemeApplication.test.ts`: passed, 4 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 490 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Theme application remains Workbench-local and consumes platform configuration plus `IThemeService`; token mutation still delegates to the theme package.
- The shell now reacts to browser media and service changes without owning selected-theme fallback rules.
- Missing or removed theme ids intentionally fall back to the configured base color scheme and clear previous token overlays.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- The browser `matchMedia` subscription still lives in `Application.tsx`; extracting that would require a small DOM-facing hook rather than a pure model.

## 2026-06-11 - P2 Workbench Editor Adapter Model

Completed:

- Added a focused Workbench editor adapter helper for Markdown editor configuration, workspace image resource resolution, and Markdown block/inline renderer adapter creation.
- Replaced inline editor prop assembly in `Application.tsx` with one memoized adapter object.
- Preserved renderer cache invalidation on renderer service changes, Markdown configuration changes, active URI changes, and preview cache-size changes.
- Added focused tests for editor preference mapping, file-only image resolution, active document context in renderer previews, cache-limit handoff, and complete adapter creation.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchEditorAdapter.test.ts packages/workbench/src/markdownRendererPreview.test.ts`: passed, 15 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 494 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Editor adapter behavior remains Workbench-local and consumes public editor/platform contracts without adding Electron, storage, or filesystem dependencies.
- The shell keeps React subscription and memoization ownership, while the adapter owns translation from Workbench services/configuration to editor callbacks.
- The memoized adapter avoids rebuilding editor configuration and renderer callbacks on ordinary content-only rerenders.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Paste-image handling still remains inline beside the `MarkdownEditor` render because it depends on the current attachment service callback and active model URI; it can move behind the adapter if attachment behavior grows.

## 2026-06-11 - P2 Workbench Configuration Sync Model

Completed:

- Added a focused Workbench configuration sync helper for applying persisted preferences to platform services.
- Moved attachment asset-folder, workspace index-limit, and user keybinding override synchronization out of `Application.tsx`.
- Reused the same helper during Workbench service bootstrap so startup and runtime configuration mapping share one path.
- Added focused coverage for the service configuration payloads derived from Workbench configuration.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchConfigurationSync.test.ts`: passed, 1 test
- `npm run typecheck`: passed
- `npm run verify`: passed, 495 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Configuration persistence and validation remain owned by `IConfigurationService`; the helper only applies already-validated values to service boundaries.
- Runtime configuration changes and startup initialization now share the same mapping for attachment, index, and keybinding services.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Service-specific validation still belongs to the platform services; this helper intentionally does not duplicate bounds or sanitization logic from configuration.

## 2026-06-11 - P2 Workbench Auto Save Coordinator

Completed:

- Added a focused Workbench auto-save helper for dirty/file/conflict guards, configured delay scheduling, cleanup, and save execution.
- Replaced inline auto-save timer coordination in `Application.tsx` with the helper while leaving React effect lifecycle ownership in the shell.
- Reused the existing Workbench file-saving helper with recent tracking disabled so auto-save continues to refresh indexes without polluting recent files.
- Added focused tests for scheduling guards, timer cleanup, gated-off behavior, and auto-save execution.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchAutoSave.test.ts packages/workbench/src/workbenchFileSaving.test.ts`: passed, 11 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 499 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Auto-save behavior remains Workbench-local and consumes the existing save coordination and action-runner boundaries.
- The shell now supplies timer lifecycle and current state, while the helper owns auto-save policy and the no-recent save path.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Auto-save still relies on the shell effect dependency list for rescheduling; a future DOM-facing hook could own that if more timer-based editor workflows appear.

## 2026-06-11 - P2 Workbench Line Navigation Coordinator

Completed:

- Added a focused Workbench line-navigation helper for immediate local line scrolling and file-resource line navigation.
- Replaced duplicated search/backlink/tag resource open-and-scroll code in `Application.tsx`.
- Reused the existing file-opening helper so line navigation still clears stale save conflicts and records recent files through the ordinary open path.
- Kept deferred scrolling injectable so tests can verify that scrolling happens only after file opening has completed.
- Added focused tests for local scrolling and deferred resource scrolling order.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchLineNavigation.test.ts packages/workbench/src/workbenchFileOpening.test.ts`: passed, 4 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 501 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Line navigation remains Workbench-local and consumes public URI, text-file, and recent-service contracts.
- Search, backlink, and tag panels now share one resource-open-and-scroll path instead of repeating timer and save-conflict cleanup logic in JSX.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Quick Open still closes itself inline after file opening; that behavior is surface-specific and can stay in the shell unless more open-and-close flows appear.

## 2026-06-11 - P2 Workbench Command Registration Coordinator

Completed:

- Added a focused Workbench command registration helper for built-in executable command handlers.
- Replaced the large inline `Application.tsx` command registration effect with one registration call that receives current configuration, workspace files, editor handles, and shell callbacks.
- Preserved the command metadata/handler split: contribution metadata still lives in Workbench contributions, while executable handlers are registered through `ICommandService`.
- Covered command handler registration/disposal, simple UI commands, export command payloads, configuration toggles, and editor task command delegation.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchCommandRegistration.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 13 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 505 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Command handler behavior remains Workbench-local and consumes existing action-runner, file-saving, workspace-opening, configuration, and editor-handle boundaries.
- `Application.tsx` now owns shell state and lifecycle, not the command-handler catalog.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Quick Open and recent-workspace item actions still stay inline because they are tied to surface-specific close/focus follow-up rather than reusable command handlers.

## 2026-06-11 - P2 Workbench State Subscription Coordinator

Completed:

- Added a focused Workbench state subscription helper for service-to-shell event wiring.
- Replaced eight inline `Application.tsx` service subscription effects with one lifecycle registration that forwards configuration, active model, workspace, recent resources, themes, index status, and Markdown renderer changes.
- Kept configuration runtime synchronization behind the existing configuration sync helper and workspace-file watcher mapping behind the existing workspace-opening model.
- Covered service event forwarding, configuration sync side effects, workspace file-tree mapping, and disposal as one lifecycle unit.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchStateSubscriptions.test.ts packages/workbench/src/workbenchConfigurationSync.test.ts packages/workbench/src/workbenchWorkspaceOpening.test.ts`: passed, 9 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 508 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- State subscription behavior remains Workbench-local and consumes public service events instead of coupling the shell to service internals.
- `Application.tsx` now owns state values and rendering, while the helper owns listener registration and disposal.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Browser `matchMedia` theme synchronization still stays in the shell because it is DOM-facing and depends on the document root.

## 2026-06-11 - P2 Workbench Resource Opening Coordinator

Completed:

- Added a focused Workbench resource-opening helper for file tree selections, Quick Open selections, and trusted recent workspace selections.
- Replaced inline `Application.tsx` file/recent workspace open flows with helper calls that reuse the existing file-opening and workspace-opening coordinators.
- Moved Quick Open close, Files view reveal, and stale save-conflict clearing into explicit shell callbacks owned by the helper.
- Narrowed workspace-opening service contracts so open, trusted recent reopen, and refresh flows declare only the file-service methods they actually consume.
- Covered file resource opening, Quick Open close ordering, recent workspace follow-up ordering, and canceled recent workspace behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchResourceOpening.test.ts packages/workbench/src/workbenchFileOpening.test.ts packages/workbench/src/workbenchWorkspaceOpening.test.ts`: passed, 11 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 512 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Resource opening remains Workbench-local and consumes platform URI, file, recent, text-file, and workspace service contracts without reaching into Electron or storage.
- `Application.tsx` now wires user gestures to resource-opening operations but no longer sequences recent workspace follow-up or Quick Open closing inline.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Save-conflict dialog reload/overwrite callbacks still stay inline because they are dialog-specific and already share the existing file-opening and file-saving coordinators.

## 2026-06-11 - P2 Workbench Keybinding Dispatch Coordinator

Completed:

- Added a focused Workbench keybinding dispatch helper for keydown listener lifecycle, keybinding resolution, default prevention, and command execution.
- Replaced the inline `Application.tsx` window keydown effect with one registration call that receives the target, services, and shell error/conflict callbacks.
- Kept command execution behind the existing Workbench action runner so shortcut-triggered commands still clear stale operation errors and surface save conflicts consistently.
- Covered unmatched keybindings, matched command dispatch, default prevention, and listener disposal.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchKeybindingDispatch.test.ts packages/workbench/src/workbenchActionRunner.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 17 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 515 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Keyboard input handling remains Workbench-local and consumes public keybinding and command service contracts without hard-coded shortcut checks in React.
- `Application.tsx` now owns the browser target and state setters, while the helper owns dispatch policy and listener cleanup.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette still closes itself inline after command execution because that focus/visibility behavior is local to the palette surface.

## 2026-06-11 - P2 Workbench Paste Image Adapter

Completed:

- Moved pasted-image attachment handling behind the Workbench editor adapter.
- Replaced inline `Application.tsx` attachment-service checks and `saveImage()` calls with the adapter-provided `onPasteImage` handler.
- Kept paste handling disabled unless the attachment service is available and the active document uses a file URI.
- Covered paste handler availability, attachment save payloads, Markdown return values, and full editor adapter composition.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchEditorAdapter.test.ts packages/workbench/src/markdownRendererPreview.test.ts`: passed, 16 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 516 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Editor paste behavior now consumes the public attachment service boundary from the same adapter that already owns editor preferences, image resource resolution, and Markdown renderer adapters.
- `Application.tsx` passes editor adapter props without directly reaching into attachment persistence.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Native attachment availability still depends on the platform bridge; browser fallback leaves paste-image saving disabled.

## 2026-06-11 - P2 Workbench Save Conflict Dialog Actions

Completed:

- Added save-conflict dialog action helpers that run reload and overwrite flows through the Workbench action runner.
- Replaced inline `Application.tsx` reload/overwrite dialog orchestration with action helper calls.
- Preserved the existing core reload and overwrite helpers for file opening, saving, recent-file recording, and saved-file indexing.
- Covered successful reload action handling and overwrite failure handling through the action runner.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSaveConflictResolution.test.ts packages/workbench/src/workbenchActionRunner.test.ts packages/workbench/src/workbenchFileSaving.test.ts`: passed, 18 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 518 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Save-conflict dialog actions now reuse the same Workbench action-runner error/conflict mapping as commands, shortcuts, and resource-opening flows.
- `Application.tsx` still owns dialog visibility state, while save-conflict resolution owns service orchestration and action error handling.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette still closes itself inline after command execution because that focus/visibility behavior is local to the palette surface.

## 2026-06-11 - P2 Workbench Workspace Indexing Action

Completed:

- Added a focused Workbench workspace-indexing helper for active workspace reindex actions.
- Replaced inline `Application.tsx` `indexService.indexWorkspace()` orchestration with a helper call.
- Kept no-workspace behavior as a no-op that does not clear stale operation errors.
- Routed workspace indexing failures through the existing Workbench action runner.
- Covered no-workspace, direct indexing, action-runner success, action no-op, and failure mapping paths.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchWorkspaceIndexing.test.ts packages/workbench/src/workbenchActionRunner.test.ts packages/workbench/src/savedFileIndexing.test.ts`: passed, 14 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 523 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workspace reindexing remains Workbench-local and consumes the public index service boundary without putting service orchestration inside React.
- The shell still owns the effect dependency policy, including reindexing after workspace file-size configuration changes.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette still closes itself inline after command execution because that focus/visibility behavior is local to the palette surface.

## 2026-06-11 - P2 Workbench Theme Synchronization

Completed:

- Added a focused Workbench theme synchronization helper for browser media-query lifecycle and document-root theme application.
- Replaced inline `Application.tsx` `matchMedia` listener setup and direct `document.documentElement` theme application with one registration call.
- Kept selected-theme lookup, system color-scheme fallback, and token-overlay writes behind the existing theme application helper.
- Covered initial media application, system theme changes, disposal, and selected theme token overlays.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchThemeSynchronization.test.ts packages/workbench/src/workbenchThemeApplication.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 15 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 525 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Theme synchronization remains Workbench-local and uses injected `matchMedia` and target boundaries for browser-facing lifecycle behavior.
- `Application.tsx` now supplies the browser environment, while the helper owns listener registration, immediate application, and cleanup.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette still closes itself inline after command execution because that focus/visibility behavior is local to the palette surface.

## 2026-06-11 - P2 Workbench Line Navigation Actions

Completed:

- Added line-navigation action helpers that choose immediate local scrolling or resource opening based on the target shape.
- Replaced Sidebar search, backlink, and tag inline `runWorkbenchAction()` wrappers with one line-target action call.
- Preserved ordinary file opening, recent-file recording, save-conflict clearing, deferred scrolling, and operation-error mapping for URI targets.
- Covered local action no-op error behavior, resource action success, and resource open failure mapping.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchLineNavigation.test.ts packages/workbench/src/workbenchFileOpening.test.ts packages/workbench/src/workbenchActionRunner.test.ts`: passed, 12 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 528 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Line navigation remains Workbench-local and consumes public file-opening, recent-file, URI, and action-runner boundaries.
- `Application.tsx` now routes Sidebar line targets to a helper instead of branching on local versus workspace search results.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette still closes itself inline after command execution because that focus/visibility behavior is local to the palette surface.

## 2026-06-11 - P2 Workbench Command Palette Execution

Completed:

- Added a focused Command Palette execution helper that dispatches commands through the Workbench action runner before closing the palette surface.
- Replaced inline `Application.tsx` command-palette execution and close orchestration with the helper call.
- Preserved immediate close-after-dispatch behavior while keeping command failures and save conflicts on the shared Workbench action error path.
- Covered successful command dispatch, close behavior, command failure mapping, and save-conflict forwarding.

Quality gate:

- `npx vitest run packages/workbench/src/commandPaletteModel.test.ts packages/workbench/src/workbenchActionRunner.test.ts`: passed, 11 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 531 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Command Palette execution now shares the same error and save-conflict action boundary as shortcuts, menu actions, resource opening, and dialog actions.
- `Application.tsx` still owns palette visibility state, while command-palette execution owns the execute-and-close interaction policy.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette still keeps its query and active-row state locally because that state is specific to the overlay surface.

## 2026-06-11 - P2 Workbench Resource Opening Actions

Completed:

- Added focused resource-opening action helpers for file tree rows, Quick Open file rows, and recent workspace rows.
- Replaced remaining `Application.tsx` resource-opening `runWorkbenchAction()` wrappers with helper calls.
- Preserved ordinary file opening, recent-file recording, recent-workspace reopening, Files view reveal, Quick Open close, and stale save-conflict clearing behavior.
- Covered action success ordering, regular open-failure mapping, and save-conflict forwarding.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchResourceOpening.test.ts packages/workbench/src/workbenchFileOpening.test.ts packages/workbench/src/workbenchWorkspaceOpening.test.ts packages/workbench/src/workbenchActionRunner.test.ts`: passed, 19 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 534 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Resource-opening actions now share the same Workbench action-runner error and save-conflict boundary as command palette, shortcut dispatch, line navigation, and save-conflict dialog actions.
- `Application.tsx` still supplies shell-only follow-up callbacks such as closing Quick Open and revealing Files, while resource-opening policy owns the service orchestration.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Sidebar and Quick Open still own their local focus and active-row state because those are surface-specific interaction concerns.

## 2026-06-11 - P2 Workbench Menu Item Subscription

Completed:

- Added focused Workbench menu helpers for reading menu items and subscribing to changes for one menu id.
- Replaced direct `Application.tsx` menu-service reads and change filtering inside `useMenuItems()` with the menu helper boundary.
- Preserved titlebar and activitybar menu refresh behavior for contributed, context-filtered menu items.
- Covered initial menu reads, targeted menu refresh, ignored unrelated menu changes, and disposal.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchMenuModel.test.ts`: passed, 6 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 536 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Menu item reads and menu-change lifecycle now share the same focused menu model as title fallback, menu context construction, and toggled active-state checks.
- `Application.tsx` still owns React state for each rendered menu surface, while the menu model owns the service boundary and menu-id filtering policy.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Menu icon rendering remains local to the React shell because icon ids map to concrete React icon components there.

## 2026-06-11 - P2 Workbench Configuration Update Actions

Completed:

- Added a focused Workbench configuration-update helper for applying partial configuration changes.
- Routed Settings dialog updates through the Workbench action runner instead of calling `IConfigurationService.updateValue()` directly from `Application.tsx`.
- Preserved Settings control behavior while clearing stale operation errors before updates and mapping configuration storage failures into the shared operation-error state.
- Covered direct configuration update delegation, successful action handling, and failure mapping.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/workbenchActionRunner.test.ts`: passed, 8 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 539 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Settings updates now share the same operation-error boundary as command palette, keybinding dispatch, resource opening, line navigation, and save-conflict actions.
- `SettingsDialog` remains a controlled UI surface that emits partial configuration objects, while the Workbench configuration-update helper owns service orchestration and error mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Workbench command handlers that toggle configuration still rely on their caller running command execution through the Workbench command action boundary.

## 2026-06-11 - P2 Workbench Initial State Snapshot

Completed:

- Added a focused Workbench initial-state helper that captures startup configuration, active model, workspace, recents, themes, and index status through public service boundaries.
- Replaced scattered `Application.tsx` initial service reads with one cached startup snapshot while preserving first-render initialization semantics.
- Kept later service updates on the existing Workbench state subscription helper.
- Covered startup snapshot contents and single-read behavior for each source service.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchInitialState.test.ts packages/workbench/src/workbenchStateSubscriptions.test.ts`: passed, 4 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 540 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workbench startup state and later state subscriptions now have separate focused lifecycle boundaries instead of mixing initial service reads into the React shell.
- `Application.tsx` still owns React state, while `workbenchInitialState` owns which service snapshots define the initial shell state.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command metadata and keybinding label reads are still passed directly to Command Palette and Settings surfaces.

## 2026-06-11 - P2 Workbench Command Surface

Completed:

- Added a focused Workbench command surface helper that captures command metadata once per render and provides command-title and keybinding lookup callbacks.
- Routed titlebar, activitybar, Command Palette, and Settings command props through the command surface instead of direct `Application.tsx` command/keybinding service reads.
- Preserved command title fallbacks, active shortcut labels, keybinding conflict lookup, and keybinding label formatting behavior.
- Covered command snapshot reads, title fallback, and keybinding service delegation.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchCommandSurface.test.ts packages/workbench/src/workbenchMenuModel.test.ts`: passed, 8 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 542 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Command metadata and keybinding label access now have one Workbench-local surface boundary shared by menu, palette, and Settings UI.
- `Application.tsx` still decides which surfaces are rendered, while `workbenchCommandSurface` owns command metadata and keybinding lookup wiring.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Editor content updates still call the text-file service directly from the editor surface.

## 2026-06-11 - P2 Workbench State Context Application

Completed:

- Added a focused Workbench state-context application helper that maps current shell state into context keys through the context service boundary.
- Replaced direct `Application.tsx` context-key service application with the helper call.
- Preserved active resource scheme, focus mode, typewriter mode, side view, and workspace-open context values.
- Covered state-context application through the service boundary.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchContextModel.test.ts`: passed, 5 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 543 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Context key names, state value derivation, and state application now live together in the Workbench context model instead of splitting service writes across the React shell.
- `Application.tsx` still owns when state changes should be applied, while the context model owns how those values cross into `IContextKeyService`.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Native capability context is still applied during service bootstrap because those capabilities are established before the React shell mounts.

## 2026-06-11 - P2 Workbench Editor Content Adapter

Completed:

- Added a Workbench editor content handler that routes editor text changes through the text-file service boundary.
- Included the content handler in the complete Workbench editor adapter returned to `MarkdownEditor`.
- Replaced the remaining inline `Application.tsx` editor `onChange` service call with the adapter prop.
- Covered content handler delegation and complete adapter wiring.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchEditorAdapter.test.ts`: passed, 6 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 544 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Editor content updates now share the same focused adapter boundary as editor preferences, image resolution, pasted-image handling, and Markdown renderer adapters.
- `Application.tsx` still renders the editor surface, while `workbenchEditorAdapter` owns how editor callbacks cross into platform services.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Window timers for auto-save, deferred line navigation, and overlay focus are still provided directly by the React shell.

## 2026-06-11 - P2 Workbench Capability Context

Completed:

- Added focused Workbench capability helpers that capture native file, attachment, and resource availability through service boundaries.
- Routed service bootstrap capability context application through the helper instead of assembling context values inline.
- Routed Sidebar file-system availability through the same capability snapshot instead of reading the file service directly in `Application.tsx`.
- Covered capability snapshot reads and capability context application through the context service boundary.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchContextModel.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 546 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Capability snapshot creation, capability context values, and context service application now live together in the Workbench context model.
- `Application.tsx` still decides how Sidebar capabilities affect UI affordances, while the context model owns how those capabilities are read and published.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Window timers for auto-save, deferred line navigation, and overlay focus are still provided directly by the React shell.

## 2026-06-11 - P2 Workbench Line Navigation Environment

Completed:

- Added a focused line-navigation environment and callback factory that adapts deferred scrolling and mounted editor handles outside the React shell.
- Routed `Application.tsx` search, backlink, tag, and outline line navigation through the shared factory instead of inline deferred-scroll callbacks.
- Named the deferred line-scroll delay in the Workbench line-navigation model so the behavior is explicit and centralized.
- Covered timer scheduling, editor-handle delegation, missing-editor tolerance, and existing resource line-navigation behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchLineNavigation.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 548 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Line navigation now owns both the resource-opening workflow and the shell callback adaptation needed to scroll after a newly opened model mounts.
- `Application.tsx` still supplies the concrete browser timer and editor handle source, while the Workbench line-navigation model owns how those values become navigation callbacks.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Window timers for auto-save and overlay focus are still provided directly by the React shell.

## 2026-06-11 - P2 Workbench Auto-Save Scheduler Environment

Completed:

- Added a focused auto-save scheduler factory that adapts typed timer handles into the existing auto-save scheduling boundary.
- Routed `Application.tsx` auto-save scheduling through the factory instead of constructing `window.setTimeout` and `window.clearTimeout` callbacks inline.
- Preserved auto-save gating, configured delay handling, cleanup behavior, and recent-file suppression.
- Covered timer-handle forwarding alongside the existing auto-save scheduling and save execution tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchAutoSave.test.ts`: passed, 5 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 549 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Auto-save now owns both the save workflow and the shell timer adaptation needed to schedule and cancel delayed saves.
- `Application.tsx` still supplies the concrete browser timer, while the Workbench auto-save model owns how that timer becomes a scheduler.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Overlay focus timers in Command Palette and Quick Open are still provided directly by the React shell.

## 2026-06-11 - P2 Workbench Overlay Focus Environment

Completed:

- Added a focused overlay-focus helper that schedules delayed input focus through an injected timer boundary.
- Routed Command Palette and Quick Open input focus through the shared helper instead of inline `window.setTimeout` calls.
- Added cleanup for pending focus work when an overlay closes or unmounts before the scheduled focus callback runs.
- Covered shared delay scheduling, missing-target tolerance, and timer cleanup behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchOverlayFocus.test.ts`: passed, 3 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 552 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Command Palette and Quick Open now share the same Workbench-local focus scheduling boundary, reducing duplicated overlay browser behavior in `Application.tsx`.
- `Application.tsx` still supplies the concrete browser timer and input refs, while `workbenchOverlayFocus` owns scheduling, target lookup, and cancellation semantics.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Theme synchronization still adapts `window.matchMedia` and `document.documentElement` from the React shell.

## 2026-06-11 - P2 Workbench Theme Environment

Completed:

- Added a focused theme synchronization environment factory that adapts browser `matchMedia` and document root boundaries.
- Routed `Application.tsx` theme synchronization through the factory instead of assembling `matchMedia` and `document.documentElement` inline.
- Added a document availability guard alongside the existing browser availability guard for non-DOM render environments.
- Covered browser media-query forwarding and document-root target selection while preserving existing theme synchronization behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchThemeSynchronization.test.ts`: passed, 3 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 553 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Theme synchronization now owns environment creation, media-query listener lifecycle, and document-root application as one Workbench-local boundary.
- `Application.tsx` still supplies concrete browser globals at effect registration time, while `workbenchThemeSynchronization` owns how those globals become a theme environment.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- `Application.tsx` still coordinates effect timing for browser-backed helpers such as keybinding dispatch, auto-save, line navigation, overlay focus, and theme synchronization.

## 2026-06-11 - P2 Workbench Keybinding Dispatch Target

Completed:

- Added a focused keybinding dispatch target factory that adapts browser `keydown` targets into the Workbench dispatch boundary.
- Routed `Application.tsx` keybinding listener registration through the factory instead of passing the browser target directly.
- Preserved keybinding resolution, default prevention, command execution, and listener disposal behavior.
- Covered browser target forwarding alongside existing dispatch and registration tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchKeybindingDispatch.test.ts`: passed, 4 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 554 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Keybinding dispatch now owns browser keydown target adaptation together with listener lifecycle and command dispatch semantics.
- `Application.tsx` still supplies the concrete browser target at effect registration time, while `workbenchKeybindingDispatch` owns how it becomes a dispatch target.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- `Application.tsx` still assembles the top-level Workbench effect timing and callback wiring for browser-backed helpers.

## 2026-06-11 - P2 Workbench Command Executor

Completed:

- Added a reusable Workbench command executor factory on the shared action-runner boundary.
- Routed titlebar, activitybar, and sidebar command dispatch in `Application.tsx` through the factory instead of a shell-local wrapper.
- Preserved command service execution, stale operation-error clearing, save-conflict mapping, and generic command failure handling.
- Covered reusable command execution and save-conflict propagation alongside the existing action-runner tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchActionRunner.test.ts`: passed, 6 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 555 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Command execution callbacks now cross into `ICommandService` through the same action-runner factory used by other Workbench command surfaces.
- `Application.tsx` still decides which UI surfaces receive command handlers, while `workbenchActionRunner` owns how command execution maps failures into shell state.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette execution still closes the palette through its own focused command-palette model after dispatching through the shared command action boundary.

## 2026-06-11 - P2 Workbench Resource Opening Callbacks

Completed:

- Added a focused resource-opening callback factory that maps shell state setters to clear-conflict, close-Quick-Open, show-Files, and action-error callbacks.
- Routed `Application.tsx` resource-opening callbacks through the factory instead of assembling follow-up behavior inline.
- Added a named Files side view target in the side-view model and reused it from resource-opening follow-up and command registration.
- Covered callback setter forwarding, Files target selection, side-view constants, resource-opening flows, and command registration behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchResourceOpening.test.ts packages/workbench/src/workbenchSideViewModel.test.ts packages/workbench/src/workbenchCommandRegistration.test.ts`: passed, 17 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 557 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Resource-opening follow-up behavior now has one Workbench-local callback boundary instead of a shell-local object literal.
- `Application.tsx` still supplies state setters, while `workbenchResourceOpening` owns how opening resources clears conflicts, closes Quick Open, and reveals the Files view.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Save-conflict dialog actions still assemble their reload/overwrite callbacks directly in `Application.tsx`.

## 2026-06-11 - P2 Workbench Save Conflict Callbacks

Completed:

- Added a focused save-conflict action callback factory that maps shell setters to clear-conflict, operation-error, and save-conflict callbacks.
- Routed `Application.tsx` Save Conflict dialog close, reload, and overwrite actions through the shared callbacks instead of assembling them inline.
- Preserved reload/overwrite behavior: successful actions clear the dialog, while failed reload or overwrite attempts keep the conflict visible.
- Covered callback setter forwarding alongside existing reload, overwrite, action handling, and failure behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSaveConflictResolution.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 558 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Save Conflict dialog actions now share the same Workbench-local callback boundary as the conflict-resolution workflow.
- `Application.tsx` still decides when the dialog is rendered, while `workbenchSaveConflictResolution` owns how dialog actions clear conflicts and map failures.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette execution still owns its close-after-dispatch follow-up in `commandPaletteModel`.

## 2026-06-11 - P2 Command Palette Execution Callbacks

Completed:

- Added a focused Command Palette execution callback factory that maps shell setters to close-palette, operation-error, and save-conflict callbacks.
- Routed `Application.tsx` Command Palette close and execute wiring through the shared callback object instead of assembling it inline.
- Preserved command execution, close-after-dispatch behavior, command failure handling, and save-conflict forwarding.
- Covered callback setter forwarding alongside existing command filtering, execution, failure, and save-conflict tests.

Quality gate:

- `npx vitest run packages/workbench/src/commandPaletteModel.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 559 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Command Palette execution now owns the shell callback adaptation required to close the palette after dispatching through the shared Workbench command action boundary.
- `Application.tsx` still renders the palette and supplies state setters, while `commandPaletteModel` owns search, execution, close, and error callback semantics.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Settings update callback wiring is still assembled directly in `Application.tsx`.

## 2026-06-11 - P2 Workbench Settings Update Handler

Completed:

- Added a focused Settings update handler factory that adapts `SettingsDialog` partial configuration updates into the shared configuration action boundary.
- Routed `Application.tsx` Settings `onUpdate` wiring through the handler instead of dispatching configuration actions inline.
- Preserved configuration service updates, stale operation-error clearing, and storage failure mapping.
- Covered handler delegation and failure handling alongside the existing configuration update tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchConfigurationUpdates.test.ts`: passed, 4 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 560 tests
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Settings update wiring now crosses into `IConfigurationService` through a Workbench-local handler instead of a shell-local inline callback.
- `Application.tsx` still renders Settings and supplies state setters, while `workbenchConfigurationUpdates` owns update dispatch and operation-error mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Settings close behavior is still a direct shell state update because it has no service or action boundary.

## 2026-06-11 - P2 Quick Open File Open Handler

Completed:

- Added a focused Quick Open file open handler factory that adapts selected file rows into the shared resource-opening action boundary.
- Routed `Application.tsx` Quick Open `onOpen` wiring through the handler instead of dispatching the resource-opening action inline.
- Preserved ordinary file opening, recent-file recording, stale save-conflict clearing, Quick Open close ordering, and operation-error mapping.
- Covered handler delegation and failure handling alongside the existing resource-opening tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchResourceOpening.test.ts`: passed, 9 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 55 files / 561 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Quick Open file selection now reaches `ITextFileService` through a Workbench-local handler and the shared resource-opening action runner instead of a shell-local inline callback.
- `Application.tsx` still renders Quick Open and supplies shell state callbacks, while `workbenchResourceOpening` owns selected-file dispatch, close follow-up, and error/save-conflict mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Quick Open close behavior remains a direct shell state update because it is local overlay state with no service or action boundary.

## 2026-06-11 - P2 Save Conflict Dialog Handler Factory

Completed:

- Added a focused Save Conflict dialog action handler factory that adapts reload and overwrite button actions into the shared conflict-resolution action boundary.
- Routed `Application.tsx` Save Conflict dialog `onReload` and `onOverwrite` wiring through the handler instead of dispatching action helpers inline.
- Preserved reload file opening, recent-file recording, overwrite save/indexing, stale operation-error clearing, conflict clearing after success, and failure mapping.
- Covered handler delegation for reload and overwrite alongside existing save-conflict resolution tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSaveConflictResolution.test.ts`: passed, 8 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 55 files / 562 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Save Conflict dialog button actions now cross into `ITextFileService`, `IRecentService`, and indexing through a Workbench-local handler and the shared action runner instead of shell-local inline dispatch.
- `Application.tsx` still owns dialog visibility and current conflict state, while `workbenchSaveConflictResolution` owns reload/overwrite dispatch and operation-error/save-conflict mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Save Conflict dialog visibility remains shell state because it is the UI representation of the current platform conflict.

## 2026-06-11 - P2 Sidebar Line Target Open Handler

Completed:

- Added a focused Sidebar line target open handler factory that adapts search, backlink, and tagged-resource row selections into the shared line-navigation action boundary.
- Routed `Application.tsx` Sidebar `onOpenSearchResult`, `onOpenBacklink`, and `onOpenTaggedResource` wiring through one handler instead of dispatching line-target actions inline.
- Preserved immediate local line scrolling, resource file opening, recent-file recording, stale save-conflict clearing, deferred line scrolling, and operation-error mapping.
- Covered handler delegation for local and resource line targets alongside the existing line-navigation tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchLineNavigation.test.ts`: passed, 8 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 55 files / 563 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Sidebar search, backlink, and tag resource selections now cross into `ITextFileService` and editor line scrolling through a Workbench-local handler instead of three shell-local inline action callbacks.
- `Application.tsx` still renders the Sidebar and owns selected tag/search state, while `workbenchLineNavigation` owns target dispatch, local-vs-resource branching, and error/save-conflict mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Sidebar close and selected-tag state remain direct shell state because they are local view-selection concerns with no service boundary.

## 2026-06-11 - P2 Sidebar Resource Open Handlers

Completed:

- Added focused file-resource and recent-workspace resource open handler factories that adapt Sidebar selections into the shared resource-opening action boundary.
- Routed `Application.tsx` Sidebar `onOpenFile` and `onOpenRecentWorkspace` wiring through handlers instead of dispatching resource-opening actions inline.
- Preserved file opening, recent-file recording, recent-workspace reopening, Files view reveal, stale save-conflict clearing, and operation-error/save-conflict mapping.
- Covered handler delegation and failure/success behavior alongside the existing resource-opening tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchResourceOpening.test.ts`: passed, 11 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 55 files / 565 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Sidebar file-tree and recent-workspace selections now reach `ITextFileService`, `IRecentService`, and workspace services through Workbench-local handlers instead of shell-local inline action callbacks.
- `Application.tsx` still renders Sidebar and supplies shell state callbacks, while `workbenchResourceOpening` owns selected-resource dispatch, follow-up callbacks, and error/save-conflict mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Sidebar open-workspace and refresh-workspace buttons still execute command ids from the shell command executor because they are command surface entries rather than resource-opening rows.

## 2026-06-11 - P2 Command Palette Execute Handler

Completed:

- Added a focused Command Palette execute handler factory that adapts selected command ids into the existing command-palette execution action boundary.
- Routed `Application.tsx` Command Palette `onExecute` wiring through the handler instead of dispatching command execution inline.
- Preserved command service execution, close-after-dispatch behavior, stale operation-error clearing, generic failure mapping, and save-conflict forwarding.
- Covered handler delegation alongside the existing command palette filtering and execution tests.

Quality gate:

- `npx vitest run packages/workbench/src/commandPaletteModel.test.ts`: passed, 8 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 55 files / 566 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Command Palette command selection now reaches `ICommandService` through a Workbench-local handler and the shared command action runner instead of a shell-local inline execute callback.
- `Application.tsx` still renders Command Palette and supplies shell state callbacks, while `commandPaletteModel` owns search, execute dispatch, close follow-up, and error/save-conflict mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command Palette query and active-row state remain local to the overlay because they are surface interaction state.

## 2026-06-11 - P2 Sidebar Command Handlers

Completed:

- Added a focused Sidebar command model that centralizes Open Workspace and Refresh Workspace command ids.
- Routed `Application.tsx` Sidebar `onOpenWorkspace` and `onRefreshWorkspace` wiring through command handlers instead of hard-coded shell command strings.
- Preserved command executor dispatch, Workbench action-runner behavior, and existing workspace open/refresh command registration.
- Covered Sidebar command handler delegation with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSidebarCommands.test.ts`: passed, 1 test
- `npm run typecheck`: passed
- `npm run verify`: passed, 56 files / 567 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Sidebar command buttons now reach `ICommandService` through the shared command executor and a Workbench-local command handler model instead of shell-local command string literals.
- `Application.tsx` still renders the Sidebar and supplies the shared command executor, while `workbenchSidebarCommands` owns the Sidebar-specific command id mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Sidebar close, selected tag, and search query remain direct shell state because they are local view interaction state.

## 2026-06-11 - P2 Workspace Indexing Handler

Completed:

- Added a focused workspace indexing handler factory that adapts workspace file snapshots into the shared indexing action boundary.
- Routed `Application.tsx` workspace reindex effect through the handler instead of dispatching the indexing action inline.
- Preserved no-workspace no-op behavior, stale operation-error clearing only for real indexing work, workspace scan dispatch, and failure mapping.
- Covered handler delegation alongside the existing workspace indexing action tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchWorkspaceIndexing.test.ts`: passed, 6 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 56 files / 568 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workspace reindexing now reaches `IIndexService` through a Workbench-local handler and the shared action runner instead of a shell-local inline action call.
- `Application.tsx` still decides when configuration/workspace changes require reindexing, while `workbenchWorkspaceIndexing` owns no-workspace behavior, dispatch, and operation-error/save-conflict mapping.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- The effect trigger still lives in `Application.tsx` because it depends on React's configuration and workspace lifecycle.

## 2026-06-11 - P2 Tag Selection Synchronization

Completed:

- Added a focused tag selection synchronization helper that owns selected-tag fallback and setter dispatch.
- Routed `Application.tsx` tag synchronization effect through the tags model instead of calculating and applying the next selected tag inline.
- Preserved empty-tag clearing, blank-selection fallback, case-insensitive matching, current-casing restoration, and no-op behavior when the selected tag is already current.
- Covered synchronization behavior alongside existing tag normalization and row-state tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchTagsModel.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 56 files / 569 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Sidebar tag selection policy now lives fully in `workbenchTagsModel`, including normalization, invalid-selection fallback, active rows, and selected-tag synchronization.
- `Application.tsx` still owns the selected-tag state value because it drives sidebar rendering and tagged-resource queries, but it no longer duplicates the synchronization policy.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Sidebar close and search query remain direct shell state because they are local view interaction state.

## 2026-06-11 - P2 Workbench Menu Id Constants

Completed:

- Added focused Workbench menu id constants for titlebar primary, activitybar primary, and activitybar secondary contribution points.
- Routed `Application.tsx` menu subscriptions and default Workbench menu contributions through the shared menu ids instead of repeating menu id strings.
- Preserved titlebar and activitybar menu contribution ordering, filtering, toggled state, and command routing.
- Covered stable menu ids alongside existing menu model and contribution tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchMenuModel.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 16 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 56 files / 570 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workbench menu contribution point ids now live in the focused menu model, matching the existing command/keybinding/menu contribution split.
- `Application.tsx` and `workbenchContributions` consume the same ids, reducing shell-local string duplication without changing platform `MenuId` extensibility.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Menu item icon rendering still maps contributed icon ids to local React icons in `Application.tsx`.

## 2026-06-11 - P2 Workbench Menu Icon Model

Completed:

- Added focused Workbench menu icon ids, known-id checks, theme-aware icon resolution, and a thin local React icon renderer.
- Routed `Application.tsx` titlebar and activitybar menu icon rendering through the menu icon model instead of mapping contribution icon ids in the shell.
- Routed default Workbench menu contributions through the shared icon id constants instead of repeating icon strings.
- Covered stable icon ids, default contribution coverage, theme icon resolution, and unknown-icon fallback with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchMenuIcons.test.ts packages/workbench/src/workbenchContributions.test.ts packages/workbench/src/workbenchMenuModel.test.ts`: passed, 21 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 57 files / 575 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Menu icon ids remain renderer-agnostic contribution metadata, while a pure Workbench model owns icon resolution and a separate UI layer owns lucide rendering.
- `Application.tsx` still renders titlebar and activitybar buttons, but it no longer owns contribution icon id policy.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Sidebar, search, Quick Open, and save-conflict icons still live in their local React surfaces because they are not menu contribution metadata.

## 2026-06-11 - P2 Workbench Command Id Model

Completed:

- Added a focused Workbench command id model for built-in file, workbench, editor, task, and theme command ids.
- Routed command registration, default menu contributions, default keybindings, editor task command metadata, and sidebar command dispatch through the shared command ids.
- Preserved command registration order, menu contribution ordering, keybinding defaults, task command metadata, and sidebar command execution behavior.
- Covered stable command ids, uniqueness, contribution references, command registration wiring, contribution order, and sidebar command delegation with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchCommandIds.test.ts packages/workbench/src/workbenchContributions.test.ts packages/workbench/src/workbenchCommandRegistration.test.ts packages/workbench/src/workbenchSidebarCommands.test.ts`: passed, 17 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 58 files / 578 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workbench command ids now have one pure model, matching the existing separation between command metadata, executable handlers, keybindings, menus, and context keys.
- Tests keep the external command id strings stable in one focused place while production call sites consume the shared constants.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Command titles and categories still live near their command metadata/handlers; this is acceptable until repeated title/category policy emerges.

## 2026-06-11 - P2 Workbench Side View Id Model

Completed:

- Added a stable Workbench side view id table for Files, Search, Outline, Backlinks, and Tags.
- Routed Activity Bar toggled context values, Workbench sidebar command targets, and Sidebar render branches through the shared side view ids.
- Preserved the Files side view alias, default Outline side view, side view toggle behavior, sidebar titles, and Activity Bar command behavior.
- Covered stable side view ids and default menu side-view toggle alignment with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchSideViewModel.test.ts packages/workbench/src/workbenchContributions.test.ts packages/workbench/src/workbenchCommandRegistration.test.ts`: passed, 20 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 58 files / 580 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Side view ids now have one model shared by contribution metadata, command registration, and Sidebar rendering.
- The shell still owns which panel component is rendered for the active side view, but it no longer owns the side view id literals.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Sidebar panel composition remains in `Application.tsx` because it is React layout branching, not platform or contribution policy.

## 2026-06-11 - P2 Workbench Command Metadata Model

Completed:

- Added a focused Workbench command metadata model for built-in command titles, categories, task command metadata, and metadata coverage checks.
- Routed Workbench command registration through the shared metadata model so executable handlers no longer repeat command titles and categories inline.
- Moved editor task command metadata out of the default extension contributions module because it is command-surface metadata, not manifest contribution data.
- Covered stable categories, representative command metadata, task command metadata, full command-id coverage, command registration wiring, and contribution command references with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchCommandMetadata.test.ts packages/workbench/src/workbenchCommandIds.test.ts packages/workbench/src/workbenchCommandRegistration.test.ts packages/workbench/src/workbenchContributions.test.ts`: passed, 20 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 59 files / 583 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Built-in Workbench command ids, command metadata, executable handlers, menus, and keybindings now have distinct Workbench-local sources of truth.
- `workbenchContributions.ts` is narrower: it owns the built-in extension manifest, while command-surface metadata lives beside the command id model.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Menu item titles remain in the manifest because those are surface-specific labels and may intentionally differ from command palette titles.

## 2026-06-11 - P2 Settings Id Model

Completed:

- Added stable Settings section ids, entry ids, and the default section id to the focused Settings model.
- Derived Settings section and entry types from the shared id constants instead of maintaining parallel string unions.
- Routed Settings dialog section reset, section visibility, and entry visibility through the shared Settings ids instead of raw id strings.
- Covered stable ids, default section ownership, unique entry ids, and known section assignment with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 22 tests
- `npm run verify`: passed, 59 files / 586 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Settings section and entry ids are now a stable model-level contract consumed by navigation, search, and dialog rendering.
- `SettingsDialog` still owns the React control layout, but it no longer owns the section or entry id literals that decide which settings render.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Settings field composition remains in `SettingsDialog` because it is still a compact Workbench UI surface; a contributed setting schema can be introduced later if the settings surface becomes extension-driven.

## 2026-06-11 - P2 Settings Entry Label Model

Completed:

- Added Settings entry definition and label lookup helpers to the focused Settings model.
- Routed Settings dialog field titles, control labels, and field aria labels through the shared Settings entry metadata.
- Preserved Settings search metadata and visible field behavior while removing duplicate field-title literals from the dialog.
- Covered entry definition and label lookup for every registered Settings entry.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 23 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 59 files / 587 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Settings entry labels now have one model-level source of truth shared by search and rendered controls.
- `SettingsDialog` still owns control layout and option labels, but field titles and matching metadata no longer drift independently.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Theme, density, keybinding toolbar, and select option labels remain local UI copy because they describe control choices or actions rather than Settings entry metadata.

## 2026-06-11 - P2 Settings Option Metadata

Completed:

- Added typed Settings option metadata for appearance color scheme and density controls.
- Routed Settings dialog segmented controls through the shared option arrays instead of inline option literals.
- Kept option values constrained by platform configuration types so Settings cannot advertise unsupported appearance values.
- Covered stable option order, labels, and values with focused Settings model tests.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 24 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 59 files / 588 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Settings field ids, labels, and appearance segmented-control options now share the focused Settings model boundary.
- `SettingsDialog` still owns control layout and runtime theme-option rendering, but it no longer owns the static appearance option tables.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Custom theme choices still come from registered theme metadata at render time, so they remain a runtime list rather than static Settings option metadata.

## 2026-06-11 - P2 Settings Theme Option Model

Completed:

- Added Settings model helpers for custom theme option construction, theme option labels, and selected theme id fallback.
- Routed the Settings custom theme select through the shared theme option helpers instead of inline default-option and label-formatting rules.
- Narrowed the theme option helper contract to the registered theme fields it actually reads.
- Covered default theme option metadata, custom theme option formatting, and selected-theme fallback with focused Settings model tests.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 26 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 59 files / 590 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Static appearance options and runtime custom theme options now share the same Settings model boundary.
- `SettingsDialog` still renders the select element and emits the selected `themeId`, but it no longer owns default theme copy, selected-id validation, or registered-theme label formatting.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Settings still renders each field explicitly in React; a schema-driven form layer remains deferred until more setting types or extension-contributed settings make it worthwhile.

## 2026-06-11 - P2 Settings Navigation Model

Completed:

- Added Settings model helpers for section definition lookup, section title lookup, visible-section fallback, and nearest-section selection.
- Routed Settings dialog search-result active-section fallback through the shared navigation helper.
- Routed Settings dialog scroll synchronization through a pure nearest-section selection helper while leaving DOM measurement in the UI.
- Covered section lookup, active-section fallback, nearest-section selection, and invalid measurement handling with focused Settings model tests.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 29 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 59 files / 593 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Settings navigation policy now lives beside section metadata instead of in `SettingsDialog`.
- `SettingsDialog` still measures DOM positions because that is a rendering concern, but the active-section decision is pure and unit-tested.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Settings section content is still composed directly in React; extracting a schema-driven renderer remains a larger future step.

## 2026-06-11 - P2 Settings Search Visibility Model

Completed:

- Added a Settings visibility state derived from search results, including visible section definitions, visible section ids, visible entry ids, and empty-result state.
- Added focused helpers for Settings section and entry visibility checks.
- Routed Settings dialog navigation rows, empty state, and section/entry render checks through the shared visibility state instead of local sets and filters.
- Covered full-search, partial-search, and no-result visibility behavior with focused Settings model tests.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 30 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 59 files / 594 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Settings search now produces one model-level visibility state consumed by navigation, empty-state, and field rendering.
- `SettingsDialog` still owns the explicit field layout, but it no longer builds local visibility sets or filters section definitions itself.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Settings field composition remains explicit JSX; visibility is centralized without introducing a broad schema renderer.

## 2026-06-11 - P2 Settings Asset Folder Commit Model

Completed:

- Added a Settings model result type for committing Asset Folder drafts.
- Routed Settings dialog Asset Folder blur/Enter handling through the shared commit resolver instead of duplicating normalization and reset behavior inline.
- Preserved empty-input draft reset and non-empty normalized workspace preference updates.
- Covered normalized update and empty-input reset behavior with focused Settings model tests.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 31 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 59 files / 595 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Asset Folder input normalization and commit decision now live with the rest of the Settings model policy.
- `SettingsDialog` still owns input state and update dispatch, but it no longer decides whether a draft should reset or update configuration.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Asset Folder updates are still dispatched by `SettingsDialog`; broader Settings field action extraction remains deferred until multiple field types need shared commit orchestration.

## 2026-06-11 - P2 Settings Numeric Input Model

Completed:

- Added a Settings model helper for resolving raw numeric input through platform-owned constraints.
- Routed Settings dialog number fields through the shared numeric input resolver instead of parsing and clamping inside React.
- Preserved invalid-input no-op behavior while keeping bounded values aligned with configuration validation.
- Covered valid, out-of-range, and invalid numeric input with focused Settings model tests.

Quality gate:

- `npx vitest run packages/workbench/src/settingsModel.test.ts packages/workbench/src/workbenchConfigurationUpdates.test.ts packages/workbench/src/keybindingSettings.test.ts`: passed, 32 tests
- `npm run verify`: passed, 59 files / 596 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Numeric Settings input policy now lives beside Settings metadata and conversion helpers.
- `SettingsDialog` still owns control rendering and update dispatch, but it no longer owns numeric parsing or clamp policy.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Number field updates are still dispatched directly by `SettingsDialog`; a broader typed field action model remains deferred until more Settings inputs share complex commit behavior.

## 2026-06-11 - P2 AI Provider Service Boundary

Completed:

- Added a platform `IAiService` with provider registration, provider metadata listing, text request delegation, and disposable unregister behavior.
- Added normalized AI text request and result contracts for instructions, input, optional context, metadata, cancellation signals, model metadata, and token usage.
- Kept OpenAI, Codex, local model, network, and credential behavior out of the UI and out of hard-coded platform defaults.
- Exported the AI service from the platform package and covered provider delegation, sorting, duplicate rejection, unregister behavior, and validation with focused tests.

Quality gate:

- `npx vitest run packages/platform/src/ai.test.ts`: passed, 5 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 60 files / 601 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- AI integration now has the same provider-backed shape used by export and Markdown renderer services.
- The service does not own API keys, Electron networking, or a concrete model id; those remain future provider concerns.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- No built-in AI provider, UI command, secret storage, or OpenAI/Codex runtime bridge is wired yet.
- Workspace-grounded prompts still need an adapter that selects context through `IIndexService` before calling `IAiService`.

## 2026-06-11 - P2 Remote Sync Provider Service Boundary

Completed:

- Added a platform `IRemoteSyncService` with provider registration, provider metadata listing, plan creation, plan execution delegation, and disposable unregister behavior.
- Added normalized remote sync request, resource, operation, summary, plan, and result contracts for workspace-relative cloud mirroring flows.
- Kept Feishu, OAuth, upload endpoints, network behavior, and credential storage out of UI code and out of platform defaults.
- Exported the remote sync service from the platform package and covered delegation, sorting, duplicate rejection, unregister behavior, path safety, direction validation, and result validation with focused tests.

Quality gate:

- `npx vitest run packages/platform/src/remoteSync.test.ts`: passed, 4 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 61 files / 605 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Remote sync now has the same provider-backed shape used by export, Markdown renderer, and AI services.
- The service validates workspace-relative resource paths and normalized operation summaries before future providers expose plans to Workbench surfaces.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- No built-in Feishu provider, OAuth flow, Electron network bridge, remote state cache, or sync UI is wired yet.
- Conflict resolution is represented in plans/results but not yet connected to Workbench dialogs or local file writes.

## 2026-06-11 - P2 Remote Sync Workspace Resource Model

Completed:

- Added a platform helper that converts trusted `WorkspaceFileTree` values into normalized remote sync resources.
- Kept the workspace root out of sync resources while allowing future providers to opt into directory resources.
- Reused remote sync path normalization so files, folders, and future Workbench surfaces share one workspace-relative path policy.
- Covered file-only resources, optional directory inclusion, root exclusion, metadata mapping, path normalization, and unsafe path rejection with focused tests.

Quality gate:

- `npx vitest run packages/platform/src/remoteSync.test.ts`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 61 files / 608 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workspace-to-sync resource mapping now lives with the remote sync model instead of being left for future UI or Feishu provider code to duplicate.
- The helper preserves local file metadata available from the trusted workspace tree without reading file contents or inventing content hashes.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Remote providers still need their own remote state cache and diff logic before they can create useful sync plans.
- File content hashing remains a future provider or indexing concern because this helper intentionally only maps existing workspace tree metadata.

## 2026-06-11 - P2 Remote Sync Diff Planning Model

Completed:

- Added a platform diff helper that compares local sync resources with provider-supplied remote resource snapshots.
- Generated stable path-sorted create, update, delete, skip, and conflict operations with summary counts.
- Kept destructive delete operations opt-in through `deleteMissing`; missing resources skip by default.
- Kept bidirectional planning conservative by converting changed or uncomparable existing resources into conflicts instead of automatic overwrites.
- Covered push, pull, bidirectional, same-resource, missing-resource, kind-conflict, unknown-state, duplicate-resource, and unsafe-path cases with focused tests.

Quality gate:

- `npx vitest run packages/platform/src/remoteSync.test.ts`: passed, 12 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 61 files / 613 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Remote sync providers can now reuse shared diff policy instead of each provider implementing its own path sorting, summary counts, default deletion behavior, and conflict classification.
- The planner still does not know about Feishu, OAuth, HTTP APIs, or credential storage; providers supply remote snapshots and execute the resulting plan.
- No new dependency, configuration key, storage path, visual token, extra documentation file, or hard-coded platform assumption was introduced.

Known limitations:

- Remote providers still need durable remote state discovery/cache and execution adapters before the diff planner can drive real sync.
- The planner uses `contentHash` when available, otherwise `size + mtime`; richer conflict detection remains a provider or future index/hash concern.

## 2026-06-11 - P2 Remote Sync Operation Target Model

Completed:

- Added explicit `local`, `remote`, `both`, and `none` target classification to every remote sync operation.
- Updated the shared diff planner so push, pull, bidirectional, delete, skip, and conflict operations declare the side they are expected to mutate.
- Required provider-supplied plans and results to include normalized operation targets instead of making future UI or execution adapters infer target side from `localUri` or `remoteId`.
- Covered target normalization, missing-target rejection, and target semantics with focused remote sync tests.

Quality gate:

- `npx vitest run packages/platform/src/remoteSync.test.ts`: passed, 12 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 61 files / 613 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Operation target classification is a platform contract, not a Feishu-specific assumption.
- The planner still defaults skipped operations to `none` and unresolved bidirectional changes to `both`, keeping execution adapters conservative.
- No new dependency, configuration key, storage path, visual token, extra documentation file, provider URL, endpoint, token, or hard-coded credential behavior was introduced.

Known limitations:

- No built-in Feishu provider, OAuth flow, Electron network bridge, remote state cache, or sync UI is wired yet.
- Operation targets classify intended mutation side; actual local file writes, remote uploads, and conflict dialogs still belong to future execution adapters.

## 2026-06-11 - P2 AI And Remote Sync Workbench Service Wiring

Completed:

- Registered `IAiService` and `IRemoteSyncService` during Workbench service bootstrap so future commands, providers, and extension/runtime adapters can resolve them from `ServiceCollection`.
- Exposed the Workbench-owned AI and remote sync service instances through `WorkbenchServices`.
- Added a focused Workbench service construction test that verifies both services are registered and start without built-in providers.
- Updated the architecture notes with the current feasibility split: AI writing assistance should use provider-backed text requests, Codex is better suited to coding-agent workflows, Feishu raw file mirroring is the first sync path, and Feishu Docs bidirectional sync remains a higher-risk document-conversion problem.

Quality gate:

- `npx vitest run packages/workbench/src/services.test.ts`: passed, 1 test
- `npm run typecheck`: passed
- `npm run verify`: passed, 62 files / 614 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Workbench can now resolve both future-facing service boundaries without forcing UI code to know provider internals.
- No OpenAI, Codex, Feishu, OAuth, network bridge, endpoint, token, model id, storage path, or credential behavior was hard-coded.
- The current shape keeps AI and sync integration consistent with existing export and Markdown renderer provider patterns.

Known limitations:

- No built-in AI provider, Feishu provider, AI command UI, sync UI, OAuth flow, secret storage, or Electron network bridge is wired yet.
- Extension/runtime APIs still do not expose AI or remote sync registration surfaces.

## 2026-06-11 - P2 AI And Remote Sync Provider Lifecycle Events

Completed:

- Added `onDidChangeAiProviders` to `IAiService` and `AiService`.
- Added `onDidChangeRemoteSyncProviders` to `IRemoteSyncService` and `RemoteSyncService`.
- Fired provider lifecycle events on successful provider registration and successful unregister disposal.
- Covered event snapshots, duplicate registration rejection, repeated disposal, and listener disposal with focused AI and remote sync tests.
- Updated the maintained architecture notes to record provider lifecycle observability as part of the platform contracts.

Quality gate:

- `npx vitest run packages/platform/src/ai.test.ts packages/platform/src/remoteSync.test.ts`: passed, 19 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 62 files / 616 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Future AI and sync UI can subscribe to provider availability instead of polling or hard-coding provider assumptions.
- Provider lifecycle events stay at the platform service boundary and do not introduce OpenAI, Codex, Feishu, endpoint, model, token, storage, or credential behavior.
- The event shape follows the existing `IMarkdownRendererService` change event pattern.

Known limitations:

- Workbench surfaces do not yet subscribe to these events.
- Extension/runtime APIs still do not expose AI or remote sync provider registration surfaces.

## 2026-06-11 - P2 Workbench Provider Lifecycle Subscriptions

Completed:

- Routed `IAiService.onDidChangeAiProviders` through the centralized Workbench state subscription helper.
- Routed `IRemoteSyncService.onDidChangeRemoteSyncProviders` through the same Workbench state subscription helper.
- Added Workbench-level provider revision state so future AI and sync surfaces can re-render from service state after provider availability changes.
- Covered provider lifecycle callback forwarding and disposal with focused Workbench state subscription tests.
- Updated the maintained architecture notes to distinguish service bootstrap from Workbench provider lifecycle observation.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchStateSubscriptions.test.ts`: passed, 3 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 62 files / 616 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Provider availability is now observable from platform service registration through Workbench state subscriptions.
- The implementation follows the existing Markdown renderer revision pattern instead of adding UI-owned polling or provider-specific state.
- No OpenAI, Codex, Feishu, endpoint, model, token, storage, credential, or provider id was hard-coded.

Known limitations:

- No visible AI or sync UI consumes these revisions yet.
- Extension/runtime APIs still do not expose AI or remote sync provider registration surfaces.

## 2026-06-11 - P2 Provider Availability Context Keys

Completed:

- Added `ai.providerAvailable` and `remoteSync.providerAvailable` Workbench context keys.
- Derived provider availability from `IAiService.getProviders()` and `IRemoteSyncService.getProviders()` instead of fixed provider ids.
- Re-applied Workbench state context when AI or remote sync provider revisions change.
- Covered provider availability context value creation, service-boundary reads, and state-context application with focused context model tests.
- Updated maintained architecture notes to document provider availability as context-key state for future commands and menu contributions.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchContextModel.test.ts`: passed, 8 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 62 files / 617 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Future AI and sync commands can use context-key `when` clauses without inspecting provider internals or hard-coding provider ids.
- The implementation follows the existing VS Code-style split between services, context keys, commands, menus, and UI rendering.
- No OpenAI, Codex, Feishu, endpoint, model, token, storage, credential, or provider id was hard-coded.

Known limitations:

- No visible AI or sync commands consume these context keys yet.
- Extension/runtime APIs still do not expose AI or remote sync provider registration surfaces.

## 2026-06-11 - P2 Default Provider Selection Model

Completed:

- Added a Workbench provider selection model for future AI and remote sync command handlers.
- Selected default providers from registered provider metadata using stable title/id ordering.
- Kept provider selection generic and provider-id agnostic, with no OpenAI, Codex, Feishu, local model, or endpoint special cases.
- Covered sorting, empty provider lists, source-list immutability, and service-boundary reads with focused tests.
- Updated maintained architecture notes to record the default provider selection policy beside provider lifecycle and context-key behavior.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchProviderSelection.test.ts`: passed, 3 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 63 files / 620 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Future command handlers can pick a deterministic provider without each surface duplicating sorting or fallback policy.
- The selection model intentionally works on metadata only; it does not expose provider implementation functions to Workbench UI.
- Visible AI and sync menu entries remain deferred until handlers exist, avoiding no-handler command paths.

Known limitations:

- No command handler consumes this selection model yet.
- User-configured preferred providers are not modeled yet.

## 2026-06-11 - P2 Active Note AI Request Model

Completed:

- Added a Workbench AI request model for building provider-neutral `AiTextRequest` values from the active Markdown note.
- Added a summarize-active-note request helper with stable instruction text and source metadata.
- Preserved provider neutrality by avoiding OpenAI, Codex, model, endpoint, token, or provider-id assumptions in request construction.
- Kept source metadata authoritative by deriving note name, resource scheme, and language id from `TextFileModel`.
- Covered source metadata, supplemental context, signal propagation, metadata override protection, untitled notes, and empty note input with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchAiRequestModel.test.ts`: passed, 2 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 64 files / 622 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Future AI command handlers can now build consistent requests without composing prompts or metadata inside React components.
- The request model stays above the platform service boundary and below UI surfaces, matching existing focused Workbench model patterns.
- Workspace-grounded context remains additive through `AiTextContextItem[]`; selecting related documents through `IIndexService` is still a future adapter step.

Known limitations:

- No AI command handler calls this request model yet.
- Only summarize-active-note request construction is modeled; rewrite, continue, translate, and task extraction remain future actions.

## 2026-06-11 - P2 Summarize Active Note AI Action Runner

Completed:

- Added a Workbench AI action runner for summarize-active-note workflows.
- Composed default AI provider selection, active note lookup, active-note request construction, and `IAiService.requestText()` behind one focused action helper.
- Failed before reading the active model when no AI provider is available, keeping missing-provider behavior explicit for future command error boundaries.
- Preserved provider neutrality by avoiding OpenAI, Codex, model, endpoint, token, or provider-id assumptions in the action runner.
- Covered success, provider selection, active model lookup, context forwarding, metadata forwarding, signal propagation, and no-provider behavior with focused tests.

Quality gate:

- `npx vitest run packages/workbench/src/workbenchAiActions.test.ts`: passed, 2 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 65 files / 624 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Future command handlers can execute a summarize-active-note request without duplicating provider selection or request construction policy.
- The action runner returns the provider response and does not decide UI placement, editor insertion, note mutation, or persistence.
- The implementation stays in Workbench model/action code and does not couple React surfaces to provider internals.

Known limitations:

- The summarize action is not yet registered as a Workbench command or surfaced in menus.
- There is still no built-in AI provider or credential bridge.

## 2026-06-11 - P2 Command Metadata Change Events

Completed:

- Added `onDidChangeCommands` to `ICommandService` and `CommandService`.
- Fired command change events when command metadata is added or removed through explicit metadata registration.
- Fired command change events when command handlers create or remove implicit metadata.
- Kept handler-only registration and disposal quiet when explicit metadata already owns the command surface entry.
- Covered event snapshots, duplicate metadata rejection, repeated disposal, and listener disposal with focused command tests.

Quality gate:

- `npx vitest run packages/platform/src/platform.test.ts -t commands`: passed, 7 tests
- `npm run typecheck`: passed
- `npm run verify`: passed, 65 files / 625 tests, production build completed
- `npm audit --audit-level=moderate`: passed with 0 vulnerabilities
- `git diff --check`: passed with line-ending warnings only
- Dev server smoke check: passed at `http://127.0.0.1:5173`; status 200 and root element present

Review:

- Future dynamic command contributions can refresh command surfaces from service events instead of polling `getCommands()`.
- The event fires only when the visible command metadata snapshot changes, preserving the metadata/handler split.
- This is a platform capability and does not introduce AI, sync, provider, model, endpoint, token, or UI-specific policy.

Known limitations:

- Workbench command surfaces do not yet subscribe to command metadata change events.
- AI and remote sync commands are still not registered as user-visible commands.
