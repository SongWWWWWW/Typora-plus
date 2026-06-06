import { describe, expect, it } from "vitest";
import {
  createMermaidMarkdownRendererProvider,
  workbenchMermaidRendererId
} from "./mermaidMarkdownRenderer";

describe("Mermaid Markdown renderer", () => {
  it("renders Mermaid SVG as an inert data image", async () => {
    const initializeCalls: Record<string, unknown>[] = [];
    const renderCalls: { readonly id: string; readonly value: string }[] = [];
    const provider = createMermaidMarkdownRendererProvider({
      createId: () => "tp-mermaid-test",
      loadMermaid: async () => ({
        initialize(config) {
          initializeCalls.push(config);
        },
        async render(id, value) {
          renderCalls.push({ id, value });
          return {
            diagramType: "flowchart-v2",
            svg: "<svg><text>A & B</text></svg>"
          };
        }
      })
    });

    await expect(provider.render({ value: "graph TD; A-->B", language: "mermaid" })).resolves.toEqual({
      html: [
        `<figure class="tp-renderer-mermaid">`,
        `<img class="tp-renderer-mermaid-image" src="data:image/svg+xml;charset=utf-8,%3Csvg%3E%3Ctext%3EA%20%26%20B%3C%2Ftext%3E%3C%2Fsvg%3E" alt="Mermaid diagram">`,
        `<figcaption class="tp-renderer-mermaid-label">flowchart-v2</figcaption>`,
        `</figure>`
      ].join("")
    });
    expect(provider.id).toBe(workbenchMermaidRendererId);
    expect(renderCalls).toEqual([{ id: "tp-mermaid-test", value: "graph TD; A-->B" }]);
    expect(initializeCalls).toEqual([expect.objectContaining({
      htmlLabels: false,
      securityLevel: "strict",
      startOnLoad: false
    })]);
  });
});
