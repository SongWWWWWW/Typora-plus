import {
  configurationMaxAiProviders,
  configurationMaxRemoteSyncProviders,
  clampConfigurationNumber,
  configurationBytesPerMegabyte,
  configurationNumberConstraints,
  diagnoseRemoteSyncConfiguredRawMirrorMetadata,
  normalizeAiProviderConfiguration,
  normalizeRemoteSyncProviderConfiguration,
  remoteSyncConfiguredRawMirrorAdapterName,
  remoteSyncConfiguredRawMirrorMetadataIssueCodes,
  remoteSyncConfiguredRawMirrorMetadataKeys,
  type AiProviderConfiguration,
  type AiProviderReasoningEffort,
  type AiProviderTextVerbosity,
  type ColorSchemePreference,
  type ConfigurationNumberConstraint,
  type RegisteredTheme,
  type RemoteSyncProviderConfiguration,
  type RemoteSyncProviderSecretConfiguration,
  type TyporaPlusLocale,
  type TyporaPlusConfiguration,
  typoraPlusLocales
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
    density: "appearance.density",
    language: "appearance.language"
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

export interface SettingsEntryLocalization {
  readonly label?: string;
  readonly keywords?: readonly string[];
}

export interface SettingsLocalization {
  readonly sections?: Partial<Record<SettingsSectionId, string>>;
  readonly entries?: Partial<Record<SettingsEntryId, SettingsEntryLocalization>>;
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
  readonly issues: readonly SettingsValidationIssueCode[];
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
  readonly issues: readonly SettingsValidationIssueCode[];
  readonly canSave: boolean;
}

export interface SettingsRawMirrorMetadataDraft {
  readonly enabled: boolean;
  readonly listPath: string;
  readonly listPageSize: string;
  readonly deleteMissing: boolean;
  readonly uploadPath: string;
  readonly downloadPath: string;
  readonly deletePath: string;
  readonly headerBinding: string;
  readonly headerName: string;
  readonly headerScheme: string;
  readonly retryStatusCodes: string;
  readonly retryMaxRetries: string;
  readonly retryDelayMs: string;
}

export const settingsLarkRawMirrorProviderDefaults = {
  baseUrl: "http://127.0.0.1:41573/",
  id: "lark.raw-mirror",
  listPath: "mirror/list",
  title: "Lark Raw Mirror",
  uploadPath: "mirror/upload",
  downloadPath: "mirror/download",
  deletePath: "mirror/delete"
} as const;

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

const settingsLocaleOptionLabels = {
  en: "English",
  "zh-CN": "Chinese"
} as const satisfies Record<TyporaPlusLocale, string>;

export const settingsLocaleOptions = typoraPlusLocales.map((value) => ({
  value,
  label: settingsLocaleOptionLabels[value]
})) satisfies readonly SettingsOption<TyporaPlusLocale>[];

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
  { id: settingsEntryIds.appearance.language, sectionId: settingsSectionIds.appearance, label: "Language", keywords: ["locale", "english", "chinese", "translation"] },
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
  { id: settingsEntryIds.remoteSync.providers, sectionId: settingsSectionIds.remoteSync, label: "Providers", keywords: ["sync", "remote", "cloud", "mirror", "native request", "scope", "secret", "lark", "feishu", "authorization"] },
  { id: settingsEntryIds.workspace.defaultAssetFolder, sectionId: settingsSectionIds.workspace, label: "Asset Folder", keywords: ["assets", "images", "attachments", "folder"] },
  { id: settingsEntryIds.workspace.quickOpenMaxResults, sectionId: settingsSectionIds.workspace, label: "Quick Open Results", keywords: ["quick open", "files", "results", "limit"] },
  { id: settingsEntryIds.workspace.searchMaxFileSize, sectionId: settingsSectionIds.workspace, label: "Search File Limit", keywords: ["search", "index", "file", "size", "limit"] },
  { id: settingsEntryIds.workspace.searchMaxResults, sectionId: settingsSectionIds.workspace, label: "Search Results", keywords: ["search", "results", "limit"] },
  { id: settingsEntryIds.keybindings.editor, sectionId: settingsSectionIds.keybindings, label: "Keybindings", keywords: ["keyboard", "shortcut", "shortcuts", "commands", "record", "reset"] }
] as const satisfies readonly SettingsEntryDefinition[];

const settingsEntryById = new Map<SettingsEntryId, SettingsEntryDefinition>(
  settingsEntries.map((entry) => [entry.id, entry])
);

export const settingsValidationIssueCodes = {
  aiProviderInvalid: "aiProviderInvalid",
  providerIdDuplicate: "providerIdDuplicate",
  rawMirrorDeleteInvalid: "rawMirrorDeleteInvalid",
  rawMirrorListInvalid: "rawMirrorListInvalid",
  rawMirrorMetadataInvalid: "rawMirrorMetadataInvalid",
  rawMirrorRetryInvalid: "rawMirrorRetryInvalid",
  remoteSyncProviderInvalid: "remoteSyncProviderInvalid"
} as const satisfies Record<string, string>;

