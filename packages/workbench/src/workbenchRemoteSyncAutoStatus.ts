import type { WorkbenchMessages } from "./workbenchI18n";

export type WorkbenchRemoteSyncAutoState = "failed" | "idle" | "pending" | "synced" | "syncing";

export interface WorkbenchRemoteSyncAutoStatus {
  readonly state: WorkbenchRemoteSyncAutoState;
  readonly lastSyncedAt?: number;
  readonly message?: string;
}

export const defaultWorkbenchRemoteSyncAutoStatus: WorkbenchRemoteSyncAutoStatus = {
  state: "idle"
};

export function formatWorkbenchRemoteSyncAutoStatus(
  status: WorkbenchRemoteSyncAutoStatus,
  messages: WorkbenchMessages["status"]
): string {
  switch (status.state) {
    case "failed":
      return status.message || messages.syncFailed;
    case "pending":
      return messages.syncPending;
    case "synced":
      return status.lastSyncedAt !== undefined
        ? messages.syncSyncedAt(status.lastSyncedAt)
        : messages.syncSynced;
    case "syncing":
      return messages.syncing;
    case "idle":
      return messages.syncIdle;
  }
}

export function shouldShowWorkbenchRemoteSyncAutoStatus(
  status: WorkbenchRemoteSyncAutoStatus,
  options: {
    readonly providerAvailable: boolean;
    readonly workspaceOpen: boolean;
  }
): boolean {
  return status.state !== "idle" || (options.providerAvailable && options.workspaceOpen);
}
