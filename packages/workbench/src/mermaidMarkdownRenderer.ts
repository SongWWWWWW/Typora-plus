import type { MarkdownRendererProvider } from "@typora-plus/platform";

export const workbenchMermaidRendererId = "typora-plus.renderer.mermaid";
export const workbenchMermaidRendererLanguage = "mermaid";

interface MermaidRenderResult {
  readonly diagramType: string;
  readonly svg: string;
}

interface MermaidRuntime {
  initialize(config: Record<string, unknown>): void;
  render(id: string, value: string): Promise<MermaidRenderResult>;
}

export interface MermaidMarkdownRendererOptions {
  readonly createId?: () => string;
  readonly loadMermaid?: () => Promise<MermaidRuntime>;
}

const mermaidRendererAltText = "Mermaid diagram";

let initializedMermaidRuntime: MermaidRuntime | undefined;
let mermaidRenderCounter = 0;

export function createMermaidMarkdownRendererProvider(
  options: MermaidMarkdownRendererOptions = {}
): MarkdownRendererProvider {
  return {
    id: workbenchMermaidRendererId,
    async render(input) {
      const mermaid = await (options.loadMermaid ?? loadMermaidRuntime)();
      initializeMermaidRuntime(mermaid);
      const result = await mermaid.render(
        options.createId?.() ?? nextMermaidRenderId(),
        input.value
      );

      return {
        html: renderMermaidImageHtml(result.svg, result.diagramType)
      };
    }
  };
}

async function loadMermaidRuntime(): Promise<MermaidRuntime> {
  const module = await import("mermaid");
  return module.default;
}

function initializeMermaidRuntime(mermaid: MermaidRuntime): void {
  if (initializedMermaidRuntime === mermaid) {
    return;
  }

  mermaid.initialize({
    fontFamily: "var(--tp-font-ui)",
    htmlLabels: false,
    securityLevel: "strict",
    startOnLoad: false,
    theme: "base"
  });
  initializedMermaidRuntime = mermaid;
}

function nextMermaidRenderId(): string {
  mermaidRenderCounter += 1;
  return `tp-mermaid-${mermaidRenderCounter}`;
}

function renderMermaidImageHtml(svg: string, diagramType: string): string {
  const source = svgToDataImageSource(svg);
  const label = diagramType.trim() || workbenchMermaidRendererLanguage;

  return [
    `<figure class="tp-renderer-mermaid">`,
    `<img class="tp-renderer-mermaid-image" src="${escapeHtmlAttribute(source)}" alt="${mermaidRendererAltText}">`,
    `<figcaption class="tp-renderer-mermaid-label">${escapeHtmlText(label)}</figcaption>`,
    `</figure>`
  ].join("");
}

function svgToDataImageSource(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function escapeHtmlAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("\"", "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
