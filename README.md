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
- Markdown marker hiding for block prefixes, task list state markers, closing heading markers, inline code, inline/reference links and images, autolinks, emphasis, and strikethrough, so ordinary rendered headings, emphasis, links, and similar constructs do not display their Markdown syntax symbols even on the current editor line
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
- platform-level AI service boundary, registered and observed in Workbench, for provider-backed text requests, configuration-backed Responses provider definitions with Electron-owned secret storage through a shared native secret helper, optional provider-level reasoning/verbosity/output-token request controls, request execution, and native request cancellation, Settings provider diagnostics, extension/runtime provider registration and cancellation, active-note request construction, configuration-bounded workspace search context, summarize/rewrite/continue/extract-task command execution with visible copyable response feedback plus explicit append/replace application modes, provider-gated titlebar discovery, observable provider lifecycle changes, provider-availability context keys, and stable default provider selection, keeping future OpenAI, Codex, local-model, or richer workspace-grounded assistants behind registered providers instead of UI-owned integrations
- built-in Mermaid code-fence preview and configuration-backed Status inline badges through the extension-style Markdown renderer path, with Mermaid lazy-loaded into a separate production chunk
- persisted configuration service for appearance, including custom theme selection, editor, including auto-save delay and renderer preview cache size, Markdown status badge vocabulary, and workspace preferences, with platform-owned numeric constraints, stored-value clamping, Electron native storage, and browser fallback
- workspace search and attachment settings are applied to platform services when preferences change
- Settings preferences dialog with setting search and section navigation for appearance, custom theme selection, editor, auto-save delay, renderer preview cache size, AI provider definitions with native secret write/delete controls, saved-provider connection testing, and bounded Responses request controls, remote sync provider profiles with native secret write/delete controls, a Lark raw mirror profile shortcut plus gateway authorization controls, workspace, and searchable keybinding options by command or shortcut label, including modified-only filtering, reset-all cleanup, and numeric controls derived from platform configuration bounds, opened from the activity bar, command palette, or `Ctrl+,`
- configuration-backed English and Simplified Chinese Workbench localization for command, menu, settings, sidebar, statusbar, dialog, AI, remote sync, and editor live-preview labels, with supported locale ids and the default locale centralized in the platform configuration boundary, Workbench message tables keyed by those locale ids, and coverage tests for built-in command/menu/settings localization surfaces
- HTML export resolves workspace-relative images through the platform resource service, writes sibling asset files when the native save bridge is available, and keeps data URL or safe-path fallback behavior for browser export and unresolved resources
- platform-level remote sync service boundary, registered and observed in Workbench, and exposed to extensions/runtime hosts for provider-backed workspace mirroring, observable provider lifecycle changes, provider-availability context keys, stable default provider selection, configuration-backed remote sync provider profiles with bounded native-request base URLs, remote scope ids, metadata, and secret references, a profile-scoped native request helper for relative paths, structured queries, named secret binding, and structured multipart bodies, configured-provider factory and Workbench synchronization boundary for future provider adapters, a provider-neutral raw mirror helper for remote snapshots, manifest-backed planning, delegated execution, post-execution local/remote snapshot refresh, and manifest refresh, workspace resource normalization, stable diff planning and manifest-backed bidirectional last-sync planning with workspace/provider/remote-scope-scoped manifest persistence, Electron-owned native manifest storage, Electron-owned provider-neutral secret write/delete bridge, Electron-owned provider-neutral native request bridge with secret header/JSON-field injection, structured multipart upload validation, and cancellation, Electron-owned provider-neutral workspace resource read/write/delete bridge for bounded base64 file content inside the active trusted workspace, configured provider factories that can receive the bounded workspace resource bridge, a metadata-gated native-request raw mirror factory for configurable file-only list/upload/download/delete HTTP gateways with cursor-paginated file snapshot listing, bounded page-size hints, opt-in delete-missing planning, retry/list/remote-operation progress reporting, explicit non-2xx rejection, raw mirror upload content staging through trusted local reads, raw mirror local file create/update/delete application through stale-write-aware trusted workspace writes, Markdown-linked local asset discovery for workspace-relative images and attachments, SHA-256 local content hashing injected into workspace sync plan requests when the native resource bridge is available, verified execution-result manifest refresh, explicit operation targets, provider plan/result summary consistency checks, dry-run workspace sync plan command/result feedback, explicit eligible-plan execution with provider-neutral progress callbacks, bounded progress history, result operation feedback, conflict-focused previews, execution running/cancel controls, workspace/provider-gated titlebar discovery, execution, cancellation, and conflict reporting so future Feishu Drive raw Markdown/assets mirroring or other cloud integrations stay out of UI code
- Settings validates configured raw mirror metadata before saving remote sync profiles, including required relative gateway paths and optional secret header bindings, so metadata-gated providers do not fail silently after configuration changes.
- configured raw mirror gateways can opt into bounded retry for selected HTTP status codes through non-sensitive metadata, with Settings validation for retry status, retry count, and delay values.
- Settings includes structured raw mirror metadata draft helpers and guided raw mirror profile fields that preserve unknown profile metadata while editing raw mirror route, header, and retry metadata.
- configured raw mirror metadata diagnostics are platform-owned and consumed by Settings, keeping provider registration and profile-edit validation aligned for future cloud adapters.
- manifest refresh can safely bootstrap or update last-sync baselines for no-op raw mirror executions when local and remote skip operations are proven synchronized, preserving cloud remote ids without mutating either side; Workbench allows skip-only plans as explicit baseline refreshes while empty plans and conflicts remain blocked.
- local Lark CLI raw mirror gateway tooling for Feishu/Lark validation, with device-login helper routes, recursive Drive folder listing mapped to workspace-relative file resources, upload/download/delete route handlers, optional shared-secret protection through the existing remote sync secret header path, generated raw mirror profile output, and Settings-side add/check/start/complete authorization controls that call the gateway through the native request bridge, keeping user authorization state in the Lark CLI local profile and provider-specific Drive tokens out of committed configuration.

