import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import {
  AiService,
  aiProviderRegistrationLimits,
  aiTextMetadataLimits,
  aiTextProviderResultLimits,
  aiTextRequestLimits,
  type AiTextRequest
} from "./ai";

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
      outputFormat: {
        kind: "jsonSchema",
        name: " task_list ",
        description: " Extracted tasks ",
        schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: ["tasks"],
          additionalProperties: false
        },
        strict: true
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
      outputFormat: {
        kind: "jsonSchema",
        name: "task_list",
        description: "Extracted tasks",
        schema: {
          type: "object",
          properties: {
            tasks: {
              type: "array",
              items: {
                type: "string"
              }
            }
          },
          required: ["tasks"],
          additionalProperties: false
        },
        strict: true
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

  it("bounds AI provider identity before registration and lookup", async () => {
    const service = new AiService();
    const maxId = `a${"b".repeat(aiProviderRegistrationLimits.idLength - 1)}`;
    const maxTitle = "T".repeat(aiProviderRegistrationLimits.titleLength);

    service.registerProvider(provider(` ${maxId} `, ` ${maxTitle} `));

    expect(service.getProviders()).toEqual([
      { id: maxId, title: maxTitle }
    ]);
    await expect(service.requestText(` ${maxId} `, {
      instruction: "Run",
      input: "Note"
    })).resolves.toEqual({
      providerId: maxId,
      value: "Note"
    });

    expect(() => service.registerProvider(provider("bad provider", "Bad Provider")))
      .toThrow("AI provider id is invalid: bad provider");
    expect(() => service.registerProvider(provider(`a${"b".repeat(aiProviderRegistrationLimits.idLength)}`, "Long Id")))
      .toThrow(`AI provider id must be at most ${aiProviderRegistrationLimits.idLength} characters`);
    expect(() => service.registerProvider(provider("long.title", "T".repeat(aiProviderRegistrationLimits.titleLength + 1))))
      .toThrow(`AI provider title for long.title must be at most ${aiProviderRegistrationLimits.titleLength} characters`);
    await expect(service.requestText("bad provider", {
      instruction: "Run",
      input: "Note"
    })).rejects.toThrow("AI provider id is invalid: bad provider");
  });

  it("bounds AI text request metadata before providers receive requests", async () => {
    const service = new AiService();
    const requests: AiTextRequest[] = [];

    service.registerProvider({
      id: "metadata.provider",
      title: "Metadata Provider",
      requestText(request) {
        requests.push(request);
        return { value: "ok" };
      }
    });

    const metadata = Object.fromEntries(Array.from(
      { length: aiTextMetadataLimits.entries },
      (_, index) => [`key${index}`, `value${index}`]
    ));

    await expect(service.requestText("metadata.provider", {
      instruction: "Use metadata",
      input: "Note",
      metadata
    })).resolves.toEqual({
      providerId: "metadata.provider",
      value: "ok"
    });
    expect(requests[0]?.metadata).toEqual(metadata);

    await expect(service.requestText("metadata.provider", {
      instruction: "Use metadata",
      input: "Note",
      metadata: {
        ...metadata,
        extra: "value"
      }
    })).rejects.toThrow(`AI text request metadata must contain at most ${aiTextMetadataLimits.entries} entries`);
    await expect(service.requestText("metadata.provider", {
      instruction: "Use metadata",
      input: "Note",
      metadata: {
        ["k".repeat(aiTextMetadataLimits.keyLength + 1)]: "value"
      }
    })).rejects.toThrow(`AI text request metadata key must be at most ${aiTextMetadataLimits.keyLength} characters`);
    await expect(service.requestText("metadata.provider", {
      instruction: "Use metadata",
      input: "Note",
      metadata: {
        key: "x".repeat(aiTextMetadataLimits.valueLength + 1)
      }
    })).rejects.toThrow(
      `AI text request metadata value for key must be at most ${aiTextMetadataLimits.valueLength} characters`
    );
    await expect(service.requestText("metadata.provider", {
      instruction: "Use metadata",
      input: "Note",
      metadata: {
        key: "first",
        " key ": "second"
      }
    })).rejects.toThrow("AI text request metadata must not contain duplicate key: key");
  });

  it("bounds AI text request content and context before providers receive requests", async () => {
    const service = new AiService();
    const requests: AiTextRequest[] = [];

    service.registerProvider({
      id: "bounded.provider",
      title: "Bounded Provider",
      requestText(request) {
        requests.push(request);
        return { value: "ok" };
      }
    });

    await expect(service.requestText("bounded.provider", {
      instruction: "Use context",
      input: "Note",
      context: [{
        kind: "k".repeat(aiTextRequestLimits.contextKindLength),
        title: "t".repeat(aiTextRequestLimits.contextTitleLength),
        value: "v".repeat(aiTextRequestLimits.contextValueLength)
      }],
      outputFormat: {
        kind: "jsonSchema",
        name: "n".repeat(aiTextRequestLimits.outputFormatNameLength),
        description: "d".repeat(aiTextRequestLimits.outputFormatDescriptionLength),
        schema: {
          type: "object"
        }
      }
    })).resolves.toEqual({
      providerId: "bounded.provider",
      value: "ok"
    });
    expect(requests).toHaveLength(1);

    await expect(service.requestText("bounded.provider", {
      instruction: "i".repeat(aiTextRequestLimits.instructionLength + 1),
      input: "Note"
    })).rejects.toThrow(`AI text request instruction must be at most ${aiTextRequestLimits.instructionLength} characters`);
    await expect(service.requestText("bounded.provider", {
      instruction: "Use input",
      input: "x".repeat(aiTextRequestLimits.inputLength + 1)
    })).rejects.toThrow(`AI text request input must be at most ${aiTextRequestLimits.inputLength} characters`);
    await expect(service.requestText("bounded.provider", {
      instruction: "Use context",
      input: "Note",
      context: new Array(aiTextRequestLimits.contextItemCount + 1).fill({
        kind: "note",
        value: "Context"
      })
    })).rejects.toThrow(`AI text request context must contain at most ${aiTextRequestLimits.contextItemCount} items`);
    await expect(service.requestText("bounded.provider", {
      instruction: "Use context",
      input: "Note",
      context: [{
        kind: "k".repeat(aiTextRequestLimits.contextKindLength + 1),
        value: "Context"
      }]
    })).rejects.toThrow(
      `AI text request context item 0 kind must be at most ${aiTextRequestLimits.contextKindLength} characters`
    );
    await expect(service.requestText("bounded.provider", {
      instruction: "Use output format",
      input: "Note",
      outputFormat: {
        kind: "jsonSchema",
        name: "n".repeat(aiTextRequestLimits.outputFormatNameLength + 1),
        schema: {
          type: "object"
        }
      }
    })).rejects.toThrow(
      `AI text request output format schema name must be at most ${aiTextRequestLimits.outputFormatNameLength} characters`
    );
  });

  it("bounds AI text provider result content before returning responses", async () => {
    const service = new AiService();
    service.registerProvider({
      id: "long.output",
      title: "Long Output",
      requestText() {
        return { value: "x".repeat(aiTextProviderResultLimits.valueLength + 1) };
      }
    });
    service.registerProvider({
      id: "long.model",
      title: "Long Model",
      requestText() {
        return {
          value: "ok",
          model: "m".repeat(aiTextProviderResultLimits.modelLength + 1)
        };
      }
    });
    service.registerProvider({
      id: "large.usage",
      title: "Large Usage",
      requestText() {
        return {
          value: "ok",
          usage: {
            totalTokens: aiTextProviderResultLimits.tokenUsageMax + 1
          }
        };
      }
    });

    await expect(service.requestText("long.output", {
      instruction: "Run",
      input: "Note"
    })).rejects.toThrow(
      `AI text provider result value must be at most ${aiTextProviderResultLimits.valueLength} characters`
    );
    await expect(service.requestText("long.model", {
      instruction: "Run",
      input: "Note"
    })).rejects.toThrow(
      `AI text provider result model must be at most ${aiTextProviderResultLimits.modelLength} characters`
    );
    await expect(service.requestText("large.usage", {
      instruction: "Run",
      input: "Note"
    })).rejects.toThrow("AI token usage totalTokens must be a non-negative finite number");
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
      input: "Note",
      outputFormat: {
        kind: "xml"
      } as never
    })).rejects.toThrow("AI text request output format kind must be text, json, or jsonSchema");
    await expect(service.requestText("bad.result", {
      instruction: "Summarize",
      input: "Note",
      outputFormat: {
        kind: "jsonSchema",
        name: "tasks",
        schema: []
      } as never
    })).rejects.toThrow("AI text request output format schema must be a JSON object");
    await expect(service.requestText("bad.result", {
      instruction: "Summarize",
      input: "Note",
      outputFormat: {
        kind: "jsonSchema",
        name: "tasks",
        schema: {
          type: "object"
        },
        strict: "yes"
      } as never
    })).rejects.toThrow("AI text request output format strict must be a boolean");
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
