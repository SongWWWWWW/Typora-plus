import { describe, expect, it } from "vitest";
import { calculateMarkdownStats, extractOutline } from "./index";

describe("extractOutline", () => {
  it("extracts headings with line numbers and stable duplicate slugs", () => {
    const outline = extractOutline(["# Title", "", "## Intro", "## Intro"].join("\n"));

    expect(outline).toEqual([
      { id: "title", level: 1, text: "Title", line: 1 },
      { id: "intro", level: 2, text: "Intro", line: 3 },
      { id: "intro-2", level: 2, text: "Intro", line: 4 }
    ]);
  });

  it("ignores headings inside fenced code blocks", () => {
    const outline = extractOutline(["# Real", "```", "# Code", "```", "## After"].join("\n"));

    expect(outline.map((entry) => entry.text)).toEqual(["Real", "After"]);
  });
});

describe("calculateMarkdownStats", () => {
  it("counts readable text without markdown image syntax", () => {
    const stats = calculateMarkdownStats("# Title\n\nHello [world](https://example.com) ![x](a.png)");

    expect(stats.lines).toBe(3);
    expect(stats.words).toBe(3);
  });
});
