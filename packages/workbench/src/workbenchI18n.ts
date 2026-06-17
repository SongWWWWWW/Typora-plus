import {
  defaultMarkdownEditorLabels,
  type MarkdownEditorLabels
} from "@typora-plus/editor";
import {
  defaultTyporaPlusLocale,
  typoraPlusLocales,
  type AiProviderReasoningEffort,
  type AiProviderTextVerbosity,
  type ColorSchemePreference,
  type CommandMetadata,
  type MenuItem,
  type TyporaPlusLocale
} from "@typora-plus/platform";
import {
  settingsEntryIds,
  settingsSectionIds,
  settingsValidationIssueCodes,
  type SettingsLocalization,
  type SettingsOption,
  type SettingsValidationIssueCode
} from "./settingsModel";
import {
  defaultWorkbenchActionRunnerMessages,
  type WorkbenchActionRunnerMessages
} from "./workbenchActionRunner";
import {
  defaultWorkbenchAiActionMessages,
  type WorkbenchAiActionMessages
} from "./workbenchAiActions";
import {
  defaultWorkbenchAiRequestMessages,
  workbenchAiRequestActions,
  type WorkbenchAiRequestMessages,
  type WorkbenchAiRequestAction
} from "./workbenchAiRequestModel";
import {
  defaultWorkbenchAiProviderDiagnosticMessages,
  type WorkbenchAiProviderDiagnosticMessages
} from "./workbenchAiProviderDiagnostics";
import {
  defaultWorkbenchAiSecretMessages,
  type WorkbenchAiSecretMessages
} from "./workbenchAiSecrets";
import type { WorkbenchAiWorkspaceContextMessages } from "./workbenchAiWorkspaceContext";
import type {
  WorkbenchAiTokenUsageMessages,
  WorkbenchExtractedTaskMessages,
  WorkbenchAiResponseApplyMode,
  WorkbenchAiResponseApplyState
} from "./workbenchAiResponseModel";
import { workbenchCommandIds } from "./workbenchCommandIds";
import { workbenchCommandCategories } from "./workbenchCommandMetadata";
import {
  defaultWorkbenchRemoteSyncActionMessages,
  workbenchRemoteSyncConflictResolutions,
  workbenchRemoteSyncPlanExecutionBlockReasons,
  type WorkbenchRemoteSyncActionMessages
} from "./workbenchRemoteSyncActions";
import type { WorkbenchRemoteSyncDialogMessages } from "./workbenchRemoteSyncDialogModel";
import {
  defaultWorkbenchRemoteSyncMarkdownAssetMessages,
  type WorkbenchRemoteSyncMarkdownAssetMessages
} from "./workbenchRemoteSyncMarkdownAssets";
import {
  defaultWorkbenchRemoteSyncRequestMessages,
  type WorkbenchRemoteSyncRequestMessages
} from "./workbenchRemoteSyncRequestModel";
import {
  workbenchSideViews,
  type WorkbenchSideView
} from "./workbenchSideViewModel";
import {
  defaultWorkbenchRemoteSyncSecretMessages,
  type WorkbenchRemoteSyncSecretMessages
} from "./workbenchRemoteSyncSecrets";
import {
  defaultWorkbenchRemoteSyncLarkAuthMessages,
  type WorkbenchRemoteSyncLarkAuthMessages
} from "./workbenchRemoteSyncLarkAuth";

export type WorkbenchLocale = TyporaPlusLocale;

export const settingsNumberUnitIds = {
  characters: "characters",
  entries: "entries",
  megabytes: "megabytes",
  milliseconds: "milliseconds",
  pixels: "pixels"
} as const satisfies Record<string, string>;

export type SettingsNumberUnitId = typeof settingsNumberUnitIds[keyof typeof settingsNumberUnitIds];

const enWorkbenchLocaleOptionLabels = {
  en: "English",
  "zh-CN": "中文"
} as const satisfies Record<TyporaPlusLocale, string>;

const zhCNWorkbenchLocaleOptionLabels = {
  en: "English",
  "zh-CN": "中文"
} as const satisfies Record<TyporaPlusLocale, string>;

function createWorkbenchLocaleOptions(
  labels: Readonly<Record<TyporaPlusLocale, string>>
): readonly SettingsOption<TyporaPlusLocale>[] {
  return typoraPlusLocales.map((value) => ({
    value,
    label: labels[value]
  }));
}

type CommonMessageId =
  | "cancel"
  | "close"
  | "copied"
  | "copy"
  | "copyFailed"
  | "delete"
  | "deleted"
  | "failed"
  | "off"
  | "on"
  | "remove"
  | "reset"
  | "save"
  | "saved"
  | "test"
  | "testing";

type ShellMessageId =
  | "clearSearch"
  | "closeSidebar"
  | "defaultNewFileName"
  | "defaultNewFolderName"
  | "editorAriaLabel"
  | "markdownEditorMode"
  | "markdownPreviewAriaLabel"
  | "markdownPreviewMode"
  | "folderSyncCreateFolder"
  | "folderSyncCreateName"
  | "folderSyncCreating"
  | "folderSyncCurrentRemote"
  | "folderSyncLocalTarget"
  | "folderSyncLoading"
  | "folderSyncNoFolders"
  | "folderSyncOpenFolder"
  | "folderSyncProvider"
  | "folderSyncRemoteFolders"
  | "folderSyncRoot"
  | "folderSyncSelectCurrent"
  | "folderSyncSelectFolder"
  | "newFile"
  | "newFileNamePrompt"
  | "newFolder"
  | "newFolderNamePrompt"
  | "noBacklinks"
  | "noTags"
  | "notes"
  | "openWorkspace"
  | "primaryNavigation"
  | "recentFiles"
  | "recentWorkspaces"
  | "refreshWorkspace"
  | "remoteSyncNoProvider"
  | "renameEntry"
  | "renameFileNamePrompt"
  | "renameFolderNamePrompt"
  | "search"
  | "searchNote"
  | "showWorkspaceActions"
  | "syncDirectory"
  | "tagsAriaLabel"
  | "unsyncDirectory"
  | "unsavedChanges"
  | "workspaceTreeActions";

type SettingsStringMessageId =
  | "aiProviderFallback"
  | "apiKey"
  | "baseUrl"
  | "clearKeybindingSearch"
  | "clearSettingsSearch"
  | "deleteMissing"
  | "diagnosticConnectionFailed"
  | "diagnosticConnectionOk"
  | "diagnosticTestingProvider"
  | "endpoint"
  | "headerBinding"
  | "headerName"
  | "headerScheme"
  | "keybindingsSearch"
  | "listPath"
  | "maxOutput"
  | "metadata"
  | "model"
  | "modified"
  | "modifiedKeybindings"
  | "noAiProviders"
  | "noMatchingCommands"
  | "noMatchingSettings"
  | "noModifiedShortcuts"
  | "noRemoteSyncProfiles"
  | "pageSize"
  | "pressKeys"
  | "providerId"
  | "rawMirror"
  | "reasoning"
  | "record"
  | "remoteScope"
  | "remoteSyncSecret"
  | "remoteSyncProfileFallback"
  | "replace"
  | "resetAll"
  | "retryCount"
  | "retryDelay"
  | "retryStatus"
  | "saveKey"
  | "searchSettings"
  | "secretBindings"
  | "secretRef"
  | "settingsSections"
  | "storeResponse"
  | "title"
  | "titleField"
  | "unassigned"
  | "uploadPath"
  | "downloadPath"
  | "deletePath"
  | "valueSuffix"
  | "verbosity"
  | "addProvider"
  | "addProfile"
  | "addLarkProfile"
  | "larkAuthorization"
  | "larkAuthCheck"
  | "larkAuthStart"
  | "larkAuthComplete"
  | "larkAuthReady"
  | "larkAuthAuthorized"
  | "larkAuthFailed"
  | "larkAuthDeviceCode"
  | "larkAuthUrl"
  | "larkFolderCreate"
  | "larkFolderCreatePrompt"
  | "larkFolderCreated"
  | "larkFolderCurrent"
  | "larkFolderEnter"
  | "larkFolderList"
  | "larkFolderListFailed"
  | "larkFolderNone"
  | "larkFolderRoot"
  | "larkFolderSelect"
  | "larkFolderSelectCurrent"
  | "larkFolderSelected"
  | "larkFolderTools";