export type SettingsValidationIssueCode =
  typeof settingsValidationIssueCodes[keyof typeof settingsValidationIssueCodes];

const settingsRawMirrorMetadataKeyOrder = [
  remoteSyncConfiguredRawMirrorMetadataKeys.adapter,
  remoteSyncConfiguredRawMirrorMetadataKeys.listPath,
  remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize,
  remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath,
  remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath,
  remoteSyncConfiguredRawMirrorMetadataKeys.deletePath,
  remoteSyncConfiguredRawMirrorMetadataKeys.deleteMissing,
  remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding,
  remoteSyncConfiguredRawMirrorMetadataKeys.headerName,
  remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme,
  remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes,
  remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries,
  remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs
] as const satisfies readonly string[];

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
  const issues: SettingsValidationIssueCode[] = [];

  if (!provider) {
    issues.push(settingsValidationIssueCodes.aiProviderInvalid);
  } else if (providers.some((candidate) => candidate.id === provider.id && candidate.id !== originalId)) {
    issues.push(settingsValidationIssueCodes.providerIdDuplicate);
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

export function createSettingsLarkRawMirrorProviderDraft(
  usedIds: readonly string[] = []
): SettingsRemoteSyncProviderDraft {
  const id = createUniqueSettingsProviderId(settingsLarkRawMirrorProviderDefaults.id, usedIds);
  const draft = createSettingsRemoteSyncProviderDraft({
    id,
    title: id === settingsLarkRawMirrorProviderDefaults.id
      ? settingsLarkRawMirrorProviderDefaults.title
      : `${settingsLarkRawMirrorProviderDefaults.title} ${id.slice(settingsLarkRawMirrorProviderDefaults.id.length + 1)}`,
    kind: "native-request",
    baseUrl: settingsLarkRawMirrorProviderDefaults.baseUrl,
    secrets: [],
    metadata: {}
  });

  return applySettingsRawMirrorMetadataDraft(draft, {
    enabled: true,
    listPath: settingsLarkRawMirrorProviderDefaults.listPath,
    listPageSize: "",
    deleteMissing: false,
    uploadPath: settingsLarkRawMirrorProviderDefaults.uploadPath,
    downloadPath: settingsLarkRawMirrorProviderDefaults.downloadPath,
    deletePath: settingsLarkRawMirrorProviderDefaults.deletePath,
    headerBinding: "",
    headerName: "",
    headerScheme: "",
    retryStatusCodes: "",
    retryMaxRetries: "",
    retryDelayMs: ""
  });
}

export function validateSettingsRemoteSyncProviderDraft(
  draft: SettingsRemoteSyncProviderDraft,
  providers: readonly RemoteSyncProviderConfiguration[],
  originalId: string | undefined = undefined
): SettingsRemoteSyncProviderDraftValidation {
  const provider = normalizeSettingsRemoteSyncProviderDraft(draft);
  const issues: SettingsValidationIssueCode[] = [];

  if (!provider) {
    issues.push(settingsValidationIssueCodes.remoteSyncProviderInvalid);
  } else {
    if (providers.some((candidate) => candidate.id === provider.id && candidate.id !== originalId)) {
      issues.push(settingsValidationIssueCodes.providerIdDuplicate);
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

export function createSettingsRawMirrorMetadataDraft(
  draft: SettingsRemoteSyncProviderDraft
): SettingsRawMirrorMetadataDraft {
  const metadata = readSettingsMetadataText(draft.metadataText);
  const enabled = metadata[remoteSyncConfiguredRawMirrorMetadataKeys.adapter] ===
    remoteSyncConfiguredRawMirrorAdapterName;

  return {
    enabled,
    listPath: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.listPath] ?? "",
    listPageSize: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize] ?? "",
    deleteMissing: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.deleteMissing]?.toLowerCase() === "true",
    uploadPath: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath] ?? "",
    downloadPath: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath] ?? "",
    deletePath: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.deletePath] ?? "",
    headerBinding: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding] ?? "",
    headerName: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerName] ?? "",
    headerScheme: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme] ?? "",
    retryStatusCodes: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes] ?? "",
    retryMaxRetries: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries] ?? "",
    retryDelayMs: metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs] ?? ""
  };
}

