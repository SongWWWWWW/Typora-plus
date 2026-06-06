import type { URI } from "@typora-plus/base";
import type {
  MarkdownCodeFenceRenderInput,
  MarkdownCodeFenceRenderResult,
  MarkdownCodeFenceRenderer
} from "@typora-plus/editor";
import type { IMarkdownRendererService, RegisteredMarkdownRenderer } from "@typora-plus/platform";

export const defaultMarkdownCodeFenceRendererCacheEntryLimit = 40;

export interface MarkdownCodeFenceRendererOptions {
  readonly cacheEntryLimit?: number;
  readonly getUri: () => URI | undefined;
  readonly markdownRendererService: IMarkdownRendererService;
}

export function createMarkdownCodeFenceRenderer(
  options: MarkdownCodeFenceRendererOptions
): MarkdownCodeFenceRenderer {
  const cache = new Map<string, Promise<MarkdownCodeFenceRenderResult | undefined>>();
  const cacheEntryLimit = normalizeCacheEntryLimit(options.cacheEntryLimit);

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
      const cacheKey = createMarkdownCodeFenceRenderCacheKey(input, renderer.id, uri);

      if (cacheEntryLimit <= 0) {
        return renderMarkdownCodeFencePreview(options.markdownRendererService, input, renderer, language, uri);
      }

      const cached = readMarkdownCodeFenceRenderCache(cache, cacheKey);
      if (cached) {
        return cached;
      }

      const output = renderMarkdownCodeFencePreview(
        options.markdownRendererService,
        input,
        renderer,
        language,
        uri
      );

      return writeMarkdownCodeFenceRenderCache(cache, cacheKey, output, cacheEntryLimit);
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

async function renderMarkdownCodeFencePreview(
  markdownRendererService: IMarkdownRendererService,
  input: MarkdownCodeFenceRenderInput,
  renderer: RegisteredMarkdownRenderer,
  language: string | undefined,
  uri: URI | undefined
): Promise<MarkdownCodeFenceRenderResult> {
  const output = await markdownRendererService.render({
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

function createMarkdownCodeFenceRenderCacheKey(
  input: MarkdownCodeFenceRenderInput,
  rendererId: string,
  uri: URI | undefined
): string {
  return JSON.stringify([
    rendererId,
    uri?.toString() ?? "",
    input.language,
    input.info,
    input.value
  ]);
}

function readMarkdownCodeFenceRenderCache(
  cache: Map<string, Promise<MarkdownCodeFenceRenderResult | undefined>>,
  cacheKey: string
): Promise<MarkdownCodeFenceRenderResult | undefined> | undefined {
  const cached = cache.get(cacheKey);

  if (!cached) {
    return undefined;
  }

  cache.delete(cacheKey);
  cache.set(cacheKey, cached);
  return cached;
}

function writeMarkdownCodeFenceRenderCache(
  cache: Map<string, Promise<MarkdownCodeFenceRenderResult | undefined>>,
  cacheKey: string,
  output: Promise<MarkdownCodeFenceRenderResult | undefined>,
  cacheEntryLimit: number
): Promise<MarkdownCodeFenceRenderResult | undefined> {
  const cachedOutput = output.catch((error: unknown) => {
    cache.delete(cacheKey);
    throw error;
  });
  cache.set(cacheKey, cachedOutput);

  while (cache.size > cacheEntryLimit) {
    const oldestKey = cache.keys().next().value;

    if (oldestKey === undefined) {
      return cachedOutput;
    }

    cache.delete(oldestKey);
  }

  return cachedOutput;
}

function normalizeCacheEntryLimit(value: number | undefined): number {
  return Math.max(0, Math.trunc(value ?? defaultMarkdownCodeFenceRendererCacheEntryLimit));
}

function normalizeMarkdownCodeFenceLanguage(language: string): string | undefined {
  const normalized = language.trim().toLowerCase();
  return normalized ? normalized : undefined;
}
