import type {
  AiTextContextItem,
  AiTextRequest,
  TextFileModel
} from "@typora-plus/platform";

export const workbenchAiRequestActions = {
  continueActiveNote: "continueActiveNote",
  extractTasksActiveNote: "extractTasksActiveNote",
  rewriteActiveNote: "rewriteActiveNote",
  summarizeActiveNote: "summarizeActiveNote"
} as const;

export type WorkbenchAiRequestAction =
  typeof workbenchAiRequestActions[keyof typeof workbenchAiRequestActions];

export const workbenchAiActionTitles = {
  continueActiveNote: "Continue Active Note",
  extractTasksActiveNote: "Extract Tasks From Active Note",
  rewriteActiveNote: "Rewrite Active Note",
  summarizeActiveNote: "Summarize Active Note"
} as const satisfies Record<WorkbenchAiRequestAction, string>;

export const workbenchAiInstructions = {
  continueActiveNote: [
    "Continue the active Markdown note from its existing context.",
    "Preserve the note's structure, tone, heading style, links, and task-list syntax.",
    "Return only the new Markdown content that should be appended."
  ].join(" "),
  extractTasksActiveNote: [
    "Extract actionable tasks from the active Markdown note.",
    "Return a concise Markdown task list grouped by topic when useful.",
    "Preserve concrete owners, dates, and blockers from the source, and do not invent tasks."
  ].join(" "),
  rewriteActiveNote: [
    "Rewrite the active Markdown note for clarity and flow.",
    "Preserve meaning, Markdown structure, links, code fences, tables, and task-list state.",
    "Return only the rewritten Markdown content and do not invent facts."
  ].join(" "),
  summarizeActiveNote: [
    "Summarize the active Markdown note.",
    "Preserve important decisions, open tasks, and unresolved questions.",
    "Keep the response concise and do not invent facts."
  ].join(" ")
} as const satisfies Record<WorkbenchAiRequestAction, string>;

export interface WorkbenchActiveNoteAiRequestOptions {
  readonly action: WorkbenchAiRequestAction;
  readonly instruction: string;
  readonly context?: readonly AiTextContextItem[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export function createWorkbenchActiveNoteAiTextRequest(
  model: TextFileModel,
  options: WorkbenchActiveNoteAiRequestOptions
): AiTextRequest {
  return {
    instruction: options.instruction,
    input: model.value,
    ...(options.context !== undefined ? { context: options.context } : {}),
    metadata: {
      ...options.metadata,
      action: options.action,
      source: "active-note",
      sourceName: model.name,
      sourceScheme: model.uri.scheme,
      languageId: model.languageId
    },
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  };
}

export function createWorkbenchActiveNoteAiTextRequestForAction(
  model: TextFileModel,
  action: WorkbenchAiRequestAction,
  options: Omit<Partial<WorkbenchActiveNoteAiRequestOptions>, "action" | "instruction"> = {}
): AiTextRequest {
  return createWorkbenchActiveNoteAiTextRequest(model, {
    ...options,
    action,
    instruction: workbenchAiInstructions[action]
  });
}

export function createWorkbenchSummarizeActiveNoteAiTextRequest(
  model: TextFileModel,
  options: Omit<Partial<WorkbenchActiveNoteAiRequestOptions>, "action" | "instruction"> = {}
): AiTextRequest {
  return createWorkbenchActiveNoteAiTextRequestForAction(
    model,
    workbenchAiRequestActions.summarizeActiveNote,
    options
  );
}
