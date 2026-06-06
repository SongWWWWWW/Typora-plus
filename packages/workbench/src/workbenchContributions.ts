import { ContextKeyExpr, type KeybindingRule, type MenuItem } from "@typora-plus/platform";

export const defaultWorkbenchMenuItems: readonly MenuItem[] = [
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
    when: ContextKeyExpr.equals("fileSystem.available", true)
  },
  {
    id: "titlebar.file.save",
    menu: "titlebar.primary",
    command: "file.save",
    title: "Save",
    icon: "save",
    group: "10_file",
    order: 30,
    when: ContextKeyExpr.equals("fileSystem.available", true)
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
    when: ContextKeyExpr.equals("fileSystem.available", true)
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
    when: ContextKeyExpr.equals("fileSystem.available", true)
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
    when: ContextKeyExpr.equals("workspace.open", true)
  },
  {
    id: "activitybar.primary.tags",
    menu: "activitybar.primary",
    command: "workbench.sidebar.tags",
    title: "Tags",
    icon: "hash",
    order: 50,
    toggled: { context: "sideView", value: "tags" },
    when: ContextKeyExpr.equals("workspace.open", true)
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
];

export const defaultWorkbenchKeybindings: readonly KeybindingRule[] = [
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
];
