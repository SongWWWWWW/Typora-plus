import { describe, expect, it } from "vitest";
import {
  defaultWorkbenchKeybindings,
  defaultWorkbenchMenuItems
} from "./workbenchContributions";
import { getWorkbenchCommandMetadata } from "./workbenchCommandMetadata";
import {
  getWorkbenchCommandIds,
  workbenchCommandIds
} from "./workbenchCommandIds";

describe("workbench command ids", () => {
  it("defines stable ids for built-in Workbench commands", () => {
    expect(workbenchCommandIds).toEqual({
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
        summarizeActiveNote: "ai.summarizeActiveNote"
      },
      remoteSync: {
        planWorkspace: "remoteSync.planWorkspace"
      },
      theme: {
        toggle: "theme.toggle"
      }
    });
  });

  it("keeps built-in command ids unique", () => {
    const ids = getWorkbenchCommandIds();

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps default contribution command references on known command ids", () => {
    const knownIds: ReadonlySet<string> = new Set(getWorkbenchCommandIds());

    expect(defaultWorkbenchMenuItems.flatMap((item) =>
      knownIds.has(item.command) ? [] : [item.command]
    )).toEqual([]);
    expect(defaultWorkbenchKeybindings.flatMap((item) =>
      knownIds.has(item.command) ? [] : [item.command]
    )).toEqual([]);
    expect(getWorkbenchCommandMetadata().flatMap((command) =>
      knownIds.has(command.id) ? [] : [command.id]
    )).toEqual([]);
  });
});
