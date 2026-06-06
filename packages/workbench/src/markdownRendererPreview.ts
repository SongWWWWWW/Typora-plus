import type { URI } from "@typora-plus/base";
import type { MarkdownCodeFenceRenderer } from "@typora-plus/editor";
import type { IMarkdownRendererService, RegisteredMarkdownRenderer } from "@typora-plus/platform";

export interface MarkdownCodeFenceRendererOptions {
  readonly getUri: () => URI | undefined;
  readonly markdownRendererService: IMarkdownRendererService;
}

export function createMarkdownCodeFenceRenderer(
  options: MarkdownCodeFenceRendererOptions
): MarkdownCodeFenceRenderer {
  return {
    canRender(input) {
      return selectMarkdownCodeFenceRenderer(
        options.markdownRendererService.getRenderers(),
        input.language
      ) !== undefined;
    },
    async render(input) {
      const renderer = selectMarkdownCodeFenceRenderer(
        options.markdownRendererService.getRenderers(),
        input.language
      );

      if (!renderer) {
        return undefined;
      }

      const language = normalizeMarkdownCodeFenceLanguage(input.language);
      const uri = options.getUri();
      const output = await options.markdownRendererService.render({
        value: input.value,
        ...(language ? { language } : {}),
        ...(uri ? { uri } : {})
      }, renderer.id);

      return {
        html: output.html,
        label: renderer.label,
        rendererId: renderer.id
      };
    }
  };
}

export function selectMarkdownCodeFenceRenderer(
  renderers: readonly RegisteredMarkdownRenderer[],
  language: string
): RegisteredMarkdownRenderer | undefined {
  const normalizedLanguage = normalizeMarkdownCodeFenceLanguage(language);

  if (!normalizedLanguage) {
    return undefined;
  }

  return renderers.find((renderer) =>
    renderer.kind === "block" &&
    renderer.language?.toLowerCase() === normalizedLanguage
  );
}

function normalizeMarkdownCodeFenceLanguage(language: string): string | undefined {
  const normalized = language.trim().toLowerCase();
  return normalized ? normalized : undefined;
}
