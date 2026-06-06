import { Disposable, DisposableStore, toDisposable, type IDisposable } from "@typora-plus/base";
import type { CommandMetadata, ICommandService } from "./commands";
import {
  parseContextKeyExpression,
  type ContextKeyExpression,
  type ContextKeyValue,
  type IContextKeyService
} from "./contextKeys";
import type { ExportProvider, IExportService } from "./exports";
import { createServiceIdentifier } from "./instantiation";
import type { IKeybindingService, Keybinding } from "./keybindings";
import type { IMenuService, MenuIconId, MenuId, MenuItemToggle } from "./menus";
import type { IThemeService, ThemeColorScheme, ThemeContribution } from "./themes";

export interface ExtensionManifest {
  readonly id: string;
  readonly displayName?: string;
  readonly activationEvents?: readonly string[];
  readonly contributes?: ExtensionContributions;
}

export interface ExtensionContributions {
  readonly commands?: readonly ExtensionCommandContribution[];
  readonly menus?: readonly ExtensionMenuContribution[];
  readonly keybindings?: readonly ExtensionKeybindingContribution[];
  readonly themes?: readonly ExtensionThemeContribution[];
}

export interface ExtensionCommandContribution {
  readonly command: string;
  readonly title: string;
  readonly category?: string;
}

export interface ExtensionMenuContribution {
  readonly id: string;
  readonly menu: MenuId;
  readonly command: string;
  readonly group?: string;
  readonly order?: number;
  readonly title?: string;
  readonly icon?: MenuIconId;
  readonly compactHidden?: boolean;
  readonly toggled?: MenuItemToggle;
  readonly when?: string;
}

export interface ExtensionKeybindingContribution {
  readonly command: string;
  readonly keybinding: Keybinding;
  readonly weight?: number;
}

export interface ExtensionThemeContribution {
  readonly id: string;
  readonly label: string;
  readonly colorScheme?: ThemeColorScheme;
  readonly tokens: Readonly<Record<string, string>>;
}

export interface RegisteredExtension {
  readonly id: string;
  readonly displayName?: string;
  readonly activationEvents: readonly string[];
  readonly activationState: ExtensionActivationState;
}

export type ExtensionActivationState = "inactive" | "activating" | "activated" | "failed";

export interface ExtensionActivationRequest {
  readonly activationEvent: string;
  readonly extension: RegisteredExtension;
  readonly context: ExtensionContext;
}

export type ExtensionActivationHandler = (request: ExtensionActivationRequest) => void | Promise<void>;

export interface ExtensionServiceOptions {
  readonly activationHandler?: ExtensionActivationHandler;
  readonly contextKeyService?: IContextKeyService;
  readonly exportService?: IExportService;
  readonly themeService?: IThemeService;
}

export interface IExtensionService {
  registerExtension(manifest: ExtensionManifest): IDisposable;
  activateByEvent(activationEvent: string): Promise<readonly RegisteredExtension[]>;
  getExtensions(): readonly RegisteredExtension[];
}

export interface ExtensionContext {
  readonly extension: RegisteredExtension;
  readonly subscriptions: ExtensionSubscriptionStore;
  readonly commands: ExtensionCommandApi;
  readonly contextKeys: ExtensionContextKeyApi;
  readonly exports: ExtensionExportApi;
}

export interface ExtensionSubscriptionStore {
  add<T extends IDisposable>(disposable: T): T;
}

export interface ExtensionCommandApi {
  registerCommand(command: string, handler: ExtensionCommandHandler, metadata?: ExtensionRuntimeCommandMetadata): IDisposable;
  executeCommand<T = unknown>(command: string, ...args: unknown[]): Promise<T>;
  getCommands(): readonly CommandMetadata[];
}

export interface ExtensionContextKeyApi {
  setValue(key: string, value: ContextKeyValue | undefined): void;
  getValue(key: string): ContextKeyValue | undefined;
}

export interface ExtensionExportApi {
  registerProvider(provider: ExportProvider): IDisposable;
  getProviders(): readonly ExportProvider[];
}

export type ExtensionCommandHandler = (...args: unknown[]) => unknown;

export interface ExtensionRuntimeCommandMetadata {
  readonly title?: string;
  readonly category?: string;
}

export const IExtensionService = createServiceIdentifier<IExtensionService>("extension");

export class ExtensionService extends Disposable implements IExtensionService {
  private readonly extensions = new Map<string, RegisteredExtensionRecord>();
  private readonly activationEventIndex = new Map<string, Set<string>>();

