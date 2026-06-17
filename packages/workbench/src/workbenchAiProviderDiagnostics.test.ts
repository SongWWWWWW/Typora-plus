import type {
  AiTextRequest,
  AiTextResponse
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchAiProviderDiagnosticActions,
  defaultWorkbenchAiProviderDiagnosticMessages,
  testWorkbenchAiProvider,
  type WorkbenchAiProviderDiagnosticMessages
} from "./workbenchAiProviderDiagnostics";

describe("workbench AI provider diagnostics", () => {
  it("tests a specific provider with a provider-neutral request", async () => {
    const signal = new AbortController().signal;
    const response: AiTextResponse = {
      providerId: "writer.local",
      value: "ok",
      model: "configured-model"
    };
    const requestText = vi.fn(async (_providerId: string, _request: AiTextRequest) => response);
    const services = {
      aiService: {
        requestText
      }
    };

    await expect(testWorkbenchAiProvider(services, " writer.local ", {
      metadata: {
        surface: "unit-test"
      },
      signal
    })).resolves.toBe(response);

    expect(requestText).toHaveBeenCalledWith("writer.local", {
      instruction: defaultWorkbenchAiProviderDiagnosticMessages.request.instruction,
      input: defaultWorkbenchAiProviderDiagnosticMessages.request.input,
      metadata: {
        surface: "unit-test",
        action: "testProvider",
        source: "settings"
      },
      signal
    });
  });

  it("rejects empty provider ids before calling the service", async () => {
    const requestText = vi.fn();
    const services = {
      aiService: {
        requestText
      }
    };

    await expect(testWorkbenchAiProvider(services, "   "))
      .rejects.toThrow("AI provider id is required for diagnostics");
    expect(requestText).not.toHaveBeenCalled();
  });

  it("uses injected diagnostic request messages", async () => {
    const response: AiTextResponse = {
      providerId: "writer.local",
      value: "ok"
    };
    const requestText = vi.fn(async (_providerId: string, _request: AiTextRequest) => response);
    const messages: WorkbenchAiProviderDiagnosticMessages = {
      providerIdRequired: "Provider id is required.",
      request: {
        instruction: "Return a localized diagnostic confirmation.",
        input: "Localized diagnostic input."
      }
    };
    const services = {
      aiService: {
        requestText
      }
    };

    await expect(testWorkbenchAiProvider(services, "writer.local", { messages }))
      .resolves.toBe(response);

    expect(requestText).toHaveBeenCalledWith("writer.local", expect.objectContaining({
      instruction: "Return a localized diagnostic confirmation.",
      input: "Localized diagnostic input."
    }));
    await expect(testWorkbenchAiProvider(services, "   ", { messages }))
      .rejects.toThrow("Provider id is required.");
  });

  it("creates action handlers with shared operation-error mapping", async () => {
    const operationErrors: Array<string | undefined> = [];
    const response: AiTextResponse = {
      providerId: "writer.local",
      value: "ok"
    };
    const requestText = vi.fn()
      .mockResolvedValueOnce(response)
      .mockRejectedValueOnce(new Error("Provider failed"));
    const actions = createWorkbenchAiProviderDiagnosticActions({
      aiService: {
        requestText
      }
    }, {
      setOperationError: (error) => operationErrors.push(error)
    });

    await expect(actions.testProvider("writer.local")).resolves.toBe(response);
    await expect(actions.testProvider("writer.local")).resolves.toBeUndefined();

    expect(requestText).toHaveBeenCalledTimes(2);
    expect(operationErrors).toEqual([undefined, undefined, "Provider failed"]);
  });

  it("forwards injected diagnostic messages through action handlers", async () => {
    const response: AiTextResponse = {
      providerId: "writer.local",
      value: "ok"
    };
    const requestText = vi.fn(async (_providerId: string, _request: AiTextRequest) => response);
    const actions = createWorkbenchAiProviderDiagnosticActions({
      aiService: {
        requestText
      }
    }, {
      messages: {
        providerIdRequired: "AI 服务商 ID 是诊断所必需的",
        request: {
          instruction: "返回一句简短的诊断确认。",
          input: "本地化诊断输入。"
        }
      },
      setOperationError: vi.fn()
    });

    await expect(actions.testProvider("writer.local")).resolves.toBe(response);

    expect(requestText).toHaveBeenCalledWith("writer.local", expect.objectContaining({
      instruction: "返回一句简短的诊断确认。",
      input: "本地化诊断输入。"
    }));
  });
});
