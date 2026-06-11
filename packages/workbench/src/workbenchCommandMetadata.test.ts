import { describe, expect, it } from "vitest";
import {
  editorTaskCommandMetadata,
  getWorkbenchCommandMetadata,
  workbenchCommandCategories,
  workbenchCommandMetadata
} from "./workbenchCommandMetadata";
import {
  getWorkbenchCommandIds,
  workbenchCommandIds
} from "./workbenchCommandIds";

describe("workbench command metadata", () => {
  it("defines stable command categories", () => {
    expect(workbenchCommandCategories).toEqual({
      file: "File",
      workbench: "Workbench",
      editor: "Editor",
      ai: "AI",
      remoteSync: "Remote Sync"
    });
  });

  it("defines command metadata for built-in command surfaces", () => {
    expect(workbenchCommandMetadata.file.newUntitled).toEqual({
      category: workbenchCommandCategories.file,
      id: workbenchCommandIds.file.newUntitled,
      title: "New Note"
    });
    expect(workbenchCommandMetadata.workbench.sidebarFiles).toEqual({
      category: workbenchCommandCategories.workbench,
      id: workbenchCommandIds.workbench.sidebarFiles,
      title: "Show Files"
    });
    expect(workbenchCommandMetadata.editor.focusModeToggle).toEqual({
      category: workbenchCommandCategories.editor,
      id: workbenchCommandIds.editor.focusModeToggle,
      title: "Toggle Focus Mode"
    });
    expect(workbenchCommandMetadata.theme.toggle).toEqual({
      category: workbenchCommandCategories.workbench,
      id: workbenchCommandIds.theme.toggle,
      title: "Toggle Theme"
    });
    expect(workbenchCommandMetadata.ai.summarizeActiveNote).toEqual({
      category: workbenchCommandCategories.ai,
      id: workbenchCommandIds.ai.summarizeActiveNote,
      title: "Summarize Active Note"
    });
    expect(workbenchCommandMetadata.remoteSync.planWorkspace).toEqual({
      category: workbenchCommandCategories.remoteSync,
      id: workbenchCommandIds.remoteSync.planWorkspace,
      title: "Plan Workspace Sync"
    });
  });

  it("defines editor task command metadata for command surfaces", () => {
    expect(Object.values(editorTaskCommandMetadata)).toEqual([
      {
        category: workbenchCommandCategories.editor,
        id: workbenchCommandIds.editor.taskRemoveMarkers,
        title: "Remove Task Markers"
      },
      {
        category: workbenchCommandCategories.editor,
        id: workbenchCommandIds.editor.taskToggleLines,
        title: "Toggle Task Lines"
      }
    ]);
  });

  it("covers every built-in command id with one metadata entry", () => {
    const ids = getWorkbenchCommandMetadata().map((command) => command.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect([...ids].sort()).toEqual([...getWorkbenchCommandIds()].sort());
  });
});
