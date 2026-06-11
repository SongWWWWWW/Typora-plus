import { Emitter, type Event } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";
import type { UserKeybindingRule } from "./keybindings";

export type ColorSchemePreference = "light" | "dark" | "system";
export type AiProviderConfigurationKind = "responses";
export type MarkdownStatusBadgeTone = "danger" | "info" | "neutral" | "success" | "warning";
export type RemoteSyncProviderConfigurationKind = "native-request";

export interface ConfigurationNumberConstraint {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

export interface MarkdownStatusBadgeConfiguration {
  readonly key: string;
  readonly label: string;
  readonly tone: MarkdownStatusBadgeTone;
  readonly aliases: readonly string[];
}

export interface AiProviderConfiguration {
  readonly id: string;
  readonly title: string;
  readonly kind: AiProviderConfigurationKind;
  readonly endpointUrl: string;
  readonly model: string;
  readonly secretRef: string;
  readonly store?: boolean;
}

export interface RemoteSyncProviderSecretConfiguration {
  readonly name: string;
  readonly secretRef: string;
}

export interface RemoteSyncProviderConfiguration {
  readonly id: string;
  readonly title: string;
  readonly kind: RemoteSyncProviderConfigurationKind;
  readonly baseUrl: string;
  readonly remoteScopeId?: string;
  readonly secrets: readonly RemoteSyncProviderSecretConfiguration[];
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface TyporaPlusConfiguration {
  readonly appearance: {
    readonly colorScheme: ColorSchemePreference;
    readonly density: "comfortable" | "compact";
    readonly themeId?: string;
  };
  readonly ai: {
    readonly providers: readonly AiProviderConfiguration[];
    readonly workspaceContextMaxPreviewLength: number;
    readonly workspaceContextMaxResults: number;
  };
  readonly remoteSync: {
    readonly providers: readonly RemoteSyncProviderConfiguration[];
  };
  readonly editor: {
    readonly fontSize: number;
    readonly lineHeight: number;
    readonly maxWidth: number;
    readonly focusMode: boolean;
    readonly typewriterMode: boolean;
    readonly autoSave: boolean;
    readonly autoSaveDelayMs: number;
    readonly rendererPreviewCacheEntries: number;
  };
  readonly workspace: {
    readonly defaultAssetFolder: string;
    readonly quickOpenMaxResults: number;
    readonly searchMaxFileSizeBytes: number;
    readonly searchMaxResults: number;
  };
  readonly extensionHost: {
    readonly requestTimeoutMs: number;
    readonly wireMessageMaxLength: number;
  };
  readonly markdown: {
    readonly statusBadges: readonly MarkdownStatusBadgeConfiguration[];
  };
  readonly keybindings: {
    readonly overrides: readonly UserKeybindingRule[];
  };
}

export type PartialAppearanceConfiguration =
  Omit<Partial<TyporaPlusConfiguration["appearance"]>, "themeId"> & {
    readonly themeId?: string | undefined;
  };

export interface ConfigurationStorage {
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

export interface NativeConfigurationBridge {
  readonly isAvailable: boolean;
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

export interface ConfigurationServiceOptions {
  readonly storageKey: string;
  readonly storage?: ConfigurationStorage;
}

export interface IConfigurationService {
  readonly onDidChangeConfiguration: Event<TyporaPlusConfiguration>;
  getValue(): TyporaPlusConfiguration;
  updateValue(value: PartialConfiguration): void;
}

export type PartialConfiguration = {
  readonly appearance?: PartialAppearanceConfiguration;
  readonly ai?: Partial<TyporaPlusConfiguration["ai"]>;
  readonly remoteSync?: Partial<TyporaPlusConfiguration["remoteSync"]>;
  readonly editor?: Partial<TyporaPlusConfiguration["editor"]>;
  readonly workspace?: Partial<TyporaPlusConfiguration["workspace"]>;
  readonly extensionHost?: Partial<TyporaPlusConfiguration["extensionHost"]>;
  readonly markdown?: Partial<TyporaPlusConfiguration["markdown"]>;
  readonly keybindings?: Partial<TyporaPlusConfiguration["keybindings"]>;
};

export const IConfigurationService = createServiceIdentifier<IConfigurationService>("configuration");

export const defaultConfigurationServiceOptions: ConfigurationServiceOptions = {
  storageKey: "typora-plus.configuration"
};

export const configurationBytesPerMegabyte = 1024 * 1024;
export const configurationMaxAiProviders = 20;
export const configurationMaxAiProviderIdLength = 256;
export const configurationMaxAiProviderTitleLength = 160;
export const configurationMaxAiProviderEndpointUrlLength = 2000;
export const configurationMaxAiProviderModelLength = 120;
export const configurationMaxAiProviderSecretRefLength = 256;
export const configurationMaxRemoteSyncProviders = 20;
export const configurationMaxRemoteSyncProviderIdLength = 256;
export const configurationMaxRemoteSyncProviderTitleLength = 160;
export const configurationMaxRemoteSyncProviderBaseUrlLength = 2000;
export const configurationMaxRemoteSyncProviderRemoteScopeIdLength = 256;
export const configurationMaxRemoteSyncProviderSecrets = 16;
export const configurationMaxRemoteSyncProviderSecretNameLength = 64;
export const configurationMaxRemoteSyncProviderSecretRefLength = 256;
export const configurationMaxRemoteSyncProviderMetadataEntries = 32;
export const configurationMaxRemoteSyncProviderMetadataKeyLength = 64;
export const configurationMaxRemoteSyncProviderMetadataValueLength = 512;
export const configurationMaxMarkdownStatusBadges = 50;
export const configurationMaxMarkdownStatusBadgeAliases = 30;
export const configurationMaxMarkdownStatusBadgeTextLength = 64;

export const configurationNumberConstraints = {
  aiWorkspaceContextMaxPreviewLength: { min: 80, max: 320, step: 20 },
  aiWorkspaceContextMaxResults: { min: 0, max: 12, step: 1 },
  editorFontSize: { min: 13, max: 24, step: 1 },
  editorLineHeight: { min: 1.2, max: 2.2, step: 0.01 },
  editorMaxWidth: { min: 560, max: 1120, step: 20 },
  editorAutoSaveDelayMs: { min: 250, max: 5000, step: 50 },
  editorRendererPreviewCacheEntries: { min: 0, max: 200, step: 10 },
  workspaceSearchMaxFileSizeBytes: {
    min: configurationBytesPerMegabyte,
    max: 20 * configurationBytesPerMegabyte,
    step: configurationBytesPerMegabyte
  },
  workspaceQuickOpenMaxResults: { min: 20, max: 300, step: 10 },
  workspaceSearchMaxResults: { min: 20, max: 500, step: 10 },
  extensionHostRequestTimeoutMs: { min: 0, max: 60_000, step: 500 },
  extensionHostWireMessageMaxLength: {
    min: 0,
    max: 10 * configurationBytesPerMegabyte,
    step: 64 * 1024
  }
} as const satisfies Record<string, ConfigurationNumberConstraint>;

export const defaultMarkdownStatusBadges = [
  {
    key: "done",
    aliases: ["complete", "completed", "ok", "success", "yes"],
    label: "Done",
    tone: "success"
  },
  {
    key: "doing",
    aliases: ["in-progress", "progress", "wip", "active"],
    label: "In Progress",
    tone: "info"
  },
  {
    key: "pending",
    aliases: ["review", "waiting", "hold"],
    label: "Pending",
    tone: "warning"
  },
  {
    key: "blocked",
    aliases: ["error", "failed", "failure", "risk"],
    label: "Blocked",
    tone: "danger"
  },
  {
    key: "todo",
    aliases: ["open", "planned", "draft"],
    label: "Todo",
    tone: "neutral"
  }
] as const satisfies readonly MarkdownStatusBadgeConfiguration[];

export const defaultConfiguration: TyporaPlusConfiguration = {
  appearance: {
    colorScheme: "system",
    density: "comfortable"
  },
  ai: {
    providers: [],
    workspaceContextMaxPreviewLength: 160,
    workspaceContextMaxResults: 5
  },
  remoteSync: {
    providers: []
  },
  editor: {
    fontSize: 17,
    lineHeight: 1.72,
    maxWidth: 860,
    focusMode: false,
    typewriterMode: false,
    autoSave: true,
    autoSaveDelayMs: 800,
    rendererPreviewCacheEntries: 40
  },
  workspace: {
    defaultAssetFolder: "assets",
    quickOpenMaxResults: 80,
    searchMaxFileSizeBytes: 2 * configurationBytesPerMegabyte,
    searchMaxResults: 120
  },
  extensionHost: {
    requestTimeoutMs: 15_000,
    wireMessageMaxLength: configurationBytesPerMegabyte
  },
  markdown: {
    statusBadges: defaultMarkdownStatusBadges
  },
  keybindings: {
    overrides: []
  }
};

export class ConfigurationService implements IConfigurationService {
  private readonly emitter = new Emitter<TyporaPlusConfiguration>();
  private readonly storage: ConfigurationStorage;
  private value: TyporaPlusConfiguration;

