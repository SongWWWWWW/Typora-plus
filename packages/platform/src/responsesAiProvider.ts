import type {
  AiProvider,
  AiTextContextItem,
  AiTextProviderResult,
  AiTextRequest,
  AiTokenUsage
} from "./ai";
import type { AiProviderConfiguration } from "./configuration";

let nextNativeResponsesRequestId = 0;

export interface ResponsesAiProviderTransportRequest {
  readonly url: string;
  readonly method: "POST";
  readonly headers: Readonly<Record<string, string>>;
  readonly body: string;
  readonly signal?: AbortSignal;
}

export type ResponsesAiProviderTransport =
  (request: ResponsesAiProviderTransportRequest) => Promise<unknown>;

export type ResponsesAiProviderSecretReader =
  (secretRef: string) => string | undefined | Promise<string | undefined>;

export interface ResponsesAiProviderRequest {
  readonly endpointUrl: string;
  readonly secretRef: string;
  readonly body: string;
  readonly signal?: AbortSignal;
}

export type ResponsesAiProviderRequestHandler =
  (request: ResponsesAiProviderRequest) => Promise<unknown>;

export interface ResponsesAiProviderFactoryOptions {
  readonly request?: ResponsesAiProviderRequestHandler;
  readonly readSecret?: ResponsesAiProviderSecretReader;
  readonly transport?: ResponsesAiProviderTransport;
}

export interface NativeResponsesAiBridge {
  readonly isAvailable: boolean;
  setSecret(secretRef: string, value: string): Promise<boolean>;
  deleteSecret(secretRef: string): Promise<boolean>;
  cancelResponses?(requestId: string): void;
  requestResponses(request: NativeResponsesAiRequest): Promise<unknown>;
}

export interface NativeResponsesAiRequest {
  readonly requestId: string;
  readonly endpointUrl: string;
  readonly secretRef: string;
  readonly body: string;
}

export function createConfiguredAiProviders(
  configurations: readonly AiProviderConfiguration[],
  options: ResponsesAiProviderFactoryOptions
): readonly AiProvider[] {
  return configurations.map((configuration) => createResponsesAiProvider(configuration, options));
}

export function createResponsesAiProvider(
  configuration: AiProviderConfiguration,
  options: ResponsesAiProviderFactoryOptions
): AiProvider {
  const normalizedConfiguration = normalizeResponsesAiProviderConfiguration(configuration);

  return {
    id: normalizedConfiguration.id,
    title: normalizedConfiguration.title,
    requestText: async (request) => {
      const body = JSON.stringify(createResponsesRequestBody(normalizedConfiguration, request));
      const response = await requestResponses(normalizedConfiguration, options, body, request.signal);

      return readResponsesProviderResult(response, normalizedConfiguration.model);
    }
  };
}

export function createNativeResponsesAiProviderFactoryOptions(
  bridge: NativeResponsesAiBridge | undefined = createNativeResponsesAiBridge()
): ResponsesAiProviderFactoryOptions | undefined {
  if (!bridge?.isAvailable) {
    return undefined;
  }

  return {
    request: (request) => requestNativeResponsesWithBridge(bridge, request)
  };
}

async function requestNativeResponsesWithBridge(
  bridge: NativeResponsesAiBridge,
  request: ResponsesAiProviderRequest
): Promise<unknown> {
  if (request.signal?.aborted) {
    throw new Error("AI Responses request was aborted");
  }

  const requestId = createNativeResponsesRequestId();
  const abortListener = request.signal && bridge.cancelResponses
    ? () => {
        try {
          bridge.cancelResponses?.(requestId);
        } catch {
          // Cancellation is best-effort; the request promise remains the source of truth.
        }
      }
    : undefined;

  if (abortListener) {
    request.signal?.addEventListener("abort", abortListener, { once: true });
  }

  try {
    return await bridge.requestResponses({
      requestId,
      endpointUrl: request.endpointUrl,
      secretRef: request.secretRef,
      body: request.body
    });
  } finally {
    if (abortListener) {
      request.signal?.removeEventListener("abort", abortListener);
    }
  }
}

function requestResponses(
  configuration: AiProviderConfiguration,
  options: ResponsesAiProviderFactoryOptions,
  body: string,
  signal: AbortSignal | undefined
): Promise<unknown> {
  if (options.request) {
    return options.request({
      endpointUrl: configuration.endpointUrl,
      secretRef: configuration.secretRef,
      body,
      ...(signal !== undefined ? { signal } : {})
    });
  }

  if (!options.readSecret || !options.transport) {
    throw new Error("Responses AI provider requires a request handler or secret reader plus transport");
  }

  return requestResponsesWithSecret(configuration, options.readSecret, options.transport, body, signal);
}

function createNativeResponsesRequestId(): string {
  nextNativeResponsesRequestId += 1;
  return `responses:${nextNativeResponsesRequestId}`;
}

async function requestResponsesWithSecret(
  configuration: AiProviderConfiguration,
  readSecret: ResponsesAiProviderSecretReader,
  transport: ResponsesAiProviderTransport,
  body: string,
  signal: AbortSignal | undefined
): Promise<unknown> {
  const apiKey = await readSecret(configuration.secretRef);
  const normalizedApiKey = apiKey?.trim();

  if (!normalizedApiKey) {
    throw new Error(`Missing AI provider secret for ${configuration.id}`);
  }

  return transport({
    url: configuration.endpointUrl,
    method: "POST",
    headers: {
      "Accept": "application/json",
      "Authorization": `Bearer ${normalizedApiKey}`,
      "Content-Type": "application/json"
    },
    body,
    ...(signal !== undefined ? { signal } : {})
  });
}

