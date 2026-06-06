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

## Services

Current services:

- `IConfigurationService`: centralized appearance, editor, workspace defaults
- `ICommandService`: command registration and execution
- `ITextFileService`: active Markdown model, dirty state, save lifecycle
- `IWorkspaceService`: workspace identity
- `IFileService`: native workspace file tree, file open, save, save-as
- `IAttachmentService`: pasted image persistence through a native bridge

Planned services:

- `IIndexService`: SQLite-backed search, links, tags, headings
- `IExportService`: PDF/HTML/DOCX export providers
- `IExtensionService`: manifest, activation events, contribution points

## Editor Model

The editor is backed by CodeMirror 6. The current P1 implementation styles Markdown lines in a live-preview direction while preserving source text as the editable model.

Current features:

- Markdown language support
- history, search, selection, bracket matching
- heading/quote/list/fence line styling
- focus mode dimming
- typewriter mode top spacing
- imperative line scrolling for outline and search

Next editor work:

- block widgets for images, tables, math, and code fences
- syntax hiding for inactive Markdown markers
- viewport-safe large document behavior tests
- parser-backed position mapping

## Extension Direction

Extensions should run out of process once implemented. They should contribute through a manifest:

- commands
- menus
- keybindings
- themes
- Markdown renderers
- export providers

Extensions must not receive direct DOM or unrestricted Node access.

## Stage Review Rules

At the end of every stage:

- run the full quality gate
- review package dependencies for boundary drift
- move repeated visual values into theme tokens
- move repeated behavior defaults into configuration
- reject hard-coded file paths and platform assumptions
- record only meaningful decisions in `docs/DEVELOPMENT_LOG.md`
