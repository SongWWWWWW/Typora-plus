import { describe, expect, it } from "vitest";
import { URI } from "@typora-plus/base";
import {
  configurationNumberConstraints,
  defaultConfiguration,
  MarkdownRendererService,
  type RegisteredMarkdownRenderer
} from "@typora-plus/platform";
import {
  createMarkdownCodeFenceRenderer,
  createMarkdownInlineRenderer,
  defaultMarkdownCodeFenceRendererCacheEntryLimit,
  selectMarkdownCodeFenceRenderer,
  selectMarkdownInlineRenderer
} from "./markdownRendererPreview";

describe("markdown renderer preview", () => {
  it("selects the highest-priority block renderer for a code fence language", () => {
    const service = new MarkdownRendererService();
    service.registerRendererContribution({
      id: "charts.low",
      kind: "block",
      label: "Low",
      language: "mermaid",
      priority: 1
    });
    service.registerRendererContribution({
      id: "charts.high",
      kind: "block",
      label: "High",
      language: "mermaid",
      priority: 10
    });

    expect(selectMarkdownCodeFenceRenderer(service.getRenderers(), "Mermaid")?.id).toBe("charts.high");
  });

  it("ignores inline renderers and code fences without a language", () => {
    const renderers = [
      {
        hasProvider: true,
        id: "notes.inline",
        kind: "inline",
        label: "Inline",
        language: "mermaid"
      },
      {
        hasProvider: true,
        id: "notes.chart",
        kind: "block",
        label: "Chart",
        language: "chart"
      }
    ] satisfies readonly RegisteredMarkdownRenderer[];

    expect(selectMarkdownCodeFenceRenderer(renderers, "mermaid")).toBeUndefined();
    expect(selectMarkdownCodeFenceRenderer(renderers, "")).toBeUndefined();
  });

  it("selects only inline renderers for inline renderer languages", () => {
    const renderers = [
      {
        hasProvider: true,
        id: "notes.blockBadge",
        kind: "block",
        label: "Block Badge",
        language: "badge",
        priority: 20
      },
      {
        hasProvider: true,
        id: "notes.inlineBadge",
        kind: "inline",
        label: "Inline Badge",
        language: "badge",
        priority: 1
      }
    ] satisfies readonly RegisteredMarkdownRenderer[];

    expect(selectMarkdownInlineRenderer(renderers, "Badge")?.id).toBe("notes.inlineBadge");
    expect(selectMarkdownInlineRenderer(renderers, "")).toBeUndefined();
  });

  it("renders through the platform service and preserves active document context", async () => {
    let renderedLanguage: string | undefined;
    let renderedUri: string | undefined;
    let activationCount = 0;
    let service!: MarkdownRendererService;

    service = new MarkdownRendererService({
      activationHandler: async (rendererId) => {
        activationCount += 1;
        service.registerRendererProvider({
          id: rendererId,
          render(input) {
            renderedLanguage = input.language;
            renderedUri = input.uri?.toString();
            return { html: `<div>${input.value}</div>` };
          }
        });
      }
    });
    service.registerRendererContribution({
      id: "notes.mermaid",
      kind: "block",
      label: "Mermaid",
      language: "mermaid"
    });

    const renderer = createMarkdownCodeFenceRenderer({
      getUri: () => URI.file("docs/note.md"),
      markdownRendererService: service
    });

    expect(renderer.canRender?.({ info: "mermaid", language: "Mermaid", value: "graph TD" })).toBe(true);
    await expect(renderer.render({
      info: "mermaid",
      language: "Mermaid",
      value: "graph TD"
    })).resolves.toEqual({
      html: "<div>graph TD</div>",
      label: "Mermaid",
      rendererId: "notes.mermaid"
    });
    expect(activationCount).toBe(1);
    expect(renderedLanguage).toBe("mermaid");
    expect(renderedUri).toBe("file://docs/note.md");
  });

  it("renders inline previews through the platform service and preserves active document context", async () => {
    let renderedLanguage: string | undefined;
    let renderedUri: string | undefined;
    let activationCount = 0;
    let service!: MarkdownRendererService;

    service = new MarkdownRendererService({
      activationHandler: async (rendererId) => {
        activationCount += 1;
        service.registerRendererProvider({
          id: rendererId,
          render(input) {
            renderedLanguage = input.language;
            renderedUri = input.uri?.toString();
            return { html: `<span>${input.value}</span>` };
          }
        });
      }
    });
    service.registerRendererContribution({
      id: "notes.badge",
      kind: "inline",
      label: "Badge",
      language: "badge"
    });

    const renderer = createMarkdownInlineRenderer({
      getUri: () => URI.file("docs/note.md"),
      markdownRendererService: service
    });

    expect(renderer.canRender?.({ language: "Badge", value: "done" })).toBe(true);
    await expect(renderer.render({
      language: "Badge",
      value: "done"
    })).resolves.toEqual({
      html: "<span>done</span>",
      label: "Badge",
      rendererId: "notes.badge"
    });
    expect(activationCount).toBe(1);
    expect(renderedLanguage).toBe("badge");
    expect(renderedUri).toBe("file://docs/note.md");
  });

  it("reuses render output for identical code fences", async () => {
    let renderCount = 0;
    const service = new MarkdownRendererService();
    service.registerRendererProvider({
      id: "notes.mermaid",
      render(input) {
        renderCount += 1;
        return { html: `<div>${input.value}:${renderCount}</div>` };
      }
    }, {
      kind: "block",
      label: "Mermaid",
      language: "mermaid"
    });
    const renderer = createMarkdownCodeFenceRenderer({
      getUri: () => URI.file("docs/note.md"),
      markdownRendererService: service
    });

    await expect(renderer.render({
      info: "mermaid",
      language: "mermaid",
      value: "graph TD"
    })).resolves.toEqual({
      html: "<div>graph TD:1</div>",
      label: "Mermaid",
      rendererId: "notes.mermaid"
    });
    await expect(renderer.render({
      info: "mermaid",
      language: "mermaid",
      value: "graph TD"
    })).resolves.toEqual({
      html: "<div>graph TD:1</div>",
      label: "Mermaid",
      rendererId: "notes.mermaid"
    });
    expect(renderCount).toBe(1);
  });

  it("reuses render output for identical inline previews", async () => {
    let renderCount = 0;
    const service = new MarkdownRendererService();
    service.registerRendererProvider({
      id: "notes.badge",
      render(input) {
        renderCount += 1;
        return { html: `<span>${input.value}:${renderCount}</span>` };
      }
    }, {
      kind: "inline",
      label: "Badge",
      language: "badge"
    });
    const renderer = createMarkdownInlineRenderer({
      getUri: () => URI.file("docs/note.md"),
      markdownRendererService: service
    });

    await expect(renderer.render({
      language: "badge",
      value: "done"
    })).resolves.toEqual({
      html: "<span>done:1</span>",
      label: "Badge",
      rendererId: "notes.badge"
    });
    await expect(renderer.render({
      language: "badge",
      value: "done"
    })).resolves.toEqual({
      html: "<span>done:1</span>",
      label: "Badge",
      rendererId: "notes.badge"
    });
    expect(renderCount).toBe(1);
  });

  it("keeps preview cache entries isolated by active document", async () => {
    let renderCount = 0;
    let uri = URI.file("docs/one.md");
    const service = new MarkdownRendererService();
    service.registerRendererProvider({
      id: "notes.mermaid",
      render(input) {
        renderCount += 1;
        return { html: `<div>${input.uri?.toString()}:${renderCount}</div>` };
      }
    }, {
      kind: "block",
      label: "Mermaid",
      language: "mermaid"
    });
    const renderer = createMarkdownCodeFenceRenderer({
      getUri: () => uri,
      markdownRendererService: service
    });
    const input = {
      info: "mermaid",
      language: "mermaid",
      value: "graph TD"
    };

    await renderer.render(input);
    uri = URI.file("docs/two.md");
    await expect(renderer.render(input)).resolves.toEqual({
      html: "<div>file://docs/two.md:2</div>",
      label: "Mermaid",
      rendererId: "notes.mermaid"
    });
    expect(renderCount).toBe(2);
  });

  it("evicts least recently used preview cache entries", async () => {
    let renderCount = 0;
    const service = new MarkdownRendererService();
    service.registerRendererProvider({
      id: "notes.mermaid",
      render(input) {
        renderCount += 1;
        return { html: `<div>${input.value}:${renderCount}</div>` };
      }
    }, {
      kind: "block",
      label: "Mermaid",
      language: "mermaid"
    });
    const renderer = createMarkdownCodeFenceRenderer({
      cacheEntryLimit: 2,
      getUri: () => URI.file("docs/note.md"),
      markdownRendererService: service
    });

    await renderer.render({ info: "mermaid", language: "mermaid", value: "one" });
    await renderer.render({ info: "mermaid", language: "mermaid", value: "two" });
    await renderer.render({ info: "mermaid", language: "mermaid", value: "one" });
    await renderer.render({ info: "mermaid", language: "mermaid", value: "three" });
    await expect(renderer.render({ info: "mermaid", language: "mermaid", value: "two" })).resolves.toEqual({
      html: "<div>two:4</div>",
      label: "Mermaid",
      rendererId: "notes.mermaid"
    });
    expect(renderCount).toBe(4);
  });

  it("does not keep failed render attempts in the preview cache", async () => {
    let renderCount = 0;
    const service = new MarkdownRendererService();
    service.registerRendererProvider({
      id: "notes.mermaid",
      render() {
        renderCount += 1;

        if (renderCount === 1) {
          throw new Error("temporary renderer failure");
        }

        return { html: "<div>recovered</div>" };
      }
    }, {
      kind: "block",
      label: "Mermaid",
      language: "mermaid"
    });
    const renderer = createMarkdownCodeFenceRenderer({
      getUri: () => URI.file("docs/note.md"),
      markdownRendererService: service
    });
    const input = {
      info: "mermaid",
      language: "mermaid",
      value: "graph TD"
    };

    await expect(renderer.render(input)).rejects.toThrow("temporary renderer failure");
    await expect(renderer.render(input)).resolves.toEqual({
      html: "<div>recovered</div>",
      label: "Mermaid",
      rendererId: "notes.mermaid"
    });
    expect(renderCount).toBe(2);
  });

  it("exposes a bounded default preview cache size", () => {
    expect(defaultMarkdownCodeFenceRendererCacheEntryLimit).toBe(
      defaultConfiguration.editor.rendererPreviewCacheEntries
    );
    expect(defaultMarkdownCodeFenceRendererCacheEntryLimit).toBeLessThanOrEqual(
      configurationNumberConstraints.editorRendererPreviewCacheEntries.max
    );
  });
});
