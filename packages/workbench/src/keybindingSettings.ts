import { keybindingEquals, type Command, type Keybinding, type UserKeybindingRule } from "@typora-plus/platform";

export function upsertKeybindingOverride(
  overrides: readonly UserKeybindingRule[],
  next: UserKeybindingRule
): readonly UserKeybindingRule[] {
  return [
    ...overrides.filter((override) => (
      override.command !== next.command &&
      !keybindingEquals(override.keybinding, next.keybinding)
    )),
    next
  ];
}

export function removeKeybindingOverride(
  overrides: readonly UserKeybindingRule[],
  command: string
): readonly UserKeybindingRule[] {
  return overrides.filter((override) => override.command !== command);
}

export function isRecordableKeybinding(keybinding: Keybinding): boolean {
  return Boolean(keybinding.primary || keybinding.alt);
}

export function filterKeybindingCommands(
  commands: readonly Command[],
  query: string,
  options: {
    readonly modifiedOnly?: boolean;
    readonly overrides?: readonly UserKeybindingRule[];
  } = {}
): readonly Command[] {
  const normalizedQuery = query.trim().toLowerCase();
  const modifiedCommands = new Set((options.overrides ?? []).map((override) => override.command));

  return commands.filter((command) => {
    if (options.modifiedOnly && !modifiedCommands.has(command.id)) {
      return false;
    }

    if (!normalizedQuery) {
      return true;
    }

    const haystack = `${command.title} ${command.category ?? ""} ${command.id}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