## Commands

```bash
npm install
npm run dev
npm run check:docs
npm run check:lockfile
npm run check:node
npm run scan:hardcode
npm run typecheck
npm test
npm run test:ai:smoke
npm run test:electron:smoke
npm run test:installed:smoke
npm run test:remote-sync:smoke
npm run lark:gateway
npm run lark:profile
npm run build
npm run verify
npm run verify:stage
```

The dev server runs the renderer at `http://127.0.0.1:5173`.
`npm run test:ai:smoke` runs an explicit local Responses-compatible AI smoke test. It requires one endpoint variable (`TYPORA_PLUS_AI_SMOKE_ENDPOINT_URL`, `CODEX_RESPONSES_URL`, or `CODEX_URL`), one API key variable (`TYPORA_PLUS_AI_SMOKE_API_KEY`, `CODEX_API_KEY`, or `CODEX_KEY`), and one model variable (`TYPORA_PLUS_AI_SMOKE_MODEL` or `CODEX_MODEL`); the CLI preflights endpoint shape, key size, and model length before spawning Vitest, the direct smoke test rejects complete invalid environment values before provider creation, and the values must stay in the environment and must not be committed.
`npm run test:electron:smoke` runs the source-built Electron smoke path for local development. It resolves the real Electron executable from the installed `electron` package, requires `apps/desktop/dist-electron/main.js` from `npm run build -w @typora-plus/desktop`, requires the renderer dev server from `npm run dev`, creates isolated temporary user-data and workspace directories unless `TYPORA_PLUS_ELECTRON_SMOKE_USER_DATA_DIR` or `TYPORA_PLUS_ELECTRON_SMOKE_WORKSPACE_DIR` is supplied, then launches `electron <main.js> --typora-plus-installed-smoke` and reuses the same fixed check/error result validation as the installed smoke runner while explicitly allowing the app-side result to report `packaged: false`. This command is for fast native bridge coverage in the source tree; it is not a replacement for release-artifact testing.
`npm run test:installed:smoke` runs an explicit installed-app smoke launcher. It requires `TYPORA_PLUS_INSTALLED_SMOKE_APP_PATH` to point to an installed executable or app bundle; the runner creates isolated temporary user-data and workspace directories unless `TYPORA_PLUS_INSTALLED_SMOKE_USER_DATA_DIR` or `TYPORA_PLUS_INSTALLED_SMOKE_WORKSPACE_DIR` is supplied, starts the app with `--typora-plus-installed-smoke`, reads a sanitized result JSON file that contains fixed check/error identifiers rather than raw exception messages, requires `packaged: true` plus every installed-smoke check in the fixed release checklist to be present and `true`, fails on any fixed result error id, rejects unknown result error strings without echoing them, and verifies packaged renderer/preload/native bridge availability plus configuration, index snapshot, remote sync manifest, AI secret, remote sync secret, trusted workspace reopen, Markdown file read/write, image resource resolution, and remote sync workspace resource read/write/delete round trips. The Electron app-side smoke mode and the external runner both use required-check validation, and a source-level alignment test keeps the fixed checklists in sync with the Electron harness checks. It is not part of `npm run verify:stage` because it needs a release artifact.
`npm run test:remote-sync:smoke` runs an explicit provider-neutral raw mirror remote sync smoke test. It requires environment-provided provider identity, base URL, workspace URI, and raw mirror list/upload/download/delete paths, with optional secret header binding and optional local resource snapshot JSON supplied entirely through environment variables; the command preflights profile URL/URI/path/direction/page-size/secret/header shape plus local snapshot JSON shape before spawning Vitest, the direct smoke test rejects complete invalid profile values before provider creation, creates a dry-run plan, and must not commit endpoint, token, scope, folder, local path, or gateway path values.
`npm run lark:gateway` starts a loopback Feishu/Lark raw mirror gateway backed by the installed `lark-cli`. The gateway exposes `/auth/login/start`, `/auth/login/complete`, `/auth/status`, and `/mirror/list|upload|download|delete`; the Workbench still sees only the provider-neutral raw mirror HTTP shape. Its default login request asks for the Drive scopes needed to list, upload, download, create folders, and delete mirrored files; `TYPORA_PLUS_LARK_AUTH_SCOPE` can override that scope string for a tenant-specific setup. `npm run lark:profile` prints a configuration profile skeleton for Settings. Runtime values such as the target Drive scope, gateway shared secret, CLI profile, and any user authorization state must be supplied through environment variables or the Lark CLI local profile, not committed.
The shared smoke runner treats spawn errors, synchronous spawn failures, malformed child-process results, and duplicate child-process events as failed or already-settled smoke runs so local gateway checks fail deterministically without leaking configured values.

