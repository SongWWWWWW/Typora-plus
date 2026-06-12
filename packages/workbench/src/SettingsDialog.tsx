import {
  keybindingFromEvent,
  remoteSyncConfiguredRawMirrorListLimits,
  remoteSyncConfiguredRawMirrorRetryLimits
} from "@typora-plus/platform";
import type {
  AiProviderConfiguration,
  AiTextResponse,
  CommandMetadata,
  Keybinding,
  PartialConfiguration,
  RegisteredTheme,
  RemoteSyncProviderConfiguration,
  RemoteSyncProviderSecretConfiguration,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import { KeyRound, Plus, RefreshCw, Save, Search, Settings as SettingsIcon, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  filterKeybindingCommands,
  isRecordableKeybinding,
  removeKeybindingOverride,
  upsertKeybindingOverride
} from "./keybindingSettings";
import {
  bytesToMegabytes,
  canAddSettingsAiProvider,
  canAddSettingsRemoteSyncProvider,
  createSettingsAiProviderDraft,
  applySettingsRawMirrorMetadataDraft,
  createSettingsRawMirrorMetadataDraft,
  createSettingsRemoteSyncProviderDraft,
  createSettingsSearchResult,
  createSettingsThemeOptions,
  createSettingsVisibilityState,
  defaultSettingsSectionId,
  getSettingsEntryLabel,
  getSettingsSectionTitle,
  isSettingsEntryVisible,
  isSettingsSectionVisible,
  megabytesToBytes,
  removeSettingsAiProvider,
  removeSettingsRemoteSyncProvider,
  resolveNearestSettingsSection,
  resolveSelectedSettingsThemeId,
  resolveSettingsAssetFolderCommit,
  resolveSettingsNumberInput,
  resolveVisibleSettingsSection,
  settingsAiReasoningEffortOptions,
  settingsAiTextVerbosityOptions,
  settingSectionAnchorId,
  settingsColorSchemeOptions,
  settingsDensityOptions,
  settingsEntryIds,
  settingsNumberConstraints,
  settingsSectionIds,
  upsertSettingsAiProvider,
  upsertSettingsRemoteSyncProvider,
  validateSettingsAiProviderDraft,
  validateSettingsRemoteSyncProviderDraft,
  type SettingsAiProviderDraft,
  type SettingsRawMirrorMetadataDraft,
  type SettingsRemoteSyncProviderDraft,
  type SettingsSectionId,
  type NumberSettingConstraint
} from "./settingsModel";
import type { WorkbenchAiProviderDiagnosticActions } from "./workbenchAiProviderDiagnostics";
import type { WorkbenchAiSecretBridge } from "./workbenchAiSecrets";
import type { WorkbenchRemoteSyncSecretBridge } from "./workbenchRemoteSyncSecrets";

export function SettingsDialog({
  open,
  configuration,
  commands,
  themes,
  aiDiagnosticActions,
  aiSecretActions,
  remoteSyncSecretActions,
  getCommandForKeybinding,
  getKeybindingLabel,
  getKeybindingLabelForKeybinding,
  onClose,
  onUpdate
}: {
  readonly open: boolean;
  readonly configuration: TyporaPlusConfiguration;
  readonly commands: readonly CommandMetadata[];
  readonly themes: readonly RegisteredTheme[];
  readonly aiDiagnosticActions?: WorkbenchAiProviderDiagnosticActions;
  readonly aiSecretActions?: {
    readonly isAvailable: boolean;
    readonly setSecret: WorkbenchAiSecretBridge["setSecret"];
    readonly deleteSecret: WorkbenchAiSecretBridge["deleteSecret"];
  };
  readonly remoteSyncSecretActions?: {
    readonly isAvailable: boolean;
    readonly setSecret: WorkbenchRemoteSyncSecretBridge["setSecret"];
    readonly deleteSecret: WorkbenchRemoteSyncSecretBridge["deleteSecret"];
  };
  readonly getCommandForKeybinding: (keybinding: Keybinding) => string | undefined;
  readonly getKeybindingLabel: (command: string) => string | undefined;
  readonly getKeybindingLabelForKeybinding: (keybinding: Keybinding) => string;
  readonly onClose: () => void;
  readonly onUpdate: (value: PartialConfiguration) => void;
}) {
  const [assetFolderDraft, setAssetFolderDraft] = useState(configuration.workspace.defaultAssetFolder);
  const [recordingCommand, setRecordingCommand] = useState<string | undefined>();
  const [settingsQuery, setSettingsQuery] = useState("");
  const [keybindingQuery, setKeybindingQuery] = useState("");
  const [modifiedKeybindingsOnly, setModifiedKeybindingsOnly] = useState(false);
  const [pendingKeybinding, setPendingKeybinding] = useState<PendingKeybindingOverride | undefined>();
  const [aiProviderDrafts, setAiProviderDrafts] = useState<readonly AiProviderDraftState[]>(
    () => createAiProviderDraftStates(configuration.ai.providers)
  );
  const [remoteSyncProviderDrafts, setRemoteSyncProviderDrafts] = useState<readonly RemoteSyncProviderDraftState[]>(
    () => createRemoteSyncProviderDraftStates(configuration.remoteSync.providers)
  );
  const [aiDiagnosticStates, setAiDiagnosticStates] = useState<Record<string, AiDiagnosticState>>({});
  const [aiDiagnosticMessages, setAiDiagnosticMessages] = useState<Record<string, string>>({});
  const [aiSecretDrafts, setAiSecretDrafts] = useState<Record<string, string>>({});
  const [aiSecretStates, setAiSecretStates] = useState<Record<string, SecretState>>({});
  const [remoteSyncSecretDrafts, setRemoteSyncSecretDrafts] = useState<Record<string, string>>({});
  const [remoteSyncSecretStates, setRemoteSyncSecretStates] = useState<Record<string, SecretState>>({});
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>(defaultSettingsSectionId);
  const settingsContentRef = useRef<HTMLDivElement | null>(null);
  const nextAiProviderDraftIdRef = useRef(0);
  const nextRemoteSyncProviderDraftIdRef = useRef(0);
  const aiDiagnosticRequestIdsRef = useRef<Record<string, number>>({});
  const hasKeybindingOverrides = configuration.keybindings.overrides.length > 0;
  const hasUnsavedAiProviderDraft = aiProviderDrafts.some((draft) => !draft.originalId);
  const hasUnsavedRemoteSyncProviderDraft = remoteSyncProviderDrafts.some((draft) => !draft.originalId);
  const selectedThemeId = resolveSelectedSettingsThemeId(configuration.appearance.themeId, themes);
  const themeOptions = useMemo(() => createSettingsThemeOptions(themes), [themes]);
  const searchMaxFileSizeMegabytes = bytesToMegabytes(configuration.workspace.searchMaxFileSizeBytes);
  const settingsSearchResult = useMemo(() => createSettingsSearchResult(settingsQuery), [settingsQuery]);
  const settingsVisibility = useMemo(
    () => createSettingsVisibilityState(settingsSearchResult),
    [settingsSearchResult]
  );
  const filteredKeybindingCommands = useMemo(
    () => filterKeybindingCommands(commands, keybindingQuery, {
      getLabel: (command) => getKeybindingLabel(command.id),
      modifiedOnly: modifiedKeybindingsOnly,
      overrides: configuration.keybindings.overrides
    }),
    [commands, configuration.keybindings.overrides, getKeybindingLabel, keybindingQuery, modifiedKeybindingsOnly]
  );

  useEffect(() => {
    if (open) {
      setAssetFolderDraft(configuration.workspace.defaultAssetFolder);
      setRecordingCommand(undefined);
      setSettingsQuery("");
      setKeybindingQuery("");
      setModifiedKeybindingsOnly(false);
      setPendingKeybinding(undefined);
      setAiProviderDrafts(createAiProviderDraftStates(configuration.ai.providers));
      setRemoteSyncProviderDrafts(createRemoteSyncProviderDraftStates(configuration.remoteSync.providers));
      setAiDiagnosticStates({});
      setAiDiagnosticMessages({});
      setAiSecretDrafts({});
      setAiSecretStates({});
      setRemoteSyncSecretDrafts({});
      setRemoteSyncSecretStates({});
      setActiveSettingsSection(defaultSettingsSectionId);
    }
  }, [configuration.ai.providers, configuration.remoteSync.providers, configuration.workspace.defaultAssetFolder, open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  useEffect(() => {
    if (!recordingCommand) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      event.preventDefault();
      event.stopPropagation();

      if (event.key === "Escape") {
        setRecordingCommand(undefined);
        setPendingKeybinding(undefined);
        return;
      }

      const keybinding = keybindingFromEvent(event);

      if (!keybinding || !isRecordableKeybinding(keybinding)) {
        return;
      }

      const conflictCommand = getCommandForKeybinding(keybinding);
      const nextKeybinding = {
        command: recordingCommand,
        keybinding
      };

      if (conflictCommand && conflictCommand !== recordingCommand) {
        setPendingKeybinding({
          ...nextKeybinding,
          conflictCommand,
          label: getKeybindingLabelForKeybinding(keybinding)
        });
        setRecordingCommand(undefined);
        return;
      }

      applyKeybindingOverride(configuration, nextKeybinding, onUpdate);
      setRecordingCommand(undefined);
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [configuration, getCommandForKeybinding, getKeybindingLabelForKeybinding, onUpdate, recordingCommand]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const nextSection = resolveVisibleSettingsSection(activeSettingsSection, settingsVisibility.visibleSectionIds);

    if (nextSection !== activeSettingsSection) {
      setActiveSettingsSection(nextSection);
    }
  }, [activeSettingsSection, open, settingsVisibility]);

  if (!open) {
    return null;
  }

  const commitAssetFolder = () => {
    const commit = resolveSettingsAssetFolderCommit(
      assetFolderDraft,
      configuration.workspace.defaultAssetFolder
    );

    if (commit.kind === "reset") {
      setAssetFolderDraft(commit.draft);
      return;
    }

    onUpdate({
      workspace: {
        defaultAssetFolder: commit.defaultAssetFolder
      }
    });
  };

  const scrollToSettingsSection = (sectionId: SettingsSectionId) => {
    setActiveSettingsSection(sectionId);
    settingsContentRef.current
      ?.querySelector<HTMLElement>(`#${settingSectionAnchorId(sectionId)}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const addAiProviderDraft = () => {
    const key = `new:${nextAiProviderDraftIdRef.current++}`;
    setAiProviderDrafts((drafts) => [...drafts, {
      key,
      ...createSettingsAiProviderDraft()
    }]);
  };

  const updateAiProviderDraft = (
    key: string,
    value: Partial<SettingsAiProviderDraft>
  ) => {
    setAiProviderDrafts((drafts) => drafts.map((draft) =>
      draft.key === key ? { ...draft, ...value } : draft
    ));
    resetAiProviderDiagnostic(key);
  };

  const saveAiProviderDraft = (draft: AiProviderDraftState) => {
    const validation = validateSettingsAiProviderDraft(
      draft,
      configuration.ai.providers,
      draft.originalId
    );
    const nextProviders = upsertSettingsAiProvider(
      configuration.ai.providers,
      draft,
      draft.originalId
    );

    if (nextProviders === configuration.ai.providers) {
      return;
    }

    setAiProviderDrafts((drafts) => drafts.map((candidate) =>
      candidate.key === draft.key
        ? validation.provider
          ? {
              ...candidate,
              originalId: validation.provider.id
            }
          : candidate
        : candidate
    ));
    onUpdate({ ai: { providers: nextProviders } });
  };

  const removeAiProviderDraft = (draft: AiProviderDraftState) => {
    if (draft.originalId) {
      onUpdate({
        ai: {
          providers: removeSettingsAiProvider(configuration.ai.providers, draft.originalId)
        }
      });
    }

    setAiProviderDrafts((drafts) => drafts.filter((candidate) => candidate.key !== draft.key));
    resetAiProviderDiagnostic(draft.key);
  };

  const addRemoteSyncProviderDraft = () => {
    const key = `new:${nextRemoteSyncProviderDraftIdRef.current++}`;
    setRemoteSyncProviderDrafts((drafts) => [...drafts, {
      key,
      ...createSettingsRemoteSyncProviderDraft()
    }]);
  };

  const updateRemoteSyncProviderDraft = (
    key: string,
    value: Partial<SettingsRemoteSyncProviderDraft>
  ) => {
    setRemoteSyncProviderDrafts((drafts) => drafts.map((draft) =>
      draft.key === key ? { ...draft, ...value } : draft
    ));
  };

  const saveRemoteSyncProviderDraft = (draft: RemoteSyncProviderDraftState) => {
    const validation = validateSettingsRemoteSyncProviderDraft(
      draft,
      configuration.remoteSync.providers,
      draft.originalId
    );
    const nextProviders = upsertSettingsRemoteSyncProvider(
      configuration.remoteSync.providers,
      draft,
      draft.originalId
    );

    if (nextProviders === configuration.remoteSync.providers) {
      return;
    }

    setRemoteSyncProviderDrafts((drafts) => drafts.map((candidate) =>
      candidate.key === draft.key
        ? validation.provider
          ? {
              ...candidate,
              originalId: validation.provider.id
            }
          : candidate
        : candidate
    ));
    onUpdate({ remoteSync: { providers: nextProviders } });
  };

  const removeRemoteSyncProviderDraft = (draft: RemoteSyncProviderDraftState) => {
    if (draft.originalId) {
      onUpdate({
        remoteSync: {
          providers: removeSettingsRemoteSyncProvider(configuration.remoteSync.providers, draft.originalId)
        }
      });
    }

    setRemoteSyncProviderDrafts((drafts) => drafts.filter((candidate) => candidate.key !== draft.key));
  };

  const updateAiSecretDraft = (key: string, value: string) => {
    setAiSecretDrafts((drafts) => ({ ...drafts, [key]: value }));
    setAiSecretStates((states) => ({ ...states, [key]: "idle" }));
    resetAiProviderDiagnostic(key);
  };

  const saveAiSecret = (draft: AiProviderDraftState) => {
    const value = aiSecretDrafts[draft.key] ?? "";

    void aiSecretActions?.setSecret(draft.secretRef, value).then((saved) => {
      setAiSecretStates((states) => ({ ...states, [draft.key]: saved ? "saved" : "failed" }));
      if (saved) {
        setAiSecretDrafts((drafts) => ({ ...drafts, [draft.key]: "" }));
        resetAiProviderDiagnostic(draft.key);
      }
    });
  };

  const deleteAiSecret = (draft: AiProviderDraftState) => {
    void aiSecretActions?.deleteSecret(draft.secretRef).then((deleted) => {
      setAiSecretStates((states) => ({ ...states, [draft.key]: deleted ? "deleted" : "failed" }));
      if (deleted) {
        resetAiProviderDiagnostic(draft.key);
      }
    });
  };

  const updateRemoteSyncSecretDraft = (key: string, value: string) => {
    setRemoteSyncSecretDrafts((drafts) => ({ ...drafts, [key]: value }));
    setRemoteSyncSecretStates((states) => ({ ...states, [key]: "idle" }));
  };

  const saveRemoteSyncSecret = (key: string, secretRef: string) => {
    const value = remoteSyncSecretDrafts[key] ?? "";

    void remoteSyncSecretActions?.setSecret(secretRef, value).then((saved) => {
      setRemoteSyncSecretStates((states) => ({ ...states, [key]: saved ? "saved" : "failed" }));
      if (saved) {
        setRemoteSyncSecretDrafts((drafts) => ({ ...drafts, [key]: "" }));
      }
    });
  };

  const deleteRemoteSyncSecret = (key: string, secretRef: string) => {
    void remoteSyncSecretActions?.deleteSecret(secretRef).then((deleted) => {
      setRemoteSyncSecretStates((states) => ({ ...states, [key]: deleted ? "deleted" : "failed" }));
    });
  };

  const resetAiProviderDiagnostic = (key: string) => {
    markAiDiagnosticRequest(key);
    setAiDiagnosticStates((states) => ({ ...states, [key]: "idle" }));
    setAiDiagnosticMessages((messages) => ({ ...messages, [key]: "" }));
  };

  const testAiProvider = (draft: AiProviderDraftState) => {
    if (!draft.originalId || !aiDiagnosticActions) {
      return;
    }

    const requestId = markAiDiagnosticRequest(draft.key);
    setAiDiagnosticStates((states) => ({ ...states, [draft.key]: "testing" }));
    setAiDiagnosticMessages((messages) => ({ ...messages, [draft.key]: "" }));

    void aiDiagnosticActions.testProvider(draft.originalId).then((response) => {
      if (aiDiagnosticRequestIdsRef.current[draft.key] !== requestId) {
        return;
      }

      setAiDiagnosticStates((states) => ({ ...states, [draft.key]: response ? "passed" : "failed" }));
      setAiDiagnosticMessages((messages) => ({
        ...messages,
        [draft.key]: response ? formatAiDiagnosticResponseMessage(response) : ""
      }));
    });
  };

  const markAiDiagnosticRequest = (key: string): number => {
    const nextRequestId = (aiDiagnosticRequestIdsRef.current[key] ?? 0) + 1;
    aiDiagnosticRequestIdsRef.current = {
      ...aiDiagnosticRequestIdsRef.current,
      [key]: nextRequestId
    };
    return nextRequestId;
  };

  const syncActiveSettingsSection = () => {
    const container = settingsContentRef.current;

    if (!container) {
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    const distances = settingsVisibility.visibleSections.flatMap((section) => {
      const element = container.querySelector<HTMLElement>(`#${settingSectionAnchorId(section.id)}`);

      if (!element) {
        return [];
      }

      return [{
        sectionId: section.id,
        distance: Math.abs(element.getBoundingClientRect().top - containerTop)
      }];
    });
    const nextSection = resolveNearestSettingsSection(activeSettingsSection, distances);

    if (nextSection !== activeSettingsSection) {
      setActiveSettingsSection(nextSection);
    }
  };

  return (
    <div className="tp-dialog-overlay" role="presentation" onMouseDown={onClose}>
      <section
        className="tp-dialog tp-settings-dialog"
        role="dialog"
        aria-label="Settings"
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-dialog-header">
          <div className="tp-dialog-title tp-settings-title">
            <SettingsIcon size={18} />
            <span>Settings</span>
          </div>
          <SettingsIconButton title="Close" onClick={onClose}>
            <X size={16} />
          </SettingsIconButton>
        </div>
        <div className="tp-settings-body">
          <aside className="tp-settings-sidebar">
            <div className="tp-settings-search">
              <Search size={15} />
              <input
                type="search"
                value={settingsQuery}
                aria-label="Search Settings"
                onChange={(event) => setSettingsQuery(event.target.value)}
              />
              {settingsQuery ? (
                <button
                  type="button"
                  aria-label="Clear Settings Search"
                  onClick={() => setSettingsQuery("")}
                >
                  <X size={14} />
                </button>
              ) : <span aria-hidden="true" />}
            </div>
            <nav className="tp-settings-nav" aria-label="Settings Sections">
              {settingsVisibility.visibleSections.map((section) => (
                <button
                  className={activeSettingsSection === section.id ? "tp-settings-nav-button tp-settings-nav-button-active" : "tp-settings-nav-button"}
                  key={section.id}
                  type="button"
                  aria-current={activeSettingsSection === section.id ? "true" : undefined}
                  aria-controls={settingSectionAnchorId(section.id)}
                  onClick={() => scrollToSettingsSection(section.id)}
                >
                  {section.title}
                </button>
              ))}
            </nav>
          </aside>
          <div className="tp-settings-content" ref={settingsContentRef} onScroll={syncActiveSettingsSection}>
            {!settingsVisibility.hasResults ? (
              <div className="tp-settings-empty-row">No matching settings</div>
            ) : null}
            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.appearance) ? (
              <SettingsSection sectionId={settingsSectionIds.appearance}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.appearance.theme) ? (
                  <SettingsField label={getSettingsEntryLabel(settingsEntryIds.appearance.theme)}>
                    <SegmentedControl
                      ariaLabel={getSettingsEntryLabel(settingsEntryIds.appearance.theme)}
                      value={configuration.appearance.colorScheme}
                      options={settingsColorSchemeOptions}
                      onChange={(colorScheme) => onUpdate({ appearance: { colorScheme } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.appearance.customTheme) ? (
                  <SettingsField label={getSettingsEntryLabel(settingsEntryIds.appearance.customTheme)}>
                    <select
                      className="tp-settings-select"
                      value={selectedThemeId}
                      aria-label={getSettingsEntryLabel(settingsEntryIds.appearance.customTheme)}
                      onChange={(event) => onUpdate({
                        appearance: {
                          themeId: event.target.value || undefined
                        }
                      })}
                    >
                      {themeOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.appearance.density) ? (
                  <SettingsField label={getSettingsEntryLabel(settingsEntryIds.appearance.density)}>
                    <SegmentedControl
                      ariaLabel={getSettingsEntryLabel(settingsEntryIds.appearance.density)}
                      value={configuration.appearance.density}
                      options={settingsDensityOptions}
                      onChange={(density) => onUpdate({ appearance: { density } })}
                    />
                  </SettingsField>
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.editor) ? (
              <SettingsSection sectionId={settingsSectionIds.editor}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.autoSave) ? (
                  <SettingsField label={getSettingsEntryLabel(settingsEntryIds.editor.autoSave)}>
                    <ToggleControl
                      checked={configuration.editor.autoSave}
                      label={getSettingsEntryLabel(settingsEntryIds.editor.autoSave)}
                      onChange={(autoSave) => onUpdate({ editor: { autoSave } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.autoSaveDelay) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.editor.autoSaveDelay)}
                    value={configuration.editor.autoSaveDelayMs}
                    constraint={settingsNumberConstraints.editorAutoSaveDelayMs}
                    unit="ms"
                    onChange={(autoSaveDelayMs) => onUpdate({ editor: { autoSaveDelayMs } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.focusMode) ? (
                  <SettingsField label={getSettingsEntryLabel(settingsEntryIds.editor.focusMode)}>
                    <ToggleControl
                      checked={configuration.editor.focusMode}
                      label={getSettingsEntryLabel(settingsEntryIds.editor.focusMode)}
                      onChange={(focusMode) => onUpdate({ editor: { focusMode } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.typewriterMode) ? (
                  <SettingsField label={getSettingsEntryLabel(settingsEntryIds.editor.typewriterMode)}>
                    <ToggleControl
                      checked={configuration.editor.typewriterMode}
                      label={getSettingsEntryLabel(settingsEntryIds.editor.typewriterMode)}
                      onChange={(typewriterMode) => onUpdate({ editor: { typewriterMode } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.fontSize) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.editor.fontSize)}
                    value={configuration.editor.fontSize}
                    constraint={settingsNumberConstraints.editorFontSize}
                    unit="px"
                    onChange={(fontSize) => onUpdate({ editor: { fontSize } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.lineHeight) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.editor.lineHeight)}
                    value={configuration.editor.lineHeight}
                    constraint={settingsNumberConstraints.editorLineHeight}
                    onChange={(lineHeight) => onUpdate({ editor: { lineHeight } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.maxWidth) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.editor.maxWidth)}
                    value={configuration.editor.maxWidth}
                    constraint={settingsNumberConstraints.editorMaxWidth}
                    unit="px"
                    onChange={(maxWidth) => onUpdate({ editor: { maxWidth } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.rendererPreviewCacheEntries) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.editor.rendererPreviewCacheEntries)}
                    value={configuration.editor.rendererPreviewCacheEntries}
                    constraint={settingsNumberConstraints.editorRendererPreviewCacheEntries}
                    unit="entries"
                    onChange={(rendererPreviewCacheEntries) => onUpdate({ editor: { rendererPreviewCacheEntries } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.ai) ? (
              <SettingsSection sectionId={settingsSectionIds.ai}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.ai.providers) ? (
                  <>
                    <div className="tp-settings-provider-toolbar">
                      <button
                        className="tp-settings-small-button"
                        type="button"
                        disabled={!canAddSettingsAiProvider(configuration.ai.providers) || hasUnsavedAiProviderDraft}
                        onClick={addAiProviderDraft}
                      >
                        <Plus size={13} />
                        <span>Add Provider</span>
                      </button>
                    </div>
                    <div className="tp-settings-provider-list">
                      {aiProviderDrafts.map((draft) => {
                        const validation = validateSettingsAiProviderDraft(
                          draft,
                          configuration.ai.providers,
                          draft.originalId
                        );
                        const secretValue = aiSecretDrafts[draft.key] ?? "";
                        const secretState = aiSecretStates[draft.key] ?? "idle";
                        const diagnosticState = aiDiagnosticStates[draft.key] ?? "idle";
                        const diagnosticMessage = aiDiagnosticMessages[draft.key] ?? "";
                        const canTestProvider = !!aiDiagnosticActions &&
                          diagnosticState !== "testing" &&
                          isSavedAiProviderDraft(draft, validation.provider, configuration.ai.providers);
                        const canSaveSecret = !!aiSecretActions?.isAvailable &&
                          validation.canSave &&
                          secretValue.trim().length > 0;
                        const canDeleteSecret = !!aiSecretActions?.isAvailable && validation.canSave;

                        return (
                          <section className="tp-settings-provider-card" key={draft.key}>
                            <div className="tp-settings-provider-card-header">
                              <span>{draft.title || draft.id || "AI Provider"}</span>
                              <div className="tp-settings-provider-card-actions">
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!canTestProvider}
                                  onClick={() => testAiProvider(draft)}
                                >
                                  <RefreshCw size={13} />
                                  <span>{formatAiDiagnosticButtonLabel(diagnosticState)}</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!validation.canSave}
                                  onClick={() => saveAiProviderDraft(draft)}
                                >
                                  <Save size={13} />
                                  <span>Save</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  onClick={() => removeAiProviderDraft(draft)}
                                >
                                  <Trash2 size={13} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                            <SettingsField label="Provider ID">
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.id}
                                aria-label="AI Provider ID"
                                onChange={(event) => updateAiProviderDraft(draft.key, { id: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Title">
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.title}
                                aria-label="AI Provider Title"
                                onChange={(event) => updateAiProviderDraft(draft.key, { title: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Endpoint">
                              <input
                                className="tp-settings-text-input"
                                type="url"
                                value={draft.endpointUrl}
                                aria-label="AI Provider Endpoint"
                                onChange={(event) => updateAiProviderDraft(draft.key, { endpointUrl: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Model">
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.model}
                                aria-label="AI Provider Model"
                                onChange={(event) => updateAiProviderDraft(draft.key, { model: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Reasoning">
                              <SegmentedControl
                                ariaLabel="AI Provider Reasoning"
                                value={draft.reasoningEffort}
                                options={settingsAiReasoningEffortOptions}
                                onChange={(reasoningEffort) => updateAiProviderDraft(draft.key, { reasoningEffort })}
                              />
                            </SettingsField>
                            <SettingsField label="Verbosity">
                              <SegmentedControl
                                ariaLabel="AI Provider Verbosity"
                                value={draft.textVerbosity}
                                options={settingsAiTextVerbosityOptions}
                                onChange={(textVerbosity) => updateAiProviderDraft(draft.key, { textVerbosity })}
                              />
                            </SettingsField>
                            <SettingsField label="Max Output">
                              <input
                                className="tp-settings-text-input"
                                type="number"
                                min={settingsNumberConstraints.aiProviderMaxOutputTokens.min}
                                max={settingsNumberConstraints.aiProviderMaxOutputTokens.max}
                                step={settingsNumberConstraints.aiProviderMaxOutputTokens.step}
                                value={draft.maxOutputTokens}
                                aria-label="AI Provider Max Output Tokens"
                                onChange={(event) => updateAiProviderDraft(draft.key, {
                                  maxOutputTokens: event.target.value
                                })}
                              />
                            </SettingsField>
                            <SettingsField label="Secret Ref">
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.secretRef}
                                aria-label="AI Provider Secret Reference"
                                onChange={(event) => updateAiProviderDraft(draft.key, { secretRef: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Store Response">
                              <ToggleControl
                                checked={draft.store}
                                label="AI Provider Store Response"
                                onChange={(store) => updateAiProviderDraft(draft.key, { store })}
                              />
                            </SettingsField>
                            <SettingsField label="API Key">
                              <span className="tp-settings-secret-control">
                                <input
                                  className="tp-settings-text-input"
                                  type="password"
                                  value={secretValue}
                                  aria-label="AI Provider API Key"
                                  disabled={!aiSecretActions?.isAvailable}
                                  onChange={(event) => updateAiSecretDraft(draft.key, event.target.value)}
                                />
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!canSaveSecret}
                                  onClick={() => saveAiSecret(draft)}
                                >
                                  <KeyRound size={13} />
                                  <span>{formatSecretSaveLabel(secretState)}</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!canDeleteSecret}
                                  onClick={() => deleteAiSecret(draft)}
                                >
                                  <Trash2 size={13} />
                                  <span>{formatSecretDeleteLabel(secretState)}</span>
                                </button>
                              </span>
                            </SettingsField>
                            {validation.issues.length > 0 ? (
                              <div className="tp-settings-validation-row">{validation.issues[0]}</div>
                            ) : null}
                            {diagnosticState !== "idle" ? (
                              <div className={`tp-settings-diagnostic-row tp-settings-diagnostic-row-${diagnosticState}`}>
                                {formatAiDiagnosticStatusMessage(diagnosticState, diagnosticMessage)}
                              </div>
                            ) : null}
                          </section>
                        );
                      })}
                      {aiProviderDrafts.length === 0 ? (
                        <div className="tp-settings-empty-row">No AI providers configured</div>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.ai.workspaceContextMaxResults) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.ai.workspaceContextMaxResults)}
                    value={configuration.ai.workspaceContextMaxResults}
                    constraint={settingsNumberConstraints.aiWorkspaceContextMaxResults}
                    onChange={(workspaceContextMaxResults) => onUpdate({ ai: { workspaceContextMaxResults } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.ai.workspaceContextMaxPreviewLength) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.ai.workspaceContextMaxPreviewLength)}
                    value={configuration.ai.workspaceContextMaxPreviewLength}
                    constraint={settingsNumberConstraints.aiWorkspaceContextMaxPreviewLength}
                    unit="chars"
                    onChange={(workspaceContextMaxPreviewLength) => onUpdate({ ai: { workspaceContextMaxPreviewLength } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.remoteSync) ? (
              <SettingsSection sectionId={settingsSectionIds.remoteSync}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.remoteSync.providers) ? (
                  <>
                    <div className="tp-settings-provider-toolbar">
                      <button
                        className="tp-settings-small-button"
                        type="button"
                        disabled={
                          !canAddSettingsRemoteSyncProvider(configuration.remoteSync.providers) ||
                          hasUnsavedRemoteSyncProviderDraft
                        }
                        onClick={addRemoteSyncProviderDraft}
                      >
                        <Plus size={13} />
                        <span>Add Profile</span>
                      </button>
                    </div>
                    <div className="tp-settings-provider-list">
                      {remoteSyncProviderDrafts.map((draft) => {
                        const validation = validateSettingsRemoteSyncProviderDraft(
                          draft,
                          configuration.remoteSync.providers,
                          draft.originalId
                        );
                        const secretBindings = validation.provider?.secrets ?? [];

                        return (
                          <section className="tp-settings-provider-card" key={draft.key}>
                            <div className="tp-settings-provider-card-header">
                              <span>{draft.title || draft.id || "Remote Sync Profile"}</span>
                              <div className="tp-settings-provider-card-actions">
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!validation.canSave}
                                  onClick={() => saveRemoteSyncProviderDraft(draft)}
                                >
                                  <Save size={13} />
                                  <span>Save</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  onClick={() => removeRemoteSyncProviderDraft(draft)}
                                >
                                  <Trash2 size={13} />
                                  <span>Remove</span>
                                </button>
                              </div>
                            </div>
                            <SettingsField label="Provider ID">
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.id}
                                aria-label="Remote Sync Provider ID"
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { id: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Title">
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.title}
                                aria-label="Remote Sync Provider Title"
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { title: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Base URL">
                              <input
                                className="tp-settings-text-input"
                                type="url"
                                value={draft.baseUrl}
                                aria-label="Remote Sync Provider Base URL"
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { baseUrl: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Remote Scope">
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.remoteScopeId}
                                aria-label="Remote Sync Provider Scope"
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { remoteScopeId: event.target.value })}
                              />
                            </SettingsField>
                            <RawMirrorSettingsFields
                              draft={draft}
                              onChange={(updatedDraft) =>
                                updateRemoteSyncProviderDraft(draft.key, { metadataText: updatedDraft.metadataText })}
                            />
                            <SettingsField label="Secret Bindings">
                              <textarea
                                className="tp-settings-textarea"
                                value={draft.secretsText}
                                aria-label="Remote Sync Provider Secret Bindings"
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { secretsText: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label="Metadata">
                              <textarea
                                className="tp-settings-textarea"
                                value={draft.metadataText}
                                aria-label="Remote Sync Provider Metadata"
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { metadataText: event.target.value })}
                              />
                            </SettingsField>
                            {secretBindings.length > 0 ? (
                              <div className="tp-settings-secret-list">
                                {secretBindings.map((secret) => {
                                  const secretKey = remoteSyncSecretStateKey(draft.key, secret);
                                  const secretValue = remoteSyncSecretDrafts[secretKey] ?? "";
                                  const secretState = remoteSyncSecretStates[secretKey] ?? "idle";
                                  const canSaveSecret = !!remoteSyncSecretActions?.isAvailable &&
                                    validation.canSave &&
                                    secretValue.trim().length > 0;
                                  const canDeleteSecret = !!remoteSyncSecretActions?.isAvailable && validation.canSave;

                                  return (
                                    <SettingsField key={secretKey} label={secret.name}>
                                      <span className="tp-settings-secret-control">
                                        <input
                                          className="tp-settings-text-input"
                                          type="password"
                                          value={secretValue}
                                          aria-label={`Remote Sync Secret ${secret.name}`}
                                          disabled={!remoteSyncSecretActions?.isAvailable}
                                          onChange={(event) => updateRemoteSyncSecretDraft(secretKey, event.target.value)}
                                        />
                                        <button
                                          className="tp-settings-small-button"
                                          type="button"
                                          disabled={!canSaveSecret}
                                          onClick={() => saveRemoteSyncSecret(secretKey, secret.secretRef)}
                                        >
                                          <KeyRound size={13} />
                                          <span>{formatSecretSaveLabel(secretState)}</span>
                                        </button>
                                        <button
                                          className="tp-settings-small-button"
                                          type="button"
                                          disabled={!canDeleteSecret}
                                          onClick={() => deleteRemoteSyncSecret(secretKey, secret.secretRef)}
                                        >
                                          <Trash2 size={13} />
                                          <span>{formatSecretDeleteLabel(secretState)}</span>
                                        </button>
                                      </span>
                                    </SettingsField>
                                  );
                                })}
                              </div>
                            ) : null}
                            {validation.issues.length > 0 ? (
                              <div className="tp-settings-validation-row">{validation.issues[0]}</div>
                            ) : null}
                          </section>
                        );
                      })}
                      {remoteSyncProviderDrafts.length === 0 ? (
                        <div className="tp-settings-empty-row">No remote sync profiles configured</div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.workspace) ? (
              <SettingsSection sectionId={settingsSectionIds.workspace}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.workspace.defaultAssetFolder) ? (
                  <SettingsField label={getSettingsEntryLabel(settingsEntryIds.workspace.defaultAssetFolder)}>
                    <input
                      className="tp-settings-text-input"
                      type="text"
                      value={assetFolderDraft}
                      aria-label={getSettingsEntryLabel(settingsEntryIds.workspace.defaultAssetFolder)}
                      onChange={(event) => setAssetFolderDraft(event.target.value)}
                      onBlur={commitAssetFolder}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          commitAssetFolder();
                        }
                      }}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.workspace.searchMaxFileSize) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.workspace.searchMaxFileSize)}
                    value={searchMaxFileSizeMegabytes}
                    constraint={settingsNumberConstraints.workspaceSearchMaxFileSizeMegabytes}
                    unit="MB"
                    onChange={(value) => onUpdate({
                      workspace: {
                        searchMaxFileSizeBytes: megabytesToBytes(value)
                      }
                    })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.workspace.quickOpenMaxResults) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.workspace.quickOpenMaxResults)}
                    value={configuration.workspace.quickOpenMaxResults}
                    constraint={settingsNumberConstraints.workspaceQuickOpenMaxResults}
                    onChange={(quickOpenMaxResults) => onUpdate({ workspace: { quickOpenMaxResults } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.workspace.searchMaxResults) ? (
                  <NumberSetting
                    label={getSettingsEntryLabel(settingsEntryIds.workspace.searchMaxResults)}
                    value={configuration.workspace.searchMaxResults}
                    constraint={settingsNumberConstraints.workspaceSearchMaxResults}
                    onChange={(searchMaxResults) => onUpdate({ workspace: { searchMaxResults } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.keybindings) ? (
              <SettingsSection sectionId={settingsSectionIds.keybindings}>
                <div className="tp-settings-keybinding-search">
                  <Search size={15} />
                  <input
                    type="search"
                    value={keybindingQuery}
                    aria-label="Search Keybindings"
                    onChange={(event) => setKeybindingQuery(event.target.value)}
                  />
                  {keybindingQuery ? (
                    <button
                      type="button"
                      aria-label="Clear Keybinding Search"
                      onClick={() => setKeybindingQuery("")}
                    >
                      <X size={14} />
                    </button>
                  ) : <span aria-hidden="true" />}
                </div>
                <div className="tp-settings-keybinding-toolbar">
                  <label className="tp-settings-toggle">
                    <input
                      type="checkbox"
                      checked={modifiedKeybindingsOnly}
                      aria-label="Modified Keybindings"
                      onChange={(event) => setModifiedKeybindingsOnly(event.target.checked)}
                    />
                    <span>Modified</span>
                  </label>
                  <button
                    className="tp-settings-small-button"
                    type="button"
                    disabled={!hasKeybindingOverrides}
                    onClick={() => {
                      setPendingKeybinding(undefined);
                      onUpdate({
                        keybindings: {
                          overrides: []
                        }
                      });
                    }}
                  >
                    Reset All
                  </button>
                </div>
                <div className="tp-settings-keybinding-list">
                  {filteredKeybindingCommands.map((command) => {
                    const hasOverride = configuration.keybindings.overrides.some((override) => override.command === command.id);
                    const recording = recordingCommand === command.id;

                    return (
                      <div className="tp-settings-keybinding-row" key={command.id}>
                        <span className="tp-settings-keybinding-name">
                          <span>{command.title}</span>
                          {command.category ? <small>{command.category}</small> : null}
                        </span>
                        <kbd className={recording ? "tp-settings-keybinding-value tp-settings-keybinding-value-recording" : "tp-settings-keybinding-value"}>
                          {recording ? "Press keys" : getKeybindingLabel(command.id) ?? "Unassigned"}
                        </kbd>
                        <button
                          className="tp-settings-small-button"
                          type="button"
                          onClick={() => {
                            setPendingKeybinding(undefined);
                            setRecordingCommand(command.id);
                          }}
                        >
                          Record
                        </button>
                        <button
                          className="tp-settings-small-button"
                          type="button"
                          disabled={!hasOverride}
                          onClick={() => onUpdate({
                            keybindings: {
                              overrides: removeKeybindingOverride(configuration.keybindings.overrides, command.id)
                            }
                          })}
                        >
                          Reset
                        </button>
                        {pendingKeybinding?.command === command.id ? (
                          <div className="tp-settings-keybinding-conflict">
                            <span>
                              {pendingKeybinding.label} is used by {commandTitle(commands, pendingKeybinding.conflictCommand)}.
                            </span>
                            <button
                              className="tp-settings-small-button"
                              type="button"
                              onClick={() => {
                                applyKeybindingOverride(configuration, pendingKeybinding, onUpdate);
                                setPendingKeybinding(undefined);
                              }}
                            >
                              Replace
                            </button>
                            <button
                              className="tp-settings-small-button"
                              type="button"
                              onClick={() => setPendingKeybinding(undefined)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {filteredKeybindingCommands.length === 0 ? (
                    <div className="tp-settings-empty-row">
                      {modifiedKeybindingsOnly && !hasKeybindingOverrides ? "No modified shortcuts" : "No matching commands"}
                    </div>
                  ) : null}
                </div>
              </SettingsSection>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

interface PendingKeybindingOverride {
  readonly command: string;
  readonly keybinding: Keybinding;
  readonly conflictCommand: string;
  readonly label: string;
}

type SecretState = "idle" | "saved" | "deleted" | "failed";
type AiDiagnosticState = "idle" | "testing" | "passed" | "failed";

interface AiProviderDraftState extends SettingsAiProviderDraft {
  readonly key: string;
  readonly originalId?: string;
}

interface RemoteSyncProviderDraftState extends SettingsRemoteSyncProviderDraft {
  readonly key: string;
  readonly originalId?: string;
}

function createAiProviderDraftStates(
  providers: readonly AiProviderConfiguration[]
): readonly AiProviderDraftState[] {
  return providers.map((provider) => ({
    key: `provider:${provider.id}`,
    originalId: provider.id,
    ...createSettingsAiProviderDraft(provider)
  }));
}

function createRemoteSyncProviderDraftStates(
  providers: readonly RemoteSyncProviderConfiguration[]
): readonly RemoteSyncProviderDraftState[] {
  return providers.map((provider) => ({
    key: `provider:${provider.id}`,
    originalId: provider.id,
    ...createSettingsRemoteSyncProviderDraft(provider)
  }));
}

function remoteSyncSecretStateKey(
  draftKey: string,
  secret: RemoteSyncProviderSecretConfiguration
): string {
  return `${draftKey}:${secret.name}:${secret.secretRef}`;
}

function formatSecretSaveLabel(state: SecretState): string {
  switch (state) {
    case "saved":
      return "Saved";
    case "failed":
      return "Failed";
    case "deleted":
    case "idle":
      return "Save Key";
  }
}

function formatSecretDeleteLabel(state: SecretState): string {
  switch (state) {
    case "deleted":
      return "Deleted";
    case "failed":
      return "Failed";
    case "saved":
    case "idle":
      return "Delete";
  }
}

function formatAiDiagnosticButtonLabel(state: AiDiagnosticState): string {
  return state === "testing" ? "Testing" : "Test";
}

function formatAiDiagnosticStatusMessage(state: AiDiagnosticState, message: string): string {
  switch (state) {
    case "testing":
      return "Testing provider";
    case "passed":
      return message ? `Connection OK: ${message}` : "Connection OK";
    case "failed":
      return "Connection failed";
    case "idle":
      return "";
  }
}

function formatAiDiagnosticResponseMessage(response: AiTextResponse): string {
  return [
    response.model,
    formatAiDiagnosticTokenUsage(response.usage)
  ].filter((part): part is string => !!part).join(", ");
}

function formatAiDiagnosticTokenUsage(usage: AiTextResponse["usage"]): string | undefined {
  if (!usage) {
    return undefined;
  }

  const tokens = [
    usage.inputTokens !== undefined ? `${usage.inputTokens} in` : undefined,
    usage.outputTokens !== undefined ? `${usage.outputTokens} out` : undefined,
    usage.totalTokens !== undefined ? `${usage.totalTokens} total` : undefined
  ].filter((part): part is string => !!part);

  return tokens.length > 0 ? tokens.join(" / ") : undefined;
}

function isSavedAiProviderDraft(
  draft: AiProviderDraftState,
  provider: AiProviderConfiguration | undefined,
  providers: readonly AiProviderConfiguration[]
): boolean {
  if (!draft.originalId || !provider) {
    return false;
  }

  const savedProvider = providers.find((candidate) => candidate.id === draft.originalId);

  return !!savedProvider && areAiProviderConfigurationsEqual(savedProvider, provider);
}

function areAiProviderConfigurationsEqual(
  first: AiProviderConfiguration,
  second: AiProviderConfiguration
): boolean {
  return first.id === second.id &&
    first.title === second.title &&
    first.kind === second.kind &&
    first.endpointUrl === second.endpointUrl &&
    first.maxOutputTokens === second.maxOutputTokens &&
    first.model === second.model &&
    first.reasoningEffort === second.reasoningEffort &&
    first.secretRef === second.secretRef &&
    (first.store ?? false) === (second.store ?? false) &&
    first.textVerbosity === second.textVerbosity;
}

function applyKeybindingOverride(
  configuration: TyporaPlusConfiguration,
  override: { readonly command: string; readonly keybinding: Keybinding },
  onUpdate: (value: PartialConfiguration) => void
): void {
  onUpdate({
    keybindings: {
      overrides: upsertKeybindingOverride(configuration.keybindings.overrides, override)
    }
  });
}

function commandTitle(commands: readonly CommandMetadata[], id: string): string {
  return commands.find((command) => command.id === id)?.title ?? id;
}

function SettingsSection({
  sectionId,
  children
}: {
  readonly sectionId: SettingsSectionId;
  readonly children: ReactNode;
}) {
  const title = getSettingsSectionTitle(sectionId);

  return (
    <section className="tp-settings-section" id={settingSectionAnchorId(sectionId)}>
      <h2 className="tp-settings-section-title">{title}</h2>
      <div className="tp-settings-section-content">{children}</div>
    </section>
  );
}

function SettingsField({
  label,
  children
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="tp-settings-field">
      <span className="tp-settings-label">{label}</span>
      <span className="tp-settings-control">{children}</span>
    </div>
  );
}

function RawMirrorSettingsFields({
  draft,
  onChange
}: {
  readonly draft: SettingsRemoteSyncProviderDraft;
  readonly onChange: (draft: SettingsRemoteSyncProviderDraft) => void;
}) {
  const rawMirrorDraft = createSettingsRawMirrorMetadataDraft(draft);
  const updateRawMirrorDraft = (value: Partial<SettingsRawMirrorMetadataDraft>) => {
    onChange(applySettingsRawMirrorMetadataDraft(draft, {
      ...rawMirrorDraft,
      ...value
    }));
  };

  return (
    <>
      <SettingsField label="Raw Mirror">
        <ToggleControl
          checked={rawMirrorDraft.enabled}
          label="Raw Mirror"
          onChange={(enabled) => updateRawMirrorDraft({ enabled })}
        />
      </SettingsField>
      {rawMirrorDraft.enabled ? (
        <>
          <SettingsField label="List Path">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.listPath}
              aria-label="Raw Mirror List Path"
              onChange={(event) => updateRawMirrorDraft({ listPath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Page Size">
            <input
              className="tp-settings-number-input"
              type="number"
              min={remoteSyncConfiguredRawMirrorListLimits.minPageSize}
              max={remoteSyncConfiguredRawMirrorListLimits.maxPageSize}
              step={1}
              value={rawMirrorDraft.listPageSize}
              aria-label="Raw Mirror Page Size"
              onChange={(event) => updateRawMirrorDraft({ listPageSize: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Upload Path">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.uploadPath}
              aria-label="Raw Mirror Upload Path"
              onChange={(event) => updateRawMirrorDraft({ uploadPath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Download Path">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.downloadPath}
              aria-label="Raw Mirror Download Path"
              onChange={(event) => updateRawMirrorDraft({ downloadPath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Delete Path">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.deletePath}
              aria-label="Raw Mirror Delete Path"
              onChange={(event) => updateRawMirrorDraft({ deletePath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Delete Missing">
            <ToggleControl
              checked={rawMirrorDraft.deleteMissing}
              label="Raw Mirror Delete Missing"
              onChange={(deleteMissing) => updateRawMirrorDraft({ deleteMissing })}
            />
          </SettingsField>
          <SettingsField label="Header Binding">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.headerBinding}
              aria-label="Raw Mirror Header Binding"
              onChange={(event) => updateRawMirrorDraft({ headerBinding: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Header Name">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.headerName}
              aria-label="Raw Mirror Header Name"
              onChange={(event) => updateRawMirrorDraft({ headerName: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Header Scheme">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.headerScheme}
              aria-label="Raw Mirror Header Scheme"
              onChange={(event) => updateRawMirrorDraft({ headerScheme: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Retry Status">
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.retryStatusCodes}
              aria-label="Raw Mirror Retry Status"
              onChange={(event) => updateRawMirrorDraft({ retryStatusCodes: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Retry Count">
            <input
              className="tp-settings-number-input"
              type="number"
              min={0}
              max={remoteSyncConfiguredRawMirrorRetryLimits.maxRetries}
              step={1}
              value={rawMirrorDraft.retryMaxRetries}
              aria-label="Raw Mirror Retry Count"
              onChange={(event) => updateRawMirrorDraft({ retryMaxRetries: event.target.value })}
            />
          </SettingsField>
          <SettingsField label="Retry Delay">
            <input
              className="tp-settings-number-input"
              type="number"
              min={0}
              max={remoteSyncConfiguredRawMirrorRetryLimits.maxDelayMs}
              step={1}
              value={rawMirrorDraft.retryDelayMs}
              aria-label="Raw Mirror Retry Delay"
              onChange={(event) => updateRawMirrorDraft({ retryDelayMs: event.target.value })}
            />
          </SettingsField>
        </>
      ) : null}
    </>
  );
}

function SegmentedControl<TValue extends string>({
  ariaLabel,
  value,
  options,
  onChange
}: {
  readonly ariaLabel: string;
  readonly value: TValue;
  readonly options: readonly { readonly value: TValue; readonly label: string }[];
  readonly onChange: (value: TValue) => void;
}) {
  return (
    <div className="tp-settings-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          className={option.value === value ? "tp-settings-segmented-button tp-settings-segmented-button-active" : "tp-settings-segmented-button"}
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ToggleControl({
  checked,
  label,
  onChange
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly onChange: (value: boolean) => void;
}) {
  return (
    <label className="tp-settings-toggle">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{checked ? "On" : "Off"}</span>
    </label>
  );
}

function NumberSetting({
  label,
  value,
  constraint,
  unit,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly constraint: NumberSettingConstraint;
  readonly unit?: string;
  readonly onChange: (value: number) => void;
}) {
  const updateValue = (rawValue: string) => {
    const nextValue = resolveSettingsNumberInput(rawValue, constraint);

    if (nextValue === undefined) {
      return;
    }

    onChange(nextValue);
  };

  return (
    <SettingsField label={label}>
      <span className="tp-settings-number-control">
        <input
          className="tp-settings-range-input"
          type="range"
          min={constraint.min}
          max={constraint.max}
          step={constraint.step}
          value={value}
          aria-label={label}
          onChange={(event) => updateValue(event.target.value)}
        />
        <input
          className="tp-settings-number-input"
          type="number"
          min={constraint.min}
          max={constraint.max}
          step={constraint.step}
          value={value}
          aria-label={`${label} Value`}
          onChange={(event) => updateValue(event.target.value)}
          onBlur={(event) => updateValue(event.target.value)}
        />
        {unit ? <span className="tp-settings-unit">{unit}</span> : null}
      </span>
    </SettingsField>
  );
}

function SettingsIconButton({
  title,
  children,
  onClick
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly onClick: () => void;
}) {
  return (
    <button
      className="tp-icon-button"
      type="button"
      aria-label={title}
      title={title}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
