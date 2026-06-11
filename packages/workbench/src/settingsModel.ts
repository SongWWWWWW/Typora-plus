import {
  configurationMaxAiProviders,
  configurationMaxRemoteSyncProviders,
  clampConfigurationNumber,
  configurationBytesPerMegabyte,
  configurationNumberConstraints,
  normalizeAiProviderConfiguration,
  normalizeRemoteSyncProviderConfiguration,
  remoteSyncConfiguredRawMirrorAdapterName,
  remoteSyncConfiguredRawMirrorMetadataKeys,
  remoteSyncConfiguredRawMirrorRetryLimits,
  type AiProviderConfiguration,
  type AiProviderReasoningEffort,
  type AiProviderTextVerbosity,
  type ColorSchemePreference,
  type ConfigurationNumberConstraint,
  type RegisteredTheme,
  type RemoteSyncProviderConfiguration,
  type RemoteSyncProviderSecretConfiguration,
  type TyporaPlusConfiguration
} from "@typora-plus/platform";

export type NumberSettingConstraint = ConfigurationNumberConstraint;

export interface SettingsOption<TValue extends string> {
  readonly value: TValue;
  readonly label: string;
}

export const settingsSectionIds = {
  ai: "ai",
  appearance: "appearance",
  editor: "editor",
  remoteSync: "remoteSync",
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
  ai: {
    providers: "ai.providers",
    workspaceContextMaxPreviewLength: "ai.workspaceContextMaxPreviewLength",
    workspaceContextMaxResults: "ai.workspaceContextMaxResults"
  },
  remoteSync: {
    providers: "remoteSync.providers"
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

export interface SettingsVisibilityState {
  readonly hasResults: boolean;
  readonly visibleEntryIds: readonly SettingsEntryId[];
  readonly visibleSectionIds: readonly SettingsSectionId[];
  readonly visibleSections: readonly SettingsSectionDefinition[];
}

export interface SettingsSectionDistance {
  readonly sectionId: SettingsSectionId;
  readonly distance: number;
}

export type SettingsAssetFolderCommit =
  | { readonly kind: "update"; readonly defaultAssetFolder: string }
  | { readonly kind: "reset"; readonly draft: string };

export interface SettingsAiProviderDraft {
  readonly id: string;
  readonly title: string;
  readonly endpointUrl: string;
  readonly maxOutputTokens: string;
  readonly model: string;
  readonly reasoningEffort: "" | AiProviderReasoningEffort;
  readonly secretRef: string;
  readonly store: boolean;
  readonly textVerbosity: "" | AiProviderTextVerbosity;
}

export interface SettingsAiProviderDraftValidation {
  readonly provider?: AiProviderConfiguration;
  readonly issues: readonly string[];
  readonly canSave: boolean;
}

export interface SettingsRemoteSyncProviderDraft {
  readonly id: string;
  readonly title: string;
  readonly baseUrl: string;
  readonly remoteScopeId: string;
  readonly secretsText: string;
  readonly metadataText: string;
}

export interface SettingsRemoteSyncProviderDraftValidation {
  readonly provider?: RemoteSyncProviderConfiguration;
  readonly issues: readonly string[];
  readonly canSave: boolean;
}

export const settingsSections = [
  { id: settingsSectionIds.appearance, title: "Appearance" },
  { id: settingsSectionIds.editor, title: "Editor" },
  { id: settingsSectionIds.ai, title: "AI" },
  { id: settingsSectionIds.remoteSync, title: "Remote Sync" },
  { id: settingsSectionIds.workspace, title: "Workspace" },
  { id: settingsSectionIds.keybindings, title: "Keybindings" }
] as const satisfies readonly SettingsSectionDefinition[];

const settingsSectionById = new Map<SettingsSectionId, SettingsSectionDefinition>(
  settingsSections.map((section) => [section.id, section])
);

export const settingsColorSchemeOptions = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" }
] as const satisfies readonly SettingsOption<ColorSchemePreference>[];

export const settingsDensityOptions = [
  { value: "comfortable", label: "Comfortable" },
  { value: "compact", label: "Compact" }
] as const satisfies readonly SettingsOption<TyporaPlusConfiguration["appearance"]["density"]>[];

export const settingsAiReasoningEffortOptions = [
  { value: "", label: "Default" },
  { value: "none", label: "None" },
  { value: "minimal", label: "Minimal" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "xhigh", label: "XHigh" }
] as const satisfies readonly SettingsOption<"" | AiProviderReasoningEffort>[];

export const settingsAiTextVerbosityOptions = [
  { value: "", label: "Default" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" }
] as const satisfies readonly SettingsOption<"" | AiProviderTextVerbosity>[];

export const defaultSettingsThemeOption = {
  value: "",
  label: "Default"
} as const satisfies SettingsOption<"">;

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
  { id: settingsEntryIds.ai.providers, sectionId: settingsSectionIds.ai, label: "Providers", keywords: ["openai", "responses", "assistant", "model", "endpoint", "secret", "api key", "reasoning", "verbosity", "output tokens"] },
  { id: settingsEntryIds.ai.workspaceContextMaxResults, sectionId: settingsSectionIds.ai, label: "Context Results", keywords: ["workspace", "context", "search", "retrieval", "grounded"] },
  { id: settingsEntryIds.ai.workspaceContextMaxPreviewLength, sectionId: settingsSectionIds.ai, label: "Context Preview", keywords: ["workspace", "context", "preview", "snippet", "retrieval"] },
  { id: settingsEntryIds.remoteSync.providers, sectionId: settingsSectionIds.remoteSync, label: "Providers", keywords: ["sync", "remote", "cloud", "mirror", "native request", "scope", "secret"] },
  { id: settingsEntryIds.workspace.defaultAssetFolder, sectionId: settingsSectionIds.workspace, label: "Asset Folder", keywords: ["assets", "images", "attachments", "folder"] },
  { id: settingsEntryIds.workspace.quickOpenMaxResults, sectionId: settingsSectionIds.workspace, label: "Quick Open Results", keywords: ["quick open", "files", "results", "limit"] },
  { id: settingsEntryIds.workspace.searchMaxFileSize, sectionId: settingsSectionIds.workspace, label: "Search File Limit", keywords: ["search", "index", "file", "size", "limit"] },
  { id: settingsEntryIds.workspace.searchMaxResults, sectionId: settingsSectionIds.workspace, label: "Search Results", keywords: ["search", "results", "limit"] },
  { id: settingsEntryIds.keybindings.editor, sectionId: settingsSectionIds.keybindings, label: "Keybindings", keywords: ["keyboard", "shortcut", "shortcuts", "commands", "record", "reset"] }
] as const satisfies readonly SettingsEntryDefinition[];

const settingsEntryById = new Map<SettingsEntryId, SettingsEntryDefinition>(
  settingsEntries.map((entry) => [entry.id, entry])
);

const settingsRemoteSyncProviderInvalidIssue =
  "Complete provider id, title, HTTPS or loopback base URL, and valid profile bindings.";
const settingsRawMirrorMetadataInvalidIssue = "Complete raw mirror metadata paths and header binding.";
const settingsRawMirrorRetryInvalidIssue = "Complete raw mirror retry metadata.";

export const settingsNumberConstraints = {
  aiWorkspaceContextMaxPreviewLength: configurationNumberConstraints.aiWorkspaceContextMaxPreviewLength,
  aiWorkspaceContextMaxResults: configurationNumberConstraints.aiWorkspaceContextMaxResults,
  aiProviderMaxOutputTokens: configurationNumberConstraints.aiProviderMaxOutputTokens,
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

export function resolveSettingsNumberInput(
  rawValue: string,
  constraint: NumberSettingConstraint
): number | undefined {
  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue)
    ? clampSettingNumber(parsedValue, constraint)
    : undefined;
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

export function resolveSettingsAssetFolderCommit(
  draft: string,
  currentDefaultAssetFolder: string
): SettingsAssetFolderCommit {
  const defaultAssetFolder = normalizeAssetFolderInput(draft);

  return defaultAssetFolder
    ? { kind: "update", defaultAssetFolder }
    : { kind: "reset", draft: currentDefaultAssetFolder };
}

export function createSettingsAiProviderDraft(
  provider: AiProviderConfiguration | undefined = undefined
): SettingsAiProviderDraft {
  return {
    id: provider?.id ?? "",
    title: provider?.title ?? "",
    endpointUrl: provider?.endpointUrl ?? "",
    maxOutputTokens: provider?.maxOutputTokens?.toString() ?? "",
    model: provider?.model ?? "",
    reasoningEffort: provider?.reasoningEffort ?? "",
    secretRef: provider?.secretRef ?? "",
    store: provider?.store ?? false,
    textVerbosity: provider?.textVerbosity ?? ""
  };
}

export function validateSettingsAiProviderDraft(
  draft: SettingsAiProviderDraft,
  providers: readonly AiProviderConfiguration[],
  originalId: string | undefined = undefined
): SettingsAiProviderDraftValidation {
  const provider = normalizeSettingsAiProviderDraft(draft);
  const issues: string[] = [];

  if (!provider) {
    issues.push("Complete provider id, title, HTTPS or loopback endpoint, model, secret reference, and valid request settings.");
  } else if (providers.some((candidate) => candidate.id === provider.id && candidate.id !== originalId)) {
    issues.push("Provider id is already used.");
  }

  return {
    ...(provider ? { provider } : {}),
    issues,
    canSave: issues.length === 0 && !!provider
  };
}

export function upsertSettingsAiProvider(
  providers: readonly AiProviderConfiguration[],
  draft: SettingsAiProviderDraft,
  originalId: string | undefined = undefined
): readonly AiProviderConfiguration[] {
  const validation = validateSettingsAiProviderDraft(draft, providers, originalId);

  if (!validation.provider || !validation.canSave) {
    return providers;
  }

  const withoutOriginal = originalId
    ? providers.filter((provider) => provider.id !== originalId)
    : providers;

  if (withoutOriginal.length >= configurationMaxAiProviders && !originalId) {
    return providers;
  }

  return [...withoutOriginal, validation.provider].sort(compareSettingsAiProviders);
}

export function removeSettingsAiProvider(
  providers: readonly AiProviderConfiguration[],
  id: string
): readonly AiProviderConfiguration[] {
  return providers.filter((provider) => provider.id !== id);
}

export function canAddSettingsAiProvider(
  providers: readonly AiProviderConfiguration[]
): boolean {
  return providers.length < configurationMaxAiProviders;
}

export function createSettingsRemoteSyncProviderDraft(
  provider: RemoteSyncProviderConfiguration | undefined = undefined
): SettingsRemoteSyncProviderDraft {
  return {
    id: provider?.id ?? "",
    title: provider?.title ?? "",
    baseUrl: provider?.baseUrl ?? "",
    remoteScopeId: provider?.remoteScopeId ?? "",
    secretsText: formatSettingsKeyValueLines(provider?.secrets.map((secret) => [secret.name, secret.secretRef]) ?? []),
    metadataText: formatSettingsKeyValueLines(Object.entries(provider?.metadata ?? {}))
  };
}

export function validateSettingsRemoteSyncProviderDraft(
  draft: SettingsRemoteSyncProviderDraft,
  providers: readonly RemoteSyncProviderConfiguration[],
  originalId: string | undefined = undefined
): SettingsRemoteSyncProviderDraftValidation {
  const provider = normalizeSettingsRemoteSyncProviderDraft(draft);
  const issues: string[] = [];

  if (!provider) {
    issues.push(settingsRemoteSyncProviderInvalidIssue);
  } else {
    if (providers.some((candidate) => candidate.id === provider.id && candidate.id !== originalId)) {
      issues.push("Provider id is already used.");
    }

    const rawMirrorIssue = getSettingsRawMirrorMetadataIssue(provider);
    if (rawMirrorIssue) {
      issues.push(rawMirrorIssue);
    }
  }

  return {
    ...(provider ? { provider } : {}),
    issues,
    canSave: issues.length === 0 && !!provider
  };
}

export function upsertSettingsRemoteSyncProvider(
  providers: readonly RemoteSyncProviderConfiguration[],
  draft: SettingsRemoteSyncProviderDraft,
  originalId: string | undefined = undefined
): readonly RemoteSyncProviderConfiguration[] {
  const validation = validateSettingsRemoteSyncProviderDraft(draft, providers, originalId);

  if (!validation.provider || !validation.canSave) {
    return providers;
  }

  const withoutOriginal = originalId
    ? providers.filter((provider) => provider.id !== originalId)
    : providers;

  if (withoutOriginal.length >= configurationMaxRemoteSyncProviders && !originalId) {
    return providers;
  }

  return [...withoutOriginal, validation.provider].sort(compareSettingsRemoteSyncProviders);
}

export function removeSettingsRemoteSyncProvider(
  providers: readonly RemoteSyncProviderConfiguration[],
  id: string
): readonly RemoteSyncProviderConfiguration[] {
  return providers.filter((provider) => provider.id !== id);
}

export function canAddSettingsRemoteSyncProvider(
  providers: readonly RemoteSyncProviderConfiguration[]
): boolean {
  return providers.length < configurationMaxRemoteSyncProviders;
}

export function settingSectionAnchorId(sectionId: SettingsSectionId): string {
  return `tp-settings-section-${sectionId}`;
}

export function getSettingsSectionDefinition(sectionId: SettingsSectionId): SettingsSectionDefinition {
  const section = settingsSectionById.get(sectionId);
  if (!section) {
    throw new Error(`Unknown settings section: ${sectionId}`);
  }
  return section;
}

export function getSettingsSectionTitle(sectionId: SettingsSectionId): string {
  return getSettingsSectionDefinition(sectionId).title;
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

export function createSettingsThemeOptions(
  themes: readonly Pick<RegisteredTheme, "colorScheme" | "id" | "label">[]
): readonly SettingsOption<string>[] {
  return [
    defaultSettingsThemeOption,
    ...themes.map((theme) => ({
      value: theme.id,
      label: formatSettingsThemeOptionLabel(theme)
    }))
  ];
}

export function resolveSelectedSettingsThemeId(
  themeId: string | undefined,
  themes: readonly Pick<RegisteredTheme, "id">[]
): string {
  return themeId && themes.some((theme) => theme.id === themeId)
    ? themeId
    : defaultSettingsThemeOption.value;
}

export function formatSettingsThemeOptionLabel(theme: Pick<RegisteredTheme, "colorScheme" | "label">): string {
  return theme.colorScheme ? `${theme.label} (${theme.colorScheme})` : theme.label;
}

export function resolveVisibleSettingsSection(
  activeSection: SettingsSectionId,
  visibleSections: readonly SettingsSectionId[]
): SettingsSectionId {
  return visibleSections.includes(activeSection)
    ? activeSection
    : visibleSections[0] ?? activeSection;
}

export function resolveNearestSettingsSection(
  activeSection: SettingsSectionId,
  distances: readonly SettingsSectionDistance[]
): SettingsSectionId {
  let nearestSection = activeSection;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const { sectionId, distance } of distances) {
    if (Number.isFinite(distance) && distance < nearestDistance) {
      nearestSection = sectionId;
      nearestDistance = distance;
    }
  }

  return nearestSection;
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

export function createSettingsVisibilityState(searchResult: SettingsSearchResult): SettingsVisibilityState {
  return {
    hasResults: searchResult.visibleSections.length > 0,
    visibleEntryIds: searchResult.visibleEntries,
    visibleSectionIds: searchResult.visibleSections,
    visibleSections: settingsSections.filter((section) => searchResult.visibleSections.includes(section.id))
  };
}

export function isSettingsSectionVisible(
  visibility: SettingsVisibilityState,
  sectionId: SettingsSectionId
): boolean {
  return visibility.visibleSectionIds.includes(sectionId);
}

export function isSettingsEntryVisible(
  visibility: SettingsVisibilityState,
  entryId: SettingsEntryId
): boolean {
  return visibility.visibleEntryIds.includes(entryId);
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

function normalizeSettingsAiProviderDraft(draft: SettingsAiProviderDraft): AiProviderConfiguration | undefined {
  const maxOutputTokens = parseSettingsOptionalPositiveInteger(draft.maxOutputTokens);

  if (!maxOutputTokens.valid) {
    return undefined;
  }

  return normalizeAiProviderConfiguration({
    id: draft.id,
    title: draft.title,
    kind: "responses",
    endpointUrl: draft.endpointUrl,
    ...(maxOutputTokens.value !== undefined ? { maxOutputTokens: maxOutputTokens.value } : {}),
    model: draft.model,
    ...(draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {}),
    secretRef: draft.secretRef,
    store: draft.store,
    ...(draft.textVerbosity ? { textVerbosity: draft.textVerbosity } : {})
  });
}

function normalizeSettingsRemoteSyncProviderDraft(
  draft: SettingsRemoteSyncProviderDraft
): RemoteSyncProviderConfiguration | undefined {
  const secretLines = parseSettingsKeyValueLines(draft.secretsText);
  const metadataLines = parseSettingsKeyValueLines(draft.metadataText);

  if (!secretLines || !metadataLines) {
    return undefined;
  }

  return normalizeRemoteSyncProviderConfiguration({
    id: draft.id,
    title: draft.title,
    kind: "native-request",
    baseUrl: draft.baseUrl,
    remoteScopeId: draft.remoteScopeId || undefined,
    secrets: secretLines.map(([name, secretRef]): RemoteSyncProviderSecretConfiguration => ({ name, secretRef })),
    metadata: Object.fromEntries(metadataLines)
  });
}

function getSettingsRawMirrorMetadataIssue(
  provider: RemoteSyncProviderConfiguration
): string | undefined {
  const metadata = provider.metadata ?? {};

  if (
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.adapter] !== remoteSyncConfiguredRawMirrorAdapterName
  ) {
    return undefined;
  }

  if (
    !isSettingsRawMirrorMetadataPath(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.listPath]) ||
    !isSettingsRawMirrorMetadataPath(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath]) ||
    !isSettingsRawMirrorMetadataPath(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath]) ||
    !isSettingsRawMirrorMetadataPath(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.deletePath]) ||
    !isSettingsRawMirrorHeaderMetadataComplete(provider, metadata)
  ) {
    return settingsRawMirrorMetadataInvalidIssue;
  }

  if (!isSettingsRawMirrorRetryMetadataComplete(metadata)) {
    return settingsRawMirrorRetryInvalidIssue;
  }

  return undefined;
}

