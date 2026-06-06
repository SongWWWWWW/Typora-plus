import { describe, expect, it } from "vitest";
import { filterCommandPaletteCommands } from "./commandPaletteModel";

describe("command palette model", () => {
  const commands = [
    { id: "workbench.commandPalette.open", title: "Command Palette", category: "Workbench", run: () => undefined },
    { id: "workbench.quickOpen", title: "Quick Open", category: "Workbench", run: () => undefined },
    { id: "file.save", title: "Save", category: "File", run: () => undefined },
    { id: "theme.toggle", title: "Toggle Theme", category: "Workbench", run: () => undefined }
  ];

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
});
