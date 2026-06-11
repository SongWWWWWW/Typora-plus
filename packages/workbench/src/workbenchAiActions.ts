import type {
  AiTextContextItem,
  AiTextResponse,
  IAiService,
  IIndexService,
  ITextFileService,
  TextFileModel
} from "@typora-plus/platform";
import { createWorkbenchSummarizeActiveNoteAiTextRequest } from "./workbenchAiRequestModel";
import {
  createWorkbenchWorkspaceAiContext,
  type WorkbenchAiWorkspaceContextOptions
} from "./workbenchAiWorkspaceContext";
import { selectWorkbenchDefaultAiProviderId } from "./workbenchProviderSelection";

export interface WorkbenchAiActionServices {
  readonly aiService: Pick<IAiService, "getProviders" | "requestText">;
  readonly indexService: Pick<IIndexService, "getStatus" | "query">;
  readonly textFileService: Pick<ITextFileService, "getActiveModel" | "updateContent">;
}

export interface WorkbenchAiActionOptions {
  readonly context?: readonly AiTextContextItem[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
  readonly workspaceContext?: WorkbenchAiWorkspaceContextOptions;
}

export async function runWorkbenchSummarizeActiveNoteAiAction(
  services: WorkbenchAiActionServices,
  options: WorkbenchAiActionOptions = {}
): Promise<AiTextResponse> {
  const providerId = selectWorkbenchDefaultAiProviderId(services);

  if (!providerId) {
    throw new Error("No AI provider available for active note summary");
  }

  const activeModel = services.textFileService.getActiveModel();
  const context = createWorkbenchAiActionContext(services, activeModel, options);

  return services.aiService.requestText(
    providerId,
    createWorkbenchSummarizeActiveNoteAiTextRequest(
      activeModel,
      {
        ...options,
        ...(context.length > 0 ? { context } : {})
      }
    )
  );
}

export function appendWorkbenchAiResponseToActiveNote(
  services: Pick<WorkbenchAiActionServices, "textFileService">,
  response: Pick<AiTextResponse, "value">
): TextFileModel {
  const model = services.textFileService.getActiveModel();
  const nextValue = appendWorkbenchMarkdownBlock(model.value, response.value);

  return nextValue === model.value
    ? model
    : services.textFileService.updateContent(nextValue);
}

export function appendWorkbenchMarkdownBlock(value: string, block: string): string {
  const normalizedBlock = trimWorkbenchMarkdownBlockBoundary(block);

  if (!normalizedBlock) {
    return value;
  }

  if (!value) {
    return `${normalizedBlock}\n`;
  }

  const separator = value.endsWith("\n\n")
    ? ""
    : value.endsWith("\n")
      ? "\n"
      : "\n\n";

  return `${value}${separator}${normalizedBlock}\n`;
}

function trimWorkbenchMarkdownBlockBoundary(value: string): string {
  if (!value.trim()) {
    return "";
  }

  return value
    .replace(/^(?:[ \t]*\r?\n)+/, "")
    .replace(/(?:\r?\n[ \t]*)+$/, "");
}

function createWorkbenchAiActionContext(
  services: Pick<WorkbenchAiActionServices, "indexService">,
  model: TextFileModel,
  options: WorkbenchAiActionOptions
): readonly AiTextContextItem[] {
  const workspaceContext = options.workspaceContext
    ? createWorkbenchWorkspaceAiContext(services, model, options.workspaceContext)
    : [];

  return [
    ...(options.context ?? []),
    ...workspaceContext
  ];
}
