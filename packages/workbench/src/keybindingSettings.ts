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
  query: string
): readonly Command[] {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return commands;
  }

  return commands.filter((command) => {
    const haystack = `${command.title} ${command.category ?? ""} ${command.id}`.toLowerCase();
    return haystack.includes(normalizedQuery);
  });
}
