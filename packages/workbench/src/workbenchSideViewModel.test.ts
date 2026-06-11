import { describe, expect, it } from "vitest";
import {
  defaultWorkbenchSideView,
  toggleWorkbenchSideView,
  workbenchFilesSideView,
  workbenchSideViews,
  workbenchSideViewTitle,
  type WorkbenchSideView
} from "./workbenchSideViewModel";

describe("workbench side view model", () => {
  it("defines stable side view ids", () => {
    expect(workbenchSideViews).toEqual({
      files: "files",
      search: "search",
      outline: "outline",
      backlinks: "backlinks",
      tags: "tags"
    });
  });

  it("defines the default side view", () => {
    expect(defaultWorkbenchSideView).toBe(workbenchSideViews.outline);
  });

  it("defines the Files side view target", () => {
    expect(workbenchFilesSideView).toBe(workbenchSideViews.files);
  });

  it("toggles the active side view closed when selecting it again", () => {
    expect(toggleWorkbenchSideView(workbenchSideViews.files, workbenchSideViews.files)).toBeNull();
  });

  it("activates a different side view", () => {
    expect(toggleWorkbenchSideView(workbenchSideViews.search, workbenchSideViews.files)).toBe(workbenchSideViews.search);
    expect(toggleWorkbenchSideView(workbenchSideViews.outline, null)).toBe(workbenchSideViews.outline);
  });

  it("returns stable titles for every side view", () => {
    const views: readonly WorkbenchSideView[] = Object.values(workbenchSideViews);

    expect(views.map((view) => [view, workbenchSideViewTitle(view)])).toEqual([
      ["files", "Files"],
      ["search", "Search"],
      ["outline", "Outline"],
      ["backlinks", "Backlinks"],
      ["tags", "Tags"]
    ]);
  });
});
