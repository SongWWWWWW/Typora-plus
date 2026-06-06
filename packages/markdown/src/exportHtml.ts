import { Renderer, marked } from "marked";

export type MarkdownImageSourceResolver = (source: string) => Promise<string | undefined> | string | undefined;

export interface MarkdownExportInput {
  readonly name: string;
  readonly value: string;
  readonly resolveImageSource?: MarkdownImageSourceResolver;
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
  exportDocument(input: MarkdownExportInput): Promise<MarkdownHtmlExportedDocument> {
    return createMarkdownHtmlExport(input);
  }
} as const;

export async function createMarkdownHtmlExport(input: MarkdownExportInput): Promise<MarkdownHtmlExportedDocument> {
  const title = normalizeExportTitle(input.name);
  const resolvedImageSources = input.resolveImageSource
    ? await resolveExportImageSources(input.value, input.resolveImageSource)
    : new Map<string, string>();
  const body = marked.parse(input.value, {
    async: false,
    breaks: false,
    gfm: true,
    renderer: createSafeHtmlExportRenderer(resolvedImageSources)
  });

  return {
    format: "html",
    defaultFileName: createHtmlExportFileName(input.name),
    mimeType: "text/html;charset=utf-8",
    value: createHtmlDocument(title, body)
  };
}

function createSafeHtmlExportRenderer(resolvedImageSources: ReadonlyMap<string, string>): Renderer<string, string> {
  const renderer = new Renderer<string, string>();

  renderer.html = ({ text }) => escapeHtml(text);
  renderer.link = ({ href, title, tokens }) => {
    const label = renderer.parser.parseInline(tokens);

    if (!isSafeExportLinkTarget(href)) {
      return label;
    }

    const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
    return `<a href="${escapeHtmlAttribute(href)}"${titleAttribute}>${label}</a>`;
  };
  renderer.image = ({ href, title, text, tokens }) => {
    const altText = tokens ? renderer.parser.parseInline(tokens, renderer.parser.textRenderer) : text;

    if (!isSafeExportImageSource(href)) {
      return escapeHtml(altText);
    }

    const source = resolvedImageSources.get(href) ?? href;
    const titleAttribute = title ? ` title="${escapeHtmlAttribute(title)}"` : "";
    return `<img src="${escapeHtmlAttribute(source)}" alt="${escapeHtmlAttribute(altText)}"${titleAttribute}>`;
  };

  return renderer;
}

async function resolveExportImageSources(
  markdown: string,
  resolveImageSource: MarkdownImageSourceResolver
): Promise<ReadonlyMap<string, string>> {
  const sources = collectResolvableImageSources(markdown);
  const resolvedSources = new Map<string, string>();

  await Promise.all([...sources].map(async (source) => {
    try {
      const resolvedSource = await resolveImageSource(source);
      if (resolvedSource && isSafeExportImageSource(resolvedSource)) {
        resolvedSources.set(source, resolvedSource);
      }
    } catch {
      // A missing or unreadable image should not block exporting the note.
    }
  }));

  return resolvedSources;
}

function collectResolvableImageSources(markdown: string): ReadonlySet<string> {
  const sources = new Set<string>();
  const tokens = marked.lexer(markdown, { gfm: true });

  collectImageSourcesFromTokens(tokens, sources);

  return sources;
}

function collectImageSourcesFromTokens(value: unknown, sources: Set<string>): void {
  if (Array.isArray(value)) {
    for (const child of value) {
      collectImageSourcesFromTokens(child, sources);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value.type === "image" && typeof value.href === "string" && isResolvableExportImageSource(value.href)) {
    sources.add(value.href);
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      collectImageSourcesFromTokens(child, sources);
    }
  }
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

function isSafeExportLinkTarget(value: string): boolean {
  const target = value.trim();

  if (!target) {
    return false;
  }

  if (target.startsWith("#") || target.startsWith("/") || target.startsWith("./") || target.startsWith("../")) {
    return true;
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return true;
  }

  return /^(https?|mailto):/i.test(target);
}

function isSafeExportImageSource(value: string): boolean {
  const target = value.trim();

  if (!target) {
    return false;
  }

  if (target.startsWith("/") || target.startsWith("./") || target.startsWith("../")) {
    return true;
  }

  if (!/^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return true;
  }

  return /^(data:image\/|blob:|file:)/i.test(target);
}

function isResolvableExportImageSource(value: string): boolean {
  const target = value.trim();

  return isSafeExportImageSource(target)
    && !target.startsWith("/")
    && !/^[a-z][a-z0-9+.-]*:/i.test(target);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtml(value);
}