export interface WorkbenchMessages {
  readonly locale: WorkbenchLocale;
  readonly actionRunner: WorkbenchActionRunnerMessages;
  readonly ai: {
    readonly activeNoteAction: WorkbenchAiActionMessages;
    readonly activeNoteRequest: WorkbenchAiRequestMessages;
    readonly providerDiagnostic: WorkbenchAiProviderDiagnosticMessages;
    readonly secrets: WorkbenchAiSecretMessages;
    readonly workspaceContext: WorkbenchAiWorkspaceContextMessages;
  };
  readonly common: Readonly<Record<CommonMessageId, string>>;
  readonly commands: {
    readonly categories: Readonly<Record<string, string>>;
    readonly titles: Readonly<Record<string, string>>;
  };
  readonly editor: MarkdownEditorLabels;
  readonly menuItems: Readonly<Record<string, string>>;
  readonly remoteSync: {
    readonly actions: WorkbenchRemoteSyncActionMessages;
    readonly larkAuth: WorkbenchRemoteSyncLarkAuthMessages;
    readonly markdownAssets: WorkbenchRemoteSyncMarkdownAssetMessages;
    readonly request: WorkbenchRemoteSyncRequestMessages;
    readonly secrets: WorkbenchRemoteSyncSecretMessages;
  };
  readonly sideViews: Readonly<Record<WorkbenchSideView, string>>;
  readonly shell: Readonly<Record<ShellMessageId, string>> & {
    readonly indexedStatus: (indexed: number, total: number) => string;
    readonly newFileInFolder: (folder: string) => string;
    readonly newFolderInFolder: (folder: string) => string;
    readonly deleteFileConfirm: (file: string) => string;
    readonly deleteFolderConfirm: (folder: string) => string;
    readonly cloudSyncedFolder: (remote: string) => string;
    readonly folderSyncDialogTitle: (folder: string) => string;
    readonly showEntryActions: (entry: string) => string;
  };
  readonly status: {
    readonly lines: (count: number) => string;
    readonly saved: string;
    readonly saving: string;
    readonly syncConflicts: string;
    readonly syncFailed: string;
    readonly syncIdle: string;
    readonly syncPending: string;
    readonly syncSynced: string;
    readonly syncSyncedAt: (syncedAt: number) => string;
    readonly syncing: string;
    readonly words: (count: number) => string;
  };
  readonly dialogs: {
    readonly aiResponse: {
      readonly ariaLabel: string;
      readonly appended: string;
      readonly append: string;
      readonly appendFailed: string;
      readonly extractedTasks: WorkbenchExtractedTaskMessages;
      readonly noContent: string;
      readonly replaced: string;
      readonly replace: string;
      readonly replaceFailed: string;
      readonly titles: Readonly<Record<WorkbenchAiRequestAction, string>>;
      readonly tokenUsage: WorkbenchAiTokenUsageMessages;
    };
    readonly commandPalette: {
      readonly ariaLabel: string;
      readonly commandInput: string;
      readonly noMatchingCommands: string;
    };
    readonly quickOpen: {
      readonly ariaLabel: string;
    };
    readonly remoteSync: WorkbenchRemoteSyncDialogMessages & {
      readonly ariaLabel: string;
      readonly cancel: string;
      readonly completedAt: (completedAt: number) => string;
      readonly conflicts: string;
      readonly defaultRemoteScope: string;
      readonly dryRun: string;
      readonly executedOperations: string;
      readonly noConflicts: string;
      readonly noOperationsExecuted: string;
      readonly noOperationsPlanned: string;
      readonly noProgressReported: string;
      readonly planOperations: string;
      readonly progress: string;
      readonly providerLabel: (providerId: string) => string;
      readonly remoteScopeLabel: (remoteScopeId: string) => string;
      readonly earlierProgressEvents: (count: number) => string;
      readonly moreOperations: (count: number) => string;
      readonly title: string;
      readonly workspaceLabel: (workspaceUri: string) => string;
    };
    readonly saveConflict: {
      readonly ariaLabel: string;
      readonly overwrite: string;
      readonly reload: string;
      readonly title: string;
    };
  };
  readonly settings: Readonly<Record<SettingsStringMessageId, string>> & {
    readonly diagnosticConnectionOkWithMessage: (message: string) => string;
    readonly diagnosticResponseMetadata: (parts: readonly string[]) => string;
    readonly keybindingConflict: (label: string, command: string) => string;
    readonly localization: SettingsLocalization;
    readonly numberValueAriaLabel: (label: string) => string;
    readonly remoteSyncSecretAriaLabel: (secretName: string) => string;
    readonly validationIssues: Readonly<Record<SettingsValidationIssueCode, string>>;
    readonly units: Readonly<Record<SettingsNumberUnitId, string>>;
    readonly colorSchemeOptions: readonly SettingsOption<ColorSchemePreference>[];
    readonly densityOptions: readonly SettingsOption<"comfortable" | "compact">[];
    readonly localeOptions: readonly SettingsOption<TyporaPlusLocale>[];
    readonly reasoningOptions: readonly SettingsOption<"" | AiProviderReasoningEffort>[];
    readonly textVerbosityOptions: readonly SettingsOption<"" | AiProviderTextVerbosity>[];
  };
}

const enSettingsLocalization = {
  sections: {
    [settingsSectionIds.appearance]: "Appearance",
    [settingsSectionIds.editor]: "Editor",
    [settingsSectionIds.ai]: "AI",
    [settingsSectionIds.remoteSync]: "Remote Sync",
    [settingsSectionIds.workspace]: "Workspace",
    [settingsSectionIds.keybindings]: "Keybindings"
  },
  entries: {
    [settingsEntryIds.appearance.theme]: {
      label: "Theme",
      keywords: ["color scheme", "system", "light", "dark"]
    },
    [settingsEntryIds.appearance.customTheme]: {
      label: "Custom Theme",
      keywords: ["theme", "extension", "custom", "tokens"]
    },
    [settingsEntryIds.appearance.density]: {
      label: "Density",
      keywords: ["comfortable", "compact"]
    },
    [settingsEntryIds.appearance.language]: {
      label: "Language",
      keywords: ["locale", "english", "chinese", "translation"]
    },
    [settingsEntryIds.editor.autoSave]: {
      label: "Auto Save",
      keywords: ["autosave", "save"]
    },
    [settingsEntryIds.editor.autoSaveDelay]: {
      label: "Auto Save Delay",
      keywords: ["autosave", "save", "delay", "debounce", "milliseconds"]
    },
    [settingsEntryIds.editor.focusMode]: {
      label: "Focus Mode",
      keywords: ["focus", "distraction"]
    },
    [settingsEntryIds.editor.typewriterMode]: {
      label: "Typewriter Mode",
      keywords: ["typewriter", "cursor"]
    },
    [settingsEntryIds.editor.fontSize]: {
      label: "Font Size",
      keywords: ["font", "text", "size"]
    },
    [settingsEntryIds.editor.lineHeight]: {
      label: "Line Height",
      keywords: ["line", "spacing"]
    },
    [settingsEntryIds.editor.maxWidth]: {
      label: "Editor Width",
      keywords: ["width", "content"]
    },
    [settingsEntryIds.editor.rendererPreviewCacheEntries]: {
      label: "Renderer Cache",
      keywords: ["preview", "renderer", "cache", "mermaid"]
    },
    [settingsEntryIds.ai.providers]: {
      label: "Providers",
      keywords: ["openai", "responses", "assistant", "model", "endpoint", "secret", "api key", "reasoning", "verbosity", "output tokens"]
    },
    [settingsEntryIds.ai.workspaceContextMaxResults]: {
      label: "Context Results",
      keywords: ["workspace", "context", "search", "retrieval", "grounded"]
    },
    [settingsEntryIds.ai.workspaceContextMaxPreviewLength]: {
      label: "Context Preview",
      keywords: ["workspace", "context", "preview", "snippet", "retrieval"]
    },
    [settingsEntryIds.remoteSync.providers]: {
      label: "Providers",
      keywords: ["sync", "remote", "cloud", "mirror", "native request", "scope", "secret"]
    },
    [settingsEntryIds.workspace.defaultAssetFolder]: {
      label: "Asset Folder",
      keywords: ["assets", "images", "attachments", "folder"]
    },
    [settingsEntryIds.workspace.quickOpenMaxResults]: {
      label: "Quick Open Results",
      keywords: ["quick open", "files", "results", "limit"]
    },
    [settingsEntryIds.workspace.searchMaxFileSize]: {
      label: "Search File Limit",
      keywords: ["search", "index", "file", "size", "limit"]
    },
    [settingsEntryIds.workspace.searchMaxResults]: {
      label: "Search Results",
      keywords: ["search", "results", "limit"]
    },
    [settingsEntryIds.keybindings.editor]: {
      label: "Keybindings",
      keywords: ["keyboard", "shortcut", "shortcuts", "commands", "record", "reset"]
    }
  }
} as const satisfies SettingsLocalization;

