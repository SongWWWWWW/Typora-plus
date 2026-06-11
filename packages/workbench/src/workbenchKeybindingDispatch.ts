import { toDisposable, type IDisposable } from "@typora-plus/base";
import type {
  FileSaveConflict,
  ICommandService,
  IKeybindingService,
  KeybindingEvent
} from "@typora-plus/platform";
import {
  executeWorkbenchCommand,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchKeydownEvent extends KeybindingEvent {
  preventDefault(): void;
}

export interface WorkbenchKeybindingDispatchTarget {
  addEventListener(type: "keydown", listener: (event: WorkbenchKeydownEvent) => void): void;
  removeEventListener(type: "keydown", listener: (event: WorkbenchKeydownEvent) => void): void;
}

export interface WorkbenchKeybindingDispatchServices {
  readonly commandService: Pick<ICommandService, "executeCommand">;
  readonly keybindingService: Pick<IKeybindingService, "resolve">;
}

export interface WorkbenchKeybindingDispatchCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setSaveConflict?: (conflict: FileSaveConflict | undefined) => void;
}

export function dispatchWorkbenchKeybinding(
  services: WorkbenchKeybindingDispatchServices,
  event: WorkbenchKeydownEvent,
  callbacks: WorkbenchKeybindingDispatchCallbacks
): boolean {
  const command = services.keybindingService.resolve(event);

  if (!command) {
    return false;
  }

  event.preventDefault();
  executeWorkbenchCommand(
    services,
    command,
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
  return true;
}

export function registerWorkbenchKeybindingDispatch(
  target: WorkbenchKeybindingDispatchTarget,
  services: WorkbenchKeybindingDispatchServices,
  callbacks: WorkbenchKeybindingDispatchCallbacks
): IDisposable {
  const handleKeyDown = (event: WorkbenchKeydownEvent) => {
    dispatchWorkbenchKeybinding(services, event, callbacks);
  };

  target.addEventListener("keydown", handleKeyDown);
  return toDisposable(() => target.removeEventListener("keydown", handleKeyDown));
}
