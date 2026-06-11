import { describe, expect, it } from "vitest";
import { URI } from "@typora-plus/base";
import type { RemoteSyncPlan, RemoteSyncResult } from "@typora-plus/platform";
import {
  appendWorkbenchRemoteSyncProgressHistory,
  createWorkbenchRemoteSyncDialogConflictPreview,
  createWorkbenchRemoteSyncDialogProgressPreview,
  createWorkbenchRemoteSyncDialogOperationPreview,
  createWorkbenchRemoteSyncDialogExecutionState,
  formatWorkbenchRemoteSyncOperationDetail,
  formatWorkbenchRemoteSyncProgress,
  formatWorkbenchRemoteSyncSummary,
  getWorkbenchRemoteSyncLatestProgress
} from "./workbenchRemoteSyncDialogModel";

describe("workbench remote sync dialog model", () => {
  it("enables execution only for eligible idle plans", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("create"), {
      executing: false,
      execution: undefined
    })).toEqual({
      canCancel: false,
      canExecute: true,
      executeLabel: "Execute"
    });
  });

  it("exposes cancellable running state while execution is pending", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("update"), {
      executing: true,
      execution: undefined
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
      statusMessage: "Execution in progress: 2/5: Uploading note: update A.md"
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
      }
    })).toEqual({
      canCancel: false,
      canExecute: false,
      executeLabel: "Executed",
      statusMessage: "Executed: 1 create, 2 update, 0 delete, 3 skip, 0 conflict"
    });
  });

  it("reports conflict and no-op block reasons", () => {
    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("conflict"), {
      executing: false,
      execution: undefined
    }).statusMessage).toBe("Resolve remote sync conflicts before execution");

    expect(createWorkbenchRemoteSyncDialogExecutionState(plan("skip"), {
      executing: false,
      execution: undefined
    }).statusMessage).toBe("No remote sync changes to execute");
  });

  it("formats operation summaries consistently", () => {
    expect(formatWorkbenchRemoteSyncSummary(result().summary))
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
    expect(formatWorkbenchRemoteSyncOperationDetail(operation("update", "A.md", "uploaded")))
      .toBe("remote: uploaded");
    expect(formatWorkbenchRemoteSyncOperationDetail(operation("skip", "B.md")))
      .toBe("none");
  });

  it("formats progress with optional counts and operation details", () => {
    expect(formatWorkbenchRemoteSyncProgress({
      message: "Finalizing",
      completed: 3
    })).toBe("3 completed: Finalizing");
    expect(formatWorkbenchRemoteSyncProgress({
      message: "Checking remote"
    })).toBe("Checking remote");
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
