import { URI } from "@typora-plus/base";
import type {
  AiTextRequest,
  AiTextResponse,
  TextFileModel
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import { workbenchAiInstructions } from "./workbenchAiRequestModel";
import {
  appendWorkbenchAiResponseToActiveNote,
  appendWorkbenchMarkdownBlock,
  runWorkbenchSummarizeActiveNoteAiAction
} from "./workbenchAiActions";

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
        getActiveModel: vi.fn(() => model()),
        updateContent: vi.fn()
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
        getActiveModel,
        updateContent: vi.fn()
      }
    };

    await expect(runWorkbenchSummarizeActiveNoteAiAction(services))
      .rejects.toThrow("No AI provider available for active note summary");
    expect(getActiveModel).not.toHaveBeenCalled();
    expect(requestText).not.toHaveBeenCalled();
  });

  it("appends an AI response to the active note through the text model", () => {
    const activeModel = model({ value: "# Note" });
    const updatedModel = model({ value: "# Note\n\nSummary\n" });
    const updateContent = vi.fn(() => updatedModel);
    const services = {
      textFileService: {
        getActiveModel: vi.fn(() => activeModel),
        updateContent
      }
    };

    expect(appendWorkbenchAiResponseToActiveNote(services, {
      value: "\nSummary\n"
    })).toBe(updatedModel);

    expect(services.textFileService.getActiveModel).toHaveBeenCalledOnce();
    expect(updateContent).toHaveBeenCalledWith("# Note\n\nSummary\n");
  });

  it("does not mutate the active note for an empty AI response", () => {
    const activeModel = model({ value: "# Note" });
    const updateContent = vi.fn();
    const services = {
      textFileService: {
        getActiveModel: vi.fn(() => activeModel),
        updateContent
      }
    };

    expect(appendWorkbenchAiResponseToActiveNote(services, {
      value: " \n\t "
    })).toBe(activeModel);

    expect(updateContent).not.toHaveBeenCalled();
  });

  it("formats appended Markdown blocks with stable separation", () => {
    expect(appendWorkbenchMarkdownBlock("", "Summary")).toBe("Summary\n");
    expect(appendWorkbenchMarkdownBlock("# Note", "Summary")).toBe("# Note\n\nSummary\n");
    expect(appendWorkbenchMarkdownBlock("# Note\n", "Summary")).toBe("# Note\n\nSummary\n");
    expect(appendWorkbenchMarkdownBlock("# Note\n\n", "Summary")).toBe("# Note\n\nSummary\n");
    expect(appendWorkbenchMarkdownBlock("# Note", "\n  indented code\n")).toBe("# Note\n\n  indented code\n");
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
