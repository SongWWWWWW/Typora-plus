import type {
  RemoteSyncDirection,
  RemoteSyncOperation,
  RemoteSyncOperationKind,
  RemoteSyncOperationTarget,
  RemoteSyncPlan,
  RemoteSyncProgress,
  RemoteSyncSummary
} from "@typora-plus/platform";
import type { WorkbenchRemoteSyncExecutionResult } from "./workbenchRemoteSyncActions";
import {
  getWorkbenchRemoteSyncPlanExecutionBlockReasonCode,
  isWorkbenchRemoteSyncBaselineRefreshPlan
} from "./workbenchRemoteSyncActions";
import type { WorkbenchRemoteSyncPlanExecutionBlockReason } from "./workbenchRemoteSyncActions";

export interface WorkbenchRemoteSyncDialogOperationPreview {
  readonly emptyMessage: string;
  readonly hiddenOperationCount: number;
  readonly operations: readonly RemoteSyncOperation[];
}

export interface WorkbenchRemoteSyncDialogProgressPreview {
  readonly emptyMessage: string;
  readonly hiddenProgressCount: number;
  readonly progressEvents: readonly RemoteSyncProgress[];
}

export interface WorkbenchRemoteSyncDialogExecutionState {
  readonly canCancel: boolean;
  readonly canExecute: boolean;
  readonly executeLabel: string;
  readonly statusMessage?: string;
}

export interface WorkbenchRemoteSyncDialogConflictResolutionState {
  readonly canResolve: boolean;
  readonly useLocalLabel: string;
  readonly useRemoteLabel: string;
}

export interface WorkbenchRemoteSyncDialogMessages {
  readonly directions: Readonly<Record<RemoteSyncDirection, string>>;
  readonly executed: string;
  readonly executedStatus: (summary: string) => string;
  readonly execute: string;
  readonly executing: string;
  readonly executionInProgress: string;
  readonly executionInProgressWithProgress: (progress: string) => string;
  readonly operationDetail: (target: string, message?: string) => string;
  readonly operationKinds: Readonly<Record<RemoteSyncOperationKind, string>>;
  readonly operationTargets: Readonly<Record<RemoteSyncOperationTarget, string>>;
  readonly progressCompleted: (count: number) => string;
  readonly progressOperation: (operation: string, relativePath: string) => string;
  readonly progressParts: (parts: readonly string[]) => string;
  readonly refreshBaseline: string;
  readonly summary: (summary: RemoteSyncSummary) => string;
  readonly executionBlockReasons: Readonly<Record<WorkbenchRemoteSyncPlanExecutionBlockReason, string>>;
  readonly useLocal: string;
  readonly useRemote: string;
}

export function createWorkbenchRemoteSyncDialogConflictResolutionState(
  plan: RemoteSyncPlan,
  options: {
    readonly executing: boolean;
    readonly execution: WorkbenchRemoteSyncExecutionResult | undefined;
    readonly messages: WorkbenchRemoteSyncDialogMessages;
  }
): WorkbenchRemoteSyncDialogConflictResolutionState {
  return {
    canResolve: plan.summary.conflicts > 0 && !options.executing && !options.execution,
    useLocalLabel: options.messages.useLocal,
    useRemoteLabel: options.messages.useRemote
  };
}

export function createWorkbenchRemoteSyncDialogExecutionState(
  plan: RemoteSyncPlan,
  options: {
    readonly executing: boolean;
    readonly execution: WorkbenchRemoteSyncExecutionResult | undefined;
    readonly messages: WorkbenchRemoteSyncDialogMessages;
    readonly progress?: RemoteSyncProgress | undefined;
  }
): WorkbenchRemoteSyncDialogExecutionState {
  if (options.execution) {
    return {
      canCancel: false,
      canExecute: false,
      executeLabel: options.messages.executed,
      statusMessage: options.messages.executedStatus(
        formatWorkbenchRemoteSyncSummary(options.execution.result.summary, options.messages)
      )
    };
  }

  if (options.executing) {
    return {
      canCancel: true,
      canExecute: false,
      executeLabel: options.messages.executing,
      statusMessage: options.progress
        ? options.messages.executionInProgressWithProgress(
          formatWorkbenchRemoteSyncProgress(options.progress, options.messages)
        )
        : options.messages.executionInProgress
    };
  }

  const blockReason = getWorkbenchRemoteSyncPlanExecutionBlockReasonCode(plan);

  if (blockReason) {
    return {
      canCancel: false,
      canExecute: false,
      executeLabel: options.messages.execute,
      statusMessage: options.messages.executionBlockReasons[blockReason]
    };
  }

  return {
    canCancel: false,
    canExecute: true,
    executeLabel: isWorkbenchRemoteSyncBaselineRefreshPlan(plan)
      ? options.messages.refreshBaseline
      : options.messages.execute
  };
}