  constructor(
    private readonly commandService: ICommandService,
    private readonly menuService: IMenuService,
    private readonly keybindingService: IKeybindingService,
    private readonly options: ExtensionServiceOptions = {}
  ) {
    super();
  }

  registerExtension(manifest: ExtensionManifest): IDisposable {
    const normalizedManifest = normalizeExtensionManifest(manifest);

    if (this.extensions.has(normalizedManifest.id)) {
      throw new Error(`Extension already registered: ${normalizedManifest.id}`);
    }

    const disposables = new DisposableStore();

    try {
      for (const command of normalizedManifest.contributes.commands) {
        disposables.add(this.commandService.registerCommandMetadata({
          id: command.command,
          title: command.title,
          ...(command.category ? { category: command.category } : {})
        }));
      }

      for (const item of normalizedManifest.contributes.menus) {
        disposables.add(this.menuService.registerMenuItem({
          id: item.id,
          menu: item.menu,
          command: item.command,
          ...(item.group ? { group: item.group } : {}),
          ...(item.order !== undefined ? { order: item.order } : {}),
          ...(item.title ? { title: item.title } : {}),
          ...(item.icon ? { icon: item.icon } : {}),
          ...(item.compactHidden !== undefined ? { compactHidden: item.compactHidden } : {}),
          ...(item.toggled ? { toggled: item.toggled } : {}),
          ...(item.when ? { when: item.when } : {})
        }));
      }

      for (const rule of normalizedManifest.contributes.keybindings) {
        disposables.add(this.keybindingService.registerKeybinding(rule));
      }

      if (normalizedManifest.contributes.themes.length > 0) {
        const themeService = this.options.themeService;

        if (!themeService) {
          throw new Error(`No extension theme service registered: ${normalizedManifest.id}`);
        }

        for (const theme of normalizedManifest.contributes.themes) {
          disposables.add(themeService.registerTheme(theme));
        }
      }

      const record: RegisteredExtensionRecord = {
        manifest: normalizedManifest,
        disposables,
        runtimeDisposables: new DisposableStore(),
        runtimeContextKeys: new Set<string>(),
        activationState: "inactive"
      };
      this.extensions.set(normalizedManifest.id, record);

      for (const activationEvent of normalizedManifest.activationEvents) {
        this.addActivationEventIndex(activationEvent, normalizedManifest.id, disposables);
      }

      return toDisposable(() => this.unregisterExtension(normalizedManifest.id, record));
    } catch (error) {
      disposables.dispose();
      throw error;
    }
  }

  async activateByEvent(activationEvent: string): Promise<readonly RegisteredExtension[]> {
    const normalizedActivationEvent = readRequiredString(activationEvent, "Activation event");
    const extensionIds = [...(this.activationEventIndex.get(normalizedActivationEvent) ?? [])];
    const activatedExtensions: RegisteredExtension[] = [];

    for (const extensionId of extensionIds) {
      const record = this.extensions.get(extensionId);

      if (!record || record.activationState === "activated") {
        continue;
      }

      if (record.activationState === "activating" && record.activationPromise) {
        await record.activationPromise;
        continue;
      }

      const activationHandler = this.options.activationHandler;

      if (!activationHandler) {
        throw new Error(`No extension activation handler registered: ${extensionId}`);
      }

      record.activationState = "activating";
      record.activationPromise = Promise.resolve().then(() => {
        const registeredExtension = toRegisteredExtension(record);

        return activationHandler({
          activationEvent: normalizedActivationEvent,
          extension: registeredExtension,
          context: createExtensionContext(
            record,
            registeredExtension,
            this.commandService,
            this.options.contextKeyService,
            this.options.exportService
          )
        });
      }).then(() => {
        record.activationState = "activated";
        delete record.activationPromise;
      }).catch((error: unknown) => {
        record.activationState = "failed";
        clearRuntimeContributions(record, this.options.contextKeyService);
        delete record.activationPromise;
        throw error;
      });

      await record.activationPromise;
      activatedExtensions.push(toRegisteredExtension(record));
    }

    return activatedExtensions;
  }

  getExtensions(): readonly RegisteredExtension[] {
    return [...this.extensions.values()].map(toRegisteredExtension);
  }

  override dispose(): void {
    for (const extension of [...this.extensions.values()]) {
      this.unregisterExtension(extension.manifest.id, extension);
    }

    super.dispose();
  }

