import type {
  FileSaveConflict,
  ICommandService
} from "@typora-plus/platform";
import { isFileSaveConflictError } from "@typora-plus/platform";

export interface WorkbenchCommandExecutionServices {
  readonly commandService: Pick<ICommandService, "executeCommand">;
}

export type WorkbenchOperationErrorSetter = (value: string | undefined) => void;
export type WorkbenchSaveConflictSetter = (value: FileSaveConflict | undefined) => void;

export interface WorkbenchCommandExecutionCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setSaveConflict?: WorkbenchSaveConflictSetter;
}

export function createWorkbenchCommandExecutor(
  services: WorkbenchCommandExecutionServices,
  callbacks: WorkbenchCommandExecutionCallbacks
): (command: string) => void {
  return (command) => {
    executeWorkbenchCommand(
      services,
      command,
      callbacks.setOperationError,
      callbacks.setSaveConflict
    );
  };
}

export function executeWorkbenchCommand(
  services: WorkbenchCommandExecutionServices,
  command: string,
  setOperationError: WorkbenchOperationErrorSetter,
  setSaveConflict?: WorkbenchSaveConflictSetter
): void {
  void runWorkbenchAction(
    () => services.commandService.executeCommand(command),
    setOperationError,
    setSaveConflict
  );
}

export async function runWorkbenchAction<T>(
  action: () => Promise<T> | T,
  setOperationError: WorkbenchOperationErrorSetter,
  setSaveConflict?: WorkbenchSaveConflictSetter
): Promise<T | undefined> {
  try {
    setOperationError(undefined);
    return await action();
  } catch (error) {
    if (isFileSaveConflictError(error)) {
      setSaveConflict?.(error.conflict);
      setOperationError("File changed on disk");
      return undefined;
    }

    setOperationError(error instanceof Error ? error.message : "Operation failed");
    return undefined;
  }
}
