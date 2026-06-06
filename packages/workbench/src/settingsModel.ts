import {
  clampConfigurationNumber,
  configurationBytesPerMegabyte,
  configurationNumberConstraints,
  type ConfigurationNumberConstraint
} from "@typora-plus/platform";

export type NumberSettingConstraint = ConfigurationNumberConstraint;

export type SettingsSectionId = "appearance" | "editor" | "workspace" | "keybindings";
export type SettingsEntryId =
  | "appearance.theme"
  | "appearance.density"
  | "editor.autoSave"
  | "editor.autoSaveDelay"
  | "editor.focusMode"
  | "editor.typewriterMode"
  | "editor.fontSize"
  | "editor.lineHeight"
  | "editor.maxWidth"
  | "workspace.defaultAssetFolder"
  | "workspace.searchMaxFileSize"
  | "workspace.searchMaxResults"
  | "keybindings.editor";

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
  { id: "appearance", title: "Appearance" },
  { id: "editor", title: "Editor" },
  { id: "workspace", title: "Workspace" },
  { id: "keybindings", title: "Keybindings" }
] as const satisfies readonly SettingsSectionDefinition[];

export const settingsEntries = [
  { id: "appearance.theme", sectionId: "appearance", label: "Theme", keywords: ["color scheme", "system", "light", "dark"] },
  { id: "appearance.density", sectionId: "appearance", label: "Density", keywords: ["comfortable", "compact"] },
  { id: "editor.autoSave", sectionId: "editor", label: "Auto Save", keywords: ["autosave", "save"] },
  { id: "editor.autoSaveDelay", sectionId: "editor", label: "Auto Save Delay", keywords: ["autosave", "save", "delay", "debounce", "milliseconds"] },
  { id: "editor.focusMode", sectionId: "editor", label: "Focus Mode", keywords: ["focus", "distraction"] },
  { id: "editor.typewriterMode", sectionId: "editor", label: "Typewriter Mode", keywords: ["typewriter", "cursor"] },
  { id: "editor.fontSize", sectionId: "editor", label: "Font Size", keywords: ["font", "text", "size"] },
  { id: "editor.lineHeight", sectionId: "editor", label: "Line Height", keywords: ["line", "spacing"] },
  { id: "editor.maxWidth", sectionId: "editor", label: "Editor Width", keywords: ["width", "content"] },
  { id: "workspace.defaultAssetFolder", sectionId: "workspace", label: "Asset Folder", keywords: ["assets", "images", "attachments", "folder"] },
  { id: "workspace.searchMaxFileSize", sectionId: "workspace", label: "Search File Limit", keywords: ["search", "index", "file", "size", "limit"] },
  { id: "workspace.searchMaxResults", sectionId: "workspace", label: "Search Results", keywords: ["search", "results", "limit"] },
  { id: "keybindings.editor", sectionId: "keybindings", label: "Keybindings", keywords: ["keyboard", "shortcut", "shortcuts", "commands", "record", "reset"] }
] as const satisfies readonly SettingsEntryDefinition[];

export const settingsNumberConstraints = {
  editorFontSize: configurationNumberConstraints.editorFontSize,
  editorLineHeight: configurationNumberConstraints.editorLineHeight,
  editorMaxWidth: configurationNumberConstraints.editorMaxWidth,
  editorAutoSaveDelayMs: configurationNumberConstraints.editorAutoSaveDelayMs,
  workspaceSearchMaxFileSizeMegabytes: {
    min: configurationNumberConstraints.workspaceSearchMaxFileSizeBytes.min / configurationBytesPerMegabyte,
    max: configurationNumberConstraints.workspaceSearchMaxFileSizeBytes.max / configurationBytesPerMegabyte,
    step: configurationNumberConstraints.workspaceSearchMaxFileSizeBytes.step / configurationBytesPerMegabyte
  },
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
