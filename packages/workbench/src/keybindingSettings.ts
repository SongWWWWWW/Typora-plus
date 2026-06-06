import { keybindingEquals, type CommandMetadata, type Keybinding, type UserKeybindingRule } from "@typora-plus/platform";

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
  commands: readonly CommandMetadata[],
  query: string,
  options: {
    readonly getLabel?: (command: CommandMetadata) => string | undefined;
    readonly overrides?: readonly UserKeybindingRule[];
    readonly modifiedOnly?: boolean;
    readonly unassignedLabel?: string;
  } = {}
): readonly CommandMetadata[] {
  const queryTerms = normalizeSearchTerms(query);
  const modifiedCommands = new Set((options.overrides ?? []).map((override) => override.command));
  const unassignedLabel = options.unassignedLabel ?? "Unassigned";

  return commands.filter((command) => {
    if (options.modifiedOnly && !modifiedCommands.has(command.id)) {
      return false;
    }

    if (queryTerms.length === 0) {
      return true;
    }

    const label = options.getLabel?.(command) ?? unassignedLabel;
    const haystack = normalizeSearchHaystack([
      command.title,
      command.category ?? "",
      command.id,
      label,
      label.replace(/\+/g, " ")
    ]);

    return queryTerms.every((term) => haystack.includes(term));
  });
}

function normalizeSearchTerms(value: string): readonly string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

function normalizeSearchHaystack(values: readonly string[]): string {
  return values.join(" ").toLowerCase();
}
