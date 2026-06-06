import { describe, expect, it } from "vitest";
import { createMarkdownHtmlExport } from "./index";

describe("createMarkdownHtmlExport", () => {
  it("renders Markdown into a complete HTML document", () => {
    const exported = createMarkdownHtmlExport({
      name: "Project.md",
      value: "# Project\n\n- Write\n- Review"
    });

    expect(exported.format).toBe("html");
    expect(exported.defaultFileName).toBe("Project.html");
    expect(exported.mimeType).toBe("text/html;charset=utf-8");
    expect(exported.value).toContain("<!doctype html>");
    expect(exported.value).toContain("<h1>Project</h1>");
    expect(exported.value).toContain("<li>Write</li>");
  });

  it("escapes titles and normalizes unsafe filenames", () => {
    const exported = createMarkdownHtmlExport({
      name: "A<bad>|name.md",
      value: "# Safe"
    });

    expect(exported.defaultFileName).toBe("A-bad--name.html");
    expect(exported.value).toContain("<title>A&lt;bad&gt;|name</title>");
  });
});
