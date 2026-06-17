import { describe, expect, it } from "vitest";
import { createMarkdownHtmlExport, createMarkdownPreviewHtml } from "./index";

describe("createMarkdownHtmlExport", () => {
  it("renders Markdown into a complete HTML document", async () => {
    const exported = await createMarkdownHtmlExport({
      name: "Project.md",
      value: "# Project\n\n- Write\n- Review"
    });

    expect(exported.format).toBe("html");
    expect(exported.defaultFileName).toBe("Project.html");
    expect(exported.mimeType).toBe("text/html;charset=utf-8");
    expect(exported.value).toContain("<!doctype html>");
    expect(exported.value).toContain("<h1>Project</h1>");
    expect(exported.value).toContain("<li>Write</li>");
    expect(exported.assets).toBeUndefined();
  });

  it("escapes titles and normalizes unsafe filenames", async () => {
    const exported = await createMarkdownHtmlExport({
      name: "A<bad>|name.md",
      value: "# Safe"
    });

    expect(exported.defaultFileName).toBe("A-bad--name.html");
    expect(exported.value).toContain("<title>A&lt;bad&gt;|name</title>");
  });

  it("escapes raw HTML instead of passing it through", async () => {
    const exported = await createMarkdownHtmlExport({
      name: "Unsafe.md",
      value: "<script>alert('x')</script>\n\n<div onclick=\"x\">Raw</div>"
    });

    expect(exported.value).not.toContain("<script>alert");
    expect(exported.value).not.toContain("<div onclick");
    expect(exported.value).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(exported.value).toContain("&lt;div onclick=&quot;x&quot;&gt;Raw&lt;/div&gt;");
  });

  it("drops unsafe link and image targets while keeping visible text", async () => {
    const exported = await createMarkdownHtmlExport({
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

  it("embeds resolved relative image sources as data URLs", async () => {
    const requests: string[] = [];
    const exported = await createMarkdownHtmlExport({
      name: "Images.md",
      value: [
        "![Local](assets/image.png)",
        "![Duplicate](assets/image.png)",
        "![Missing](assets/missing.png)",
        "![Remote](https://example.com/image.png)"
      ].join("\n\n"),
      async resolveImageSource(source) {
        requests.push(source);
        return source === "assets/image.png" ? "data:image/png;base64,AA==" : undefined;
      }
    });

    expect(requests).toEqual(["assets/image.png", "assets/missing.png"]);
    expect(exported.value).toContain("<img src=\"data:image/png;base64,AA==\" alt=\"Local\">");
    expect(exported.value).toContain("<img src=\"data:image/png;base64,AA==\" alt=\"Duplicate\">");
    expect(exported.value).toContain("<img src=\"assets/missing.png\" alt=\"Missing\">");
    expect(exported.value).toContain("Remote");
    expect(exported.value).not.toContain("src=\"https://example.com/image.png\"");
  });

  it("writes resolved workspace images as export assets in file asset mode", async () => {
    const exported = await createMarkdownHtmlExport({
      name: "Project Notes.md",
      value: [
        "![Local](assets/image.png)",
        "![Duplicate](assets/image.png)",
        "![Nested](media/nested.svg)"
      ].join("\n\n"),
      assetMode: "file",
      async resolveImageSource(source) {
        if (source === "assets/image.png") {
          return "data:image/png;base64,AA==";
        }

        return "data:image/svg+xml;base64,PHN2Zy8+";
      }
    });

    expect(exported.value).toContain("<img src=\"Project Notes_assets/image.png\" alt=\"Local\">");
    expect(exported.value).toContain("<img src=\"Project Notes_assets/image.png\" alt=\"Duplicate\">");
    expect(exported.value).toContain("<img src=\"Project Notes_assets/nested.svg\" alt=\"Nested\">");
    expect(exported.value).toContain("img-src 'self' data: file:");
    expect(exported.assets).toEqual([
      {
        relativePath: "Project Notes_assets/image.png",
        mimeType: "image/png",
        base64: "AA=="
      },
      {
        relativePath: "Project Notes_assets/nested.svg",
        mimeType: "image/svg+xml",
        base64: "PHN2Zy8+"
      }
    ]);
  });

  it("keeps resolved non-base64 image sources inline in file asset mode", async () => {
    const exported = await createMarkdownHtmlExport({
      name: "Images.md",
      value: "![Local](assets/image.png)",
      assetMode: "file",
      resolveImageSource: () => "file://C:/Notes/assets/image.png"
    });

    expect(exported.value).toContain("<img src=\"file://C:/Notes/assets/image.png\" alt=\"Local\">");
    expect(exported.assets).toBeUndefined();
  });

  it("keeps export working when image resolution fails", async () => {
    const exported = await createMarkdownHtmlExport({
      name: "Images.md",
      value: "![Local](assets/image.png)",
      async resolveImageSource() {
        throw new Error("Image unavailable");
      }
    });

    expect(exported.value).toContain("<img src=\"assets/image.png\" alt=\"Local\">");
  });
});

describe("createMarkdownPreviewHtml", () => {
  it("matches Markdown preview soft line break behavior by default", async () => {
    await expect(createMarkdownPreviewHtml({
      value: "aaa\nxxx\naaaasdfasd"
    })).resolves.toBe("<p>aaa\nxxx\naaaasdfasd</p>\n");
  });

  it("can render hard preview line breaks when explicitly requested", async () => {
    await expect(createMarkdownPreviewHtml({
      value: "aaa\nxxx\naaaasdfasd",
      breaks: true
    })).resolves.toBe("<p>aaa<br>xxx<br>aaaasdfasd</p>\n");
  });

  it("renders common GFM structures used by Feishu Markdown preview", async () => {
    const html = await createMarkdownPreviewHtml({
      value: [
        "- [x] Synced",
        "- [ ] Pending",
        "",
        "| Name | Status |",
        "| --- | --- |",
        "| Local | Feishu |",
        "",
        "~~removed~~"
      ].join("\n")
    });

    expect(html).toContain("<input checked=\"\" disabled=\"\" type=\"checkbox\">");
    expect(html).toContain("<input disabled=\"\" type=\"checkbox\">");
    expect(html).toContain("<table>");
    expect(html).toContain("<td>Local</td>");
    expect(html).toContain("<del>removed</del>");
  });

  it("uses the same safe HTML handling as export", async () => {
    const html = await createMarkdownPreviewHtml({
      value: "<script>alert('x')</script>\n\n<div onclick=\"x\">Raw</div>"
    });

    expect(html).not.toContain("<script>alert");
    expect(html).not.toContain("<div onclick");
    expect(html).toContain("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;");
    expect(html).toContain("&lt;div onclick=&quot;x&quot;&gt;Raw&lt;/div&gt;");
  });

  it("resolves local image sources for preview without changing Markdown bytes", async () => {
    const requests: string[] = [];
    const html = await createMarkdownPreviewHtml({
      value: "![Local](assets/image.png)",
      resolveImageSource(source) {
        requests.push(source);
        return "data:image/png;base64,AA==";
      }
    });

    expect(requests).toEqual(["assets/image.png"]);
    expect(html).toContain("<img src=\"data:image/png;base64,AA==\" alt=\"Local\">");
  });
});
