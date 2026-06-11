import { URI } from "@typora-plus/base";
import { FileSaveConflictError } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createCommandPaletteExecutionCallbacks,
  executeCommandPaletteCommand,
  filterCommandPaletteCommands,
  type CommandPaletteExecutionServices
} from "./commandPaletteModel";

describe("command palette model", () => {
  const commands = [
    { id: "workbench.commandPalette.open", title: "Command Palette", category: "Workbench", run: () => undefined },
    { id: "workbench.quickOpen", title: "Quick Open", category: "Workbench", run: () => undefined },
    { id: "file.save", title: "Save", category: "File", run: () => undefined },
    { id: "theme.toggle", title: "Toggle Theme", category: "Workbench", run: () => undefined }
  ];

  it("creates execution callbacks from shell state setters", () => {
    const setOperationError = vi.fn();
    const setPaletteOpen = vi.fn();
    const setSaveConflict = vi.fn();
    const callbacks = createCommandPaletteExecutionCallbacks({
      setOperationError,
      setPaletteOpen,
      setSaveConflict
    });
    const conflict = {
      uri: URI.file("/workspace/note.md"),
      expectedMtime: 1,
      diskMtime: 2
    };

    callbacks.closePalette();
    callbacks.setOperationError("Command failed");
    callbacks.setSaveConflict?.(conflict);

    expect(setPaletteOpen).toHaveBeenCalledWith(false);
    expect(setOperationError).toHaveBeenCalledWith("Command failed");
    expect(setSaveConflict).toHaveBeenCalledWith(conflict);
  });

  it("returns every command for an empty query", () => {
    expect(filterCommandPaletteCommands(commands, "   ").map((command) => command.id)).toEqual([
      "workbench.commandPalette.open",
      "workbench.quickOpen",
      "file.save",
      "theme.toggle"
    ]);
  });

  it("filters commands by title, category, and id", () => {
    expect(filterCommandPaletteCommands(commands, "quick").map((command) => command.id)).toEqual(["workbench.quickOpen"]);
    expect(filterCommandPaletteCommands(commands, "file").map((command) => command.id)).toEqual(["file.save"]);
    expect(filterCommandPaletteCommands(commands, "theme.toggle").map((command) => command.id)).toEqual(["theme.toggle"]);
  });

  it("filters commands by active shortcut labels", () => {
    const labels = new Map([
      ["workbench.commandPalette.open", "Ctrl+Shift+P"],
      ["workbench.quickOpen", "Ctrl+P"],
      ["file.save", "Ctrl+S"]
    ]);
    const filter = (query: string) => filterCommandPaletteCommands(commands, query, {
      getKeybindingLabel: (command) => labels.get(command.id)
    }).map((command) => command.id);

    expect(filter("ctrl+p")).toEqual(["workbench.quickOpen"]);
    expect(filter("ctrl shift p")).toEqual(["workbench.commandPalette.open"]);
    expect(filter("workbench ctrl")).toEqual(["workbench.commandPalette.open", "workbench.quickOpen"]);
  });

  it("executes commands through the Workbench action boundary and closes the palette", async () => {
    const calls: string[] = [];
    const services = createExecutionServices(async (command) => {
      calls.push(`execute:${command}`);
    });

    executeCommandPaletteCommand(services, "file.save", {
      closePalette: () => calls.push("close"),
      setOperationError: (value) => calls.push(`error:${value ?? "none"}`)
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toEqual(["error:none", "execute:file.save", "close"]);
  });

  it("keeps command failures on the shared operation error path", async () => {
    const operationErrors: Array<string | undefined> = [];
    const closePalette = vi.fn();
    const services = createExecutionServices(async () => {
      throw new Error("Command failed");
    });

    executeCommandPaletteCommand(services, "file.save", {
      closePalette,
      setOperationError: (value) => operationErrors.push(value)
    });

    expect(closePalette).toHaveBeenCalledTimes(1);

    await Promise.resolve();
    await Promise.resolve();

    expect(operationErrors).toEqual([undefined, "Command failed"]);
  });

  it("forwards save conflicts from command execution", async () => {
    const conflict = {
      uri: URI.file("/workspace/note.md"),
      expectedMtime: 1,
      diskMtime: 2
    };
    const saveConflicts: unknown[] = [];
    const operationErrors: Array<string | undefined> = [];
    const services = createExecutionServices(async () => {
      throw new FileSaveConflictError(conflict);
    });

    executeCommandPaletteCommand(services, "file.save", {
      closePalette: vi.fn(),
      setOperationError: (value) => operationErrors.push(value),
      setSaveConflict: (value) => saveConflicts.push(value)
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(saveConflicts).toEqual([conflict]);
    expect(operationErrors).toEqual([undefined, "File changed on disk"]);
  });
});

function createExecutionServices(
  executeCommand: (command: string) => Promise<void>
): CommandPaletteExecutionServices {
  return {
    commandService: {
      async executeCommand<T = unknown>(command: string): Promise<T> {
        await executeCommand(command);
        return undefined as T;
      }
    }
  };
}
