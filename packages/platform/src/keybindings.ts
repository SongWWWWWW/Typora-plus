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
  resolve(event: KeybindingEvent): string | undefined;
  dispatch(event: KeybindingEvent, commandService: ICommandService): boolean;
  getKeybindings(): readonly ResolvedKeybinding[];
  getKeybindingLabel(command: string): string | undefined;
}

export const IKeybindingService = createServiceIdentifier<IKeybindingService>("keybinding");

export class KeybindingService implements IKeybindingService {
  private rules: KeybindingRecord[] = [];
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
      weight: rule.weight ?? 0,
      order: this.order
    };
    this.order += 1;
    this.rules = [...this.rules, record];

    return toDisposable(() => {
      this.rules = this.rules.filter((entry) => entry !== record);
    });
  }

  resolve(event: KeybindingEvent): string | undefined {
    return this.rules
      .filter((rule) => matchesKeybinding(rule.keybinding, event))
      .sort((first, second) => second.weight - first.weight || second.order - first.order)[0]
      ?.command;
  }

  dispatch(event: KeybindingEvent, commandService: ICommandService): boolean {
    const command = this.resolve(event);

    if (!command) {
      return false;
    }

    commandService.executeCommand(command);
    return true;
  }

  getKeybindings(): readonly ResolvedKeybinding[] {
    return this.rules
      .map((rule) => ({
        command: rule.command,
        keybinding: rule.keybinding,
        label: formatKeybinding(rule.keybinding, this.options)
      }))
      .sort((first, second) => first.command.localeCompare(second.command));
  }

  getKeybindingLabel(command: string): string | undefined {
    const rule = this.rules
      .filter((entry) => entry.command === command)
      .sort((first, second) => second.weight - first.weight || second.order - first.order)[0];

    return rule ? formatKeybinding(rule.keybinding, this.options) : undefined;
  }
}

interface KeybindingRecord {
  readonly command: string;
  readonly keybinding: Keybinding;
  readonly weight: number;
  readonly order: number;
}

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
