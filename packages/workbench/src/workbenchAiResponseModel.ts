import type { AiTextResponse } from "@typora-plus/platform";
import {
  workbenchAiActionTitles,
  type WorkbenchAiRequestAction
} from "./workbenchAiRequestModel";

export type WorkbenchAiResponseApplyMode = "append" | "replace";
export type WorkbenchAiResponseApplyState = "idle" | "applied" | "failed";

export interface WorkbenchAiResponse {
  readonly action: WorkbenchAiRequestAction;
  readonly applyMode: WorkbenchAiResponseApplyMode;
  readonly response: AiTextResponse;
  readonly title: string;
}

export const workbenchAiResponseApplyModes = {
  continueActiveNote: "append",
  extractTasksActiveNote: "append",
  rewriteActiveNote: "replace",
  summarizeActiveNote: "append"
} as const satisfies Record<WorkbenchAiRequestAction, WorkbenchAiResponseApplyMode>;

export function createWorkbenchAiResponse(
  action: WorkbenchAiRequestAction,
  response: AiTextResponse
): WorkbenchAiResponse {
  return {
    action,
    applyMode: workbenchAiResponseApplyModes[action],
    response,
    title: workbenchAiActionTitles[action]
  };
}

export function formatWorkbenchAiResponseApplyLabel(
  mode: WorkbenchAiResponseApplyMode,
  state: WorkbenchAiResponseApplyState
): string {
  switch (state) {
    case "applied":
      return mode === "replace" ? "Replaced" : "Appended";
    case "failed":
      return mode === "replace" ? "Replace failed" : "Append failed";
    case "idle":
      return mode === "replace" ? "Replace" : "Append";
  }
}
