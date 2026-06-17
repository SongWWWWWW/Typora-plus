import { EventEmitter } from "node:events";
import type { spawn } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ensureNativeLarkGatewayForRequestUrl,
  isNativeLarkGatewayRequestUrl,
  resolveNativeLarkGatewayScriptPath,
  stopNativeLarkGatewayProcess
} from "./nativeLarkGatewayProcess";

describe("native Lark gateway process", () => {
  afterEach(() => {
    stopNativeLarkGatewayProcess();
  });

  it("recognizes only the local Lark gateway URL", () => {
    expect(isNativeLarkGatewayRequestUrl("http://127.0.0.1:41573/auth/status")).toBe(true);
    expect(isNativeLarkGatewayRequestUrl("http://localhost:41573/mirror/list")).toBe(true);
    expect(isNativeLarkGatewayRequestUrl("https://127.0.0.1:41573/auth/status")).toBe(false);
    expect(isNativeLarkGatewayRequestUrl("http://127.0.0.1:41574/auth/status")).toBe(false);
    expect(isNativeLarkGatewayRequestUrl("https://sync.example.test/auth/status")).toBe(false);
  });

  it("uses an explicit gateway script path before probing default locations", () => {
    expect(resolveNativeLarkGatewayScriptPath({
      pathExists: () => false,
      scriptPath: "C:/TyporaPlus/lark-cli-raw-mirror-gateway.mjs"
    })).toBe("C:/TyporaPlus/lark-cli-raw-mirror-gateway.mjs");
  });

  it("does not start a gateway for unrelated remote sync requests", async () => {
    const spawnProcess = vi.fn();
    const fetchUrl = vi.fn();

    await ensureNativeLarkGatewayForRequestUrl("https://sync.example.test/mirror/list", {
      fetchUrl: fetchUrl as unknown as typeof fetch,
      spawnProcess: spawnProcess as unknown as typeof spawn
    });

    expect(fetchUrl).not.toHaveBeenCalled();
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("reuses an already healthy local gateway", async () => {
    const spawnProcess = vi.fn();
    const fetchUrl = vi.fn(async () => new Response("ok", { status: 200 }));

    await ensureNativeLarkGatewayForRequestUrl("http://127.0.0.1:41573/auth/status", {
      fetchUrl: fetchUrl as unknown as typeof fetch,
      spawnProcess: spawnProcess as unknown as typeof spawn
    });

    expect(fetchUrl).toHaveBeenCalledOnce();
    expect(spawnProcess).not.toHaveBeenCalled();
  });

  it("starts the packaged gateway when the local gateway is unavailable", async () => {
    const child = createChildProcessStub();
    const spawnProcess = vi.fn(() => child);
    const fetchUrl = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection refused"))
      .mockResolvedValue(new Response("ok", { status: 200 }));

    await ensureNativeLarkGatewayForRequestUrl("http://127.0.0.1:41573/auth/status", {
      environment: { TYPORA_PLUS_LARK_GATEWAY_PORT: "41573" },
      executablePath: "C:/TyporaPlus/TyporaPlus.exe",
      fetchUrl: fetchUrl as unknown as typeof fetch,
      scriptPath: "C:/TyporaPlus/resources/app/dist-electron/scripts/lark-cli-raw-mirror-gateway.mjs",
      spawnProcess: spawnProcess as unknown as typeof spawn
    });

    expect(spawnProcess).toHaveBeenCalledWith(
      "C:/TyporaPlus/TyporaPlus.exe",
      ["C:/TyporaPlus/resources/app/dist-electron/scripts/lark-cli-raw-mirror-gateway.mjs", "serve"],
      expect.objectContaining({
        env: expect.objectContaining({
          ELECTRON_RUN_AS_NODE: "1",
          TYPORA_PLUS_LARK_GATEWAY_PORT: "41573"
        }),
        stdio: "ignore",
        windowsHide: true
      })
    );
    expect(fetchUrl).toHaveBeenCalledTimes(2);
  });
});

function createChildProcessStub() {
  const child = new EventEmitter() as EventEmitter & {
    killed: boolean;
    kill: ReturnType<typeof vi.fn>;
  };
  child.killed = false;
  child.kill = vi.fn(() => {
    child.killed = true;
    return true;
  });
  return child as unknown as ReturnType<typeof spawn>;
}
