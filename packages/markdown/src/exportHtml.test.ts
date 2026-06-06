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

  it("escapes raw HTML instead of passing it through", () => {
    const exported = createMarkdownHtmlExport({
      name: "Unsafe.md",
      value: "<script>alert('x')</script>\n\n<div onclick=\"x\">Raw</div>"
    });

    expect(exported.value).not.toContain("<script>alert");
    expect(exported.value).not.toContain("<div onclick");
    expect(exported.value).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(exported.value).toContain("&lt;div onclick=&quot;x&quot;&gt;Raw&lt;/div&gt;");
  });

  it("drops unsafe link and image targets while keeping visible text", () => {
    const exported = createMarkdownHtmlExport({
      name: "Links.md",
      value: [
        "[Safe](https://example.com)",
        "[Unsafe](javascript:alert(1))",
        "![Local](assets/image.png)",
        "![Unsafe image](javascript:alert(1))"
      ].join("\n\n")
    });

    expect(exported.value).toContain("<a href=\"https://example.com\">Safe</a>");
    expect(exported.value).toContain("Unsafe");
    expect(exported.value).not.toContain("href=\"javascript:");
    expect(exported.value).toContain("<img src=\"assets/image.png\" alt=\"Local\">");
    expect(exported.value).toContain("Unsafe image");
    expect(exported.value).not.toContain("src=\"javascript:");
  });
});
