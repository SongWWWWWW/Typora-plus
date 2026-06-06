import { describe, expect, it } from "vitest";
import { MenuService } from "@typora-plus/platform";
import { defaultWorkbenchKeybindings, defaultWorkbenchMenuItems } from "./workbenchContributions";

describe("workbench contributions", () => {
  it("contributes titlebar actions in stable command order", () => {
    expect(workbenchMenuCommands("titlebar.primary")).toEqual([
      "file.newUntitled",
      "file.openWorkspace",
      "file.save",
      "file.saveAs",
      "file.exportHtml",
      "editor.focusMode.toggle",
      "editor.typewriterMode.toggle",
      "theme.toggle",
      "workbench.commandPalette.open"
    ]);
  });

  it("contributes activitybar actions in stable command order", () => {
    expect(workbenchMenuCommands("activitybar.primary")).toEqual([
      "workbench.sidebar.files",
      "workbench.sidebar.search",
      "workbench.sidebar.outline",
      "workbench.sidebar.backlinks",
      "workbench.sidebar.tags"
    ]);
    expect(workbenchMenuCommands("activitybar.secondary")).toEqual([
      "workbench.settings.open",
      "workbench.commandPalette.open"
    ]);
  });

  it("keeps menu contribution ids unique", () => {
    const ids = defaultWorkbenchMenuItems.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps default keybindings scoped to unique command and shortcut pairs", () => {
    const pairs = defaultWorkbenchKeybindings.map((rule) => `${rule.command}:${JSON.stringify(rule.keybinding)}`);

    expect(new Set(pairs).size).toBe(pairs.length);
  });
});

function workbenchMenuCommands(menu: string): readonly string[] {
  const service = new MenuService();

  for (const item of defaultWorkbenchMenuItems) {
    service.registerMenuItem(item);
  }

  return service.getMenuItems(menu).map((item) => item.command);
}
