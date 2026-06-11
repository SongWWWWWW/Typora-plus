import type {
  RemoteSyncOperation,
  RemoteSyncPlan,
  RemoteSyncProgress
} from "@typora-plus/platform";
import type { WorkbenchRemoteSyncExecutionResult } from "./workbenchRemoteSyncActions";
import { getWorkbenchRemoteSyncPlanExecutionBlockReason } from "./workbenchRemoteSyncActions";

export interface WorkbenchRemoteSyncDialogOperationPreview {
  readonly emptyMessage: string;
  readonly hiddenOperationCount: number;
  readonly operations: readonly RemoteSyncOperation[];
}

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
    readonly progress?: RemoteSyncProgress | undefined;
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
      statusMessage: options.progress
        ? `Execution in progress: ${formatWorkbenchRemoteSyncProgress(options.progress)}`
        : "Execution in progress"
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

export function createWorkbenchRemoteSyncDialogOperationPreview(
  operations: readonly RemoteSyncOperation[],
  options: {
    readonly emptyMessage: string;
    readonly maxOperations: number;
  }
): WorkbenchRemoteSyncDialogOperationPreview {
  const maxOperations = Math.max(0, Math.floor(options.maxOperations));
  const visibleOperations = operations.slice(0, maxOperations);

  return {
    emptyMessage: options.emptyMessage,
    hiddenOperationCount: Math.max(operations.length - visibleOperations.length, 0),
    operations: visibleOperations
  };
}

export function formatWorkbenchRemoteSyncOperationDetail(operation: RemoteSyncOperation): string {
  return operation.message ? `${operation.target}: ${operation.message}` : operation.target;
}

export function formatWorkbenchRemoteSyncProgress(progress: RemoteSyncProgress): string {
  const count = progress.total !== undefined
    ? `${progress.completed ?? 0}/${progress.total}`
    : progress.completed !== undefined
      ? `${progress.completed} completed`
      : undefined;
  const operation = progress.operation
    ? `${progress.operation.kind} ${progress.operation.relativePath}`
    : undefined;

  return [count, progress.message, operation].filter(Boolean).join(": ");
}
