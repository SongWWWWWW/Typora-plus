import { describe, expect, it } from "vitest";
import { URI } from "@typora-plus/base";
import type { RemoteSyncPlan, RemoteSyncResult } from "@typora-plus/platform";
import { workbenchRemoteSyncPlanExecutionBlockReasons } from "./workbenchRemoteSyncActions";
import {
  appendWorkbenchRemoteSyncProgressHistory,
  createWorkbenchRemoteSyncDialogConflictPreview,
  createWorkbenchRemoteSyncDialogConflictResolutionState,
  createWorkbenchRemoteSyncDialogProgressPreview,
  createWorkbenchRemoteSyncDialogOperationPreview,
  createWorkbenchRemoteSyncDialogExecutionState,
  formatWorkbenchRemoteSyncDirection,
  formatWorkbenchRemoteSyncOperationKind,
  formatWorkbenchRemoteSyncOperationDetail,
  formatWorkbenchRemoteSyncProgress,
  formatWorkbenchRemoteSyncSummary,
  getWorkbenchRemoteSyncLatestProgress,
  type WorkbenchRemoteSyncDialogMessages
} from "./workbenchRemoteSyncDialogModel";

const enRemoteSyncMessages: WorkbenchRemoteSyncDialogMessages = {
  directions: {
    push: "Push",
    pull: "Pull",
    bidirectional: "Bidirectional"
  },
  executed: "Executed",
  executedStatus: (summary) => `Executed: ${summary}`,
  execute: "Execute",
  executing: "Executing",
  executionBlockReasons: {
    [workbenchRemoteSyncPlanExecutionBlockReasons.conflicts]: "Resolve remote sync conflicts before execution",
    [workbenchRemoteSyncPlanExecutionBlockReasons.empty]: "No remote sync changes to execute"
  },
  executionInProgress: "Execution in progress",
  executionInProgressWithProgress: (progress) => `Execution in progress: ${progress}`,
  operationDetail: (target, message) => message ? `${target}: ${message}` : target,
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
  progressCompleted: (count) => `${count} completed`,
  progressOperation: (operation, relativePath) => `${operation} ${relativePath}`,
  progressParts: (parts) => parts.join(": "),
  refreshBaseline: "Refresh Baseline",
  summary: (summary) => [
    `${summary.creates} create`,
    `${summary.updates} update`,
    `${summary.deletes} delete`,
    `${summary.skips} skip`,
    `${summary.conflicts} conflict`
  ].join(", "),
  useLocal: "Use Local",
  useRemote: "Use Remote"
};

const zhRemoteSyncMessages: WorkbenchRemoteSyncDialogMessages = {
  ...enRemoteSyncMessages,
  directions: {
    push: "推送",
    pull: "拉取",
    bidirectional: "双向"
  },
  executed: "已执行",
  executedStatus: (summary) => `已执行：${summary}`,
  execute: "执行",
  executing: "执行中",
  executionBlockReasons: {
    [workbenchRemoteSyncPlanExecutionBlockReasons.conflicts]: "执行前请先解决远程同步冲突",
    [workbenchRemoteSyncPlanExecutionBlockReasons.empty]: "没有需要执行的远程同步变更"
  },
  executionInProgress: "正在执行",
  executionInProgressWithProgress: (progress) => `正在执行：${progress}`,
  operationDetail: (target, message) => message ? `${target}：${message}` : target,
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
  progressCompleted: (count) => `已完成 ${count}`,
  progressOperation: (operation, relativePath) => `${operation} ${relativePath}`,
  progressParts: (parts) => parts.join("："),
  refreshBaseline: "刷新基线",
  summary: (summary) => [
    `创建 ${summary.creates}`,
    `更新 ${summary.updates}`,
    `删除 ${summary.deletes}`,
    `跳过 ${summary.skips}`,
    `冲突 ${summary.conflicts}`
  ].join("，"),
  useLocal: "使用本地",
  useRemote: "使用远端"
};

