import { describe, expect, it } from "vitest";
import {
  createWorkbenchAiResponse,
  formatWorkbenchAiResponseApplyLabel,
  workbenchAiResponseApplyModes
} from "./workbenchAiResponseModel";
import { workbenchAiRequestActions } from "./workbenchAiRequestModel";
import type { AiTextResponse } from "@typora-plus/platform";

describe("workbench AI response model", () => {
  it("maps active-note actions to explicit response application modes", () => {
    expect(workbenchAiResponseApplyModes).toEqual({
      continueActiveNote: "append",
      extractTasksActiveNote: "append",
      rewriteActiveNote: "replace",
      summarizeActiveNote: "append"
    });
  });

  it("creates response view models with action titles and apply modes", () => {
    const response: AiTextResponse = {
      providerId: "assistant",
      value: "Rewritten note"
    };

    expect(createWorkbenchAiResponse(
      workbenchAiRequestActions.rewriteActiveNote,
      response
    )).toEqual({
      action: "rewriteActiveNote",
      applyMode: "replace",
      response,
      title: "Rewrite Active Note"
    });
  });

  it("formats apply labels from mode and state", () => {
    expect(formatWorkbenchAiResponseApplyLabel("append", "idle")).toBe("Append");
    expect(formatWorkbenchAiResponseApplyLabel("append", "applied")).toBe("Appended");
    expect(formatWorkbenchAiResponseApplyLabel("append", "failed")).toBe("Append failed");
    expect(formatWorkbenchAiResponseApplyLabel("replace", "idle")).toBe("Replace");
    expect(formatWorkbenchAiResponseApplyLabel("replace", "applied")).toBe("Replaced");
    expect(formatWorkbenchAiResponseApplyLabel("replace", "failed")).toBe("Replace failed");
  });
});
