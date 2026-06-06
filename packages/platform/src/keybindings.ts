import { type IDisposable, toDisposable } from "@typora-plus/base";
import type { ICommandService } from "./commands";
import { createServiceIdentifier } from "./instantiation";

export interface Keybinding {
  readonly key: string;
  readonly primary?: boolean;
  readonly shift?: boolean;
  readonly alt?: boolean;
}

export interface KeybindingRule {
  readonly command: string;
  readonly keybinding: Keybinding;
  readonly weight?: number;
}

export interface UserKeybindingRule {
  readonly command: string;
  readonly keybinding: Keybinding;
}

export interface KeybindingEvent {
  readonly key: string;
  readonly ctrlKey?: boolean;
  readonly metaKey?: boolean;
  readonly shiftKey?: boolean;
  readonly altKey?: boolean;
}

export interface ResolvedKeybinding {
  readonly command: string;
  readonly keybinding: Keybinding;
  readonly label: string;
}

export interface KeybindingServiceOptions {
  readonly primaryModifierLabel: string;
}

export interface IKeybindingService {
  registerKeybinding(rule: KeybindingRule): IDisposable;
  setUserKeybindings(rules: readonly UserKeybindingRule[]): void;
  resolve(event: KeybindingEvent): string | undefined;
  dispatch(event: KeybindingEvent, commandService: ICommandService): Promise<boolean>;
  getKeybindings(): readonly ResolvedKeybinding[];
  getKeybindingLabel(command: string): string | undefined;
  getKeybindingLabelForKeybinding(keybinding: Keybinding): string;
  getCommandForKeybinding(keybinding: Keybinding): string | undefined;
}

export const IKeybindingService = createServiceIdentifier<IKeybindingService>("keybinding");

export class KeybindingService implements IKeybindingService {
  private defaultRules: KeybindingRecord[] = [];
  private userRules: KeybindingRecord[] = [];
  private order = 0;
  private readonly options: KeybindingServiceOptions;

  constructor(options: Partial<KeybindingServiceOptions> = {}) {
    this.options = {
      primaryModifierLabel: "Ctrl",
      ...options
    };
  }

  registerKeybinding(rule: KeybindingRule): IDisposable {
    const record: KeybindingRecord = {
      command: rule.command,
      keybinding: normalizeKeybinding(rule.keybinding),
      source: "default",
      weight: rule.weight ?? 0,
      order: this.order
    };
    this.order += 1;
    this.defaultRules = [...this.defaultRules, record];

    return toDisposable(() => {
      this.defaultRules = this.defaultRules.filter((entry) => entry !== record);
    });
  }

  setUserKeybindings(rules: readonly UserKeybindingRule[]): void {
    this.userRules = rules.map((rule, index) => ({
      command: rule.command,
      keybinding: normalizeKeybinding(rule.keybinding),
      source: "user",
      weight: userKeybindingWeight,
      order: index
    }));
  }

  resolve(event: KeybindingEvent): string | undefined {
    return this.getRuleRecords()
      .filter((rule) => matchesKeybinding(rule.keybinding, event))
      .sort((first, second) => second.weight - first.weight || second.order - first.order)[0]
      ?.command;
  }

  async dispatch(event: KeybindingEvent, commandService: ICommandService): Promise<boolean> {
    const command = this.resolve(event);

    if (!command) {
      return false;
    }

    await commandService.executeCommand(command);
    return true;
  }

  getKeybindings(): readonly ResolvedKeybinding[] {
    return this.getRuleRecords()
      .filter((rule) => this.getCommandForKeybinding(rule.keybinding) === rule.command)
      .map((rule) => ({
        command: rule.command,
        keybinding: rule.keybinding,
        label: formatKeybinding(rule.keybinding, this.options)
      }))
      .sort((first, second) => first.command.localeCompare(second.command));
  }

  getKeybindingLabel(command: string): string | undefined {
    const rule = this.getRuleRecords()
      .filter((entry) => entry.command === command)
      .sort((first, second) => second.weight - first.weight || second.order - first.order)
      .find((entry) => this.getCommandForKeybinding(entry.keybinding) === command);

    return rule ? formatKeybinding(rule.keybinding, this.options) : undefined;
  }

  getKeybindingLabelForKeybinding(keybinding: Keybinding): string {
    return formatKeybinding(normalizeKeybinding(keybinding), this.options);
  }

  getCommandForKeybinding(keybinding: Keybinding): string | undefined {
    const normalizedKeybinding = normalizeKeybinding(keybinding);

    return this.getRuleRecords()
      .filter((rule) => keybindingEquals(rule.keybinding, normalizedKeybinding))
      .sort((first, second) => second.weight - first.weight || second.order - first.order)[0]
      ?.command;
  }

  private getRuleRecords(): readonly KeybindingRecord[] {
    return [...this.defaultRules, ...this.userRules];
  }
}

interface KeybindingRecord {
  readonly command: string;
  readonly keybinding: Keybinding;
  readonly source: "default" | "user";
  readonly weight: number;
  readonly order: number;
}

const userKeybindingWeight = 1_000;

function normalizeKeybinding(keybinding: Keybinding): Keybinding {
  return {
    key: normalizeKey(keybinding.key),
    ...(keybinding.primary ? { primary: true } : {}),
    ...(keybinding.shift ? { shift: true } : {}),
    ...(keybinding.alt ? { alt: true } : {})
  };
}

function matchesKeybinding(keybinding: Keybinding, event: KeybindingEvent): boolean {
  const primaryPressed = Boolean(event.ctrlKey || event.metaKey);
  const shiftPressed = Boolean(event.shiftKey);
  const altPressed = Boolean(event.altKey);

  return normalizeKey(event.key) === keybinding.key &&
    primaryPressed === Boolean(keybinding.primary) &&
    shiftPressed === Boolean(keybinding.shift) &&
    altPressed === Boolean(keybinding.alt);
}

function normalizeKey(key: string): string {
  const normalized = key.trim().toLowerCase();

  if (normalized === " ") {
    return "space";
  }

  return normalized;
}

export function keybindingFromEvent(event: KeybindingEvent): Keybinding | undefined {
  const key = normalizeKey(event.key);

  if (key === "control" || key === "ctrl" || key === "meta" || key === "shift" || key === "alt") {
    return undefined;
  }

  return {
    key,
    ...(event.ctrlKey || event.metaKey ? { primary: true } : {}),
    ...(event.shiftKey ? { shift: true } : {}),
    ...(event.altKey ? { alt: true } : {})
  };
}

export function keybindingEquals(first: Keybinding, second: Keybinding): boolean {
  const normalizedFirst = normalizeKeybinding(first);
  const normalizedSecond = normalizeKeybinding(second);

  return normalizedFirst.key === normalizedSecond.key &&
    Boolean(normalizedFirst.primary) === Boolean(normalizedSecond.primary) &&
    Boolean(normalizedFirst.shift) === Boolean(normalizedSecond.shift) &&
    Boolean(normalizedFirst.alt) === Boolean(normalizedSecond.alt);
}

function formatKeybinding(keybinding: Keybinding, options: KeybindingServiceOptions): string {
  const parts: string[] = [];

  if (keybinding.primary) {
    parts.push(options.primaryModifierLabel);
  }

  if (keybinding.shift) {
    parts.push("Shift");
  }

  if (keybinding.alt) {
    parts.push("Alt");
  }

  parts.push(formatKey(keybinding.key));
  return parts.join("+");
}

function formatKey(key: string): string {
  if (key.length === 1) {
    return key.toUpperCase();
  }

  return key.charAt(0).toUpperCase() + key.slice(1);
}
