import { describe, expect, it } from "vitest";
import {
  remoteSyncConfiguredRawMirrorAdapterName,
  remoteSyncConfiguredRawMirrorListLimits,
  remoteSyncConfiguredRawMirrorMetadataKeys,
  remoteSyncConfiguredRawMirrorRetryLimits
} from "@typora-plus/platform";
import {
  bytesToMegabytes,
  applySettingsRawMirrorMetadataDraft,
  canAddSettingsAiProvider,
  canAddSettingsRemoteSyncProvider,
  clampSettingNumber,
  createSettingsAiProviderDraft,
  createSettingsRawMirrorMetadataDraft,
  createSettingsRemoteSyncProviderDraft,
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
  removeSettingsAiProvider,
  removeSettingsRemoteSyncProvider,
  resolveNearestSettingsSection,
  resolveSelectedSettingsThemeId,
  resolveSettingsAssetFolderCommit,
  resolveSettingsNumberInput,
  resolveVisibleSettingsSection,
  settingSectionAnchorId,
  settingsAiReasoningEffortOptions,
  settingsAiTextVerbosityOptions,
  settingsColorSchemeOptions,
  settingsDensityOptions,
  settingsEntries,
  settingsEntryIds,
  settingsSectionIds,
  settingsSections,
  settingsNumberConstraints,
  upsertSettingsAiProvider,
  upsertSettingsRemoteSyncProvider,
  validateSettingsAiProviderDraft,
  validateSettingsRemoteSyncProviderDraft
} from "./settingsModel";

