import { describe, expect, it } from "vitest";
import { defaultTyporaPlusLocale, typoraPlusLocales } from "@typora-plus/platform";
import {
  createSettingsSearchResult,
  createSettingsVisibilityState,
  settingsEntries,
  settingsEntryIds,
  settingsSections,
  settingsValidationIssueCodes
} from "./settingsModel";
import {
  createWorkbenchEditorLabels,
  createWorkbenchMessages,
  formatRemoteSyncSecretAriaLabel,
  formatSettingsValidationIssue,
  formatLocalizedWorkbenchAiResponseApplyLabel,
  formatWorkbenchAiResponseCopyLabel,
  localizeWorkbenchCommandTitle,
  localizeWorkbenchCommands,
  localizeWorkbenchMenuItemTitle,
  settingsNumberUnitIds
} from "./workbenchI18n";
import { workbenchCommandIds } from "./workbenchCommandIds";
import { defaultWorkbenchMenuItems } from "./workbenchContributions";
import {
  getWorkbenchCommandMetadata,
  workbenchCommandCategories
} from "./workbenchCommandMetadata";
import {
  workbenchRemoteSyncConflictResolutions,
  workbenchRemoteSyncPlanExecutionBlockReasons
} from "./workbenchRemoteSyncActions";
import { workbenchAiRequestActions } from "./workbenchAiRequestModel";

