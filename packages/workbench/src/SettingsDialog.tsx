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
import {
  Check,
  FolderOpen,
  FolderPlus,
  KeyRound,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings as SettingsIcon,
  Trash2,
  X
} from "lucide-react";
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
  createSettingsLarkRawMirrorProviderDraft,
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
  isSettingsLarkRawMirrorProviderDraft,
  isSettingsSectionVisible,
  megabytesToBytes,
  removeSettingsAiProvider,
  removeSettingsRemoteSyncProvider,
  resolveNearestSettingsSection,
  resolveSelectedSettingsThemeId,
  resolveSettingsAssetFolderCommit,
  resolveSettingsNumberInput,
  resolveVisibleSettingsSection,
  settingSectionAnchorId,
  settingsEntryIds,
  settingsNumberConstraints,
  settingsSectionIds,
  upsertSettingsAiProvider,
  upsertSettingsRemoteSyncProvider,
  validateSettingsAiProviderDraft,
  validateSettingsRemoteSyncProviderDraft,
  type SettingsAiProviderDraft,
  type SettingsEntryId,
  type SettingsRawMirrorMetadataDraft,
  type SettingsRemoteSyncProviderDraft,
  type SettingsValidationIssueCode,
  type SettingsSectionId,
  type NumberSettingConstraint
} from "./settingsModel";
import {
  formatRemoteSyncSecretAriaLabel,
  formatSettingsValidationIssue,
  settingsNumberUnitIds,
  type SettingsNumberUnitId,
  type WorkbenchMessages
} from "./workbenchI18n";
import { formatWorkbenchAiTokenUsage } from "./workbenchAiResponseModel";
import type { WorkbenchAiProviderDiagnosticActions } from "./workbenchAiProviderDiagnostics";
import type { WorkbenchAiSecretBridge } from "./workbenchAiSecrets";
import type {
  WorkbenchRemoteSyncLarkAuthActions,
  WorkbenchRemoteSyncLarkFolder,
  WorkbenchRemoteSyncLarkAuthStart,
  WorkbenchRemoteSyncLarkAuthStatus
} from "./workbenchRemoteSyncLarkAuth";
import type { WorkbenchRemoteSyncSecretBridge } from "./workbenchRemoteSyncSecrets";