  private unregisterExtension(id: string, expectedRecord: RegisteredExtensionRecord): void {
    const currentRecord = this.extensions.get(id);

    if (currentRecord !== expectedRecord) {
      return;
    }

    this.extensions.delete(id);
    clearRuntimeContextKeys(currentRecord, this.options.contextKeyService);
    currentRecord.runtimeDisposables.dispose();
    currentRecord.disposables.dispose();
  }

  private addActivationEventIndex(
    activationEvent: string,
    extensionId: string,
    disposables: DisposableStore
  ): void {
    let extensionIds = this.activationEventIndex.get(activationEvent);

    if (!extensionIds) {
      extensionIds = new Set<string>();
      this.activationEventIndex.set(activationEvent, extensionIds);
    }

    extensionIds.add(extensionId);
    disposables.add(toDisposable(() => {
      extensionIds?.delete(extensionId);

      if (extensionIds?.size === 0) {
        this.activationEventIndex.delete(activationEvent);
      }
    }));
  }
}

interface RegisteredExtensionRecord {
  readonly manifest: NormalizedExtensionManifest;
  readonly disposables: DisposableStore;
  readonly runtimeDisposables: DisposableStore;
  readonly runtimeContextKeys: Set<string>;
  activationState: ExtensionActivationState;
  activationPromise?: Promise<void>;
}

interface NormalizedExtensionManifest {
  readonly id: string;
  readonly displayName?: string;
  readonly activationEvents: readonly string[];
  readonly contributes: {
    readonly commands: readonly ExtensionCommandContribution[];
    readonly menus: readonly NormalizedExtensionMenuContribution[];
    readonly keybindings: readonly ExtensionKeybindingContribution[];
    readonly themes: readonly ThemeContribution[];
  };
}

interface NormalizedExtensionMenuContribution extends Omit<ExtensionMenuContribution, "when"> {
  readonly when?: ContextKeyExpression;
}

type UnknownRecord = Record<string, unknown>;

function normalizeExtensionManifest(manifest: ExtensionManifest): NormalizedExtensionManifest {
  const record = expectRecord(manifest, "Extension manifest");
  const id = readRequiredString(record.id, "Extension id");
  const displayName = readOptionalString(record.displayName, "Extension display name");
  const contributes = record.contributes === undefined
    ? {}
    : expectRecord(record.contributes, `Extension contributes for ${id}`);
  const commands = readOptionalArray(contributes.commands, `Command contributions for ${id}`)
    .map((contribution, index) => normalizeCommandContribution(contribution, id, index));
  const menus = readOptionalArray(contributes.menus, `Menu contributions for ${id}`)
    .map((contribution, index) => normalizeMenuContribution(contribution, id, index));
  const keybindings = readOptionalArray(contributes.keybindings, `Keybinding contributions for ${id}`)
    .map((contribution, index) => normalizeKeybindingContribution(contribution, id, index));
  const themes = readOptionalArray(contributes.themes, `Theme contributions for ${id}`)
    .map((contribution, index) => normalizeThemeContribution(contribution, id, index));
  const activationEvents = uniqueValues([
    ...readOptionalArray(record.activationEvents, `Activation events for ${id}`)
      .map((activationEvent, index) => normalizeActivationEvent(activationEvent, id, index)),
    ...commands.map((command) => commandActivationEvent(command.command))
  ]);

  assertUnique(commands.map((command) => command.command), `Command contribution ids for ${id}`);
  assertUnique(menus.map((menu) => menu.id), `Menu contribution ids for ${id}`);
  assertUnique(themes.map((theme) => theme.id), `Theme contribution ids for ${id}`);

  return {
    id,
    ...(displayName ? { displayName } : {}),
    activationEvents,
    contributes: {
      commands,
      menus,
      keybindings,
      themes
    }
  };
}

function normalizeActivationEvent(value: unknown, extensionId: string, index: number): string {
  return readRequiredString(value, `Activation event ${index + 1} for ${extensionId}`);
}

function normalizeCommandContribution(
  contribution: unknown,
  extensionId: string,
  index: number
): ExtensionCommandContribution {
  const record = expectRecord(contribution, `Command contribution ${index + 1} for ${extensionId}`);
  const command = readRequiredString(record.command, `Command contribution id for ${extensionId}`);
  const title = readRequiredString(record.title, `Command contribution title for ${command}`);
  const category = readOptionalString(record.category, `Command contribution category for ${command}`);

  return {
    command,
    title,
    ...(category ? { category } : {})
  };
}

