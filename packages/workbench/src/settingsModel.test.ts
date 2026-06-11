import { describe, expect, it } from "vitest";
import {
  bytesToMegabytes,
  clampSettingNumber,
  createSettingsThemeOptions,
  createSettingsSearchResult,
  createSettingsVisibilityState,
  defaultSettingsSectionId,
  defaultSettingsThemeOption,
  formatSettingsThemeOptionLabel,
  getSettingsEntryDefinition,
  getSettingsEntryLabel,
  getSettingsSectionDefinition,
  getSettingsSectionTitle,
  isSettingsEntryVisible,
  isSettingsSectionVisible,
  megabytesToBytes,
  normalizeAssetFolderInput,
  resolveNearestSettingsSection,
  resolveSelectedSettingsThemeId,
  resolveSettingsAssetFolderCommit,
  resolveSettingsNumberInput,
  resolveVisibleSettingsSection,
  settingSectionAnchorId,
  settingsColorSchemeOptions,
  settingsDensityOptions,
  settingsEntries,
  settingsEntryIds,
  settingsSectionIds,
  settingsSections,
  settingsNumberConstraints
} from "./settingsModel";

describe("settings model", () => {
  it("defines stable settings section ids", () => {
    expect(settingsSectionIds).toEqual({
      appearance: "appearance",
      editor: "editor",
      workspace: "workspace",
      keybindings: "keybindings"
    });
    expect(defaultSettingsSectionId).toBe(settingsSectionIds.appearance);
  });

  it("defines stable settings entry ids", () => {
    expect(settingsEntryIds).toEqual({
      appearance: {
        theme: "appearance.theme",
        customTheme: "appearance.customTheme",
        density: "appearance.density"
      },
      editor: {
        autoSave: "editor.autoSave",
        autoSaveDelay: "editor.autoSaveDelay",
        focusMode: "editor.focusMode",
        typewriterMode: "editor.typewriterMode",
        fontSize: "editor.fontSize",
        lineHeight: "editor.lineHeight",
        maxWidth: "editor.maxWidth",
        rendererPreviewCacheEntries: "editor.rendererPreviewCacheEntries"
      },
      workspace: {
        defaultAssetFolder: "workspace.defaultAssetFolder",
        quickOpenMaxResults: "workspace.quickOpenMaxResults",
        searchMaxFileSize: "workspace.searchMaxFileSize",
        searchMaxResults: "workspace.searchMaxResults"
      },
      keybindings: {
        editor: "keybindings.editor"
      }
    });
  });

  it("defines stable settings sections for navigation", () => {
    expect(settingsSections.map((section) => [section.id, section.title])).toEqual([
      ["appearance", "Appearance"],
      ["editor", "Editor"],
      ["workspace", "Workspace"],
      ["keybindings", "Keybindings"]
    ]);
  });

  it("keeps settings entries unique and assigned to known sections", () => {
    const sectionIds = new Set(settingsSections.map((section) => section.id));
    const entryIds = settingsEntries.map((entry) => entry.id);

    expect(new Set(entryIds).size).toBe(entryIds.length);
    expect(settingsEntries.flatMap((entry) =>
      sectionIds.has(entry.sectionId) ? [] : [entry.sectionId]
    )).toEqual([]);
  });

  it("reads settings entry definitions and labels by id", () => {
    for (const entry of settingsEntries) {
      expect(getSettingsEntryDefinition(entry.id)).toBe(entry);
      expect(getSettingsEntryLabel(entry.id)).toBe(entry.label);
    }
  });

  it("reads settings section definitions and titles by id", () => {
    for (const section of settingsSections) {
      expect(getSettingsSectionDefinition(section.id)).toBe(section);
      expect(getSettingsSectionTitle(section.id)).toBe(section.title);
    }
  });

  it("defines stable settings option metadata", () => {
    expect(defaultSettingsThemeOption).toEqual({ value: "", label: "Default" });
    expect(settingsColorSchemeOptions).toEqual([
      { value: "system", label: "System" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" }
    ]);
    expect(settingsDensityOptions).toEqual([
      { value: "comfortable", label: "Comfortable" },
      { value: "compact", label: "Compact" }
    ]);
  });

  it("creates custom theme options from registered themes", () => {
    const themes = [
      { id: "ink", label: "Ink", colorScheme: "dark" },
      { id: "paper", label: "Paper" }
    ] as const;

    expect(createSettingsThemeOptions(themes)).toEqual([
      { value: "", label: "Default" },
      { value: "ink", label: "Ink (dark)" },
      { value: "paper", label: "Paper" }
    ]);
    expect(formatSettingsThemeOptionLabel(themes[0])).toBe("Ink (dark)");
    expect(formatSettingsThemeOptionLabel(themes[1])).toBe("Paper");
  });

  it("resolves selected custom theme ids against registered themes", () => {
    const themes = [
      { id: "ink" },
      { id: "paper" }
    ] as const;

    expect(resolveSelectedSettingsThemeId("ink", themes)).toBe("ink");
    expect(resolveSelectedSettingsThemeId("missing", themes)).toBe("");
    expect(resolveSelectedSettingsThemeId(undefined, themes)).toBe("");
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

  it("creates settings visibility state from search results", () => {
    const allSettings = createSettingsVisibilityState(createSettingsSearchResult(""));

    expect(allSettings.hasResults).toBe(true);
    expect(allSettings.visibleSections).toEqual(settingsSections);
    expect(allSettings.visibleSectionIds).toEqual(settingsSections.map((section) => section.id));
    expect(allSettings.visibleEntryIds).toEqual(settingsEntries.map((entry) => entry.id));
    expect(isSettingsSectionVisible(allSettings, settingsSectionIds.editor)).toBe(true);
    expect(isSettingsEntryVisible(allSettings, settingsEntryIds.editor.fontSize)).toBe(true);

    const workspaceSettings = createSettingsVisibilityState(createSettingsSearchResult("workspace"));
    expect(workspaceSettings.hasResults).toBe(true);
    expect(workspaceSettings.visibleSections.map((section) => section.id)).toEqual([settingsSectionIds.workspace]);
    expect(isSettingsSectionVisible(workspaceSettings, settingsSectionIds.workspace)).toBe(true);
    expect(isSettingsSectionVisible(workspaceSettings, settingsSectionIds.editor)).toBe(false);
    expect(isSettingsEntryVisible(workspaceSettings, settingsEntryIds.workspace.searchMaxResults)).toBe(true);
    expect(isSettingsEntryVisible(workspaceSettings, settingsEntryIds.editor.fontSize)).toBe(false);
  });

  it("matches complete sections and individual settings entries", () => {
    expect(createSettingsSearchResult("workspace").visibleEntries).toEqual([
      "workspace.defaultAssetFolder",
      "workspace.quickOpenMaxResults",
      "workspace.searchMaxFileSize",
      "workspace.searchMaxResults"
    ]);
    expect(createSettingsSearchResult("font").visibleEntries).toEqual(["editor.fontSize"]);
    expect(createSettingsSearchResult("custom theme").visibleEntries).toEqual(["appearance.customTheme"]);
    expect(createSettingsSearchResult("save delay").visibleEntries).toEqual(["editor.autoSaveDelay"]);
    expect(createSettingsSearchResult("renderer cache").visibleEntries).toEqual(["editor.rendererPreviewCacheEntries"]);
    expect(createSettingsSearchResult("shortcut").visibleEntries).toEqual(["keybindings.editor"]);
    expect(createSettingsSearchResult("search limit").visibleEntries).toEqual([
      "workspace.searchMaxFileSize",
      "workspace.searchMaxResults"
    ]);
    expect(createSettingsSearchResult("quick open").visibleEntries).toEqual(["workspace.quickOpenMaxResults"]);
  });

  it("returns no sections when settings search has no matches", () => {
    const result = createSettingsSearchResult("does-not-exist");
    const visibility = createSettingsVisibilityState(result);

    expect(result.visibleEntries).toEqual([]);
    expect(result.visibleSections).toEqual([]);
    expect(visibility.hasResults).toBe(false);
    expect(visibility.visibleSections).toEqual([]);
    expect(isSettingsSectionVisible(visibility, settingsSectionIds.editor)).toBe(false);
    expect(isSettingsEntryVisible(visibility, settingsEntryIds.editor.fontSize)).toBe(false);
  });

  it("resolves active settings sections against visible search results", () => {
    expect(resolveVisibleSettingsSection(settingsSectionIds.editor, [
      settingsSectionIds.appearance,
      settingsSectionIds.editor
    ])).toBe(settingsSectionIds.editor);
    expect(resolveVisibleSettingsSection(settingsSectionIds.workspace, [
      settingsSectionIds.appearance,
      settingsSectionIds.editor
    ])).toBe(settingsSectionIds.appearance);
    expect(resolveVisibleSettingsSection(settingsSectionIds.workspace, [])).toBe(settingsSectionIds.workspace);
  });

  it("resolves the nearest measured settings section", () => {
    expect(resolveNearestSettingsSection(settingsSectionIds.appearance, [
      { sectionId: settingsSectionIds.appearance, distance: 90 },
      { sectionId: settingsSectionIds.editor, distance: 20 },
      { sectionId: settingsSectionIds.workspace, distance: 40 }
    ])).toBe(settingsSectionIds.editor);
    expect(resolveNearestSettingsSection(settingsSectionIds.keybindings, [
      { sectionId: settingsSectionIds.appearance, distance: Number.POSITIVE_INFINITY },
      { sectionId: settingsSectionIds.editor, distance: Number.NaN }
    ])).toBe(settingsSectionIds.keybindings);
  });

  it("clamps numeric settings to their configured bounds", () => {
    expect(clampSettingNumber(9, settingsNumberConstraints.editorFontSize)).toBe(13);
    expect(clampSettingNumber(26, settingsNumberConstraints.editorFontSize)).toBe(24);
    expect(clampSettingNumber(1.725, settingsNumberConstraints.editorLineHeight)).toBe(1.73);
    expect(clampSettingNumber(100, settingsNumberConstraints.editorAutoSaveDelayMs)).toBe(250);
    expect(clampSettingNumber(5250, settingsNumberConstraints.editorAutoSaveDelayMs)).toBe(5000);
    expect(clampSettingNumber(-1, settingsNumberConstraints.editorRendererPreviewCacheEntries)).toBe(0);
    expect(clampSettingNumber(500, settingsNumberConstraints.editorRendererPreviewCacheEntries)).toBe(200);
    expect(clampSettingNumber(5, settingsNumberConstraints.workspaceQuickOpenMaxResults)).toBe(20);
    expect(clampSettingNumber(500, settingsNumberConstraints.workspaceQuickOpenMaxResults)).toBe(300);
  });

  it("resolves raw numeric setting input through configured bounds", () => {
    expect(resolveSettingsNumberInput("18", settingsNumberConstraints.editorFontSize)).toBe(18);
    expect(resolveSettingsNumberInput("999", settingsNumberConstraints.editorFontSize)).toBe(24);
    expect(resolveSettingsNumberInput("not-a-number", settingsNumberConstraints.editorFontSize)).toBeUndefined();
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

  it("resolves asset folder commits from draft input", () => {
    expect(resolveSettingsAssetFolderCommit(" media\\images ", "assets")).toEqual({
      kind: "update",
      defaultAssetFolder: "media/images"
    });
    expect(resolveSettingsAssetFolderCommit("   ", "assets")).toEqual({
      kind: "reset",
      draft: "assets"
    });
  });
});