## Release Smoke Plan

The current desktop build produces the renderer bundle and Electron main/preload output, but it does not yet define an installer or packaged-app script. Release-only functional testing should become a separate gate once packaging is introduced: install or launch the packaged app from an environment-provided path, use a generated temporary workspace, verify native preload capabilities, file open/save/save-as/export, encrypted secret set/delete, workspace index and manifest persistence, AI request/cancel through an environment-provided local Codex or Responses-compatible endpoint, and remote sync planning/execution through an environment-provided raw mirror gateway.

That gate should stay separate from `npm run verify:stage`. The source gate proves architecture, hardcode policy, unit behavior, and production build output; `npm run test:electron:smoke` proves the source-built Electron main, preload bridge, and native IPC path against the current dev renderer; the installed gate proves the built artifact as a user receives it. The installed runner fails fast when no packaged app path is supplied, isolates user data and workspace fixtures by default, avoids repository-local fixture paths, collects only sanitized result JSON, rejects source-built `packaged: false` results, rejects missing or non-true required checks even when the app reports `passed: true`, and should grow through distinct release modes: clean install or first launch, upgrade launch over existing configuration, offline launch with no optional providers, optional AI smoke with local Codex/Responses values, and optional remote sync smoke with a raw mirror gateway.

Feishu/Lark validation should stay behind the same provider-neutral raw mirror boundary. Use Lark CLI authorization and the local gateway, then pass only gateway/profile values through environment variables; do not commit Feishu app ids, folder ids, tenant ids, tokens, local workspace paths, endpoint URLs, model ids, or Codex keys. A later first-class app flow can wrap the same `/auth/*` gateway routes or replace them with an Electron OAuth bridge while keeping persisted secrets in the native user-data store.

## Maintained Docs

- `README.md`: project entry and commands
- `docs/ARCHITECTURE.md`: package boundaries, services, extension direction
- `docs/DEVELOPMENT_LOG.md`: stage reviews and next work

## Quality Gate

Every stage must pass:

- `npm run verify:stage`
- `npm run check:docs`
- `npm run check:lockfile`
- `npm run check:node`
- `npm run scan:hardcode`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `npm audit --audit-level=moderate`

`npm run verify:stage` runs the full stage gate: Node version check, top-level/root identity and workspace package-lock sync plus stale workspace lock-entry check, maintained-docs presence/scope check, sensitive hardcode scan, typecheck, tests, production build, dependency audit, and whitespace check.
`npm run verify` runs the Node version check, top-level/root identity and workspace package-lock sync plus stale workspace lock-entry check, maintained-docs presence/scope check, and sensitive hardcode scan before typecheck, test, and build.
`npm test` includes package architecture boundary tests, Workbench localization coverage tests, and script-level quality-gate/smoke-runner tests, so dependency-direction drift plus docs-scope, scanner, lockfile-checker, missing built-in locale coverage, smoke CLI drift, and smoke child-process lifecycle drift fail with the normal quality gate.
`npm run check:docs` ignores generated output and dependency directories while enforcing the maintained documentation set.
`npm run scan:hardcode` scans application and quality-gate source roots (`apps`, `packages`, and `scripts`) while keeping scanner self-fixtures explicit and detecting full provider endpoint URLs, OpenAI/Google/npm/Stripe/Slack/GitHub/AWS/JWT/opaque Bearer/Basic Auth token-shaped credentials, Azure Storage account keys and SAS tokens, URL-embedded credentials, generic long secret-field literals, PEM private-key headers, case-normalized secret-name literals, provider identifier literals, and model-field defaults.

Do not add user-facing behavior through scattered constants. Defaults belong in configuration, visual values belong in theme tokens, and platform behavior belongs behind services.
Repository text files use LF line endings through `.gitattributes`, with editor defaults captured in `.editorconfig`.

## Git Workflow

- Commit each completed feature or process milestone separately.
- Keep `main` for reviewed stage progress.
- After a main-stage milestone is complete, continue new work on topic branches such as `feature/native-workspace`.
- Submit topic branch work through pull requests, review the changes before merge, and record meaningful stage outcomes in `docs/DEVELOPMENT_LOG.md`.
