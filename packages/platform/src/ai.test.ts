import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import { AiService, type AiTextRequest } from "./ai";

describe("ai service", () => {
  it("registers providers and delegates text requests through a normalized boundary", async () => {
    const service = new AiService();
    const requests: AiTextRequest[] = [];
    const signal = new AbortController().signal;
    const noteUri = URI.file("C:/Notes/a.md");

    service.registerProvider({
      id: " openai.responses ",
      title: " OpenAI Responses ",
      requestText(request) {
        requests.push(request);
        return {
          value: `Summary: ${request.input}`,
          model: "gpt-test",
          usage: {
            inputTokens: 10,
            outputTokens: 4,
            totalTokens: 14
          }
        };
      }
    });

    await expect(service.requestText(" openai.responses ", {
      instruction: " Summarize the note ",
      input: "Alpha project notes",
      context: [{
        kind: " workspace-search ",
        title: " Related note ",
        value: "Related context",
        uri: noteUri
      }],
      metadata: {
        " surface ": "editor"
      },
      signal
    })).resolves.toEqual({
      providerId: "openai.responses",
      value: "Summary: Alpha project notes",
      model: "gpt-test",
      usage: {
        inputTokens: 10,
        outputTokens: 4,
        totalTokens: 14
      }
    });

    expect(requests).toEqual([{
      instruction: "Summarize the note",
      input: "Alpha project notes",
      context: [{
        kind: "workspace-search",
        title: "Related note",
        value: "Related context",
        uri: noteUri
      }],
      metadata: {
        surface: "editor"
      },
      signal
    }]);
  });

  it("returns provider metadata sorted by title and id", () => {
    const service = new AiService();
    service.registerProvider(provider("z.provider", "Writer"));
    service.registerProvider(provider("a.provider", "Assistant"));
    service.registerProvider(provider("b.provider", "Assistant"));

    expect(service.getProviders()).toEqual([
      { id: "a.provider", title: "Assistant" },
      { id: "b.provider", title: "Assistant" },
      { id: "z.provider", title: "Writer" }
    ]);
  });

  it("fires provider change events when providers are registered and unregistered", () => {
    const service = new AiService();
    const snapshots: string[][] = [];
    const listener = service.onDidChangeAiProviders(() => {
      snapshots.push(service.getProviders().map((registeredProvider) => registeredProvider.id));
    });

    const disposable = service.registerProvider(provider("openai.responses", "OpenAI Responses"));
    expect(() => service.registerProvider(provider(" openai.responses ", "Duplicate")))
      .toThrow("AI provider already registered: openai.responses");

    disposable.dispose();
    disposable.dispose();
    listener.dispose();
    service.registerProvider(provider("local.model", "Local Model"));

    expect(snapshots).toEqual([
      ["openai.responses"],
      []
    ]);
  });

  it("rejects duplicate providers and missing providers", async () => {
    const service = new AiService();
    service.registerProvider(provider("openai.responses", "OpenAI Responses"));

    expect(() => service.registerProvider(provider(" openai.responses ", "Duplicate")))
      .toThrow("AI provider already registered: openai.responses");
    await expect(service.requestText("missing", {
      instruction: "Summarize",
      input: "Note"
    })).rejects.toThrow("No AI provider registered: missing");
  });

  it("unregisters providers through disposables", async () => {
    const service = new AiService();
    const disposable = service.registerProvider(provider("openai.responses", "OpenAI Responses"));

    expect(service.getProviders()).toEqual([
      { id: "openai.responses", title: "OpenAI Responses" }
    ]);

    disposable.dispose();

    expect(service.getProviders()).toEqual([]);
    await expect(service.requestText("openai.responses", {
      instruction: "Summarize",
      input: "Note"
    })).rejects.toThrow("No AI provider registered: openai.responses");
  });

  it("validates provider shape, request shape, and provider result shape", async () => {
    const service = new AiService();

    expect(() => service.registerProvider(provider("", "OpenAI Responses"))).toThrow("AI provider id must not be empty");
    expect(() => service.registerProvider(provider("openai.responses", "  ")))
      .toThrow("AI provider title for openai.responses must not be empty");
    expect(() => service.registerProvider({
      id: "openai.responses",
      title: "OpenAI Responses"
    } as never)).toThrow("AI provider for openai.responses must provide requestText");

    service.registerProvider({
      id: "bad.result",
      title: "Bad Result",
      requestText() {
        return { value: "ok", usage: { inputTokens: -1 } };
      }
    });

    await expect(service.requestText("bad.result", {
      instruction: "",
      input: "Note"
    })).rejects.toThrow("AI text request instruction must not be empty");
    await expect(service.requestText("bad.result", {
      instruction: "Summarize",
      input: "Note"
    })).rejects.toThrow("AI token usage inputTokens must be a non-negative finite number");
  });
});

function provider(id: string, title: string) {
  return {
    id,
    title,
    requestText(request: AiTextRequest) {
      return { value: request.input };
    }
  };
}
