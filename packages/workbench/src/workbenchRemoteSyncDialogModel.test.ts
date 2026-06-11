import { describe, expect, it } from "vitest";
import { URI } from "@typora-plus/base";
import type { RemoteSyncPlan, RemoteSyncResult } from "@typora-plus/platform";
import {
  createWorkbenchRemoteSyncDialogExecutionState,
  formatWorkbenchRemoteSyncSummary
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
