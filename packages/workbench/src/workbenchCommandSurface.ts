import type {
  CommandMetadata,
  ICommandService,
  IKeybindingService,
  Keybinding
} from "@typora-plus/platform";
import { workbenchCommandTitle } from "./workbenchMenuModel";

export interface WorkbenchCommandSurfaceServices {
  readonly commandService: Pick<ICommandService, "getCommands">;
  readonly keybindingService: Pick<
    IKeybindingService,
    "getCommandForKeybinding" | "getKeybindingLabel" | "getKeybindingLabelForKeybinding"
  >;
}

export interface WorkbenchCommandSurface {
  readonly commands: readonly CommandMetadata[];
  readonly getCommandForKeybinding: (keybinding: Keybinding) => string | undefined;
  readonly getCommandTitle: (command: string) => string;
  readonly getKeybindingLabel: (command: string) => string | undefined;
  readonly getKeybindingLabelForKeybinding: (keybinding: Keybinding) => string;
}

export function createWorkbenchCommandSurface(
  services: WorkbenchCommandSurfaceServices
): WorkbenchCommandSurface {
  const commands = services.commandService.getCommands();

  return {
    commands,
    getCommandForKeybinding: (keybinding) => services.keybindingService.getCommandForKeybinding(keybinding),
    getCommandTitle: (command) => workbenchCommandTitle(commands, command),
    getKeybindingLabel: (command) => services.keybindingService.getKeybindingLabel(command),
    getKeybindingLabelForKeybinding: (keybinding) => services.keybindingService.getKeybindingLabelForKeybinding(keybinding)
  };
}
