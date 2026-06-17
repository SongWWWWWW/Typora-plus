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
  readonly messages?: WorkbenchAiProviderDiagnosticMessages;
}

export interface WorkbenchAiProviderDiagnosticOptions {
  readonly messages?: WorkbenchAiProviderDiagnosticMessages;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface WorkbenchAiProviderDiagnosticActions {
  testProvider(providerId: string): Promise<AiTextResponse | undefined>;
}

export interface WorkbenchAiProviderDiagnosticMessages {
  readonly providerIdRequired: string;
  readonly request: {
    readonly instruction: string;
    readonly input: string;
  };
}

export const workbenchAiProviderDiagnosticRequest = {
  instruction: "Return a short plain-text confirmation that this AI provider can receive and answer a request.",
  input: "Typora Plus AI provider connectivity check."
} as const;

export const defaultWorkbenchAiProviderDiagnosticMessages: WorkbenchAiProviderDiagnosticMessages = {
  providerIdRequired: "AI provider id is required for diagnostics",
  request: workbenchAiProviderDiagnosticRequest
};

export function createWorkbenchAiProviderDiagnosticActions(
  services: WorkbenchAiProviderDiagnosticServices,
  callbacks: WorkbenchAiProviderDiagnosticCallbacks
): WorkbenchAiProviderDiagnosticActions {
  return {
    testProvider: (providerId) => runWorkbenchAction(
      () => testWorkbenchAiProvider(services, providerId, {
        metadata: {
          surface: "settings"
        },
        ...(callbacks.messages ? { messages: callbacks.messages } : {})
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
  const messages = options.messages ?? defaultWorkbenchAiProviderDiagnosticMessages;

  if (!normalizedProviderId) {
    throw new Error(messages.providerIdRequired);
  }

  return services.aiService.requestText(normalizedProviderId, {
    instruction: messages.request.instruction,
    input: messages.request.input,
    metadata: {
      ...options.metadata,
      action: "testProvider",
      source: "settings"
    },
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  });
}