  readonly onDidChangeConfiguration = this.emitter.event;

  constructor(private readonly options: ConfigurationServiceOptions = defaultConfigurationServiceOptions) {
    this.storage = options.storage ?? createBrowserConfigurationStorage();
    this.value = this.readConfiguration();
  }

  getValue(): TyporaPlusConfiguration {
    return this.value;
  }

  updateValue(value: PartialConfiguration): void {
    this.value = mergeConfiguration(this.value, sanitizePartialConfiguration(value));
    this.persist();
    this.emitter.fire(this.value);
  }

  private readConfiguration(): TyporaPlusConfiguration {
    const rawValue = this.storage.read(this.options.storageKey);

    if (!rawValue) {
      return defaultConfiguration;
    }

    try {
      return mergeConfiguration(defaultConfiguration, sanitizePartialConfiguration(JSON.parse(rawValue)));
    } catch {
      this.storage.write(this.options.storageKey, JSON.stringify(defaultConfiguration));
      return defaultConfiguration;
    }
  }

  private persist(): void {
    this.storage.write(this.options.storageKey, JSON.stringify(this.value));
  }
}

export function mergeConfiguration(
  base: TyporaPlusConfiguration,
  value: PartialConfiguration
): TyporaPlusConfiguration {
  return {
    appearance: mergeAppearanceConfiguration(base.appearance, value.appearance),
    ai: {
      ...base.ai,
      ...value.ai
    },
    remoteSync: {
      ...base.remoteSync,
      ...value.remoteSync
    },
    editor: {
      ...base.editor,
      ...value.editor
    },
    workspace: {
      ...base.workspace,
      ...value.workspace
    },
    extensionHost: {
      ...base.extensionHost,
      ...value.extensionHost
    },
    markdown: {
      ...base.markdown,
      ...value.markdown
    },
    keybindings: {
      ...base.keybindings,
      ...value.keybindings
    }
  };
}

function mergeAppearanceConfiguration(
  base: TyporaPlusConfiguration["appearance"],
  value: PartialAppearanceConfiguration | undefined
): TyporaPlusConfiguration["appearance"] {
  if (!value) {
    return base;
  }

  const next: {
    colorScheme: ColorSchemePreference;
    density: "comfortable" | "compact";
    themeId?: string;
  } = {
    ...base
  };

  if (value.colorScheme) {
    next.colorScheme = value.colorScheme;
  }

  if (value.density) {
    next.density = value.density;
  }

  if ("themeId" in value) {
    if (value.themeId) {
      next.themeId = value.themeId;
    } else {
      delete next.themeId;
    }
  }

  return next;
}

function sanitizePartialConfiguration(value: unknown): PartialConfiguration {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...(isRecord(value.appearance) ? { appearance: sanitizeAppearanceConfiguration(value.appearance) } : {}),
    ...(isRecord(value.ai) ? { ai: sanitizeAiConfiguration(value.ai) } : {}),
    ...(isRecord(value.remoteSync) ? { remoteSync: sanitizeRemoteSyncConfiguration(value.remoteSync) } : {}),
    ...(isRecord(value.editor) ? { editor: sanitizeEditorConfiguration(value.editor) } : {}),
    ...(isRecord(value.workspace) ? { workspace: sanitizeWorkspaceConfiguration(value.workspace) } : {}),
    ...(isRecord(value.extensionHost) ? { extensionHost: sanitizeExtensionHostConfiguration(value.extensionHost) } : {}),
    ...(isRecord(value.markdown) ? { markdown: sanitizeMarkdownConfiguration(value.markdown) } : {}),
    ...(isRecord(value.keybindings) ? { keybindings: sanitizeKeybindingsConfiguration(value.keybindings) } : {})
  };
}

function sanitizeAppearanceConfiguration(value: Record<string, unknown>): PartialAppearanceConfiguration {
  const appearance: {
    colorScheme?: ColorSchemePreference;
    density?: "comfortable" | "compact";
    themeId?: string | undefined;
  } = {
    ...(isColorSchemePreference(value.colorScheme) ? { colorScheme: value.colorScheme } : {}),
    ...(value.density === "comfortable" || value.density === "compact" ? { density: value.density } : {})
  };

  if ("themeId" in value) {
    appearance.themeId = isNonEmptyString(value.themeId) ? value.themeId.trim() : undefined;
  }

  return appearance;
}

function sanitizeAiConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["ai"]> {
  const providers = sanitizeAiProviderConfigurations(value.providers);

  return {
    ...(providers !== undefined ? { providers } : {}),
    ...sanitizeNumberProperty(
      "workspaceContextMaxPreviewLength",
      value.workspaceContextMaxPreviewLength,
      configurationNumberConstraints.aiWorkspaceContextMaxPreviewLength
    ),
    ...sanitizeNumberProperty(
      "workspaceContextMaxResults",
      value.workspaceContextMaxResults,
      configurationNumberConstraints.aiWorkspaceContextMaxResults
    )
  };
}

function sanitizeRemoteSyncConfiguration(
  value: Record<string, unknown>
): Partial<TyporaPlusConfiguration["remoteSync"]> {
  const providers = sanitizeRemoteSyncProviderConfigurations(value.providers);

  return {
    ...(providers !== undefined ? { providers } : {})
  };
}

function sanitizeEditorConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["editor"]> {
  return {
    ...sanitizeNumberProperty("fontSize", value.fontSize, configurationNumberConstraints.editorFontSize),
    ...sanitizeNumberProperty("lineHeight", value.lineHeight, configurationNumberConstraints.editorLineHeight),
    ...sanitizeNumberProperty("maxWidth", value.maxWidth, configurationNumberConstraints.editorMaxWidth),
    ...(typeof value.focusMode === "boolean" ? { focusMode: value.focusMode } : {}),
    ...(typeof value.typewriterMode === "boolean" ? { typewriterMode: value.typewriterMode } : {}),
    ...(typeof value.autoSave === "boolean" ? { autoSave: value.autoSave } : {}),
    ...sanitizeNumberProperty("autoSaveDelayMs", value.autoSaveDelayMs, configurationNumberConstraints.editorAutoSaveDelayMs),
    ...sanitizeNumberProperty(
      "rendererPreviewCacheEntries",
      value.rendererPreviewCacheEntries,
      configurationNumberConstraints.editorRendererPreviewCacheEntries
    )
  };
}

function sanitizeAiProviderConfigurations(value: unknown): readonly AiProviderConfiguration[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const providers: AiProviderConfiguration[] = [];
  const seenIds = new Set<string>();

  for (const candidate of value.slice(0, configurationMaxAiProviders)) {
    const provider = normalizeAiProviderConfiguration(candidate);

    if (!provider || seenIds.has(provider.id)) {
      continue;
    }

    seenIds.add(provider.id);
    providers.push(provider);
  }

  if (providers.length === 0 && value.length > 0) {
    return undefined;
  }

  return providers;
}

export function normalizeAiProviderConfiguration(value: unknown): AiProviderConfiguration | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = normalizeAiProviderConfigurationId(value.id);
  const title = normalizeConfigurationText(value.title, configurationMaxAiProviderTitleLength);
  const kind = normalizeAiProviderConfigurationKind(value.kind);
  const endpointUrl = normalizeAiProviderEndpointUrl(value.endpointUrl);
  const model = normalizeConfigurationText(value.model, configurationMaxAiProviderModelLength);
  const secretRef = normalizeAiProviderSecretRef(value.secretRef);

