import { Emitter, type Event } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";
import type { UserKeybindingRule } from "./keybindings";

export type ColorSchemePreference = "light" | "dark" | "system";
export type MarkdownStatusBadgeTone = "danger" | "info" | "neutral" | "success" | "warning";

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

export interface TyporaPlusConfiguration {
  readonly appearance: {
    readonly colorScheme: ColorSchemePreference;
    readonly density: "comfortable" | "compact";
    readonly themeId?: string;
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
export const configurationMaxMarkdownStatusBadges = 50;
export const configurationMaxMarkdownStatusBadgeAliases = 30;
export const configurationMaxMarkdownStatusBadgeTextLength = 64;

export const configurationNumberConstraints = {
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

function sanitizeWorkspaceConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["workspace"]> {
  return {
    ...(isNonEmptyString(value.defaultAssetFolder) ? { defaultAssetFolder: value.defaultAssetFolder } : {}),
    ...sanitizeNumberProperty(
      "searchMaxFileSizeBytes",
      value.searchMaxFileSizeBytes,
      configurationNumberConstraints.workspaceSearchMaxFileSizeBytes
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
