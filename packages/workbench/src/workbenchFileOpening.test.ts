import { URI } from "@typora-plus/base";
import type { TextFileModel } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import { openWorkbenchFile } from "./workbenchFileOpening";

describe("workbench file opening", () => {
  it("clears save conflict, opens the file, records the recent file, and returns the opened model", async () => {
    const sourceUri = URI.file("/workspace/source.md");
    const openedModel = model(URI.file("/workspace/opened.md"), "opened.md");
    const calls: string[] = [];
    const clearSaveConflict = vi.fn(() => calls.push("clear"));
    const services = {
      textFileService: {
        openFile: vi.fn(async (uri) => {
          calls.push(`open:${uri.toString()}`);
          return openedModel;
        })
      },
      recentService: {
        addRecentFile: vi.fn((uri, name) => {
          calls.push(`recent:${uri.toString()}:${name}`);
        })
      }
    };

    await expect(openWorkbenchFile(services, sourceUri, { clearSaveConflict })).resolves.toBe(openedModel);

    expect(clearSaveConflict).toHaveBeenCalledTimes(1);
    expect(services.textFileService.openFile).toHaveBeenCalledWith(sourceUri);
    expect(services.recentService.addRecentFile).toHaveBeenCalledWith(openedModel.uri, openedModel.name);
    expect(calls).toEqual([
      "clear",
      "open:file:///workspace/source.md",
      "recent:file:///workspace/opened.md:opened.md"
    ]);
  });

  it("opens and records recent files without a conflict callback", async () => {
    const sourceUri = URI.file("/workspace/source.md");
    const openedModel = model(sourceUri, "source.md");
    const services = {
      textFileService: {
        openFile: vi.fn(async () => openedModel)
      },
      recentService: {
        addRecentFile: vi.fn()
      }
    };

    await expect(openWorkbenchFile(services, sourceUri)).resolves.toBe(openedModel);

    expect(services.textFileService.openFile).toHaveBeenCalledWith(sourceUri);
    expect(services.recentService.addRecentFile).toHaveBeenCalledWith(sourceUri, "source.md");
  });
});

function model(uri: URI, name: string): TextFileModel {
  return {
    uri,
    name,
    languageId: "markdown",
    value: "",
    dirty: false,
    version: 1
  };
}