  if (!id || !title || !kind || !endpointUrl || !model || !secretRef) {
    return undefined;
  }

  return {
    id,
    title,
    kind,
    endpointUrl,
    model,
    secretRef,
    ...(typeof value.store === "boolean" ? { store: value.store } : {})
  };
}

function sanitizeRemoteSyncProviderConfigurations(
  value: unknown
): readonly RemoteSyncProviderConfiguration[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const providers: RemoteSyncProviderConfiguration[] = [];
  const seenIds = new Set<string>();

  for (const candidate of value.slice(0, configurationMaxRemoteSyncProviders)) {
    const provider = normalizeRemoteSyncProviderConfiguration(candidate);

    if (!provider || seenIds.has(provider.id)) {
      continue;
    }

    seenIds.add(provider.id);
    providers.push(provider);
  }

  if (providers.length === 0 && value.length > 0) {
    return undefined;
  }

  return providers;
}

export function normalizeRemoteSyncProviderConfiguration(
  value: unknown
): RemoteSyncProviderConfiguration | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const id = normalizeRemoteSyncProviderConfigurationId(value.id);
  const title = normalizeConfigurationText(value.title, configurationMaxRemoteSyncProviderTitleLength);
  const kind = normalizeRemoteSyncProviderConfigurationKind(value.kind);
  const baseUrl = normalizeProviderHttpsOrLoopbackUrl(value.baseUrl, configurationMaxRemoteSyncProviderBaseUrlLength);
  const remoteScopeId = normalizeRemoteSyncProviderRemoteScopeId(value.remoteScopeId);
  const secrets = sanitizeRemoteSyncProviderSecretConfigurations(value.secrets);
  const metadata = sanitizeRemoteSyncProviderMetadata(value.metadata);

