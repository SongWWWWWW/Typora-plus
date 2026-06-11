import type { URI } from "@typora-plus/base";
import {
  openWorkbenchFile,
  type WorkbenchFileOpeningServices
} from "./workbenchFileOpening";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter,
  type WorkbenchSaveConflictSetter
} from "./workbenchActionRunner";

export interface WorkbenchLineTarget {
  readonly line: number;
}

export interface WorkbenchLineResourceTarget extends WorkbenchLineTarget {
  readonly uri: URI;
}

export type WorkbenchLineNavigationTarget = WorkbenchLineTarget | WorkbenchLineResourceTarget;

export interface WorkbenchLineNavigationCallbacks {
  readonly clearSaveConflict?: () => void;
  readonly defer: (callback: () => void) => void;
  readonly scrollToLine: (line: number) => void;
}

export interface WorkbenchLineNavigationActionCallbacks extends WorkbenchLineNavigationCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
  readonly setSaveConflict?: WorkbenchSaveConflictSetter;
}

export function scrollWorkbenchLine(
  callbacks: Pick<WorkbenchLineNavigationCallbacks, "scrollToLine">,
  target: WorkbenchLineTarget
): void {
  callbacks.scrollToLine(target.line);
}

export function isWorkbenchLineResourceTarget(
  target: WorkbenchLineNavigationTarget
): target is WorkbenchLineResourceTarget {
  return "uri" in target;
}

export async function openWorkbenchLineTarget(
  services: WorkbenchFileOpeningServices,
  target: WorkbenchLineNavigationTarget,
  callbacks: WorkbenchLineNavigationCallbacks
): Promise<void> {
  if (!isWorkbenchLineResourceTarget(target)) {
    scrollWorkbenchLine(callbacks, target);
    return;
  }

  await openWorkbenchLineResource(services, target, callbacks);
}

export function openWorkbenchLineTargetAction(
  services: WorkbenchFileOpeningServices,
  target: WorkbenchLineNavigationTarget,
  callbacks: WorkbenchLineNavigationActionCallbacks
): Promise<void | undefined> {
  if (!isWorkbenchLineResourceTarget(target)) {
    scrollWorkbenchLine(callbacks, target);
    return Promise.resolve(undefined);
  }

  return runWorkbenchAction(
    () => openWorkbenchLineResource(services, target, callbacks),
    callbacks.setOperationError,
    callbacks.setSaveConflict
  );
}

export async function openWorkbenchLineResource(
  services: WorkbenchFileOpeningServices,
  target: WorkbenchLineResourceTarget,
  callbacks: WorkbenchLineNavigationCallbacks
): Promise<void> {
  await openWorkbenchFile(services, target.uri, callbacks.clearSaveConflict
    ? { clearSaveConflict: callbacks.clearSaveConflict }
    : {});
  callbacks.defer(() => callbacks.scrollToLine(target.line));
}