describe("workbench i18n", () => {
  it("uses English messages by default and falls back to source command labels", () => {
    const messages = createWorkbenchMessages(undefined);
    const defaultMessages = createWorkbenchMessages(defaultTyporaPlusLocale);

    expect(messages).toBe(defaultMessages);
    expect(messages.locale).toBe(defaultTyporaPlusLocale);
    expect(messages.actionRunner.operationFailed).toBe("Operation failed");
    expect(localizeWorkbenchCommandTitle("missing.command", "Missing", messages)).toBe("Missing");
    expect(localizeWorkbenchMenuItemTitle({
      id: "missing.menu",
      command: "missing.command",
      title: "Missing Menu"
    }, () => "Missing Command", messages)).toBe("Missing Menu");
    expect(createWorkbenchEditorLabels(undefined)).toBe(defaultMessages.editor);
  });

  it("localizes command metadata and contributed menu item titles", () => {
    const messages = createWorkbenchMessages("zh-CN");
    const commands = localizeWorkbenchCommands([
      {
        id: workbenchCommandIds.file.save,
        title: "Save",
        category: "File"
      }
    ], messages);

    expect(commands).toEqual([
      {
        id: workbenchCommandIds.file.save,
        title: "保存",
        category: "文件"
      }
    ]);
    expect(localizeWorkbenchMenuItemTitle({
      id: "activitybar.primary.search",
      command: workbenchCommandIds.workbench.sidebarSearch,
      title: "Search"
    }, () => "Show Search", messages)).toBe("搜索");
    expect(messages.actionRunner.fileChangedOnDisk).toBe("磁盘上的文件已变更");
    expect(messages.actionRunner.operationFailed).toBe("操作失败");
  });

  it("covers built-in command, menu, and settings localization surfaces", () => {
    for (const locale of typoraPlusLocales) {
      const messages = createWorkbenchMessages(locale);
      const localeOptionValues = messages.settings.localeOptions.map((option) => option.value);
      const missingCommandTitles = getWorkbenchCommandMetadata()
        .map((command) => command.id)
        .filter((id) => !messages.commands.titles[id]);
      const missingCommandCategories = Object.values(workbenchCommandCategories)
        .filter((category) => !messages.commands.categories[category]);
      const missingMenuItems = defaultWorkbenchMenuItems
        .map((item) => item.id)
        .filter((id) => !messages.menuItems[id]);
      const missingSettingsSections = settingsSections
        .map((section) => section.id)
        .filter((id) => !messages.settings.localization.sections?.[id]);
      const missingSettingsEntries = settingsEntries
        .map((entry) => entry.id)
        .filter((id) => !messages.settings.localization.entries?.[id]?.label);

      expect(messages.locale, `${locale} message table`).toBe(locale);
      expect(localeOptionValues, `${locale} locale options`).toEqual([...typoraPlusLocales]);
      expect(missingCommandTitles, `${locale} command titles`).toEqual([]);
      expect(missingCommandCategories, `${locale} command categories`).toEqual([]);
      expect(missingMenuItems, `${locale} menu items`).toEqual([]);
      expect(missingSettingsSections, `${locale} settings sections`).toEqual([]);
      expect(missingSettingsEntries, `${locale} settings entries`).toEqual([]);
    }
  });

  it("localizes settings search labels while keeping English keywords searchable", () => {
    const messages = createWorkbenchMessages("zh-CN");
    const languageResult = createSettingsSearchResult("语言", messages.settings.localization);
    const englishResult = createSettingsSearchResult("translation", messages.settings.localization);
    const visibility = createSettingsVisibilityState(languageResult, messages.settings.localization);

    expect(languageResult.visibleEntries).toEqual([settingsEntryIds.appearance.language]);
    expect(englishResult.visibleEntries).toEqual([settingsEntryIds.appearance.language]);
    expect(visibility.visibleSections.map((section) => section.title)).toEqual(["外观"]);
  });

  it("formats localized AI response action labels", () => {
    const messages = createWorkbenchMessages("zh-CN");

    expect(formatWorkbenchAiResponseCopyLabel("copied", messages)).toBe("已复制");
    expect(formatLocalizedWorkbenchAiResponseApplyLabel("append", "idle", messages)).toBe("追加");
    expect(formatLocalizedWorkbenchAiResponseApplyLabel("replace", "failed", messages)).toBe("替换失败");
    expect(messages.dialogs.aiResponse.extractedTasks.detailLabels.owner).toBe("负责人");
    expect(messages.dialogs.aiResponse.extractedTasks.detail("截止", "周五")).toBe("截止：周五");
    expect(messages.dialogs.aiResponse.extractedTasks.noActionableTasksFound).toBe("没有找到可执行任务。");
    const validation = messages.dialogs.aiResponse.extractedTasks.validation;
    if (!validation) {
      throw new Error("missing extracted task validation messages");
    }
    expect(validation.mustBeValidJson).toBe("AI 任务提取响应必须是有效 JSON");
    expect(validation.mustBeBoolean(validation.labels.taskDone(0)))
      .toBe("AI 任务提取任务 1 的完成状态必须是布尔值");
    expect(messages.dialogs.aiResponse.tokenUsage.join([
      messages.dialogs.aiResponse.tokenUsage.input(10),
      messages.dialogs.aiResponse.tokenUsage.output(4),
      messages.dialogs.aiResponse.tokenUsage.total(14)
    ])).toBe("输入 10 / 输出 4 / 合计 14");
  });

  it("localizes editor live preview labels", () => {
    const messages = createWorkbenchMessages("zh-CN");

    expect(messages.editor.copyCode).toBe("复制代码");
    expect(messages.editor.rendererUnavailable("Mermaid")).toBe("渲染器不可用：Mermaid");
    expect(messages.editor.setColumnAlignment(2, messages.editor.tableAlignment("right"))).toBe(
      "将第 2 列对齐方式设为右对齐"
    );
  });

  it("localizes Settings validation issues and secret labels", () => {
    const messages = createWorkbenchMessages("zh-CN");

    expect(formatSettingsValidationIssue(settingsValidationIssueCodes.providerIdDuplicate, messages)).toBe(
      "服务商 ID 已被使用。"
    );
    expect(formatSettingsValidationIssue(settingsValidationIssueCodes.rawMirrorRetryInvalid, messages)).toBe(
      "请补全有效的 Raw Mirror 重试元数据。"
    );
    expect(formatRemoteSyncSecretAriaLabel("access", messages)).toBe("远程同步密钥：access");
    expect(messages.settings.diagnosticConnectionOkWithMessage("served-model，合计 14")).toBe(
      "连接正常：served-model，合计 14"
    );
    expect(messages.settings.diagnosticResponseMetadata(["served-model", "合计 14"])).toBe("served-model，合计 14");
  });

  it("localizes Settings number units", () => {
    const messages = createWorkbenchMessages("zh-CN");

    expect(messages.settings.units[settingsNumberUnitIds.characters]).toBe("字符");
    expect(messages.settings.units[settingsNumberUnitIds.entries]).toBe("项");
    expect(messages.settings.units[settingsNumberUnitIds.milliseconds]).toBe("毫秒");
    expect(messages.settings.units[settingsNumberUnitIds.pixels]).toBe("像素");
    expect(messages.settings.numberValueAriaLabel("重试延迟")).toBe("重试延迟数值");
  });

  it("localizes AI workspace context detail labels", () => {
    const messages = createWorkbenchMessages("zh-CN").ai.workspaceContext;

    expect(messages.path("notes/A.md")).toBe("路径：notes/A.md");
    expect(messages.line(12)).toBe("行：12");
    expect(messages.detailList(["路径：notes/A.md", "行：12", "片段"])).toBe("路径：notes/A.md\n行：12\n片段");
  });

  it("localizes active-note AI request instructions", () => {
    const instructions = createWorkbenchMessages("zh-CN").ai.activeNoteRequest.instructions;

    expect(instructions[workbenchAiRequestActions.continueActiveNote]).toContain("继续写作");
    expect(instructions[workbenchAiRequestActions.rewriteActiveNote]).toContain("代码围栏");
    expect(instructions[workbenchAiRequestActions.summarizeActiveNote]).toBe(
      "总结当前 Markdown 笔记。 保留重要决策、开放任务和未解决问题。 保持回复简洁，不要编造事实。"
    );
    expect(instructions[workbenchAiRequestActions.extractTasksActiveNote]).toContain("符合请求 schema 的 JSON");
  });

  it("localizes active-note AI action errors", () => {
    const messages = createWorkbenchMessages("zh-CN").ai.activeNoteAction;

    expect(messages.titles[workbenchAiRequestActions.summarizeActiveNote]).toBe("总结当前笔记");
    expect(messages.noProviderAvailable(messages.titles[workbenchAiRequestActions.summarizeActiveNote]))
      .toBe("没有可用于总结当前笔记的 AI 服务商");
  });

  it("localizes AI provider diagnostic request messages", () => {
    const messages = createWorkbenchMessages("zh-CN").ai.providerDiagnostic;

    expect(messages.providerIdRequired).toBe("AI 服务商 ID 是诊断所必需的");
    expect(messages.request.instruction).toContain("纯文本确认");
    expect(messages.request.input).toBe("Typora Plus AI 服务商连接检查。");
  });

  it("localizes secret action error messages", () => {
    const enMessages = createWorkbenchMessages("en");
    const zhMessages = createWorkbenchMessages("zh-CN");

    expect(enMessages.ai.secrets.referenceInvalid).toBe("AI secret reference is invalid");
    expect(enMessages.remoteSync.secrets.storageUnavailable).toBe("Remote sync secret storage is unavailable");
    expect(enMessages.remoteSync.larkAuth.deviceCodeMissing).toBe("Lark authorization device code is missing");
    expect(zhMessages.ai.secrets.valueEmpty).toBe("AI 密钥值不能为空");
    expect(zhMessages.remoteSync.secrets.referenceInvalid).toBe("远程同步密钥引用无效");
    expect(zhMessages.remoteSync.larkAuth.requestUnavailable).toBe("远程同步本机请求桥不可用");
  });

  it("localizes remote sync dialog state labels", () => {
    const workbenchMessages = createWorkbenchMessages("zh-CN");
    const messages = workbenchMessages.dialogs.remoteSync;

    expect(messages.directions.push).toBe("推送");
    expect(messages.operationKinds.update).toBe("更新");
    expect(messages.operationTargets.remote).toBe("远端");
    expect(messages.summary({
      creates: 1,
      updates: 2,
      deletes: 0,
      skips: 3,
      conflicts: 0
    })).toBe("创建 1，更新 2，删除 0，跳过 3，冲突 0");
    expect(messages.executionBlockReasons[workbenchRemoteSyncPlanExecutionBlockReasons.empty])
      .toBe("没有需要执行的远程同步变更");
    expect(messages.useLocal).toBe("使用本地");
    expect(messages.useRemote).toBe("使用远端");
    expect(workbenchMessages.remoteSync.actions.noProviderAvailable)
      .toBe("没有可用于工作区同步规划的远程同步服务商");
    expect(
      workbenchMessages.remoteSync.actions.conflictResolutionMessages[workbenchRemoteSyncConflictResolutions.useLocal]
    ).toBe("已改为使用本地资源解决");
    expect(workbenchMessages.remoteSync.markdownAssets.contentEncodingInvalid)
      .toBe("远程同步 Markdown 资产发现需要有效的 base64 内容");
    expect(workbenchMessages.remoteSync.request.noWorkspaceOpen)
      .toBe("没有打开可用于远程同步规划的工作区");
  });
});
