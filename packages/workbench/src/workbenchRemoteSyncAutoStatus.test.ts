import { describe, expect, it } from "vitest";
import {
  formatWorkbenchRemoteSyncAutoStatus,
  shouldShowWorkbenchRemoteSyncAutoStatus,
  type WorkbenchRemoteSyncAutoStatus
} from "./workbenchRemoteSyncAutoStatus";
import { createWorkbenchMessages } from "./workbenchI18n";

describe("workbench remote sync auto status", () => {
  it("formats idle, pending, syncing, synced, and failed states", () => {
    const messages = createWorkbenchMessages("en").status;

    expect(formatWorkbenchRemoteSyncAutoStatus({ state: "idle" }, messages)).toBe("Not synced");
    expect(formatWorkbenchRemoteSyncAutoStatus({ state: "pending" }, messages)).toBe("Sync pending");
    expect(formatWorkbenchRemoteSyncAutoStatus({ state: "syncing" }, messages)).toBe("Syncing");
    expect(formatWorkbenchRemoteSyncAutoStatus({ state: "synced" }, messages)).toBe("Synced");
    expect(formatWorkbenchRemoteSyncAutoStatus({
      state: "failed",
      message: "Gateway failed"
    }, messages)).toBe("Gateway failed");
  });

  it("shows when a provider can sync an open workspace or when a state needs attention", () => {
    const idle: WorkbenchRemoteSyncAutoStatus = { state: "idle" };
    const failed: WorkbenchRemoteSyncAutoStatus = { state: "failed", message: "Failed" };

    expect(shouldShowWorkbenchRemoteSyncAutoStatus(idle, {
      providerAvailable: false,
      workspaceOpen: true
    })).toBe(false);
    expect(shouldShowWorkbenchRemoteSyncAutoStatus(idle, {
      providerAvailable: true,
      workspaceOpen: true
    })).toBe(true);
    expect(shouldShowWorkbenchRemoteSyncAutoStatus(failed, {
      providerAvailable: false,
      workspaceOpen: false
    })).toBe(true);
  });
});
