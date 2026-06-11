import { workbenchCommandIds } from "./workbenchCommandIds";

export const workbenchSidebarCommandIds = {
  openWorkspace: workbenchCommandIds.file.openWorkspace,
  refreshWorkspace: workbenchCommandIds.file.refreshWorkspace
} as const;

export interface WorkbenchSidebarCommandHandlers {
  readonly openWorkspace: () => void;
  readonly refreshWorkspace: () => void;
}

export function createWorkbenchSidebarCommandHandlers(
  executeCommand: (command: string) => void
): WorkbenchSidebarCommandHandlers {
  return {
    openWorkspace: () => executeCommand(workbenchSidebarCommandIds.openWorkspace),
    refreshWorkspace: () => executeCommand(workbenchSidebarCommandIds.refreshWorkspace)
  };
}
