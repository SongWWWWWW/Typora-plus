import type {
  CommandMetadata,
  Keybinding
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchCommandSurface,
  type WorkbenchCommandSurfaceServices
} from "./workbenchCommandSurface";

describe("workbench command surface", () => {
  it("captures a command metadata snapshot for command surfaces", () => {
    const commands: readonly CommandMetadata[] = [
      { id: "file.save", title: "Save", category: "File" },
      { id: "workbench.quickOpen", title: "Quick Open", category: "Workbench" }
    ];
    const services = createServices({ commands });

    const surface = createWorkbenchCommandSurface(services);

    expect(surface.commands).toBe(commands);
    expect(services.commandService.getCommands).toHaveBeenCalledOnce();
    expect(surface.getCommandTitle("file.save")).toBe("Save");
    expect(surface.getCommandTitle("missing.command")).toBe("missing.command");
  });

  it("delegates active keybinding lookups through the keybinding service", () => {
    const saveKeybinding: Keybinding = {
      key: "s",
      primary: true
    };
    const services = createServices({
      commandForKeybinding: "file.save",
      keybindingLabel: "Ctrl+S",
      keybindingLabelForKeybinding: "Ctrl+S"
    });

    const surface = createWorkbenchCommandSurface(services);

    expect(surface.getKeybindingLabel("file.save")).toBe("Ctrl+S");
    expect(surface.getKeybindingLabelForKeybinding(saveKeybinding)).toBe("Ctrl+S");
    expect(surface.getCommandForKeybinding(saveKeybinding)).toBe("file.save");
    expect(services.keybindingService.getKeybindingLabel).toHaveBeenCalledWith("file.save");
    expect(services.keybindingService.getKeybindingLabelForKeybinding).toHaveBeenCalledWith(saveKeybinding);
    expect(services.keybindingService.getCommandForKeybinding).toHaveBeenCalledWith(saveKeybinding);
  });
});

function createServices(overrides: {
  readonly commandForKeybinding?: string;
  readonly commands?: readonly CommandMetadata[];
  readonly keybindingLabel?: string;
  readonly keybindingLabelForKeybinding?: string;
} = {}) {
  return {
    commandService: {
      getCommands: vi.fn(() => overrides.commands ?? [])
    },
    keybindingService: {
      getCommandForKeybinding: vi.fn(() => overrides.commandForKeybinding),
      getKeybindingLabel: vi.fn(() => overrides.keybindingLabel),
      getKeybindingLabelForKeybinding: vi.fn(() => overrides.keybindingLabelForKeybinding ?? "Unassigned")
    }
  } satisfies WorkbenchCommandSurfaceServices;
}
