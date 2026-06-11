import { URI } from "@typora-plus/base";
import type { TextFileModel } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchLineNavigationCallbacks,
  createWorkbenchLineNavigationEnvironment,
  createWorkbenchLineTargetOpenHandler,
  openWorkbenchLineResource,
  openWorkbenchLineTargetAction,
  scrollWorkbenchLine,
  workbenchDeferredLineScrollDelayMs,
  type WorkbenchLineNavigationCallbacks
} from "./workbenchLineNavigation";

describe("workbench line navigation", () => {
  it("scrolls local line targets immediately", () => {
    const scrollToLine = vi.fn();

    scrollWorkbenchLine({ scrollToLine }, { line: 7 });

    expect(scrollToLine).toHaveBeenCalledWith(7);
  });

  it("creates shell callbacks from a timer and editor handle source", () => {
    const scheduled: Array<() => void> = [];
    const timer = {
      setTimeout: vi.fn((callback: () => void, delayMs: number) => {
        scheduled.push(callback);
        return delayMs;
      })
    };
    const editor = {
      scrollToLine: vi.fn()
    };
    const clearSaveConflict = vi.fn();
    const setOperationError = vi.fn();
    const setSaveConflict = vi.fn();
    const callbacks = createWorkbenchLineNavigationCallbacks(
      createWorkbenchLineNavigationEnvironment(timer),
      { getEditorHandle: () => editor },
      { clearSaveConflict, setOperationError, setSaveConflict }
    );
    const deferred = vi.fn();

    callbacks.defer(deferred);
    callbacks.scrollToLine(14);

    expect(timer.setTimeout).toHaveBeenCalledWith(deferred, workbenchDeferredLineScrollDelayMs);
    expect(scheduled).toEqual([deferred]);
    expect(editor.scrollToLine).toHaveBeenCalledWith(14);
    expect(callbacks.clearSaveConflict).toBe(clearSaveConflict);
    expect(callbacks.setOperationError).toBe(setOperationError);
    expect(callbacks.setSaveConflict).toBe(setSaveConflict);
  });

  it("ignores line scrolls when no editor handle is mounted", () => {
    const callbacks = createWorkbenchLineNavigationCallbacks(
      createWorkbenchLineNavigationEnvironment({
        setTimeout: vi.fn()
      }),
      { getEditorHandle: () => undefined },
      { setOperationError: vi.fn() }
    );

    expect(() => callbacks.scrollToLine(2)).not.toThrow();
  });

  it("opens resource targets before scheduling line scrolling", async () => {
    const sourceUri = URI.file("C:/Notes/source.md");
    const openedModel = model("C:/Notes/source.md");
    const calls: string[] = [];
    const deferred: Array<() => void> = [];
    const callbacks: WorkbenchLineNavigationCallbacks = {
      clearSaveConflict: vi.fn(() => calls.push("clear")),
      defer: vi.fn((callback) => {
        calls.push("defer");
        deferred.push(callback);
      }),
      scrollToLine: vi.fn((line) => calls.push(`scroll:${line}`))
    };
    const services = {
      textFileService: {
        openFile: vi.fn(async (uri) => {
          calls.push(`open:${uri.toString()}`);
          return openedModel;
        })
      },
      recentService: {
        addRecentFile: vi.fn((uri, name) => calls.push(`recent:${uri.toString()}:${name}`))
      }
    };

    await openWorkbenchLineResource(services, { uri: sourceUri, line: 12 }, callbacks);

    expect(services.textFileService.openFile).toHaveBeenCalledWith(sourceUri);
    expect(services.recentService.addRecentFile).toHaveBeenCalledWith(openedModel.uri, openedModel.name);
    expect(callbacks.clearSaveConflict).toHaveBeenCalledTimes(1);
    expect(callbacks.defer).toHaveBeenCalledTimes(1);
    expect(callbacks.scrollToLine).not.toHaveBeenCalled();
    expect(calls).toEqual([
      "clear",
      "open:file://C:/Notes/source.md",
      "recent:file://C:/Notes/source.md:source.md",
      "defer"
    ]);

    deferred[0]?.();

    expect(callbacks.scrollToLine).toHaveBeenCalledWith(12);
    expect(calls.at(-1)).toBe("scroll:12");
  });

  it("opens local line targets without clearing operation errors", async () => {
    const callbacks = {
      clearSaveConflict: vi.fn(),
      defer: vi.fn(),
      scrollToLine: vi.fn(),
      setOperationError: vi.fn(),
      setSaveConflict: vi.fn()
    };
    const services = createServices();

    await expect(openWorkbenchLineTargetAction(services, { line: 5 }, callbacks)).resolves.toBeUndefined();

    expect(callbacks.scrollToLine).toHaveBeenCalledWith(5);
    expect(callbacks.setOperationError).not.toHaveBeenCalled();
    expect(callbacks.clearSaveConflict).not.toHaveBeenCalled();
    expect(services.textFileService.openFile).not.toHaveBeenCalled();
  });

  it("opens resource line targets through Workbench action handling", async () => {
    const sourceUri = URI.file("C:/Notes/source.md");
    const openedModel = model("C:/Notes/source.md");
    const callbacks = {
      clearSaveConflict: vi.fn(),
      defer: vi.fn(),
      scrollToLine: vi.fn(),
      setOperationError: vi.fn(),
      setSaveConflict: vi.fn()
    };
    const services = createServices({
      openFile: async () => openedModel
    });

    await expect(openWorkbenchLineTargetAction(services, { uri: sourceUri, line: 9 }, callbacks))
      .resolves.toBeUndefined();

    expect(callbacks.setOperationError).toHaveBeenCalledWith(undefined);
    expect(callbacks.clearSaveConflict).toHaveBeenCalledOnce();
    expect(services.textFileService.openFile).toHaveBeenCalledWith(sourceUri);
    expect(callbacks.defer).toHaveBeenCalledOnce();
    expect(callbacks.scrollToLine).not.toHaveBeenCalled();
  });

  it("maps resource line opening failures into operation errors", async () => {
    const callbacks = {
      clearSaveConflict: vi.fn(),
      defer: vi.fn(),
      scrollToLine: vi.fn(),
      setOperationError: vi.fn()
    };
    const services = createServices({
      openFile: async () => {
        throw new Error("open failed");
      }
    });

    await expect(openWorkbenchLineTargetAction(
      services,
      { uri: URI.file("C:/Notes/missing.md"), line: 3 },
      callbacks
    )).resolves.toBeUndefined();

    expect(callbacks.setOperationError).toHaveBeenCalledWith(undefined);
    expect(callbacks.setOperationError).toHaveBeenCalledWith("open failed");
    expect(callbacks.defer).not.toHaveBeenCalled();
    expect(callbacks.scrollToLine).not.toHaveBeenCalled();
  });

  it("creates a line target open handler with the shared action boundary", async () => {
    const operationErrors: Array<string | undefined> = [];
    const callbacks = {
      clearSaveConflict: vi.fn(),
      defer: vi.fn(),
      scrollToLine: vi.fn(),
      setOperationError: (value: string | undefined) => operationErrors.push(value),
      setSaveConflict: vi.fn()
    };
    const services = createServices({
      openFile: async () => {
        throw new Error("open failed");
      }
    });
    const openLineTarget = createWorkbenchLineTargetOpenHandler(services, callbacks);

    openLineTarget({ line: 5 });
    openLineTarget({ uri: URI.file("C:/Notes/missing.md"), line: 8 });
    await waitForLineTargetHandler();

    expect(callbacks.scrollToLine).toHaveBeenCalledWith(5);
    expect(callbacks.clearSaveConflict).toHaveBeenCalledOnce();
    expect(services.textFileService.openFile).toHaveBeenCalledWith(URI.file("C:/Notes/missing.md"));
    expect(callbacks.defer).not.toHaveBeenCalled();
    expect(operationErrors).toEqual([undefined, "open failed"]);
  });
});

function createServices(overrides: {
  readonly openFile?: (uri: URI) => Promise<TextFileModel>;
} = {}) {
  return {
    textFileService: {
      openFile: vi.fn(overrides.openFile ?? (async (uri) => model(uri.toString())))
    },
    recentService: {
      addRecentFile: vi.fn()
    }
  };
}

function waitForLineTargetHandler(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

function model(path: string): TextFileModel {
  const uri = path.includes("://") ? URI.parse(path) : URI.file(path);

  return {
    uri,
    name: path.split("/").at(-1) ?? path,
    languageId: "markdown",
    value: "",
    dirty: false,
    version: 1
  };
}
