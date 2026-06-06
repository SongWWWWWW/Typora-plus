import { Emitter, toDisposable, type Event, type IDisposable, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type MarkdownRendererKind = "block" | "inline";

export interface MarkdownRendererContribution {
  readonly id: string;
  readonly label: string;
  readonly kind: MarkdownRendererKind;
  readonly language?: string;
  readonly priority?: number;
}

export interface RegisteredMarkdownRenderer extends MarkdownRendererContribution {
  readonly hasProvider: boolean;
}

export interface MarkdownRendererInput {
  readonly value: string;
  readonly language?: string;
  readonly uri?: URIType;
}

export interface MarkdownRendererOutput {
  readonly html: string;
}

export interface MarkdownRendererProvider {
  readonly id: string;
  render(input: MarkdownRendererInput): MarkdownRendererOutput | Promise<MarkdownRendererOutput>;
}

export interface MarkdownRendererRuntimeMetadata extends Omit<MarkdownRendererContribution, "id"> {}

export type MarkdownRendererActivationHandler = (rendererId: string) => void | Promise<void>;

export interface MarkdownRendererServiceOptions {
  readonly activationHandler?: MarkdownRendererActivationHandler;
}

export interface IMarkdownRendererService {
  readonly onDidChangeMarkdownRenderers: Event<void>;
  registerRendererContribution(contribution: MarkdownRendererContribution): IDisposable;
  registerRendererProvider(provider: MarkdownRendererProvider, metadata?: MarkdownRendererRuntimeMetadata): IDisposable;
  getRenderers(): readonly RegisteredMarkdownRenderer[];
  getRenderer(id: string): RegisteredMarkdownRenderer | undefined;
  render(input: MarkdownRendererInput, rendererId: string): Promise<MarkdownRendererOutput>;
}

export const IMarkdownRendererService =
  createServiceIdentifier<IMarkdownRendererService>("markdownRenderer");

export class MarkdownRendererService implements IMarkdownRendererService {
  private readonly contributions = new Map<string, MarkdownRendererContribution>();
  private readonly providers = new Map<string, MarkdownRendererProvider>();
  private readonly runtimeContributionIds = new Set<string>();
  private readonly onDidChangeMarkdownRenderersEmitter = new Emitter<void>();

  readonly onDidChangeMarkdownRenderers = this.onDidChangeMarkdownRenderersEmitter.event;

  constructor(private readonly options: MarkdownRendererServiceOptions = {}) {}

  registerRendererContribution(contribution: MarkdownRendererContribution): IDisposable {
    const normalizedContribution = normalizeMarkdownRendererContribution(contribution);

    if (this.contributions.has(normalizedContribution.id)) {
      throw new Error(`Markdown renderer already registered: ${normalizedContribution.id}`);
    }

    this.contributions.set(normalizedContribution.id, normalizedContribution);
    this.onDidChangeMarkdownRenderersEmitter.fire();

    return toDisposable(() => {
      if (this.contributions.get(normalizedContribution.id) === normalizedContribution) {
        this.contributions.delete(normalizedContribution.id);
        this.providers.delete(normalizedContribution.id);
        this.runtimeContributionIds.delete(normalizedContribution.id);
        this.onDidChangeMarkdownRenderersEmitter.fire();
      }
    });
  }

  registerRendererProvider(
    provider: MarkdownRendererProvider,
    metadata?: MarkdownRendererRuntimeMetadata
  ): IDisposable {
    const normalizedProvider = normalizeMarkdownRendererProvider(provider);

    if (this.providers.has(normalizedProvider.id)) {
      throw new Error(`Markdown renderer provider already registered: ${normalizedProvider.id}`);
    }

    let registeredRuntimeContribution = false;

    if (!this.contributions.has(normalizedProvider.id)) {
      const runtimeContribution = normalizeMarkdownRendererContribution({
        id: normalizedProvider.id,
        ...normalizeRuntimeMetadata(metadata, normalizedProvider.id)
      });
      this.contributions.set(runtimeContribution.id, runtimeContribution);
      this.runtimeContributionIds.add(runtimeContribution.id);
      registeredRuntimeContribution = true;
    }

    this.providers.set(normalizedProvider.id, normalizedProvider);
    this.onDidChangeMarkdownRenderersEmitter.fire();

    return toDisposable(() => {
      if (this.providers.get(normalizedProvider.id) !== normalizedProvider) {
        return;
      }

      this.providers.delete(normalizedProvider.id);

      if (registeredRuntimeContribution && this.runtimeContributionIds.has(normalizedProvider.id)) {
        this.contributions.delete(normalizedProvider.id);
        this.runtimeContributionIds.delete(normalizedProvider.id);
      }

      this.onDidChangeMarkdownRenderersEmitter.fire();
    });
  }

  getRenderers(): readonly RegisteredMarkdownRenderer[] {
    return [...this.contributions.values()]
      .map((contribution) => this.toRegisteredRenderer(contribution))
      .sort(compareMarkdownRenderers);
  }

  getRenderer(id: string): RegisteredMarkdownRenderer | undefined {
    const normalizedId = readRequiredString(id, "Markdown renderer id");
    const contribution = this.contributions.get(normalizedId);

    return contribution ? this.toRegisteredRenderer(contribution) : undefined;
  }

  async render(input: MarkdownRendererInput, rendererId: string): Promise<MarkdownRendererOutput> {
    const normalizedId = readRequiredString(rendererId, "Markdown renderer id");
    const provider = await this.resolveRendererProvider(normalizedId);

    return normalizeMarkdownRendererOutput(await provider.render(normalizeMarkdownRendererInput(input)));
  }

  private toRegisteredRenderer(contribution: MarkdownRendererContribution): RegisteredMarkdownRenderer {
    return {
      ...cloneMarkdownRendererContribution(contribution),
      hasProvider: this.providers.has(contribution.id)
    };
  }

  private async resolveRendererProvider(rendererId: string): Promise<MarkdownRendererProvider> {
    const provider = this.providers.get(rendererId);

    if (provider) {
      return provider;
    }

    if (!this.contributions.has(rendererId)) {
      throw new Error(`Unknown Markdown renderer: ${rendererId}`);
    }

    if (this.options.activationHandler) {
      await this.options.activationHandler(rendererId);
    }

    const activatedProvider = this.providers.get(rendererId);

    if (!activatedProvider) {
      throw new Error(`No Markdown renderer provider registered: ${rendererId}`);
    }

    return activatedProvider;
  }
}

function normalizeMarkdownRendererContribution(
  contribution: MarkdownRendererContribution
): MarkdownRendererContribution {
  const record = expectRecord(contribution, "Markdown renderer contribution");
  const id = readRequiredString(record.id, "Markdown renderer id");
  const label = readRequiredString(record.label, `Markdown renderer label for ${id}`);
  const kind = normalizeMarkdownRendererKind(record.kind, id);
  const language = normalizeOptionalMarkdownRendererLanguage(record.language, id);
  const priority = readOptionalNumber(record.priority, `Markdown renderer priority for ${id}`);

  return {
    id,
    label,
    kind,
    ...(language ? { language } : {}),
    ...(priority !== undefined ? { priority } : {})
  };
}

function normalizeMarkdownRendererProvider(provider: MarkdownRendererProvider): MarkdownRendererProvider {
  const record = expectRecord(provider, "Markdown renderer provider");
  const id = readRequiredString(record.id, "Markdown renderer provider id");

  if (typeof provider.render !== "function") {
    throw new Error(`Markdown renderer provider for ${id} must provide render`);
  }

  return {
    id,
    render: (input) => provider.render(input)
  };
}

function normalizeRuntimeMetadata(
  metadata: MarkdownRendererRuntimeMetadata | undefined,
  rendererId: string
): MarkdownRendererRuntimeMetadata {
  if (!metadata) {
    throw new Error(`Runtime Markdown renderer metadata must be provided for uncontributed renderer: ${rendererId}`);
  }

  const record = expectRecord(metadata, `Runtime Markdown renderer metadata for ${rendererId}`);
  const label = readRequiredString(record.label, `Runtime Markdown renderer label for ${rendererId}`);
  const kind = normalizeMarkdownRendererKind(record.kind, rendererId);
  const language = normalizeOptionalMarkdownRendererLanguage(record.language, rendererId);
  const priority = readOptionalNumber(record.priority, `Runtime Markdown renderer priority for ${rendererId}`);

  return {
    label,
    kind,
    ...(language ? { language } : {}),
    ...(priority !== undefined ? { priority } : {})
  };
}

function normalizeMarkdownRendererInput(input: MarkdownRendererInput): MarkdownRendererInput {
  const record = expectRecord(input, "Markdown renderer input");
  const value = readString(record.value, "Markdown renderer input value");
  const language = normalizeOptionalMarkdownRendererLanguage(record.language, "input");

  return {
    value,
    ...(language ? { language } : {}),
    ...(record.uri ? { uri: record.uri as URIType } : {})
  };
}

function normalizeMarkdownRendererOutput(output: MarkdownRendererOutput): MarkdownRendererOutput {
  const record = expectRecord(output, "Markdown renderer output");

  return {
    html: readString(record.html, "Markdown renderer output HTML")
  };
}

function normalizeMarkdownRendererKind(value: unknown, rendererId: string): MarkdownRendererKind {
  if (value !== "block" && value !== "inline") {
    throw new Error(`Markdown renderer kind for ${rendererId} must be block or inline`);
  }

  return value;
}

function normalizeOptionalMarkdownRendererLanguage(value: unknown, rendererId: string): string | undefined {
  const language = readOptionalString(value, `Markdown renderer language for ${rendererId}`);

  if (language === undefined) {
    return undefined;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/.test(language)) {
    throw new Error(`Markdown renderer language for ${rendererId} is invalid: ${language}`);
  }

  return language.toLowerCase();
}

function compareMarkdownRenderers(
  first: RegisteredMarkdownRenderer,
  second: RegisteredMarkdownRenderer
): number {
  return (second.priority ?? 0) - (first.priority ?? 0) ||
    first.label.localeCompare(second.label) ||
    first.id.localeCompare(second.id);
}

function cloneMarkdownRendererContribution(
  contribution: MarkdownRendererContribution
): MarkdownRendererContribution {
  return {
    id: contribution.id,
    label: contribution.label,
    kind: contribution.kind,
    ...(contribution.language ? { language: contribution.language } : {}),
    ...(contribution.priority !== undefined ? { priority: contribution.priority } : {})
  };
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

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function readOptionalNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }

  return value;
}