describe("settings model", () => {
  it("defines stable settings section ids", () => {
    expect(settingsSectionIds).toEqual({
      ai: "ai",
      appearance: "appearance",
      editor: "editor",
      remoteSync: "remoteSync",
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
    });
  });

  it("defines stable settings sections for navigation", () => {
    expect(settingsSections.map((section) => [section.id, section.title])).toEqual([
      ["appearance", "Appearance"],
      ["editor", "Editor"],
      ["ai", "AI"],
      ["remoteSync", "Remote Sync"],
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
    expect(settingsAiReasoningEffortOptions).toEqual([
      { value: "", label: "Default" },
      { value: "none", label: "None" },
      { value: "minimal", label: "Minimal" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "xhigh", label: "XHigh" }
    ]);
    expect(settingsAiTextVerbosityOptions).toEqual([
      { value: "", label: "Default" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" }
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
      "tp-settings-section-ai",
      "tp-settings-section-remoteSync",
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
    expect(workspaceSettings.visibleSections.map((section) => section.id)).toEqual([
      settingsSectionIds.ai,
      settingsSectionIds.workspace
    ]);
    expect(isSettingsSectionVisible(workspaceSettings, settingsSectionIds.workspace)).toBe(true);
    expect(isSettingsSectionVisible(workspaceSettings, settingsSectionIds.editor)).toBe(false);
    expect(isSettingsEntryVisible(workspaceSettings, settingsEntryIds.workspace.searchMaxResults)).toBe(true);
    expect(isSettingsEntryVisible(workspaceSettings, settingsEntryIds.editor.fontSize)).toBe(false);
  });

  it("matches complete sections and individual settings entries", () => {
    expect(createSettingsSearchResult("workspace").visibleEntries).toEqual([
      "ai.workspaceContextMaxResults",
      "ai.workspaceContextMaxPreviewLength",
      "workspace.defaultAssetFolder",
      "workspace.quickOpenMaxResults",
      "workspace.searchMaxFileSize",
      "workspace.searchMaxResults"
    ]);
    expect(createSettingsSearchResult("font").visibleEntries).toEqual(["editor.fontSize"]);
    expect(createSettingsSearchResult("custom theme").visibleEntries).toEqual(["appearance.customTheme"]);
    expect(createSettingsSearchResult("save delay").visibleEntries).toEqual(["editor.autoSaveDelay"]);
    expect(createSettingsSearchResult("renderer cache").visibleEntries).toEqual(["editor.rendererPreviewCacheEntries"]);
    expect(createSettingsSearchResult("api key").visibleEntries).toEqual(["ai.providers"]);
    expect(createSettingsSearchResult("responses model").visibleEntries).toEqual(["ai.providers"]);
    expect(createSettingsSearchResult("reasoning verbosity").visibleEntries).toEqual(["ai.providers"]);
    expect(createSettingsSearchResult("output tokens").visibleEntries).toEqual(["ai.providers"]);
    expect(createSettingsSearchResult("grounded context").visibleEntries).toEqual(["ai.workspaceContextMaxResults"]);
    expect(createSettingsSearchResult("snippet preview").visibleEntries).toEqual(["ai.workspaceContextMaxPreviewLength"]);
    expect(createSettingsSearchResult("remote cloud").visibleEntries).toEqual(["remoteSync.providers"]);
    expect(createSettingsSearchResult("native request").visibleEntries).toEqual(["remoteSync.providers"]);
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
    expect(clampSettingNumber(-1, settingsNumberConstraints.aiWorkspaceContextMaxResults)).toBe(0);
    expect(clampSettingNumber(99, settingsNumberConstraints.aiWorkspaceContextMaxResults)).toBe(12);
    expect(clampSettingNumber(20, settingsNumberConstraints.aiWorkspaceContextMaxPreviewLength)).toBe(80);
    expect(clampSettingNumber(999, settingsNumberConstraints.aiWorkspaceContextMaxPreviewLength)).toBe(320);
    expect(clampSettingNumber(0, settingsNumberConstraints.aiProviderMaxOutputTokens)).toBe(1);
    expect(clampSettingNumber(64_000, settingsNumberConstraints.aiProviderMaxOutputTokens)).toBe(32_000);
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

  it("creates and validates AI provider drafts through platform configuration rules", () => {
    const provider = {
      id: "notes.responses",
      title: "Notes",
      kind: "responses" as const,
      endpointUrl: "https://api.example.test/v1/responses",
      maxOutputTokens: 2048,
      model: "notes-model",
      reasoningEffort: "medium" as const,
      secretRef: "typora-plus.ai.notes",
      store: false,
      textVerbosity: "low" as const
    };

    expect(createSettingsAiProviderDraft(provider)).toEqual({
      id: "notes.responses",
      title: "Notes",
      endpointUrl: "https://api.example.test/v1/responses",
      maxOutputTokens: "2048",
      model: "notes-model",
      reasoningEffort: "medium",
      secretRef: "typora-plus.ai.notes",
      store: false,
      textVerbosity: "low"
    });
    expect(validateSettingsAiProviderDraft(createSettingsAiProviderDraft(provider), [], undefined)).toMatchObject({
      provider,
      canSave: true,
      issues: []
    });
    expect(validateSettingsAiProviderDraft({
      ...createSettingsAiProviderDraft(provider),
      endpointUrl: "http://api.example.test/v1/responses"
    }, [], undefined)).toEqual({
      canSave: false,
      issues: ["Complete provider id, title, HTTPS or loopback endpoint, model, secret reference, and valid request settings."]
    });
    expect(validateSettingsAiProviderDraft({
      ...createSettingsAiProviderDraft(provider),
      maxOutputTokens: "many"
    }, [], undefined)).toEqual({
      canSave: false,
      issues: ["Complete provider id, title, HTTPS or loopback endpoint, model, secret reference, and valid request settings."]
    });
  });

  it("upserts and removes AI provider configuration without duplicate ids", () => {
    const existing = {
      id: "existing.responses",
      title: "Existing",
      kind: "responses" as const,
      endpointUrl: "https://api.example.test/v1/responses",
      model: "existing-model",
      secretRef: "typora-plus.ai.existing"
    };
    const draft = createSettingsAiProviderDraft({
      id: "notes.responses",
      title: "Notes",
      kind: "responses",
      endpointUrl: "http://127.0.0.1:11434/v1/responses",
      maxOutputTokens: 4096,
      model: "notes-model",
      reasoningEffort: "high",
      secretRef: "typora-plus.ai.notes",
      textVerbosity: "medium"
    });

    expect(upsertSettingsAiProvider([existing], draft)).toEqual([
      existing,
      {
        id: "notes.responses",
        title: "Notes",
        kind: "responses",
        endpointUrl: "http://127.0.0.1:11434/v1/responses",
        maxOutputTokens: 4096,
        model: "notes-model",
        reasoningEffort: "high",
        secretRef: "typora-plus.ai.notes",
        store: false,
        textVerbosity: "medium"
      }
    ]);
    const duplicateValidation = validateSettingsAiProviderDraft({
      ...draft,
      id: existing.id
    }, [existing]);

    expect(duplicateValidation.canSave).toBe(false);
    expect(duplicateValidation.issues).toEqual(["Provider id is already used."]);
    expect(removeSettingsAiProvider([existing], existing.id)).toEqual([]);
  });

  it("honors the configured AI provider count limit", () => {
    const providers = Array.from({ length: 20 }, (_, index) => ({
      id: `provider.${index}`,
      title: `Provider ${index}`,
      kind: "responses" as const,
      endpointUrl: "https://api.example.test/v1/responses",
      model: "model",
      secretRef: `typora-plus.ai.${index}`
    }));

    expect(canAddSettingsAiProvider(providers)).toBe(false);
    expect(canAddSettingsAiProvider(providers.slice(0, 19))).toBe(true);
    expect(upsertSettingsAiProvider(providers, createSettingsAiProviderDraft({
      id: "extra.provider",
      title: "Extra",
      kind: "responses",
      endpointUrl: "https://api.example.test/v1/responses",
      model: "model",
      secretRef: "typora-plus.ai.extra"
    }))).toBe(providers);
  });

  it("creates and validates remote sync provider drafts through platform configuration rules", () => {
    const provider = {
      id: "notes.sync",
      title: "Notes Sync",
      kind: "native-request" as const,
      baseUrl: "https://sync.example.test/root",
      remoteScopeId: "workspace/root",
      secrets: [
        {
          name: "access",
          secretRef: "typora-plus.remote-sync.notes.access"
        },
        {
          name: "refresh",
          secretRef: "typora-plus.remote-sync.notes.refresh"
        }
      ],
      metadata: {
        mode: "raw"
      }
    };

    expect(createSettingsRemoteSyncProviderDraft(provider)).toEqual({
      id: "notes.sync",
      title: "Notes Sync",
      baseUrl: "https://sync.example.test/root",
      remoteScopeId: "workspace/root",
      secretsText: [
        "access=typora-plus.remote-sync.notes.access",
        "refresh=typora-plus.remote-sync.notes.refresh"
      ].join("\n"),
      metadataText: "mode=raw"
    });
    expect(validateSettingsRemoteSyncProviderDraft(
      createSettingsRemoteSyncProviderDraft(provider),
      [],
      undefined
    )).toMatchObject({
      provider,
      canSave: true,
      issues: []
    });
    expect(validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      baseUrl: "http://sync.example.test/root"
    }, [], undefined)).toEqual({
      canSave: false,
      issues: ["Complete provider id, title, HTTPS or loopback base URL, and valid profile bindings."]
    });
    expect(validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      secretsText: "access token=typora-plus.remote-sync.notes.access"
    }, [], undefined)).toEqual({
      canSave: false,
      issues: ["Complete provider id, title, HTTPS or loopback base URL, and valid profile bindings."]
    });
  });

  it("validates configured raw mirror remote sync metadata before save", () => {
    const provider = {
      id: "mirror.sync",
      title: "Mirror Sync",
      kind: "native-request" as const,
      baseUrl: "https://sync.example.test/root",
      secrets: [
        {
          name: "access",
          secretRef: "typora-plus.remote-sync.mirror.access"
        }
      ],
      metadata: createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]: "access",
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerName]: "Authorization",
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]: "Bearer"
      })
    };

    expect(validateSettingsRemoteSyncProviderDraft(
      createSettingsRemoteSyncProviderDraft(provider),
      [],
      undefined
    )).toMatchObject({
      provider,
      canSave: true,
      issues: []
    });

    expect(validateSettingsRemoteSyncProviderDraft(
      createSettingsRemoteSyncProviderDraft({
        ...provider,
        metadata: createRawMirrorMetadata()
      }),
      [],
      undefined
    )).toMatchObject({
      canSave: true,
      issues: []
    });

    expect(validateSettingsRemoteSyncProviderDraft(
      createSettingsRemoteSyncProviderDraft({
        ...provider,
        metadata: createRawMirrorMetadata({
          [remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize]: "200"
        })
      }),
      [],
      undefined
    )).toMatchObject({
      canSave: true,
      issues: []
    });

    expect(validateSettingsRemoteSyncProviderDraft(
      createSettingsRemoteSyncProviderDraft({
        ...provider,
        metadata: createRawMirrorMetadata({
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]: "429, 503",
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]: "2",
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs]: "0"
        })
      }),
      [],
      undefined
    )).toMatchObject({
      canSave: true,
      issues: []
    });

    const missingPathValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath]: undefined
      }))
    }, [], undefined);

    expect(missingPathValidation.canSave).toBe(false);
    expect(missingPathValidation.issues).toContain("Complete raw mirror metadata paths and header binding.");

    const invalidPathValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath]: "../upload"
      }))
    }, [], undefined);

    expect(invalidPathValidation.canSave).toBe(false);
    expect(invalidPathValidation.issues).toContain("Complete raw mirror metadata paths and header binding.");

    const incompleteHeaderValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]: "access",
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerName]: undefined
      }))
    }, [], undefined);

    expect(incompleteHeaderValidation.canSave).toBe(false);
    expect(incompleteHeaderValidation.issues).toContain("Complete raw mirror metadata paths and header binding.");

    const unboundHeaderValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]: "missing",
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerName]: "Authorization"
      }))
    }, [], undefined);

    expect(unboundHeaderValidation.canSave).toBe(false);
    expect(unboundHeaderValidation.issues).toContain("Complete raw mirror metadata paths and header binding.");

    const invalidRetryStatusValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]: "200"
      }))
    }, [], undefined);

    expect(invalidRetryStatusValidation.canSave).toBe(false);
    expect(invalidRetryStatusValidation.issues).toContain("Complete raw mirror retry metadata.");

    const incompleteRetryValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]: "2"
      }))
    }, [], undefined);

    expect(incompleteRetryValidation.canSave).toBe(false);
    expect(incompleteRetryValidation.issues).toContain("Complete raw mirror retry metadata.");

    const highRetryValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]: "503",
        [remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]:
          String(remoteSyncConfiguredRawMirrorRetryLimits.maxRetries + 1)
      }))
    }, [], undefined);

    expect(highRetryValidation.canSave).toBe(false);
    expect(highRetryValidation.issues).toContain("Complete raw mirror retry metadata.");

    const invalidPageSizeValidation = validateSettingsRemoteSyncProviderDraft({
      ...createSettingsRemoteSyncProviderDraft(provider),
      metadataText: formatRawMirrorMetadataText(createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize]:
          String(remoteSyncConfiguredRawMirrorListLimits.maxPageSize + 1)
      }))
    }, [], undefined);

    expect(invalidPageSizeValidation.canSave).toBe(false);
    expect(invalidPageSizeValidation.issues).toContain("Complete raw mirror list metadata.");
  });

  it("maps raw mirror metadata through a structured Settings draft", () => {
    const provider = {
      id: "mirror.sync",
      title: "Mirror Sync",
      kind: "native-request" as const,
      baseUrl: "https://sync.example.test/root",
      secrets: [
        {
          name: "access",
          secretRef: "typora-plus.remote-sync.mirror.access"
        }
      ],
      metadata: createRawMirrorMetadata({
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]: "access",
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerName]: "Authorization",
        [remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]: "Bearer",
        [remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize]: "200",
        [remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]: "429, 503",
        [remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]: "2",
        [remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs]: "0",
        "custom.flag": "keep"
      })
    };
    const draft = createSettingsRemoteSyncProviderDraft(provider);
    const rawMirrorDraft = createSettingsRawMirrorMetadataDraft(draft);

    expect(rawMirrorDraft).toEqual({
      enabled: true,
      listPath: "mirror/list",
      listPageSize: "200",
      uploadPath: "mirror/upload",
      downloadPath: "mirror/download",
      deletePath: "mirror/delete",
      headerBinding: "access",
      headerName: "Authorization",
      headerScheme: "Bearer",
      retryStatusCodes: "429, 503",
      retryMaxRetries: "2",
      retryDelayMs: "0"
    });

    const updated = applySettingsRawMirrorMetadataDraft(draft, {
      ...rawMirrorDraft,
      uploadPath: "gateway/upload",
      listPageSize: "300",
      headerScheme: "",
      retryMaxRetries: "3",
      retryDelayMs: "50"
    });
    const keys = remoteSyncConfiguredRawMirrorMetadataKeys;

    expect(updated.metadataText).toBe([
      `${keys.adapter}=${remoteSyncConfiguredRawMirrorAdapterName}`,
      `${keys.listPath}=mirror/list`,
      `${keys.listPageSize}=300`,
      `${keys.uploadPath}=gateway/upload`,
      `${keys.downloadPath}=mirror/download`,
      `${keys.deletePath}=mirror/delete`,
      `${keys.headerBinding}=access`,
      `${keys.headerName}=Authorization`,
      `${keys.retryStatusCodes}=429, 503`,
      `${keys.retryMaxRetries}=3`,
      `${keys.retryDelayMs}=50`,
      "custom.flag=keep"
    ].join("\n"));
    expect(validateSettingsRemoteSyncProviderDraft(updated, [], undefined)).toMatchObject({
      canSave: true,
      issues: []
    });
  });

  it("removes guided raw mirror metadata without dropping unrelated metadata", () => {
    const draft = createSettingsRemoteSyncProviderDraft({
      id: "mirror.sync",
      title: "Mirror Sync",
      kind: "native-request",
      baseUrl: "https://sync.example.test/root",
      secrets: [],
      metadata: createRawMirrorMetadata({
        "custom.flag": "keep"
      })
    });
    const rawMirrorDraft = createSettingsRawMirrorMetadataDraft(draft);
    const updated = applySettingsRawMirrorMetadataDraft(draft, {
      ...rawMirrorDraft,
      enabled: false
    });

    expect(updated.metadataText).toBe("custom.flag=keep");
    expect(createSettingsRawMirrorMetadataDraft(updated)).toMatchObject({
      enabled: false,
      listPath: "",
      listPageSize: "",
      uploadPath: "",
      downloadPath: "",
      deletePath: ""
    });
  });

  it("does not overwrite malformed metadata text when applying guided raw mirror fields", () => {
    const draft = {
      ...createSettingsRemoteSyncProviderDraft(),
      metadataText: remoteSyncConfiguredRawMirrorMetadataKeys.adapter
    };
    const updated = applySettingsRawMirrorMetadataDraft(draft, {
      enabled: true,
      listPath: "mirror/list",
      listPageSize: "",
      uploadPath: "mirror/upload",
      downloadPath: "mirror/download",
      deletePath: "mirror/delete",
      headerBinding: "",
      headerName: "",
      headerScheme: "",
      retryStatusCodes: "",
      retryMaxRetries: "",
      retryDelayMs: ""
    });

    expect(updated).toBe(draft);
  });

  it("upserts and removes remote sync provider configuration without duplicate ids", () => {
    const existing = {
      id: "existing.sync",
      title: "Existing",
      kind: "native-request" as const,
      baseUrl: "https://sync.example.test/existing",
      secrets: []
    };
    const draft = createSettingsRemoteSyncProviderDraft({
      id: "notes.sync",
      title: "Notes Sync",
      kind: "native-request",
      baseUrl: "http://127.0.0.1:5173/sync",
      secrets: [
        {
          name: "access",
          secretRef: "typora-plus.remote-sync.notes.access"
        }
      ]
    });

    expect(upsertSettingsRemoteSyncProvider([existing], draft)).toEqual([
      existing,
      {
        id: "notes.sync",
        title: "Notes Sync",
        kind: "native-request",
        baseUrl: "http://127.0.0.1:5173/sync",
        secrets: [
          {
            name: "access",
            secretRef: "typora-plus.remote-sync.notes.access"
          }
        ]
      }
    ]);
    const duplicateValidation = validateSettingsRemoteSyncProviderDraft({
      ...draft,
      id: existing.id
    }, [existing]);

    expect(duplicateValidation.canSave).toBe(false);
    expect(duplicateValidation.issues).toEqual(["Provider id is already used."]);
    expect(removeSettingsRemoteSyncProvider([existing], existing.id)).toEqual([]);
  });

  it("honors the configured remote sync provider count limit", () => {
    const providers = Array.from({ length: 20 }, (_, index) => ({
      id: `sync.${index}`,
      title: `Sync ${index}`,
      kind: "native-request" as const,
      baseUrl: "https://sync.example.test/root",
      secrets: []
    }));

    expect(canAddSettingsRemoteSyncProvider(providers)).toBe(false);
    expect(canAddSettingsRemoteSyncProvider(providers.slice(0, 19))).toBe(true);
    expect(upsertSettingsRemoteSyncProvider(providers, createSettingsRemoteSyncProviderDraft({
      id: "extra.sync",
      title: "Extra",
      kind: "native-request",
      baseUrl: "https://sync.example.test/root",
      secrets: []
    }))).toBe(providers);
  });
});

function createRawMirrorMetadata(
  overrides: Readonly<Record<string, string | undefined>> = {}
): Record<string, string> {
  const metadata: Record<string, string | undefined> = {
    [remoteSyncConfiguredRawMirrorMetadataKeys.adapter]: remoteSyncConfiguredRawMirrorAdapterName,
    [remoteSyncConfiguredRawMirrorMetadataKeys.listPath]: "mirror/list",
    [remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath]: "mirror/upload",
    [remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath]: "mirror/download",
    [remoteSyncConfiguredRawMirrorMetadataKeys.deletePath]: "mirror/delete",
    ...overrides
  };

  return Object.fromEntries(
    Object.entries(metadata).filter((entry): entry is [string, string] => entry[1] !== undefined)
  );
}

function formatRawMirrorMetadataText(metadata: Readonly<Record<string, string>>): string {
  return Object.entries(metadata).map(([key, value]) => `${key}=${value}`).join("\n");
}