function isSettingsRawMirrorMetadataPath(value: unknown): boolean {
  const normalized = normalizeSettingsRawMirrorMetadataValue(value);

  if (!normalized) {
    return false;
  }

  return !(
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    /[?#]/.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    hasSettingsRawMirrorParentTraversal(normalized)
  );
}

function isSettingsRawMirrorHeaderMetadataComplete(
  provider: RemoteSyncProviderConfiguration,
  metadata: Readonly<Record<string, string>>
): boolean {
  const binding = normalizeSettingsRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]
  );
  const name = normalizeSettingsRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerName]
  );
  const scheme = normalizeSettingsRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]
  );

  if (!binding && !name && !scheme) {
    return true;
  }

  return !!binding &&
    !!name &&
    isSettingsRawMirrorHeaderName(name) &&
    isSettingsRawMirrorHeaderScheme(scheme) &&
    provider.secrets.some((secret) => secret.name === binding);
}

function normalizeSettingsRawMirrorMetadataValue(value: unknown): string | undefined {
  return typeof value === "string" ? value.trim() || undefined : undefined;
}

function isSettingsRawMirrorHeaderName(value: string): boolean {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value);
}

function isSettingsRawMirrorHeaderScheme(value: string | undefined): boolean {
  return value === undefined || (value.length <= 128 && !/[\r\n]/.test(value));
}