function createResponsesRequestBody(
  configuration: AiProviderConfiguration,
  request: AiTextRequest
): Readonly<Record<string, unknown>> {
  return {
    model: configuration.model,
    instructions: request.instruction,
    input: createResponsesInput(request.input, request.context),
    ...createOptionalResponsesMetadata(request.metadata),
    ...(configuration.store !== undefined ? { store: configuration.store } : {})
  };
}

function createResponsesInput(
  input: string,
  context: readonly AiTextContextItem[] | undefined
): string {
  const sections = [input];

  if (context && context.length > 0) {
    sections.push([
      "Context:",
      ...context.map(formatResponsesContextItem)
    ].join("\n\n"));
  }

  return sections.filter((section) => section.trim()).join("\n\n");
}

function formatResponsesContextItem(item: AiTextContextItem): string {
  return [
    `### ${item.title ? `${item.kind}: ${item.title}` : item.kind}`,
    ...(item.uri ? [`URI: ${item.uri.toString()}`] : []),
    item.value
  ].join("\n");
}

function createOptionalResponsesMetadata(
  metadata: Readonly<Record<string, string>> | undefined
): { readonly metadata?: Readonly<Record<string, string>> } {
  if (!metadata) {
    return {};
  }

  const normalizedMetadata: Record<string, string> = {};

  for (const [key, value] of Object.entries(metadata).slice(0, 16)) {
    const normalizedKey = key.trim();

    if (!normalizedKey || normalizedKey.length > 64) {
      continue;
    }

    normalizedMetadata[normalizedKey] = value.slice(0, 512);
  }

  return Object.keys(normalizedMetadata).length > 0
    ? { metadata: normalizedMetadata }
    : {};
}

function readResponsesProviderResult(
  value: unknown,
  fallbackModel: string
): AiTextProviderResult {
  const record = expectRecord(value, "Responses provider result");

  if (isRecord(record.error)) {
    throw new Error(`Responses provider request failed: ${readErrorMessage(record.error)}`);
  }

  return {
    value: readResponsesOutputText(record),
    model: readOptionalString(record.model) ?? fallbackModel,
    ...readOptionalUsage(record.usage)
  };
}

function readResponsesOutputText(record: Record<string, unknown>): string {
  const outputText = readOptionalText(record.output_text);

  if (outputText !== undefined) {
    return outputText;
  }

  if (!Array.isArray(record.output)) {
    throw new Error("Responses provider result did not include output text");
  }

  const parts: string[] = [];

  for (const item of record.output) {
    if (!isRecord(item)) {
      continue;
    }

    if (typeof item.text === "string") {
      parts.push(item.text);
      continue;
    }

    if (!Array.isArray(item.content)) {
      continue;
    }

    for (const contentItem of item.content) {
      if (!isRecord(contentItem)) {
        continue;
      }

      const text = readOptionalText(contentItem.text) ?? readOptionalText(contentItem.output_text);

      if (text !== undefined) {
        parts.push(text);
      }
    }
  }

  if (parts.length === 0) {
    throw new Error("Responses provider result did not include output text");
  }

  return parts.join("");
}

function readOptionalUsage(value: unknown): { readonly usage?: AiTokenUsage } {
  if (!isRecord(value)) {
    return {};
  }

  const usage: AiTokenUsage = {
    ...readOptionalTokenUsage("inputTokens", value.input_tokens),
    ...readOptionalTokenUsage("outputTokens", value.output_tokens),
    ...readOptionalTokenUsage("totalTokens", value.total_tokens)
  };

  return Object.keys(usage).length > 0 ? { usage } : {};
}

function readOptionalTokenUsage<Key extends keyof AiTokenUsage>(
  key: Key,
  value: unknown
): Partial<Record<Key, number>> {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    return {};
  }

  return { [key]: value } as Partial<Record<Key, number>>;
}

function readErrorMessage(error: Record<string, unknown>): string {
  return readOptionalString(error.message) ?? "unknown error";
}

function normalizeResponsesAiProviderConfiguration(
  configuration: AiProviderConfiguration
): AiProviderConfiguration {
  const record = expectRecord(configuration, "Responses AI provider configuration");
  const kind = record.kind;

  if (kind !== "responses") {
    throw new Error("Responses AI provider configuration kind must be responses");
  }

  return {
    id: readRequiredString(record.id, "Responses AI provider id"),
    title: readRequiredString(record.title, "Responses AI provider title"),
    kind,
    endpointUrl: readRequiredString(record.endpointUrl, "Responses AI provider endpoint URL"),
    model: readRequiredString(record.model, "Responses AI provider model"),
    secretRef: readRequiredString(record.secretRef, "Responses AI provider secret reference"),
    ...(typeof record.store === "boolean" ? { store: record.store } : {})
  };
}

function createNativeResponsesAiBridge(): NativeResponsesAiBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly ai?: NativeResponsesAiBridge;
    };
  };
  const bridge = candidate.typoraPlus?.ai;

  return bridge?.isAvailable ? bridge : undefined;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequiredString(value: unknown, label: string): string {
  const normalized = readOptionalString(value);

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}

function readOptionalString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim() || undefined;
}

function readOptionalText(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
