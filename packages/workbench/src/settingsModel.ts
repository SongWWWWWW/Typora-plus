import {
  clampConfigurationNumber,
  configurationBytesPerMegabyte,
  configurationNumberConstraints,
  type ColorSchemePreference,
  type ConfigurationNumberConstraint,
  type TyporaPlusConfiguration
} from "@typora-plus/platform";

export type NumberSettingConstraint = ConfigurationNumberConstraint;

export interface SettingsOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

export const settingsSectionIds = {
  appearance: "appearance",
  editor: "editor",
  workspace: "workspace",
  keybindings: "keybindings"
} as const satisfies Record<string, string>;

export type SettingsSectionId = typeof settingsSectionIds[keyof typeof settingsSectionIds];

export const settingsEntryIds = {
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
} as const satisfies Record<string, Record<string, string>>;

type SettingsEntryGroups = typeof settingsEntryIds;

export type SettingsEntryId = {
  [Group in keyof SettingsEntryGroups]: SettingsEntryGroups[Group][keyof SettingsEntryGroups[Group]];
}[keyof SettingsEntryGroups];

export const defaultSettingsSectionId: SettingsSectionId = settingsSectionIds.appearance;

export interface SettingsSectionDefinition {
  readonly id: SettingsSectionId;
  readonly title: string;
}

export interface SettingsEntryDefinition {
  readonly id: SettingsEntryId;
  readonly sectionId: SettingsSectionId;
  readonly label: string;
  readonly keywords?: readonly string[];
}

export interface SettingsSearchResult {
  readonly query: string;
  readonly visibleEntries: readonly SettingsEntryId[];
  readonly visibleSections: readonly SettingsSectionId[];
}

export const settingsSections = [
  { id: settingsSectionIds.appearance, title: "Appearance" },
  { id: settingsSectionIds.editor, title: "Editor" },
  { id: settingsSectionIds.workspace, title: "Workspace" },
  { id: settingsSectionIds.keybindings, title: "Keybindings" }
] as const satisfies readonly SettingsSectionDefinition[];

export const settingsColorSchemeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
] as const satisfies readonly SettingsOption<ColorSchemePreference>[];

export const settingsDensityOptions = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" }
] as const satisfies readonly SettingsOption<TyporaPlusConfiguration["appearance"]["density"]>[];

export const settingsEntries = [
  { id: settingsEntryIds.appearance.theme, sectionId: settingsSectionIds.appearance, label: "Theme", keywords: ["color scheme", "system", "light", "dark"] },
  { id: settingsEntryIds.appearance.customTheme, sectionId: settingsSectionIds.appearance, label: "Custom Theme", keywords: ["theme", "extension", "custom", "tokens"] },
  { id: settingsEntryIds.appearance.density, sectionId: settingsSectionIds.appearance, label: "Density", keywords: ["comfortable", "compact"] },
  { id: settingsEntryIds.editor.autoSave, sectionId: settingsSectionIds.editor, label: "Auto Save", keywords: ["autosave", "save"] },
  { id: settingsEntryIds.editor.autoSaveDelay, sectionId: settingsSectionIds.editor, label: "Auto Save Delay", keywords: ["autosave", "save", "delay", "debounce", "milliseconds"] },
  { id: settingsEntryIds.editor.focusMode, sectionId: settingsSectionIds.editor, label: "Focus Mode", keywords: ["focus", "distraction"] },
  { id: settingsEntryIds.editor.typewriterMode, sectionId: settingsSectionIds.editor, label: "Typewriter Mode", keywords: ["typewriter", "cursor"] },
  { id: settingsEntryIds.editor.fontSize, sectionId: settingsSectionIds.editor, label: "Font Size", keywords: ["font", "text", "size"] },
  { id: settingsEntryIds.editor.lineHeight, sectionId: settingsSectionIds.editor, label: "Line Height", keywords: ["line", "spacing"] },
  { id: settingsEntryIds.editor.maxWidth, sectionId: settingsSectionIds.editor, label: "Editor Width", keywords: ["width", "content"] },
  { id: settingsEntryIds.editor.rendererPreviewCacheEntries, sectionId: settingsSectionIds.editor, label: "Renderer Cache", keywords: ["preview", "renderer", "cache", "mermaid"] },
  { id: settingsEntryIds.workspace.defaultAssetFolder, sectionId: settingsSectionIds.workspace, label: "Asset Folder", keywords: ["assets", "images", "attachments", "folder"] },
  { id: settingsEntryIds.workspace.quickOpenMaxResults, sectionId: settingsSectionIds.workspace, label: "Quick Open Results", keywords: ["quick open", "files", "results", "limit"] },
  { id: settingsEntryIds.workspace.searchMaxFileSize, sectionId: settingsSectionIds.workspace, label: "Search File Limit", keywords: ["search", "index", "file", "size", "limit"] },
  { id: settingsEntryIds.workspace.searchMaxResults, sectionId: settingsSectionIds.workspace, label: "Search Results", keywords: ["search", "results", "limit"] },
  { id: settingsEntryIds.keybindings.editor, sectionId: settingsSectionIds.keybindings, label: "Keybindings", keywords: ["keyboard", "shortcut", "shortcuts", "commands", "record", "reset"] }
] as const satisfies readonly SettingsEntryDefinition[];

