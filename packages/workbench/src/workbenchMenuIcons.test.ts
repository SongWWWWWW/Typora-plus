import { describe, expect, it } from "vitest";
import { defaultWorkbenchMenuItems } from "./workbenchContributions";
import {
  isKnownWorkbenchMenuIconId,
  resolveWorkbenchMenuIconName,
  workbenchMenuIconIds
} from "./workbenchMenuIconModel";

describe("workbench menu icons", () => {
  const lightConfiguration = {
    appearance: {
      colorScheme: "light" as const
    }
  };

  it("defines stable icon ids for Workbench menu contributions", () => {
    expect(workbenchMenuIconIds).toEqual({
      command: "command",
      fileDown: "file-down",
      filePlus: "file-plus",
      fileText: "file-text",
      folderOpen: "folder-open",
      hash: "hash",
      link: "link",
      listTree: "list-tree",
      save: "save",
      search: "search",
      settings: "settings",
      target: "target",
      theme: "theme",
      type: "type"
    });
  });

  it("keeps built-in menu contributions on known icon ids", () => {
    const unknownIcons = defaultWorkbenchMenuItems.flatMap((item) =>
      item.icon && !isKnownWorkbenchMenuIconId(item.icon) ? [item.icon] : []
    );

    expect(defaultWorkbenchMenuItems.every((item) => item.icon)).toBe(true);
    expect(unknownIcons).toEqual([]);
  });

  it("resolves contributed icon ids to local icon names", () => {
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.command, lightConfiguration)).toBe("command");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.fileDown, lightConfiguration)).toBe("file-down");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.filePlus, lightConfiguration)).toBe("file-plus");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.fileText, lightConfiguration)).toBe("file-text");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.folderOpen, lightConfiguration)).toBe("folder-open");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.hash, lightConfiguration)).toBe("hash");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.link, lightConfiguration)).toBe("link");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.listTree, lightConfiguration)).toBe("list-tree");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.save, lightConfiguration)).toBe("save");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.search, lightConfiguration)).toBe("search");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.settings, lightConfiguration)).toBe("settings");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.target, lightConfiguration)).toBe("target");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.type, lightConfiguration)).toBe("type");
  });

  it("resolves the theme icon from the active color scheme preference", () => {
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.theme, lightConfiguration)).toBe("moon");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.theme, {
      appearance: {
        colorScheme: "system"
      }
    })).toBe("moon");
    expect(resolveWorkbenchMenuIconName(workbenchMenuIconIds.theme, {
      appearance: {
        colorScheme: "dark"
      }
    })).toBe("sun");
  });

  it("falls back unknown or missing icon ids to the command icon", () => {
    expect(resolveWorkbenchMenuIconName(undefined, lightConfiguration)).toBe("command");
    expect(resolveWorkbenchMenuIconName("extension.unknown", lightConfiguration)).toBe("command");
    expect(isKnownWorkbenchMenuIconId(undefined)).toBe(false);
    expect(isKnownWorkbenchMenuIconId("extension.unknown")).toBe(false);
  });
});
