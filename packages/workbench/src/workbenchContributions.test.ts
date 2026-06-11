import { describe, expect, it } from "vitest";
import { ContextKeyService, MenuService } from "@typora-plus/platform";
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

  it("keeps menu contribution ids unique", () => {
    const ids = defaultWorkbenchMenuItems.map((item) => item.id);

    expect(new Set(ids).size).toBe(ids.length);
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
    readonly fileSystemAvailable: boolean;
    readonly remoteSyncProviderAvailable?: boolean;
    readonly workspaceOpen: boolean;
  }
): readonly string[] {
  const contextKeyService = new ContextKeyService();
  const service = new MenuService(contextKeyService);
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
