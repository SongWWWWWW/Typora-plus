import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import {
  createConfiguredAiProviders,
  createNativeResponsesAiProviderFactoryOptions,
  createResponsesAiProvider,
  type NativeResponsesAiRequest,
  type ResponsesAiProviderTransportRequest
} from "./responsesAiProvider";
import type { AiProviderConfiguration } from "./configuration";

describe("Responses AI provider", () => {
  it("builds configured Responses requests through injected secrets and transport", async () => {
    const transport = vi.fn(async (_request: ResponsesAiProviderTransportRequest) => ({
      output_text: "  Summary\n",
      model: "served-model",
      usage: {
        input_tokens: 11,
        output_tokens: 7,
        total_tokens: 18
      }
    }));
    const provider = createResponsesAiProvider(configuration(), {
      readSecret: (secretRef) => secretRef === "typora-plus.ai.notes" ? " test-api-key " : undefined,
      transport
    });

    const result = await provider.requestText({
      instruction: "Summarize the note.",
      input: "# Note",
      context: [
        {
          kind: "selection",
          title: "Intro",
          value: "Important context",
          uri: URI.file("C:/Notes/a.md")
        }
      ],
      metadata: {
        action: "summarizeActiveNote",
        source: "active-note"
      }
    });

    expect(provider.id).toBe("notes.responses");
    expect(provider.title).toBe("Notes Assistant");
    expect(result).toEqual({
      value: "  Summary\n",
      model: "served-model",
      usage: {
        inputTokens: 11,
        outputTokens: 7,
        totalTokens: 18
      }
    });
    expect(transport).toHaveBeenCalledOnce();
    expect(transport.mock.calls[0]?.[0]).toMatchObject({
      url: "https://api.example.test/v1/responses",
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Authorization": "Bearer test-api-key",
        "Content-Type": "application/json"
      }
    });
    expect(JSON.parse(transport.mock.calls[0]?.[0].body ?? "{}")).toEqual({
      model: "notes-model",
      instructions: "Summarize the note.",
      input: [
        "# Note",
        [
          "Context:",
          "### selection: Intro\nURI: file://C:/Notes/a.md\nImportant context"
        ].join("\n\n")
      ].join("\n\n"),
      metadata: {
        action: "summarizeActiveNote",
        source: "active-note"
      },
      store: false
    });
  });

  it("reads message content output from Responses payloads", async () => {
    const provider = createResponsesAiProvider(configuration(), {
      readSecret: () => "test-api-key",
      transport: async () => ({
        output: [
          {
            type: "message",
            content: [
              { type: "output_text", text: "First" },
              { type: "output_text", text: "\nSecond" }
            ]
          }
        ]
      })
    });

    await expect(provider.requestText({
      instruction: "Continue.",
      input: "Draft"
    })).resolves.toEqual({
      value: "First\nSecond",
      model: "notes-model"
    });
  });

  it("allows Responses context prompt framing to be injected", async () => {
    const transport = vi.fn(async (_request: ResponsesAiProviderTransportRequest) => ({
      output_text: "Summary"
    }));
    const provider = createResponsesAiProvider(configuration(), {
      promptMessages: {
        contextHeading: "Reference Context:",
        contextItemHeading: (kind, title) => `### Reference ${title ? `${kind} / ${title}` : kind}`,
        uri: (uri) => `Source URI: ${uri}`
      },
      readSecret: () => "test-api-key",
      transport
    });

    await provider.requestText({
      instruction: "Summarize.",
      input: "# Note",
      context: [{
        kind: "workspace-search",
        title: "Related",
        value: "Related implementation detail",
        uri: URI.file("C:/Notes/related.md")
      }]
    });

    expect(JSON.parse(transport.mock.calls[0]?.[0].body ?? "{}").input).toBe([
      "# Note",
      [
        "Reference Context:",
        "### Reference workspace-search / Related\nSource URI: file://C:/Notes/related.md\nRelated implementation detail"
      ].join("\n\n")
    ].join("\n\n"));
  });

  it("adds configured Responses request controls without changing provider identity", async () => {
    const transport = vi.fn(async (_request: ResponsesAiProviderTransportRequest) => ({
      output_text: "Rewritten"
    }));
    const provider = createResponsesAiProvider(configuration({
      maxOutputTokens: 64_000,
      reasoningEffort: "minimal",
      textVerbosity: "high"
    }), {
      readSecret: () => "test-api-key",
      transport
    });

    await expect(provider.requestText({
      instruction: "Rewrite.",
      input: "Draft",
      outputFormat: {
        kind: "jsonSchema",
        name: "rewrite_result",
        description: "A rewritten Markdown document.",
        schema: {
          type: "object",
          properties: {
            markdown: {
              type: "string"
            }
          },
          required: ["markdown"],
          additionalProperties: false
        },
        strict: true
      }
    })).resolves.toEqual({
      value: "Rewritten",
      model: "notes-model"
    });

    expect(JSON.parse(transport.mock.calls[0]?.[0].body ?? "{}")).toEqual({
      model: "notes-model",
      instructions: "Rewrite.",
      input: "Draft",
      max_output_tokens: 32_000,
      reasoning: {
        effort: "minimal"
      },
      store: false,
      text: {
        format: {
          type: "json_schema",
          name: "rewrite_result",
          description: "A rewritten Markdown document.",
          schema: {
            type: "object",
            properties: {
              markdown: {
                type: "string"
              }
            },
            required: ["markdown"],
            additionalProperties: false
          },
          strict: true
        },
        verbosity: "high"
      }
    });
  });

  it("maps provider-neutral JSON output requests to Responses JSON mode", async () => {
    const transport = vi.fn(async (_request: ResponsesAiProviderTransportRequest) => ({
      output_text: "{\"tasks\":[]}"
    }));
    const provider = createResponsesAiProvider(configuration(), {
      readSecret: () => "test-api-key",
      transport
    });

    await expect(provider.requestText({
      instruction: "Extract JSON.",
      input: "- [ ] Ship",
      outputFormat: {
        kind: "json"
      }
    })).resolves.toEqual({
      value: "{\"tasks\":[]}",
      model: "notes-model"
    });

    expect(JSON.parse(transport.mock.calls[0]?.[0].body ?? "{}")).toEqual({
      model: "notes-model",
      instructions: "Extract JSON.",
      input: "- [ ] Ship",
      store: false,
      text: {
        format: {
          type: "json_object"
        }
      }
    });
  });

  it("maps request metadata through Responses metadata limits", async () => {
    const transport = vi.fn(async (_request: ResponsesAiProviderTransportRequest) => ({
      output_text: "ok"
    }));
    const provider = createResponsesAiProvider(configuration(), {
      readSecret: () => "test-api-key",
      transport
    });
    const longMetadataValue = "x".repeat(520);
    const metadata = {
      action: "summarizeActiveNote",
      longValue: longMetadataValue,
      ["k".repeat(65)]: "ignored",
      ...Object.fromEntries(Array.from({ length: 20 }, (_, index) => [`extra${index}`, `value${index}`]))
    };

    await provider.requestText({
      instruction: "Summarize.",
      input: "# Note",
      metadata
    });

    expect(JSON.parse(transport.mock.calls[0]?.[0].body ?? "{}").metadata).toEqual({
      action: "summarizeActiveNote",
      longValue: "x".repeat(512),
      extra0: "value0",
      extra1: "value1",
      extra2: "value2",
      extra3: "value3",
      extra4: "value4",
      extra5: "value5",
      extra6: "value6",
      extra7: "value7",
      extra8: "value8",
      extra9: "value9",
      extra10: "value10",
      extra11: "value11",
      extra12: "value12",
      extra13: "value13"
    });
  });

  it("can delegate request execution to a native bridge without exposing secrets", async () => {
    const provider = createResponsesAiProvider(configuration(), {
      request: async (request) => {
        expect(request).toEqual({
          endpointUrl: "https://api.example.test/v1/responses",
          secretRef: "typora-plus.ai.notes",
          body: JSON.stringify({
            model: "notes-model",
            instructions: "Summarize.",
            input: "# Note",
            store: false
          })
        });

        return { output_text: "Summary" };
      }
    });

    await expect(provider.requestText({
      instruction: "Summarize.",
      input: "# Note"
    })).resolves.toEqual({
      value: "Summary",
      model: "notes-model"
    });
  });

  it("requires a configured secret before sending a request", async () => {
    const transport = vi.fn();
    const provider = createResponsesAiProvider(configuration(), {
      readSecret: () => undefined,
      transport
    });

    await expect(provider.requestText({
      instruction: "Summarize.",
      input: "# Note"
    })).rejects.toThrow("Missing AI provider secret for notes.responses");
    expect(transport).not.toHaveBeenCalled();
  });

  it("surfaces provider error payloads", async () => {
    const provider = createResponsesAiProvider(configuration(), {
      readSecret: () => "test-api-key",
      transport: async () => ({
        error: {
          message: "rate limited"
        }
      })
    });

    await expect(provider.requestText({
      instruction: "Summarize.",
      input: "# Note"
    })).rejects.toThrow("Responses provider request failed: rate limited");
  });

  it("surfaces structured-output refusals distinctly from missing text", async () => {
    const provider = createResponsesAiProvider(configuration(), {
      readSecret: () => "test-api-key",
      transport: async () => ({
        output: [
          {
            type: "message",
            content: [
              {
                type: "refusal",
                refusal: "I cannot produce that output."
              }
            ]
          }
        ]
      })
    });

    await expect(provider.requestText({
      instruction: "Return JSON.",
      input: "Unsafe input",
      outputFormat: {
        kind: "json"
      }
    })).rejects.toThrow("Responses provider refused: I cannot produce that output.");
  });

  it("creates providers from configuration without hard-coded provider identity", () => {
    const providers = createConfiguredAiProviders([
      configuration({ id: "team.primary", title: "Team Primary" }),
      configuration({ id: "local.compatible", title: "Local Compatible" })
    ], {
      readSecret: () => "test-api-key",
      transport: async () => ({ output_text: "ok" })
    });

    expect(providers.map((provider) => ({
      id: provider.id,
      title: provider.title
    }))).toEqual([
      { id: "team.primary", title: "Team Primary" },
      { id: "local.compatible", title: "Local Compatible" }
    ]);
  });

  it("creates factory options from an available native bridge", async () => {
    const bridge = {
      isAvailable: true,
      setSecret: vi.fn(),
      deleteSecret: vi.fn(),
      requestResponses: vi.fn(async () => ({ output_text: "ok" }))
    };
    const options = createNativeResponsesAiProviderFactoryOptions(bridge);

    expect(options).toBeDefined();

    const provider = createResponsesAiProvider(configuration(), options!);
    await provider.requestText({
      instruction: "Summarize.",
      input: "# Note"
    });

    expect(bridge.requestResponses).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^responses:\d+$/),
      endpointUrl: "https://api.example.test/v1/responses",
      secretRef: "typora-plus.ai.notes",
      body: JSON.stringify({
        model: "notes-model",
        instructions: "Summarize.",
        input: "# Note",
        store: false
      })
    });
  });

  it("forwards native bridge cancellation when the request signal aborts", async () => {
    const controller = new AbortController();
    let resolveRequest: (value: unknown) => void = () => undefined;
    const bridge = {
      isAvailable: true,
      setSecret: vi.fn(),
      deleteSecret: vi.fn(),
      cancelResponses: vi.fn(),
      requestResponses: vi.fn((_request: NativeResponsesAiRequest) => new Promise<unknown>((resolve) => {
        resolveRequest = resolve;
      }))
    };
    const options = createNativeResponsesAiProviderFactoryOptions(bridge);
    const provider = createResponsesAiProvider(configuration(), options!);
    const pending = provider.requestText({
      instruction: "Summarize.",
      input: "# Note",
      signal: controller.signal
    });

    await Promise.resolve();

    const requestId = bridge.requestResponses.mock.calls[0]?.[0].requestId;
    expect(requestId).toEqual(expect.stringMatching(/^responses:\d+$/));

    controller.abort();

    expect(bridge.cancelResponses).toHaveBeenCalledWith(requestId);

    resolveRequest({ output_text: "Summary" });

    await expect(pending).resolves.toEqual({
      value: "Summary",
      model: "notes-model"
    });
  });

  it("does not start native bridge requests when the signal is already aborted", async () => {
    const controller = new AbortController();
    const bridge = {
      isAvailable: true,
      setSecret: vi.fn(),
      deleteSecret: vi.fn(),
      cancelResponses: vi.fn(),
      requestResponses: vi.fn()
    };
    const options = createNativeResponsesAiProviderFactoryOptions(bridge);
    const provider = createResponsesAiProvider(configuration(), options!);

    controller.abort();

    await expect(provider.requestText({
      instruction: "Summarize.",
      input: "# Note",
      signal: controller.signal
    })).rejects.toThrow("AI Responses request was aborted");
    expect(bridge.requestResponses).not.toHaveBeenCalled();
    expect(bridge.cancelResponses).not.toHaveBeenCalled();
  });

  it("does not create factory options when the native bridge is unavailable", () => {
    expect(createNativeResponsesAiProviderFactoryOptions(undefined)).toBeUndefined();
    expect(createNativeResponsesAiProviderFactoryOptions({
      isAvailable: false,
      setSecret: vi.fn(),
      deleteSecret: vi.fn(),
      requestResponses: vi.fn()
    })).toBeUndefined();
  });
});

function configuration(
  overrides: Partial<AiProviderConfiguration> = {}
): AiProviderConfiguration {
  return {
    id: "notes.responses",
    title: "Notes Assistant",
    kind: "responses",
    endpointUrl: "https://api.example.test/v1/responses",
    model: "notes-model",
    secretRef: "typora-plus.ai.notes",
    store: false,
    ...overrides
  };
}
