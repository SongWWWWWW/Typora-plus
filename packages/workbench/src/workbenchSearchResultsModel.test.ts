import { URI } from "@typora-plus/base";
import type {
  WorkspaceIndexedLink,
  WorkspaceIndexedTag,
  WorkspaceSearchResult
} from "@typora-plus/platform";
import { describe, expect, it } from "vitest";
import {
  backlinkKey,
  formatBacklinkPreview,
  isWorkspaceSearchResult,
  searchDocument,
  searchResultKey,
  tagResourceKey
} from "./workbenchSearchResultsModel";

describe("workbench search results model", () => {
  it("searches local documents case-insensitively with line numbers and trimmed previews", () => {
    expect(searchDocument(" Alpha\nbeta\n  alphabet  ", "ALPHA", { maxResults: 10 })).toEqual([
      { line: 1, preview: "Alpha" },
      { line: 3, preview: "alphabet" }
    ]);
  });

  it("uses the configured local document result limit", () => {
    const markdown = ["match one", "match two", "match three"].join("\n");

    expect(searchDocument(markdown, "match", { maxResults: 2 })).toEqual([
      { line: 1, preview: "match one" },
      { line: 2, preview: "match two" }
    ]);
    expect(searchDocument(markdown, "match", { maxResults: 0 })).toEqual([]);
    expect(searchDocument(markdown, "match", { maxResults: Number.NaN })).toEqual([]);
  });

  it("returns no local document matches for empty queries", () => {
    expect(searchDocument("alpha", "   ", { maxResults: 10 })).toEqual([]);
  });

  it("identifies workspace search results and builds stable search result keys", () => {
    const workspaceResult: WorkspaceSearchResult = {
      uri: URI.file("/workspace/note.md"),
      name: "note.md",
      line: 4,
      preview: "target",
      relativePath: "note.md",
      score: 1
    };
    const documentResult = { line: 4, preview: "target" };

    expect(isWorkspaceSearchResult(workspaceResult)).toBe(true);
    expect(isWorkspaceSearchResult(documentResult)).toBe(false);
    expect(searchResultKey(workspaceResult)).toBe("file:///workspace/note.md-4-target");
    expect(searchResultKey(documentResult)).toBe("4-target");
  });

  it("formats backlink previews and stable backlink keys", () => {
    const link: WorkspaceIndexedLink = {
      uri: URI.file("/workspace/source.md"),
      name: "source.md",
      relativePath: "source.md",
      line: 7,
      target: "target.md",
      label: "  Target Note  ",
      kind: "markdown"
    };

    expect(formatBacklinkPreview(link)).toBe("Target Note");
    expect(backlinkKey(link, 2)).toBe("file:///workspace/source.md-7-markdown-target.md-  Target Note  -2");
    expect(formatBacklinkPreview({ ...link, label: "   " })).toBe("target.md");
  });

  it("builds stable tag resource keys", () => {
    const tag: WorkspaceIndexedTag = {
      uri: URI.file("/workspace/tagged.md"),
      name: "tagged.md",
      relativePath: "tagged.md",
      line: 3,
      tag: "todo"
    };

    expect(tagResourceKey(tag, 1)).toBe("file:///workspace/tagged.md-3-todo-1");
  });
});
