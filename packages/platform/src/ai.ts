import { toDisposable, type IDisposable, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type AiProviderId = string;

export interface AiTextContextItem {
  readonly kind: string;
  readonly value: string;
  readonly title?: string;
  readonly uri?: URIType;
}

export interface AiTextRequest {
  readonly instruction: string;
  readonly input: string;
  readonly context?: readonly AiTextContextItem[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface AiTokenUsage {
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly totalTokens?: number;
}

export interface AiTextProviderResult {
  readonly value: string;
  readonly model?: string;
  readonly usage?: AiTokenUsage;
}

export interface AiTextResponse extends AiTextProviderResult {
  readonly providerId: AiProviderId;
}

export interface AiProvider {
  readonly id: AiProviderId;
  readonly title: string;
  requestText(request: AiTextRequest): AiTextProviderResult | Promise<AiTextProviderResult>;
}

export interface RegisteredAiProvider {
  readonly id: AiProviderId;
  readonly title: string;
}

export interface IAiService {
  registerProvider(provider: AiProvider): IDisposable;
  getProviders(): readonly RegisteredAiProvider[];
  requestText(providerId: AiProviderId, request: AiTextRequest): Promise<AiTextResponse>;
}

export const IAiService = createServiceIdentifier<IAiService>("ai");

export class AiService implements IAiService {
  private readonly providers = new Map<AiProviderId, AiProvider>();

  registerProvider(provider: AiProvider): IDisposable {
    const normalizedProvider = normalizeAiProvider(provider);

    if (this.providers.has(normalizedProvider.id)) {
      throw new Error(`AI provider already registered: ${normalizedProvider.id}`);
    }

    this.providers.set(normalizedProvider.id, normalizedProvider);
    return toDisposable(() => {
      if (this.providers.get(normalizedProvider.id) === normalizedProvider) {
        this.providers.delete(normalizedProvider.id);
      }
    });
  }

  getProviders(): readonly RegisteredAiProvider[] {
    return [...this.providers.values()]
      .map((provider) => ({ id: provider.id, title: provider.title }))
      .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id));
  }

  async requestText(providerId: AiProviderId, request: AiTextRequest): Promise<AiTextResponse> {
    const normalizedProviderId = readRequiredString(providerId, "AI provider id");
    const provider = this.providers.get(normalizedProviderId);

    if (!provider) {
      throw new Error(`No AI provider registered: ${normalizedProviderId}`);
    }

    return {
      providerId: provider.id,
      ...normalizeAiTextProviderResult(await provider.requestText(normalizeAiTextRequest(request)))
    };
  }
}

function normalizeAiProvider(provider: AiProvider): AiProvider {
  const record = expectRecord(provider, "AI provider");
  const id = readRequiredString(record.id, "AI provider id");
  const title = readRequiredString(record.title, `AI provider title for ${id}`);

  if (typeof provider.requestText !== "function") {
    throw new Error(`AI provider for ${id} must provide requestText`);
  }

  return {
    id,
    title,
    requestText: (request) => provider.requestText(request)
  };
}

function normalizeAiTextRequest(request: AiTextRequest): AiTextRequest {
  const record = expectRecord(request, "AI text request");
  const instruction = readRequiredString(record.instruction, "AI text request instruction");
  const input = readString(record.input, "AI text request input");
  const context = normalizeAiTextContext(record.context);
  const metadata = normalizeAiTextMetadata(record.metadata);

  return {
    instruction,
    input,
    ...(context !== undefined ? { context } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(record.signal !== undefined ? { signal: record.signal as AbortSignal } : {})
  };
}

function normalizeAiTextContext(value: unknown): readonly AiTextContextItem[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    throw new Error("AI text request context must be an array");
  }

  return value.map((item, index) => {
    const record = expectRecord(item, `AI text request context item ${index}`);
    const kind = readRequiredString(record.kind, `AI text request context item ${index} kind`);
    const contextValue = readRequiredString(record.value, `AI text request context item ${index} value`);
    const title = readOptionalString(record.title, `AI text request context item ${index} title`);

    return {
      kind,
      value: contextValue,
      ...(title ? { title } : {}),
      ...(record.uri !== undefined ? { uri: record.uri as URIType } : {})
    };
  });
}

function normalizeAiTextMetadata(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, "AI text request metadata");
  const metadata: Record<string, string> = {};

  for (const [key, metadataValue] of Object.entries(record)) {
    const normalizedKey = key.trim();

    if (!normalizedKey) {
      throw new Error("AI text request metadata keys must not be empty");
    }

    metadata[normalizedKey] = readString(metadataValue, `AI text request metadata ${normalizedKey}`);
  }

  return metadata;
}

function normalizeAiTextProviderResult(result: AiTextProviderResult): AiTextProviderResult {
  const record = expectRecord(result, "AI text provider result");
  const value = readString(record.value, "AI text provider result value");
  const model = readOptionalString(record.model, "AI text provider result model");
  const usage = normalizeAiTokenUsage(record.usage);

  return {
    value,
    ...(model ? { model } : {}),
    ...(usage !== undefined ? { usage } : {})
  };
}

function normalizeAiTokenUsage(value: unknown): AiTokenUsage | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, "AI token usage");

  return {
    ...readOptionalTokenUsage("inputTokens", record.inputTokens),
    ...readOptionalTokenUsage("outputTokens", record.outputTokens),
    ...readOptionalTokenUsage("totalTokens", record.totalTokens)
  };
}

function readOptionalTokenUsage<Key extends keyof AiTokenUsage>(
  key: Key,
  value: unknown
): Partial<Record<Key, number>> {
  if (value === undefined) {
    return {};
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`AI token usage ${key} must be a non-negative finite number`);
  }

  return { [key]: value } as Partial<Record<Key, number>>;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  const normalized = readString(value, label).trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

function readOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, label).trim() || undefined;
}
