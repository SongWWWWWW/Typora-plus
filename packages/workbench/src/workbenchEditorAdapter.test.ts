import { URI } from "@typora-plus/base";
import type { IResourceService, TextFileModel, TyporaPlusConfiguration } from "@typora-plus/platform";
import { defaultConfiguration, MarkdownRendererService } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchEditorAdapter,
  createWorkbenchEditorConfiguration,
  createWorkbenchImageSourceResolver,
  createWorkbenchMarkdownRendererAdapters,
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
    expect(adapter.resolveImageSource).toBeDefined();
    expect(adapter.renderCodeFence).toBeDefined();
    expect(adapter.renderInline).toBeDefined();
  });
});

function createServices(options: { readonly resourceAvailable: boolean }): WorkbenchEditorAdapterServices {
  return {
    markdownRendererService: new MarkdownRendererService(),
    resourceService: {
      isAvailable: vi.fn(() => options.resourceAvailable),
      resolveImageSource: vi.fn((_uri, source) => Promise.resolve(`resolved:${source}`))
    } satisfies Pick<IResourceService, "isAvailable" | "resolveImageSource">
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
