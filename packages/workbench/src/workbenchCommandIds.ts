export const workbenchCommandIds = {
  file: {
    newUntitled: "file.newUntitled",
    openWorkspace: "file.openWorkspace",
    refreshWorkspace: "file.refreshWorkspace",
    save: "file.save",
    saveAs: "file.saveAs",
    exportHtml: "file.exportHtml"
  },
  workbench: {
    quickOpen: "workbench.quickOpen",
    commandPaletteOpen: "workbench.commandPalette.open",
    settingsOpen: "workbench.settings.open",
    sidebarFiles: "workbench.sidebar.files",
    sidebarSearch: "workbench.sidebar.search",
    sidebarOutline: "workbench.sidebar.outline",
    sidebarBacklinks: "workbench.sidebar.backlinks",
    sidebarTags: "workbench.sidebar.tags"
  },
  editor: {
    focusModeToggle: "editor.focusMode.toggle",
    typewriterModeToggle: "editor.typewriterMode.toggle",
    taskToggleLines: "editor.task.toggleLines",
    taskRemoveMarkers: "editor.task.removeMarkers"
  },
  ai: {
    continueActiveNote: "ai.continueActiveNote",
    extractTasksActiveNote: "ai.extractTasksActiveNote",
    rewriteActiveNote: "ai.rewriteActiveNote",
    summarizeActiveNote: "ai.summarizeActiveNote"
  },
  remoteSync: {
    planWorkspace: "remoteSync.planWorkspace"
  },
  theme: {
    toggle: "theme.toggle"
  }
} as const satisfies Record<string, Record<string, string>>;

type WorkbenchCommandGroups = typeof workbenchCommandIds;

export type WorkbenchCommandId = {
  [Group in keyof WorkbenchCommandGroups]: WorkbenchCommandGroups[Group][keyof WorkbenchCommandGroups[Group]];
}[keyof WorkbenchCommandGroups];

export function getWorkbenchCommandIds(): readonly WorkbenchCommandId[] {
  return Object.values(workbenchCommandIds).flatMap((group) => Object.values(group)) as WorkbenchCommandId[];
}
