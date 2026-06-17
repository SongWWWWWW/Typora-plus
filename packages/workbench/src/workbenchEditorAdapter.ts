import type {
  PastedEditorImage,
  MarkdownCodeFenceRenderer,
  MarkdownEditorConfiguration,
  MarkdownImageSourceResolver,
  MarkdownInlineRenderer
} from "@typora-plus/editor";
import type {
  IAttachmentService,
  IMarkdownRendererService,
  IResourceService,
  ITextFileService,
  TextFileModel,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import {
  createMarkdownCodeFenceRenderer,
  createMarkdownInlineRenderer
} from "./markdownRendererPreview";
import { createWorkbenchEditorLabels } from "./workbenchI18n";

export interface WorkbenchEditorAdapterServices {
  readonly attachmentService: Pick<IAttachmentService, "isAvailable" | "saveImage">;
  readonly markdownRendererService: IMarkdownRendererService;
  readonly resourceService: Pick<IResourceService, "isAvailable" | "resolveImageSource">;
  readonly textFileService: Pick<ITextFileService, "updateContent">;
}

export interface WorkbenchEditorAdapter {
  readonly configuration: MarkdownEditorConfiguration;
  readonly onChange: (value: string) => void;
  readonly onPasteImage?: (image: PastedEditorImage) => Promise<string | undefined>;
  readonly renderCodeFence: MarkdownCodeFenceRenderer;
  readonly renderInline: MarkdownInlineRenderer;
  readonly resolveImageSource?: MarkdownImageSourceResolver;
}

export function createWorkbenchEditorAdapter(
  configuration: Pick<TyporaPlusConfiguration, "appearance" | "editor">,
  services: WorkbenchEditorAdapterServices,
  model: Pick<TextFileModel, "uri">
): WorkbenchEditorAdapter {
  return {
    configuration: createWorkbenchEditorConfiguration(configuration),
    onChange: createWorkbenchEditorContentHandler(services),
    ...createWorkbenchMarkdownRendererAdapters(configuration, services, model),
    ...createWorkbenchImageSourceResolverEntry(services, model),
    ...createWorkbenchPasteImageHandlerEntry(services, model)
  };
}

export function createWorkbenchEditorConfiguration(
  configuration: Pick<TyporaPlusConfiguration, "appearance" | "editor">
): MarkdownEditorConfiguration {
  return {
    fontSize: configuration.editor.fontSize,
    lineHeight: configuration.editor.lineHeight,
    maxWidth: configuration.editor.maxWidth,
    focusMode: configuration.editor.focusMode,
    labels: createWorkbenchEditorLabels(configuration.appearance.locale),
    typewriterMode: configuration.editor.typewriterMode
  };
}

export function createWorkbenchEditorContentHandler(
  services: Pick<WorkbenchEditorAdapterServices, "textFileService">
): (value: string) => void {
  return (value) => {
    services.textFileService.updateContent(value);
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

export function createWorkbenchPasteImageHandler(
  services: Pick<WorkbenchEditorAdapterServices, "attachmentService">,
  model: Pick<TextFileModel, "uri">
): ((image: PastedEditorImage) => Promise<string | undefined>) | undefined {
  return services.attachmentService.isAvailable() && model.uri.scheme === "file"
    ? async (image) => {
      const saved = await services.attachmentService.saveImage(model.uri, image);
      return saved?.markdown;
    }
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

function createWorkbenchPasteImageHandlerEntry(
  services: Pick<WorkbenchEditorAdapterServices, "attachmentService">,
  model: Pick<TextFileModel, "uri">
): Pick<WorkbenchEditorAdapter, "onPasteImage"> {
  const onPasteImage = createWorkbenchPasteImageHandler(services, model);
  return onPasteImage ? { onPasteImage } : {};
}
