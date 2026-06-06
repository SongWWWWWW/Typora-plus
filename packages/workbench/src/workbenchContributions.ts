import {
  parseContextKeyExpression,
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

export const defaultWorkbenchExtensionManifest = {
  id: "typora-plus.workbench",
  displayName: "Typora Plus Workbench",
  contributes: {
    menus: [
      {
        id: "titlebar.file.newUntitled",
        menu: "titlebar.primary",
        command: "file.newUntitled",
        title: "New Note",
        icon: "file-plus",
        group: "10_file",
        order: 10
      },
      {
        id: "titlebar.file.openWorkspace",
        menu: "titlebar.primary",
        command: "file.openWorkspace",
        title: "Open Workspace",
        icon: "folder-open",
        group: "10_file",
        order: 20,
        when: "fileSystem.available"
      },
      {
        id: "titlebar.file.save",
        menu: "titlebar.primary",
        command: "file.save",
        title: "Save",
        icon: "save",
        group: "10_file",
        order: 30,
        when: "fileSystem.available"
      },
      {
        id: "titlebar.file.saveAs",
        menu: "titlebar.primary",
        command: "file.saveAs",
        title: "Save As",
        icon: "file-text",
        group: "10_file",
        order: 40,
        compactHidden: true,
        when: "fileSystem.available"
      },
      {
        id: "titlebar.file.exportHtml",
        menu: "titlebar.primary",
        command: "file.exportHtml",
        title: "Export HTML",
        icon: "file-down",
        group: "10_file",
        order: 50,
        compactHidden: true
      },
      {
        id: "titlebar.editor.focusMode",
        menu: "titlebar.primary",
        command: "editor.focusMode.toggle",
        title: "Focus Mode",
        icon: "target",
        group: "20_editor",
        order: 10,
        compactHidden: true,
        toggled: { context: "editor.focusMode", value: true }
      },
      {
        id: "titlebar.editor.typewriterMode",
        menu: "titlebar.primary",
        command: "editor.typewriterMode.toggle",
        title: "Typewriter Mode",
        icon: "type",
        group: "20_editor",
        order: 20,
        compactHidden: true,
        toggled: { context: "editor.typewriterMode", value: true }
      },
      {
        id: "titlebar.workbench.theme",
        menu: "titlebar.primary",
        command: "theme.toggle",
        title: "Theme",
        icon: "theme",
        group: "30_workbench",
        order: 10,
        compactHidden: true
      },
      {
        id: "titlebar.workbench.commandPalette",
        menu: "titlebar.primary",
        command: "workbench.commandPalette.open",
        title: "Command Palette",
        icon: "command",
        group: "30_workbench",
        order: 20
      },
      {
        id: "activitybar.primary.files",
        menu: "activitybar.primary",
        command: "workbench.sidebar.files",
        title: "Files",
        icon: "file-text",
        order: 10,
        toggled: { context: "sideView", value: "files" },
        when: "fileSystem.available"
      },
      {
        id: "activitybar.primary.search",
        menu: "activitybar.primary",
        command: "workbench.sidebar.search",
        title: "Search",
        icon: "search",
        order: 20,
        toggled: { context: "sideView", value: "search" }
      },
      {
        id: "activitybar.primary.outline",
        menu: "activitybar.primary",
        command: "workbench.sidebar.outline",
        title: "Outline",
        icon: "list-tree",
        order: 30,
        toggled: { context: "sideView", value: "outline" }
      },
      {
        id: "activitybar.primary.backlinks",
        menu: "activitybar.primary",
        command: "workbench.sidebar.backlinks",
        title: "Backlinks",
        icon: "link",
        order: 40,
        toggled: { context: "sideView", value: "backlinks" },
        when: "workspace.open"
      },
      {
        id: "activitybar.primary.tags",
        menu: "activitybar.primary",
        command: "workbench.sidebar.tags",
        title: "Tags",
        icon: "hash",
        order: 50,
        toggled: { context: "sideView", value: "tags" },
        when: "workspace.open"
      },
      {
        id: "activitybar.secondary.settings",
        menu: "activitybar.secondary",
        command: "workbench.settings.open",
        title: "Settings",
        icon: "settings",
        order: 10
      },
      {
        id: "activitybar.secondary.commandPalette",
        menu: "activitybar.secondary",
        command: "workbench.commandPalette.open",
        title: "Command Palette",
        icon: "command",
        order: 20
      }
    ],
    keybindings: [
      {
        command: "workbench.commandPalette.open",
        keybinding: { key: "p", primary: true, shift: true }
      },
      {
        command: "workbench.quickOpen",
        keybinding: { key: "p", primary: true }
      },
      {
        command: "workbench.settings.open",
        keybinding: { key: ",", primary: true }
      },
      {
        command: "file.save",
        keybinding: { key: "s", primary: true }
      },
      {
        command: "file.saveAs",
        keybinding: { key: "s", primary: true, shift: true }
      },
      {
        command: "file.exportHtml",
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
