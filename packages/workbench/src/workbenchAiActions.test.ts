import { URI } from "@typora-plus/base";
import type {
  AiTextRequest,
  AiTextResponse,
  WorkspaceIndexStatus,
  TextFileModel
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  workbenchAiInstructions,
  workbenchAiRequestActions
} from "./workbenchAiRequestModel";
import {
  appendWorkbenchAiResponseToActiveNote,
  appendWorkbenchMarkdownBlock,
  applyWorkbenchAiResponseToActiveNote,
  replaceWorkbenchActiveNoteWithAiResponse,
  runWorkbenchActiveNoteAiAction,
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
    const query = vi.fn(() => [{
      uri: URI.file("/workspace/related.md"),
      name: "related.md",
      relativePath: "related.md",
      line: 4,
      preview: "Related indexed context",
      score: 10
    }]);
    const services = {
      aiService: {
        getProviders: vi.fn(() => [
          { id: "z.provider", title: "Writer" },
          { id: "a.provider", title: "Assistant" }
        ]),
        requestText
      },
      indexService: {
        getStatus: vi.fn(() => indexStatus("ready")),
        query
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
      signal,
      workspaceContext: {
        maxPreviewLength: 140,
        maxResults: 2
      }
    })).resolves.toBe(response);

    expect(services.aiService.getProviders).toHaveBeenCalledOnce();
    expect(services.textFileService.getActiveModel).toHaveBeenCalledOnce();
    expect(requestText).toHaveBeenCalledWith("a.provider", {
      instruction: workbenchAiInstructions.summarizeActiveNote,
      input: "# Note\n\nShip AI action runner.",
      context: [
        ...context,
        {
          kind: "workspace-search",
          title: "related.md:4",
          uri: URI.file("/workspace/related.md"),
          value: [
            "Path: related.md",
            "Line: 4",
            "Related indexed context"
          ].join("\n")
        }
      ],
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
    expect(query).toHaveBeenCalledWith("note", {
      maxPreviewLength: 140,
      maxResults: 3
    });
  });

  it("runs centralized active-note writing actions through the default provider", async () => {
    const response: AiTextResponse = {
      providerId: "a.provider",
      value: "Rewritten note"
    };
    const requestText = vi.fn(async (_providerId: string, _request: AiTextRequest) => response);
    const services = {
      aiService: {
        getProviders: vi.fn(() => [
          { id: "a.provider", title: "Assistant" }
        ]),
        requestText
      },
      indexService: {
        getStatus: vi.fn(() => indexStatus("idle")),
        query: vi.fn(() => [])
      },
      textFileService: {
        getActiveModel: vi.fn(() => model()),
        updateContent: vi.fn()
      }
    };

    await expect(runWorkbenchActiveNoteAiAction(
      services,
      workbenchAiRequestActions.rewriteActiveNote,
      {
        metadata: {
          surface: "command"
        }
      }
    )).resolves.toBe(response);

    expect(requestText).toHaveBeenCalledWith("a.provider", {
      instruction: workbenchAiInstructions.rewriteActiveNote,
      input: "# Note\n\nShip AI action runner.",
      metadata: {
        surface: "command",
        action: "rewriteActiveNote",
        source: "active-note",
        sourceName: "note.md",
        sourceScheme: "file",
        languageId: "markdown"
      }
    });
    expect(services.indexService.query).not.toHaveBeenCalled();
  });

  it("fails before reading the active note when no AI provider is available", async () => {
    const requestText = vi.fn();
    const getActiveModel = vi.fn(() => model());
    const services = {
      aiService: {
        getProviders: vi.fn(() => []),
        requestText
      },
      indexService: {
        getStatus: vi.fn(() => indexStatus("ready")),
        query: vi.fn(() => [])
      },
      textFileService: {
        getActiveModel,
        updateContent: vi.fn()
      }
    };

    await expect(runWorkbenchSummarizeActiveNoteAiAction(services))
      .rejects.toThrow("No AI provider available for Summarize Active Note");
    expect(getActiveModel).not.toHaveBeenCalled();
    expect(requestText).not.toHaveBeenCalled();
    expect(services.indexService.query).not.toHaveBeenCalled();
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

  it("replaces the active note through the text model for rewrite responses", () => {
    const activeModel = model({ value: "# Draft\n" });
    const updatedModel = model({ value: "# Final\n\nBody\n" });
    const updateContent = vi.fn(() => updatedModel);
    const services = {
      textFileService: {
        getActiveModel: vi.fn(() => activeModel),
        updateContent
      }
    };

    expect(replaceWorkbenchActiveNoteWithAiResponse(services, {
      value: "\n# Final\n\nBody\n"
    })).toBe(updatedModel);

    expect(services.textFileService.getActiveModel).toHaveBeenCalledOnce();
    expect(updateContent).toHaveBeenCalledWith("# Final\n\nBody\n");
  });

  it("applies AI responses through append or replace modes", () => {
    const activeModel = model({ value: "# Draft" });
    const updateContent = vi.fn((value: string) => model({ value }));
    const services = {
      textFileService: {
        getActiveModel: vi.fn(() => activeModel),
        updateContent
      }
    };

    expect(applyWorkbenchAiResponseToActiveNote(services, { value: "Next" }, "append").value)
      .toBe("# Draft\n\nNext\n");
    expect(applyWorkbenchAiResponseToActiveNote(services, { value: "Replacement" }, "replace").value)
      .toBe("Replacement\n");
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

function indexStatus(state: WorkspaceIndexStatus["state"]): WorkspaceIndexStatus {
  return {
    state,
    indexedFiles: 0,
    totalFiles: 0,
    skippedFiles: 0,
    updatedAt: 1
  };
}
