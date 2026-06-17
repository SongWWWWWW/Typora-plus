import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  defaultElectronSmokeDevServerUrl,
  electronSmokeEnvironmentNames,
  findInvalidElectronSmokeEnvironment,
  isElectronSmokeDevServerAvailable,
  readDefaultElectronExecutablePath,
  runElectronSmokeCli
} from "./run-electron-smoke.mjs";
import {
  installedSmokeCliArgs,
  installedSmokeRequiredChecks,
  installedSmokeResultKind
} from "./run-installed-smoke.mjs";

describe("source-built Electron smoke runner", () => {
  it("rejects invalid environment values before spawning without exposing raw paths", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const rawPath = "relative/path/to/user-data\nwith-extra";
    const exitCode = await runElectronSmokeCli({
      devServerAvailable: async () => true,
      electronExecutablePath: resolve("node_modules", "electron", "dist", "electron.exe"),
      environment: {
        [electronSmokeEnvironmentNames.userDataDir]: rawPath,
        [electronSmokeEnvironmentNames.timeoutMs]: "12"
      },
      mainPath: resolve("apps", "desktop", "dist-electron", "main.js"),
      pathExists: async () => true,
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(output).toEqual([]);
    expect(errors).toEqual([
      "Source-built Electron smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- user data directory must be an absolute path at most 4096 characters and must not contain line breaks",
      "- timeout must be an integer from 1000 to 120000 milliseconds"
    ]);
    expect(errors.join("\n")).not.toContain(rawPath);
  });

  it("rejects missing Electron executable before spawning", async () => {
    const errors = [];
    const spawnCalls = [];
    const electronExecutablePath = resolve("node_modules", "electron", "dist", "electron.exe");
    const exitCode = await runElectronSmokeCli({
      devServerAvailable: async () => true,
      electronExecutablePath,
      environment: {},
      mainPath: resolve("apps", "desktop", "dist-electron", "main.js"),
      pathExists: async (path) => path !== electronExecutablePath,
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(errors).toEqual([
      "Source-built Electron smoke test could not find the Electron executable.",
      "Run `npm install` before `npm run test:electron:smoke`."
    ]);
  });

  it("rejects missing Electron main build output before spawning", async () => {
    const errors = [];
    const spawnCalls = [];
    const mainPath = resolve("apps", "desktop", "dist-electron", "main.js");
    const exitCode = await runElectronSmokeCli({
      devServerAvailable: async () => true,
      electronExecutablePath: resolve("node_modules", "electron", "dist", "electron.exe"),
      environment: {},
      mainPath,
      pathExists: async (path) => path !== mainPath,
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(errors).toEqual([
      "Source-built Electron smoke test could not find the desktop Electron build output.",
      "Run `npm run build -w @typora-plus/desktop` before `npm run test:electron:smoke`."
    ]);
  });

  it("rejects an unavailable renderer dev server before spawning", async () => {
    const errors = [];
    const spawnCalls = [];
    const devServerChecks = [];
    const exitCode = await runElectronSmokeCli({
      devServerAvailable: async (url) => {
        devServerChecks.push(url);
        return false;
      },
      electronExecutablePath: resolve("node_modules", "electron", "dist", "electron.exe"),
      environment: {},
      mainPath: resolve("apps", "desktop", "dist-electron", "main.js"),
      pathExists: async () => true,
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(devServerChecks).toEqual([defaultElectronSmokeDevServerUrl]);
    expect(errors).toEqual([
      "Source-built Electron smoke test could not reach the renderer dev server.",
      "Run `npm run dev` in another terminal before `npm run test:electron:smoke`."
    ]);
  });

  it("launches Electron main smoke mode with isolated user data and workspace paths", async () => {
    const output = [];
    const errors = [];
    const cleaned = [];
    const createdWorkspaces = [];
    const spawnCalls = [];
    const electronExecutablePath = resolve("node_modules", "electron", "dist", "electron.exe");
    const mainPath = resolve("apps", "desktop", "dist-electron", "main.js");
    const tempRoot = resolve("tmp", "typora-plus-electron-smoke-123");
    const result = JSON.stringify({
      checks: createCompleteInstalledSmokeChecks(),
      errors: [],
      kind: installedSmokeResultKind,
      packaged: false,
      passed: true
    });
    const exitCode = await runElectronSmokeCli({
      cleanupDirectory: async (path, options) => {
        cleaned.push([path, options]);
      },
      createSmokeWorkspace: async (path) => {
        createdWorkspaces.push(path);
      },
      createTemporaryDirectory: async () => tempRoot,
      devServerAvailable: async () => true,
      electronExecutablePath,
      environment: {},
      mainPath,
      pathExists: async () => true,
      readResultFile: async (path) => {
        expect(path).toBe(resolve("tmp", "typora-plus-electron-smoke-123", "result.json"));
        return result;
      },
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual(["Source-built Electron smoke test passed."]);
    expect(errors).toEqual([]);
    expect(spawnCalls).toEqual([
      [
        electronExecutablePath,
        [
          mainPath,
          installedSmokeCliArgs.enabled,
          `${installedSmokeCliArgs.userDataDir}${resolve("tmp", "typora-plus-electron-smoke-123", "user-data")}`,
          `${installedSmokeCliArgs.workspaceDir}${resolve("tmp", "typora-plus-electron-smoke-123", "workspace")}`,
          `${installedSmokeCliArgs.resultPath}${resolve("tmp", "typora-plus-electron-smoke-123", "result.json")}`
        ],
        {
          env: {
            [electronSmokeEnvironmentNames.userDataDir]: resolve("tmp", "typora-plus-electron-smoke-123", "user-data"),
            [electronSmokeEnvironmentNames.workspaceDir]: resolve("tmp", "typora-plus-electron-smoke-123", "workspace")
          },
          stdio: ["ignore", "ignore", "pipe"]
        }
      ]
    ]);
    expect(createdWorkspaces).toEqual([
      resolve("tmp", "typora-plus-electron-smoke-123", "workspace")
    ]);
    expect(cleaned).toEqual([
      [tempRoot, { force: true, recursive: true }]
    ]);
  });

  it("uses configured user data and workspace directories without deleting them", async () => {
    const cleaned = [];
    const createdWorkspaces = [];
    const spawnCalls = [];
    const userDataDir = resolve("electron-smoke-user-data");
    const workspaceDir = resolve("electron-smoke-workspace");
    const tempRoot = resolve("tmp", "typora-plus-electron-smoke-result-123");
    const exitCode = await runElectronSmokeCli({
      cleanupDirectory: async (path, options) => {
        cleaned.push([path, options]);
      },
      createSmokeWorkspace: async (path) => {
        createdWorkspaces.push(path);
      },
      createTemporaryDirectory: async () => tempRoot,
      devServerAvailable: async () => true,
      directoryExists: async (path) => path === workspaceDir,
      electronExecutablePath: resolve("node_modules", "electron", "dist", "electron.exe"),
      environment: {
        [electronSmokeEnvironmentNames.userDataDir]: userDataDir,
        [electronSmokeEnvironmentNames.workspaceDir]: workspaceDir
      },
      mainPath: resolve("apps", "desktop", "dist-electron", "main.js"),
      pathExists: async () => true,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks(),
        kind: installedSmokeResultKind,
        packaged: false,
        passed: true
      }),
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: () => undefined,
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(0);
    expect(spawnCalls[0]?.[1]).toEqual([
      resolve("apps", "desktop", "dist-electron", "main.js"),
      installedSmokeCliArgs.enabled,
      `${installedSmokeCliArgs.userDataDir}${userDataDir}`,
      `${installedSmokeCliArgs.workspaceDir}${workspaceDir}`,
      `${installedSmokeCliArgs.resultPath}${resolve("tmp", "typora-plus-electron-smoke-result-123", "result.json")}`
    ]);
    expect(createdWorkspaces).toEqual([]);
    expect(cleaned).toEqual([
      [tempRoot, { force: true, recursive: true }]
    ]);
  });

  it("rejects missing configured workspace directories before spawning", async () => {
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runElectronSmokeCli({
      devServerAvailable: async () => true,
      directoryExists: async () => false,
      electronExecutablePath: resolve("node_modules", "electron", "dist", "electron.exe"),
      environment: {
        [electronSmokeEnvironmentNames.workspaceDir]: resolve("missing-workspace")
      },
      mainPath: resolve("apps", "desktop", "dist-electron", "main.js"),
      pathExists: async () => true,
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(errors).toEqual([
      "Source-built Electron smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- workspace directory must point to an existing directory"
    ]);
  });

  it("keeps source Electron smoke preflight issue ordering deterministic", () => {
    expect(findInvalidElectronSmokeEnvironment({
      environment: {
        [electronSmokeEnvironmentNames.userDataDir]: "relative-user-data",
        [electronSmokeEnvironmentNames.workspaceDir]: "relative-workspace",
        [electronSmokeEnvironmentNames.timeoutMs]: "0"
      }
    })).toEqual([
      "user data directory must be an absolute path at most 4096 characters and must not contain line breaks",
      "workspace directory must be an absolute path at most 4096 characters and must not contain line breaks",
      "timeout must be an integer from 1000 to 120000 milliseconds"
    ]);
  });

  it("checks renderer dev server reachability through fetch", async () => {
    await expect(isElectronSmokeDevServerAvailable(defaultElectronSmokeDevServerUrl, {
      fetchUrl: async () => ({ ok: true })
    })).resolves.toBe(true);
    await expect(isElectronSmokeDevServerAvailable(defaultElectronSmokeDevServerUrl, {
      fetchUrl: async () => ({ ok: false })
    })).resolves.toBe(false);
    await expect(isElectronSmokeDevServerAvailable(defaultElectronSmokeDevServerUrl, {
      fetchUrl: async () => {
        throw new Error("connection refused");
      }
    })).resolves.toBe(false);
  });

  it("resolves the default Electron executable from the Electron package", () => {
    expect(readDefaultElectronExecutablePath(() => resolve("node_modules", "electron", "dist", "electron.exe")))
      .toBe(resolve("node_modules", "electron", "dist", "electron.exe"));
    expect(() => readDefaultElectronExecutablePath(() => undefined)).toThrow("Electron executable path is unavailable");
  });

  it("keeps the source smoke dev server URL aligned with the Electron shell config", () => {
    const shellConfigSource = readFileSync(
      new URL("../apps/desktop/electron/shellConfig.ts", import.meta.url),
      "utf8"
    );

    expect(extractDesktopDevServerUrl(shellConfigSource)).toBe(defaultElectronSmokeDevServerUrl);
  });

  it("keeps packaged renderer asset paths relative for Electron loadFile", () => {
    const viteConfigSource = readFileSync(
      new URL("../apps/desktop/vite.config.ts", import.meta.url),
      "utf8"
    );

    expect(extractDesktopViteBase(viteConfigSource)).toBe("./");
  });
});

function createCompleteInstalledSmokeChecks(overrides = {}) {
  return {
    ...Object.fromEntries(installedSmokeRequiredChecks.map((check) => [check, true])),
    ...overrides
  };
}

function extractDesktopDevServerUrl(source) {
  const match = /devServerUrl:\s*"([^"]+)"/.exec(source);

  if (!match) {
    throw new Error("Unable to find desktop dev server URL");
  }

  return match[1];
}

function extractDesktopViteBase(source) {
  const match = /base:\s*"([^"]+)"/.exec(source);

  if (!match) {
    throw new Error("Unable to find desktop Vite base");
  }

  return match[1];
}

function createClosingChildProcess(exitCode) {
  const child = new EventEmitter();

  queueMicrotask(() => child.emit("close", exitCode));

  return child;
}
