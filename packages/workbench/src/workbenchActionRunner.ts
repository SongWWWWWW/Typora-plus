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

export interface WorkbenchActionRunnerMessages {
  readonly fileChangedOnDisk: string;
  readonly operationFailed: string;
}

export const defaultWorkbenchActionRunnerMessages: WorkbenchActionRunnerMessages = {
  fileChangedOnDisk: "File changed on disk",
  operationFailed: "Operation failed"
};

export interface WorkbenchCommandExecutionCallbacks {
  readonly messages?: WorkbenchActionRunnerMessages;
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
      callbacks.setSaveConflict,
      callbacks.messages
    );
  };
}

export function executeWorkbenchCommand(
  services: WorkbenchCommandExecutionServices,
  command: string,
  setOperationError: WorkbenchOperationErrorSetter,
  setSaveConflict?: WorkbenchSaveConflictSetter,
  messages?: WorkbenchActionRunnerMessages
): void {
  void runWorkbenchAction(
    () => services.commandService.executeCommand(command),
    setOperationError,
    setSaveConflict,
    messages
  );
}

export async function runWorkbenchAction<T>(
  action: () => Promise<T> | T,
  setOperationError: WorkbenchOperationErrorSetter,
  setSaveConflict?: WorkbenchSaveConflictSetter,
  messages: WorkbenchActionRunnerMessages = defaultWorkbenchActionRunnerMessages
): Promise<T | undefined> {
  try {
    setOperationError(undefined);
    return await action();
  } catch (error) {
    if (isFileSaveConflictError(error)) {
      setSaveConflict?.(error.conflict);
      setOperationError(messages.fileChangedOnDisk);
      return undefined;
    }

    setOperationError(error instanceof Error ? error.message : messages.operationFailed);
    return undefined;
  }
}
