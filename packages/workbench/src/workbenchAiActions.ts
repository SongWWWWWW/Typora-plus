import type {
  AiTextContextItem,
  AiTextResponse,
  IAiService,
  ITextFileService
} from "@typora-plus/platform";
import { createWorkbenchSummarizeActiveNoteAiTextRequest } from "./workbenchAiRequestModel";
import { selectWorkbenchDefaultAiProviderId } from "./workbenchProviderSelection";

export interface WorkbenchAiActionServices {
  readonly aiService: Pick<IAiService, "getProviders" | "requestText">;
  readonly textFileService: Pick<ITextFileService, "getActiveModel">;
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
