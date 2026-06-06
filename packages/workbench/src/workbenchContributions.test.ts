import { describe, expect, it } from "vitest";
import { ContextKeyService, MenuService } from "@typora-plus/platform";
import {
  defaultWorkbenchExtensionManifest,
  defaultWorkbenchKeybindings,
  defaultWorkbenchMenuItems
} from "./workbenchContributions";

describe("workbench contributions", () => {
  it("contributes titlebar actions in stable command order", () => {
    expect(workbenchMenuCommands("titlebar.primary", {
      fileSystemAvailable: true,
      workspaceOpen: true
    })).toEqual([
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
    expect(workbenchMenuCommands("activitybar.primary", {
      fileSystemAvailable: true,
      workspaceOpen: true
    })).toEqual([
      "workbench.sidebar.files",
      "workbench.sidebar.search",
      "workbench.sidebar.outline",
      "workbench.sidebar.backlinks",
      "workbench.sidebar.tags"
    ]);
    expect(workbenchMenuCommands("activitybar.secondary", {
      fileSystemAvailable: true,
      workspaceOpen: true
    })).toEqual([
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

  it("contributes built-in themes through Typora Plus tokens", () => {
    const themes = defaultWorkbenchExtensionManifest.contributes.themes;

    expect(themes.map((theme) => theme.id)).toEqual(["typora-plus.theme.ink"]);
    expect(new Set(themes.map((theme) => theme.id)).size).toBe(themes.length);
    expect(Object.keys(themes[0]?.tokens ?? {}).every((token) => token.startsWith("--tp-"))).toBe(true);
  });

  it("keeps built-in workbench command handlers outside the manifest", () => {
    expect(Object.hasOwn(defaultWorkbenchExtensionManifest.contributes, "commands")).toBe(false);
  });

  it("hides unavailable native and workspace-only actions in browser context", () => {
    expect(workbenchMenuCommands("titlebar.primary", {
      fileSystemAvailable: false,
      workspaceOpen: false
    })).toEqual([
      "file.newUntitled",
      "file.exportHtml",
      "editor.focusMode.toggle",
      "editor.typewriterMode.toggle",
      "theme.toggle",
      "workbench.commandPalette.open"
    ]);
    expect(workbenchMenuCommands("activitybar.primary", {
      fileSystemAvailable: false,
      workspaceOpen: false
    })).toEqual([
      "workbench.sidebar.search",
      "workbench.sidebar.outline"
    ]);
  });
});

function workbenchMenuCommands(
  menu: string,
  context: { readonly fileSystemAvailable: boolean; readonly workspaceOpen: boolean }
): readonly string[] {
  const contextKeyService = new ContextKeyService();
  const service = new MenuService(contextKeyService);
  contextKeyService.setValue("fileSystem.available", context.fileSystemAvailable);
  contextKeyService.setValue("workspace.open", context.workspaceOpen);

  for (const item of defaultWorkbenchMenuItems) {
    service.registerMenuItem(item);
  }

  return service.getMenuItems(menu).map((item) => item.command);
}
