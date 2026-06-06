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
  };
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
    defaultAssetFolder: "assets"
  }
};

export class ConfigurationService implements IConfigurationService {
  private readonly emitter = new Emitter<TyporaPlusConfiguration>();
  private value = defaultConfiguration;

  readonly onDidChangeConfiguration = this.emitter.event;

  getValue(): TyporaPlusConfiguration {
    return this.value;
  }

  updateValue(value: PartialConfiguration): void {
    this.value = mergeConfiguration(this.value, value);
    this.emitter.fire(this.value);
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
