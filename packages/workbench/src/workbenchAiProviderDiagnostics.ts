import type {
  AiTextResponse,
  IAiService
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchAiProviderDiagnosticServices {
  readonly aiService: Pick<IAiService, "requestText">;
}

export interface WorkbenchAiProviderDiagnosticCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
}

export interface WorkbenchAiProviderDiagnosticOptions {
  readonly metadata?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface WorkbenchAiProviderDiagnosticActions {
  testProvider(providerId: string): Promise<AiTextResponse | undefined>;
}

export const workbenchAiProviderDiagnosticRequest = {
  instruction: "Return a short plain-text confirmation that this AI provider can receive and answer a request.",
  input: "Typora Plus AI provider connectivity check."
} as const;

export function createWorkbenchAiProviderDiagnosticActions(
  services: WorkbenchAiProviderDiagnosticServices,
  callbacks: WorkbenchAiProviderDiagnosticCallbacks
): WorkbenchAiProviderDiagnosticActions {
  return {
    testProvider: (providerId) => runWorkbenchAction(
      () => testWorkbenchAiProvider(services, providerId, {
        metadata: {
          surface: "settings"
        }
      }),
      callbacks.setOperationError
    )
  };
}

export async function testWorkbenchAiProvider(
  services: WorkbenchAiProviderDiagnosticServices,
  providerId: string,
  options: WorkbenchAiProviderDiagnosticOptions = {}
): Promise<AiTextResponse> {
  const normalizedProviderId = providerId.trim();

  if (!normalizedProviderId) {
    throw new Error("AI provider id is required for diagnostics");
  }

  return services.aiService.requestText(normalizedProviderId, {
    instruction: workbenchAiProviderDiagnosticRequest.instruction,
    input: workbenchAiProviderDiagnosticRequest.input,
    metadata: {
      ...options.metadata,
      action: "testProvider",
      source: "settings"
    },
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  });
}
