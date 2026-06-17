import { describe, expect, it } from "vitest";
import { ContextKeyService, contextKeyExpressionKeys, keybindingEquals, MenuService } from "@typora-plus/platform";
import {
  defaultWorkbenchExtensionManifest,
  defaultWorkbenchKeybindings,
  defaultWorkbenchMenuItems
} from "./workbenchContributions";
import { workbenchCommandIds } from "./workbenchCommandIds";
import { workbenchContextKeys } from "./workbenchContextModel";
import {
  workbenchMermaidRendererId,
  workbenchMermaidRendererLanguage
} from "./mermaidMarkdownRenderer";
import {
  workbenchStatusRendererId,
  workbenchStatusRendererLanguage
} from "./statusMarkdownRenderer";
import { getWorkbenchCommandMetadata } from "./workbenchCommandMetadata";
import { workbenchMenuIds } from "./workbenchMenuModel";
import { workbenchSideViews } from "./workbenchSideViewModel";

describe("workbench contributions", () => {
  it("contributes titlebar actions in stable command order", () => {
    expect(workbenchMenuCommands("titlebar.primary", {
      fileSystemAvailable: true,
      workspaceOpen: true
    })).toEqual([
      workbenchCommandIds.file.newUntitled,
      workbenchCommandIds.file.openWorkspace,
      workbenchCommandIds.file.save,
      workbenchCommandIds.file.saveAs,
      workbenchCommandIds.file.exportHtml,
      workbenchCommandIds.editor.focusModeToggle,
      workbenchCommandIds.editor.typewriterModeToggle,
      workbenchCommandIds.theme.toggle,
      workbenchCommandIds.workbench.commandPaletteOpen
    ]);
  });

  it("contributes activitybar actions in stable command order", () => {
    expect(workbenchMenuCommands("activitybar.primary", {
      fileSystemAvailable: true,
      workspaceOpen: true
    })).toEqual([
      workbenchCommandIds.workbench.sidebarFiles,
      workbenchCommandIds.workbench.sidebarSearch,
      workbenchCommandIds.workbench.sidebarOutline,
      workbenchCommandIds.workbench.sidebarBacklinks,
      workbenchCommandIds.workbench.sidebarTags
    ]);
    expect(workbenchMenuCommands("activitybar.secondary", {
      fileSystemAvailable: true,
      workspaceOpen: true
    })).toEqual([
      workbenchCommandIds.workbench.settingsOpen,
      workbenchCommandIds.workbench.commandPaletteOpen
    ]);
  });

  it("shows workspace sync planning only when a workspace and remote sync provider are available", () => {
    expect(workbenchMenuCommands("titlebar.primary", {
      fileSystemAvailable: true,
      remoteSyncProviderAvailable: true,
      workspaceOpen: false
    })).not.toContain(workbenchCommandIds.remoteSync.planWorkspace);
    expect(workbenchMenuCommands("titlebar.primary", {
      fileSystemAvailable: true,
      remoteSyncProviderAvailable: false,
      workspaceOpen: true
    })).not.toContain(workbenchCommandIds.remoteSync.planWorkspace);
    expect(workbenchMenuCommands("titlebar.primary", {
      fileSystemAvailable: true,
      remoteSyncProviderAvailable: true,
      workspaceOpen: true
    })).toEqual([
      workbenchCommandIds.file.newUntitled,
      workbenchCommandIds.file.openWorkspace,
      workbenchCommandIds.file.save,
      workbenchCommandIds.file.saveAs,
      workbenchCommandIds.file.exportHtml,
      workbenchCommandIds.editor.focusModeToggle,
      workbenchCommandIds.editor.typewriterModeToggle,
      workbenchCommandIds.remoteSync.planWorkspace,
      workbenchCommandIds.theme.toggle,
      workbenchCommandIds.workbench.commandPaletteOpen
    ]);
  });

  it("shows active note AI summary only when an AI provider is available", () => {
    expect(workbenchMenuCommands("titlebar.primary", {
      aiProviderAvailable: false,
      fileSystemAvailable: true,
      workspaceOpen: true
    })).not.toContain(workbenchCommandIds.ai.summarizeActiveNote);
    expect(workbenchMenuCommands("titlebar.primary", {
      aiProviderAvailable: true,
      fileSystemAvailable: true,
      workspaceOpen: true
    })).toEqual([
      workbenchCommandIds.file.newUntitled,
      workbenchCommandIds.file.openWorkspace,
      workbenchCommandIds.file.save,
      workbenchCommandIds.file.saveAs,
      workbenchCommandIds.file.exportHtml,
      workbenchCommandIds.editor.focusModeToggle,
      workbenchCommandIds.editor.typewriterModeToggle,
      workbenchCommandIds.ai.summarizeActiveNote,
      workbenchCommandIds.theme.toggle,
      workbenchCommandIds.workbench.commandPaletteOpen
    ]);
  });

  it("keeps menu contribution ids unique", () => {
    const ids = defaultWorkbenchMenuItems.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
  });

  it("keeps built-in menu contributions scoped to known workbench menus", () => {
    const knownMenuIds = new Set<string>(Object.values(workbenchMenuIds));
    const unknownMenus = defaultWorkbenchMenuItems.flatMap((item) =>
      knownMenuIds.has(item.menu) ? [] : [`${item.id}:${item.menu}`]
    );

    expect(unknownMenus).toEqual([]);
  });

  it("keeps built-in menu and keybinding commands aligned with command metadata", () => {
    const knownCommandIds = new Set(getWorkbenchCommandMetadata().map((command) => command.id));
    const unknownMenuCommands = defaultWorkbenchMenuItems.flatMap((item) =>
      knownCommandIds.has(item.command) ? [] : [`${item.id}:${item.command}`]
    );
    const unknownKeybindingCommands = defaultWorkbenchKeybindings.flatMap((rule) =>
      knownCommandIds.has(rule.command) ? [] : [rule.command]
    );

    expect(unknownMenuCommands).toEqual([]);
    expect(unknownKeybindingCommands).toEqual([]);
  });

  it("keeps built-in menu context keys aligned with the workbench context model", () => {
    const knownContextKeys = new Set<string>(Object.values(workbenchContextKeys));
    const unknownContextKeys = defaultWorkbenchMenuItems.flatMap((item) => [
      ...contextKeyExpressionKeys(item.when),
      ...(item.toggled ? [item.toggled.context] : [])
    ].flatMap((key) => knownContextKeys.has(key) ? [] : [`${item.id}:${key}`]));

    expect(unknownContextKeys).toEqual([]);
  });

  it("keeps activitybar toggles aligned with known side views", () => {
    const sideViewValues = new Set<string>(Object.values(workbenchSideViews));
    const unknownValues = defaultWorkbenchMenuItems.flatMap((item) =>
      item.toggled?.context === workbenchContextKeys.sideView && !sideViewValues.has(String(item.toggled.value))
        ? [item.toggled.value]
        : []
    );

    expect(unknownValues).toEqual([]);
  });

  it("keeps default keybindings scoped to unique command and shortcut pairs", () => {
    const pairs = defaultWorkbenchKeybindings.map((rule) => `${rule.command}:${JSON.stringify(rule.keybinding)}`);

    expect(new Set(pairs).size).toBe(pairs.length);
  });

  it("keeps default keybinding shortcuts unshadowed", () => {
    const duplicateShortcuts = defaultWorkbenchKeybindings.flatMap((rule, index) =>
      defaultWorkbenchKeybindings
        .slice(0, index)
        .some((candidate) => keybindingEquals(candidate.keybinding, rule.keybinding))
        ? [`${rule.command}:${JSON.stringify(rule.keybinding)}`]
        : []
    );

    expect(duplicateShortcuts).toEqual([]);
  });

  it("contributes built-in themes through Typora Plus tokens", () => {
    const themes = defaultWorkbenchExtensionManifest.contributes.themes;

    expect(themes.map((theme) => theme.id)).toEqual(["typora-plus.theme.ink"]);
    expect(new Set(themes.map((theme) => theme.id)).size).toBe(themes.length);
    expect(Object.keys(themes[0]?.tokens ?? {}).every((token) => token.startsWith("--tp-"))).toBe(true);
  });

  it("contributes built-in Markdown renderers", () => {
    expect(defaultWorkbenchExtensionManifest.contributes.markdownRenderers).toEqual([
      {
        id: workbenchMermaidRendererId,
        kind: "block",
        label: "Mermaid",
        language: workbenchMermaidRendererLanguage,
        priority: 100
      },
      {
        id: workbenchStatusRendererId,
        kind: "inline",
        label: "Status",
        language: workbenchStatusRendererLanguage,
        priority: 100
      }
    ]);
  });

  it("keeps built-in workbench command handlers outside the manifest", () => {
    expect(Object.hasOwn(defaultWorkbenchExtensionManifest.contributes, "commands")).toBe(false);
  });

  it("hides unavailable native and workspace-only actions in browser context", () => {
    expect(workbenchMenuCommands("titlebar.primary", {
      fileSystemAvailable: false,
      workspaceOpen: false
    })).toEqual([
      workbenchCommandIds.file.newUntitled,
      workbenchCommandIds.file.exportHtml,
      workbenchCommandIds.editor.focusModeToggle,
      workbenchCommandIds.editor.typewriterModeToggle,
      workbenchCommandIds.theme.toggle,
      workbenchCommandIds.workbench.commandPaletteOpen
    ]);
    expect(workbenchMenuCommands("activitybar.primary", {
      fileSystemAvailable: false,
      workspaceOpen: false
    })).toEqual([
      workbenchCommandIds.workbench.sidebarSearch,
      workbenchCommandIds.workbench.sidebarOutline
    ]);
  });
});

function workbenchMenuCommands(
  menu: string,
  context: {
    readonly aiProviderAvailable?: boolean;
    readonly fileSystemAvailable: boolean;
    readonly remoteSyncProviderAvailable?: boolean;
    readonly workspaceOpen: boolean;
  }
): readonly string[] {
  const contextKeyService = new ContextKeyService();
  const service = new MenuService(contextKeyService);
  contextKeyService.setValue(workbenchContextKeys.aiProviderAvailable, context.aiProviderAvailable ?? false);
  contextKeyService.setValue(workbenchContextKeys.fileSystemAvailable, context.fileSystemAvailable);
  contextKeyService.setValue(
    workbenchContextKeys.remoteSyncProviderAvailable,
    context.remoteSyncProviderAvailable ?? false
  );
  contextKeyService.setValue(workbenchContextKeys.workspaceOpen, context.workspaceOpen);

  for (const item of defaultWorkbenchMenuItems) {
    service.registerMenuItem(item);
  }

  return service.getMenuItems(menu).map((item) => item.command);
}
