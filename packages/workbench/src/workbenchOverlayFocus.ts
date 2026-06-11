export const workbenchOverlayFocusDelayMs = 0;

export interface WorkbenchOverlayFocusTimer<Handle = unknown> {
  setTimeout(callback: () => void, delayMs: number): Handle;
  clearTimeout(handle: Handle): void;
}

export interface WorkbenchOverlayFocusTarget {
  focus(): void;
}

export interface WorkbenchOverlayFocusTargetSource {
  getFocusTarget(): WorkbenchOverlayFocusTarget | null | undefined;
}

export function scheduleWorkbenchOverlayFocus<Handle>(
  timer: WorkbenchOverlayFocusTimer<Handle>,
  targetSource: WorkbenchOverlayFocusTargetSource
): () => void {
  const handle = timer.setTimeout(() => {
    targetSource.getFocusTarget()?.focus();
  }, workbenchOverlayFocusDelayMs);

  return () => timer.clearTimeout(handle);
}
