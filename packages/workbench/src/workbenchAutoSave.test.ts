import { URI } from "@typora-plus/base";
import {
  defaultConfiguration,
  type FileSaveConflict,
  type FileTreeEntry,
  type TextFileModel,
  type TextFileSaveOptions,
  type WorkspaceFileTree
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  runWorkbenchAutoSave,
  scheduleWorkbenchAutoSave,
  shouldScheduleWorkbenchAutoSave,
  type WorkbenchAutoSaveScheduler
} from "./workbenchAutoSave";
import type { WorkbenchFileSavingServices } from "./workbenchFileSaving";

describe("workbench auto save", () => {
  it("schedules only dirty file models without active save conflicts when auto-save is enabled", () => {
    expect(shouldScheduleWorkbenchAutoSave(state({}))).toBe(true);
    expect(shouldScheduleWorkbenchAutoSave(state({
      autoSave: false
    }))).toBe(false);
    expect(shouldScheduleWorkbenchAutoSave(state({
      dirty: false
    }))).toBe(false);
    expect(shouldScheduleWorkbenchAutoSave(state({
      uri: URI.parse("untitled://default")
    }))).toBe(false);
    expect(shouldScheduleWorkbenchAutoSave(state({
      saveConflict: {
        uri: URI.file("C:/Notes/a.md"),
        expectedMtime: 1,
        diskMtime: 2
      }
    }))).toBe(false);
  });

  it("schedules and clears delayed auto-save work", () => {
    const scheduler = createScheduler();
    const cleanup = scheduleWorkbenchAutoSave(
      createServices({}),
      workspace([file("C:/Notes/a.md", "a.md")]),
      state({
        autoSaveDelayMs: 1250
      }),
      {
        setOperationError: vi.fn(),
        setSaveConflict: vi.fn()
      },
      scheduler
    );

    expect(scheduler.setTimeout).toHaveBeenCalledWith(expect.any(Function), 1250);
    expect(cleanup).toBeDefined();

    cleanup?.();

    expect(scheduler.clearTimeout).toHaveBeenCalledWith("timer-handle");
  });

  it("does not schedule timer work when auto-save is gated off", () => {
    const scheduler = createScheduler();

    expect(scheduleWorkbenchAutoSave(
      createServices({}),
      undefined,
      state({
        dirty: false
      }),
      {
        setOperationError: vi.fn(),
        setSaveConflict: vi.fn()
      },
      scheduler
    )).toBeUndefined();

    expect(scheduler.setTimeout).not.toHaveBeenCalled();
    expect(scheduler.clearTimeout).not.toHaveBeenCalled();
  });

  it("runs auto-save without recording recent files", async () => {
    const saved = model("C:/Notes/a.md", "# A");
    const workspaceFiles = workspace([file("C:/Notes/a.md", "a.md")]);
    const services = createServices({
      save: vi.fn(async () => saved)
    });
    const callbacks = {
      setOperationError: vi.fn(),
      setSaveConflict: vi.fn()
    };

    await expect(runWorkbenchAutoSave(services, workspaceFiles, callbacks)).resolves.toBe(saved);

    expect(services.textFileService.save).toHaveBeenCalledWith(undefined);
    expect(services.recentService.addRecentFile).not.toHaveBeenCalled();
    expect(services.indexService.indexFile).toHaveBeenCalledWith(workspaceFiles.files[0], "# A");
    expect(callbacks.setOperationError).toHaveBeenCalledWith(undefined);
  });
});

function state(overrides: {
  readonly autoSave?: boolean;
  readonly autoSaveDelayMs?: number;
  readonly dirty?: boolean;
  readonly saveConflict?: FileSaveConflict;
  readonly uri?: URI;
}): Parameters<typeof shouldScheduleWorkbenchAutoSave>[0] {
  return {
    configuration: {
      editor: {
        ...defaultConfiguration.editor,
        autoSave: overrides.autoSave ?? true,
        autoSaveDelayMs: overrides.autoSaveDelayMs ?? defaultConfiguration.editor.autoSaveDelayMs
      }
    },
    model: {
      dirty: overrides.dirty ?? true,
      uri: overrides.uri ?? URI.file("C:/Notes/a.md")
    },
    saveConflict: overrides.saveConflict
  };
}

function createScheduler() {
  return {
    setTimeout: vi.fn(() => "timer-handle"),
    clearTimeout: vi.fn()
  } satisfies WorkbenchAutoSaveScheduler;
}

function createServices(overrides: {
  readonly save?: (options?: TextFileSaveOptions) => Promise<TextFileModel>;
}): WorkbenchFileSavingServices {
  return {
    textFileService: {
      save: vi.fn(overrides.save ?? (async () => model("C:/Notes/a.md", "# A"))),
      saveAs: vi.fn()
    },
    recentService: {
      addRecentFile: vi.fn()
    },
    indexService: {
      indexFile: vi.fn(async () => undefined)
    },
    fileService: {
      refreshWorkspace: vi.fn(async () => undefined)
    },
    workspaceService: {
      setWorkspace: vi.fn()
    }
  };
}

function workspace(files: readonly FileTreeEntry[]): WorkspaceFileTree {
  return {
    root: {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: "",
      kind: "directory",
      children: files
    },
    files
  };
}

function file(path: string, relativePath: string): FileTreeEntry {
  return {
    uri: URI.file(path),
    name: relativePath.split("/").at(-1) ?? relativePath,
    relativePath,
    kind: "file"
  };
}

function model(path: string, value: string): TextFileModel {
  return {
    uri: URI.file(path),
    name: path.split("/").at(-1) ?? path,
    languageId: "markdown",
    value,
    dirty: false,
    version: 1
  };
}