export function isSettingsLarkRawMirrorProviderDraft(
  draft: SettingsRemoteSyncProviderDraft
): boolean {
  const rawMirrorDraft = createSettingsRawMirrorMetadataDraft(draft);

  if (!rawMirrorDraft.enabled) {
    return false;
  }

  const searchText = `${draft.id} ${draft.title} ${draft.baseUrl}`.toLowerCase();
  const hasLarkIdentity = searchText.includes("lark") || searchText.includes("feishu");
  const hasLarkGatewayPaths =
    rawMirrorDraft.listPath === settingsLarkRawMirrorProviderDefaults.listPath &&
    rawMirrorDraft.uploadPath === settingsLarkRawMirrorProviderDefaults.uploadPath &&
    rawMirrorDraft.downloadPath === settingsLarkRawMirrorProviderDefaults.downloadPath &&
    rawMirrorDraft.deletePath === settingsLarkRawMirrorProviderDefaults.deletePath;

  return hasLarkIdentity || hasLarkGatewayPaths;
}

export function applySettingsRawMirrorMetadataDraft(
  providerDraft: SettingsRemoteSyncProviderDraft,
  rawMirrorDraft: SettingsRawMirrorMetadataDraft
): SettingsRemoteSyncProviderDraft {
  const metadataLines = parseSettingsKeyValueLines(providerDraft.metadataText);

  if (!metadataLines) {
    return providerDraft;
  }

  const metadata = new Map(metadataLines);

  for (const key of settingsRawMirrorMetadataKeyOrder) {
    metadata.delete(key);
  }

  if (rawMirrorDraft.enabled) {
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.adapter,
      remoteSyncConfiguredRawMirrorAdapterName
    );
    applySettingsMetadataValue(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.listPath, rawMirrorDraft.listPath);
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize,
      rawMirrorDraft.listPageSize
    );
    applySettingsMetadataValue(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath, rawMirrorDraft.uploadPath);
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath,
      rawMirrorDraft.downloadPath
    );
    applySettingsMetadataValue(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.deletePath, rawMirrorDraft.deletePath);
    if (rawMirrorDraft.deleteMissing) {
      applySettingsMetadataValue(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.deleteMissing, "true");
    }
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding,
      rawMirrorDraft.headerBinding
    );
    applySettingsMetadataValue(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.headerName, rawMirrorDraft.headerName);
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme,
      rawMirrorDraft.headerScheme
    );
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes,
      rawMirrorDraft.retryStatusCodes
    );
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries,
      rawMirrorDraft.retryMaxRetries
    );
    applySettingsMetadataValue(
      metadata,
      remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs,
      rawMirrorDraft.retryDelayMs
    );
  }

  return {
    ...providerDraft,
    metadataText: formatSettingsRawMirrorMetadataLines(metadata)
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

export function getSettingsSectionDefinition(
  sectionId: SettingsSectionId,
  localization?: SettingsLocalization
): SettingsSectionDefinition {
  const section = settingsSectionById.get(sectionId);
  if (!section) {
    throw new Error(`Unknown settings section: ${sectionId}`);
  }
  return localizeSettingsSectionDefinition(section, localization);
}

export function getSettingsSectionTitle(
  sectionId: SettingsSectionId,
  localization?: SettingsLocalization
): string {
  return getSettingsSectionDefinition(sectionId, localization).title;
}

export function getSettingsEntryDefinition(
  entryId: SettingsEntryId,
  localization?: SettingsLocalization
): SettingsEntryDefinition {
  const entry = settingsEntryById.get(entryId);
  if (!entry) {
    throw new Error(`Unknown settings entry: ${entryId}`);
  }
  return localizeSettingsEntryDefinition(entry, localization);
}

export function getSettingsEntryLabel(
  entryId: SettingsEntryId,
  localization?: SettingsLocalization
): string {
  return getSettingsEntryDefinition(entryId, localization).label;
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

export function createSettingsSearchResult(
  query: string,
  localization?: SettingsLocalization
): SettingsSearchResult {
  const terms = normalizeSettingsSearchTerms(query);
  const sections = localizeSettingsSections(localization);
  const entries = localizeSettingsEntries(localization);

  if (terms.length === 0) {
    return {
      query: "",
      visibleEntries: entries.map((entry) => entry.id),
      visibleSections: sections.map((section) => section.id)
    };
  }

  const visibleEntries = entries
    .filter((entry) => {
      const section = sections.find((candidate) => candidate.id === entry.sectionId);
      return matchesTerms(section?.title ?? "", terms) || matchesSettingsEntry(entry, terms);
    })
    .map((entry) => entry.id);
  const visibleSectionSet = new Set(
    entries
      .filter((entry) => visibleEntries.includes(entry.id))
      .map((entry) => entry.sectionId)
  );

  return {
    query: terms.join(" "),
    visibleEntries,
    visibleSections: sections
      .map((section) => section.id)
      .filter((sectionId) => visibleSectionSet.has(sectionId))
  };
}

export function createSettingsVisibilityState(
  searchResult: SettingsSearchResult,
  localization?: SettingsLocalization
): SettingsVisibilityState {
  const sections = localizeSettingsSections(localization);

  return {
    hasResults: searchResult.visibleSections.length > 0,
    visibleEntryIds: searchResult.visibleEntries,
    visibleSectionIds: searchResult.visibleSections,
    visibleSections: sections.filter((section) => searchResult.visibleSections.includes(section.id))
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

function localizeSettingsSections(
  localization: SettingsLocalization | undefined
): readonly SettingsSectionDefinition[] {
  if (!localization?.sections) {
    return settingsSections;
  }

  return settingsSections.map((section) => localizeSettingsSectionDefinition(section, localization));
}

function localizeSettingsSectionDefinition(
  section: SettingsSectionDefinition,
  localization: SettingsLocalization | undefined
): SettingsSectionDefinition {
  const title = localization?.sections?.[section.id];

  return title ? { ...section, title } : section;
}

function localizeSettingsEntries(
  localization: SettingsLocalization | undefined
): readonly SettingsEntryDefinition[] {
  if (!localization?.entries) {
    return settingsEntries;
  }

  return settingsEntries.map((entry) => localizeSettingsEntryDefinition(entry, localization));
}

function localizeSettingsEntryDefinition(
  entry: SettingsEntryDefinition,
  localization: SettingsLocalization | undefined
): SettingsEntryDefinition {
  const localizedEntry = localization?.entries?.[entry.id];

  if (!localizedEntry?.label && !localizedEntry?.keywords) {
    return entry;
  }

  const keywords = [
    ...(entry.keywords ?? []),
    ...(localizedEntry.label && localizedEntry.label !== entry.label ? [localizedEntry.label] : []),
    ...(localizedEntry.keywords ?? [])
  ];

  return {
    ...entry,
    label: localizedEntry.label ?? entry.label,
    ...(keywords.length > 0 ? { keywords } : {})
  };
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

function readSettingsMetadataText(value: string): Readonly<Record<string, string>> {
  const lines = parseSettingsKeyValueLines(value);

  return lines ? Object.fromEntries(lines) : {};
}

function getSettingsRawMirrorMetadataIssue(
  provider: RemoteSyncProviderConfiguration
): SettingsValidationIssueCode | undefined {
  const issues = diagnoseRemoteSyncConfiguredRawMirrorMetadata(provider);

  if (issues.length === 0) {
    return undefined;
  }

  if (issues.some((issue) => isSettingsRawMirrorRetryMetadataIssueCode(issue.code))) {
    return settingsValidationIssueCodes.rawMirrorRetryInvalid;
  }

  if (issues.some((issue) => isSettingsRawMirrorListMetadataIssueCode(issue.code))) {
    return settingsValidationIssueCodes.rawMirrorListInvalid;
  }

  if (issues.some((issue) => isSettingsRawMirrorDeleteMetadataIssueCode(issue.code))) {
    return settingsValidationIssueCodes.rawMirrorDeleteInvalid;
  }

  return settingsValidationIssueCodes.rawMirrorMetadataInvalid;
}

function isSettingsRawMirrorDeleteMetadataIssueCode(code: string): boolean {
  return code === remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidDeleteMissing;
}

function isSettingsRawMirrorListMetadataIssueCode(code: string): boolean {
  return code === remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidListPageSize;
}

function isSettingsRawMirrorRetryMetadataIssueCode(code: string): boolean {
  return code === remoteSyncConfiguredRawMirrorMetadataIssueCodes.incompleteRetry ||
    code === remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidRetryDelayMs ||
    code === remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidRetryMaxRetries ||
    code === remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidRetryStatusCodes;
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

function applySettingsMetadataValue(
  metadata: Map<string, string>,
  key: string,
  value: string
): void {
  const normalized = value.trim();

  if (normalized) {
    metadata.set(key, normalized);
  }
}

function formatSettingsRawMirrorMetadataLines(metadata: ReadonlyMap<string, string>): string {
  const orderedEntries: (readonly [string, string])[] = [];
  const rawMirrorKeys = new Set<string>(settingsRawMirrorMetadataKeyOrder);

  for (const key of settingsRawMirrorMetadataKeyOrder) {
    const value = metadata.get(key);

    if (value !== undefined) {
      orderedEntries.push([key, value]);
    }
  }

  for (const entry of metadata) {
    if (!rawMirrorKeys.has(entry[0])) {
      orderedEntries.push(entry);
    }
  }

  return formatSettingsKeyValueLines(orderedEntries);
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

function createUniqueSettingsProviderId(baseId: string, usedIds: readonly string[]): string {
  const used = new Set(usedIds);

  if (!used.has(baseId)) {
    return baseId;
  }

  for (let index = 2; index < 1000; index += 1) {
    const candidate = `${baseId}.${index}`;

    if (!used.has(candidate)) {
      return candidate;
    }
  }

  return `${baseId}.${used.size + 1}`;
}
