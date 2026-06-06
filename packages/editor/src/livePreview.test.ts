import { describe, expect, it } from "vitest";
import {
  analyzeMarkdownCodeFenceLines,
  analyzeMarkdownTableLines,
  classifyMarkdownLine,
  findInactiveMarkdownSyntaxMarkers
} from "./index";

describe("classifyMarkdownLine", () => {
  it("classifies headings by level", () => {
    expect(classifyMarkdownLine("### Details", false, false)).toContain("tp-editor-heading-3");
  });

  it("marks inactive lines in focus mode", () => {
    expect(classifyMarkdownLine("paragraph", false, true)).toContain("tp-editor-passive-line");
  });

  it("keeps active lines readable in focus mode", () => {
    expect(classifyMarkdownLine("paragraph", true, true)).not.toContain("tp-editor-passive-line");
  });

  it("adds code block role classes when a fence state is present", () => {
    expect(classifyMarkdownLine("const value = 1", false, false, { codeFenceRole: "content" })).toContain(
      "tp-editor-code-block-content"
    );
  });

  it("adds table role and edge classes when a table state is present", () => {
    expect(classifyMarkdownLine("| A | B |", false, false, {
      tableState: { first: true, last: false, line: 1, role: "header" }
    })).toEqual(expect.arrayContaining([
      "tp-editor-table-row",
      "tp-editor-table-header",
      "tp-editor-table-first"
    ]));
  });
});

describe("analyzeMarkdownCodeFenceLines", () => {
  it("marks opening, content, and closing fence lines", () => {
    expect(analyzeMarkdownCodeFenceLines([
      "before",
      "```ts",
      "const value = 1",
      "```",
      "after"
    ])).toEqual([
      { line: 2, role: "open" },
      { line: 3, role: "content" },
      { line: 4, role: "close" }
    ]);
  });

  it("keeps unclosed fence content marked until the document ends", () => {
    expect(analyzeMarkdownCodeFenceLines([
      "~~~",
      "code"
    ])).toEqual([
      { line: 1, role: "open" },
      { line: 2, role: "content" }
    ]);
  });

  it("keeps fence-like content lines inside an active block", () => {
    expect(analyzeMarkdownCodeFenceLines([
      "```",
      "```not a closing fence",
      "```"
    ])).toEqual([
      { line: 1, role: "open" },
      { line: 2, role: "content" },
      { line: 3, role: "close" }
    ]);
  });
});

describe("analyzeMarkdownTableLines", () => {
  it("marks header, delimiter, and body rows with block edges", () => {
    expect(analyzeMarkdownTableLines([
      "before",
      "| Name | Value |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "| Beta | 2 |",
      "after"
    ])).toEqual([
      { first: true, last: false, line: 2, role: "header" },
      { first: false, last: false, line: 3, role: "delimiter" },
      { first: false, last: false, line: 4, role: "body" },
      { first: false, last: true, line: 5, role: "body" }
    ]);
  });

  it("supports tables without outer pipes", () => {
    expect(analyzeMarkdownTableLines([
      "Name | Value",
      "--- | ---",
      "Alpha | 1"
    ])).toEqual([
      { first: true, last: false, line: 1, role: "header" },
      { first: false, last: false, line: 2, role: "delimiter" },
      { first: false, last: true, line: 3, role: "body" }
    ]);
  });

  it("does not mark table-like lines inside code fences", () => {
    expect(analyzeMarkdownTableLines([
      "```",
      "| Name | Value |",
      "| --- | --- |",
      "```"
    ])).toEqual([]);
  });
});

describe("findInactiveMarkdownSyntaxMarkers", () => {
  it("does not mark syntax on the active line", () => {
    expect(findInactiveMarkdownSyntaxMarkers("## Active", true)).toEqual([]);
  });

  it("marks heading, quote, list, and fence prefixes", () => {
    expect(findInactiveMarkdownSyntaxMarkers("## Heading", false)).toEqual([{ from: 0, to: 2 }]);
    expect(findInactiveMarkdownSyntaxMarkers("> Quote", false)).toEqual([{ from: 0, to: 2 }]);
    expect(findInactiveMarkdownSyntaxMarkers("- Item", false)).toEqual([{ from: 0, to: 1 }]);
    expect(findInactiveMarkdownSyntaxMarkers("```ts", false)).toEqual([{ from: 0, to: 3 }]);
  });

  it("marks paired strong emphasis delimiters", () => {
    expect(findInactiveMarkdownSyntaxMarkers("A **bold** word", false)).toEqual([
      { from: 2, to: 4 },
      { from: 8, to: 10 }
    ]);
  });

  it("marks link and image punctuation", () => {
    expect(findInactiveMarkdownSyntaxMarkers("See [Guide](notes/guide.md)", false)).toEqual([
      { from: 4, to: 5 },
      { from: 10, to: 11 },
      { from: 11, to: 12 },
      { from: 26, to: 27 }
    ]);
    expect(findInactiveMarkdownSyntaxMarkers("![Alt](image.png)", false)[0]).toEqual({ from: 0, to: 1 });
  });
});
