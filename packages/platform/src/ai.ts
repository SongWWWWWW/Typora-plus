import { Emitter, toDisposable, type Event, type IDisposable, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type AiProviderId = string;

export interface AiTextContextItem {
  readonly kind: string;
  readonly value: string;
  readonly title?: string;
  readonly uri?: URIType;
}

export type AiJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly AiJsonValue[]
  | { readonly [key: string]: AiJsonValue };

export type AiJsonObject = { readonly [key: string]: AiJsonValue };

export type AiTextOutputFormat =
  | AiTextPlainOutputFormat
  | AiTextJsonOutputFormat
  | AiTextJsonSchemaOutputFormat;

export interface AiTextPlainOutputFormat {
  readonly kind: "text";
}

export interface AiTextJsonOutputFormat {
  readonly kind: "json";
}

export interface AiTextJsonSchemaOutputFormat {
  readonly kind: "jsonSchema";
  readonly name: string;
  readonly schema: AiJsonObject;
  readonly description?: string;
  readonly strict?: boolean;
}

export interface AiTextRequest {
  readonly instruction: string;
  readonly input: string;
  readonly context?: readonly AiTextContextItem[];
  readonly metadata?: Readonly<Record<string, string>>;
  readonly outputFormat?: AiTextOutputFormat;
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
  readonly onDidChangeAiProviders: Event<void>;
  registerProvider(provider: AiProvider): IDisposable;
  getProviders(): readonly RegisteredAiProvider[];
  requestText(providerId: AiProviderId, request: AiTextRequest): Promise<AiTextResponse>;
}

export const IAiService = createServiceIdentifier<IAiService>("ai");

export const aiProviderRegistrationLimits = {
  idLength: 256,
  titleLength: 160
} as const;

const aiJsonLimits = {
  arrayItems: 200,
  depth: 12,
  objectProperties: 500,
  propertyNameLength: 160,
  stringLength: 100000
} as const;

export const aiTextMetadataLimits = {
  entries: 100,
  keyLength: 120,
  valueLength: 4000
} as const;

export const aiTextRequestLimits = {
  contextItemCount: 100,
  contextKindLength: 80,
  contextTitleLength: 240,
  contextValueLength: 1000000,
  inputLength: 5000000,
  instructionLength: 20000,
  outputFormatDescriptionLength: 1000,
  outputFormatKindLength: 80,
  outputFormatNameLength: 120
} as const;

export const aiTextProviderResultLimits = {
  modelLength: 120,
  tokenUsageMax: 1000000000,
  valueLength: 5000000
} as const;

export class AiService implements IAiService {
  private readonly providers = new Map<AiProviderId, AiProvider>();
  private readonly onDidChangeAiProvidersEmitter = new Emitter<void>();

  readonly onDidChangeAiProviders = this.onDidChangeAiProvidersEmitter.event;

  registerProvider(provider: AiProvider): IDisposable {
    const normalizedProvider = normalizeAiProvider(provider);

    if (this.providers.has(normalizedProvider.id)) {
      throw new Error(`AI provider already registered: ${normalizedProvider.id}`);
    }

    this.providers.set(normalizedProvider.id, normalizedProvider);
    this.onDidChangeAiProvidersEmitter.fire();

    return toDisposable(() => {
      if (this.providers.get(normalizedProvider.id) === normalizedProvider) {
        this.providers.delete(normalizedProvider.id);
        this.onDidChangeAiProvidersEmitter.fire();
      }
    });
  }

  getProviders(): readonly RegisteredAiProvider[] {
    return [...this.providers.values()]
      .map((provider) => ({ id: provider.id, title: provider.title }))
      .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id));
  }

  async requestText(providerId: AiProviderId, request: AiTextRequest): Promise<AiTextResponse> {
    const normalizedProviderId = normalizeAiProviderId(providerId, "AI provider id");
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
  const id = normalizeAiProviderId(record.id, "AI provider id");
  const title = readTrimmedRequiredString(
    record.title,
    `AI provider title for ${id}`,
    aiProviderRegistrationLimits.titleLength
  );

  if (typeof provider.requestText !== "function") {
    throw new Error(`AI provider for ${id} must provide requestText`);
  }

  return {
    id,
    title,
    requestText: (request) => provider.requestText(request)
  };
}

function normalizeAiProviderId(value: unknown, label: string): string {
  const id = readTrimmedRequiredString(value, label, aiProviderRegistrationLimits.idLength);

  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id)) {
    throw new Error(`${label} is invalid: ${id}`);
  }

  return id;
}

function readTrimmedRequiredString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }

  return normalized;
}

