import { URI } from "@typora-plus/base";
import type { RecentResource } from "@typora-plus/platform";
import { describe, expect, it } from "vitest";
import {
  createWorkbenchRecentResourceRows,
  createWorkbenchRecentResourceSections,
  isWorkbenchRecentFileResource,
  isWorkbenchRecentResourceActive,
  workbenchRecentFileEntry,
  workbenchRecentResourceKey,
  type WorkbenchRecentFileResource
} from "./workbenchRecentResourcesModel";

describe("workbench recent resources model", () => {
  it("groups recent resources by kind while preserving service order", () => {
    const recents = [
      recent("file", "/notes/a.md", "a.md", 4),
      recent("workspace", "/notes", "Notes", 3),
      recent("file", "/notes/b.md", "b.md", 2),
      recent("workspace", "/archive", "Archive", 1)
    ];

    expect(createWorkbenchRecentResourceSections(recents)).toEqual({
      files: [recents[0], recents[2]],
      workspaces: [recents[1], recents[3]]
    });
  });

  it("limits each section with normalized numeric bounds", () => {
    const recents = [
      recent("file", "/notes/a.md", "a.md", 5),
      recent("file", "/notes/b.md", "b.md", 4),
      recent("workspace", "/notes", "Notes", 3),
      recent("workspace", "/archive", "Archive", 2)
    ];

    expect(createWorkbenchRecentResourceSections(recents, { maxItemsPerSection: 1 })).toEqual({
      files: [recents[0]],
      workspaces: [recents[2]]
    });
    expect(createWorkbenchRecentResourceSections(recents, { maxItemsPerSection: 1.8 })).toEqual({
      files: [recents[0]],
      workspaces: [recents[2]]
    });
    expect(createWorkbenchRecentResourceSections(recents, { maxItemsPerSection: -1 })).toEqual({
      files: [],
      workspaces: []
    });
    expect(createWorkbenchRecentResourceSections(recents, { maxItemsPerSection: Number.NaN })).toEqual({
      files: [],
      workspaces: []
    });
  });

  it("creates stable row keys and active states", () => {
    const recents = [
      recent("file", "/notes/a.md", "a.md", 2),
      recent("workspace", "/notes", "Notes", 1)
    ];
    const rows = createWorkbenchRecentResourceRows(recents, "file:///notes/a.md");

    expect(rows.map((row) => ({
      key: row.key,
      kind: row.kind,
      active: row.active,
      hasFileEntry: row.fileEntry !== undefined
    }))).toEqual([
      {
        key: "file-file:///notes/a.md",
        kind: "file",
        active: true,
        hasFileEntry: true
      },
      {
        key: "workspace-file:///notes",
        kind: "workspace",
        active: false,
        hasFileEntry: false
      }
    ]);
  });

  it("maps recent files to file tree entries for the Workbench open boundary", () => {
    const resource = recentFile("/notes/a.md", "a.md", 1);
    const workspace = recent("workspace", "/notes", "Notes", 2);

    expect(isWorkbenchRecentFileResource(resource)).toBe(true);
    expect(isWorkbenchRecentFileResource(workspace)).toBe(false);
    expect(workbenchRecentResourceKey(resource)).toBe("file-file:///notes/a.md");
    expect(isWorkbenchRecentResourceActive(resource, "file:///notes/a.md")).toBe(true);
    expect(isWorkbenchRecentResourceActive(resource, "file:///notes/b.md")).toBe(false);
    expect(workbenchRecentFileEntry(resource)).toEqual({
      uri: resource.uri,
      name: "a.md",
      relativePath: "a.md",
      kind: "file"
    });
  });
});

function recent(
  kind: RecentResource["kind"],
  path: string,
  name: string,
  lastOpenedAt: number
): RecentResource {
  return {
    uri: URI.file(path),
    name,
    kind,
    lastOpenedAt
  };
}

function recentFile(path: string, name: string, lastOpenedAt: number): WorkbenchRecentFileResource {
  return {
    uri: URI.file(path),
    name,
    kind: "file",
    lastOpenedAt
  };
}
