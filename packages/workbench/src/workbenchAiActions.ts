import type {
  AiTextContextItem,
  AiTextResponse,
  IAiService,
  ITextFileService,
  TextFileModel
} from "@typora-plus/platform";
import { createWorkbenchSummarizeActiveNoteAiTextRequest } from "./workbenchAiRequestModel";
import { selectWorkbenchDefaultAiProviderId } from "./workbenchProviderSelection";

export interface WorkbenchAiActionServices {
  readonly aiService: Pick<IAiService, "getProviders" | "requestText">;
  readonly textFileService: Pick<ITextFileService, "getActiveModel" | "updateContent">;
}

export interface WorkbenchAiActionOptions {
  readonly context?: readonly AiTextContextItem[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export async function runWorkbenchSummarizeActiveNoteAiAction(
  services: WorkbenchAiActionServices,
  options: WorkbenchAiActionOptions = {}
): Promise<AiTextResponse> {
  const providerId = selectWorkbenchDefaultAiProviderId(services);

  if (!providerId) {
    throw new Error("No AI provider available for active note summary");
  }

  return services.aiService.requestText(
    providerId,
    createWorkbenchSummarizeActiveNoteAiTextRequest(
      services.textFileService.getActiveModel(),
      options
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