describe("workbench remote sync dialog model", () => {
  it("enables execution only for eligible idle plans", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("create"), {
      executing: false,
      execution: undefined,
      messages: enRemoteSyncMessages
    })).toEqual({
      canCancel: false,
      canExecute: true,
      executeLabel: "Execute"
    });

    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("skip"), {
      executing: false,
      execution: undefined,
      messages: enRemoteSyncMessages
    })).toEqual({
      canCancel: false,
      canExecute: true,
      executeLabel: "Refresh Baseline"
    });
  });

  it("exposes cancellable running state while execution is pending", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("update"), {
      executing: true,
      execution: undefined,
      messages: enRemoteSyncMessages
    })).toEqual({
      canCancel: true,
      canExecute: false,
      executeLabel: "Executing",
      statusMessage: "Execution in progress"
    });
  });

  it("includes the latest provider progress while execution is pending", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("update"), {
      executing: true,
      execution: undefined,
      messages: enRemoteSyncMessages,
      progress: {
        message: "Uploading note",
        completed: 2,
        total: 5,
        operation: operation("update", "A.md")
      }
    })).toEqual({
      canCancel: true,
      canExecute: false,
      executeLabel: "Executing",
      statusMessage: "Execution in progress: 2/5: Uploading note: Update A.md"
    });
  });

  it("reports completed execution summaries", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("delete"), {
      executing: false,
      execution: {
        providerId: "sync.provider",
        request: {
          workspaceUri: URI.file("C:/Notes"),
          resources: [],
          direction: "push",
          dryRun: false
        },
        plan: plan("delete"),
        result: result()
      },
      messages: enRemoteSyncMessages
    })).toEqual({
      canCancel: false,
      canExecute: false,
      executeLabel: "Executed",
      statusMessage: "Executed: 1 create, 2 update, 0 delete, 3 skip, 0 conflict"
    });
  });

  it("reports conflict and empty plan block reasons", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("conflict"), {
      executing: false,
      execution: undefined,
      messages: enRemoteSyncMessages
    }).statusMessage).toBe("Resolve remote sync conflicts before execution");

    expect(createWorkbenchRemoteSyncDialogExecutionState(emptyPlan(), {
      executing: false,
      execution: undefined,
      messages: enRemoteSyncMessages
    }).statusMessage).toBe("No remote sync changes to execute");
  });

  it("exposes conflict resolution only before execution starts", () => {
    expect(createWorkbenchRemoteSyncDialogConflictResolutionState(plan("conflict"), {
      executing: false,
      execution: undefined,
      messages: enRemoteSyncMessages
    })).toEqual({
      canResolve: true,
      useLocalLabel: "Use Local",
      useRemoteLabel: "Use Remote"
    });

    expect(createWorkbenchRemoteSyncDialogConflictResolutionState(plan("conflict"), {
      executing: true,
      execution: undefined,
      messages: enRemoteSyncMessages
    }).canResolve).toBe(false);
    expect(createWorkbenchRemoteSyncDialogConflictResolutionState(plan("conflict"), {
      executing: false,
      execution: {
        providerId: "sync.provider",
        request: {
          workspaceUri: URI.file("C:/Notes"),
          resources: [],
          direction: "push",
          dryRun: false
        },
        plan: plan("conflict"),
        result: result()
      },
      messages: enRemoteSyncMessages
    }).canResolve).toBe(false);
    expect(createWorkbenchRemoteSyncDialogConflictResolutionState(plan("update"), {
      executing: false,
      execution: undefined,
      messages: enRemoteSyncMessages
    }).canResolve).toBe(false);
  });

  it("formats operation summaries consistently", () => {
    expect(formatWorkbenchRemoteSyncSummary(result().summary, enRemoteSyncMessages))
      .toBe("1 create, 2 update, 0 delete, 3 skip, 0 conflict");
  });

  it("creates bounded operation previews", () => {
    const preview = createWorkbenchRemoteSyncDialogOperationPreview([
      operation("create", "A.md"),
      operation("update", "B.md"),
      operation("delete", "C.md")
    ], {
      emptyMessage: "No operations",
      maxOperations: 2
    });

    expect(preview).toEqual({
      emptyMessage: "No operations",
      hiddenOperationCount: 1,
      operations: [
        operation("create", "A.md"),
        operation("update", "B.md")
      ]
    });
  });

  it("keeps operation previews stable for empty or invalid limits", () => {
    expect(createWorkbenchRemoteSyncDialogOperationPreview([operation("create", "A.md")], {
      emptyMessage: "No result operations",
      maxOperations: -1
    })).toEqual({
      emptyMessage: "No result operations",
      hiddenOperationCount: 1,
      operations: []
    });
  });

  it("creates bounded conflict previews from plan operations", () => {
    const preview = createWorkbenchRemoteSyncDialogConflictPreview([
      operation("create", "A.md"),
      operation("conflict", "B.md", "changed locally and remotely"),
      operation("conflict", "C.md"),
      operation("update", "D.md")
    ], {
      emptyMessage: "No conflicts",
      maxOperations: 1
    });

    expect(preview).toEqual({
      emptyMessage: "No conflicts",
      hiddenOperationCount: 1,
      operations: [
        operation("conflict", "B.md", "changed locally and remotely")
      ]
    });
    expect(createWorkbenchRemoteSyncDialogConflictPreview([operation("update", "D.md")], {
      emptyMessage: "No conflicts",
      maxOperations: 4
    })).toEqual({
      emptyMessage: "No conflicts",
      hiddenOperationCount: 0,
      operations: []
    });
  });

  it("keeps bounded progress history with the newest events retained", () => {
    const first = progress("Scanning");
    const second = progress("Uploading");
    const third = progress("Finalizing");
    const history = [first, second, third].reduce<readonly ReturnType<typeof progress>[]>(
      (events, event) => appendWorkbenchRemoteSyncProgressHistory(events, event, { maxEvents: 2 }),
      []
    );

    expect(history).toEqual([second, third]);
    expect(getWorkbenchRemoteSyncLatestProgress(history)).toBe(third);
    expect(appendWorkbenchRemoteSyncProgressHistory(history, progress("Ignored"), { maxEvents: -1 }))
      .toEqual([]);
  });

  it("creates bounded progress previews from the latest events", () => {
    const preview = createWorkbenchRemoteSyncDialogProgressPreview([
      progress("Scanning"),
      progress("Uploading"),
      progress("Finalizing")
    ], {
      emptyMessage: "No progress reported",
      maxEvents: 2
    });

    expect(preview).toEqual({
      emptyMessage: "No progress reported",
      hiddenProgressCount: 1,
      progressEvents: [
        progress("Uploading"),
        progress("Finalizing")
      ]
    });
  });

  it("formats operation details with provider messages when present", () => {
    expect(formatWorkbenchRemoteSyncOperationDetail(operation("update", "A.md", "uploaded"), enRemoteSyncMessages))
      .toBe("remote: uploaded");
    expect(formatWorkbenchRemoteSyncOperationDetail(operation("skip", "B.md"), enRemoteSyncMessages))
      .toBe("none");
  });

  it("formats progress with optional counts and operation details", () => {
    expect(formatWorkbenchRemoteSyncProgress({
      message: "Finalizing",
      completed: 3
    }, enRemoteSyncMessages)).toBe("3 completed: Finalizing");
    expect(formatWorkbenchRemoteSyncProgress({
      message: "Checking remote"
    }, enRemoteSyncMessages)).toBe("Checking remote");
  });

  it("formats localized direction, operation kind, summary, details, and progress", () => {
    expect(formatWorkbenchRemoteSyncDirection("push", zhRemoteSyncMessages)).toBe("推送");
    expect(formatWorkbenchRemoteSyncOperationKind("conflict", zhRemoteSyncMessages)).toBe("冲突");
    expect(formatWorkbenchRemoteSyncSummary(result().summary, zhRemoteSyncMessages))
      .toBe("创建 1，更新 2，删除 0，跳过 3，冲突 0");
    expect(formatWorkbenchRemoteSyncOperationDetail(operation("update", "A.md", "uploaded"), zhRemoteSyncMessages))
      .toBe("远端：uploaded");
    expect(formatWorkbenchRemoteSyncProgress({
      message: "Uploading note",
      completed: 2,
      total: 5,
      operation: operation("update", "A.md")
    }, zhRemoteSyncMessages)).toBe("2/5：Uploading note：更新 A.md");
  });
});

