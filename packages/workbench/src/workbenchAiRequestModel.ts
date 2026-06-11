import type {
  AiTextContextItem,
  AiTextRequest,
  TextFileModel
} from "@typora-plus/platform";

export const workbenchAiRequestActions = {
  summarizeActiveNote: "summarizeActiveNote"
} as const;

export type WorkbenchAiRequestAction =
  typeof workbenchAiRequestActions[keyof typeof workbenchAiRequestActions];

export const workbenchAiInstructions = {
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

export function createWorkbenchSummarizeActiveNoteAiTextRequest(
  model: TextFileModel,
  options: Omit<Partial<WorkbenchActiveNoteAiRequestOptions>, "action" | "instruction"> = {}
): AiTextRequest {
  return createWorkbenchActiveNoteAiTextRequest(model, {
    ...options,
    action: workbenchAiRequestActions.summarizeActiveNote,
    instruction: workbenchAiInstructions.summarizeActiveNote
  });
}
