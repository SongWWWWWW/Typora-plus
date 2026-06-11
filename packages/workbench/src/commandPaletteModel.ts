import type {
  FileSaveConflict,
  ICommandService
} from "@typora-plus/platform";
import {
  executeWorkbenchCommand,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface CommandPaletteCommand {
  readonly id: string;
  readonly title: string;
  readonly category?: string;
}

export interface CommandPaletteSearchOptions {
  readonly getKeybindingLabel?: (command: CommandPaletteCommand) => string | undefined;
}

export interface CommandPaletteExecutionServices {
  readonly commandService: Pick<ICommandService, "executeCommand">;
}

export interface CommandPaletteExecutionCallbacks {
  readonly closePalette: () => void;
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setSaveConflict?: (conflict: FileSaveConflict | undefined) => void;
}

export function filterCommandPaletteCommands(
  commands: readonly CommandPaletteCommand[],
  query: string,
  options: CommandPaletteSearchOptions = {}
): readonly CommandPaletteCommand[] {
  const terms = normalizeCommandPaletteTerms(query);

  if (terms.length === 0) {
    return commands;
  }

  return commands.filter((command) => {
    const keybindingLabel = options.getKeybindingLabel?.(command) ?? "";
    const haystack = normalizeCommandPaletteHaystack([
      command.title,
      command.category ?? "",
      command.id,
      keybindingLabel,
      keybindingLabel.replace(/\+/g, " ")
    ]);

    return terms.every((term) => haystack.includes(term));
  });
}

export function executeCommandPaletteCommand(
  services: CommandPaletteExecutionServices,
  commandId: string,
  callbacks: CommandPaletteExecutionCallbacks
): void {
  executeWorkbenchCommand(
    services,
    commandId,
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
  callbacks.closePalette();
}

function normalizeCommandPaletteTerms(query: string): readonly string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

function normalizeCommandPaletteHaystack(values: readonly string[]): string {
  return values.join(" ").toLowerCase();
}