function plan(kind: RemoteSyncPlan["operations"][number]["kind"]): RemoteSyncPlan {
  return {
    operations: [{
      kind,
      target: kind === "conflict" ? "both" : kind === "skip" ? "none" : "remote",
      relativePath: "A.md"
    }],
    summary: {
      creates: kind === "create" ? 1 : 0,
      updates: kind === "update" ? 1 : 0,
      deletes: kind === "delete" ? 1 : 0,
      skips: kind === "skip" ? 1 : 0,
      conflicts: kind === "conflict" ? 1 : 0
    }
  };
}

function emptyPlan(): RemoteSyncPlan {
  return {
    operations: [],
    summary: {
      creates: 0,
      updates: 0,
      deletes: 0,
      skips: 0,
      conflicts: 0
    }
  };
}

function operation(
  kind: RemoteSyncPlan["operations"][number]["kind"],
  relativePath: string,
  message?: string
): RemoteSyncPlan["operations"][number] {
  const target = kind === "conflict" ? "both" : kind === "skip" ? "none" : "remote";

  return {
    kind,
    target,
    relativePath,
    ...(message ? { message } : {})
  };
}

function progress(message: string) {
  return {
    message
  };
}

function result(): RemoteSyncResult {
  return {
    operations: [],
    summary: {
      creates: 1,
      updates: 2,
      deletes: 0,
      skips: 3,
      conflicts: 0
    },
    completedAt: 123
  };
}