function normalizeMenuContribution(
  contribution: unknown,
  extensionId: string,
  index: number
): NormalizedExtensionMenuContribution {
  const record = expectRecord(contribution, `Menu contribution ${index + 1} for ${extensionId}`);
  const id = readRequiredString(record.id, `Menu contribution id for ${extensionId}`);
  const menu = readRequiredString(record.menu, `Menu id for ${id}`);
  const command = readRequiredString(record.command, `Menu command id for ${id}`);
  const group = readOptionalString(record.group, `Menu group for ${id}`);
  const order = readOptionalNumber(record.order, `Menu order for ${id}`);
  const title = readOptionalString(record.title, `Menu title for ${id}`);
  const icon = readOptionalString(record.icon, `Menu icon for ${id}`);
  const compactHidden = readOptionalBoolean(record.compactHidden, `Menu compact hidden flag for ${id}`);
  const toggled = normalizeOptionalMenuToggle(record.toggled, id);
  const when = normalizeOptionalWhen(record.when, id);

  return {
    id,
    menu,
    command,
    ...(group ? { group } : {}),
    ...(order !== undefined ? { order } : {}),
    ...(title ? { title } : {}),
    ...(icon ? { icon } : {}),
    ...(compactHidden !== undefined ? { compactHidden } : {}),
    ...(toggled ? { toggled } : {}),
    ...(when ? { when } : {})
  };
}

function normalizeKeybindingContribution(
  contribution: unknown,
  extensionId: string,
  index: number
): ExtensionKeybindingContribution {
  const record = expectRecord(contribution, `Keybinding contribution ${index + 1} for ${extensionId}`);
  const command = readRequiredString(record.command, `Keybinding command id for ${extensionId}`);
  const keybinding = normalizeKeybinding(record.keybinding, command);
  const weight = readOptionalNumber(record.weight, `Keybinding weight for ${command}`);

  return {
    command,
    keybinding,
    ...(weight !== undefined ? { weight } : {})
  };
}

function normalizeThemeContribution(
  contribution: unknown,
  extensionId: string,
  index: number
): ThemeContribution {
  const record = expectRecord(contribution, `Theme contribution ${index + 1} for ${extensionId}`);
  const id = readRequiredString(record.id, `Theme contribution id for ${extensionId}`);
  const label = readRequiredString(record.label, `Theme contribution label for ${id}`);
  const colorScheme = normalizeOptionalThemeColorScheme(record.colorScheme, id);
  const tokens = expectRecord(record.tokens, `Theme contribution tokens for ${id}`) as Record<string, string>;

  return {
    id,
    label,
    ...(colorScheme ? { colorScheme } : {}),
    tokens
  };
}

function normalizeOptionalThemeColorScheme(value: unknown, themeId: string): ThemeColorScheme | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "light" && value !== "dark") {
    throw new Error(`Theme color scheme for ${themeId} must be light or dark`);
  }

  return value;
}

function normalizeKeybinding(value: unknown, command: string): Keybinding {
  const record = expectRecord(value, `Keybinding for ${command}`);
  const key = readRequiredString(record.key, `Keybinding key for ${command}`);
  const primary = readOptionalBoolean(record.primary, `Keybinding primary flag for ${command}`);
  const shift = readOptionalBoolean(record.shift, `Keybinding shift flag for ${command}`);
  const alt = readOptionalBoolean(record.alt, `Keybinding alt flag for ${command}`);

  return {
    key,
    ...(primary ? { primary } : {}),
    ...(shift ? { shift } : {}),
    ...(alt ? { alt } : {})
  };
}

function normalizeOptionalMenuToggle(value: unknown, menuItemId: string): MenuItemToggle | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, `Menu toggle for ${menuItemId}`);
  const context = readRequiredString(record.context, `Menu toggle context for ${menuItemId}`);

  if (typeof record.value !== "boolean" && typeof record.value !== "string") {
    throw new Error(`Menu toggle value for ${menuItemId} must be a boolean or string`);
  }

  return {
    context,
    value: record.value
  };
}

