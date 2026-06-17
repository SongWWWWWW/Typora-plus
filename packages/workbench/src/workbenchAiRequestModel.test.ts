import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import {
  createWorkbenchActiveNoteAiTextRequest,
  createWorkbenchActiveNoteAiTextRequestForAction,
  createWorkbenchSummarizeActiveNoteAiTextRequest,
  workbenchAiActionTitles,
  workbenchAiInstructions,
  workbenchAiOutputFormats,
  workbenchAiRequestActions,
  type WorkbenchAiRequestMessages
} from "./workbenchAiRequestModel";
import type { TextFileModel } from "@typora-plus/platform";

describe("workbench AI request model", () => {
  it("creates active-note AI requests with stable source metadata", () => {
    const signal = new AbortController().signal;
    const relatedContext = [{
      kind: "workspace-search",
      title: "Related note",
      value: "Related context",
      uri: URI.file("/workspace/related.md")
    }];

    expect(createWorkbenchActiveNoteAiTextRequest(model(), {
      action: workbenchAiRequestActions.summarizeActiveNote,
      instruction: "Summarize",
      context: relatedContext,
      metadata: {
        action: "override",
        surface: "command",
        source: "override",
        sourceName: "override"
      },
      signal
    })).toEqual({
      instruction: "Summarize",
      input: "# Plan\n\n- Ship provider model",
      context: relatedContext,
      metadata: {
        action: "summarizeActiveNote",
        surface: "command",
        source: "active-note",
        sourceName: "plan.md",
        sourceScheme: "file",
        languageId: "markdown"
      },
      signal
    });
  });

  it("creates summarize-active-note requests without provider-specific assumptions", () => {
    expect(createWorkbenchSummarizeActiveNoteAiTextRequest(model({
      uri: URI.parse("untitled://default"),
      name: "Untitled.md",
      value: ""
    }))).toEqual({
      instruction: workbenchAiInstructions.summarizeActiveNote,
      input: "",
      metadata: {
        action: "summarizeActiveNote",
        source: "active-note",
        sourceName: "Untitled.md",
        sourceScheme: "untitled",
        languageId: "markdown"
      }
    });
  });

  it("creates active-note action requests from centralized writing instructions", () => {
    expect(workbenchAiActionTitles).toEqual({
      continueActiveNote: "Continue Active Note",
      extractTasksActiveNote: "Extract Tasks From Active Note",
      rewriteActiveNote: "Rewrite Active Note",
      summarizeActiveNote: "Summarize Active Note"
    });

    expect(createWorkbenchActiveNoteAiTextRequestForAction(
      model(),
      workbenchAiRequestActions.rewriteActiveNote,
      {
        metadata: {
          surface: "command"
        }
      }
    )).toEqual({
      instruction: workbenchAiInstructions.rewriteActiveNote,
      input: "# Plan\n\n- Ship provider model",
      metadata: {
        surface: "command",
        action: "rewriteActiveNote",
        source: "active-note",
        sourceName: "plan.md",
        sourceScheme: "file",
        languageId: "markdown"
      }
    });
  });

  it("uses injected active-note request instructions without changing request metadata", () => {
    const messages: WorkbenchAiRequestMessages = {
      instructions: {
        ...workbenchAiInstructions,
        rewriteActiveNote: "Rewrite with injected locale copy."
      }
    };

    expect(createWorkbenchActiveNoteAiTextRequestForAction(
      model(),
      workbenchAiRequestActions.rewriteActiveNote,
      {
        messages,
        metadata: {
          surface: "command"
        }
      }
    )).toEqual({
      instruction: "Rewrite with injected locale copy.",
      input: "# Plan\n\n- Ship provider model",
      metadata: {
        surface: "command",
        action: "rewriteActiveNote",
        source: "active-note",
        sourceName: "plan.md",
        sourceScheme: "file",
        languageId: "markdown"
      }
    });
  });

  it("requests structured output for active-note task extraction", () => {
    expect(createWorkbenchActiveNoteAiTextRequestForAction(
      model(),
      workbenchAiRequestActions.extractTasksActiveNote
    )).toEqual({
      instruction: workbenchAiInstructions.extractTasksActiveNote,
      input: "# Plan\n\n- Ship provider model",
      metadata: {
        action: "extractTasksActiveNote",
        source: "active-note",
        sourceName: "plan.md",
        sourceScheme: "file",
        languageId: "markdown"
      },
      outputFormat: workbenchAiOutputFormats.extractTasksActiveNote
    });

    expect(workbenchAiOutputFormats.extractTasksActiveNote).toMatchObject({
      kind: "jsonSchema",
      name: "active_note_tasks",
      strict: true,
      schema: {
        additionalProperties: false,
        required: ["groups"]
      }
    });
  });
});

function model(overrides: Partial<TextFileModel> = {}): TextFileModel {
  return {
    uri: URI.file("/workspace/plan.md"),
    name: "plan.md",
    languageId: "markdown",
    value: "# Plan\n\n- Ship provider model",
    dirty: false,
    version: 1,
    ...overrides
  };
}
