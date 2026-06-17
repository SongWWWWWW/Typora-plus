import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  findFailedInstalledSmokeRequiredChecks,
  findFailedInstalledSmokeMetadataChecks,
  findInvalidInstalledSmokeEnvironment,
  findMissingInstalledSmokeEnvironment,
  formatInstalledSmokeEnvironmentGroup,
  installedSmokeCliArgs,
  installedSmokeEnvironmentNames,
  installedSmokeHarnessError,
  installedSmokePackagedCheck,
  installedSmokeRequiredChecks,
  installedSmokeResultKind,
  parseInstalledSmokeResult,
  readInstalledSmokeResultExitCode,
  runInstalledSmokeCli
} from "./run-installed-smoke.mjs";

describe("installed app smoke runner", () => {
  it("reports missing installed app path without spawning", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async () => undefined,
      environment: {},
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
      "Installed app smoke test environment is incomplete.",
      "Set one variable from each required group before running the smoke test:",
      "- installed app path: TYPORA_PLUS_INSTALLED_SMOKE_APP_PATH"
    ]);
  });

  it("rejects invalid environment values before spawning without exposing raw paths", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const rawPath = "relative/path/to/app\nwith-extra";
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async () => undefined,
      environment: {
        [installedSmokeEnvironmentNames.appPath]: rawPath,
        [installedSmokeEnvironmentNames.timeoutMs]: "12"
      },
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
      "Installed app smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- installed app path must be an absolute path at most 4096 characters and must not contain line breaks",
      "- timeout must be an integer from 1000 to 120000 milliseconds"
    ]);
    expect(errors.join("\n")).not.toContain(rawPath);
  });

  it("rejects missing installed app paths before spawning", async () => {
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async () => undefined,
      environment: {
        [installedSmokeEnvironmentNames.appPath]: resolve("missing", "Typora Plus.exe")
      },
      pathExists: async () => false,
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
      "Installed app smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- installed app path must point to an existing file or app bundle"
    ]);
  });

  it("launches the installed app smoke mode with isolated user data and result paths", async () => {
    const output = [];
    const errors = [];
    const cleaned = [];
    const createdWorkspaces = [];
    const spawnCalls = [];
    const appPath = resolve("installed", "Typora Plus.exe");
    const tempRoot = resolve("tmp", "typora-plus-installed-smoke-123");
    const result = JSON.stringify({
      checks: createCompleteInstalledSmokeChecks(),
      kind: installedSmokeResultKind,
      packaged: true,
      passed: true
    });
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async (path, options) => {
        cleaned.push([path, options]);
      },
      createSmokeWorkspace: async (path) => {
        createdWorkspaces.push(path);
      },
      createTemporaryDirectory: async () => tempRoot,
      environment: {
        [installedSmokeEnvironmentNames.appPath]: appPath
      },
      pathExists: async () => true,
      readResultFile: async (path) => {
        expect(path).toBe(resolve("tmp", "typora-plus-installed-smoke-123", "result.json"));
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
    expect(output).toEqual(["Installed app smoke test passed."]);
    expect(errors).toEqual([]);
    expect(spawnCalls).toEqual([
      [
        appPath,
        [
          installedSmokeCliArgs.enabled,
          `${installedSmokeCliArgs.userDataDir}${resolve("tmp", "typora-plus-installed-smoke-123", "user-data")}`,
          `${installedSmokeCliArgs.workspaceDir}${resolve("tmp", "typora-plus-installed-smoke-123", "workspace")}`,
          `${installedSmokeCliArgs.resultPath}${resolve("tmp", "typora-plus-installed-smoke-123", "result.json")}`
        ],
        {
          env: {
            [installedSmokeEnvironmentNames.appPath]: appPath,
            [installedSmokeEnvironmentNames.userDataDir]: resolve("tmp", "typora-plus-installed-smoke-123", "user-data"),
            [installedSmokeEnvironmentNames.workspaceDir]: resolve("tmp", "typora-plus-installed-smoke-123", "workspace")
          },
          stdio: ["ignore", "ignore", "pipe"]
        }
      ]
    ]);
    expect(createdWorkspaces).toEqual([
      resolve("tmp", "typora-plus-installed-smoke-123", "workspace")
    ]);
    expect(cleaned).toEqual([
      [tempRoot, { force: true, recursive: true }]
    ]);
  });

  it("uses configured user data and workspace directories without deleting them", async () => {
    const cleaned = [];
    const createdWorkspaces = [];
    const spawnCalls = [];
    const appPath = resolve("installed", "Typora Plus.exe");
    const userDataDir = resolve("smoke-user-data");
    const workspaceDir = resolve("smoke-workspace");
    const tempRoot = resolve("tmp", "typora-plus-installed-smoke-result-123");
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async (path, options) => {
        cleaned.push([path, options]);
      },
      createSmokeWorkspace: async (path) => {
        createdWorkspaces.push(path);
      },
      createTemporaryDirectory: async () => tempRoot,
      directoryExists: async (path) => path === workspaceDir,
      environment: {
        [installedSmokeEnvironmentNames.appPath]: appPath,
        [installedSmokeEnvironmentNames.userDataDir]: userDataDir,
        [installedSmokeEnvironmentNames.workspaceDir]: workspaceDir
      },
      pathExists: async () => true,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks(),
        kind: installedSmokeResultKind,
        packaged: true,
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
      installedSmokeCliArgs.enabled,
      `${installedSmokeCliArgs.userDataDir}${userDataDir}`,
      `${installedSmokeCliArgs.workspaceDir}${workspaceDir}`,
      `${installedSmokeCliArgs.resultPath}${resolve("tmp", "typora-plus-installed-smoke-result-123", "result.json")}`
    ]);
    expect(createdWorkspaces).toEqual([]);
    expect(cleaned).toEqual([
      [tempRoot, { force: true, recursive: true }]
    ]);
  });

  it("rejects missing configured workspace directories before spawning", async () => {
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async () => undefined,
      directoryExists: async () => false,
      environment: {
        [installedSmokeEnvironmentNames.appPath]: resolve("installed", "Typora Plus.exe"),
        [installedSmokeEnvironmentNames.workspaceDir]: resolve("missing-workspace")
      },
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
      "Installed app smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- workspace directory must point to an existing directory"
    ]);
  });

  it("fails when the installed app exits without a passing smoke result", async () => {
    const errors = [];
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async () => undefined,
      createSmokeWorkspace: async () => undefined,
      createTemporaryDirectory: async () => resolve("tmp", "typora-plus-installed-smoke-123"),
      environment: {
        [installedSmokeEnvironmentNames.appPath]: resolve("installed", "Typora Plus.exe")
      },
      pathExists: async () => true,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks({ preloadBridge: false }),
        kind: installedSmokeResultKind,
        packaged: true,
        passed: false
      }),
      spawnProcess: () => createClosingChildProcess(0),
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Installed app smoke test failed.",
      "Failed checks: preloadBridge"
    ]);
  });

  it("fails when a required installed smoke check is missing even if the result passed", async () => {
    const errors = [];
    const checks = createCompleteInstalledSmokeChecks();
    delete checks.preloadBridge;
    const exitCode = await readInstalledSmokeResultExitCode({
      exitCode: 0,
      readResultFile: async () => JSON.stringify({
        checks,
        kind: installedSmokeResultKind,
        packaged: true,
        passed: true
      }),
      resultPath: resolve("tmp", "result.json"),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Installed app smoke test failed.",
      "Failed checks: preloadBridge"
    ]);
  });

  it("fails when a required installed smoke check is false", async () => {
    const errors = [];
    const exitCode = await readInstalledSmokeResultExitCode({
      exitCode: 0,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks({ workspaceOpenRecent: false }),
        kind: installedSmokeResultKind,
        packaged: true,
        passed: true
      }),
      resultPath: resolve("tmp", "result.json"),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Installed app smoke test failed.",
      "Failed checks: workspaceOpenRecent"
    ]);
  });

  it("treats malformed required installed smoke check values as failed", async () => {
    const errors = [];
    const exitCode = await readInstalledSmokeResultExitCode({
      exitCode: 0,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks({ remoteSyncSecretSetDelete: "true" }),
        kind: installedSmokeResultKind,
        packaged: true,
        passed: true
      }),
      resultPath: resolve("tmp", "result.json"),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Installed app smoke test failed.",
      "Failed checks: remoteSyncSecretSetDelete"
    ]);
  });

  it("fails when the installed smoke result contains fixed smoke errors despite passing checks", async () => {
    const errors = [];
    const exitCode = await readInstalledSmokeResultExitCode({
      exitCode: 0,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks(),
        errors: [installedSmokeHarnessError],
        kind: installedSmokeResultKind,
        packaged: true,
        passed: true
      }),
      resultPath: resolve("tmp", "result.json"),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Installed app smoke test failed.",
      `Smoke errors: ${installedSmokeHarnessError}`
    ]);
  });

  it("fails installed release smoke when the result did not come from a packaged app", async () => {
    const errors = [];
    const exitCode = await readInstalledSmokeResultExitCode({
      exitCode: 0,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks(),
        errors: [],
        kind: installedSmokeResultKind,
        packaged: false,
        passed: true
      }),
      resultPath: resolve("tmp", "result.json"),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Installed app smoke test failed.",
      `Failed checks: ${installedSmokePackagedCheck}`
    ]);
  });

  it("rejects unknown installed smoke result errors without exposing raw values", async () => {
    const errors = [];
    const rawError = "Unable to load C:\\Users\\wcc\\secret";
    const exitCode = await readInstalledSmokeResultExitCode({
      exitCode: 0,
      readResultFile: async () => JSON.stringify({
        checks: createCompleteInstalledSmokeChecks(),
        errors: [rawError],
        kind: installedSmokeResultKind,
        packaged: true,
        passed: true
      }),
      resultPath: resolve("tmp", "result.json"),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Installed app smoke output did not contain a valid smoke result."
    ]);
    expect(errors.join("\n")).not.toContain(rawError);
  });

  it("rejects malformed installed smoke result error values", () => {
    expect(() => parseInstalledSmokeResult(JSON.stringify({
      checks: {},
      errors: [true],
      kind: installedSmokeResultKind,
      packaged: true,
      passed: false
    }))).toThrow("Invalid installed smoke result errors");
  });

  it("reports failed and missing installed smoke checks in required-check order", () => {
    const checks = createCompleteInstalledSmokeChecks({
      rendererMounted: false,
      workspaceReadWriteFile: false
    });
    delete checks.preloadBridge;

    expect(findFailedInstalledSmokeRequiredChecks({
      checks,
      kind: installedSmokeResultKind,
      packaged: true,
      passed: true
    })).toEqual([
      "rendererMounted",
      "preloadBridge",
      "workspaceReadWriteFile"
    ]);
  });

  it("reports installed smoke metadata checks separately from renderer checks", () => {
    expect(findFailedInstalledSmokeMetadataChecks({
      checks: createCompleteInstalledSmokeChecks(),
      errors: [],
      kind: installedSmokeResultKind,
      packaged: false,
      passed: true
    })).toEqual([installedSmokePackagedCheck]);
    expect(findFailedInstalledSmokeMetadataChecks({
      checks: createCompleteInstalledSmokeChecks(),
      errors: [],
      kind: installedSmokeResultKind,
      packaged: false,
      passed: true
    }, { requirePackaged: false })).toEqual([]);
  });

  it("keeps required checks aligned with the Electron installed smoke harness", () => {
    const electronInstalledSmokeSource = readFileSync(
      new URL("../apps/desktop/electron/installedSmoke.ts", import.meta.url),
      "utf8"
    );

    expect(extractInstalledSmokeRequiredChecksFromElectronSource(electronInstalledSmokeSource))
      .toEqual(installedSmokeRequiredChecks);
    expect(extractInstalledSmokeHarnessErrorFromElectronSource(electronInstalledSmokeSource))
      .toBe(installedSmokeHarnessError);
    expect(extractInstalledSmokeChecksFromElectronSource(electronInstalledSmokeSource))
      .toEqual(installedSmokeRequiredChecks);
  });

  it("fails when the installed app process exits nonzero", async () => {
    const errors = [];
    const exitCode = await runInstalledSmokeCli({
      cleanupDirectory: async () => undefined,
      createSmokeWorkspace: async () => undefined,
      createTemporaryDirectory: async () => resolve("tmp", "typora-plus-installed-smoke-123"),
      environment: {
        [installedSmokeEnvironmentNames.appPath]: resolve("installed", "Typora Plus.exe")
      },
      pathExists: async () => true,
      spawnProcess: () => createClosingChildProcess(9),
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual(["Installed app smoke process exited with code 9."]);
  });

  it("keeps environment group formatting deterministic", () => {
    const missing = findMissingInstalledSmokeEnvironment({ environment: {} });

    expect(missing.map(formatInstalledSmokeEnvironmentGroup)).toEqual([
      "installed app path: TYPORA_PLUS_INSTALLED_SMOKE_APP_PATH"
    ]);
  });

  it("keeps installed smoke preflight issue ordering deterministic", () => {
    expect(findInvalidInstalledSmokeEnvironment({
      environment: {
        [installedSmokeEnvironmentNames.appPath]: "relative-app",
        [installedSmokeEnvironmentNames.userDataDir]: "relative-user-data",
        [installedSmokeEnvironmentNames.workspaceDir]: "relative-workspace",
        [installedSmokeEnvironmentNames.timeoutMs]: "0"
      }
    })).toEqual([
      "installed app path must be an absolute path at most 4096 characters and must not contain line breaks",
      "user data directory must be an absolute path at most 4096 characters and must not contain line breaks",
      "workspace directory must be an absolute path at most 4096 characters and must not contain line breaks",
      "timeout must be an integer from 1000 to 120000 milliseconds"
    ]);
  });

  it("parses only valid installed smoke result envelopes", () => {
    expect(parseInstalledSmokeResult(JSON.stringify({
      checks: { rendererMounted: true },
      kind: installedSmokeResultKind,
      packaged: true,
      passed: true
    }))).toEqual({
      checks: { rendererMounted: true },
      errors: [],
      kind: installedSmokeResultKind,
      packaged: true,
      passed: true
    });
    expect(parseInstalledSmokeResult(JSON.stringify({
      checks: { rendererMounted: true },
      errors: [installedSmokeHarnessError],
      kind: installedSmokeResultKind,
      packaged: false,
      passed: false
    }))).toEqual({
      checks: { rendererMounted: true },
      errors: [installedSmokeHarnessError],
      kind: installedSmokeResultKind,
      packaged: false,
      passed: false
    });
    expect(() => parseInstalledSmokeResult("{}")).toThrow("Invalid installed smoke result");
  });
});

