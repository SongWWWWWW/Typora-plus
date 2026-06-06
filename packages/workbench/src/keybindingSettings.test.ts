import { describe, expect, it } from "vitest";
import {
  filterKeybindingCommands,
  isRecordableKeybinding,
  removeKeybindingOverride,
  upsertKeybindingOverride
} from "./keybindingSettings";

describe("keybinding settings", () => {
  it("replaces a command override without duplicating the command", () => {
    const overrides = upsertKeybindingOverride([
      { command: "file.save", keybinding: { key: "s", primary: true } }
    ], {
      command: "file.save",
      keybinding: { key: "k", primary: true }
    });

    expect(overrides).toEqual([
      { command: "file.save", keybinding: { key: "k", primary: true } }
    ]);
  });

  it("moves a shortcut from an existing command to the new command", () => {
    const overrides = upsertKeybindingOverride([
      { command: "file.save", keybinding: { key: "s", primary: true } },
      { command: "file.saveAs", keybinding: { key: "s", primary: true, shift: true } }
    ], {
      command: "workbench.settings.open",
      keybinding: { key: "s", primary: true }
    });

    expect(overrides).toEqual([
      { command: "file.saveAs", keybinding: { key: "s", primary: true, shift: true } },
      { command: "workbench.settings.open", keybinding: { key: "s", primary: true } }
    ]);
  });

  it("removes only the selected command override", () => {
    expect(removeKeybindingOverride([
      { command: "file.save", keybinding: { key: "s", primary: true } },
      { command: "file.saveAs", keybinding: { key: "s", primary: true, shift: true } }
    ], "file.save")).toEqual([
      { command: "file.saveAs", keybinding: { key: "s", primary: true, shift: true } }
    ]);
  });

  it("requires a modifier for recorded global shortcuts", () => {
    expect(isRecordableKeybinding({ key: "s" })).toBe(false);
    expect(isRecordableKeybinding({ key: "s", primary: true })).toBe(true);
    expect(isRecordableKeybinding({ key: "s", alt: true })).toBe(true);
  });

  it("filters keybinding commands by title, category, or id", () => {
    const commands = [
      { id: "file.save", title: "Save", category: "File", run: () => undefined },
      { id: "workbench.quickOpen", title: "Quick Open", category: "Workbench", run: () => undefined },
      { id: "theme.toggle", title: "Toggle Theme", category: "Workbench", run: () => undefined }
    ];

    expect(filterKeybindingCommands(commands, "file").map((command) => command.id)).toEqual(["file.save"]);
    expect(filterKeybindingCommands(commands, "quick").map((command) => command.id)).toEqual(["workbench.quickOpen"]);
    expect(filterKeybindingCommands(commands, "theme.toggle").map((command) => command.id)).toEqual(["theme.toggle"]);
    expect(filterKeybindingCommands(commands, "  ").map((command) => command.id)).toEqual([
      "file.save",
      "workbench.quickOpen",
      "theme.toggle"
    ]);
  });

  it("filters keybinding commands by active labels and unassigned state", () => {
    const commands = [
      { id: "file.save", title: "Save", category: "File", run: () => undefined },
      { id: "workbench.commandPalette", title: "Command Palette", category: "Workbench", run: () => undefined },
      { id: "workbench.quickOpen", title: "Quick Open", category: "Workbench", run: () => undefined },
      { id: "theme.toggle", title: "Toggle Theme", category: "Workbench", run: () => undefined }
    ];
    const labels = new Map([
      ["file.save", "Ctrl+S"],
      ["workbench.commandPalette", "Ctrl+Shift+P"],
      ["workbench.quickOpen", "Ctrl+P"]
    ]);

    const filter = (query: string) => filterKeybindingCommands(commands, query, {
      getLabel: (command) => labels.get(command.id)
    }).map((command) => command.id);

    expect(filter("ctrl+p")).toEqual(["workbench.quickOpen"]);
    expect(filter("ctrl shift p")).toEqual(["workbench.commandPalette"]);
    expect(filter("unassigned")).toEqual(["theme.toggle"]);
    expect(filter("workbench ctrl")).toEqual(["workbench.commandPalette", "workbench.quickOpen"]);
  });

  it("filters keybinding commands to modified overrides", () => {
    const commands = [
      { id: "file.save", title: "Save", category: "File", run: () => undefined },
      { id: "workbench.quickOpen", title: "Quick Open", category: "Workbench", run: () => undefined },
      { id: "theme.toggle", title: "Toggle Theme", category: "Workbench", run: () => undefined }
    ];

    expect(filterKeybindingCommands(commands, "", {
      modifiedOnly: true,
      overrides: [
        { command: "file.save", keybinding: { key: "k", primary: true } },
        { command: "theme.toggle", keybinding: { key: "t", primary: true } }
      ]
    }).map((command) => command.id)).toEqual(["file.save", "theme.toggle"]);

    expect(filterKeybindingCommands(commands, "theme", {
      modifiedOnly: true,
      overrides: [
        { command: "file.save", keybinding: { key: "k", primary: true } },
        { command: "theme.toggle", keybinding: { key: "t", primary: true } }
      ]
    }).map((command) => command.id)).toEqual(["theme.toggle"]);
  });
});
