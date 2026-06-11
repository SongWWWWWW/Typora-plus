import { describe, expect, it, vi } from "vitest";
import {
  createNativeWorkbenchRemoteSyncSecretBridge,
  createWorkbenchRemoteSyncSecretActions,
  deleteWorkbenchRemoteSyncSecret,
  setWorkbenchRemoteSyncSecret,
  type WorkbenchRemoteSyncSecretBridge
} from "./workbenchRemoteSyncSecrets";

describe("workbench remote sync secrets", () => {
  it("sets and deletes secrets through the native bridge", async () => {
    const bridge = createBridge();

    await setWorkbenchRemoteSyncSecret(bridge, " typora-plus.remote-sync.provider ", " token ");
    await deleteWorkbenchRemoteSyncSecret(bridge, " typora-plus.remote-sync.provider ");

    expect(bridge.setSecret).toHaveBeenCalledWith("typora-plus.remote-sync.provider", "token");
    expect(bridge.deleteSecret).toHaveBeenCalledWith("typora-plus.remote-sync.provider");
  });

  it("rejects invalid secret operations before calling the bridge", async () => {
    const bridge = createBridge();

    await expect(setWorkbenchRemoteSyncSecret(bridge, "bad ref", "secret")).rejects.toThrow(
      "Remote sync secret reference is invalid"
    );
    await expect(setWorkbenchRemoteSyncSecret(bridge, "typora-plus.remote-sync.provider", "   ")).rejects.toThrow(
      "Remote sync secret value must not be empty"
    );
    await expect(deleteWorkbenchRemoteSyncSecret(undefined, "typora-plus.remote-sync.provider")).rejects.toThrow(
      "Remote sync secret storage is unavailable"
    );
    expect(bridge.setSecret).not.toHaveBeenCalled();
    expect(bridge.deleteSecret).not.toHaveBeenCalled();
  });

  it("creates action handlers with shared operation-error mapping", async () => {
    const operationErrors: Array<string | undefined> = [];
    const bridge = createBridge({
      setSecret: () => {
        throw new Error("Native remote sync store failed");
      }
    });
    const actions = createWorkbenchRemoteSyncSecretActions({
      setOperationError: (error) => operationErrors.push(error)
    }, bridge);

    await expect(actions.setSecret("typora-plus.remote-sync.provider", "secret")).resolves.toBe(false);
    await expect(actions.deleteSecret("typora-plus.remote-sync.provider")).resolves.toBe(true);

    expect(actions.isAvailable).toBe(true);
    expect(operationErrors).toEqual([undefined, "Native remote sync store failed", undefined]);
  });

  it("reads native bridge availability from the global Typora Plus bridge", () => {
    const previousTyporaPlus = (globalThis as { typoraPlus?: unknown }).typoraPlus;
    const bridge = createBridge();

    (globalThis as {
      typoraPlus?: {
        remoteSyncSecrets?: WorkbenchRemoteSyncSecretBridge;
      };
    }).typoraPlus = {
      remoteSyncSecrets: bridge
    };

    try {
      expect(createNativeWorkbenchRemoteSyncSecretBridge()?.isAvailable).toBe(true);
    } finally {
      (globalThis as { typoraPlus?: unknown }).typoraPlus = previousTyporaPlus;
    }
  });
});

function createBridge(overrides: {
  readonly setSecret?: WorkbenchRemoteSyncSecretBridge["setSecret"];
  readonly deleteSecret?: WorkbenchRemoteSyncSecretBridge["deleteSecret"];
} = {}): WorkbenchRemoteSyncSecretBridge & {
  readonly setSecret: ReturnType<typeof vi.fn>;
  readonly deleteSecret: ReturnType<typeof vi.fn>;
} {
  return {
    isAvailable: true,
    setSecret: vi.fn(overrides.setSecret ?? (async () => true)),
    deleteSecret: vi.fn(overrides.deleteSecret ?? (async () => true))
  };
}