function createCompleteInstalledSmokeChecks(overrides = {}) {
  return {
    ...Object.fromEntries(installedSmokeRequiredChecks.map((check) => [check, true])),
    ...overrides
  };
}

function extractInstalledSmokeChecksFromElectronSource(source) {
  return [
    ...extractInstalledSmokeBaseChecks(source),
    ...extractInstalledSmokeRendererChecks(source)
  ];
}

function extractInstalledSmokeRequiredChecksFromElectronSource(source) {
  const match = /export const installedSmokeRequiredChecks = \[([\s\S]*?)\] as const;/.exec(source);

  if (!match) {
    throw new Error("Unable to find Electron installed smoke required checks");
  }

  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]);
}

function extractInstalledSmokeHarnessErrorFromElectronSource(source) {
  const match = /export const installedSmokeHarnessError = "([^"]+)";/.exec(source);

  if (!match) {
    throw new Error("Unable to find Electron installed smoke harness error");
  }

  return match[1];
}

function extractInstalledSmokeBaseChecks(source) {
  const match = /const checks: Record<string, boolean> = \{([\s\S]*?)\n  \};/.exec(source);

  if (!match) {
    throw new Error("Unable to find installed smoke base checks");
  }

  return Array.from(match[1].matchAll(/^\s+([A-Za-z][A-Za-z0-9]*):/gm), (entry) => entry[1]);
}

function extractInstalledSmokeRendererChecks(source) {
  const match = /const installedSmokeRendererScript = String\.raw`([\s\S]*?)`;/.exec(source);

  if (!match) {
    throw new Error("Unable to find installed smoke renderer script");
  }

  const checks = [];
  const rendererSource = match[1];
  const checkPattern = /await record\("([^"]+)",|for \(const key of \[([\s\S]*?)\]\) \{/g;

  for (const entry of rendererSource.matchAll(checkPattern)) {
    if (entry[1]) {
      checks.push(entry[1]);
      continue;
    }

    checks.push(...Array.from(entry[2].matchAll(/"([^"]+)"/g), (keyEntry) => `bridge.${keyEntry[1]}`));
  }

  return checks;
}

function createClosingChildProcess(exitCode) {
  const child = new EventEmitter();

  queueMicrotask(() => child.emit("close", exitCode));

  return child;
}
