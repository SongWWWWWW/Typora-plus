import type {
  AiTextContextItem,
  AiTextOutputFormat,
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

export interface WorkbenchAiRequestMessages {
  readonly instructions: Readonly<Record<WorkbenchAiRequestAction, string>>;
}

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
    "Return JSON matching the requested schema with task groups and concrete task fields.",
    "Use null for missing owners, dates, blockers, or topics, and do not invent tasks."
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

export const defaultWorkbenchAiRequestMessages: WorkbenchAiRequestMessages = {
  instructions: workbenchAiInstructions
};

const workbenchAiStructuredOutputFormats = {
  extractTasksActiveNote: {
    kind: "jsonSchema",
    name: "active_note_tasks",
    description: "Actionable tasks extracted from the active Markdown note.",
    schema: {
      type: "object",
      properties: {
        groups: {
          type: "array",
          items: {
            type: "object",
            properties: {
              topic: {
                type: ["string", "null"]
              },
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    title: {
                      type: "string"
                    },
                    owner: {
                      type: ["string", "null"]
                    },
                    due: {
                      type: ["string", "null"]
                    },
                    blocker: {
                      type: ["string", "null"]
                    },
                    done: {
                      type: "boolean"
                    }
                  },
                  required: ["title", "owner", "due", "blocker", "done"],
                  additionalProperties: false
                }
              }
            },
            required: ["topic", "tasks"],
            additionalProperties: false
          }
        }
      },
      required: ["groups"],
      additionalProperties: false
    },
    strict: true
  }
} as const satisfies Partial<Record<WorkbenchAiRequestAction, AiTextOutputFormat>>;

export const workbenchAiOutputFormats: Partial<Record<WorkbenchAiRequestAction, AiTextOutputFormat>> =
  workbenchAiStructuredOutputFormats;

export interface WorkbenchActiveNoteAiRequestOptions {
  readonly action: WorkbenchAiRequestAction;
  readonly instruction: string;
  readonly context?: readonly AiTextContextItem[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly outputFormat?: AiTextOutputFormat;
  readonly signal?: AbortSignal;
}

export interface WorkbenchActiveNoteAiRequestForActionOptions
  extends Omit<Partial<WorkbenchActiveNoteAiRequestOptions>, "action" | "instruction"> {
  readonly messages?: WorkbenchAiRequestMessages;
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
    ...(options.outputFormat !== undefined ? { outputFormat: options.outputFormat } : {}),
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  };
}

export function createWorkbenchActiveNoteAiTextRequestForAction(
  model: TextFileModel,
  action: WorkbenchAiRequestAction,
  options: WorkbenchActiveNoteAiRequestForActionOptions = {}
): AiTextRequest {
  const { messages, outputFormat, ...requestOptions } = options;
  const requestMessages = messages ?? defaultWorkbenchAiRequestMessages;
  const resolvedOutputFormat = outputFormat ?? workbenchAiOutputFormats[action];

  return createWorkbenchActiveNoteAiTextRequest(model, {
    ...requestOptions,
    action,
    instruction: requestMessages.instructions[action],
    ...(resolvedOutputFormat !== undefined ? { outputFormat: resolvedOutputFormat } : {})
  });
}

export function createWorkbenchSummarizeActiveNoteAiTextRequest(
  model: TextFileModel,
  options: WorkbenchActiveNoteAiRequestForActionOptions = {}
): AiTextRequest {
  return createWorkbenchActiveNoteAiTextRequestForAction(
    model,
    workbenchAiRequestActions.summarizeActiveNote,
    options
  );
}
