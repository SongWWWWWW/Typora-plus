import { URI } from "@typora-plus/base";
import type { FileTreeEntry } from "@typora-plus/platform";
import { describe, expect, it } from "vitest";
import { filterQuickOpenFiles } from "./workbenchQuickOpenModel";

describe("workbench quick open model", () => {
  const files = [
    file("notes/daily.md"),
    file("notes/design.md"),
    file("archive/project-plan.md"),
    file("README.md"),
    file("src/workbench/Application.md")
  ];

  it("returns the first configured result window for an empty query", () => {
    expect(filterQuickOpenFiles(files, "   ", { maxResults: 3 }).map((entry) => entry.relativePath)).toEqual([
      "notes/daily.md",
      "notes/design.md",
      "archive/project-plan.md"
    ]);
  });

  it("ranks exact name, name prefix, path substring, and fuzzy path matches", () => {
    expect(filterQuickOpenFiles(files, "README.md", { maxResults: 10 }).map((entry) => entry.relativePath)).toEqual([
      "README.md"
    ]);
    expect(filterQuickOpenFiles(files, "des", { maxResults: 10 }).map((entry) => entry.relativePath)).toEqual([
      "notes/design.md"
    ]);
    expect(filterQuickOpenFiles(files, "project", { maxResults: 10 }).map((entry) => entry.relativePath)).toEqual([
      "archive/project-plan.md"
    ]);
    expect(filterQuickOpenFiles(files, "wbap", { maxResults: 10 }).map((entry) => entry.relativePath)).toEqual([
      "src/workbench/Application.md"
    ]);
  });

  it("sorts equal scores by relative path", () => {
    expect(filterQuickOpenFiles(files, "notes", { maxResults: 10 }).map((entry) => entry.relativePath)).toEqual([
      "notes/daily.md",
      "notes/design.md"
    ]);
  });

  it("normalizes configured result limits", () => {
    expect(filterQuickOpenFiles(files, "md", { maxResults: 2 }).map((entry) => entry.relativePath)).toHaveLength(2);
    expect(filterQuickOpenFiles(files, "md", { maxResults: 0 })).toEqual([]);
    expect(filterQuickOpenFiles(files, "md", { maxResults: Number.NaN })).toEqual([]);
  });
});

function file(relativePath: string): FileTreeEntry {
  const name = relativePath.split("/").at(-1) ?? relativePath;

  return {
    uri: URI.file(`/workspace/${relativePath}`),
    name,
    relativePath,
    kind: "file"
  };
}