const settingsEntryById = new Map<SettingsEntryId, SettingsEntryDefinition>(
  settingsEntries.map((entry) => [entry.id, entry])
);

export const settingsNumberConstraints = {
  editorFontSize: configurationNumberConstraints.editorFontSize,
  editorLineHeight: configurationNumberConstraints.editorLineHeight,
  editorMaxWidth: configurationNumberConstraints.editorMaxWidth,
  editorAutoSaveDelayMs: configurationNumberConstraints.editorAutoSaveDelayMs,
  editorRendererPreviewCacheEntries: configurationNumberConstraints.editorRendererPreviewCacheEntries,
  workspaceSearchMaxFileSizeMegabytes: {
    min: configurationNumberConstraints.workspaceSearchMaxFileSizeBytes.min / configurationBytesPerMegabyte,
    max: configurationNumberConstraints.workspaceSearchMaxFileSizeBytes.max / configurationBytesPerMegabyte,
    step: configurationNumberConstraints.workspaceSearchMaxFileSizeBytes.step / configurationBytesPerMegabyte
  },
  workspaceQuickOpenMaxResults: configurationNumberConstraints.workspaceQuickOpenMaxResults,
  workspaceSearchMaxResults: configurationNumberConstraints.workspaceSearchMaxResults
} as const satisfies Record<string, NumberSettingConstraint>;

export function clampSettingNumber(value: number, constraint: NumberSettingConstraint): number {
  return clampConfigurationNumber(value, constraint);
}

export function megabytesToBytes(value: number): number {
  return Math.round(
    clampSettingNumber(value, settingsNumberConstraints.workspaceSearchMaxFileSizeMegabytes) * configurationBytesPerMegabyte
  );
}

export function bytesToMegabytes(value: number): number {
  return clampSettingNumber(
    value / configurationBytesPerMegabyte,
    settingsNumberConstraints.workspaceSearchMaxFileSizeMegabytes
  );
}

export function normalizeAssetFolderInput(value: string): string | undefined {
  const normalized = value.trim().replace(/\\/g, "/");
  return normalized.length > 0 ? normalized : undefined;
}

export function settingSectionAnchorId(sectionId: SettingsSectionId): string {
  return `tp-settings-section-${sectionId}`;
}

export function getSettingsEntryDefinition(entryId: SettingsEntryId): SettingsEntryDefinition {
  const entry = settingsEntryById.get(entryId);
  if (!entry) {
    throw new Error(`Unknown settings entry: ${entryId}`);
  }
  return entry;
}

export function getSettingsEntryLabel(entryId: SettingsEntryId): string {
  return getSettingsEntryDefinition(entryId).label;
}

export function createSettingsSearchResult(query: string): SettingsSearchResult {
  const terms = normalizeSettingsSearchTerms(query);

  if (terms.length === 0) {
    return {
      query: "",
      visibleEntries: settingsEntries.map((entry) => entry.id),
      visibleSections: settingsSections.map((section) => section.id)
    };
  }

  const visibleEntries = settingsEntries
    .filter((entry) => {
      const section = settingsSections.find((candidate) => candidate.id === entry.sectionId);
      return matchesTerms(section?.title ?? "", terms) || matchesSettingsEntry(entry, terms);
    })
    .map((entry) => entry.id);
  const visibleSectionSet = new Set(
    settingsEntries
      .filter((entry) => visibleEntries.includes(entry.id))
      .map((entry) => entry.sectionId)
  );

  return {
    query: terms.join(" "),
    visibleEntries,
    visibleSections: settingsSections
      .map((section) => section.id)
      .filter((sectionId) => visibleSectionSet.has(sectionId))
  };
}

function normalizeSettingsSearchTerms(query: string): readonly string[] {
  return query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter((term) => term.length > 0);
}

function matchesSettingsEntry(entry: SettingsEntryDefinition, terms: readonly string[]): boolean {
  const haystack = [
    entry.id,
    entry.label,
    ...(entry.keywords ?? [])
  ].join(" ").toLowerCase();

  return matchesTerms(haystack, terms);
}

function matchesTerms(haystack: string, terms: readonly string[]): boolean {
  const normalizedHaystack = haystack.toLowerCase();
  return terms.every((term) => normalizedHaystack.includes(term));
}
