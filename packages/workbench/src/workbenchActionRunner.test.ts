import { URI } from "@typora-plus/base";
import { FileSaveConflictError } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchCommandExecutor,
  executeWorkbenchCommand,
  runWorkbenchAction,
  type WorkbenchActionRunnerMessages
} from "./workbenchActionRunner";

describe("workbench action runner", () => {
  it("clears operation errors before returning a successful action result", async () => {
    const operationErrors: Array<string | undefined> = ["previous"];

    await expect(runWorkbenchAction(
      () => "done",
      (value) => operationErrors.push(value)
    )).resolves.toBe("done");

    expect(operationErrors).toEqual(["previous", undefined]);
  });

  it("maps regular errors to operation error messages", async () => {
    const operationErrors: Array<string | undefined> = [];

    await expect(runWorkbenchAction(
      () => {
        throw new Error("Save failed");
      },
      (value) => operationErrors.push(value)
    )).resolves.toBeUndefined();

    expect(operationErrors).toEqual([undefined, "Save failed"]);
  });

  it("uses a generic operation error for non-Error failures", async () => {
    const operationErrors: Array<string | undefined> = [];

    await expect(runWorkbenchAction(
      () => {
        throw "failed";
      },
      (value) => operationErrors.push(value)
    )).resolves.toBeUndefined();

    expect(operationErrors).toEqual([undefined, "Operation failed"]);
  });

  it("uses injected action runner messages for non-Error failures", async () => {
    const operationErrors: Array<string | undefined> = [];

    await expect(runWorkbenchAction(
      () => {
        throw "failed";
      },
      (value) => operationErrors.push(value),
      undefined,
      zhActionRunnerMessages
    )).resolves.toBeUndefined();

    expect(operationErrors).toEqual([undefined, "操作失败"]);
  });

  it("captures save conflicts separately from operation errors", async () => {
    const conflict = {
      uri: URI.file("/workspace/note.md"),
      expectedMtime: 1,
      diskMtime: 2
    };
    const operationErrors: Array<string | undefined> = [];
    const saveConflicts: unknown[] = [];

    await expect(runWorkbenchAction(
      () => {
        throw new FileSaveConflictError(conflict);
      },
      (value) => operationErrors.push(value),
      (value) => saveConflicts.push(value)
    )).resolves.toBeUndefined();

    expect(operationErrors).toEqual([undefined, "File changed on disk"]);
    expect(saveConflicts).toEqual([conflict]);
  });

  it("uses injected action runner messages for save conflicts", async () => {
    const conflict = {
      uri: URI.file("/workspace/note.md"),
      expectedMtime: 1,
      diskMtime: 2
    };
    const operationErrors: Array<string | undefined> = [];

    await expect(runWorkbenchAction(
      () => {
        throw new FileSaveConflictError(conflict);
      },
      (value) => operationErrors.push(value),
      undefined,
      zhActionRunnerMessages
    )).resolves.toBeUndefined();

    expect(operationErrors).toEqual([undefined, "磁盘上的文件已变更"]);
  });

  it("dispatches commands through the same action error boundary", async () => {
    const operationErrors: Array<string | undefined> = [];
    const executeCommand = vi.fn(async (command: string) => {
      if (command === "file.save") {
        throw new Error("Command failed");
      }
    });

    executeWorkbenchCommand(
      {
        commandService: {
          async executeCommand<T = unknown>(command: string): Promise<T> {
            await executeCommand(command);
            return undefined as T;
          }
        }
      },
      "file.save",
      (value) => operationErrors.push(value)
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(executeCommand).toHaveBeenCalledWith("file.save");
    expect(operationErrors).toEqual([undefined, "Command failed"]);
  });

  it("creates a reusable command executor with the shared action boundary", async () => {
    const operationErrors: Array<string | undefined> = [];
    const saveConflicts: unknown[] = [];
    const conflict = {
      uri: URI.file("/workspace/note.md"),
      expectedMtime: 1,
      diskMtime: 2
    };
    const executeCommand = vi.fn(async (command: string) => {
      if (command === "file.save") {
        throw new FileSaveConflictError(conflict);
      }
    });
    const runCommand = createWorkbenchCommandExecutor(
      {
        commandService: {
          async executeCommand<T = unknown>(command: string): Promise<T> {
            await executeCommand(command);
            return undefined as T;
          }
        }
      },
      {
        setOperationError: (value) => operationErrors.push(value),
        setSaveConflict: (value) => saveConflicts.push(value)
      }
    );

    runCommand("workbench.quickOpen");
    runCommand("file.save");
    await Promise.resolve();
    await Promise.resolve();

    expect(executeCommand).toHaveBeenCalledWith("workbench.quickOpen");
    expect(executeCommand).toHaveBeenCalledWith("file.save");
    expect(operationErrors).toEqual([undefined, undefined, "File changed on disk"]);
    expect(saveConflicts).toEqual([conflict]);
  });

  it("passes injected action runner messages through the command executor", async () => {
    const operationErrors: Array<string | undefined> = [];
    const executeCommand = vi.fn(async (_command: string) => {
      throw "failed";
    });
    const runCommand = createWorkbenchCommandExecutor(
      {
        commandService: {
          async executeCommand<T = unknown>(command: string): Promise<T> {
            await executeCommand(command);
            return undefined as T;
          }
        }
      },
      {
        messages: zhActionRunnerMessages,
        setOperationError: (value) => operationErrors.push(value)
      }
    );

    runCommand("file.save");
    await Promise.resolve();
    await Promise.resolve();

    expect(operationErrors).toEqual([undefined, "操作失败"]);
  });
});

const zhActionRunnerMessages: WorkbenchActionRunnerMessages = {
  fileChangedOnDisk: "磁盘上的文件已变更",
  operationFailed: "操作失败"
};
