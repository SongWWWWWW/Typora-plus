import { keybindingFromEvent } from "@typora-plus/platform";
import type {
  CommandMetadata,
  Keybinding,
  PartialConfiguration,
  RegisteredTheme,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import { Search, Settings as SettingsIcon, X } from "lucide-react";
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
  clampSettingNumber,
  createSettingsSearchResult,
  defaultSettingsSectionId,
  megabytesToBytes,
  normalizeAssetFolderInput,
  settingSectionAnchorId,
  settingsEntryIds,
  settingsNumberConstraints,
  settingsSectionIds,
  settingsSections,
  type SettingsEntryId,
  type SettingsSectionId,
  type NumberSettingConstraint
} from "./settingsModel";

export function SettingsDialog({
  open,
  configuration,
  commands,
  themes,
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
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>(defaultSettingsSectionId);
  const settingsContentRef = useRef<HTMLDivElement | null>(null);
  const hasKeybindingOverrides = configuration.keybindings.overrides.length > 0;
  const selectedThemeId = configuration.appearance.themeId && themes.some((theme) => theme.id === configuration.appearance.themeId)
    ? configuration.appearance.themeId
    : "";
  const searchMaxFileSizeMegabytes = bytesToMegabytes(configuration.workspace.searchMaxFileSizeBytes);
  const settingsSearchResult = useMemo(() => createSettingsSearchResult(settingsQuery), [settingsQuery]);
  const visibleSettingsSectionIds = useMemo(
    () => new Set(settingsSearchResult.visibleSections),
    [settingsSearchResult.visibleSections]
  );
  const visibleSettingsEntryIds = useMemo(
    () => new Set(settingsSearchResult.visibleEntries),
    [settingsSearchResult.visibleEntries]
  );
  const visibleSettingsSections = useMemo(
    () => settingsSections.filter((section) => visibleSettingsSectionIds.has(section.id)),
    [visibleSettingsSectionIds]
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
      setActiveSettingsSection(defaultSettingsSectionId);
    }
  }, [configuration.workspace.defaultAssetFolder, open]);

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
    if (!open || settingsSearchResult.visibleSections.length === 0) {
      return;
    }

    if (!settingsSearchResult.visibleSections.includes(activeSettingsSection)) {
      const nextSection = settingsSearchResult.visibleSections[0];

      if (nextSection) {
        setActiveSettingsSection(nextSection);
      }
    }
  }, [activeSettingsSection, open, settingsSearchResult.visibleSections]);

  if (!open) {
    return null;
  }

  const commitAssetFolder = () => {
    const assetFolder = normalizeAssetFolderInput(assetFolderDraft);

    if (!assetFolder) {
      setAssetFolderDraft(configuration.workspace.defaultAssetFolder);
      return;
    }

    onUpdate({
      workspace: {
        defaultAssetFolder: assetFolder
      }
    });
  };

  const settingsSearchHasResults = settingsSearchResult.visibleSections.length > 0;
  const isSettingsSectionVisible = (sectionId: SettingsSectionId) => visibleSettingsSectionIds.has(sectionId);
  const isSettingsEntryVisible = (entryId: SettingsEntryId) => visibleSettingsEntryIds.has(entryId);

  const scrollToSettingsSection = (sectionId: SettingsSectionId) => {
    setActiveSettingsSection(sectionId);
    settingsContentRef.current
      ?.querySelector<HTMLElement>(`#${settingSectionAnchorId(sectionId)}`)
      ?.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  const syncActiveSettingsSection = () => {
    const container = settingsContentRef.current;

    if (!container) {
      return;
    }

    const containerTop = container.getBoundingClientRect().top;
    let nextSection = activeSettingsSection;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const section of visibleSettingsSections) {
      const element = container.querySelector<HTMLElement>(`#${settingSectionAnchorId(section.id)}`);

      if (!element) {
        continue;
      }

      const distance = Math.abs(element.getBoundingClientRect().top - containerTop);

      if (distance < nearestDistance) {
        nearestDistance = distance;
        nextSection = section.id;
      }
    }

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
              {visibleSettingsSections.map((section) => (
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
            {!settingsSearchHasResults ? (
              <div className="tp-settings-empty-row">No matching settings</div>
            ) : null}
            {isSettingsSectionVisible(settingsSectionIds.appearance) ? (
              <SettingsSection sectionId={settingsSectionIds.appearance}>
                {isSettingsEntryVisible(settingsEntryIds.appearance.theme) ? (
                  <SettingsField label="Theme">
                    <SegmentedControl
                      ariaLabel="Theme"
                      value={configuration.appearance.colorScheme}
                      options={[
                        { value: "system", label: "System" },
                        { value: "light", label: "Light" },
                        { value: "dark", label: "Dark" }
                      ]}
                      onChange={(colorScheme) => onUpdate({ appearance: { colorScheme } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.appearance.customTheme) ? (
                  <SettingsField label="Custom Theme">
                    <select
                      className="tp-settings-select"
                      value={selectedThemeId}
                      aria-label="Custom Theme"
                      onChange={(event) => onUpdate({
                        appearance: {
                          themeId: event.target.value || undefined
                        }
                      })}
                    >
                      <option value="">Default</option>
                      {themes.map((theme) => (
                        <option key={theme.id} value={theme.id}>
                          {formatThemeOptionLabel(theme)}
                        </option>
                      ))}
                    </select>
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.appearance.density) ? (
                  <SettingsField label="Density">
                    <SegmentedControl
                      ariaLabel="Density"
                      value={configuration.appearance.density}
                      options={[
                        { value: "comfortable", label: "Comfortable" },
                        { value: "compact", label: "Compact" }
                      ]}
                      onChange={(density) => onUpdate({ appearance: { density } })}
                    />
                  </SettingsField>
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsSectionIds.editor) ? (
              <SettingsSection sectionId={settingsSectionIds.editor}>
                {isSettingsEntryVisible(settingsEntryIds.editor.autoSave) ? (
                  <SettingsField label="Auto Save">
                    <ToggleControl
                      checked={configuration.editor.autoSave}
                      label="Auto Save"
                      onChange={(autoSave) => onUpdate({ editor: { autoSave } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.editor.autoSaveDelay) ? (
                  <NumberSetting
                    label="Auto Save Delay"
                    value={configuration.editor.autoSaveDelayMs}
                    constraint={settingsNumberConstraints.editorAutoSaveDelayMs}
                    unit="ms"
                    onChange={(autoSaveDelayMs) => onUpdate({ editor: { autoSaveDelayMs } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.editor.focusMode) ? (
                  <SettingsField label="Focus Mode">
                    <ToggleControl
                      checked={configuration.editor.focusMode}
                      label="Focus Mode"
                      onChange={(focusMode) => onUpdate({ editor: { focusMode } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.editor.typewriterMode) ? (
                  <SettingsField label="Typewriter Mode">
                    <ToggleControl
                      checked={configuration.editor.typewriterMode}
                      label="Typewriter Mode"
                      onChange={(typewriterMode) => onUpdate({ editor: { typewriterMode } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.editor.fontSize) ? (
                  <NumberSetting
                    label="Font Size"
                    value={configuration.editor.fontSize}
                    constraint={settingsNumberConstraints.editorFontSize}
                    unit="px"
                    onChange={(fontSize) => onUpdate({ editor: { fontSize } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.editor.lineHeight) ? (
                  <NumberSetting
                    label="Line Height"
                    value={configuration.editor.lineHeight}
                    constraint={settingsNumberConstraints.editorLineHeight}
                    onChange={(lineHeight) => onUpdate({ editor: { lineHeight } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.editor.maxWidth) ? (
                  <NumberSetting
                    label="Editor Width"
                    value={configuration.editor.maxWidth}
                    constraint={settingsNumberConstraints.editorMaxWidth}
                    unit="px"
                    onChange={(maxWidth) => onUpdate({ editor: { maxWidth } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.editor.rendererPreviewCacheEntries) ? (
                  <NumberSetting
                    label="Renderer Cache"
                    value={configuration.editor.rendererPreviewCacheEntries}
                    constraint={settingsNumberConstraints.editorRendererPreviewCacheEntries}
                    unit="entries"
                    onChange={(rendererPreviewCacheEntries) => onUpdate({ editor: { rendererPreviewCacheEntries } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsSectionIds.workspace) ? (
              <SettingsSection sectionId={settingsSectionIds.workspace}>
                {isSettingsEntryVisible(settingsEntryIds.workspace.defaultAssetFolder) ? (
                  <SettingsField label="Asset Folder">
                    <input
                      className="tp-settings-text-input"
                      type="text"
                      value={assetFolderDraft}
                      aria-label="Asset Folder"
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
                {isSettingsEntryVisible(settingsEntryIds.workspace.searchMaxFileSize) ? (
                  <NumberSetting
                    label="Search File Limit"
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
                {isSettingsEntryVisible(settingsEntryIds.workspace.quickOpenMaxResults) ? (
                  <NumberSetting
                    label="Quick Open Results"
                    value={configuration.workspace.quickOpenMaxResults}
                    constraint={settingsNumberConstraints.workspaceQuickOpenMaxResults}
                    onChange={(quickOpenMaxResults) => onUpdate({ workspace: { quickOpenMaxResults } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsEntryIds.workspace.searchMaxResults) ? (
                  <NumberSetting
                    label="Search Results"
                    value={configuration.workspace.searchMaxResults}
                    constraint={settingsNumberConstraints.workspaceSearchMaxResults}
                    onChange={(searchMaxResults) => onUpdate({ workspace: { searchMaxResults } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsSectionIds.keybindings) ? (
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

function formatThemeOptionLabel(theme: RegisteredTheme): string {
  return theme.colorScheme ? `${theme.label} (${theme.colorScheme})` : theme.label;
}

function SettingsSection({
  sectionId,
  children
}: {
  readonly sectionId: SettingsSectionId;
  readonly children: ReactNode;
}) {
  const section = settingsSections.find((candidate) => candidate.id === sectionId);
  const title = section?.title ?? sectionId;

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
    const parsedValue = Number(rawValue);

    if (!Number.isFinite(parsedValue)) {
      return;
    }

    onChange(clampSettingNumber(parsedValue, constraint));
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