const zhCNSettingsLocalization = {
  sections: {
    [settingsSectionIds.appearance]: "外观",
    [settingsSectionIds.editor]: "编辑器",
    [settingsSectionIds.ai]: "AI",
    [settingsSectionIds.remoteSync]: "远程同步",
    [settingsSectionIds.workspace]: "工作区",
    [settingsSectionIds.keybindings]: "快捷键"
  },
  entries: {
    [settingsEntryIds.appearance.theme]: {
      label: "主题",
      keywords: ["配色", "系统", "浅色", "深色", "color scheme", "theme"]
    },
    [settingsEntryIds.appearance.customTheme]: {
      label: "自定义主题",
      keywords: ["扩展", "自定义", "令牌", "custom theme"]
    },
    [settingsEntryIds.appearance.density]: {
      label: "界面密度",
      keywords: ["舒适", "紧凑", "density"]
    },
    [settingsEntryIds.appearance.language]: {
      label: "语言",
      keywords: ["中文", "英文", "双语", "切换", "locale", "language"]
    },
    [settingsEntryIds.editor.autoSave]: {
      label: "自动保存",
      keywords: ["autosave", "save"]
    },
    [settingsEntryIds.editor.autoSaveDelay]: {
      label: "自动保存延迟",
      keywords: ["延迟", "毫秒", "debounce", "delay"]
    },
    [settingsEntryIds.editor.focusMode]: {
      label: "专注模式",
      keywords: ["focus", "distraction"]
    },
    [settingsEntryIds.editor.typewriterMode]: {
      label: "打字机模式",
      keywords: ["typewriter", "cursor"]
    },
    [settingsEntryIds.editor.fontSize]: {
      label: "字号",
      keywords: ["字体", "大小", "font size"]
    },
    [settingsEntryIds.editor.lineHeight]: {
      label: "行高",
      keywords: ["line height", "spacing"]
    },
    [settingsEntryIds.editor.maxWidth]: {
      label: "编辑器宽度",
      keywords: ["宽度", "内容", "editor width"]
    },
    [settingsEntryIds.editor.rendererPreviewCacheEntries]: {
      label: "渲染缓存",
      keywords: ["预览", "渲染", "缓存", "mermaid"]
    },
    [settingsEntryIds.ai.providers]: {
      label: "服务商",
      keywords: ["openai", "responses", "助手", "模型", "端点", "密钥", "api key", "推理", "详细度", "输出 token"]
    },
    [settingsEntryIds.ai.workspaceContextMaxResults]: {
      label: "上下文结果数",
      keywords: ["工作区", "上下文", "搜索", "检索", "grounded"]
    },
    [settingsEntryIds.ai.workspaceContextMaxPreviewLength]: {
      label: "上下文预览长度",
      keywords: ["工作区", "上下文", "预览", "片段", "snippet"]
    },
    [settingsEntryIds.remoteSync.providers]: {
      label: "同步配置",
      keywords: ["同步", "远程", "云", "镜像", "native request", "范围", "密钥"]
    },
    [settingsEntryIds.workspace.defaultAssetFolder]: {
      label: "资源文件夹",
      keywords: ["附件", "图片", "文件夹", "assets"]
    },
    [settingsEntryIds.workspace.quickOpenMaxResults]: {
      label: "快速打开结果数",
      keywords: ["快速打开", "文件", "结果", "限制"]
    },
    [settingsEntryIds.workspace.searchMaxFileSize]: {
      label: "搜索文件大小限制",
      keywords: ["搜索", "索引", "文件", "大小", "限制"]
    },
    [settingsEntryIds.workspace.searchMaxResults]: {
      label: "搜索结果数",
      keywords: ["搜索", "结果", "限制"]
    },
    [settingsEntryIds.keybindings.editor]: {
      label: "快捷键",
      keywords: ["键盘", "快捷键", "命令", "录制", "重置"]
    }
  }
} as const satisfies SettingsLocalization;

const zhCNMarkdownEditorLabels: MarkdownEditorLabels = {
  code: "代码",
  codeBlockTools: "代码块工具",
  codeCopied: "代码已复制",
  copied: "已复制",
  copy: "复制",
  copyCode: "复制代码",
  copyTex: "复制 TeX",
  deleteColumn: (column) => `删除第 ${column} 列`,
  deleteLastColumn: "删除最后一列",
  deleteLastRow: "删除最后一行",
  deleteRow: (row) => `删除第 ${row} 行`,
  editCodeSource: "编辑代码源",
  editInlineMath: "编辑行内数学公式",
  editInlineRendererSource: "编辑行内渲染源",
  editSourceForColumn: (column) => `编辑第 ${column} 列源内容`,
  editTexSource: "编辑 TeX 源",
  emptyMathBlock: "空数学块",
  emptyTex: "空 TeX",
  inlineMathPreview: "行内数学预览",
  inlinePreview: (language) => `${language} 行内预览`,
  insertColumnAfter: (column) => `在第 ${column} 列后插入列`,
  insertColumnRight: "向右插入列",
  insertRowBelow: "向下插入行",
  insertRowBelowRow: (row) => `在第 ${row} 行下方插入行`,
  invalidInlineMath: "无效的行内数学公式",
  invalidTex: (message) => `无效的 TeX：${message}`,
  markComplete: "标记完成",
  markIncomplete: "标记未完成",
  markTaskComplete: "将任务标记为完成",
  markTaskIncomplete: "将任务标记为未完成",
  mathPreview: "数学预览",
  renderedCodeBlock: "已渲染代码块",
  rendererUnavailable: (message) => `渲染器不可用：${message}`,
  renderingPreview: "正在渲染预览...",
  setColumnAlignment: (column, alignment) => `将第 ${column} 列对齐方式设为${alignment}`,
  slashCommands: {
    menuLabel: "插入结构",
    tableTitle: "表格",
    tableDescription: "插入三列表格",
    tableColumn1: "列 1",
    tableColumn2: "列 2",
    tableColumn3: "列 3",
    todoTitle: "任务列表",
    todoDescription: "插入待办清单",
    todoItem: "任务",
    calloutTitle: "提示块",
    calloutDescription: "插入高亮信息块",
    calloutHeading: "提示",
    calloutBody: "写下提示内容...",
    codeTitle: "代码块",
    codeDescription: "插入围栏代码块",
    codeLanguage: "text",
    codeBody: "code",
    quoteTitle: "引用",
    quoteDescription: "插入引用块",
    quoteBody: "引用内容",
    dividerTitle: "分割线",
    dividerDescription: "插入水平分割线",
    dateTitle: "日期",
    dateDescription: "插入今天的日期",
    meetingTitle: "会议纪要",
    meetingDescription: "插入议程、记录和行动项",
    meetingHeading: "会议纪要",
    meetingDate: "日期",
    meetingAttendees: "参会人",
    meetingAgenda: "议程",
    meetingAgendaItem: "议题",
    meetingNotes: "记录",
    meetingNoteItem: "结论或记录",
    meetingActions: "行动项",
    meetingActionItem: "负责人 - 下一步"
  },
  table: "表格",
  tableAlignment: (alignment) => {
    if (alignment === "default") {
      return "自动";
    }

    if (alignment === "left") {
      return "左对齐";
    }

    if (alignment === "center") {
      return "居中";
    }

    return "右对齐";
  },
  tablePreview: "表格预览",
  tex: "TeX",
  texCopied: "TeX 已复制",
  texError: "TeX 错误"
};