  if (!id || !title || !kind || !baseUrl || secrets === undefined) {
    return undefined;
  }

  return {
    id,
    title,
    kind,
    baseUrl,
    ...(remoteScopeId ? { remoteScopeId } : {}),
    secrets,
    ...(metadata ? { metadata } : {})
  };
}

function sanitizeWorkspaceConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["workspace"]> {
  return {
    ...(isNonEmptyString(value.defaultAssetFolder) ? { defaultAssetFolder: value.defaultAssetFolder } : {}),
    ...sanitizeNumberProperty(
      "searchMaxFileSizeBytes",
      value.searchMaxFileSizeBytes,
      configurationNumberConstraints.workspaceSearchMaxFileSizeBytes
    ),
    ...sanitizeNumberProperty(
      "quickOpenMaxResults",
      value.quickOpenMaxResults,
      configurationNumberConstraints.workspaceQuickOpenMaxResults
    ),
    ...sanitizeNumberProperty("searchMaxResults", value.searchMaxResults, configurationNumberConstraints.workspaceSearchMaxResults)
  };
}

function sanitizeExtensionHostConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["extensionHost"]> {
  return {
    ...sanitizeNumberProperty(
      "requestTimeoutMs",
      value.requestTimeoutMs,
      configurationNumberConstraints.extensionHostRequestTimeoutMs
    ),
    ...sanitizeNumberProperty(
      "wireMessageMaxLength",
      value.wireMessageMaxLength,
      configurationNumberConstraints.extensionHostWireMessageMaxLength
    )
  };
}

function sanitizeMarkdownConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["markdown"]> {
  const statusBadges = sanitizeMarkdownStatusBadges(value.statusBadges);

  return {
    ...(statusBadges !== undefined ? { statusBadges } : {})
  };
}

function sanitizeMarkdownStatusBadges(value: unknown): readonly MarkdownStatusBadgeConfiguration[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const badges: MarkdownStatusBadgeConfiguration[] = [];
  const seenKeys = new Set<string>();

  for (const candidate of value.slice(0, configurationMaxMarkdownStatusBadges)) {
    if (!isRecord(candidate)) {
      continue;
    }

    const key = normalizeMarkdownStatusBadgeKey(candidate.key);
    const label = normalizeMarkdownStatusBadgeText(candidate.label);
    const tone = isMarkdownStatusBadgeTone(candidate.tone) ? candidate.tone : undefined;

    if (!key || !label || !tone || seenKeys.has(key)) {
      continue;
    }

    seenKeys.add(key);
    badges.push({
      key,
      label,
      tone,
      aliases: sanitizeMarkdownStatusBadgeAliases(candidate.aliases, key)
    });
  }

  if (badges.length === 0 && value.length > 0) {
    return undefined;
  }

  return badges;
}

function sanitizeMarkdownStatusBadgeAliases(value: unknown, key: string): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const aliases: string[] = [];
  const seenAliases = new Set([key]);