function normalizeAiTextRequest(request: AiTextRequest): AiTextRequest {
  const record = expectRecord(request, "AI text request");
  const instruction = readRequiredString(
    record.instruction,
    "AI text request instruction",
    aiTextRequestLimits.instructionLength
  );
  const input = readString(record.input, "AI text request input", aiTextRequestLimits.inputLength);
  const context = normalizeAiTextContext(record.context);
  const metadata = normalizeAiTextMetadata(record.metadata);
  const outputFormat = normalizeAiTextOutputFormat(record.outputFormat);

  return {
    instruction,
    input,
    ...(context !== undefined ? { context } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
    ...(outputFormat !== undefined ? { outputFormat } : {}),
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

  if (value.length > aiTextRequestLimits.contextItemCount) {
    throw new Error(`AI text request context must contain at most ${aiTextRequestLimits.contextItemCount} items`);
  }

  return value.map((item, index) => {
    const record = expectRecord(item, `AI text request context item ${index}`);
    const kind = readRequiredString(
      record.kind,
      `AI text request context item ${index} kind`,
      aiTextRequestLimits.contextKindLength
    );
    const contextValue = readRequiredString(
      record.value,
      `AI text request context item ${index} value`,
      aiTextRequestLimits.contextValueLength
    );
    const title = readOptionalString(
      record.title,
      `AI text request context item ${index} title`,
      aiTextRequestLimits.contextTitleLength
    );

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
  const entries = Object.entries(record);
  const metadata: Record<string, string> = {};

  if (entries.length > aiTextMetadataLimits.entries) {
    throw new Error(`AI text request metadata must contain at most ${aiTextMetadataLimits.entries} entries`);
  }

  for (const [key, metadataValue] of entries) {
    const normalizedKey = key.trim();

    if (!normalizedKey) {
      throw new Error("AI text request metadata keys must not be empty");
    }

    if (normalizedKey.length > aiTextMetadataLimits.keyLength) {
      throw new Error(
        `AI text request metadata key must be at most ${aiTextMetadataLimits.keyLength} characters`
      );
    }

    if (Object.hasOwn(metadata, normalizedKey)) {
      throw new Error(`AI text request metadata must not contain duplicate key: ${normalizedKey}`);
    }

    const normalizedValue = readString(metadataValue, `AI text request metadata ${normalizedKey}`);

    if (normalizedValue.length > aiTextMetadataLimits.valueLength) {
      throw new Error(
        `AI text request metadata value for ${normalizedKey} must be at most ${aiTextMetadataLimits.valueLength} characters`
      );
    }

    metadata[normalizedKey] = normalizedValue;
  }

  return metadata;
}

function normalizeAiTextOutputFormat(value: unknown): AiTextOutputFormat | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, "AI text request output format");
  const kind = readRequiredString(
    record.kind,
    "AI text request output format kind",
    aiTextRequestLimits.outputFormatKindLength
  );

  if (kind === "text") {
    return { kind };
  }

  if (kind === "json") {
    return { kind };
  }

  if (kind === "jsonSchema") {
    const description = readOptionalString(
      record.description,
      "AI text request output format description",
      aiTextRequestLimits.outputFormatDescriptionLength
    );
    const strict = readOptionalBoolean(record.strict, "AI text request output format strict");

    return {
      kind,
      name: readRequiredString(
        record.name,
        "AI text request output format schema name",
        aiTextRequestLimits.outputFormatNameLength
      ),
      schema: normalizeAiJsonObject(record.schema, "AI text request output format schema"),
      ...(description ? { description } : {}),
      ...(strict !== undefined ? { strict } : {})
    };
  }

  throw new Error("AI text request output format kind must be text, json, or jsonSchema");
}

function normalizeAiJsonObject(value: unknown, label: string): AiJsonObject {
  const normalized = normalizeAiJsonValue(value, label);

  if (!isAiJsonObject(normalized)) {
    throw new Error(`${label} must be a JSON object`);
  }

  return normalized;
}

function normalizeAiJsonValue(value: unknown, label: string, depth = 0): AiJsonValue {
  if (depth > aiJsonLimits.depth) {
    throw new Error(`${label} exceeds maximum JSON depth`);
  }

  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be a finite number`);
    }

    return value;
  }

  if (typeof value === "string") {
    if (value.length > aiJsonLimits.stringLength) {
      throw new Error(`${label} string must be at most ${aiJsonLimits.stringLength} characters`);
    }

    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > aiJsonLimits.arrayItems) {
      throw new Error(`${label} array must contain at most ${aiJsonLimits.arrayItems} items`);
    }

    return value.map((item, index) => normalizeAiJsonValue(item, `${label}[${index}]`, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    if (!isPlainJsonObject(value)) {
      throw new Error(`${label} must be a plain JSON object`);
    }

    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length > aiJsonLimits.objectProperties) {
      throw new Error(`${label} object must contain at most ${aiJsonLimits.objectProperties} properties`);
    }

    const result: Record<string, AiJsonValue> = {};

    for (const [key, item] of entries) {
      if (!key.trim()) {
        throw new Error(`${label} property names must not be empty`);
      }

      if (key.length > aiJsonLimits.propertyNameLength) {
        throw new Error(`${label} property names must be at most ${aiJsonLimits.propertyNameLength} characters`);
      }

      result[key] = normalizeAiJsonValue(item, `${label}.${key}`, depth + 1);
    }

    return result;
  }

  throw new Error(`${label} must be JSON serializable`);
}

function normalizeAiTextProviderResult(result: AiTextProviderResult): AiTextProviderResult {
  const record = expectRecord(result, "AI text provider result");
  const value = readString(
    record.value,
    "AI text provider result value",
    aiTextProviderResultLimits.valueLength
  );
  const model = readOptionalString(
    record.model,
    "AI text provider result model",
    aiTextProviderResultLimits.modelLength
  );
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

  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > aiTextProviderResultLimits.tokenUsageMax
  ) {
    throw new Error(
      `AI token usage ${key} must be a non-negative finite number at most ${aiTextProviderResultLimits.tokenUsageMax}`
    );
  }

  return { [key]: value } as Partial<Record<Key, number>>;
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function isAiJsonObject(value: AiJsonValue): value is AiJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isPlainJsonObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);

  return prototype === Object.prototype || prototype === null;
}

function readRequiredString(value: unknown, label: string, maxLength?: number): string {
  const normalized = readString(value, label, maxLength).trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}

function readString(value: unknown, label: string, maxLength?: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  if (maxLength !== undefined && value.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }

  return value;
}

function readOptionalString(value: unknown, label: string, maxLength?: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return readString(value, label, maxLength).trim() || undefined;
}

function readOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }

  return value;
}
