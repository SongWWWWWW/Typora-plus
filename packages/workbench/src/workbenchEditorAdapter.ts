import type {
  MarkdownCodeFenceRenderer,
  MarkdownEditorConfiguration,
  MarkdownImageSourceResolver,
  MarkdownInlineRenderer
} from "@typora-plus/editor";
import type {
  IMarkdownRendererService,
  IResourceService,
  TextFileModel,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import {
  createMarkdownCodeFenceRenderer,
  createMarkdownInlineRenderer
} from "./markdownRendererPreview";

export interface WorkbenchEditorAdapterServices {
  readonly markdownRendererService: IMarkdownRendererService;
  readonly resourceService: Pick<IResourceService, "isAvailable" | "resolveImageSource">;
}

export interface WorkbenchEditorAdapter {
  readonly configuration: MarkdownEditorConfiguration;
  readonly renderCodeFence: MarkdownCodeFenceRenderer;
  readonly renderInline: MarkdownInlineRenderer;
  readonly resolveImageSource?: MarkdownImageSourceResolver;
}

export function createWorkbenchEditorAdapter(
  configuration: Pick<TyporaPlusConfiguration, "editor">,
  services: WorkbenchEditorAdapterServices,
  model: Pick<TextFileModel, "uri">
): WorkbenchEditorAdapter {
  return {
    configuration: createWorkbenchEditorConfiguration(configuration),
    ...createWorkbenchMarkdownRendererAdapters(configuration, services, model),
    ...createWorkbenchImageSourceResolverEntry(services, model)
  };
}

export function createWorkbenchEditorConfiguration(
  configuration: Pick<TyporaPlusConfiguration, "editor">
): MarkdownEditorConfiguration {
  return {
    fontSize: configuration.editor.fontSize,
    lineHeight: configuration.editor.lineHeight,
    maxWidth: configuration.editor.maxWidth,
    focusMode: configuration.editor.focusMode,
    typewriterMode: configuration.editor.typewriterMode
  };
}

export function createWorkbenchImageSourceResolver(
  services: Pick<WorkbenchEditorAdapterServices, "resourceService">,
  model: Pick<TextFileModel, "uri">
): MarkdownImageSourceResolver | undefined {
  return services.resourceService.isAvailable() && model.uri.scheme === "file"
    ? (source: string) => services.resourceService.resolveImageSource(model.uri, source)
    : undefined;
}

export function createWorkbenchMarkdownRendererAdapters(
  configuration: Pick<TyporaPlusConfiguration, "editor">,
  services: Pick<WorkbenchEditorAdapterServices, "markdownRendererService">,
  model: Pick<TextFileModel, "uri">
): Pick<WorkbenchEditorAdapter, "renderCodeFence" | "renderInline"> {
  return {
    renderCodeFence: createMarkdownCodeFenceRenderer({
      cacheEntryLimit: configuration.editor.rendererPreviewCacheEntries,
      getUri: () => model.uri,
      markdownRendererService: services.markdownRendererService
    }),
    renderInline: createMarkdownInlineRenderer({
      cacheEntryLimit: configuration.editor.rendererPreviewCacheEntries,
      getUri: () => model.uri,
      markdownRendererService: services.markdownRendererService
    })
  };
}

function createWorkbenchImageSourceResolverEntry(
  services: Pick<WorkbenchEditorAdapterServices, "resourceService">,
  model: Pick<TextFileModel, "uri">
): Pick<WorkbenchEditorAdapter, "resolveImageSource"> {
  const resolveImageSource = createWorkbenchImageSourceResolver(services, model);
  return resolveImageSource ? { resolveImageSource } : {};
}
