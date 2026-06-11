import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import {
  createConfiguredAiProviders,
  createNativeResponsesAiProviderFactoryOptions,
  createResponsesAiProvider,
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