  for (const candidate of value.slice(0, configurationMaxMarkdownStatusBadgeAliases)) {
    const alias = normalizeMarkdownStatusBadgeKey(candidate);

    if (!alias || seenAliases.has(alias)) {
      continue;
    }

    seenAliases.add(alias);
    aliases.push(alias);
  }

  return aliases;
}

function sanitizeKeybindingsConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["keybindings"]> {
  if (!Array.isArray(value.overrides)) {
    return {};
  }

  return {
    overrides: value.overrides.filter(isUserKeybindingRule)
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColorSchemePreference(value: unknown): value is ColorSchemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function isMarkdownStatusBadgeTone(value: unknown): value is MarkdownStatusBadgeTone {
  return value === "danger" ||
    value === "info" ||
    value === "neutral" ||
    value === "success" ||
    value === "warning";
}

function isSupportedFiniteNumber(
  value: unknown,
  constraint: ConfigurationNumberConstraint
): value is number {
  return typeof value === "number" &&
    Number.isFinite(value) &&
    (value > 0 || (constraint.min === 0 && value === 0));
}

export function clampConfigurationNumber(value: number, constraint: ConfigurationNumberConstraint): number {
  if (!Number.isFinite(value)) {
    return constraint.min;
  }

  const clamped = Math.min(Math.max(value, constraint.min), constraint.max);
  return Number(clamped.toFixed(stepPrecision(constraint.step)));
}

function sanitizeNumberProperty<Key extends string>(
  key: Key,
  value: unknown,
  constraint: ConfigurationNumberConstraint
): Partial<Record<Key, number>> {
  if (!isSupportedFiniteNumber(value, constraint)) {
    return {};
  }

  return {
    [key]: clampConfigurationNumber(value, constraint)
  } as Partial<Record<Key, number>>;
}

function stepPrecision(step: number): number {
  const decimal = step.toString().split(".")[1];
  return decimal?.length ?? 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeAiProviderConfigurationId(value: unknown): string | undefined {
  const normalized = normalizeConfigurationText(value, configurationMaxAiProviderIdLength);

  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeAiProviderConfigurationKind(value: unknown): AiProviderConfigurationKind | undefined {
  return value === "responses" ? value : undefined;
}

function normalizeAiProviderEndpointUrl(value: unknown): string | undefined {
  return normalizeProviderHttpsOrLoopbackUrl(value, configurationMaxAiProviderEndpointUrlLength);
}

function normalizeAiProviderSecretRef(value: unknown): string | undefined {
  return normalizeConfigurationSecretRef(value, configurationMaxAiProviderSecretRefLength);
}

function normalizeRemoteSyncProviderConfigurationId(value: unknown): string | undefined {
  const normalized = normalizeConfigurationText(value, configurationMaxRemoteSyncProviderIdLength);

  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeRemoteSyncProviderConfigurationKind(
  value: unknown
): RemoteSyncProviderConfigurationKind | undefined {
  return value === "native-request" ? value : undefined;
}

function normalizeRemoteSyncProviderRemoteScopeId(value: unknown): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeConfigurationText(value, configurationMaxRemoteSyncProviderRemoteScopeIdLength);
}

function sanitizeRemoteSyncProviderSecretConfigurations(
  value: unknown
): readonly RemoteSyncProviderSecretConfiguration[] | undefined {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    return undefined;
  }

  const secrets: RemoteSyncProviderSecretConfiguration[] = [];
  const seenNames = new Set<string>();

  for (const candidate of value.slice(0, configurationMaxRemoteSyncProviderSecrets)) {
    if (!isRecord(candidate)) {
      continue;
    }

    const name = normalizeRemoteSyncProviderSecretName(candidate.name);
    const secretRef = normalizeConfigurationSecretRef(
      candidate.secretRef,
      configurationMaxRemoteSyncProviderSecretRefLength
    );

    if (!name || !secretRef || seenNames.has(name)) {
      continue;
    }

    seenNames.add(name);
    secrets.push({ name, secretRef });
  }

  if (secrets.length === 0 && value.length > 0) {
    return undefined;
  }

  return secrets;
}

function normalizeRemoteSyncProviderSecretName(value: unknown): string | undefined {
  const normalized = normalizeConfigurationText(value, configurationMaxRemoteSyncProviderSecretNameLength);

  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function sanitizeRemoteSyncProviderMetadata(value: unknown): Readonly<Record<string, string>> | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (!isRecord(value)) {
    return undefined;
  }

  const metadata: Record<string, string> = {};

  for (const [rawKey, rawValue] of Object.entries(value).slice(0, configurationMaxRemoteSyncProviderMetadataEntries)) {
    const key = normalizeConfigurationText(rawKey, configurationMaxRemoteSyncProviderMetadataKeyLength);
    const metadataValue = normalizeConfigurationText(rawValue, configurationMaxRemoteSyncProviderMetadataValueLength);

    if (!key || isSensitiveRemoteSyncProviderMetadataKey(key) || !metadataValue) {
      continue;
    }

    metadata[key] = metadataValue;
  }

  return Object.keys(metadata).length > 0 ? metadata : undefined;
}

function isSensitiveRemoteSyncProviderMetadataKey(value: string): boolean {
  return /(?:authorization|credential|password|secret|token|api[-_]?key)/i.test(value);
}

function normalizeConfigurationSecretRef(value: unknown, maxLength: number): string | undefined {
  const normalized = normalizeConfigurationText(value, maxLength);

  if (!normalized || !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeProviderHttpsOrLoopbackUrl(value: unknown, maxLength: number): string | undefined {
  const normalized = normalizeConfigurationText(value, maxLength);

  if (!normalized) {
    return undefined;
  }

  try {
    const url = new URL(normalized);
    return url.protocol === "https:" || isLoopbackHttpUrl(url)
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function isLoopbackHttpUrl(url: URL): boolean {
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

function normalizeConfigurationText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized || normalized.length > maxLength) {
    return undefined;
  }

  return normalized;
}

function normalizeMarkdownStatusBadgeKey(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();

  if (!normalized || normalized.length > configurationMaxMarkdownStatusBadgeTextLength) {
    return undefined;
  }

  if (!/^[a-z0-9][a-z0-9_.+-]*$/.test(normalized)) {
    return undefined;
  }

  return normalized;
}

function normalizeMarkdownStatusBadgeText(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized || normalized.length > configurationMaxMarkdownStatusBadgeTextLength) {
    return undefined;
  }

  return normalized;
}

function isUserKeybindingRule(value: unknown): value is UserKeybindingRule {
  if (!isRecord(value) || !isNonEmptyString(value.command) || !isRecord(value.keybinding)) {
    return false;
  }

  return isNonEmptyString(value.keybinding.key) &&
    isOptionalBoolean(value.keybinding.primary) &&
    isOptionalBoolean(value.keybinding.shift) &&
    isOptionalBoolean(value.keybinding.alt);
}

function isOptionalBoolean(value: unknown): boolean {
  return value === undefined || typeof value === "boolean";
}

function createBrowserConfigurationStorage(): ConfigurationStorage {
  const nativeStorage = createNativeConfigurationStorage();

  if (nativeStorage) {
    return nativeStorage;
  }

  return {
    read(key) {
      if (!hasLocalStorage()) {
        return undefined;
      }

      return window.localStorage.getItem(key) ?? undefined;
    },
    write(key, value) {
      if (!hasLocalStorage()) {
        return;
      }

      window.localStorage.setItem(key, value);
    }
  };
}

function createNativeConfigurationStorage(): ConfigurationStorage | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly configuration?: NativeConfigurationBridge;
    };
  };
  const bridge = candidate.typoraPlus?.configuration;

  if (!bridge?.isAvailable) {
    return undefined;
  }

  return {
    read: (key) => bridge.read(key),
    write: (key, value) => bridge.write(key, value)
  };
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}
