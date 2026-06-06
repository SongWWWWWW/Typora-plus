import { describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import {
  analyzeMarkdownCodeFenceLines,
  analyzeMarkdownImageBlocks,
  analyzeMarkdownLineBlocks,
  analyzeMarkdownLineBlocksForVisibleRanges,
  analyzeMarkdownMathBlocks,
  analyzeMarkdownTableLines,
  classifyMarkdownLine,
  createMarkdownTableEmptyBodyRow,
  createMarkdownTableWithDeletedBodyRow,
  createMarkdownTableWithDeletedColumn,
  createMarkdownTableWithInsertedBodyRow,
  createMarkdownTableWithInsertedColumn,
  createMarkdownTableWithUpdatedColumnAlignment,
  findMarkdownCodeFenceSourceRange,
  findMarkdownTableCellSourceRange,
  findMarkdownMathBlockSourceRange,
  findInactiveMarkdownInlineMathRanges,
  findInactiveMarkdownSyntaxMarkers,
  getNextMarkdownTableColumnAlignment,
  renderMarkdownMathExpression,
  sanitizeMarkdownRendererHtml,
  shouldReplaceInactiveCodeFenceLine,
  shouldIgnorePreviewEventTarget,
  shouldReplaceInactiveTableLine
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

  it("adds image line classes when an image block is present", () => {
    expect(classifyMarkdownLine("![Diagram](diagram.png)", false, false, {
      imageBlock: {
        altText: "Diagram",
        line: 1,
        previewable: false,
        source: "diagram.png",
        sourceLabel: "diagram.png"
      }
    })).toContain("tp-editor-image-line");
  });

  it("adds math block classes when a math state is present", () => {
    expect(classifyMarkdownLine("E = mc^2", false, false, {
      mathBlock: {
        blockEnd: 3,
        blockStart: 1,
        expression: "E = mc^2",
        line: 2,
        role: "content"
      }
    })).toContain("tp-editor-math-content");
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

  it("collects code fence language, content, and block range", () => {
    const states = analyzeMarkdownLineBlocks([
      "```ts title",
      "const value = 1;",
      "console.log(value);",
      "```"
    ]).flatMap((state) => state.codeFence ? [state.codeFence] : []);

    expect(states).toEqual([
      {
        blockEnd: 4,
        blockStart: 1,
        content: "const value = 1;\nconsole.log(value);",
        info: "ts title",
        language: "ts",
        line: 1,
        role: "open"
      },
      {
        blockEnd: 4,
        blockStart: 1,
        content: "const value = 1;\nconsole.log(value);",
        info: "ts title",
        language: "ts",
        line: 2,
        role: "content"
      },
      {
        blockEnd: 4,
        blockStart: 1,
        content: "const value = 1;\nconsole.log(value);",
        info: "ts title",
        language: "ts",
        line: 3,
        role: "content"
      },
      {
        blockEnd: 4,
        blockStart: 1,
        content: "const value = 1;\nconsole.log(value);",
        info: "ts title",
        language: "ts",
        line: 4,
        role: "close"
      }
    ]);
  });
});

describe("shouldReplaceInactiveCodeFenceLine", () => {
  it("replaces inactive fence delimiters but keeps inactive content visible", () => {
    expect(shouldReplaceInactiveCodeFenceLine("open", false)).toBe(true);
    expect(shouldReplaceInactiveCodeFenceLine("content", false)).toBe(false);
    expect(shouldReplaceInactiveCodeFenceLine("close", false)).toBe(true);
  });

  it("keeps every code fence source line visible while the block is active", () => {
    expect(shouldReplaceInactiveCodeFenceLine("open", true)).toBe(false);
    expect(shouldReplaceInactiveCodeFenceLine("content", true)).toBe(false);
    expect(shouldReplaceInactiveCodeFenceLine("close", true)).toBe(false);
  });
});

describe("findMarkdownCodeFenceSourceRange", () => {
  it("finds content inside a closed code fence", () => {
    expect(findMarkdownCodeFenceSourceRange([
      "```ts",
      "const value = 1;",
      "console.log(value);",
      "```"
    ])).toEqual({ fromColumn: 0, fromLine: 2, toColumn: 19, toLine: 3 });
  });

  it("places empty content before a closing fence", () => {
    expect(findMarkdownCodeFenceSourceRange([
      "```mermaid",
      "```"
    ])).toEqual({ fromColumn: 0, fromLine: 2, toColumn: 0, toLine: 2 });
  });

  it("keeps unclosed code fence content editable", () => {
    expect(findMarkdownCodeFenceSourceRange([
      "~~~chart",
      "value: 1"
    ])).toEqual({ fromColumn: 0, fromLine: 2, toColumn: 8, toLine: 2 });
  });
});

describe("shouldReplaceInactiveTableLine", () => {
  it("replaces inactive table lines and keeps active table source visible", () => {
    expect(shouldReplaceInactiveTableLine(false)).toBe(true);
    expect(shouldReplaceInactiveTableLine(true)).toBe(false);
  });
});

describe("shouldIgnorePreviewEventTarget", () => {
  it("only ignores preview button events", () => {
    expect(shouldIgnorePreviewEventTarget("button")).toBe(true);
    expect(shouldIgnorePreviewEventTarget("BUTTON")).toBe(true);
    expect(shouldIgnorePreviewEventTarget("span")).toBe(false);
    expect(shouldIgnorePreviewEventTarget(undefined)).toBe(false);
  });
});

describe("analyzeMarkdownLineBlocks", () => {
  it("collects code fences, image cards, and table rows in document order", () => {
    const states = analyzeMarkdownLineBlocks([
      "# Mixed",
      "```ts",
      "const value = 1",
      "```",
      "![Diagram](assets/diagram.png)",
      "$$",
      "E = mc^2",
      "$$",
      "| Name | Value |",
      "| --- | ---: |",
      "| Alpha | 1 |"
    ]);

    expect(states.map((state) => [
      state.line,
      state.codeFenceRole ?? state.imageBlock?.sourceLabel ?? state.mathBlock?.role ?? state.tableState?.role
    ])).toEqual([
      [2, "open"],
      [3, "content"],
      [4, "close"],
      [5, "diagram.png"],
      [6, "open"],
      [7, "content"],
      [8, "close"],
      [9, "header"],
      [10, "delimiter"],
      [11, "body"]
    ]);
  });

  it("does not collect image or table state inside code fences", () => {
    const states = analyzeMarkdownLineBlocks([
      "```",
      "![Code](code.png)",
      "| Name | Value |",
      "| --- | --- |",
      "```"
    ]);

    expect(states.map((state) => [state.line, state.codeFenceRole])).toEqual([
      [1, "open"],
      [2, "content"],
      [3, "content"],
      [4, "content"],
      [5, "close"]
    ]);
    expect(states.every((state) => state.codeFence && !state.imageBlock && !state.tableState)).toBe(true);
  });
});

describe("analyzeMarkdownLineBlocksForVisibleRanges", () => {
  it("normalizes unordered overlapping visible ranges and only returns visible line states", () => {
    const states = analyzeMarkdownLineBlocksForVisibleRanges({
      lineCount: 8,
      readLine: (lineNumber) => [
        "# Doc",
        "```ts",
        "const value = 1;",
        "console.log(value);",
        "```",
        "plain",
        "![Diagram](diagram.png)",
        "done"
      ][lineNumber - 1] ?? "",
      visibleRanges: [
        { first: 7, last: 7 },
        { first: 4, last: 4 },
        { first: 3, last: 4 }
      ]
    });

    expect(states.map((state) => [
      state.line,
      state.codeFenceRole ?? state.imageBlock?.sourceLabel
    ])).toEqual([
      [3, "content"],
      [4, "content"],
      [7, "diagram.png"]
    ]);
  });

  it("keeps a table preview line when the table header is outside the visible range", () => {
    const lines = Array.from({ length: 140 }, (_, index) => `line ${index + 1}`);
    lines[99] = "| Name | Value |";
    lines[100] = "| --- | ---: |";
    lines[101] = "| Alpha | 1 |";
    lines[102] = "| Beta | 2 |";
    lines[103] = "| Gamma | 3 |";

    const states = analyzeMarkdownLineBlocksForVisibleRanges({
      lineCount: lines.length,
      readLine: (lineNumber) => lines[lineNumber - 1] ?? "",
      visibleRanges: [{ first: 102, last: 103 }]
    });

    expect(states.map((state) => state.line)).toEqual([102, 103]);
    expect(states.map((state) => state.tableBlock?.previewLine)).toEqual([102, 102]);
    expect(states[0]?.tableBlock?.headerCells).toEqual(["Name", "Value"]);
  });

  it("returns no states for empty or invalid visible ranges", () => {
    expect(analyzeMarkdownLineBlocksForVisibleRanges({
      lineCount: 2,
      readLine: (lineNumber) => ["```", "code"][lineNumber - 1] ?? "",
      visibleRanges: []
    })).toEqual([]);

    expect(analyzeMarkdownLineBlocksForVisibleRanges({
      lineCount: 2,
      readLine: (lineNumber) => ["```", "code"][lineNumber - 1] ?? "",
      visibleRanges: [{ first: 2, last: 1 }]
    })).toEqual([]);
  });
});

describe("analyzeMarkdownMathBlocks", () => {
  it("marks opening, content, and closing display math lines", () => {
    expect(analyzeMarkdownMathBlocks([
      "before",
      "$$",
      "E = mc^2",
      "$$",
      "after"
    ])).toEqual([
      { blockEnd: 4, blockStart: 2, expression: "E = mc^2", line: 2, role: "open" },
      { blockEnd: 4, blockStart: 2, expression: "E = mc^2", line: 3, role: "content" },
      { blockEnd: 4, blockStart: 2, expression: "E = mc^2", line: 4, role: "close" }
    ]);
  });

  it("keeps unclosed display math content marked until the document ends", () => {
    expect(analyzeMarkdownMathBlocks([
      "$$",
      "x + y"
    ])).toEqual([
      { blockEnd: 2, blockStart: 1, expression: "x + y", line: 1, role: "open" },
      { blockEnd: 2, blockStart: 1, expression: "x + y", line: 2, role: "content" }
    ]);
  });

  it("does not collect image or table state inside display math", () => {
    const states = analyzeMarkdownLineBlocks([
      "$$",
      "![Not image](plot.png)",
      "| Not | Table |",
      "| --- | --- |",
      "$$"
    ]);

    expect(states.every((state) => state.mathBlock && !state.imageBlock && !state.tableState)).toBe(true);
  });
});

describe("renderMarkdownMathExpression", () => {
  it("renders valid display math as MathML", () => {
    const result = renderMarkdownMathExpression("x + y = z", true);

    expect(result.status).toBe("valid");
    expect(result.html).toContain("<math");
  });

  it("marks empty math expressions without calling them errors", () => {
    expect(renderMarkdownMathExpression("   ", true)).toEqual({
      source: "",
      status: "empty"
    });
  });

  it("returns a clear error result for invalid TeX", () => {
    const result = renderMarkdownMathExpression("\\frac{", false);

    expect(result.status).toBe("error");
    expect(result.source).toBe("\\frac{");
    expect(result.error).toEqual(expect.any(String));
  });
});

describe("findMarkdownMathBlockSourceRange", () => {
  it("finds the TeX source inside a closed display math block", () => {
    expect(findMarkdownMathBlockSourceRange([
      "$$",
      "E = mc^2",
      "$$"
    ])).toEqual({ fromColumn: 0, fromLine: 2, toColumn: 8, toLine: 2 });
  });

  it("keeps multiline display math source ranges", () => {
    expect(findMarkdownMathBlockSourceRange([
      "$$",
      "\\begin{aligned}",
      "x &= y + z",
      "\\end{aligned}",
      "$$"
    ])).toEqual({ fromColumn: 0, fromLine: 2, toColumn: 13, toLine: 4 });
  });

  it("places empty display math insertion before the closing fence", () => {
    expect(findMarkdownMathBlockSourceRange([
      "$$",
      "$$"
    ])).toEqual({ fromColumn: 0, fromLine: 2, toColumn: 0, toLine: 2 });
  });

  it("does not find a source range for non-math blocks", () => {
    expect(findMarkdownMathBlockSourceRange([
      "not math",
      "E = mc^2"
    ])).toBeUndefined();
  });
});

describe("findInactiveMarkdownInlineMathRanges", () => {
  it("finds inline math ranges on inactive lines", () => {
    expect(findInactiveMarkdownInlineMathRanges("A $x+y$ note", false)).toEqual([
      { expression: "x+y", from: 2, to: 7 }
    ]);
  });

  it("keeps repeated inline math source ranges distinct", () => {
    expect(findInactiveMarkdownInlineMathRanges("$x$ and $x$", false)).toEqual([
      { expression: "x", from: 0, to: 3 },
      { expression: "x", from: 8, to: 11 }
    ]);
  });

  it("keeps inline math source visible on the active line", () => {
    expect(findInactiveMarkdownInlineMathRanges("A $x+y$ note", true)).toEqual([]);
  });

  it("ignores display math delimiters, unclosed math, and escaped dollars", () => {
    expect(findInactiveMarkdownInlineMathRanges("Inline $$x+y$$ stays source", false)).toEqual([]);
    expect(findInactiveMarkdownInlineMathRanges("Inline $x+y stays source", false)).toEqual([]);
    expect(findInactiveMarkdownInlineMathRanges("Price \\$5 stays source", false)).toEqual([]);
  });

  it("does not treat common currency text as math", () => {
    expect(findInactiveMarkdownInlineMathRanges("Price $5 and $10 stay source", false)).toEqual([]);
  });

  it("ignores math-like text inside inline code spans", () => {
    expect(findInactiveMarkdownInlineMathRanges("`$x$` and $y$", false)).toEqual([
      { expression: "y", from: 10, to: 13 }
    ]);
  });
});

describe("analyzeMarkdownImageBlocks", () => {
  it("marks standalone image lines", () => {
    expect(analyzeMarkdownImageBlocks([
      "before",
      "![Diagram](assets/diagram.png)",
      "after"
    ])).toEqual([
      {
        altText: "Diagram",
        line: 2,
        previewable: false,
        source: "assets/diagram.png",
        sourceLabel: "diagram.png"
      }
    ]);
  });

  it("supports image titles and angle-bracket sources", () => {
    expect(analyzeMarkdownImageBlocks([
      "![Alt](<images/hero image.png> \"Hero title\")"
    ])).toEqual([
      {
        altText: "Alt",
        line: 1,
        previewable: false,
        source: "images/hero image.png",
        sourceLabel: "hero image.png",
        title: "Hero title"
      }
    ]);
  });

  it("marks data images as directly previewable without exposing the full source as the label", () => {
    expect(analyzeMarkdownImageBlocks([
      "![Dot](data:image/png;base64,abc)"
    ])).toEqual([
      {
        altText: "Dot",
        line: 1,
        previewable: true,
        source: "data:image/png;base64,abc",
        sourceLabel: "inline image"
      }
    ]);
  });

  it("does not mark inline text images or images inside code fences", () => {
    expect(analyzeMarkdownImageBlocks([
      "See ![Diagram](diagram.png)",
      "```",
      "![Code](code.png)",
      "```"
    ])).toEqual([]);
  });

  it("does not mark malformed image targets with trailing text", () => {
    expect(analyzeMarkdownImageBlocks([
      "![Broken](diagram.png trailing text)"
    ])).toEqual([]);
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

  it("collects table preview cells, alignments, and block range", () => {
    const tableBlocks = analyzeMarkdownLineBlocks([
      "| Name | Count | Status |",
      "| :--- | ---: | :---: |",
      "| Alpha | 1 | Ready |",
      "| Beta | 2 | Hold |"
    ]).flatMap((state) => state.tableBlock ? [state.tableBlock] : []);

    expect(tableBlocks).toEqual([
      {
        alignments: ["left", "right", "center"],
        blockEnd: 4,
        blockStart: 1,
        bodyRows: [
          ["Alpha", "1", "Ready"],
          ["Beta", "2", "Hold"]
        ],
        headerCells: ["Name", "Count", "Status"],
        line: 1,
        previewLine: 1,
        role: "header"
      },
      {
        alignments: ["left", "right", "center"],
        blockEnd: 4,
        blockStart: 1,
        bodyRows: [
          ["Alpha", "1", "Ready"],
          ["Beta", "2", "Hold"]
        ],
        headerCells: ["Name", "Count", "Status"],
        line: 2,
        previewLine: 1,
        role: "delimiter"
      },
      {
        alignments: ["left", "right", "center"],
        blockEnd: 4,
        blockStart: 1,
        bodyRows: [
          ["Alpha", "1", "Ready"],
          ["Beta", "2", "Hold"]
        ],
        headerCells: ["Name", "Count", "Status"],
        line: 3,
        previewLine: 1,
        role: "body"
      },
      {
        alignments: ["left", "right", "center"],
        blockEnd: 4,
        blockStart: 1,
        bodyRows: [
          ["Alpha", "1", "Ready"],
          ["Beta", "2", "Hold"]
        ],
        headerCells: ["Name", "Count", "Status"],
        line: 4,
        previewLine: 1,
        role: "body"
      }
    ]);
  });

  it("keeps escaped pipes inside table cells", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name \\| Alias | Status |",
      "| --- | --- |",
      "| Alpha \\| Beta | Ready \\| Hold |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(tableBlock?.headerCells).toEqual(["Name \\| Alias", "Status"]);
    expect(tableBlock?.bodyRows).toEqual([
      ["Alpha \\| Beta", "Ready \\| Hold"]
    ]);
  });

  it("keeps inline code pipes inside table cells", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Pattern | Status |",
      "| --- | --- |",
      "| `left | right` | Ready |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(tableBlock?.headerCells).toEqual(["Pattern", "Status"]);
    expect(tableBlock?.bodyRows).toEqual([
      ["`left | right`", "Ready"]
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

  it("does not treat escaped-only pipes as table separators", () => {
    expect(analyzeMarkdownTableLines([
      "Name \\| Value",
      "--- \\| ---"
    ])).toEqual([]);
  });

  it("does not treat code-span-only pipes as table separators", () => {
    expect(analyzeMarkdownTableLines([
      "Name `|` Value",
      "--- `|` ---"
    ])).toEqual([]);
  });
});

describe("Markdown table editing helpers", () => {
  it("finds source ranges for pipe-delimited table cells", () => {
    const line = "| Name | Count | Status |";

    expect(findMarkdownTableCellSourceRange(line, 0)).toEqual({ from: 2, to: 6 });
    expect(findMarkdownTableCellSourceRange(line, 1)).toEqual({ from: 9, to: 14 });
    expect(findMarkdownTableCellSourceRange(line, 2)).toEqual({ from: 17, to: 23 });
  });

  it("finds source ranges for table cells without outer pipes", () => {
    const line = "Name | Count | Status";

    expect(findMarkdownTableCellSourceRange(line, 0)).toEqual({ from: 0, to: 4 });
    expect(findMarkdownTableCellSourceRange(line, 1)).toEqual({ from: 7, to: 12 });
    expect(findMarkdownTableCellSourceRange(line, 2)).toEqual({ from: 15, to: 21 });
  });

  it("keeps escaped pipes inside source cell ranges", () => {
    const line = "| Name \\| Alias | Status |";
    const range = findMarkdownTableCellSourceRange(line, 0);

    expect(range).toEqual({ from: 2, to: 15 });
    expect(range ? line.slice(range.from, range.to) : "").toBe("Name \\| Alias");
  });

  it("keeps inline code pipes inside source cell ranges", () => {
    const line = "| `left | right` | Status |";
    const range = findMarkdownTableCellSourceRange(line, 0);

    expect(range).toEqual({ from: 2, to: 16 });
    expect(range ? line.slice(range.from, range.to) : "").toBe("`left | right`");
  });

  it("does not find a table cell range for escaped-only separators", () => {
    expect(findMarkdownTableCellSourceRange("Name \\| Value", 0)).toBeUndefined();
  });

  it("cycles column alignments in a stable order", () => {
    expect(getNextMarkdownTableColumnAlignment(undefined)).toBe("left");
    expect(getNextMarkdownTableColumnAlignment("default")).toBe("left");
    expect(getNextMarkdownTableColumnAlignment("left")).toBe("center");
    expect(getNextMarkdownTableColumnAlignment("center")).toBe("right");
    expect(getNextMarkdownTableColumnAlignment("right")).toBe("default");
  });

  it("creates an empty body row for the current table width", () => {
    expect(createMarkdownTableEmptyBodyRow(3)).toBe("|  |  |  |");
  });

  it("creates a normalized table with a blank body row appended", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithInsertedBodyRow(tableBlock!)).toEqual([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "|  |  |"
    ]);
  });

  it("inserts a blank body row at a requested index", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "| Beta | 2 |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithInsertedBodyRow(tableBlock!, { rowIndex: 1 })).toEqual([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "|  |  |",
      "| Beta | 2 |"
    ]);
  });

  it("creates a normalized table with a blank column appended", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| :--- | ---: |",
      "| Alpha | 1 |",
      "| Beta | 2 |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithInsertedColumn(tableBlock!)).toEqual([
      "| Name | Count |  |",
      "| :--- | ---: | --- |",
      "| Alpha | 1 |  |",
      "| Beta | 2 |  |"
    ]);
  });

  it("inserts a blank column at a requested index while preserving alignments", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count | Status |",
      "| :--- | ---: | :---: |",
      "| Alpha | 1 | Ready |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithInsertedColumn(tableBlock!, { columnIndex: 1 })).toEqual([
      "| Name |  | Count | Status |",
      "| :--- | --- | ---: | :---: |",
      "| Alpha |  | 1 | Ready |"
    ]);
  });

  it("preserves escaped pipe cell source while editing columns", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name \\| Alias | Count | Status |",
      "| :--- | ---: | :---: |",
      "| Alpha \\| Beta | 1 | Ready \\| Hold |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithInsertedColumn(tableBlock!, { columnIndex: 1 })).toEqual([
      "| Name \\| Alias |  | Count | Status |",
      "| :--- | --- | ---: | :---: |",
      "| Alpha \\| Beta |  | 1 | Ready \\| Hold |"
    ]);
    expect(createMarkdownTableWithDeletedColumn(tableBlock!, { columnIndex: 1 })).toEqual([
      "| Name \\| Alias | Status |",
      "| :--- | :---: |",
      "| Alpha \\| Beta | Ready \\| Hold |"
    ]);
  });

  it("preserves inline code pipe cell source while editing columns", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Expression | Count | Status |",
      "| :--- | ---: | :---: |",
      "| `a | b` | 1 | Ready |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithInsertedColumn(tableBlock!, { columnIndex: 1 })).toEqual([
      "| Expression |  | Count | Status |",
      "| :--- | --- | ---: | :---: |",
      "| `a | b` |  | 1 | Ready |"
    ]);
    expect(createMarkdownTableWithDeletedColumn(tableBlock!, { columnIndex: 1 })).toEqual([
      "| Expression | Status |",
      "| :--- | :---: |",
      "| `a | b` | Ready |"
    ]);
  });

  it("updates a column alignment while preserving table content", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count | Status |",
      "| :--- | ---: | :---: |",
      "| Alpha | 1 | Ready |",
      "| Beta | 2 | Hold |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithUpdatedColumnAlignment(tableBlock!, {
      alignment: "default",
      columnIndex: 1
    })).toEqual([
      "| Name | Count | Status |",
      "| :--- | --- | :---: |",
      "| Alpha | 1 | Ready |",
      "| Beta | 2 | Hold |"
    ]);
  });

  it("clamps requested alignment updates to a valid table column", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| --- | --- |",
      "| Alpha | 1 |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithUpdatedColumnAlignment(tableBlock!, {
      alignment: "right",
      columnIndex: 99
    })).toEqual([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |"
    ]);
  });

  it("deletes the last body row while preserving table structure", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count | Status |",
      "| --- | ---: | :---: |",
      "| Alpha | 1 | Ready |",
      "| Beta | 2 | Hold |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithDeletedBodyRow(tableBlock!)).toEqual([
      "| Name | Count | Status |",
      "| --- | ---: | :---: |",
      "| Alpha | 1 | Ready |"
    ]);
  });

  it("deletes a requested body row index", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "| Beta | 2 |",
      "| Gamma | 3 |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithDeletedBodyRow(tableBlock!, { rowIndex: 1 })).toEqual([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "| Gamma | 3 |"
    ]);
  });

  it("deletes a requested body row with a clamped row index", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "| Beta | 2 |",
      "| Gamma | 3 |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithDeletedBodyRow(tableBlock!, { rowIndex: 99 })).toEqual([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |",
      "| Beta | 2 |"
    ]);
  });

  it("keeps header and delimiter lines when deleting from a table without body rows", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| --- | ---: |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithDeletedBodyRow(tableBlock!)).toEqual([
      "| Name | Count |",
      "| --- | ---: |"
    ]);
  });

  it("deletes the last column while preserving remaining alignments and body cells", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count | Status |",
      "| :--- | ---: | :---: |",
      "| Alpha | 1 | Ready |",
      "| Beta | 2 | Hold |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithDeletedColumn(tableBlock!)).toEqual([
      "| Name | Count |",
      "| :--- | ---: |",
      "| Alpha | 1 |",
      "| Beta | 2 |"
    ]);
  });

  it("deletes a requested column index", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count | Status |",
      "| :--- | ---: | :---: |",
      "| Alpha | 1 | Ready |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithDeletedColumn(tableBlock!, { columnIndex: 1 })).toEqual([
      "| Name | Status |",
      "| :--- | :---: |",
      "| Alpha | Ready |"
    ]);
  });

  it("does not delete columns below the default minimum table width", () => {
    const tableBlock = analyzeMarkdownLineBlocks([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |"
    ]).find((state) => state.tableBlock)?.tableBlock;

    expect(tableBlock).toBeDefined();
    expect(createMarkdownTableWithDeletedColumn(tableBlock!)).toEqual([
      "| Name | Count |",
      "| --- | ---: |",
      "| Alpha | 1 |"
    ]);
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

describe("sanitizeMarkdownRendererHtml", () => {
  it("removes scripts, event handlers, style attributes, and unsafe classes", () => {
    withDom(() => {
      const html = [
        "<div class=\"tp-renderer-chart unsafe\" onclick=\"run()\" style=\"color:red\">",
        "<script>window.bad = true</script>",
        "<span class=\"tp-renderer-label note\" title=\"Label\">Text</span>",
        "</div>"
      ].join("");

      expect(renderSanitizedHtml(html)).toBe(
        "<div class=\"tp-renderer-chart\"><span class=\"tp-renderer-label\" title=\"Label\">Text</span></div>"
      );
    });
  });

  it("unwraps unsupported elements and strips URL-bearing attributes", () => {
    withDom(() => {
      const html = [
        "<a href=\"https://example.com\" title=\"Open\">link</a>",
        "<img src=\"https://example.com/chart.png\" alt=\"Chart\">",
        "<table><tbody><tr><td colspan=\"2\" rowspan=\"100\">Cell</td></tr></tbody></table>"
      ].join("");

      expect(renderSanitizedHtml(html)).toBe(
        "link<table><tbody><tr><td colspan=\"2\">Cell</td></tr></tbody></table>"
      );
    });
  });

  it("keeps safe renderer data images", () => {
    withDom(() => {
      const html = [
        "<img class=\"tp-renderer-mermaid-image external\" ",
        "src=\"data:image/svg+xml;charset=utf-8,%3Csvg%20id%3D'node-1'(~*)%3E%3C%2Fsvg%3E\" ",
        "alt=\"Mermaid diagram\" onclick=\"run()\">"
      ].join("");

      expect(renderSanitizedHtml(html)).toBe(
        "<img class=\"tp-renderer-mermaid-image\" src=\"data:image/svg+xml;charset=utf-8,%3Csvg%20id%3D'node-1'(~*)%3E%3C%2Fsvg%3E\" alt=\"Mermaid diagram\">"
      );
    });
  });

  it("drops unencoded renderer data images", () => {
    withDom(() => {
      expect(renderSanitizedHtml("<img src=\"data:image/svg+xml,<svg><script>x</script></svg>\" alt=\"Bad\">"))
        .toBe("");
    });
  });
});

function renderSanitizedHtml(html: string): string {
  const container = document.createElement("div");
  container.append(sanitizeMarkdownRendererHtml(html));

  return container.innerHTML;
}

function withDom<T>(run: () => T): T {
  const dom = new JSDOM("<!doctype html><html><body></body></html>");
  const previousDocument = Reflect.get(globalThis, "document");
  const previousNode = Reflect.get(globalThis, "Node");
  const previousElement = Reflect.get(globalThis, "Element");

  setGlobal("document", dom.window.document);
  setGlobal("Node", dom.window.Node);
  setGlobal("Element", dom.window.Element);

  try {
    return run();
  } finally {
    restoreGlobal("document", previousDocument);
    restoreGlobal("Node", previousNode);
    restoreGlobal("Element", previousElement);
    dom.window.close();
  }
}

function setGlobal(name: string, value: unknown): void {
  Object.defineProperty(globalThis, name, {
    configurable: true,
    value,
    writable: true
  });
}

function restoreGlobal(name: string, value: unknown): void {
  if (value === undefined) {
    Reflect.deleteProperty(globalThis, name);
    return;
  }

  setGlobal(name, value);
}
