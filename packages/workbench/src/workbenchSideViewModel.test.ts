import { describe, expect, it } from "vitest";
import {
  defaultWorkbenchSideView,
  toggleWorkbenchSideView,
  workbenchFilesSideView,
  workbenchSideViewTitle,
  type WorkbenchSideView
} from "./workbenchSideViewModel";

describe("workbench side view model", () => {
  it("defines the default side view", () => {
    expect(defaultWorkbenchSideView).toBe("outline");
  });

  it("defines the Files side view target", () => {
    expect(workbenchFilesSideView).toBe("files");
  });

  it("toggles the active side view closed when selecting it again", () => {
    expect(toggleWorkbenchSideView("files", "files")).toBeNull();
  });

  it("activates a different side view", () => {
    expect(toggleWorkbenchSideView("search", "files")).toBe("search");
    expect(toggleWorkbenchSideView("outline", null)).toBe("outline");
  });

  it("returns stable titles for every side view", () => {
    const views: readonly WorkbenchSideView[] = ["files", "search", "outline", "backlinks", "tags"];

    expect(views.map((view) => [view, workbenchSideViewTitle(view)])).toEqual([
      ["files", "Files"],
      ["search", "Search"],
      ["outline", "Outline"],
      ["backlinks", "Backlinks"],
      ["tags", "Tags"]
    ]);
  });
});