export function SettingsDialog({
  open,
  configuration,
  commands,
  themes,
  messages,
  aiDiagnosticActions,
  aiSecretActions,
  remoteSyncLarkAuthActions,
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
  readonly messages: WorkbenchMessages;
  readonly aiDiagnosticActions?: WorkbenchAiProviderDiagnosticActions;
  readonly aiSecretActions?: {
    readonly isAvailable: boolean;
    readonly setSecret: WorkbenchAiSecretBridge["setSecret"];
    readonly deleteSecret: WorkbenchAiSecretBridge["deleteSecret"];
  };
  readonly remoteSyncLarkAuthActions?: WorkbenchRemoteSyncLarkAuthActions;
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
  const [remoteSyncLarkAuthStates, setRemoteSyncLarkAuthStates] = useState<Record<string, LarkAuthState>>({});
  const [remoteSyncLarkFolderStates, setRemoteSyncLarkFolderStates] = useState<Record<string, LarkFolderState>>({});
  const [remoteSyncLarkFolderNameDrafts, setRemoteSyncLarkFolderNameDrafts] = useState<Record<string, string>>({});
  const [activeSettingsSection, setActiveSettingsSection] = useState<SettingsSectionId>(defaultSettingsSectionId);
  const settingsContentRef = useRef<HTMLDivElement | null>(null);
  const nextAiProviderDraftIdRef = useRef(0);
  const nextRemoteSyncProviderDraftIdRef = useRef(0);
  const aiDiagnosticRequestIdsRef = useRef<Record<string, number>>({});
  const hasKeybindingOverrides = configuration.keybindings.overrides.length > 0;
  const hasUnsavedAiProviderDraft = aiProviderDrafts.some((draft) => !draft.originalId);
  const hasUnsavedRemoteSyncProviderDraft = remoteSyncProviderDrafts.some((draft) => !draft.originalId);
  const selectedThemeId = resolveSelectedSettingsThemeId(configuration.appearance.themeId, themes);
  const settingsLocalization = messages.settings.localization;
  const entryLabel = (entryId: SettingsEntryId) => getSettingsEntryLabel(entryId, settingsLocalization);
  const themeOptions = useMemo(() => createSettingsThemeOptions(themes).map((option) =>
    option.value ? option : { ...option, label: messages.settings.reasoningOptions[0]?.label ?? "Default" }
  ), [messages, themes]);
  const searchMaxFileSizeMegabytes = bytesToMegabytes(configuration.workspace.searchMaxFileSizeBytes);
  const settingsSearchResult = useMemo(
    () => createSettingsSearchResult(settingsQuery, settingsLocalization),
    [settingsLocalization, settingsQuery]
  );
  const settingsVisibility = useMemo(
    () => createSettingsVisibilityState(settingsSearchResult, settingsLocalization),
    [settingsLocalization, settingsSearchResult]
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
      setRemoteSyncLarkAuthStates({});
      setRemoteSyncLarkFolderStates({});
      setRemoteSyncLarkFolderNameDrafts({});
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

  const addLarkRemoteSyncProviderDraft = () => {
    const key = `new:${nextRemoteSyncProviderDraftIdRef.current++}`;
    const usedIds = [
      ...configuration.remoteSync.providers.map((provider) => provider.id),
      ...remoteSyncProviderDrafts.map((draft) => draft.id)
    ];

    setRemoteSyncProviderDrafts((drafts) => [...drafts, {
      key,
      ...createSettingsLarkRawMirrorProviderDraft(usedIds)
    }]);
  };

  const updateRemoteSyncProviderDraft = (
    key: string,
    value: Partial<SettingsRemoteSyncProviderDraft>
  ) => {
    setRemoteSyncProviderDrafts((drafts) => drafts.map((draft) =>
      draft.key === key ? { ...draft, ...value } : draft
    ));
    setRemoteSyncLarkAuthStates((states) => ({ ...states, [key]: { status: "idle" } }));
    setRemoteSyncLarkFolderStates((states) => ({ ...states, [key]: { status: "idle" } }));
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
    setRemoteSyncLarkAuthStates((states) => {
      const { [draft.key]: _removed, ...remaining } = states;
      return remaining;
    });
    setRemoteSyncLarkFolderStates((states) => {
      const { [draft.key]: _removed, ...remaining } = states;
      return remaining;
    });
    setRemoteSyncLarkFolderNameDrafts((drafts) => {
      const { [draft.key]: _removed, ...remaining } = drafts;
      return remaining;
    });
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

  const checkLarkAuthorization = (draft: RemoteSyncProviderDraftState, provider: RemoteSyncProviderConfiguration) => {
    if (!remoteSyncLarkAuthActions?.isAvailable) {
      return;
    }

    setRemoteSyncLarkAuthState(draft.key, { status: "checking" });
    void remoteSyncLarkAuthActions.checkAuthorization(provider).then((result) => {
      setRemoteSyncLarkAuthState(draft.key, result
        ? createLarkAuthStatusState(result)
        : { status: "failed" });
    });
  };

  const startLarkAuthorization = (draft: RemoteSyncProviderDraftState, provider: RemoteSyncProviderConfiguration) => {
    if (!remoteSyncLarkAuthActions?.isAvailable) {
      return;
    }

    setRemoteSyncLarkAuthState(draft.key, { status: "starting" });
    void remoteSyncLarkAuthActions.startAuthorization(provider).then((result) => {
      if (!result) {
        setRemoteSyncLarkAuthState(draft.key, { status: "failed" });
        return;
      }

      openLarkVerificationUrl(result);
      setRemoteSyncLarkAuthState(draft.key, createLarkAuthStartState(result));
    });
  };

  const completeLarkAuthorization = (
    draft: RemoteSyncProviderDraftState,
    provider: RemoteSyncProviderConfiguration,
    deviceCode: string | undefined
  ) => {
    if (!remoteSyncLarkAuthActions?.isAvailable || !deviceCode) {
      return;
    }

    setRemoteSyncLarkAuthState(draft.key, (state) => ({
      ...state,
      status: "completing"
    }));
    void remoteSyncLarkAuthActions.completeAuthorization(provider, deviceCode).then((result) => {
      setRemoteSyncLarkAuthState(draft.key, result
        ? createLarkAuthStatusState(result)
        : { status: "failed" });
    });
  };

  const listLarkFolders = (
    draft: RemoteSyncProviderDraftState,
    provider: RemoteSyncProviderConfiguration,
    parentToken = draft.remoteScopeId,
    path?: readonly LarkFolderPathEntry[]
  ) => {
    if (!remoteSyncLarkAuthActions?.isAvailable) {
      return;
    }

    const currentToken = parentToken ?? "";
    const currentPath = path ?? createLarkFolderPath(currentToken, messages);

    setRemoteSyncLarkFolderState(draft.key, {
      status: "loading",
      currentToken,
      path: currentPath
    });
    void remoteSyncLarkAuthActions.listFolders(provider, currentToken).then((folders) => {
      setRemoteSyncLarkFolderState(draft.key, folders
        ? {
            status: "ready",
            currentToken,
            folders,
            path: currentPath
          }
        : {
            status: "failed",
            currentToken,
            path: currentPath,
            folders: []
          });
    });
  };

  const openLarkFolder = (
    draft: RemoteSyncProviderDraftState,
    provider: RemoteSyncProviderConfiguration,
    folder: WorkbenchRemoteSyncLarkFolder
  ) => {
    const state = remoteSyncLarkFolderStates[draft.key];
    const currentPath = state?.path ?? createLarkFolderPath(state?.currentToken ?? draft.remoteScopeId ?? "", messages);
    listLarkFolders(draft, provider, folder.token, appendLarkFolderPath(currentPath, folder));
  };

  const createLarkFolder = (draft: RemoteSyncProviderDraftState, provider: RemoteSyncProviderConfiguration) => {
    if (!remoteSyncLarkAuthActions?.isAvailable) {
      return;
    }

    const normalizedName = getRemoteSyncLarkFolderNameDraft(draft.key).trim();

    if (!normalizedName) {
      setRemoteSyncLarkFolderState(draft.key, {
        status: "failed",
        folders: remoteSyncLarkFolderStates[draft.key]?.folders ?? [],
        message: messages.settings.larkFolderCreatePrompt
      });
      return;
    }

    const state = remoteSyncLarkFolderStates[draft.key];
    const parentToken = state?.currentToken ?? draft.remoteScopeId;
    const parentPath = state?.path ?? createLarkFolderPath(parentToken ?? "", messages);

    setRemoteSyncLarkFolderState(draft.key, {
      status: "creating",
      currentToken: parentToken ?? "",
      folders: state?.folders ?? [],
      path: parentPath
    });
    void remoteSyncLarkAuthActions.createFolder(provider, {
      name: normalizedName,
      parentToken
    }).then((folder) => {
      if (!folder) {
        setRemoteSyncLarkFolderState(draft.key, { status: "failed", folders: [] });
        return;
      }

      applyRemoteSyncProviderDraftRemoteScope(draft, folder.token);
      const folderPath = appendLarkFolderPath(parentPath, folder);
      setRemoteSyncLarkFolderState(draft.key, {
        status: "selected",
        currentToken: folder.token,
        folders: [folder],
        path: folderPath,
        message: messages.settings.larkFolderCreated
      });
      setRemoteSyncLarkFolderNameDraft(draft.key, "");
    });
  };

  const chooseLarkFolder = (
    draft: RemoteSyncProviderDraftState,
    token: string,
    path?: readonly LarkFolderPathEntry[]
  ) => {
    applyRemoteSyncProviderDraftRemoteScope(draft, token);
    setRemoteSyncLarkFolderState(draft.key, (state) => ({
      ...state,
      status: "selected",
      currentToken: token,
      folders: state.currentToken === token ? (state.folders ?? []) : [],
      path: path ?? state.path ?? createLarkFolderPath(token, messages),
      message: token ? messages.settings.larkFolderSelected : messages.settings.larkFolderRoot
    }));
  };

  const applyRemoteSyncProviderDraftRemoteScope = (draft: RemoteSyncProviderDraftState, remoteScopeId: string) => {
    const nextDraft = {
      ...draft,
      remoteScopeId
    };

    setRemoteSyncProviderDrafts((drafts) => drafts.map((candidate) =>
      candidate.key === draft.key ? nextDraft : candidate
    ));

    if (!draft.originalId) {
      return;
    }

    const nextProviders = upsertSettingsRemoteSyncProvider(
      configuration.remoteSync.providers,
      nextDraft,
      draft.originalId
    );

    if (nextProviders !== configuration.remoteSync.providers) {
      onUpdate({ remoteSync: { providers: nextProviders } });
    }
  };

  const setRemoteSyncLarkAuthState = (
    key: string,
    value: LarkAuthState | ((state: LarkAuthState) => LarkAuthState)
  ) => {
    setRemoteSyncLarkAuthStates((states) => {
      const currentState = states[key] ?? { status: "idle" as const };
      return {
        ...states,
        [key]: typeof value === "function" ? value(currentState) : value
      };
    });
  };

  const setRemoteSyncLarkFolderState = (
    key: string,
    value: LarkFolderState | ((state: LarkFolderState) => LarkFolderState)
  ) => {
    setRemoteSyncLarkFolderStates((states) => {
      const currentState = states[key] ?? { status: "idle" as const, folders: [] };
      return {
        ...states,
        [key]: typeof value === "function" ? value(currentState) : value
      };
    });
  };

  const getRemoteSyncLarkFolderNameDraft = (key: string): string =>
    remoteSyncLarkFolderNameDrafts[key] ?? "Typora Plus";

  const setRemoteSyncLarkFolderNameDraft = (key: string, value: string) => {
    setRemoteSyncLarkFolderNameDrafts((drafts) => ({
      ...drafts,
      [key]: value
    }));
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
      setAiDiagnosticMessages((currentMessages) => ({
        ...currentMessages,
        [draft.key]: response ? formatAiDiagnosticResponseMessage(response, messages) : ""
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
        aria-label={messages.settings.title}
        aria-modal="true"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="tp-dialog-header">
          <div className="tp-dialog-title tp-settings-title">
            <SettingsIcon size={18} />
            <span>{messages.settings.title}</span>
          </div>
          <SettingsIconButton title={messages.common.close} onClick={onClose}>
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
                aria-label={messages.settings.searchSettings}
                onChange={(event) => setSettingsQuery(event.target.value)}
              />
              {settingsQuery ? (
                <button
                  type="button"
                  aria-label={messages.settings.clearSettingsSearch}
                  onClick={() => setSettingsQuery("")}
                >
                  <X size={14} />
                </button>
              ) : <span aria-hidden="true" />}
            </div>
            <nav className="tp-settings-nav" aria-label={messages.settings.settingsSections}>
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
              <div className="tp-settings-empty-row">{messages.settings.noMatchingSettings}</div>
            ) : null}
            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.appearance) ? (
              <SettingsSection localization={settingsLocalization} sectionId={settingsSectionIds.appearance}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.appearance.theme) ? (
                  <SettingsField label={entryLabel(settingsEntryIds.appearance.theme)}>
                    <SegmentedControl
                      ariaLabel={entryLabel(settingsEntryIds.appearance.theme)}
                      value={configuration.appearance.colorScheme}
                      options={messages.settings.colorSchemeOptions}
                      onChange={(colorScheme) => onUpdate({ appearance: { colorScheme } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.appearance.customTheme) ? (
                  <SettingsField label={entryLabel(settingsEntryIds.appearance.customTheme)}>
                    <select
                      className="tp-settings-select"
                      value={selectedThemeId}
                      aria-label={entryLabel(settingsEntryIds.appearance.customTheme)}
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
                  <SettingsField label={entryLabel(settingsEntryIds.appearance.density)}>
                    <SegmentedControl
                      ariaLabel={entryLabel(settingsEntryIds.appearance.density)}
                      value={configuration.appearance.density}
                      options={messages.settings.densityOptions}
                      onChange={(density) => onUpdate({ appearance: { density } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.appearance.language) ? (
                  <SettingsField label={entryLabel(settingsEntryIds.appearance.language)}>
                    <SegmentedControl
                      ariaLabel={entryLabel(settingsEntryIds.appearance.language)}
                      value={configuration.appearance.locale}
                      options={messages.settings.localeOptions}
                      onChange={(locale) => onUpdate({ appearance: { locale } })}
                    />
                  </SettingsField>
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.editor) ? (
              <SettingsSection localization={settingsLocalization} sectionId={settingsSectionIds.editor}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.autoSave) ? (
                  <SettingsField label={entryLabel(settingsEntryIds.editor.autoSave)}>
                    <ToggleControl
                      checked={configuration.editor.autoSave}
                      label={entryLabel(settingsEntryIds.editor.autoSave)}
                      messages={messages}
                      onChange={(autoSave) => onUpdate({ editor: { autoSave } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.autoSaveDelay) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.editor.autoSaveDelay)}
                    value={configuration.editor.autoSaveDelayMs}
                    constraint={settingsNumberConstraints.editorAutoSaveDelayMs}
                    messages={messages}
                    unit={settingsNumberUnitIds.milliseconds}
                    onChange={(autoSaveDelayMs) => onUpdate({ editor: { autoSaveDelayMs } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.focusMode) ? (
                  <SettingsField label={entryLabel(settingsEntryIds.editor.focusMode)}>
                    <ToggleControl
                      checked={configuration.editor.focusMode}
                      label={entryLabel(settingsEntryIds.editor.focusMode)}
                      messages={messages}
                      onChange={(focusMode) => onUpdate({ editor: { focusMode } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.typewriterMode) ? (
                  <SettingsField label={entryLabel(settingsEntryIds.editor.typewriterMode)}>
                    <ToggleControl
                      checked={configuration.editor.typewriterMode}
                      label={entryLabel(settingsEntryIds.editor.typewriterMode)}
                      messages={messages}
                      onChange={(typewriterMode) => onUpdate({ editor: { typewriterMode } })}
                    />
                  </SettingsField>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.fontSize) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.editor.fontSize)}
                    value={configuration.editor.fontSize}
                    constraint={settingsNumberConstraints.editorFontSize}
                    messages={messages}
                    unit={settingsNumberUnitIds.pixels}
                    onChange={(fontSize) => onUpdate({ editor: { fontSize } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.lineHeight) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.editor.lineHeight)}
                    value={configuration.editor.lineHeight}
                    constraint={settingsNumberConstraints.editorLineHeight}
                    messages={messages}
                    onChange={(lineHeight) => onUpdate({ editor: { lineHeight } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.maxWidth) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.editor.maxWidth)}
                    value={configuration.editor.maxWidth}
                    constraint={settingsNumberConstraints.editorMaxWidth}
                    messages={messages}
                    unit={settingsNumberUnitIds.pixels}
                    onChange={(maxWidth) => onUpdate({ editor: { maxWidth } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.editor.rendererPreviewCacheEntries) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.editor.rendererPreviewCacheEntries)}
                    value={configuration.editor.rendererPreviewCacheEntries}
                    constraint={settingsNumberConstraints.editorRendererPreviewCacheEntries}
                    messages={messages}
                    unit={settingsNumberUnitIds.entries}
                    onChange={(rendererPreviewCacheEntries) => onUpdate({ editor: { rendererPreviewCacheEntries } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.ai) ? (
              <SettingsSection localization={settingsLocalization} sectionId={settingsSectionIds.ai}>
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
                        <span>{messages.settings.addProvider}</span>
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
                              <span>{draft.title || draft.id || messages.settings.aiProviderFallback}</span>
                              <div className="tp-settings-provider-card-actions">
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!canTestProvider}
                                  onClick={() => testAiProvider(draft)}
                                >
                                  <RefreshCw size={13} />
                                  <span>{formatAiDiagnosticButtonLabel(diagnosticState, messages)}</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!validation.canSave}
                                  onClick={() => saveAiProviderDraft(draft)}
                                >
                                  <Save size={13} />
                                  <span>{messages.common.save}</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  onClick={() => removeAiProviderDraft(draft)}
                                >
                                  <Trash2 size={13} />
                                  <span>{messages.common.remove}</span>
                                </button>
                              </div>
                            </div>
                            <SettingsField label={messages.settings.providerId}>
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.id}
                                aria-label={messages.settings.providerId}
                                onChange={(event) => updateAiProviderDraft(draft.key, { id: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.titleField}>
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.title}
                                aria-label={messages.settings.titleField}
                                onChange={(event) => updateAiProviderDraft(draft.key, { title: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.endpoint}>
                              <input
                                className="tp-settings-text-input"
                                type="url"
                                value={draft.endpointUrl}
                                aria-label={messages.settings.endpoint}
                                onChange={(event) => updateAiProviderDraft(draft.key, { endpointUrl: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.model}>
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.model}
                                aria-label={messages.settings.model}
                                onChange={(event) => updateAiProviderDraft(draft.key, { model: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.reasoning}>
                              <SegmentedControl
                                ariaLabel={messages.settings.reasoning}
                                value={draft.reasoningEffort}
                                options={messages.settings.reasoningOptions}
                                onChange={(reasoningEffort) => updateAiProviderDraft(draft.key, { reasoningEffort })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.verbosity}>
                              <SegmentedControl
                                ariaLabel={messages.settings.verbosity}
                                value={draft.textVerbosity}
                                options={messages.settings.textVerbosityOptions}
                                onChange={(textVerbosity) => updateAiProviderDraft(draft.key, { textVerbosity })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.maxOutput}>
                              <input
                                className="tp-settings-text-input"
                                type="number"
                                min={settingsNumberConstraints.aiProviderMaxOutputTokens.min}
                                max={settingsNumberConstraints.aiProviderMaxOutputTokens.max}
                                step={settingsNumberConstraints.aiProviderMaxOutputTokens.step}
                                value={draft.maxOutputTokens}
                                aria-label={messages.settings.maxOutput}
                                onChange={(event) => updateAiProviderDraft(draft.key, {
                                  maxOutputTokens: event.target.value
                                })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.secretRef}>
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.secretRef}
                                aria-label={messages.settings.secretRef}
                                onChange={(event) => updateAiProviderDraft(draft.key, { secretRef: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.storeResponse}>
                              <ToggleControl
                                checked={draft.store}
                                label={messages.settings.storeResponse}
                                messages={messages}
                                onChange={(store) => updateAiProviderDraft(draft.key, { store })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.apiKey}>
                              <span className="tp-settings-secret-control">
                                <input
                                  className="tp-settings-text-input"
                                  type="password"
                                  value={secretValue}
                                  aria-label={messages.settings.apiKey}
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
                                  <span>{formatSecretSaveLabel(secretState, messages)}</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!canDeleteSecret}
                                  onClick={() => deleteAiSecret(draft)}
                                >
                                  <Trash2 size={13} />
                                  <span>{formatSecretDeleteLabel(secretState, messages)}</span>
                                </button>
                              </span>
                            </SettingsField>
                            {validation.issues.length > 0 ? (
                              <div className="tp-settings-validation-row">
                                {formatFirstSettingsValidationIssue(validation.issues, messages)}
                              </div>
                            ) : null}
                            {diagnosticState !== "idle" ? (
                              <div className={`tp-settings-diagnostic-row tp-settings-diagnostic-row-${diagnosticState}`}>
                                {formatAiDiagnosticStatusMessage(diagnosticState, diagnosticMessage, messages)}
                              </div>
                            ) : null}
                          </section>
                        );
                      })}
                      {aiProviderDrafts.length === 0 ? (
                        <div className="tp-settings-empty-row">{messages.settings.noAiProviders}</div>
                      ) : null}
                    </div>
                  </>
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.ai.workspaceContextMaxResults) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.ai.workspaceContextMaxResults)}
                    value={configuration.ai.workspaceContextMaxResults}
                    constraint={settingsNumberConstraints.aiWorkspaceContextMaxResults}
                    messages={messages}
                    onChange={(workspaceContextMaxResults) => onUpdate({ ai: { workspaceContextMaxResults } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.ai.workspaceContextMaxPreviewLength) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.ai.workspaceContextMaxPreviewLength)}
                    value={configuration.ai.workspaceContextMaxPreviewLength}
                    constraint={settingsNumberConstraints.aiWorkspaceContextMaxPreviewLength}
                    messages={messages}
                    unit={settingsNumberUnitIds.characters}
                    onChange={(workspaceContextMaxPreviewLength) => onUpdate({ ai: { workspaceContextMaxPreviewLength } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.remoteSync) ? (
              <SettingsSection localization={settingsLocalization} sectionId={settingsSectionIds.remoteSync}>
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
                        <span>{messages.settings.addProfile}</span>
                      </button>
                      <button
                        className="tp-settings-small-button"
                        type="button"
                        disabled={
                          !canAddSettingsRemoteSyncProvider(configuration.remoteSync.providers) ||
                          hasUnsavedRemoteSyncProviderDraft
                        }
                        onClick={addLarkRemoteSyncProviderDraft}
                      >
                        <Plus size={13} />
                        <span>{messages.settings.addLarkProfile}</span>
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
                        const larkAuthState = remoteSyncLarkAuthStates[draft.key] ?? { status: "idle" as const };
                        const larkFolderState = remoteSyncLarkFolderStates[draft.key] ?? { status: "idle" as const, folders: [] };
                        const showLarkAuthorization = isSettingsLarkRawMirrorProviderDraft(draft);
                        const canUseLarkAuthorization = !!validation.provider && !!remoteSyncLarkAuthActions?.isAvailable;
                        const larkFolderNameDraft = getRemoteSyncLarkFolderNameDraft(draft.key);
                        const larkAuthStatusMessage = formatLarkAuthStatusMessage(larkAuthState, messages);
                        const larkFolderStatusMessage = formatLarkFolderStatusMessage(larkFolderState, messages);
                        const larkFolderCurrentToken = larkFolderState.currentToken ?? draft.remoteScopeId ?? "";
                        const larkFolderPath = larkFolderState.path ??
                          createLarkFolderPath(larkFolderCurrentToken, messages);

                        return (
                          <section className="tp-settings-provider-card" key={draft.key}>
                            <div className="tp-settings-provider-card-header">
                              <span>{draft.title || draft.id || messages.settings.remoteSyncProfileFallback}</span>
                              <div className="tp-settings-provider-card-actions">
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  disabled={!validation.canSave}
                                  onClick={() => saveRemoteSyncProviderDraft(draft)}
                                >
                                  <Save size={13} />
                                  <span>{messages.common.save}</span>
                                </button>
                                <button
                                  className="tp-settings-small-button"
                                  type="button"
                                  onClick={() => removeRemoteSyncProviderDraft(draft)}
                                >
                                  <Trash2 size={13} />
                                  <span>{messages.common.remove}</span>
                                </button>
                              </div>
                            </div>
                            <SettingsField label={messages.settings.providerId}>
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.id}
                                aria-label={messages.settings.providerId}
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { id: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.titleField}>
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.title}
                                aria-label={messages.settings.titleField}
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { title: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.baseUrl}>
                              <input
                                className="tp-settings-text-input"
                                type="url"
                                value={draft.baseUrl}
                                aria-label={messages.settings.baseUrl}
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { baseUrl: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.remoteScope}>
                              <input
                                className="tp-settings-text-input"
                                type="text"
                                value={draft.remoteScopeId}
                                aria-label={messages.settings.remoteScope}
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { remoteScopeId: event.target.value })}
                              />
                            </SettingsField>
                            <RawMirrorSettingsFields
                              draft={draft}
                              messages={messages}
                              onChange={(updatedDraft) =>
                                updateRemoteSyncProviderDraft(draft.key, { metadataText: updatedDraft.metadataText })}
                            />
                            {showLarkAuthorization ? (
                              <SettingsField label={messages.settings.larkAuthorization}>
                                <span className="tp-settings-lark-auth-control">
                                  <span className="tp-settings-lark-auth-actions">
                                    <button
                                      className="tp-settings-small-button"
                                      type="button"
                                      disabled={!canUseLarkAuthorization}
                                      onClick={() => validation.provider && checkLarkAuthorization(draft, validation.provider)}
                                    >
                                      <RefreshCw size={13} />
                                      <span>{messages.settings.larkAuthCheck}</span>
                                    </button>
                                    <button
                                      className="tp-settings-small-button"
                                      type="button"
                                      disabled={!canUseLarkAuthorization || larkAuthState.status === "starting"}
                                      onClick={() => validation.provider && startLarkAuthorization(draft, validation.provider)}
                                    >
                                      <KeyRound size={13} />
                                      <span>{messages.settings.larkAuthStart}</span>
                                    </button>
                                    <button
                                      className="tp-settings-small-button"
                                      type="button"
                                      disabled={
                                        !canUseLarkAuthorization ||
                                        !larkAuthState.deviceCode ||
                                        larkAuthState.status === "completing"
                                      }
                                      onClick={() => validation.provider &&
                                        completeLarkAuthorization(draft, validation.provider, larkAuthState.deviceCode)}
                                    >
                                      <Save size={13} />
                                      <span>{messages.settings.larkAuthComplete}</span>
                                    </button>
                                  </span>
                                  {larkAuthStatusMessage ? (
                                    <span className={`tp-settings-lark-auth-status tp-settings-lark-auth-status-${larkAuthState.status}`}>
                                      {larkAuthStatusMessage}
                                    </span>
                                  ) : null}
                                  {larkAuthState.userCode ? (
                                    <span className="tp-settings-lark-auth-detail">
                                      <small>{messages.settings.larkAuthDeviceCode}</small>
                                      <code>{larkAuthState.userCode}</code>
                                    </span>
                                  ) : null}
                                  {larkAuthState.verificationUrl ? (
                                    <a
                                      className="tp-settings-lark-auth-link"
                                      href={larkAuthState.verificationUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                    >
                                      {messages.settings.larkAuthUrl}
                                    </a>
                                  ) : null}
                                </span>
                              </SettingsField>
                            ) : null}
                            {showLarkAuthorization ? (
                              <SettingsField label={messages.settings.larkFolderTools}>
                                <span className="tp-settings-lark-folder-control">
                                  <input
                                    className="tp-settings-text-input tp-settings-lark-folder-name-input"
                                    type="text"
                                    value={larkFolderNameDraft}
                                    aria-label={messages.settings.larkFolderCreatePrompt}
                                    placeholder={messages.settings.larkFolderCreatePrompt}
                                    disabled={!canUseLarkAuthorization || larkFolderState.status === "creating"}
                                    onChange={(event) =>
                                      setRemoteSyncLarkFolderNameDraft(draft.key, event.target.value)}
                                  />
                                  <span className="tp-settings-lark-auth-actions">
                                    <button
                                      className="tp-settings-small-button"
                                      type="button"
                                      disabled={!canUseLarkAuthorization || larkFolderState.status === "loading"}
                                      onClick={() => validation.provider &&
                                        listLarkFolders(draft, validation.provider, larkFolderCurrentToken, larkFolderPath)}
                                    >
                                      <FolderOpen size={13} />
                                      <span>{messages.settings.larkFolderList}</span>
                                    </button>
                                    <button
                                      className="tp-settings-small-button"
                                      type="button"
                                      disabled={
                                        !canUseLarkAuthorization ||
                                        larkFolderState.status === "creating" ||
                                        !larkFolderNameDraft.trim()
                                      }
                                      onClick={() => validation.provider && createLarkFolder(draft, validation.provider)}
                                    >
                                      <FolderPlus size={13} />
                                      <span>{messages.settings.larkFolderCreate}</span>
                                    </button>
                                    <button
                                      className="tp-settings-small-button"
                                      type="button"
                                      disabled={!canUseLarkAuthorization}
                                      onClick={() => chooseLarkFolder(draft, "", createLarkFolderPath("", messages))}
                                    >
                                      <RefreshCw size={13} />
                                      <span>{messages.settings.larkFolderRoot}</span>
                                    </button>
                                  </span>
                                  <span className="tp-settings-lark-folder-current">
                                    <small>{messages.settings.larkFolderCurrent}</small>
                                    <span>{larkFolderPath.map((entry) => entry.name).join(" / ")}</span>
                                    <button
                                      className="tp-settings-small-button"
                                      type="button"
                                      disabled={!canUseLarkAuthorization}
                                      onClick={() => chooseLarkFolder(draft, larkFolderCurrentToken, larkFolderPath)}
                                    >
                                      <Check size={13} />
                                      <span>{messages.settings.larkFolderSelectCurrent}</span>
                                    </button>
                                  </span>
                                  {(larkFolderState.folders?.length ?? 0) > 0 ? (
                                    <span className="tp-settings-lark-folder-list" aria-label={messages.settings.larkFolderSelect}>
                                      {larkFolderState.folders?.map((folder) => {
                                        const folderPath = appendLarkFolderPath(larkFolderPath, folder);

                                        return (
                                          <span className="tp-settings-lark-folder-row" key={folder.token}>
                                            <button
                                              className="tp-settings-lark-folder-name"
                                              type="button"
                                              disabled={!canUseLarkAuthorization}
                                              onClick={() => validation.provider &&
                                                openLarkFolder(draft, validation.provider, folder)}
                                            >
                                              <FolderOpen size={13} />
                                              <span>{folder.name}</span>
                                            </button>
                                            <button
                                              className="tp-settings-small-button"
                                              type="button"
                                              disabled={!canUseLarkAuthorization}
                                              onClick={() => chooseLarkFolder(draft, folder.token, folderPath)}
                                            >
                                              <Check size={13} />
                                              <span>{messages.settings.larkFolderSelect}</span>
                                            </button>
                                          </span>
                                        );
                                      })}
                                    </span>
                                  ) : null}
                                  {larkFolderStatusMessage ? (
                                    <span className={`tp-settings-lark-auth-status tp-settings-lark-auth-status-${larkFolderState.status === "failed" ? "failed" : "authorized"}`}>
                                      {larkFolderStatusMessage}
                                    </span>
                                  ) : null}
                                </span>
                              </SettingsField>
                            ) : null}
                            <SettingsField label={messages.settings.secretBindings}>
                              <textarea
                                className="tp-settings-textarea"
                                value={draft.secretsText}
                                aria-label={messages.settings.secretBindings}
                                onChange={(event) => updateRemoteSyncProviderDraft(draft.key, { secretsText: event.target.value })}
                              />
                            </SettingsField>
                            <SettingsField label={messages.settings.metadata}>
                              <textarea
                                className="tp-settings-textarea"
                                value={draft.metadataText}
                                aria-label={messages.settings.metadata}
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
                                          aria-label={formatRemoteSyncSecretAriaLabel(secret.name, messages)}
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
                                          <span>{formatSecretSaveLabel(secretState, messages)}</span>
                                        </button>
                                        <button
                                          className="tp-settings-small-button"
                                          type="button"
                                          disabled={!canDeleteSecret}
                                          onClick={() => deleteRemoteSyncSecret(secretKey, secret.secretRef)}
                                        >
                                          <Trash2 size={13} />
                                          <span>{formatSecretDeleteLabel(secretState, messages)}</span>
                                        </button>
                                      </span>
                                    </SettingsField>
                                  );
                                })}
                              </div>
                            ) : null}
                            {validation.issues.length > 0 ? (
                              <div className="tp-settings-validation-row">
                                {formatFirstSettingsValidationIssue(validation.issues, messages)}
                              </div>
                            ) : null}
                          </section>
                        );
                      })}
                      {remoteSyncProviderDrafts.length === 0 ? (
                        <div className="tp-settings-empty-row">{messages.settings.noRemoteSyncProfiles}</div>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.workspace) ? (
              <SettingsSection localization={settingsLocalization} sectionId={settingsSectionIds.workspace}>
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.workspace.defaultAssetFolder) ? (
                  <SettingsField label={entryLabel(settingsEntryIds.workspace.defaultAssetFolder)}>
                    <input
                      className="tp-settings-text-input"
                      type="text"
                      value={assetFolderDraft}
                      aria-label={entryLabel(settingsEntryIds.workspace.defaultAssetFolder)}
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
                    label={entryLabel(settingsEntryIds.workspace.searchMaxFileSize)}
                    value={searchMaxFileSizeMegabytes}
                    constraint={settingsNumberConstraints.workspaceSearchMaxFileSizeMegabytes}
                    messages={messages}
                    unit={settingsNumberUnitIds.megabytes}
                    onChange={(value) => onUpdate({
                      workspace: {
                        searchMaxFileSizeBytes: megabytesToBytes(value)
                      }
                    })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.workspace.quickOpenMaxResults) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.workspace.quickOpenMaxResults)}
                    value={configuration.workspace.quickOpenMaxResults}
                    constraint={settingsNumberConstraints.workspaceQuickOpenMaxResults}
                    messages={messages}
                    onChange={(quickOpenMaxResults) => onUpdate({ workspace: { quickOpenMaxResults } })}
                  />
                ) : null}
                {isSettingsEntryVisible(settingsVisibility, settingsEntryIds.workspace.searchMaxResults) ? (
                  <NumberSetting
                    label={entryLabel(settingsEntryIds.workspace.searchMaxResults)}
                    value={configuration.workspace.searchMaxResults}
                    constraint={settingsNumberConstraints.workspaceSearchMaxResults}
                    messages={messages}
                    onChange={(searchMaxResults) => onUpdate({ workspace: { searchMaxResults } })}
                  />
                ) : null}
              </SettingsSection>
            ) : null}

            {isSettingsSectionVisible(settingsVisibility, settingsSectionIds.keybindings) ? (
              <SettingsSection localization={settingsLocalization} sectionId={settingsSectionIds.keybindings}>
                <div className="tp-settings-keybinding-search">
                  <Search size={15} />
                  <input
                    type="search"
                    value={keybindingQuery}
                    aria-label={messages.settings.keybindingsSearch}
                    onChange={(event) => setKeybindingQuery(event.target.value)}
                  />
                  {keybindingQuery ? (
                    <button
                      type="button"
                      aria-label={messages.settings.clearKeybindingSearch}
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
                      aria-label={messages.settings.modifiedKeybindings}
                      onChange={(event) => setModifiedKeybindingsOnly(event.target.checked)}
                    />
                    <span>{messages.settings.modified}</span>
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
                    {messages.settings.resetAll}
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
                          {recording ? messages.settings.pressKeys : getKeybindingLabel(command.id) ?? messages.settings.unassigned}
                        </kbd>
                        <button
                          className="tp-settings-small-button"
                          type="button"
                          onClick={() => {
                            setPendingKeybinding(undefined);
                            setRecordingCommand(command.id);
                          }}
                        >
                          {messages.settings.record}
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
                          {messages.common.reset}
                        </button>
                        {pendingKeybinding?.command === command.id ? (
                          <div className="tp-settings-keybinding-conflict">
                            <span>
                              {messages.settings.keybindingConflict(
                                pendingKeybinding.label,
                                commandTitle(commands, pendingKeybinding.conflictCommand)
                              )}
                            </span>
                            <button
                              className="tp-settings-small-button"
                              type="button"
                              onClick={() => {
                                applyKeybindingOverride(configuration, pendingKeybinding, onUpdate);
                                setPendingKeybinding(undefined);
                              }}
                            >
                              {messages.settings.replace}
                            </button>
                            <button
                              className="tp-settings-small-button"
                              type="button"
                              onClick={() => setPendingKeybinding(undefined)}
                            >
                              {messages.common.cancel}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                  {filteredKeybindingCommands.length === 0 ? (
                    <div className="tp-settings-empty-row">
                      {modifiedKeybindingsOnly && !hasKeybindingOverrides
                        ? messages.settings.noModifiedShortcuts
                        : messages.settings.noMatchingCommands}
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
type LarkAuthStatusState = "authorized" | "checking" | "completing" | "failed" | "idle" | "ready" | "starting";
type LarkFolderStatusState = "creating" | "failed" | "idle" | "loading" | "ready" | "selected";

interface LarkAuthState {
  readonly status: LarkAuthStatusState;
  readonly deviceCode?: string;
  readonly userCode?: string;
  readonly verificationUrl?: string;
}

interface LarkFolderState {
  readonly status: LarkFolderStatusState;
  readonly currentToken?: string;
  readonly folders?: readonly WorkbenchRemoteSyncLarkFolder[];
  readonly message?: string;
  readonly path?: readonly LarkFolderPathEntry[];
}

interface LarkFolderPathEntry {
  readonly name: string;
  readonly token: string;
}

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

function createLarkAuthStartState(result: WorkbenchRemoteSyncLarkAuthStart): LarkAuthState {
  return {
    status: "ready",
    deviceCode: result.deviceCode,
    ...(result.userCode ? { userCode: result.userCode } : {}),
    ...(result.verificationUrl ? { verificationUrl: result.verificationUrl } : {})
  };
}

function createLarkAuthStatusState(result: WorkbenchRemoteSyncLarkAuthStatus): LarkAuthState {
  return {
    status: result.authorized ? "authorized" : "failed"
  };
}

function createLarkFolderPath(
  token: string,
  messages: WorkbenchMessages
): readonly LarkFolderPathEntry[] {
  return [{
    name: token ? messages.settings.larkFolderCurrent : messages.settings.larkFolderRoot,
    token
  }];
}

function appendLarkFolderPath(
  path: readonly LarkFolderPathEntry[],
  folder: WorkbenchRemoteSyncLarkFolder
): readonly LarkFolderPathEntry[] {
  const existingIndex = path.findIndex((entry) => entry.token === folder.token);

  if (existingIndex >= 0) {
    return path.slice(0, existingIndex + 1);
  }

  return [
    ...path,
    {
      name: folder.name,
      token: folder.token
    }
  ];
}

function openLarkVerificationUrl(result: WorkbenchRemoteSyncLarkAuthStart): void {
  if (!result.verificationUrl || typeof window === "undefined") {
    return;
  }

  window.open(result.verificationUrl, "_blank", "noopener,noreferrer");
}

function remoteSyncSecretStateKey(
  draftKey: string,
  secret: RemoteSyncProviderSecretConfiguration
): string {
  return `${draftKey}:${secret.name}:${secret.secretRef}`;
}

function formatSecretSaveLabel(state: SecretState, messages: WorkbenchMessages): string {
  switch (state) {
    case "saved":
      return messages.common.saved;
    case "failed":
      return messages.common.failed;
    case "deleted":
    case "idle":
      return messages.settings.saveKey;
  }
}

function formatFirstSettingsValidationIssue(
  issues: readonly SettingsValidationIssueCode[],
  messages: WorkbenchMessages
): string | undefined {
  const firstIssue = issues[0];
  return firstIssue ? formatSettingsValidationIssue(firstIssue, messages) : undefined;
}

function formatSecretDeleteLabel(state: SecretState, messages: WorkbenchMessages): string {
  switch (state) {
    case "deleted":
      return messages.common.deleted;
    case "failed":
      return messages.common.failed;
    case "saved":
    case "idle":
      return messages.common.delete;
  }
}

function formatAiDiagnosticButtonLabel(state: AiDiagnosticState, messages: WorkbenchMessages): string {
  return state === "testing" ? messages.common.testing : messages.common.test;
}

function formatAiDiagnosticStatusMessage(
  state: AiDiagnosticState,
  message: string,
  messages: WorkbenchMessages
): string {
  switch (state) {
    case "testing":
      return messages.settings.diagnosticTestingProvider;
    case "passed":
      return message
        ? messages.settings.diagnosticConnectionOkWithMessage(message)
        : messages.settings.diagnosticConnectionOk;
    case "failed":
      return messages.settings.diagnosticConnectionFailed;
    case "idle":
      return "";
  }
}

function formatAiDiagnosticResponseMessage(response: AiTextResponse, messages: WorkbenchMessages): string {
  return messages.settings.diagnosticResponseMetadata([
    response.model,
    formatWorkbenchAiTokenUsage(response.usage, messages.dialogs.aiResponse.tokenUsage)
  ].filter((part): part is string => !!part));
}

function formatLarkAuthStatusMessage(state: LarkAuthState, messages: WorkbenchMessages): string {
  switch (state.status) {
    case "checking":
    case "starting":
    case "completing":
      return messages.common.testing;
    case "ready":
      return messages.settings.larkAuthReady;
    case "authorized":
      return messages.settings.larkAuthAuthorized;
    case "failed":
      return messages.settings.larkAuthFailed;
    case "idle":
      return "";
  }
}

function formatLarkFolderStatusMessage(state: LarkFolderState, messages: WorkbenchMessages): string {
  switch (state.status) {
    case "creating":
    case "loading":
      return messages.common.testing;
    case "ready":
      return state.folders && state.folders.length > 0 ? "" : messages.settings.larkFolderNone;
    case "selected":
      return state.message ?? messages.settings.larkFolderSelected;
    case "failed":
      return messages.settings.larkFolderListFailed;
    case "idle":
      return "";
  }
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
  localization,
  children
}: {
  readonly sectionId: SettingsSectionId;
  readonly localization: Parameters<typeof getSettingsSectionTitle>[1];
  readonly children: ReactNode;
}) {
  const title = getSettingsSectionTitle(sectionId, localization);

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
  messages,
  onChange
}: {
  readonly draft: SettingsRemoteSyncProviderDraft;
  readonly messages: WorkbenchMessages;
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
      <SettingsField label={messages.settings.rawMirror}>
        <ToggleControl
          checked={rawMirrorDraft.enabled}
          label={messages.settings.rawMirror}
          messages={messages}
          onChange={(enabled) => updateRawMirrorDraft({ enabled })}
        />
      </SettingsField>
      {rawMirrorDraft.enabled ? (
        <>
          <SettingsField label={messages.settings.listPath}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.listPath}
              aria-label={messages.settings.listPath}
              onChange={(event) => updateRawMirrorDraft({ listPath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.pageSize}>
            <input
              className="tp-settings-number-input"
              type="number"
              min={remoteSyncConfiguredRawMirrorListLimits.minPageSize}
              max={remoteSyncConfiguredRawMirrorListLimits.maxPageSize}
              step={1}
              value={rawMirrorDraft.listPageSize}
              aria-label={messages.settings.pageSize}
              onChange={(event) => updateRawMirrorDraft({ listPageSize: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.uploadPath}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.uploadPath}
              aria-label={messages.settings.uploadPath}
              onChange={(event) => updateRawMirrorDraft({ uploadPath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.downloadPath}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.downloadPath}
              aria-label={messages.settings.downloadPath}
              onChange={(event) => updateRawMirrorDraft({ downloadPath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.deletePath}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.deletePath}
              aria-label={messages.settings.deletePath}
              onChange={(event) => updateRawMirrorDraft({ deletePath: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.deleteMissing}>
            <ToggleControl
              checked={rawMirrorDraft.deleteMissing}
              label={messages.settings.deleteMissing}
              messages={messages}
              onChange={(deleteMissing) => updateRawMirrorDraft({ deleteMissing })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.headerBinding}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.headerBinding}
              aria-label={messages.settings.headerBinding}
              onChange={(event) => updateRawMirrorDraft({ headerBinding: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.headerName}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.headerName}
              aria-label={messages.settings.headerName}
              onChange={(event) => updateRawMirrorDraft({ headerName: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.headerScheme}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.headerScheme}
              aria-label={messages.settings.headerScheme}
              onChange={(event) => updateRawMirrorDraft({ headerScheme: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.retryStatus}>
            <input
              className="tp-settings-text-input"
              type="text"
              value={rawMirrorDraft.retryStatusCodes}
              aria-label={messages.settings.retryStatus}
              onChange={(event) => updateRawMirrorDraft({ retryStatusCodes: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.retryCount}>
            <input
              className="tp-settings-number-input"
              type="number"
              min={0}
              max={remoteSyncConfiguredRawMirrorRetryLimits.maxRetries}
              step={1}
              value={rawMirrorDraft.retryMaxRetries}
              aria-label={messages.settings.retryCount}
              onChange={(event) => updateRawMirrorDraft({ retryMaxRetries: event.target.value })}
            />
          </SettingsField>
          <SettingsField label={messages.settings.retryDelay}>
            <input
              className="tp-settings-number-input"
              type="number"
              min={0}
              max={remoteSyncConfiguredRawMirrorRetryLimits.maxDelayMs}
              step={1}
              value={rawMirrorDraft.retryDelayMs}
              aria-label={messages.settings.retryDelay}
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
  messages,
  onChange
}: {
  readonly checked: boolean;
  readonly label: string;
  readonly messages: WorkbenchMessages;
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
      <span>{checked ? messages.common.on : messages.common.off}</span>
    </label>
  );
}

function NumberSetting({
  label,
  value,
  constraint,
  messages,
  unit,
  onChange
}: {
  readonly label: string;
  readonly value: number;
  readonly constraint: NumberSettingConstraint;
  readonly messages: WorkbenchMessages;
  readonly unit?: SettingsNumberUnitId;
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
          aria-label={messages.settings.numberValueAriaLabel(label)}
          onChange={(event) => updateValue(event.target.value)}
          onBlur={(event) => updateValue(event.target.value)}
        />
        {unit ? <span className="tp-settings-unit">{messages.settings.units[unit]}</span> : null}
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
