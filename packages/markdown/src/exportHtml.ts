import { marked } from "marked";

export interface MarkdownExportInput {
  readonly name: string;
  readonly value: string;
}

export interface MarkdownHtmlExportedDocument {
  readonly format: "html";
  readonly defaultFileName: string;
  readonly mimeType: string;
  readonly value: string;
}

export const markdownHtmlExportProvider = {
  format: "html",
  title: "HTML",
  exportDocument(input: MarkdownExportInput): MarkdownHtmlExportedDocument {
    return createMarkdownHtmlExport(input);
  }
} as const;

export function createMarkdownHtmlExport(input: MarkdownExportInput): MarkdownHtmlExportedDocument {
  const title = normalizeExportTitle(input.name);
  const body = marked.parse(input.value, {
    async: false,
    breaks: false,
    gfm: true
  });

  return {
    format: "html",
    defaultFileName: createHtmlExportFileName(input.name),
    mimeType: "text/html;charset=utf-8",
    value: createHtmlDocument(title, body)
  };
}

function createHtmlDocument(title: string, body: string): string {
  return [
    "<!doctype html>",
    "<html lang=\"en\">",
    "<head>",
    "<meta charset=\"utf-8\">",
    "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">",
    "<meta http-equiv=\"Content-Security-Policy\" content=\"default-src 'none'; img-src data: file:; style-src 'unsafe-inline';\">",
    `<title>${escapeHtml(title)}</title>`,
    "<style>",
    ":root{color-scheme:light dark;font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,\"Segoe UI\",sans-serif;line-height:1.65;color:#24231f;background:#f8f7f2;}",
    "body{margin:0;padding:48px 20px;}",
    "main{max-width:860px;margin:0 auto;background:#fffdf8;border:1px solid #ded8c8;border-radius:8px;padding:40px;box-shadow:0 18px 48px rgba(50,45,35,.08);}",
    "h1,h2,h3,h4,h5,h6{line-height:1.25;margin:1.35em 0 .55em;color:#1f2a2e;}",
    "h1:first-child,h2:first-child,h3:first-child{margin-top:0;}",
    "p,ul,ol,blockquote,pre,table{margin:0 0 1em;}",
    "a{color:#176b87;}",
    "blockquote{border-left:3px solid #7c9a8b;padding-left:1em;color:#5d645f;}",
    "pre{overflow:auto;border:1px solid #ded8c8;border-radius:6px;background:#f2efe7;padding:14px;}",
    "code{font-family:\"JetBrains Mono\",\"SFMono-Regular\",Consolas,monospace;font-size:.92em;background:#f2efe7;border-radius:4px;padding:.1em .3em;}",
    "pre code{background:transparent;padding:0;}",
    "table{width:100%;border-collapse:collapse;}",
    "th,td{border:1px solid #ded8c8;padding:8px 10px;text-align:left;}",
    "img{max-width:100%;height:auto;}",
    "@media (prefers-color-scheme:dark){:root{color:#ece7dc;background:#171a1b;}main{background:#202423;border-color:#343c39;}h1,h2,h3,h4,h5,h6{color:#f5f1e7;}pre,code{background:#181b1c;}th,td{border-color:#343c39;}blockquote{color:#b7c0bb;}}",
    "</style>",
    "</head>",
    "<body>",
    "<main>",
    body,
    "</main>",
    "</body>",
    "</html>"
  ].join("\n");
}

function createHtmlExportFileName(name: string): string {
  const baseName = name.trim().replace(/\.[^.]+$/, "") || "Untitled";
  const safeName = baseName.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/\s+/g, " ").trim();
  return `${safeName || "Untitled"}.html`;
}

function normalizeExportTitle(name: string): string {
  return name.trim().replace(/\.[^.]+$/, "") || "Untitled";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;");
}