function isSettingsRawMirrorRetryMetadataComplete(metadata: Readonly<Record<string, string>>): boolean {
  const statusCodes = normalizeSettingsRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]
  );
  const maxRetries = normalizeSettingsRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]
  );
  const delayMs = normalizeSettingsRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs]
  );

  if (!statusCodes && !maxRetries && !delayMs) {
    return true;
  }

  return !!statusCodes &&
    isSettingsRawMirrorRetryStatusCodes(statusCodes) &&
    isSettingsRawMirrorOptionalInteger(maxRetries, 0, remoteSyncConfiguredRawMirrorRetryLimits.maxRetries) &&
    isSettingsRawMirrorOptionalInteger(delayMs, 0, remoteSyncConfiguredRawMirrorRetryLimits.maxDelayMs);
}

function isSettingsRawMirrorRetryStatusCodes(value: string): boolean {
  const statusCodes = new Set<number>();

  for (const part of value.split(/[\s,]+/)) {
    if (!part) {
      continue;
    }

    const statusCode = Number(part);

    if (
      !Number.isInteger(statusCode) ||
      statusCode < 400 ||
      statusCode > 599 ||
      statusCodes.size >= remoteSyncConfiguredRawMirrorRetryLimits.maxStatusCodes
    ) {
      return false;
    }

    statusCodes.add(statusCode);
  }

  return statusCodes.size > 0;
}

