import { describe, expect, it } from "vitest";
import {
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
});
