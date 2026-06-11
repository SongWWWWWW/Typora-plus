import type { RemoteSyncPlan } from "@typora-plus/platform";
import type { WorkbenchRemoteSyncExecutionResult } from "./workbenchRemoteSyncActions";
import { getWorkbenchRemoteSyncPlanExecutionBlockReason } from "./workbenchRemoteSyncActions";

export interface WorkbenchRemoteSyncDialogExecutionState {
  readonly canCancel: boolean;
  readonly canExecute: boolean;
  readonly executeLabel: string;
  readonly statusMessage?: string;
}

export function createWorkbenchRemoteSyncDialogExecutionState(
  plan: RemoteSyncPlan,
  options: {
    readonly executing: boolean;
    readonly execution: WorkbenchRemoteSyncExecutionResult | undefined;
  }
): WorkbenchRemoteSyncDialogExecutionState {
  if (options.execution) {
    return {
      canCancel: false,
      canExecute: false,
      executeLabel: "Executed",
      statusMessage: `Executed: ${formatWorkbenchRemoteSyncSummary(options.execution.result.summary)}`
    };
  }

  if (options.executing) {
    return {
      canCancel: true,
      canExecute: false,
      executeLabel: "Executing",
      statusMessage: "Execution in progress"
    };
  }

  const blockReason = getWorkbenchRemoteSyncPlanExecutionBlockReason(plan);

  if (blockReason) {
    return {
      canCancel: false,
      canExecute: false,
      executeLabel: "Execute",
      statusMessage: blockReason
    };
  }

  return {
    canCancel: false,
    canExecute: true,
    executeLabel: "Execute"
  };
}

export function formatWorkbenchRemoteSyncSummary(summary: RemoteSyncPlan["summary"]): string {
  return [
    `${summary.creates} create`,
    `${summary.updates} update`,
    `${summary.deletes} delete`,
    `${summary.skips} skip`,
    `${summary.conflicts} conflict`
  ].join(", ");
}
