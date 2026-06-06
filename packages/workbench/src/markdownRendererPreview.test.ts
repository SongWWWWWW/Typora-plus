import { describe, expect, it } from "vitest";
import { URI } from "@typora-plus/base";
import { MarkdownRendererService, type RegisteredMarkdownRenderer } from "@typora-plus/platform";
import {
  createMarkdownCodeFenceRenderer,
  selectMarkdownCodeFenceRenderer
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
});