function isSettingsRawMirrorOptionalInteger(
  value: string | undefined,
  min: number,
  max: number
): boolean {
  if (value === undefined) {
    return true;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) && parsed >= min && parsed <= max;
}

function hasSettingsRawMirrorParentTraversal(path: string): boolean {
  return path.split("/").some((segment) => {
    if (segment === "..") {
      return true;
    }

    try {
      return decodeURIComponent(segment) === "..";
    } catch {
      return false;
    }
  });
}

function compareSettingsAiProviders(
  left: AiProviderConfiguration,
  right: AiProviderConfiguration
): number {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function compareSettingsRemoteSyncProviders(
  left: RemoteSyncProviderConfiguration,
  right: RemoteSyncProviderConfiguration
): number {
  return left.title.localeCompare(right.title) || left.id.localeCompare(right.id);
}

function parseSettingsKeyValueLines(value: string): readonly (readonly [string, string])[] | undefined {
  const entries: (readonly [string, string])[] = [];

  for (const rawLine of value.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex <= 0 || separatorIndex === line.length - 1) {
      return undefined;
    }

    const key = line.slice(0, separatorIndex).trim();
    const entryValue = line.slice(separatorIndex + 1).trim();

    if (!key || !entryValue) {
      return undefined;
    }

    entries.push([key, entryValue]);
  }

  return entries;
}

function parseSettingsOptionalPositiveInteger(value: string): {
  readonly valid: boolean;
  readonly value?: number;
} {
  const normalized = value.trim();

  if (!normalized) {
    return { valid: true };
  }

  const parsed = Number(normalized);

  return Number.isInteger(parsed) && parsed > 0
    ? { valid: true, value: parsed }
    : { valid: false };
}

function formatSettingsKeyValueLines(entries: readonly (readonly [string, string])[]): string {
  return entries.map(([key, value]) => `${key}=${value}`).join("\n");
}
