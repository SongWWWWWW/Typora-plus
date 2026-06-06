import { describe, expect, it } from "vitest";
import {
  bytesToMegabytes,
  clampSettingNumber,
  createSettingsSearchResult,
  megabytesToBytes,
  normalizeAssetFolderInput,
  settingSectionAnchorId,
  settingsEntries,
  settingsSections,
  settingsNumberConstraints
} from "./settingsModel";

describe("settings model", () => {
  it("defines stable settings sections for navigation", () => {
    expect(settingsSections.map((section) => [section.id, section.title])).toEqual([
      ["appearance", "Appearance"],
      ["editor", "Editor"],
      ["workspace", "Workspace"],
      ["keybindings", "Keybindings"]
    ]);
  });

  it("generates unique settings section anchors", () => {
    const anchors = settingsSections.map((section) => settingSectionAnchorId(section.id));

    expect(anchors).toEqual([
      "tp-settings-section-appearance",
      "tp-settings-section-editor",
      "tp-settings-section-workspace",
      "tp-settings-section-keybindings"
    ]);
    expect(new Set(anchors).size).toBe(anchors.length);
  });

  it("returns every settings entry for an empty settings search", () => {
    const result = createSettingsSearchResult("   ");

    expect(result.query).toBe("");
    expect(result.visibleSections).toEqual(settingsSections.map((section) => section.id));
    expect(result.visibleEntries).toEqual(settingsEntries.map((entry) => entry.id));
  });

  it("matches complete sections and individual settings entries", () => {
    expect(createSettingsSearchResult("workspace").visibleEntries).toEqual([
      "workspace.defaultAssetFolder",
      "workspace.searchMaxFileSize",
      "workspace.searchMaxResults"
    ]);
    expect(createSettingsSearchResult("font").visibleEntries).toEqual(["editor.fontSize"]);
    expect(createSettingsSearchResult("save delay").visibleEntries).toEqual(["editor.autoSaveDelay"]);
    expect(createSettingsSearchResult("shortcut").visibleEntries).toEqual(["keybindings.editor"]);
    expect(createSettingsSearchResult("search limit").visibleEntries).toEqual([
      "workspace.searchMaxFileSize",
      "workspace.searchMaxResults"
    ]);
  });

  it("returns no sections when settings search has no matches", () => {
    const result = createSettingsSearchResult("does-not-exist");

    expect(result.visibleEntries).toEqual([]);
    expect(result.visibleSections).toEqual([]);
  });

  it("clamps numeric settings to their configured bounds", () => {
    expect(clampSettingNumber(9, settingsNumberConstraints.editorFontSize)).toBe(13);
    expect(clampSettingNumber(26, settingsNumberConstraints.editorFontSize)).toBe(24);
    expect(clampSettingNumber(1.725, settingsNumberConstraints.editorLineHeight)).toBe(1.73);
    expect(clampSettingNumber(100, settingsNumberConstraints.editorAutoSaveDelayMs)).toBe(250);
    expect(clampSettingNumber(5250, settingsNumberConstraints.editorAutoSaveDelayMs)).toBe(5000);
  });

  it("converts search file size between bytes and megabytes", () => {
    expect(bytesToMegabytes(2 * 1024 * 1024)).toBe(2);
    expect(megabytesToBytes(3)).toBe(3 * 1024 * 1024);
    expect(megabytesToBytes(100)).toBe(20 * 1024 * 1024);
  });

  it("normalizes asset folder input without accepting empty values", () => {
    expect(normalizeAssetFolderInput(" assets\\images ")).toBe("assets/images");
    expect(normalizeAssetFolderInput("   ")).toBeUndefined();
  });
});