const enWorkbenchMessages: WorkbenchMessages = {
  locale: "en" as WorkbenchLocale,
  actionRunner: defaultWorkbenchActionRunnerMessages,
  ai: {
    activeNoteAction: defaultWorkbenchAiActionMessages,
    activeNoteRequest: defaultWorkbenchAiRequestMessages,
    providerDiagnostic: defaultWorkbenchAiProviderDiagnosticMessages,
    secrets: defaultWorkbenchAiSecretMessages,
    workspaceContext: {
      detailList: (details) => details.join("\n"),
      line: (line) => `Line: ${line}`,
      path: (relativePath) => `Path: ${relativePath}`
    }
  },
  common: {
    cancel: "Cancel",
    close: "Close",
    copied: "Copied",
    copy: "Copy",
    copyFailed: "Copy failed",
    delete: "Delete",
    deleted: "Deleted",
    failed: "Failed",
    off: "Off",
    on: "On",
    remove: "Remove",
    reset: "Reset",
    save: "Save",
    saved: "Saved",
    test: "Test",
    testing: "Testing"
  },
  commands: {
    categories: {
      [workbenchCommandCategories.file]: "File",
      [workbenchCommandCategories.workbench]: "Workbench",
      [workbenchCommandCategories.editor]: "Editor",
      [workbenchCommandCategories.ai]: "AI",
      [workbenchCommandCategories.remoteSync]: "Remote Sync"
    } as Record<string, string>,
    titles: {
      [workbenchCommandIds.file.newUntitled]: "New Note",
      [workbenchCommandIds.file.openWorkspace]: "Open Workspace",
      [workbenchCommandIds.file.refreshWorkspace]: "Refresh Workspace",
      [workbenchCommandIds.file.save]: "Save",
      [workbenchCommandIds.file.saveAs]: "Save As",
      [workbenchCommandIds.file.exportHtml]: "Export HTML",
      [workbenchCommandIds.workbench.quickOpen]: "Quick Open",
      [workbenchCommandIds.workbench.commandPaletteOpen]: "Command Palette",
      [workbenchCommandIds.workbench.settingsOpen]: "Settings",
      [workbenchCommandIds.workbench.sidebarFiles]: "Show Files",
      [workbenchCommandIds.workbench.sidebarSearch]: "Show Search",
      [workbenchCommandIds.workbench.sidebarOutline]: "Show Outline",
      [workbenchCommandIds.workbench.sidebarBacklinks]: "Show Backlinks",
      [workbenchCommandIds.workbench.sidebarTags]: "Show Tags",
      [workbenchCommandIds.editor.focusModeToggle]: "Toggle Focus Mode",
      [workbenchCommandIds.editor.typewriterModeToggle]: "Toggle Typewriter Mode",
      [workbenchCommandIds.editor.taskToggleLines]: "Toggle Task Lines",
      [workbenchCommandIds.editor.taskRemoveMarkers]: "Remove Task Markers",
      [workbenchCommandIds.ai.continueActiveNote]: "Continue Active Note",
      [workbenchCommandIds.ai.extractTasksActiveNote]: "Extract Tasks From Active Note",
      [workbenchCommandIds.ai.rewriteActiveNote]: "Rewrite Active Note",
      [workbenchCommandIds.ai.summarizeActiveNote]: "Summarize Active Note",
      [workbenchCommandIds.remoteSync.planWorkspace]: "Plan Workspace Sync",
      [workbenchCommandIds.theme.toggle]: "Toggle Theme"
    } as Record<string, string>
  },
  editor: defaultMarkdownEditorLabels,
  menuItems: {
    "titlebar.file.newUntitled": "New Note",
    "titlebar.file.openWorkspace": "Open Workspace",
    "titlebar.file.save": "Save",
    "titlebar.file.saveAs": "Save As",
    "titlebar.file.exportHtml": "Export HTML",
    "titlebar.editor.focusMode": "Focus Mode",
    "titlebar.editor.typewriterMode": "Typewriter Mode",
    "titlebar.ai.summarizeActiveNote": "Summarize Active Note",
    "titlebar.remoteSync.planWorkspace": "Plan Workspace Sync",
    "titlebar.workbench.theme": "Theme",
    "titlebar.workbench.commandPalette": "Command Palette",
    "activitybar.primary.files": "Files",
    "activitybar.primary.search": "Search",
    "activitybar.primary.outline": "Outline",
    "activitybar.primary.backlinks": "Backlinks",
    "activitybar.primary.tags": "Tags",
    "activitybar.secondary.settings": "Settings",
    "activitybar.secondary.commandPalette": "Command Palette"
  } as Record<string, string>,
  remoteSync: {
    actions: defaultWorkbenchRemoteSyncActionMessages,
    larkAuth: defaultWorkbenchRemoteSyncLarkAuthMessages,
    markdownAssets: defaultWorkbenchRemoteSyncMarkdownAssetMessages,
    request: defaultWorkbenchRemoteSyncRequestMessages,
    secrets: defaultWorkbenchRemoteSyncSecretMessages
  },
  sideViews: {
    [workbenchSideViews.files]: "Files",
    [workbenchSideViews.search]: "Search",
    [workbenchSideViews.outline]: "Outline",
    [workbenchSideViews.backlinks]: "Backlinks",
    [workbenchSideViews.tags]: "Tags"
  } as Record<WorkbenchSideView, string>,
  shell: {
    clearSearch: "Clear search",
    closeSidebar: "Close Sidebar",
    cloudSyncedFolder: (remote: string) => `Cloud synced to ${remote}`,
    defaultNewFileName: "Untitled.md",
    defaultNewFolderName: "New Folder",
    deleteFileConfirm: (file: string) => `Delete ${file}? This cannot be undone.`,
    deleteFolderConfirm: (folder: string) => `Delete ${folder} and everything inside it? This cannot be undone.`,
    editorAriaLabel: "Editor",
    markdownEditorMode: "Edit Markdown",
    markdownPreviewAriaLabel: "Markdown Preview",
    markdownPreviewMode: "Feishu Preview",
    folderSyncCreateFolder: "Create and sync",
    folderSyncCreateName: "New remote folder",
    folderSyncCreating: "Creating folder",
    folderSyncCurrentRemote: "Remote folder",
    folderSyncDialogTitle: (folder: string) => `Sync ${folder}`,
    folderSyncLocalTarget: "Local folder",
    folderSyncLoading: "Loading folders",
    folderSyncNoFolders: "No folders",
    folderSyncOpenFolder: "Open folder",
    folderSyncProvider: "Provider",
    folderSyncRemoteFolders: "Remote folders",
    folderSyncRoot: "Drive root",
    folderSyncSelectCurrent: "Sync here",
    folderSyncSelectFolder: "Choose",
    indexedStatus: (indexed: number, total: number) => `${indexed}/${total} indexed`,
    newFile: "New note",
    newFileInFolder: (folder: string) => `New note in ${folder}`,
    newFileNamePrompt: "New note name",
    newFolder: "New folder",
    newFolderInFolder: (folder: string) => `New folder in ${folder}`,
    newFolderNamePrompt: "New folder name",
    noBacklinks: "No backlinks",
    noTags: "No tags",
    notes: "Notes",
    openWorkspace: "Open workspace",
    primaryNavigation: "Primary",
    recentFiles: "Recent files",
    recentWorkspaces: "Recent workspaces",
    refreshWorkspace: "Refresh workspace",
    remoteSyncNoProvider: "No Feishu sync provider is configured",
    renameEntry: "Rename",
    renameFileNamePrompt: "Rename note",
    renameFolderNamePrompt: "Rename folder",
    search: "Search",
    searchNote: "Search note",
    showEntryActions: (entry: string) => `Show actions for ${entry}`,
    showWorkspaceActions: "Show workspace actions",
    syncDirectory: "Sync directory",
    tagsAriaLabel: "Tags",
    unsyncDirectory: "Stop syncing directory",
    unsavedChanges: "Unsaved changes",
    workspaceTreeActions: "Workspace tree actions"
  },
  status: {
    lines: (count: number) => `${count} ${count === 1 ? "line" : "lines"}`,
    saved: "Saved",
    saving: "Saving",
    syncConflicts: "Sync has conflicts. Open remote sync to resolve them.",
    syncFailed: "Sync failed",
    syncIdle: "Not synced",
    syncPending: "Sync pending",
    syncSynced: "Synced",
    syncSyncedAt: (syncedAt: number) => `Synced ${new Date(syncedAt).toLocaleTimeString()}`,
    syncing: "Syncing",
    words: (count: number) => `${count} ${count === 1 ? "word" : "words"}`
  },
  dialogs: {
    aiResponse: {
      ariaLabel: "AI response",
      appended: "Appended",
      append: "Append",
      appendFailed: "Append failed",
      extractedTasks: {
        detailLabels: {
          owner: "Owner",
          due: "Due",
          blocker: "Blocker"
        },
        detail: (label, value) => `${label}: ${value}`,
        detailList: (details) => details.length > 0 ? ` (${details.join("; ")})` : "",
        noActionableTasksFound: "No actionable tasks found."
      },
      noContent: "No response content.",
      replaced: "Replaced",
      replace: "Replace",
      replaceFailed: "Replace failed",
      titles: {
        [workbenchAiRequestActions.continueActiveNote]: "Continue Active Note",
        [workbenchAiRequestActions.extractTasksActiveNote]: "Extract Tasks From Active Note",
        [workbenchAiRequestActions.rewriteActiveNote]: "Rewrite Active Note",
        [workbenchAiRequestActions.summarizeActiveNote]: "Summarize Active Note"
      } as Record<WorkbenchAiRequestAction, string>,
      tokenUsage: {
        input: (count) => `${count} in`,
        output: (count) => `${count} out`,
        total: (count) => `${count} total`,
        join: (parts) => parts.join(" / ")
      }
    },
    commandPalette: {
      ariaLabel: "Command Palette",
      commandInput: "Command",
      noMatchingCommands: "No matching commands"
    },
    quickOpen: {
      ariaLabel: "Quick Open"
    },
    remoteSync: {
      ariaLabel: "Remote sync plan",
      cancel: "Cancel",
      completedAt: (completedAt: number) => `Completed ${new Date(completedAt).toLocaleString()}`,
      conflicts: "Conflicts",
      defaultRemoteScope: "default remote scope",
      directions: {
        push: "Push",
        pull: "Pull",
        bidirectional: "Bidirectional"
      },
      dryRun: "dry run",
      executed: "Executed",
      executedOperations: "Executed operations",
      executedStatus: (summary: string) => `Executed: ${summary}`,
      execute: "Execute",
      executing: "Executing",
      executionBlockReasons: {
        [workbenchRemoteSyncPlanExecutionBlockReasons.conflicts]: "Resolve remote sync conflicts before execution",
        [workbenchRemoteSyncPlanExecutionBlockReasons.empty]: "No remote sync changes to execute"
      },
      executionInProgress: "Execution in progress",
      executionInProgressWithProgress: (progress: string) => `Execution in progress: ${progress}`,
      noConflicts: "No conflicts",
      noOperationsExecuted: "No operations executed",
      noOperationsPlanned: "No operations planned",
      noProgressReported: "No progress reported",
      operationDetail: (target: string, message?: string) => message ? `${target}: ${message}` : target,
      operationKinds: {
        create: "Create",
        update: "Update",
        delete: "Delete",
        skip: "Skip",
        conflict: "Conflict"
      },
      operationTargets: {
        local: "local",
        remote: "remote",
        both: "both",
        none: "none"
      },
      planOperations: "Planned operations",
      progress: "progress",
      progressCompleted: (count: number) => `${count} completed`,
      progressOperation: (operation: string, relativePath: string) => `${operation} ${relativePath}`,
      progressParts: (parts: readonly string[]) => parts.join(": "),
      providerLabel: (providerId: string) => `Provider: ${providerId}`,
      refreshBaseline: "Refresh Baseline",
      remoteScopeLabel: (remoteScopeId: string) => `Remote scope: ${remoteScopeId}`,
      summary: (summary) => [
        `${summary.creates} create`,
        `${summary.updates} update`,
        `${summary.deletes} delete`,
        `${summary.skips} skip`,
        `${summary.conflicts} conflict`
      ].join(", "),
      earlierProgressEvents: (count: number) => `${count} earlier progress events`,
      moreOperations: (count: number) => `${count} more operations`,
      title: "Remote Sync Plan",
      useLocal: "Use Local",
      useRemote: "Use Remote",
      workspaceLabel: (workspaceUri: string) => `Workspace: ${workspaceUri}`
    },
    saveConflict: {
      ariaLabel: "Save conflict",
      overwrite: "Overwrite",
      reload: "Reload",
      title: "File changed on disk"
    }
  },
  settings: {
    aiProviderFallback: "AI Provider",
    apiKey: "API Key",
    baseUrl: "Base URL",
    clearKeybindingSearch: "Clear Keybinding Search",
    clearSettingsSearch: "Clear Settings Search",
    deleteMissing: "Delete Missing",
    diagnosticConnectionFailed: "Connection failed",
    diagnosticConnectionOk: "Connection OK",
    diagnosticConnectionOkWithMessage: (message) => `Connection OK: ${message}`,
    diagnosticResponseMetadata: (parts) => parts.join(", "),
    diagnosticTestingProvider: "Testing provider",
    endpoint: "Endpoint",
    headerBinding: "Header Binding",
    headerName: "Header Name",
    headerScheme: "Header Scheme",
    keybindingConflict: (label: string, command: string) => `${label} is used by ${command}.`,
    keybindingsSearch: "Search Keybindings",
    listPath: "List Path",
    localization: enSettingsLocalization,
    maxOutput: "Max Output",
    metadata: "Metadata",
    model: "Model",
    modified: "Modified",
    modifiedKeybindings: "Modified Keybindings",
    noAiProviders: "No AI providers configured",
    noMatchingCommands: "No matching commands",
    noMatchingSettings: "No matching settings",
    noModifiedShortcuts: "No modified shortcuts",
    noRemoteSyncProfiles: "No remote sync profiles configured",
    numberValueAriaLabel: (label) => `${label} Value`,
    pageSize: "Page Size",
    pressKeys: "Press keys",
    providerId: "Provider ID",
    rawMirror: "Raw Mirror",
    reasoning: "Reasoning",
    record: "Record",
    remoteScope: "Remote Scope",
    remoteSyncSecret: "Remote Sync Secret",
    remoteSyncSecretAriaLabel: (secretName) => `Remote Sync Secret: ${secretName}`,
    remoteSyncProfileFallback: "Remote Sync Profile",
    replace: "Replace",
    resetAll: "Reset All",
    retryCount: "Retry Count",
    retryDelay: "Retry Delay",
    retryStatus: "Retry Status",
    saveKey: "Save Key",
    searchSettings: "Search Settings",
    secretBindings: "Secret Bindings",
    secretRef: "Secret Ref",
    settingsSections: "Settings Sections",
    storeResponse: "Store Response",
    title: "Settings",
    titleField: "Title",
    unassigned: "Unassigned",
    uploadPath: "Upload Path",
    downloadPath: "Download Path",
    deletePath: "Delete Path",
    valueSuffix: "Value",
    verbosity: "Verbosity",
    addProvider: "Add Provider",
    addProfile: "Add Profile",
    addLarkProfile: "Add Lark",
    larkAuthorization: "Lark Authorization",
    larkAuthCheck: "Check",
    larkAuthStart: "Authorize",
    larkAuthComplete: "Complete",
    larkAuthReady: "Authorization started",
    larkAuthAuthorized: "Authorized",
    larkAuthFailed: "Authorization failed",
    larkAuthDeviceCode: "Device Code",
    larkAuthUrl: "Verification URL",
    larkFolderCreate: "Create Folder",
    larkFolderCreatePrompt: "Remote folder name",
    larkFolderCreated: "Folder selected",
    larkFolderCurrent: "Current folder",
    larkFolderEnter: "Enter",
    larkFolderList: "List Folders",
    larkFolderListFailed: "Folder list failed",
    larkFolderNone: "No folders",
    larkFolderRoot: "Use Drive Root",
    larkFolderSelect: "Choose Folder",
    larkFolderSelectCurrent: "Choose Current",
    larkFolderSelected: "Folder selected",
    larkFolderTools: "Lark Folder",
    validationIssues: {
      [settingsValidationIssueCodes.aiProviderInvalid]: "Complete provider id, title, HTTPS or loopback endpoint, model, secret reference, and valid request settings.",
      [settingsValidationIssueCodes.providerIdDuplicate]: "Provider id is already used.",
      [settingsValidationIssueCodes.rawMirrorDeleteInvalid]: "Complete raw mirror delete metadata.",
      [settingsValidationIssueCodes.rawMirrorListInvalid]: "Complete raw mirror list metadata.",
      [settingsValidationIssueCodes.rawMirrorMetadataInvalid]: "Complete raw mirror metadata paths and header binding.",
      [settingsValidationIssueCodes.rawMirrorRetryInvalid]: "Complete raw mirror retry metadata.",
      [settingsValidationIssueCodes.remoteSyncProviderInvalid]: "Complete provider id, title, HTTPS or loopback base URL, and valid profile bindings."
    },
    units: {
      [settingsNumberUnitIds.characters]: "chars",
      [settingsNumberUnitIds.entries]: "entries",
      [settingsNumberUnitIds.megabytes]: "MB",
      [settingsNumberUnitIds.milliseconds]: "ms",
      [settingsNumberUnitIds.pixels]: "px"
    },
    colorSchemeOptions: [
      { value: "system", label: "System" },
      { value: "light", label: "Light" },
      { value: "dark", label: "Dark" }
    ] as readonly SettingsOption<ColorSchemePreference>[],
    densityOptions: [
      { value: "comfortable", label: "Comfortable" },
      { value: "compact", label: "Compact" }
    ] as readonly SettingsOption<"comfortable" | "compact">[],
    localeOptions: createWorkbenchLocaleOptions(enWorkbenchLocaleOptionLabels),
    reasoningOptions: [
      { value: "", label: "Default" },
      { value: "none", label: "None" },
      { value: "minimal", label: "Minimal" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
      { value: "xhigh", label: "XHigh" }
    ],
    textVerbosityOptions: [
      { value: "", label: "Default" },
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" }
    ]
  }
};

const zhCNWorkbenchMessages = {
  locale: "zh-CN" as WorkbenchLocale,
  actionRunner: {
    fileChangedOnDisk: "磁盘上的文件已变更",
    operationFailed: "操作失败"
  },
  ai: {
    activeNoteAction: {
      noProviderAvailable: (actionTitle) => `没有可用于${actionTitle}的 AI 服务商`,
      titles: {
        [workbenchAiRequestActions.continueActiveNote]: "续写当前笔记",
        [workbenchAiRequestActions.extractTasksActiveNote]: "从当前笔记提取任务",
        [workbenchAiRequestActions.rewriteActiveNote]: "重写当前笔记",
        [workbenchAiRequestActions.summarizeActiveNote]: "总结当前笔记"
      }
    },
    activeNoteRequest: {
      instructions: {
        [workbenchAiRequestActions.continueActiveNote]: [
          "根据当前 Markdown 笔记已有上下文继续写作。",
          "保留笔记结构、语气、标题层级、链接和任务列表语法。",
          "只返回应该追加的新 Markdown 内容。"
        ].join(" "),
        [workbenchAiRequestActions.extractTasksActiveNote]: [
          "从当前 Markdown 笔记中提取可执行任务。",
          "返回符合请求 schema 的 JSON，包含任务分组和具体任务字段。",
          "缺失负责人、日期、阻塞项或主题时使用 null，不要编造任务。"
        ].join(" "),
        [workbenchAiRequestActions.rewriteActiveNote]: [
          "为清晰度和行文流畅度重写当前 Markdown 笔记。",
          "保留含义、Markdown 结构、链接、代码围栏、表格和任务列表状态。",
          "只返回重写后的 Markdown 内容，不要编造事实。"
        ].join(" "),
        [workbenchAiRequestActions.summarizeActiveNote]: [
          "总结当前 Markdown 笔记。",
          "保留重要决策、开放任务和未解决问题。",
          "保持回复简洁，不要编造事实。"
        ].join(" ")
      }
    },
    providerDiagnostic: {
      providerIdRequired: "AI 服务商 ID 是诊断所必需的",
      request: {
        instruction: "返回一句简短的纯文本确认，说明此 AI 服务商可以接收并回答请求。",
        input: "Typora Plus AI 服务商连接检查。"
      }
    },
    secrets: {
      referenceInvalid: "AI 密钥引用无效",
      storageUnavailable: "AI 密钥存储不可用",
      valueEmpty: "AI 密钥值不能为空"
    },
    workspaceContext: {
      detailList: (details) => details.join("\n"),
      line: (line) => `行：${line}`,
      path: (relativePath) => `路径：${relativePath}`
    }
  },
  common: {
    cancel: "取消",
    close: "关闭",
    copied: "已复制",
    copy: "复制",
    copyFailed: "复制失败",
    delete: "删除",
    deleted: "已删除",
    failed: "失败",
    off: "关",
    on: "开",
    remove: "移除",
    reset: "重置",
    save: "保存",
    saved: "已保存",
    test: "测试",
    testing: "测试中"
  },
  commands: {
    categories: {
      [workbenchCommandCategories.file]: "文件",
      [workbenchCommandCategories.workbench]: "工作台",
      [workbenchCommandCategories.editor]: "编辑器",
      [workbenchCommandCategories.ai]: "AI",
      [workbenchCommandCategories.remoteSync]: "远程同步"
    },
    titles: {
      [workbenchCommandIds.file.newUntitled]: "新建笔记",
      [workbenchCommandIds.file.openWorkspace]: "打开工作区",
      [workbenchCommandIds.file.refreshWorkspace]: "刷新工作区",
      [workbenchCommandIds.file.save]: "保存",
      [workbenchCommandIds.file.saveAs]: "另存为",
      [workbenchCommandIds.file.exportHtml]: "导出 HTML",
      [workbenchCommandIds.workbench.quickOpen]: "快速打开",
      [workbenchCommandIds.workbench.commandPaletteOpen]: "命令面板",
      [workbenchCommandIds.workbench.settingsOpen]: "设置",
      [workbenchCommandIds.workbench.sidebarFiles]: "显示文件",
      [workbenchCommandIds.workbench.sidebarSearch]: "显示搜索",
      [workbenchCommandIds.workbench.sidebarOutline]: "显示大纲",
      [workbenchCommandIds.workbench.sidebarBacklinks]: "显示反向链接",
      [workbenchCommandIds.workbench.sidebarTags]: "显示标签",
      [workbenchCommandIds.editor.focusModeToggle]: "切换专注模式",
      [workbenchCommandIds.editor.typewriterModeToggle]: "切换打字机模式",
      [workbenchCommandIds.editor.taskToggleLines]: "切换任务行",
      [workbenchCommandIds.editor.taskRemoveMarkers]: "移除任务标记",
      [workbenchCommandIds.ai.continueActiveNote]: "续写当前笔记",
      [workbenchCommandIds.ai.extractTasksActiveNote]: "从当前笔记提取任务",
      [workbenchCommandIds.ai.rewriteActiveNote]: "重写当前笔记",
      [workbenchCommandIds.ai.summarizeActiveNote]: "总结当前笔记",
      [workbenchCommandIds.remoteSync.planWorkspace]: "规划工作区同步",
      [workbenchCommandIds.theme.toggle]: "切换主题"
    }
  },
  editor: zhCNMarkdownEditorLabels,
  menuItems: {
    "titlebar.file.newUntitled": "新建笔记",
    "titlebar.file.openWorkspace": "打开工作区",
    "titlebar.file.save": "保存",
    "titlebar.file.saveAs": "另存为",
    "titlebar.file.exportHtml": "导出 HTML",
    "titlebar.editor.focusMode": "专注模式",
    "titlebar.editor.typewriterMode": "打字机模式",
    "titlebar.ai.summarizeActiveNote": "总结当前笔记",
    "titlebar.remoteSync.planWorkspace": "规划工作区同步",
    "titlebar.workbench.theme": "主题",
    "titlebar.workbench.commandPalette": "命令面板",
    "activitybar.primary.files": "文件",
    "activitybar.primary.search": "搜索",
    "activitybar.primary.outline": "大纲",
    "activitybar.primary.backlinks": "反向链接",
    "activitybar.primary.tags": "标签",
    "activitybar.secondary.settings": "设置",
    "activitybar.secondary.commandPalette": "命令面板"
  },
  remoteSync: {
    actions: {
      conflictResolutionMessages: {
        [workbenchRemoteSyncConflictResolutions.useLocal]: "已改为使用本地资源解决",
        [workbenchRemoteSyncConflictResolutions.useRemote]: "已改为使用远程资源解决"
      },
      executionBlockReasons: {
        [workbenchRemoteSyncPlanExecutionBlockReasons.conflicts]: "执行前请先解决远程同步冲突",
        [workbenchRemoteSyncPlanExecutionBlockReasons.empty]: "没有需要执行的远程同步变更"
      },
      noProviderAvailable: "没有可用于工作区同步规划的远程同步服务商"
    },
    larkAuth: {
      deviceCodeMissing: "飞书授权设备码缺失",
      folderNameMissing: "飞书文件夹名称缺失",
      folderTokenMissing: "飞书文件夹 token 缺失",
      requestUnavailable: "远程同步本机请求桥不可用",
      gatewayRequestFailed: (status, statusText) => `飞书授权网关失败：${status} ${statusText}`.trim()
    },
    markdownAssets: {
      aborted: "远程同步 Markdown 资产发现已取消",
      contentEncodingInvalid: "远程同步 Markdown 资产发现需要有效的 base64 内容",
      contentEncodingRequired: "远程同步 Markdown 资产发现需要 base64 内容"
    },
    request: {
      noWorkspaceOpen: "没有打开可用于远程同步规划的工作区"
    },
    secrets: {
      referenceInvalid: "远程同步密钥引用无效",
      storageUnavailable: "远程同步密钥存储不可用",
      valueEmpty: "远程同步密钥值不能为空"
    }
  },
  sideViews: {
    [workbenchSideViews.files]: "文件",
    [workbenchSideViews.search]: "搜索",
    [workbenchSideViews.outline]: "大纲",
    [workbenchSideViews.backlinks]: "反向链接",
    [workbenchSideViews.tags]: "标签"
  },
  shell: {
    clearSearch: "清空搜索",
    closeSidebar: "关闭侧边栏",
    cloudSyncedFolder: (remote: string) => `已云同步到 ${remote}`,
    defaultNewFileName: "未命名.md",
    defaultNewFolderName: "新建文件夹",
    deleteFileConfirm: (file: string) => `删除 ${file}？此操作不可撤销。`,
    deleteFolderConfirm: (folder: string) => `删除 ${folder} 及其内部所有内容？此操作不可撤销。`,
    editorAriaLabel: "编辑器",
    markdownEditorMode: "编辑 Markdown",
    markdownPreviewAriaLabel: "Markdown 预览",
    markdownPreviewMode: "飞书预览",
    folderSyncCreateFolder: "新建并同步",
    folderSyncCreateName: "新建云端文件夹",
    folderSyncCreating: "正在新建文件夹",
    folderSyncCurrentRemote: "云端目录",
    folderSyncDialogTitle: (folder: string) => `同步 ${folder}`,
    folderSyncLocalTarget: "本地目录",
    folderSyncLoading: "正在读取目录",
    folderSyncNoFolders: "没有文件夹",
    folderSyncOpenFolder: "打开文件夹",
    folderSyncProvider: "同步配置",
    folderSyncRemoteFolders: "云端文件夹",
    folderSyncRoot: "云盘根目录",
    folderSyncSelectCurrent: "同步到这里",
    folderSyncSelectFolder: "选择",
    indexedStatus: (indexed: number, total: number) => `已索引 ${indexed}/${total}`,
    newFile: "新建笔记",
    newFileInFolder: (folder: string) => `在 ${folder} 中新建笔记`,
    newFileNamePrompt: "新建笔记名称",
    newFolder: "新建文件夹",
    newFolderInFolder: (folder: string) => `在 ${folder} 中新建文件夹`,
    newFolderNamePrompt: "新建文件夹名称",
    noBacklinks: "没有反向链接",
    noTags: "没有标签",
    notes: "笔记",
    openWorkspace: "打开工作区",
    primaryNavigation: "主导航",
    recentFiles: "最近文件",
    recentWorkspaces: "最近工作区",
    refreshWorkspace: "刷新工作区",
    remoteSyncNoProvider: "还没有可用的飞书同步配置",
    renameEntry: "重命名",
    renameFileNamePrompt: "重命名笔记",
    renameFolderNamePrompt: "重命名文件夹",
    search: "搜索",
    searchNote: "搜索笔记",
    showEntryActions: (entry: string) => `显示 ${entry} 的操作`,
    showWorkspaceActions: "显示工作区操作",
    syncDirectory: "同步目录",
    tagsAriaLabel: "标签",
    unsyncDirectory: "取消同步目录",
    unsavedChanges: "未保存的更改",
    workspaceTreeActions: "工作区树操作"
  },
  status: {
    lines: (count: number) => `${count} 行`,
    saved: "已保存",
    saving: "保存中",
    syncConflicts: "同步存在冲突，请打开远程同步处理",
    syncFailed: "同步失败",
    syncIdle: "未同步",
    syncPending: "等待同步",
    syncSynced: "已同步",
    syncSyncedAt: (syncedAt: number) => `已同步 ${new Date(syncedAt).toLocaleTimeString()}`,
    syncing: "同步中",
    words: (count: number) => `${count} 词`
  },
  dialogs: {
    aiResponse: {
      ariaLabel: "AI 响应",
      appended: "已追加",
      append: "追加",
      appendFailed: "追加失败",
      extractedTasks: {
        detailLabels: {
          owner: "负责人",
          due: "截止",
          blocker: "阻塞"
        },
        detail: (label, value) => `${label}：${value}`,
        detailList: (details) => details.length > 0 ? ` （${details.join("；")}）` : "",
        noActionableTasksFound: "没有找到可执行任务。",
        validation: {
          labels: {
            response: "AI 任务提取响应",
            responseGroups: "AI 任务提取响应分组",
            group: (index) => `AI 任务提取分组 ${index + 1}`,
            groupTasks: (index) => `AI 任务提取分组 ${index + 1} 的任务`,
            groupTopic: (index) => `AI 任务提取分组 ${index + 1} 的主题`,
            task: (index) => `AI 任务提取任务 ${index + 1}`,
            taskBlocker: (index) => `AI 任务提取任务 ${index + 1} 的阻塞项`,
            taskDone: (index) => `AI 任务提取任务 ${index + 1} 的完成状态`,
            taskDue: (index) => `AI 任务提取任务 ${index + 1} 的截止时间`,
            taskOwner: (index) => `AI 任务提取任务 ${index + 1} 的负责人`,
            taskTitle: (index) => `AI 任务提取任务 ${index + 1} 的标题`
          },
          mustBeArray: (label) => `${label}必须是数组`,
          mustBeBoolean: (label) => `${label}必须是布尔值`,
          mustBeObject: (label) => `${label}必须是对象`,
          mustBeString: (label) => `${label}必须是字符串`,
          mustBeValidJson: "AI 任务提取响应必须是有效 JSON",
          mustContainAtMostItems: (label, maxItems) => `${label}最多只能包含 ${maxItems} 项`,
          mustContainAtMostCharacters: (label, maxLength) => `${label}最多只能包含 ${maxLength} 个字符`
        }
      },
      noContent: "没有响应内容。",
      replaced: "已替换",
      replace: "替换",
      replaceFailed: "替换失败",
      titles: {
        [workbenchAiRequestActions.continueActiveNote]: "续写当前笔记",
        [workbenchAiRequestActions.extractTasksActiveNote]: "从当前笔记提取任务",
        [workbenchAiRequestActions.rewriteActiveNote]: "重写当前笔记",
        [workbenchAiRequestActions.summarizeActiveNote]: "总结当前笔记"
      },
      tokenUsage: {
        input: (count) => `输入 ${count}`,
        output: (count) => `输出 ${count}`,
        total: (count) => `合计 ${count}`,
        join: (parts) => parts.join(" / ")
      }
    },
    commandPalette: {
      ariaLabel: "命令面板",
      commandInput: "命令",
      noMatchingCommands: "没有匹配的命令"
    },
    quickOpen: {
      ariaLabel: "快速打开"
    },
    remoteSync: {
      ariaLabel: "远程同步计划",
      cancel: "取消",
      completedAt: (completedAt: number) => `完成于 ${new Date(completedAt).toLocaleString()}`,
      conflicts: "冲突",
      defaultRemoteScope: "默认远程范围",
      directions: {
        push: "推送",
        pull: "拉取",
        bidirectional: "双向"
      },
      dryRun: "试运行",
      executed: "已执行",
      executedOperations: "已执行操作",
      executedStatus: (summary: string) => `已执行：${summary}`,
      execute: "执行",
      executing: "执行中",
      executionBlockReasons: {
        [workbenchRemoteSyncPlanExecutionBlockReasons.conflicts]: "执行前请先解决远程同步冲突",
        [workbenchRemoteSyncPlanExecutionBlockReasons.empty]: "没有需要执行的远程同步变更"
      },
      executionInProgress: "正在执行",
      executionInProgressWithProgress: (progress: string) => `正在执行：${progress}`,
      noConflicts: "没有冲突",
      noOperationsExecuted: "没有执行操作",
      noOperationsPlanned: "没有计划操作",
      noProgressReported: "没有进度",
      operationDetail: (target: string, message?: string) => message ? `${target}：${message}` : target,
      operationKinds: {
        create: "创建",
        update: "更新",
        delete: "删除",
        skip: "跳过",
        conflict: "冲突"
      },
      operationTargets: {
        local: "本地",
        remote: "远端",
        both: "双端",
        none: "无"
      },
      planOperations: "计划操作",
      progress: "进度",
      progressCompleted: (count: number) => `已完成 ${count}`,
      progressOperation: (operation: string, relativePath: string) => `${operation} ${relativePath}`,
      progressParts: (parts: readonly string[]) => parts.join("："),
      providerLabel: (providerId: string) => `服务商：${providerId}`,
      refreshBaseline: "刷新基线",
      remoteScopeLabel: (remoteScopeId: string) => `远程范围：${remoteScopeId}`,
      summary: (summary) => [
        `创建 ${summary.creates}`,
        `更新 ${summary.updates}`,
        `删除 ${summary.deletes}`,
        `跳过 ${summary.skips}`,
        `冲突 ${summary.conflicts}`
      ].join("，"),
      earlierProgressEvents: (count: number) => `${count} 条更早的进度`,
      moreOperations: (count: number) => `还有 ${count} 个操作`,
      title: "远程同步计划",
      useLocal: "使用本地",
      useRemote: "使用远端",
      workspaceLabel: (workspaceUri: string) => `工作区：${workspaceUri}`
    },
    saveConflict: {
      ariaLabel: "保存冲突",
      overwrite: "覆盖",
      reload: "重新加载",
      title: "磁盘上的文件已变更"
    }
  },
  settings: {
    aiProviderFallback: "AI 服务商",
    apiKey: "API Key",
    baseUrl: "Base URL",
    clearKeybindingSearch: "清空快捷键搜索",
    clearSettingsSearch: "清空设置搜索",
    deleteMissing: "删除缺失文件",
    diagnosticConnectionFailed: "连接失败",
    diagnosticConnectionOk: "连接正常",
    diagnosticConnectionOkWithMessage: (message) => `连接正常：${message}`,
    diagnosticResponseMetadata: (parts) => parts.join("，"),
    diagnosticTestingProvider: "正在测试服务商",
    endpoint: "端点",
    headerBinding: "Header 绑定",
    headerName: "Header 名称",
    headerScheme: "Header Scheme",
    keybindingConflict: (label: string, command: string) => `${label} 已被 ${command} 使用。`,
    keybindingsSearch: "搜索快捷键",
    listPath: "列表路径",
    localization: zhCNSettingsLocalization,
    maxOutput: "最大输出",
    metadata: "元数据",
    model: "模型",
    modified: "已修改",
    modifiedKeybindings: "已修改的快捷键",
    noAiProviders: "尚未配置 AI 服务商",
    noMatchingCommands: "没有匹配的命令",
    noMatchingSettings: "没有匹配的设置",
    noModifiedShortcuts: "没有修改过的快捷键",
    noRemoteSyncProfiles: "尚未配置远程同步",
    numberValueAriaLabel: (label) => `${label}数值`,
    pageSize: "分页大小",
    pressKeys: "按下快捷键",
    providerId: "Provider ID",
    rawMirror: "Raw Mirror",
    reasoning: "推理",
    record: "录制",
    remoteScope: "远程范围",
    remoteSyncSecret: "远程同步密钥",
    remoteSyncSecretAriaLabel: (secretName) => `远程同步密钥：${secretName}`,
    remoteSyncProfileFallback: "远程同步配置",
    replace: "替换",
    resetAll: "全部重置",
    retryCount: "重试次数",
    retryDelay: "重试延迟",
    retryStatus: "重试状态码",
    saveKey: "保存密钥",
    searchSettings: "搜索设置",
    secretBindings: "密钥绑定",
    secretRef: "Secret Ref",
    settingsSections: "设置分组",
    storeResponse: "存储响应",
    title: "设置",
    titleField: "标题",
    unassigned: "未分配",
    uploadPath: "上传路径",
    downloadPath: "下载路径",
    deletePath: "删除路径",
    valueSuffix: "数值",
    verbosity: "详细度",
    addProvider: "添加服务商",
    addProfile: "添加配置",
    addLarkProfile: "添加飞书",
    larkAuthorization: "飞书授权",
    larkAuthCheck: "检查",
    larkAuthStart: "一键授权",
    larkAuthComplete: "完成授权",
    larkAuthReady: "授权已开始",
    larkAuthAuthorized: "已授权",
    larkAuthFailed: "授权失败",
    larkAuthDeviceCode: "设备码",
    larkAuthUrl: "验证链接",
    larkFolderCreate: "新建文件夹",
    larkFolderCreatePrompt: "远端文件夹名称",
    larkFolderCreated: "已选择新文件夹",
    larkFolderCurrent: "当前文件夹",
    larkFolderEnter: "进入",
    larkFolderList: "列出文件夹",
    larkFolderListFailed: "文件夹列表失败",
    larkFolderNone: "没有文件夹",
    larkFolderRoot: "使用云盘根目录",
    larkFolderSelect: "选择文件夹",
    larkFolderSelectCurrent: "选择当前",
    larkFolderSelected: "已选择文件夹",
    larkFolderTools: "飞书文件夹",
    validationIssues: {
      [settingsValidationIssueCodes.aiProviderInvalid]: "请补全服务商 ID、标题、HTTPS 或本地端点、模型、密钥引用，并确认请求设置有效。",
      [settingsValidationIssueCodes.providerIdDuplicate]: "服务商 ID 已被使用。",
      [settingsValidationIssueCodes.rawMirrorDeleteInvalid]: "请补全有效的 Raw Mirror 删除元数据。",
      [settingsValidationIssueCodes.rawMirrorListInvalid]: "请补全有效的 Raw Mirror 列表元数据。",
      [settingsValidationIssueCodes.rawMirrorMetadataInvalid]: "请补全 Raw Mirror 路径和 Header 绑定元数据。",
      [settingsValidationIssueCodes.rawMirrorRetryInvalid]: "请补全有效的 Raw Mirror 重试元数据。",
      [settingsValidationIssueCodes.remoteSyncProviderInvalid]: "请补全服务商 ID、标题、HTTPS 或本地 Base URL，并确认配置绑定有效。"
    },
    units: {
      [settingsNumberUnitIds.characters]: "字符",
      [settingsNumberUnitIds.entries]: "项",
      [settingsNumberUnitIds.megabytes]: "MB",
      [settingsNumberUnitIds.milliseconds]: "毫秒",
      [settingsNumberUnitIds.pixels]: "像素"
    },
    colorSchemeOptions: [
      { value: "system", label: "跟随系统" },
      { value: "light", label: "浅色" },
      { value: "dark", label: "深色" }
    ],
    densityOptions: [
      { value: "comfortable", label: "舒适" },
      { value: "compact", label: "紧凑" }
    ],
    localeOptions: createWorkbenchLocaleOptions(zhCNWorkbenchLocaleOptionLabels),
    reasoningOptions: [
      { value: "", label: "默认" },
      { value: "none", label: "无" },
      { value: "minimal", label: "最小" },
      { value: "low", label: "低" },
      { value: "medium", label: "中" },
      { value: "high", label: "高" },
      { value: "xhigh", label: "极高" }
    ],
    textVerbosityOptions: [
      { value: "", label: "默认" },
      { value: "low", label: "低" },
      { value: "medium", label: "中" },
      { value: "high", label: "高" }
    ]
  }
} satisfies WorkbenchMessages;

const workbenchMessagesByLocale = {
  en: enWorkbenchMessages,
  "zh-CN": zhCNWorkbenchMessages
} as const satisfies Record<TyporaPlusLocale, WorkbenchMessages>;

export function createWorkbenchMessages(locale: WorkbenchLocale | undefined): WorkbenchMessages {
  return workbenchMessagesByLocale[locale ?? defaultTyporaPlusLocale];
}

export function createWorkbenchEditorLabels(locale: WorkbenchLocale | undefined): MarkdownEditorLabels {
  return createWorkbenchMessages(locale).editor;
}

export function formatSettingsValidationIssue(
  issue: SettingsValidationIssueCode,
  messages: WorkbenchMessages
): string {
  return messages.settings.validationIssues[issue] ?? issue;
}

export function formatRemoteSyncSecretAriaLabel(
  secretName: string,
  messages: WorkbenchMessages
): string {
  return messages.settings.remoteSyncSecretAriaLabel(secretName);
}

export function localizeWorkbenchCommands(
  commands: readonly CommandMetadata[],
  messages: WorkbenchMessages
): readonly CommandMetadata[] {
  return commands.map((command) => ({
    ...command,
    title: localizeWorkbenchCommandTitle(command.id, command.title, messages),
    ...(command.category
      ? { category: messages.commands.categories[command.category] ?? command.category }
      : {})
  }));
}

export function localizeWorkbenchCommandTitle(
  id: string,
  fallback: string,
  messages: WorkbenchMessages
): string {
  return messages.commands.titles[id] ?? fallback;
}

export function localizeWorkbenchMenuItemTitle(
  item: Pick<MenuItem, "command" | "id" | "title">,
  getCommandTitle: (id: string) => string,
  messages: WorkbenchMessages
): string {
  return messages.menuItems[item.id] ??
    messages.commands.titles[item.command] ??
    item.title ??
    getCommandTitle(item.command);
}

export function formatWorkbenchAiResponseCopyLabel(
  copyState: "idle" | "copied" | "failed",
  messages: WorkbenchMessages
): string {
  switch (copyState) {
    case "copied":
      return messages.common.copied;
    case "failed":
      return messages.common.copyFailed;
    case "idle":
      return messages.common.copy;
  }
}

export function formatLocalizedWorkbenchAiResponseApplyLabel(
  mode: WorkbenchAiResponseApplyMode,
  state: WorkbenchAiResponseApplyState,
  messages: WorkbenchMessages
): string {
  const labels = messages.dialogs.aiResponse;

  switch (state) {
    case "applied":
      return mode === "replace" ? labels.replaced : labels.appended;
    case "failed":
      return mode === "replace" ? labels.replaceFailed : labels.appendFailed;
    case "idle":
      return mode === "replace" ? labels.replace : labels.append;
  }
}
