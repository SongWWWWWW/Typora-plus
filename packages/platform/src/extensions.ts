import { Disposable, DisposableStore, toDisposable, type IDisposable } from "@typora-plus/base";
import type { ICommandService } from "./commands";
import { parseContextKeyExpression, type ContextKeyExpression } from "./contextKeys";
import { createServiceIdentifier } from "./instantiation";
import type { IKeybindingService, Keybinding } from "./keybindings";
import type { IMenuService, MenuIconId, MenuId, MenuItemToggle } from "./menus";

export interface ExtensionManifest {
  readonly id: string;
  readonly displayName?: string;
  readonly contributes?: ExtensionContributions;
}

export interface ExtensionContributions {
  readonly commands?: readonly ExtensionCommandContribution[];
  readonly menus?: readonly ExtensionMenuContribution[];
  readonly keybindings?: readonly ExtensionKeybindingContribution[];
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

export interface RegisteredExtension {
  readonly id: string;
  readonly displayName?: string;
}

export interface IExtensionService {
  registerExtension(manifest: ExtensionManifest): IDisposable;
  getExtensions(): readonly RegisteredExtension[];
}

export const IExtensionService = createServiceIdentifier<IExtensionService>("extension");

export class ExtensionService extends Disposable implements IExtensionService {
  private readonly extensions = new Map<string, RegisteredExtensionRecord>();

  constructor(
    private readonly commandService: ICommandService,
    private readonly menuService: IMenuService,
    private readonly keybindingService: IKeybindingService
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
        disposables.add(this.commandService.registerCommand({
          id: command.command,
          title: command.title,
          ...(command.category ? { category: command.category } : {}),
          run: () => {
            throw new Error(`No handler registered for extension command: ${command.command}`);
          }
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

      const record: RegisteredExtensionRecord = {
        manifest: normalizedManifest,
        disposables
      };
      this.extensions.set(normalizedManifest.id, record);

      return toDisposable(() => this.unregisterExtension(normalizedManifest.id, record));
    } catch (error) {
      disposables.dispose();
      throw error;
    }
  }

  getExtensions(): readonly RegisteredExtension[] {
    return [...this.extensions.values()].map((extension) => ({
      id: extension.manifest.id,
      ...(extension.manifest.displayName ? { displayName: extension.manifest.displayName } : {})
    }));
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
    currentRecord.disposables.dispose();
  }
}

interface RegisteredExtensionRecord {
  readonly manifest: NormalizedExtensionManifest;
  readonly disposables: DisposableStore;
}

interface NormalizedExtensionManifest {
  readonly id: string;
  readonly displayName?: string;
  readonly contributes: {
    readonly commands: readonly ExtensionCommandContribution[];
    readonly menus: readonly NormalizedExtensionMenuContribution[];
    readonly keybindings: readonly ExtensionKeybindingContribution[];
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

  assertUnique(commands.map((command) => command.command), `Command contribution ids for ${id}`);
  assertUnique(menus.map((menu) => menu.id), `Menu contribution ids for ${id}`);

  return {
    id,
    ...(displayName ? { displayName } : {}),
    contributes: {
      commands,
      menus,
      keybindings
    }
  };
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
