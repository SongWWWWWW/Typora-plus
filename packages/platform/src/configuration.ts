import { Emitter, type Event } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type ColorSchemePreference = "light" | "dark" | "system";

export interface TyporaPlusConfiguration {
  readonly appearance: {
    readonly colorScheme: ColorSchemePreference;
    readonly density: "comfortable" | "compact";
  };
  readonly editor: {
    readonly fontSize: number;
    readonly lineHeight: number;
    readonly maxWidth: number;
    readonly focusMode: boolean;
    readonly typewriterMode: boolean;
    readonly autoSave: boolean;
  };
  readonly workspace: {
    readonly defaultAssetFolder: string;
    readonly searchMaxFileSizeBytes: number;
    readonly searchMaxResults: number;
  };
}

export interface ConfigurationStorage {
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
  readonly appearance?: Partial<TyporaPlusConfiguration["appearance"]>;
  readonly editor?: Partial<TyporaPlusConfiguration["editor"]>;
  readonly workspace?: Partial<TyporaPlusConfiguration["workspace"]>;
};

export const IConfigurationService = createServiceIdentifier<IConfigurationService>("configuration");

export const defaultConfigurationServiceOptions: ConfigurationServiceOptions = {
  storageKey: "typora-plus.configuration"
};

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
    autoSave: true
  },
  workspace: {
    defaultAssetFolder: "assets",
    searchMaxFileSizeBytes: 2 * 1024 * 1024,
    searchMaxResults: 120
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
    this.value = mergeConfiguration(this.value, value);
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
    appearance: {
      ...base.appearance,
      ...value.appearance
    },
    editor: {
      ...base.editor,
      ...value.editor
    },
    workspace: {
      ...base.workspace,
      ...value.workspace
    }
  };
}

function sanitizePartialConfiguration(value: unknown): PartialConfiguration {
  if (!isRecord(value)) {
    return {};
  }

  return {
    ...(isRecord(value.appearance) ? { appearance: sanitizeAppearanceConfiguration(value.appearance) } : {}),
    ...(isRecord(value.editor) ? { editor: sanitizeEditorConfiguration(value.editor) } : {}),
    ...(isRecord(value.workspace) ? { workspace: sanitizeWorkspaceConfiguration(value.workspace) } : {})
  };
}

function sanitizeAppearanceConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["appearance"]> {
  return {
    ...(isColorSchemePreference(value.colorScheme) ? { colorScheme: value.colorScheme } : {}),
    ...(value.density === "comfortable" || value.density === "compact" ? { density: value.density } : {})
  };
}

function sanitizeEditorConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["editor"]> {
  return {
    ...(isPositiveFiniteNumber(value.fontSize) ? { fontSize: value.fontSize } : {}),
    ...(isPositiveFiniteNumber(value.lineHeight) ? { lineHeight: value.lineHeight } : {}),
    ...(isPositiveFiniteNumber(value.maxWidth) ? { maxWidth: value.maxWidth } : {}),
    ...(typeof value.focusMode === "boolean" ? { focusMode: value.focusMode } : {}),
    ...(typeof value.typewriterMode === "boolean" ? { typewriterMode: value.typewriterMode } : {}),
    ...(typeof value.autoSave === "boolean" ? { autoSave: value.autoSave } : {})
  };
}

function sanitizeWorkspaceConfiguration(value: Record<string, unknown>): Partial<TyporaPlusConfiguration["workspace"]> {
  return {
    ...(isNonEmptyString(value.defaultAssetFolder) ? { defaultAssetFolder: value.defaultAssetFolder } : {}),
    ...(isPositiveFiniteNumber(value.searchMaxFileSizeBytes) ? { searchMaxFileSizeBytes: value.searchMaxFileSizeBytes } : {}),
    ...(isPositiveFiniteNumber(value.searchMaxResults) ? { searchMaxResults: value.searchMaxResults } : {})
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isColorSchemePreference(value: unknown): value is ColorSchemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function isPositiveFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function createBrowserConfigurationStorage(): ConfigurationStorage {
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

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}
