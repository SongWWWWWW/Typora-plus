import { URI } from "@typora-plus/base";
import type {
  IAttachmentService,
  IResourceService,
  TextFileModel,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import { defaultConfiguration, MarkdownRendererService } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchEditorAdapter,
  createWorkbenchEditorConfiguration,
  createWorkbenchEditorContentHandler,
  createWorkbenchImageSourceResolver,
  createWorkbenchMarkdownRendererAdapters,
  createWorkbenchPasteImageHandler,
  type WorkbenchEditorAdapterServices
} from "./workbenchEditorAdapter";

describe("workbench editor adapter", () => {
  it("maps Workbench editor preferences to editor configuration", () => {
    expect(createWorkbenchEditorConfiguration(configuration({
      fontSize: 19,
      lineHeight: 1.55,
      maxWidth: 920,
      focusMode: true,
      typewriterMode: true
    }))).toEqual({
      fontSize: 19,
      lineHeight: 1.55,
      maxWidth: 920,
      focusMode: true,
      typewriterMode: true
    });
  });

  it("creates content handlers through the text-file service boundary", () => {
    const services = createServices({
      resourceAvailable: false
    });
    const handler = createWorkbenchEditorContentHandler(services);

    handler("# Updated");

    expect(services.textFileService.updateContent).toHaveBeenCalledWith("# Updated");
  });

  it("creates image resolvers only for available file resources", async () => {
    const services = createServices({
      resourceAvailable: true
    });
    const fileModel = model("file:///C:/Notes/a.md");
    const resolver = createWorkbenchImageSourceResolver(services, fileModel);

    await expect(resolver?.("assets/a.png")).resolves.toBe("resolved:assets/a.png");
    expect(services.resourceService.resolveImageSource).toHaveBeenCalledWith(fileModel.uri, "assets/a.png");
    expect(createWorkbenchImageSourceResolver(services, model("untitled://default"))).toBeUndefined();

    const unavailableServices = createServices({
      resourceAvailable: false
    });

    expect(createWorkbenchImageSourceResolver(unavailableServices, fileModel)).toBeUndefined();
    expect(unavailableServices.resourceService.resolveImageSource).not.toHaveBeenCalled();
  });

  it("creates paste-image handlers only for available file attachments", async () => {
    const services = createServices({
      attachmentAvailable: true,
      resourceAvailable: false
    });
    const fileModel = model("file:///C:/Notes/a.md");
    const handler = createWorkbenchPasteImageHandler(services, fileModel);

    await expect(handler?.({
      name: "chart.png",
      mimeType: "image/png",
      base64: "abc"
    })).resolves.toBe("![chart](assets/chart.png)");
    expect(services.attachmentService.saveImage).toHaveBeenCalledWith(fileModel.uri, {
      name: "chart.png",
      mimeType: "image/png",
      base64: "abc"
    });
    expect(createWorkbenchPasteImageHandler(services, model("untitled://default"))).toBeUndefined();

    const unavailableServices = createServices({
      attachmentAvailable: false,
      resourceAvailable: false
    });

    expect(createWorkbenchPasteImageHandler(unavailableServices, fileModel)).toBeUndefined();
    expect(unavailableServices.attachmentService.saveImage).not.toHaveBeenCalled();
  });

  it("creates renderer adapters with active document context and configured cache limits", async () => {
    let renderCount = 0;
    const service = new MarkdownRendererService();
    service.registerRendererProvider({
      id: "notes.chart",
      render(input) {
        renderCount += 1;
        return {
          html: `<div>${input.uri?.toString()}:${input.value}:${renderCount}</div>`
        };
      }
    }, {
      kind: "block",
      label: "Chart",
      language: "chart"
    });
    const adapters = createWorkbenchMarkdownRendererAdapters(configuration({
      rendererPreviewCacheEntries: 0
    }), {
      markdownRendererService: service
    }, model("file:///C:/Notes/chart.md"));

    await expect(adapters.renderCodeFence.render({
      info: "chart",
      language: "chart",
      value: "A"
    })).resolves.toEqual({
      html: "<div>file:///C:/Notes/chart.md:A:1</div>",
      label: "Chart",
      rendererId: "notes.chart"
    });
    await adapters.renderCodeFence.render({
      info: "chart",
      language: "chart",
      value: "A"
    });
    expect(renderCount).toBe(2);
  });

  it("creates the complete editor adapter from Workbench services and model state", () => {
    const services = createServices({
      resourceAvailable: true
    });
    const adapter = createWorkbenchEditorAdapter(configuration({
      focusMode: true
    }), services, model("file:///C:/Notes/a.md"));

    expect(adapter.configuration.focusMode).toBe(true);
    adapter.onChange("# Updated");
    expect(services.textFileService.updateContent).toHaveBeenCalledWith("# Updated");
    expect(adapter.onPasteImage).toBeDefined();
    expect(adapter.resolveImageSource).toBeDefined();
    expect(adapter.renderCodeFence).toBeDefined();
    expect(adapter.renderInline).toBeDefined();
  });
});

function createServices(options: {
  readonly attachmentAvailable?: boolean;
  readonly resourceAvailable: boolean;
}): WorkbenchEditorAdapterServices {
  return {
    attachmentService: {
      isAvailable: vi.fn(() => options.attachmentAvailable ?? true),
      saveImage: vi.fn(async () => ({
        uri: URI.file("C:/Notes/assets/chart.png"),
        relativePath: "assets/chart.png",
        markdown: "![chart](assets/chart.png)"
      }))
    } satisfies Pick<IAttachmentService, "isAvailable" | "saveImage">,
    markdownRendererService: new MarkdownRendererService(),
    resourceService: {
      isAvailable: vi.fn(() => options.resourceAvailable),
      resolveImageSource: vi.fn((_uri, source) => Promise.resolve(`resolved:${source}`))
    } satisfies Pick<IResourceService, "isAvailable" | "resolveImageSource">,
    textFileService: {
      updateContent: vi.fn()
    }
  };
}

function configuration(
  editor: Partial<TyporaPlusConfiguration["editor"]> = {}
): Pick<TyporaPlusConfiguration, "editor"> {
  return {
    editor: {
      ...defaultConfiguration.editor,
      ...editor
    }
  };
}

function model(uri: string): Pick<TextFileModel, "uri"> {
  return {
    uri: URI.parse(uri)
  };
}
