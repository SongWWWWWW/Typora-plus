import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  configureInstalledSmokeUserData,
  createInstalledSmokeFileUri,
  createInstalledSmokeRendererOptions,
  findFailedInstalledSmokeChecks,
  installedSmokeCliArgs,
  installedSmokeHarnessError,
  installedSmokeResultKind,
  installedSmokeRequiredChecks,
  readInstalledSmokeOptions,
  runInstalledSmoke
} from "./installedSmoke";

describe("installed smoke harness", () => {
  it("parses installed smoke CLI options into absolute paths", () => {
    const resultPath = path.resolve("tmp", "result.json");
    const userDataDir = path.resolve("tmp", "user-data");
    const workspaceDir = path.resolve("tmp", "workspace");

    expect(readInstalledSmokeOptions([
      "electron",
      "main.js",
      installedSmokeCliArgs.enabled,
      `${installedSmokeCliArgs.resultPath}${resultPath}`,
      `${installedSmokeCliArgs.userDataDir}${userDataDir}`,
      `${installedSmokeCliArgs.workspaceDir}${workspaceDir}`
    ])).toEqual({
      enabled: true,
      resultPath,
      userDataDir,
      workspaceDir
    });
  });

  it("does not include optional fields when installed smoke args are missing", () => {
    expect(readInstalledSmokeOptions(["electron", "main.js"])).toEqual({
      enabled: false
    });
  });

  it("sets app userData only for installed smoke runs with an explicit user data directory", () => {
    const calls: unknown[] = [];
    const app = {
      setPath: (name: string, value: string) => calls.push([name, value])
    };
    const userDataDir = path.resolve("tmp", "user-data");

    configureInstalledSmokeUserData(app, { enabled: false, userDataDir });
    configureInstalledSmokeUserData(app, { enabled: true });
    configureInstalledSmokeUserData(app, { enabled: true, userDataDir });

    expect(calls).toEqual([
      ["userData", userDataDir]
    ]);
  });

  it("uses the desktop native file URI shape for workspace reopening", () => {
    const workspaceDir = path.resolve("tmp", "workspace");
    const expectedUri = `file://${encodeExpectedFileUriPath(workspaceDir.replaceAll("\\", "/"))}`;
    const localizedWorkspaceDir = "C:\\Users\\wcc\\文档\\Typora Plus #1";
    const expectedLocalizedUri = "file://C:/Users/wcc/%E6%96%87%E6%A1%A3/Typora%20Plus%20%231";

    expect(createInstalledSmokeFileUri(workspaceDir)).toBe(expectedUri);
    expect(createInstalledSmokeFileUri(localizedWorkspaceDir)).toBe(expectedLocalizedUri);
    expect(createInstalledSmokeRendererOptions({ enabled: true, workspaceDir })).toEqual({
      workspaceUri: expectedUri
    });
    expect(createInstalledSmokeRendererOptions({ enabled: true })).toEqual({});
  });

  it("passes only when every required installed smoke check is true", () => {
    expect(findFailedInstalledSmokeChecks(createCompleteInstalledSmokeChecks())).toEqual([]);
  });

  it("treats missing, false, and malformed required checks as failed in required-check order", () => {
    const checks = createCompleteInstalledSmokeChecks({
      rendererMounted: false,
      workspaceReadWriteFile: "true",
      workspaceImageResource: false
    });
    delete checks.preloadBridge;

    expect(findFailedInstalledSmokeChecks(checks)).toEqual([
      "rendererMounted",
      "preloadBridge",
      "workspaceReadWriteFile",
      "workspaceImageResource"
    ]);
  });

  it("writes sanitized harness errors without leaking raw exception messages", async () => {
    const tempRoot = await mkdtemp(path.join(tmpdir(), "typora-plus-installed-smoke-test-"));
    const resultPath = path.join(tempRoot, "result.json");
    const rawPath = path.join(tempRoot, "secret-local-path");
    const exits: number[] = [];

    try {
      await runInstalledSmoke({
        app: {
          exit: (code?: number) => exits.push(code ?? 0),
          getPath: () => path.join(tempRoot, "user-data"),
          isPackaged: false
        },
        createWindow: async () => {
          throw new Error(`Unable to load ${rawPath}`);
        },
        options: {
          enabled: true,
          resultPath,
          userDataDir: path.join(tempRoot, "user-data"),
          workspaceDir: path.join(tempRoot, "workspace")
        },
        trustedWorkspacesStorageFile: "trusted-workspaces.json"
      });

      const rawResult = await readFile(resultPath, "utf8");
      const result = JSON.parse(rawResult) as {
        readonly errors: readonly string[];
        readonly kind: string;
        readonly passed: boolean;
      };

      expect(exits).toEqual([1]);
      expect(result).toMatchObject({
        errors: [installedSmokeHarnessError],
        kind: installedSmokeResultKind,
        passed: false
      });
      expect(rawResult).not.toContain(rawPath);
      expect(rawResult).not.toContain("Unable to load");
    } finally {
      await rm(tempRoot, { force: true, recursive: true });
    }
  });
});

function encodeExpectedFileUriPath(value: string): string {
  return value
    .split("/")
    .map((segment, index) => index === 0 && /^[A-Za-z]:$/.test(segment)
      ? segment
      : encodeURIComponent(segment))
    .join("/");
}

function createCompleteInstalledSmokeChecks(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    ...Object.fromEntries(installedSmokeRequiredChecks.map((check) => [check, true])),
    ...overrides
  };
}
