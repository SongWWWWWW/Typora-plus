import type { AiTextResponse } from "@typora-plus/platform";
import {
  workbenchAiActionTitles,
  workbenchAiRequestActions,
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

export interface WorkbenchAiResponseMetadataItem {
  readonly id: "model" | "provider" | "usage";
  readonly value: string;
}

export interface WorkbenchAiTokenUsageMessages {
  readonly input: (count: number) => string;
  readonly output: (count: number) => string;
  readonly total: (count: number) => string;
  readonly join: (parts: readonly string[]) => string;
}

interface WorkbenchExtractedTaskDocument {
  readonly groups: readonly WorkbenchExtractedTaskGroup[];
}

interface WorkbenchExtractedTaskGroup {
  readonly topic: string | null;
  readonly tasks: readonly WorkbenchExtractedTask[];
}

interface WorkbenchExtractedTask {
  readonly title: string;
  readonly owner: string | null;
  readonly due: string | null;
  readonly blocker: string | null;
  readonly done: boolean;
}

export type WorkbenchExtractedTaskDetailId = "owner" | "due" | "blocker";

export interface WorkbenchExtractedTaskMessages {
  readonly detailLabels: Readonly<Record<WorkbenchExtractedTaskDetailId, string>>;
  readonly detail: (label: string, value: string) => string;
  readonly detailList: (details: readonly string[]) => string;
  readonly noActionableTasksFound: string;
  readonly validation?: WorkbenchExtractedTaskValidationMessages;
}

export interface WorkbenchExtractedTaskValidationMessages {
  readonly labels: {
    readonly response: string;
    readonly responseGroups: string;
    readonly group: (index: number) => string;
    readonly groupTasks: (index: number) => string;
    readonly groupTopic: (index: number) => string;
    readonly task: (index: number) => string;
    readonly taskBlocker: (index: number) => string;
    readonly taskDone: (index: number) => string;
    readonly taskDue: (index: number) => string;
    readonly taskOwner: (index: number) => string;
    readonly taskTitle: (index: number) => string;
  };
  readonly mustBeArray: (label: string) => string;
  readonly mustBeBoolean: (label: string) => string;
  readonly mustBeObject: (label: string) => string;
  readonly mustBeString: (label: string) => string;
  readonly mustBeValidJson: string;
  readonly mustContainAtMostItems: (label: string, maxItems: number) => string;
  readonly mustContainAtMostCharacters: (label: string, maxLength: number) => string;
}

const workbenchExtractedTaskLimits = {
  groups: 50,
  tasksPerGroup: 100,
  textLength: 1000
} as const;

export const defaultWorkbenchExtractedTaskValidationMessages: WorkbenchExtractedTaskValidationMessages = {
  labels: {
    response: "AI task extraction response",
    responseGroups: "AI task extraction response groups",
    group: (index) => `AI task extraction group ${index + 1}`,
    groupTasks: (index) => `AI task extraction group ${index + 1} tasks`,
    groupTopic: (index) => `AI task extraction group ${index + 1} topic`,
    task: (index) => `AI task extraction task ${index + 1}`,
    taskBlocker: (index) => `AI task extraction task ${index + 1} blocker`,
    taskDone: (index) => `AI task extraction task ${index + 1} done`,
    taskDue: (index) => `AI task extraction task ${index + 1} due`,
    taskOwner: (index) => `AI task extraction task ${index + 1} owner`,
    taskTitle: (index) => `AI task extraction task ${index + 1} title`
  },
  mustBeArray: (label) => `${label} must be an array`,
  mustBeBoolean: (label) => `${label} must be a boolean`,
  mustBeObject: (label) => `${label} must be an object`,
  mustBeString: (label) => `${label} must be a string`,
  mustBeValidJson: "AI task extraction response must be valid JSON",
  mustContainAtMostItems: (label, maxItems) => `${label} must contain at most ${maxItems} items`,
  mustContainAtMostCharacters: (label, maxLength) => `${label} must be at most ${maxLength} characters`
};

export const defaultWorkbenchExtractedTaskMessages: WorkbenchExtractedTaskMessages = {
  detailLabels: {
    owner: "Owner",
    due: "Due",
    blocker: "Blocker"
  },
  detail: (label, value) => `${label}: ${value}`,
  detailList: (details) => details.length > 0 ? ` (${details.join("; ")})` : "",
  noActionableTasksFound: "No actionable tasks found.",
  validation: defaultWorkbenchExtractedTaskValidationMessages
};

export const defaultWorkbenchAiTokenUsageMessages: WorkbenchAiTokenUsageMessages = {
  input: (count) => `${count} in`,
  output: (count) => `${count} out`,
  total: (count) => `${count} total`,
  join: (parts) => parts.join(" / ")
};

export const workbenchAiResponseApplyModes = {
  continueActiveNote: "append",
  extractTasksActiveNote: "append",
  rewriteActiveNote: "replace",
  summarizeActiveNote: "append"
} as const satisfies Record<WorkbenchAiRequestAction, WorkbenchAiResponseApplyMode>;

export function createWorkbenchAiResponse(
  action: WorkbenchAiRequestAction,
  response: AiTextResponse,
  messages: WorkbenchExtractedTaskMessages = defaultWorkbenchExtractedTaskMessages
): WorkbenchAiResponse {
  return {
    action,
    applyMode: workbenchAiResponseApplyModes[action],
    response: normalizeWorkbenchAiResponse(action, response, messages),
    title: workbenchAiActionTitles[action]
  };
}

export function formatWorkbenchExtractedTasksResponse(
  value: string,
  messages: WorkbenchExtractedTaskMessages = defaultWorkbenchExtractedTaskMessages
): string {
  const validation = messages.validation ?? defaultWorkbenchExtractedTaskValidationMessages;
  const document = readWorkbenchExtractedTaskDocument(value, validation);
  const lines: string[] = [];

  for (const group of document.groups) {
    const taskLines = group.tasks
      .map((task) => formatWorkbenchExtractedTask(task, messages))
      .filter((line) => line.length > 0);

    if (taskLines.length === 0) {
      continue;
    }

    const topic = escapeWorkbenchMarkdownInlineText(normalizeWorkbenchExtractedTaskText(group.topic));

    if (lines.length > 0) {
      lines.push("");
    }

    if (topic) {
      lines.push(`### ${topic}`);
    }

    lines.push(...taskLines);
  }

  return lines.length > 0
    ? lines.join("\n")
    : messages.noActionableTasksFound;
}

export function formatWorkbenchAiTokenUsage(
  usage: AiTextResponse["usage"],
  messages: WorkbenchAiTokenUsageMessages = defaultWorkbenchAiTokenUsageMessages
): string | undefined {
  if (!usage) {
    return undefined;
  }

  const tokens = [
    usage.inputTokens !== undefined ? messages.input(usage.inputTokens) : undefined,
    usage.outputTokens !== undefined ? messages.output(usage.outputTokens) : undefined,
    usage.totalTokens !== undefined ? messages.total(usage.totalTokens) : undefined
  ].filter((part): part is string => !!part);

  return tokens.length > 0 ? messages.join(tokens) : undefined;
}

export function createWorkbenchAiResponseMetadata(
  response: Pick<AiTextResponse, "providerId" | "model" | "usage">,
  messages: WorkbenchAiTokenUsageMessages = defaultWorkbenchAiTokenUsageMessages
): readonly WorkbenchAiResponseMetadataItem[] {
  const usage = formatWorkbenchAiTokenUsage(response.usage, messages);

  return [
    { id: "provider", value: response.providerId },
    ...(response.model ? [{ id: "model", value: response.model } as const] : []),
    ...(usage ? [{ id: "usage", value: usage } as const] : [])
  ];
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

function normalizeWorkbenchAiResponse(
  action: WorkbenchAiRequestAction,
  response: AiTextResponse,
  messages: WorkbenchExtractedTaskMessages
): AiTextResponse {
  return action === workbenchAiRequestActions.extractTasksActiveNote
    ? {
        ...response,
        value: formatWorkbenchExtractedTasksResponse(response.value, messages)
      }
    : response;
}

function formatWorkbenchExtractedTask(
  task: WorkbenchExtractedTask,
  messages: WorkbenchExtractedTaskMessages
): string {
  const title = escapeWorkbenchMarkdownInlineText(normalizeWorkbenchExtractedTaskText(task.title));

  if (!title) {
    return "";
  }

  const details = [
    formatWorkbenchExtractedTaskDetail(messages.detailLabels.owner, task.owner, messages),
    formatWorkbenchExtractedTaskDetail(messages.detailLabels.due, task.due, messages),
    formatWorkbenchExtractedTaskDetail(messages.detailLabels.blocker, task.blocker, messages)
  ].filter((detail) => detail.length > 0);

  return `- [${task.done ? "x" : " "}] ${title}${messages.detailList(details)}`;
}

function formatWorkbenchExtractedTaskDetail(
  label: string,
  value: string | null,
  messages: WorkbenchExtractedTaskMessages
): string {
  const normalizedLabel = escapeWorkbenchMarkdownInlineText(label);
  const normalized = escapeWorkbenchMarkdownInlineText(normalizeWorkbenchExtractedTaskText(value));

  return normalized ? messages.detail(normalizedLabel, normalized) : "";
}

function readWorkbenchExtractedTaskDocument(
  value: string,
  messages: WorkbenchExtractedTaskValidationMessages
): WorkbenchExtractedTaskDocument {
  let parsed: unknown;

  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error(messages.mustBeValidJson);
  }

  const record = expectWorkbenchExtractedTaskRecord(parsed, messages.labels.response, messages);

  return {
    groups: readWorkbenchExtractedTaskArray(
      record.groups,
      messages.labels.responseGroups,
      readWorkbenchExtractedTaskGroup,
      workbenchExtractedTaskLimits.groups,
      messages
    )
  };
}

function readWorkbenchExtractedTaskGroup(
  value: unknown,
  index: number,
  messages: WorkbenchExtractedTaskValidationMessages
): WorkbenchExtractedTaskGroup {
  const record = expectWorkbenchExtractedTaskRecord(value, messages.labels.group(index), messages);

  return {
    topic: readNullableWorkbenchExtractedTaskString(record.topic, messages.labels.groupTopic(index), messages),
    tasks: readWorkbenchExtractedTaskArray(
      record.tasks,
      messages.labels.groupTasks(index),
      readWorkbenchExtractedTask,
      workbenchExtractedTaskLimits.tasksPerGroup,
      messages
    )
  };
}

function readWorkbenchExtractedTask(
  value: unknown,
  index: number,
  messages: WorkbenchExtractedTaskValidationMessages
): WorkbenchExtractedTask {
  const record = expectWorkbenchExtractedTaskRecord(value, messages.labels.task(index), messages);

  return {
    title: readWorkbenchExtractedTaskString(record.title, messages.labels.taskTitle(index), messages),
    owner: readNullableWorkbenchExtractedTaskString(record.owner, messages.labels.taskOwner(index), messages),
    due: readNullableWorkbenchExtractedTaskString(record.due, messages.labels.taskDue(index), messages),
    blocker: readNullableWorkbenchExtractedTaskString(record.blocker, messages.labels.taskBlocker(index), messages),
    done: readWorkbenchExtractedTaskBoolean(record.done, messages.labels.taskDone(index), messages)
  };
}

function readWorkbenchExtractedTaskArray<Item>(
  value: unknown,
  label: string,
  readItem: (value: unknown, index: number, messages: WorkbenchExtractedTaskValidationMessages) => Item,
  maxItems: number,
  messages: WorkbenchExtractedTaskValidationMessages
): readonly Item[] {
  if (!Array.isArray(value)) {
    throw new Error(messages.mustBeArray(label));
  }

  if (value.length > maxItems) {
    throw new Error(messages.mustContainAtMostItems(label, maxItems));
  }

  return value.map((item, index) => readItem(item, index, messages));
}

function readWorkbenchExtractedTaskString(
  value: unknown,
  label: string,
  messages: WorkbenchExtractedTaskValidationMessages
): string {
  if (typeof value !== "string") {
    throw new Error(messages.mustBeString(label));
  }

  if (value.length > workbenchExtractedTaskLimits.textLength) {
    throw new Error(messages.mustContainAtMostCharacters(label, workbenchExtractedTaskLimits.textLength));
  }

  return value;
}

function readNullableWorkbenchExtractedTaskString(
  value: unknown,
  label: string,
  messages: WorkbenchExtractedTaskValidationMessages
): string | null {
  if (value === null) {
    return null;
  }

  return readWorkbenchExtractedTaskString(value, label, messages);
}

function readWorkbenchExtractedTaskBoolean(
  value: unknown,
  label: string,
  messages: WorkbenchExtractedTaskValidationMessages
): boolean {
  if (typeof value !== "boolean") {
    throw new Error(messages.mustBeBoolean(label));
  }

  return value;
}

function normalizeWorkbenchExtractedTaskText(value: string | null): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

function escapeWorkbenchMarkdownInlineText(value: string): string {
  return value.replace(/([\\`*_{}\[\]()!|<>])/g, "\\$1");
}

function expectWorkbenchExtractedTaskRecord(
  value: unknown,
  label: string,
  messages: WorkbenchExtractedTaskValidationMessages
): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(messages.mustBeObject(label));
  }

  return value as Record<string, unknown>;
}
