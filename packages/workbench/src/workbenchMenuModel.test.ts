import { Emitter } from "@typora-plus/base";
import type { MenuItem } from "@typora-plus/platform";
import { describe, expect, it } from "vitest";
import {
  createWorkbenchMenuContext,
  getWorkbenchMenuItems,
  isWorkbenchMenuItemActive,
  registerWorkbenchMenuItemsSubscription,
  workbenchCommandTitle,
  workbenchMenuIds,
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

  it("defines stable Workbench menu contribution points", () => {
    expect(workbenchMenuIds).toEqual({
      titlebarPrimary: "titlebar.primary",
      activitybarPrimary: "activitybar.primary",
      activitybarSecondary: "activitybar.secondary"
    });
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

  it("reads menu items through the menu service boundary", () => {
    const fileSave = menuItem({ command: "file.save" });
    const services = createMenuServices({
      "titlebar.primary": [fileSave]
    });

    expect(getWorkbenchMenuItems(services, "titlebar.primary")).toEqual([fileSave]);
    expect(getWorkbenchMenuItems(services, "activitybar.primary")).toEqual([]);
  });

  it("subscribes to one menu id and refreshes its current items", () => {
    const fileSave = menuItem({ command: "file.save" });
    const quickOpen = menuItem({
      id: "quick.open",
      menu: "activitybar.primary",
      command: "workbench.quickOpen"
    });
    const updates: Array<readonly MenuItem[]> = [];
    const services = createMenuServices({
      "activitybar.primary": [quickOpen],
      "titlebar.primary": [fileSave]
    });

    const disposable = registerWorkbenchMenuItemsSubscription(
      services,
      "titlebar.primary",
      (items) => updates.push(items)
    );

    services.emit("activitybar.primary");
    expect(updates).toEqual([]);

    services.setItems("titlebar.primary", []);
    services.emit("titlebar.primary");
    expect(updates).toEqual([[]]);

    disposable.dispose();
    services.setItems("titlebar.primary", [fileSave]);
    services.emit("titlebar.primary");
    expect(updates).toEqual([[]]);
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

function createMenuServices(initialItems: Record<string, readonly MenuItem[]>) {
  const menuEmitter = new Emitter<string>();
  const items = new Map(Object.entries(initialItems));

  return {
    menuService: {
      getMenuItems: (menu: string) => items.get(menu) ?? [],
      onDidChangeMenu: menuEmitter.event
    },
    emit: (menu: string) => menuEmitter.fire(menu),
    setItems: (menu: string, nextItems: readonly MenuItem[]) => items.set(menu, nextItems)
  };
}
