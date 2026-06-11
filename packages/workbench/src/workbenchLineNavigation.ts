import type { URI } from "@typora-plus/base";
import {
  openWorkbenchFile,
  type WorkbenchFileOpeningServices
} from "./workbenchFileOpening";

export interface WorkbenchLineTarget {
  readonly line: number;
}

export interface WorkbenchLineResourceTarget extends WorkbenchLineTarget {
  readonly uri: URI;
}

export interface WorkbenchLineNavigationCallbacks {
  readonly clearSaveConflict?: () => void;
  readonly defer: (callback: () => void) => void;
  readonly scrollToLine: (line: number) => void;
}

export function scrollWorkbenchLine(
  callbacks: Pick<WorkbenchLineNavigationCallbacks, "scrollToLine">,
  target: WorkbenchLineTarget
): void {
  callbacks.scrollToLine(target.line);
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
