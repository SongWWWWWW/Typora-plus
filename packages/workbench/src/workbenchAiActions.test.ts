import { URI } from "@typora-plus/base";
import type {
  AiTextRequest,
  AiTextResponse,
  TextFileModel
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import { workbenchAiInstructions } from "./workbenchAiRequestModel";
import { runWorkbenchSummarizeActiveNoteAiAction } from "./workbenchAiActions";

describe("workbench AI actions", () => {
  it("summarizes the active note through the default AI provider", async () => {
    const signal = new AbortController().signal;
    const context = [{
      kind: "workspace-search",
      title: "Related note",
      value: "Related context",
      uri: URI.file("/workspace/related.md")
    }];
    const response: AiTextResponse = {
      providerId: "a.provider",
      value: "Summary"
    };
    const requestText = vi.fn(async (_providerId: string, _request: AiTextRequest) => response);
    const services = {
      aiService: {
        getProviders: vi.fn(() => [
          { id: "z.provider", title: "Writer" },
          { id: "a.provider", title: "Assistant" }
        ]),
        requestText
      },
      textFileService: {
        getActiveModel: vi.fn(() => model())
      }
    };

    await expect(runWorkbenchSummarizeActiveNoteAiAction(services, {
      context,
      metadata: {
        surface: "command"
      },
      signal
    })).resolves.toBe(response);

    expect(services.aiService.getProviders).toHaveBeenCalledOnce();
    expect(services.textFileService.getActiveModel).toHaveBeenCalledOnce();
    expect(requestText).toHaveBeenCalledWith("a.provider", {
      instruction: workbenchAiInstructions.summarizeActiveNote,
      input: "# Note\n\nShip AI action runner.",
      context,
      metadata: {
        surface: "command",
        action: "summarizeActiveNote",
        source: "active-note",
        sourceName: "note.md",
        sourceScheme: "file",
        languageId: "markdown"
      },
      signal
    });
  });

  it("fails before reading the active note when no AI provider is available", async () => {
    const requestText = vi.fn();
    const getActiveModel = vi.fn(() => model());
    const services = {
      aiService: {
        getProviders: vi.fn(() => []),
        requestText
      },
      textFileService: {
        getActiveModel
      }
    };

    await expect(runWorkbenchSummarizeActiveNoteAiAction(services))
      .rejects.toThrow("No AI provider available for active note summary");
    expect(getActiveModel).not.toHaveBeenCalled();
    expect(requestText).not.toHaveBeenCalled();
  });
});

function model(overrides: Partial<TextFileModel> = {}): TextFileModel {
  return {
    uri: URI.file("/workspace/note.md"),
    name: "note.md",
    languageId: "markdown",
    value: "# Note\n\nShip AI action runner.",
    dirty: false,
    version: 1,
    ...overrides
  };
}
