import type { WorkspaceIndexedTagSummary } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchTagRows,
  nextWorkbenchSelectedTag,
  normalizeWorkbenchTagName,
  syncWorkbenchSelectedTag,
  workbenchTagKey
} from "./workbenchTagsModel";

describe("workbench tags model", () => {
  it("clears selection when there are no tags", () => {
    expect(nextWorkbenchSelectedTag([], "project")).toBeUndefined();
  });

  it("selects the first tag when selection is missing or blank", () => {
    const tags = [tag("project"), tag("todo")];

    expect(nextWorkbenchSelectedTag(tags, undefined)).toBe("project");
    expect(nextWorkbenchSelectedTag(tags, "   ")).toBe("project");
  });

  it("keeps a matching selection using the current tag casing", () => {
    const tags = [tag("Project"), tag("todo")];

    expect(nextWorkbenchSelectedTag(tags, " project ")).toBe("Project");
    expect(nextWorkbenchSelectedTag(tags, "PROJECT")).toBe("Project");
  });

  it("falls back to the first tag when the selected tag no longer exists", () => {
    const tags = [tag("project"), tag("todo")];

    expect(nextWorkbenchSelectedTag(tags, "done")).toBe("project");
  });

  it("creates tag rows with stable keys and active states", () => {
    const rows = createWorkbenchTagRows([tag("Project"), tag("todo")], " project ");

    expect(rows).toEqual([
      {
        tag: tag("Project"),
        key: "Project",
        active: true
      },
      {
        tag: tag("todo"),
        key: "todo",
        active: false
      }
    ]);
  });

  it("normalizes tag names for matching", () => {
    expect(normalizeWorkbenchTagName(" Project ")).toBe("project");
    expect(normalizeWorkbenchTagName(undefined)).toBe("");
    expect(workbenchTagKey(tag(" Project "))).toBe(" Project ");
  });

  it("syncs selected tag only when the normalized selection changes", () => {
    const setSelectedTag = vi.fn();
    const tags = [tag("Project"), tag("todo")];

    syncWorkbenchSelectedTag(tags, " project ", { setSelectedTag });
    syncWorkbenchSelectedTag(tags, "todo", { setSelectedTag });
    syncWorkbenchSelectedTag([], "todo", { setSelectedTag });

    expect(setSelectedTag).toHaveBeenCalledWith("Project");
    expect(setSelectedTag).toHaveBeenCalledWith(undefined);
    expect(setSelectedTag).toHaveBeenCalledTimes(2);
  });
});

function tag(name: string, count = 1): WorkspaceIndexedTagSummary {
  return {
    tag: name,
    count
  };
}