export function formatWorkbenchRemoteSyncDirection(
  direction: RemoteSyncDirection,
  messages: WorkbenchRemoteSyncDialogMessages
): string {
  return messages.directions[direction];
}

export function formatWorkbenchRemoteSyncOperationKind(
  kind: RemoteSyncOperationKind,
  messages: WorkbenchRemoteSyncDialogMessages
): string {
  return messages.operationKinds[kind];
}

export function formatWorkbenchRemoteSyncSummary(
  summary: RemoteSyncPlan["summary"],
  messages: WorkbenchRemoteSyncDialogMessages
): string {
  return messages.summary(summary);
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

export function createWorkbenchRemoteSyncDialogConflictPreview(
  operations: readonly RemoteSyncOperation[],
  options: {
    readonly emptyMessage: string;
    readonly maxOperations: number;
  }
): WorkbenchRemoteSyncDialogOperationPreview {
  return createWorkbenchRemoteSyncDialogOperationPreview(
    operations.filter((operation) => operation.kind === "conflict"),
    options
  );
}

export function appendWorkbenchRemoteSyncProgressHistory(
  progressEvents: readonly RemoteSyncProgress[],
  progress: RemoteSyncProgress,
  options: {
    readonly maxEvents: number;
  }
): readonly RemoteSyncProgress[] {
  const maxEvents = Math.max(0, Math.floor(options.maxEvents));
  const nextProgressEvents = [...progressEvents, progress];

  return nextProgressEvents.slice(Math.max(nextProgressEvents.length - maxEvents, 0));
}

export function getWorkbenchRemoteSyncLatestProgress(
  progressEvents: readonly RemoteSyncProgress[]
): RemoteSyncProgress | undefined {
  return progressEvents[progressEvents.length - 1];
}

export function createWorkbenchRemoteSyncDialogProgressPreview(
  progressEvents: readonly RemoteSyncProgress[],
  options: {
    readonly emptyMessage: string;
    readonly maxEvents: number;
  }
): WorkbenchRemoteSyncDialogProgressPreview {
  const maxEvents = Math.max(0, Math.floor(options.maxEvents));
  const visibleProgressEvents = progressEvents.slice(Math.max(progressEvents.length - maxEvents, 0));

  return {
    emptyMessage: options.emptyMessage,
    hiddenProgressCount: Math.max(progressEvents.length - visibleProgressEvents.length, 0),
    progressEvents: visibleProgressEvents
  };
}

export function formatWorkbenchRemoteSyncOperationDetail(
  operation: RemoteSyncOperation,
  messages: WorkbenchRemoteSyncDialogMessages
): string {
  return messages.operationDetail(messages.operationTargets[operation.target], operation.message);
}

export function formatWorkbenchRemoteSyncProgress(
  progress: RemoteSyncProgress,
  messages: WorkbenchRemoteSyncDialogMessages
): string {
  const count = progress.total !== undefined
    ? `${progress.completed ?? 0}/${progress.total}`
    : progress.completed !== undefined
      ? messages.progressCompleted(progress.completed)
      : undefined;
  const operation = progress.operation
    ? messages.progressOperation(
      messages.operationKinds[progress.operation.kind],
      progress.operation.relativePath
    )
    : undefined;

  return messages.progressParts([count, progress.message, operation].filter((part): part is string => !!part));
}
