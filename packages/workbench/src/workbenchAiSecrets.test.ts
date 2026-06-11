import { describe, expect, it, vi } from "vitest";
import {
  createNativeWorkbenchAiSecretBridge,
  createWorkbenchAiSecretActions,
  deleteWorkbenchAiProviderSecret,
  setWorkbenchAiProviderSecret,
  type WorkbenchAiSecretBridge
} from "./workbenchAiSecrets";

describe("workbench AI secrets", () => {
  it("sets and deletes secrets through the native bridge", async () => {
    const bridge = createBridge();

    await setWorkbenchAiProviderSecret(bridge, " typora-plus.ai.notes ", " sk-test ");
    await deleteWorkbenchAiProviderSecret(bridge, " typora-plus.ai.notes ");

    expect(bridge.setSecret).toHaveBeenCalledWith("typora-plus.ai.notes", "sk-test");
    expect(bridge.deleteSecret).toHaveBeenCalledWith("typora-plus.ai.notes");
  });

  it("rejects invalid secret operations before calling the bridge", async () => {
    const bridge = createBridge();

    await expect(setWorkbenchAiProviderSecret(bridge, "bad ref", "secret")).rejects.toThrow(
      "AI secret reference is invalid"
    );
    await expect(setWorkbenchAiProviderSecret(bridge, "typora-plus.ai.notes", "   ")).rejects.toThrow(
      "AI secret value must not be empty"
    );
    await expect(deleteWorkbenchAiProviderSecret(undefined, "typora-plus.ai.notes")).rejects.toThrow(
      "AI secret storage is unavailable"
    );
    expect(bridge.setSecret).not.toHaveBeenCalled();
    expect(bridge.deleteSecret).not.toHaveBeenCalled();
  });

  it("creates action handlers with shared operation-error mapping", async () => {
    const operationErrors: Array<string | undefined> = [];
    const bridge = createBridge({
      setSecret: () => {
        throw new Error("Native store failed");
      }
    });
    const actions = createWorkbenchAiSecretActions({
      setOperationError: (error) => operationErrors.push(error)
    }, bridge);

    await expect(actions.setSecret("typora-plus.ai.notes", "secret")).resolves.toBe(false);
    await expect(actions.deleteSecret("typora-plus.ai.notes")).resolves.toBe(true);

    expect(actions.isAvailable).toBe(true);
    expect(operationErrors).toEqual([undefined, "Native store failed", undefined]);
  });

  it("reads native bridge availability from the global Typora Plus bridge", () => {
    const previousTyporaPlus = (globalThis as { typoraPlus?: unknown }).typoraPlus;
    const bridge = createBridge();

    (globalThis as {
      typoraPlus?: {
        ai?: WorkbenchAiSecretBridge;
      };
    }).typoraPlus = {
      ai: bridge
    };

    try {
      expect(createNativeWorkbenchAiSecretBridge()?.isAvailable).toBe(true);
    } finally {
      (globalThis as { typoraPlus?: unknown }).typoraPlus = previousTyporaPlus;
    }
  });
});

function createBridge(overrides: {
  readonly setSecret?: WorkbenchAiSecretBridge["setSecret"];
  readonly deleteSecret?: WorkbenchAiSecretBridge["deleteSecret"];
} = {}): WorkbenchAiSecretBridge & {
  readonly setSecret: ReturnType<typeof vi.fn>;
  readonly deleteSecret: ReturnType<typeof vi.fn>;
} {
  return {
    isAvailable: true,
    setSecret: vi.fn(overrides.setSecret ?? (async () => true)),
    deleteSecret: vi.fn(overrides.deleteSecret ?? (async () => true))
  };
}
