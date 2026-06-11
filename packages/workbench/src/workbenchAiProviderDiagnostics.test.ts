import type {
  AiTextRequest,
  AiTextResponse
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchAiProviderDiagnosticActions,
  testWorkbenchAiProvider,
  workbenchAiProviderDiagnosticRequest
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
      instruction: workbenchAiProviderDiagnosticRequest.instruction,
      input: workbenchAiProviderDiagnosticRequest.input,
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
});
