import { URI } from "@typora-plus/base";
import type { FileTreeEntry } from "@typora-plus/platform";
import { describe, expect, it } from "vitest";
import {
  createWorkbenchFileTreeRows,
  isWorkbenchFileTreeEntryActive,
  isWorkbenchFileTreeFileEntry,
  workbenchFileTreeEntryKey
} from "./workbenchFileTreeModel";

describe("workbench file tree model", () => {
  it("flattens nested entries into preorder rows with stable depths", () => {
    const entries = [
      directory("docs", [
        file("docs/architecture.md"),
        directory("docs/guides", [
          file("docs/guides/setup.md")
        ])
      ]),
      file("README.md")
    ];

    expect(createWorkbenchFileTreeRows(entries, {
      activeUri: "file:///workspace/docs/guides/setup.md",
      dirty: true
    }).map((row) => ({
      name: row.entry.name,
      kind: row.kind,
      depth: row.depth,
      active: row.active,
      dirty: row.dirty,
      hasFileEntry: row.fileEntry !== undefined
    }))).toEqual([
      {
        name: "docs",
        kind: "directory",
        depth: 0,
        active: false,
        dirty: false,
        hasFileEntry: false
      },
      {
        name: "architecture.md",
        kind: "file",
        depth: 1,
        active: false,
        dirty: false,
        hasFileEntry: true
      },
      {
        name: "guides",
        kind: "directory",
        depth: 1,
        active: false,
        dirty: false,
        hasFileEntry: false
      },
      {
        name: "setup.md",
        kind: "file",
        depth: 2,
        active: true,
        dirty: true,
        hasFileEntry: true
      },
      {
        name: "README.md",
        kind: "file",
        depth: 0,
        active: false,
        dirty: false,
        hasFileEntry: true
      }
    ]);
  });

  it("does not mark the active file dirty when the model is clean", () => {
    const entries = [file("README.md")];

    expect(createWorkbenchFileTreeRows(entries, {
      activeUri: "file:///workspace/README.md",
      dirty: false
    })[0]?.dirty).toBe(false);
  });

  it("normalizes the initial tree depth", () => {
    const entries = [file("README.md")];

    expect(createWorkbenchFileTreeRows(entries, {
      activeUri: "",
      dirty: false,
      initialDepth: 2.8
    })[0]?.depth).toBe(2);
    expect(createWorkbenchFileTreeRows(entries, {
      activeUri: "",
      dirty: false,
      initialDepth: Number.NaN
    })[0]?.depth).toBe(0);
    expect(createWorkbenchFileTreeRows(entries, {
      activeUri: "",
      dirty: false,
      initialDepth: -1
    })[0]?.depth).toBe(0);
  });

  it("creates row keys and file type guards from file tree entries", () => {
    const fileEntry = file("README.md");
    const directoryEntry = directory("docs", []);

    expect(workbenchFileTreeEntryKey(fileEntry)).toBe("file:///workspace/README.md");
    expect(isWorkbenchFileTreeEntryActive(fileEntry, "file:///workspace/README.md")).toBe(true);
    expect(isWorkbenchFileTreeEntryActive(fileEntry, "file:///workspace/other.md")).toBe(false);
    expect(isWorkbenchFileTreeFileEntry(fileEntry)).toBe(true);
    expect(isWorkbenchFileTreeFileEntry(directoryEntry)).toBe(false);
  });
});

function file(relativePath: string): FileTreeEntry {
  return {
    uri: URI.file(`/workspace/${relativePath}`),
    name: relativePath.split("/").at(-1) ?? relativePath,
    relativePath,
    kind: "file"
  };
}

function directory(relativePath: string, children: readonly FileTreeEntry[]): FileTreeEntry {
  return {
    uri: URI.file(`/workspace/${relativePath}`),
    name: relativePath.split("/").at(-1) ?? relativePath,
    relativePath,
    kind: "directory",
    children
  };
}