function normalizeOptionalWhen(value: unknown, menuItemId: string): ContextKeyExpression | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`Menu when clause for ${menuItemId} must be a string`);
  }

  try {
    return parseContextKeyExpression(value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Invalid menu when clause for ${menuItemId}: ${message}`);
  }
}

function expectRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as UnknownRecord;
}

function readOptionalArray(value: unknown, label: string): readonly unknown[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  return value;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
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

function readOptionalBoolean(value: unknown, label: string): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }

  return value;
}

function assertUnique(values: readonly string[], label: string): void {
  const seenValues = new Set<string>();

  for (const value of values) {
    if (seenValues.has(value)) {
      throw new Error(`${label} must be unique: ${value}`);
    }

    seenValues.add(value);
  }
}

function uniqueValues(values: readonly string[]): readonly string[] {
  return [...new Set(values)];
}

function commandActivationEvent(command: string): string {
  return `onCommand:${command}`;
}

function toRegisteredExtension(record: RegisteredExtensionRecord): RegisteredExtension {
  return {
    id: record.manifest.id,
    ...(record.manifest.displayName ? { displayName: record.manifest.displayName } : {}),
    activationEvents: record.manifest.activationEvents,
    activationState: record.activationState
  };
}

function createExtensionContext(
  record: RegisteredExtensionRecord,
  extension: RegisteredExtension,
  commandService: ICommandService,
  contextKeyService: IContextKeyService | undefined,
  exportService: IExportService | undefined
): ExtensionContext {
  return {
    extension,
    subscriptions: {
      add: (disposable) => record.runtimeDisposables.add(disposable)
    },
    commands: {
      registerCommand(command, handler, metadata) {
        const commandMetadata = resolveRuntimeCommandMetadata(record.manifest, command, metadata);
        const disposable = commandService.registerCommand({
          id: commandMetadata.id,
          title: commandMetadata.title,
          ...(commandMetadata.category ? { category: commandMetadata.category } : {}),
          run: (_accessor, ...args) => handler(...args)
        });

        return record.runtimeDisposables.add(disposable);
      },
      executeCommand: (command, ...args) => commandService.executeCommand(command, ...args),
      getCommands: () => commandService.getCommands()
    },
    contextKeys: {
      setValue(key, value) {
        if (!contextKeyService) {
          throw new Error(`No extension context key service registered: ${record.manifest.id}`);
        }

        const normalizedKey = normalizeExtensionContextKey(record.manifest.id, key);
        contextKeyService.setValue(normalizedKey, value);

        if (value === undefined) {
          record.runtimeContextKeys.delete(normalizedKey);
          return;
        }

        record.runtimeContextKeys.add(normalizedKey);
      },
      getValue(key) {
        if (!contextKeyService) {
          return undefined;
        }

        return contextKeyService.getValue(normalizeExtensionContextKey(record.manifest.id, key));
      }
    },
    exports: {
      registerProvider(provider) {
        if (!exportService) {
          throw new Error(`No extension export service registered: ${record.manifest.id}`);
        }

        const disposable = exportService.registerProvider(provider);
        return record.runtimeDisposables.add(disposable);
      },
      getProviders: () => exportService?.getProviders() ?? []
    }
  };
}

function resolveRuntimeCommandMetadata(
  manifest: NormalizedExtensionManifest,
  command: string,
  metadata: ExtensionRuntimeCommandMetadata = {}
): Required<Pick<CommandMetadata, "id" | "title">> & Pick<CommandMetadata, "category"> {
  const id = readRequiredString(command, `Runtime command id for ${manifest.id}`);
  const contributedCommand = manifest.contributes.commands.find((contribution) => contribution.command === id);
  const title = readOptionalString(metadata.title, `Runtime command title for ${id}`) ?? contributedCommand?.title;
  const category = readOptionalString(metadata.category, `Runtime command category for ${id}`) ?? contributedCommand?.category;

  if (!title) {
    throw new Error(`Runtime command title must be provided for uncontributed command: ${id}`);
  }

  return {
    id,
    title,
    ...(category ? { category } : {})
  };
}

function clearRuntimeContributions(
  record: RegisteredExtensionRecord,
  contextKeyService: IContextKeyService | undefined
): void {
  record.runtimeDisposables.clear();
  clearRuntimeContextKeys(record, contextKeyService);
}

function clearRuntimeContextKeys(
  record: RegisteredExtensionRecord,
  contextKeyService: IContextKeyService | undefined
): void {
  if (!contextKeyService) {
    record.runtimeContextKeys.clear();
    return;
  }

  for (const key of record.runtimeContextKeys) {
    contextKeyService.setValue(key, undefined);
  }

  record.runtimeContextKeys.clear();
}

function normalizeExtensionContextKey(extensionId: string, key: string): string {
  const normalizedKey = readRequiredString(key, `Runtime context key for ${extensionId}`);
  const prefix = `${extensionId}.`;

  if (!normalizedKey.startsWith(prefix) || normalizedKey.length === prefix.length) {
    throw new Error(`Extension context key must start with "${prefix}": ${normalizedKey}`);
  }

  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(normalizedKey)) {
    throw new Error(`Extension context key is not valid in when clauses: ${normalizedKey}`);
  }

  return normalizedKey;
}
