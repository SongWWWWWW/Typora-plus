import { keybindingEquals, type Keybinding, type UserKeybindingRule } from "@typora-plus/platform";

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
