import { describe, expect, it } from "vitest";
import { collectMarkdownLocalResourceReferences } from "./resourceReferences";

describe("Markdown local resource references", () => {
  it("collects local image and link resources relative to the source document", () => {
    const references = collectMarkdownLocalResourceReferences([
      "![Inline](assets/chart.png)",
      "",
      "![Reference][chart-ref]",
      "",
      "[chart-ref]: ../shared/ref%20chart.webp",
      "",
      "[Attachment](../files/spec.pdf?download=1#page=2)"
    ].join("\n"), {
      sourcePath: "notes/daily/A.md"
    });

    expect(references).toEqual([
      {
        kind: "image",
        source: "assets/chart.png",
        relativePath: "notes/daily/assets/chart.png"
      },
      {
        kind: "image",
        source: "../shared/ref%20chart.webp",
        relativePath: "notes/shared/ref chart.webp"
      },
      {
        kind: "link",
        source: "../files/spec.pdf?download=1#page=2",
        relativePath: "notes/files/spec.pdf"
      }
    ]);
  });

  it("rejects remote, absolute, fragment-only, invalid, and root-escaping references", () => {
    const references = collectMarkdownLocalResourceReferences([
      "![Remote](https://example.test/a.png)",
      "![Data](data:image/png;base64,AAAA)",
      "![Absolute](/assets/a.png)",
      "![Windows](C:\\assets\\a.png)",
      "![Network](//server/share/a.png)",
      "![Fragment](#heading)",
      "![Invalid](assets/%E0%A4%A.png)",
      "![Escapes](../../secret.png)",
      "[Mail](mailto:test@example.test)",
      "[Local](./ok.txt)"
    ].join("\n"), {
      sourcePath: "notes/A.md"
    });

    expect(references).toEqual([{
      kind: "link",
      source: "./ok.txt",
      relativePath: "notes/ok.txt"
    }]);
  });

  it("deduplicates by resolved workspace-relative path and can skip links", () => {
    const references = collectMarkdownLocalResourceReferences([
      "![A](./assets/a.png)",
      "![Again](assets/a.png)",
      "[A](assets/a.png)",
      "[PDF](assets/a.pdf)"
    ].join("\n"), {
      includeLinks: false,
      sourcePath: "notes/A.md"
    });

    expect(references).toEqual([{
      kind: "image",
      source: "./assets/a.png",
      relativePath: "notes/assets/a.png"
    }]);
  });

  it("bounds collected references", () => {
    const references = collectMarkdownLocalResourceReferences([
      "![A](a.png)",
      "![B](b.png)"
    ].join("\n"), {
      maxReferences: 1,
      sourcePath: "notes/A.md"
    });

    expect(references).toHaveLength(1);
  });

  it("requires a safe source path", () => {
    expect(() => collectMarkdownLocalResourceReferences("![A](a.png)", {
      sourcePath: "../A.md"
    })).toThrow("Markdown local resource source path");
  });
});
