import type { CommandMetadata } from "@typora-plus/platform";
import { workbenchCommandIds } from "./workbenchCommandIds";

export const workbenchCommandCategories = {
  file: "File",
  workbench: "Workbench",
  editor: "Editor"
} as const satisfies Record<string, string>;

export const workbenchCommandMetadata = {
  file: {
    newUntitled: {
      id: workbenchCommandIds.file.newUntitled,
      title: "New Note",
      category: workbenchCommandCategories.file
    },
    openWorkspace: {
      id: workbenchCommandIds.file.openWorkspace,
      title: "Open Workspace",
      category: workbenchCommandCategories.file
    },
    refreshWorkspace: {
      id: workbenchCommandIds.file.refreshWorkspace,
      title: "Refresh Workspace",
      category: workbenchCommandCategories.file
    },
    save: {
      id: workbenchCommandIds.file.save,
      title: "Save",
      category: workbenchCommandCategories.file
    },
    saveAs: {
      id: workbenchCommandIds.file.saveAs,
      title: "Save As",
      category: workbenchCommandCategories.file
    },
    exportHtml: {
      id: workbenchCommandIds.file.exportHtml,
      title: "Export HTML",
      category: workbenchCommandCategories.file
    }
  },
  workbench: {
    quickOpen: {
      id: workbenchCommandIds.workbench.quickOpen,
      title: "Quick Open",
      category: workbenchCommandCategories.workbench
    },
    commandPaletteOpen: {
      id: workbenchCommandIds.workbench.commandPaletteOpen,
      title: "Command Palette",
      category: workbenchCommandCategories.workbench
    },
    settingsOpen: {
      id: workbenchCommandIds.workbench.settingsOpen,
      title: "Settings",
      category: workbenchCommandCategories.workbench
    },
    sidebarFiles: {
      id: workbenchCommandIds.workbench.sidebarFiles,
      title: "Show Files",
      category: workbenchCommandCategories.workbench
    },
    sidebarSearch: {
      id: workbenchCommandIds.workbench.sidebarSearch,
      title: "Show Search",
      category: workbenchCommandCategories.workbench
    },
    sidebarOutline: {
      id: workbenchCommandIds.workbench.sidebarOutline,
      title: "Show Outline",
      category: workbenchCommandCategories.workbench
    },
    sidebarBacklinks: {
      id: workbenchCommandIds.workbench.sidebarBacklinks,
      title: "Show Backlinks",
      category: workbenchCommandCategories.workbench
    },
    sidebarTags: {
      id: workbenchCommandIds.workbench.sidebarTags,
      title: "Show Tags",
      category: workbenchCommandCategories.workbench
    }
  },
  editor: {
    focusModeToggle: {
      id: workbenchCommandIds.editor.focusModeToggle,
      title: "Toggle Focus Mode",
      category: workbenchCommandCategories.editor
    },
    typewriterModeToggle: {
      id: workbenchCommandIds.editor.typewriterModeToggle,
      title: "Toggle Typewriter Mode",
      category: workbenchCommandCategories.editor
    },
    taskToggleLines: {
      id: workbenchCommandIds.editor.taskToggleLines,
      title: "Toggle Task Lines",
      category: workbenchCommandCategories.editor
    },
    taskRemoveMarkers: {
      id: workbenchCommandIds.editor.taskRemoveMarkers,
      title: "Remove Task Markers",
      category: workbenchCommandCategories.editor
    }
  },
  theme: {
    toggle: {
      id: workbenchCommandIds.theme.toggle,
      title: "Toggle Theme",
      category: workbenchCommandCategories.workbench
    }
  }
} as const satisfies Record<string, Record<string, CommandMetadata>>;

export const editorTaskCommandMetadata = {
  removeTaskMarkers: workbenchCommandMetadata.editor.taskRemoveMarkers,
  toggleTaskLines: workbenchCommandMetadata.editor.taskToggleLines
} as const satisfies Record<string, CommandMetadata>;

export function getWorkbenchCommandMetadata(): readonly CommandMetadata[] {
  return Object.values(workbenchCommandMetadata).flatMap((group) => Object.values(group));
}
