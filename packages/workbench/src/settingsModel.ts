export interface NumberSettingConstraint {
  readonly min: number;
  readonly max: number;
  readonly step: number;
}

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
  editorFontSize: { min: 13, max: 24, step: 1 },
  editorLineHeight: { min: 1.2, max: 2.2, step: 0.05 },
  editorMaxWidth: { min: 560, max: 1120, step: 20 },
  editorAutoSaveDelayMs: { min: 250, max: 5000, step: 250 },
  workspaceSearchMaxFileSizeMegabytes: { min: 1, max: 20, step: 1 },
  workspaceSearchMaxResults: { min: 20, max: 500, step: 10 }
} as const satisfies Record<string, NumberSettingConstraint>;

const bytesPerMegabyte = 1024 * 1024;

export function clampSettingNumber(value: number, constraint: NumberSettingConstraint): number {
  if (!Number.isFinite(value)) {
    return constraint.min;
  }

  const clamped = Math.min(Math.max(value, constraint.min), constraint.max);
  return Number(clamped.toFixed(stepPrecision(constraint.step)));
}

export function megabytesToBytes(value: number): number {
  return Math.round(
    clampSettingNumber(value, settingsNumberConstraints.workspaceSearchMaxFileSizeMegabytes) * bytesPerMegabyte
  );
}

export function bytesToMegabytes(value: number): number {
  return clampSettingNumber(
    value / bytesPerMegabyte,
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

function stepPrecision(step: number): number {
  const decimal = step.toString().split(".")[1];
  return decimal?.length ?? 0;
}
