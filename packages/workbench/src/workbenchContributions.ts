import {
  parseContextKeyExpression,
  type CommandMetadata,
  type ExtensionManifest,
  type ExtensionMenuContribution,
  type KeybindingRule,
  type MenuItem
} from "@typora-plus/platform";
import {
  workbenchMermaidRendererId,
  workbenchMermaidRendererLanguage
} from "./mermaidMarkdownRenderer";
import {
  workbenchStatusRendererId,
  workbenchStatusRendererLanguage
} from "./statusMarkdownRenderer";
import { workbenchCommandIds } from "./workbenchCommandIds";
import { workbenchContextKeys } from "./workbenchContextModel";
import { workbenchMenuIconIds } from "./workbenchMenuIconModel";
import { workbenchMenuIds } from "./workbenchMenuModel";

export const editorTaskCommandMetadata = {
  removeTaskMarkers: {
    id: workbenchCommandIds.editor.taskRemoveMarkers,
    title: "Remove Task Markers",
    category: "Editor"
  },
  toggleTaskLines: {
    id: workbenchCommandIds.editor.taskToggleLines,
    title: "Toggle Task Lines",
    category: "Editor"
  }
} satisfies Record<string, CommandMetadata>;

export const defaultWorkbenchExtensionManifest = {
  id: "typora-plus.workbench",
  displayName: "Typora Plus Workbench",
  contributes: {
    menus: [
      {
        id: "titlebar.file.newUntitled",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.file.newUntitled,
        title: "New Note",
        icon: workbenchMenuIconIds.filePlus,
        group: "10_file",
        order: 10
      },
      {
        id: "titlebar.file.openWorkspace",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.file.openWorkspace,
        title: "Open Workspace",
        icon: workbenchMenuIconIds.folderOpen,
        group: "10_file",
        order: 20,
        when: workbenchContextKeys.fileSystemAvailable
      },
      {
        id: "titlebar.file.save",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.file.save,
        title: "Save",
        icon: workbenchMenuIconIds.save,
        group: "10_file",
        order: 30,
        when: workbenchContextKeys.fileSystemAvailable
      },
      {
        id: "titlebar.file.saveAs",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.file.saveAs,
        title: "Save As",
        icon: workbenchMenuIconIds.fileText,
        group: "10_file",
        order: 40,
        compactHidden: true,
        when: workbenchContextKeys.fileSystemAvailable
      },
      {
        id: "titlebar.file.exportHtml",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.file.exportHtml,
        title: "Export HTML",
        icon: workbenchMenuIconIds.fileDown,
        group: "10_file",
        order: 50,
        compactHidden: true
      },
      {
        id: "titlebar.editor.focusMode",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.editor.focusModeToggle,
        title: "Focus Mode",
        icon: workbenchMenuIconIds.target,
        group: "20_editor",
        order: 10,
        compactHidden: true,
        toggled: { context: workbenchContextKeys.editorFocusMode, value: true }
      },
      {
        id: "titlebar.editor.typewriterMode",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.editor.typewriterModeToggle,
        title: "Typewriter Mode",
        icon: workbenchMenuIconIds.type,
        group: "20_editor",
        order: 20,
        compactHidden: true,
        toggled: { context: workbenchContextKeys.editorTypewriterMode, value: true }
      },
      {
        id: "titlebar.workbench.theme",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.theme.toggle,
        title: "Theme",
        icon: workbenchMenuIconIds.theme,
        group: "30_workbench",
        order: 10,
        compactHidden: true
      },
      {
        id: "titlebar.workbench.commandPalette",
        menu: workbenchMenuIds.titlebarPrimary,
        command: workbenchCommandIds.workbench.commandPaletteOpen,
        title: "Command Palette",
        icon: workbenchMenuIconIds.command,
        group: "30_workbench",
        order: 20
      },
      {
        id: "activitybar.primary.files",
        menu: workbenchMenuIds.activitybarPrimary,
        command: workbenchCommandIds.workbench.sidebarFiles,
        title: "Files",
        icon: workbenchMenuIconIds.fileText,
        order: 10,
        toggled: { context: workbenchContextKeys.sideView, value: "files" },
        when: workbenchContextKeys.fileSystemAvailable
      },
      {
        id: "activitybar.primary.search",
        menu: workbenchMenuIds.activitybarPrimary,
        command: workbenchCommandIds.workbench.sidebarSearch,
        title: "Search",
        icon: workbenchMenuIconIds.search,
        order: 20,
        toggled: { context: workbenchContextKeys.sideView, value: "search" }
      },
      {
        id: "activitybar.primary.outline",
        menu: workbenchMenuIds.activitybarPrimary,
        command: workbenchCommandIds.workbench.sidebarOutline,
        title: "Outline",
        icon: workbenchMenuIconIds.listTree,
        order: 30,
        toggled: { context: workbenchContextKeys.sideView, value: "outline" }
      },
      {
        id: "activitybar.primary.backlinks",
        menu: workbenchMenuIds.activitybarPrimary,
        command: workbenchCommandIds.workbench.sidebarBacklinks,
        title: "Backlinks",
        icon: workbenchMenuIconIds.link,
        order: 40,
        toggled: { context: workbenchContextKeys.sideView, value: "backlinks" },
        when: workbenchContextKeys.workspaceOpen
      },
      {
        id: "activitybar.primary.tags",
        menu: workbenchMenuIds.activitybarPrimary,
        command: workbenchCommandIds.workbench.sidebarTags,
        title: "Tags",
        icon: workbenchMenuIconIds.hash,
        order: 50,
        toggled: { context: workbenchContextKeys.sideView, value: "tags" },
        when: workbenchContextKeys.workspaceOpen
      },
      {
        id: "activitybar.secondary.settings",
        menu: workbenchMenuIds.activitybarSecondary,
        command: workbenchCommandIds.workbench.settingsOpen,
        title: "Settings",
        icon: workbenchMenuIconIds.settings,
        order: 10
      },
      {
        id: "activitybar.secondary.commandPalette",
        menu: workbenchMenuIds.activitybarSecondary,
        command: workbenchCommandIds.workbench.commandPaletteOpen,
        title: "Command Palette",
        icon: workbenchMenuIconIds.command,
        order: 20
      }
    ],
    keybindings: [
      {
        command: workbenchCommandIds.workbench.commandPaletteOpen,
        keybinding: { key: "p", primary: true, shift: true }
      },
      {
        command: workbenchCommandIds.workbench.quickOpen,
        keybinding: { key: "p", primary: true }
      },
      {
        command: workbenchCommandIds.workbench.settingsOpen,
        keybinding: { key: ",", primary: true }
      },
      {
        command: workbenchCommandIds.file.save,
        keybinding: { key: "s", primary: true }
      },
      {
        command: workbenchCommandIds.file.saveAs,
        keybinding: { key: "s", primary: true, shift: true }
      },
      {
        command: workbenchCommandIds.file.exportHtml,
        keybinding: { key: "e", primary: true, shift: true }
      }
    ],
    markdownRenderers: [
      {
        id: workbenchMermaidRendererId,
        label: "Mermaid",
        kind: "block",
        language: workbenchMermaidRendererLanguage,
        priority: 100
      },
      {
        id: workbenchStatusRendererId,
        label: "Status",
        kind: "inline",
        language: workbenchStatusRendererLanguage,
        priority: 100
      }
    ],
    themes: [
      {
        id: "typora-plus.theme.ink",
        label: "Ink",
        colorScheme: "dark",
        tokens: {
          "--tp-color-canvas": "#151611",
          "--tp-color-surface": "#20231d",
          "--tp-color-surface-muted": "#292e25",
          "--tp-color-surface-raised": "#262a22",
          "--tp-color-border": "#424a3a",
          "--tp-color-border-strong": "#6e7a60",
          "--tp-color-text": "#f1eee3",
          "--tp-color-text-muted": "#beb9a6",
          "--tp-color-text-soft": "#8d927e",
          "--tp-color-accent": "#7cc6a4",
          "--tp-color-accent-strong": "#a5dfc4",
          "--tp-color-code-block": "#1a1d18",
          "--tp-color-code-block-border": "#485240",
          "--tp-color-code-toolbar": "#242a20",
          "--tp-color-table-row": "#1c211b",
          "--tp-color-table-header": "#262d23",
          "--tp-color-table-border": "#4c5944",
          "--tp-color-image-block": "#1b2222",
          "--tp-color-image-block-border": "#445b57",
          "--tp-color-image-preview": "#101716",
          "--tp-color-math-block": "#1b2026",
          "--tp-color-math-block-border": "#465665",
          "--tp-color-math-inline": "#202d31",
          "--tp-color-selection": "#2f5f50",
          "--tp-color-warning": "#e0b65a",
          "--tp-color-danger": "#e1787c",
          "--tp-color-shadow": "rgba(0,0,0,0.36)",
          "--tp-opacity-markdown-marker": "0.32",
          "--tp-opacity-passive-line": "0.44"
        }
      }
    ]
  }
} satisfies ExtensionManifest;

export const defaultWorkbenchMenuItems: readonly MenuItem[] =
  defaultWorkbenchExtensionManifest.contributes.menus.map(toMenuItem);

export const defaultWorkbenchKeybindings: readonly KeybindingRule[] =
  defaultWorkbenchExtensionManifest.contributes.keybindings;

function toMenuItem(item: ExtensionMenuContribution): MenuItem {
  const when = item.when ? parseContextKeyExpression(item.when) : undefined;

  return {
    id: item.id,
    menu: item.menu,
    command: item.command,
    ...(item.group ? { group: item.group } : {}),
    ...(item.order !== undefined ? { order: item.order } : {}),
    ...(item.title ? { title: item.title } : {}),
    ...(item.icon ? { icon: item.icon } : {}),
    ...(item.compactHidden !== undefined ? { compactHidden: item.compactHidden } : {}),
    ...(item.toggled ? { toggled: item.toggled } : {}),
    ...(when ? { when } : {})
  };
}
