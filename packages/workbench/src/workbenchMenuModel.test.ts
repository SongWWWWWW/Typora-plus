import type { MenuItem } from "@typora-plus/platform";
import { describe, expect, it } from "vitest";
import {
  createWorkbenchMenuContext,
  isWorkbenchMenuItemActive,
  workbenchCommandTitle,
  workbenchMenuItemTitle
} from "./workbenchMenuModel";

describe("workbench menu model", () => {
  const commands = [
    { id: "file.save", title: "Save" },
    { id: "workbench.sidebar.files", title: "Show Files" }
  ];

  it("resolves command titles with command id fallback", () => {
    expect(workbenchCommandTitle(commands, "file.save")).toBe("Save");
    expect(workbenchCommandTitle(commands, "missing.command")).toBe("missing.command");
  });

  it("prefers contributed menu titles over command titles", () => {
    expect(workbenchMenuItemTitle(menuItem({
      command: "file.save",
      title: "Save Document"
    }), (id) => workbenchCommandTitle(commands, id))).toBe("Save Document");
    expect(workbenchMenuItemTitle(menuItem({
      command: "file.save"
    }), (id) => workbenchCommandTitle(commands, id))).toBe("Save");
  });

  it("creates the menu context consumed by toggled menu items", () => {
    expect(createWorkbenchMenuContext({
      editor: {
        focusMode: true,
        typewriterMode: false
      }
    }, "files")).toEqual({
      sideView: "files",
      "editor.focusMode": true,
      "editor.typewriterMode": false
    });
  });

  it("matches active menu items through toggled context values", () => {
    const context = createWorkbenchMenuContext({
      editor: {
        focusMode: true,
        typewriterMode: false
      }
    }, "files");

    expect(isWorkbenchMenuItemActive(menuItem({
      toggled: { context: "sideView", value: "files" }
    }), context)).toBe(true);
    expect(isWorkbenchMenuItemActive(menuItem({
      toggled: { context: "sideView", value: "search" }
    }), context)).toBe(false);
    expect(isWorkbenchMenuItemActive(menuItem({
      toggled: { context: "editor.focusMode", value: true }
    }), context)).toBe(true);
    expect(isWorkbenchMenuItemActive(menuItem({}), context)).toBe(false);
  });
});

function menuItem(overrides: Partial<MenuItem>): MenuItem {
  return {
    id: "menu.item",
    menu: "titlebar.primary",
    command: "file.save",
    ...overrides
  };
}
