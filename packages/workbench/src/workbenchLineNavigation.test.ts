import { URI } from "@typora-plus/base";
import type { TextFileModel } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  openWorkbenchLineResource,
  scrollWorkbenchLine,
  type WorkbenchLineNavigationCallbacks
} from "./workbenchLineNavigation";

describe("workbench line navigation", () => {
  it("scrolls local line targets immediately", () => {
    const scrollToLine = vi.fn();

    scrollWorkbenchLine({ scrollToLine }, { line: 7 });

    expect(scrollToLine).toHaveBeenCalledWith(7);
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
});

function model(path: string): TextFileModel {
  return {
    uri: URI.file(path),
    name: path.split("/").at(-1) ?? path,
    languageId: "markdown",
    value: "",
    dirty: false,
    version: 1
  };
}
