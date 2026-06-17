import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findMissingEnvironmentGroups,
  formatEnvironmentGroup
} from "./smoke-runner.mjs";

export const defaultWorkspaceRoot = fileURLToPath(new URL("..", import.meta.url));
export const installedSmokeResultKind = "typora-plus.installedSmoke.result";
export const installedSmokeEnvironmentNames = Object.freeze({
  appPath: "TYPORA_PLUS_INSTALLED_SMOKE_APP_PATH",
  timeoutMs: "TYPORA_PLUS_INSTALLED_SMOKE_TIMEOUT_MS",
  userDataDir: "TYPORA_PLUS_INSTALLED_SMOKE_USER_DATA_DIR",
  workspaceDir: "TYPORA_PLUS_INSTALLED_SMOKE_WORKSPACE_DIR"
});
export const installedSmokeEnvironmentLimits = Object.freeze({
  pathLength: 4096,
  timeoutMsMax: 120_000,
  timeoutMsMin: 1_000
});
export const installedSmokeEnvironmentGroups = Object.freeze([
  {
    label: "installed app path",
    names: Object.freeze([installedSmokeEnvironmentNames.appPath])
  }
]);
export const installedSmokeCliArgs = Object.freeze({
  enabled: "--typora-plus-installed-smoke",
  resultPath: "--typora-plus-installed-smoke-result-path=",
  userDataDir: "--typora-plus-installed-smoke-user-data-dir=",
  workspaceDir: "--typora-plus-installed-smoke-workspace-dir="
});
export const installedSmokeHarnessError = "installedSmokeHarness";
export const installedSmokeRequiredChecks = Object.freeze([
  "isolatedUserData",
  "resultPath",
  "workspaceArgument",
  "rendererMounted",
  "preloadBridge",
  "bridge.ai",
  "bridge.attachments",
  "bridge.configuration",
  "bridge.documentExport",
  "bridge.fileSystem",
  "bridge.indexSnapshots",
  "bridge.remoteSyncManifests",
  "bridge.remoteSyncRequests",
  "bridge.remoteSyncSecrets",
  "bridge.remoteSyncWorkspaceResources",
  "bridge.resources",
  "configurationRoundTrip",
  "indexSnapshotRoundTrip",
  "remoteSyncManifestRoundTrip",
  "aiSecretSetDelete",
  "remoteSyncSecretSetDelete",
  "workspaceOpenRecent",
  "workspaceCreateDirectory",
  "workspaceCreateFile",
  "workspaceRenameEntry",
  "workspaceDeleteEntry",
  "workspaceUiCreateDirectory",
  "workspaceUiCreateFile",
  "workspaceUiSyncDirectoryMenu",
  "workspaceUiRenameEntry",
  "workspaceReadWriteFile",
  "workspaceImageResource",
  "remoteSyncWorkspaceResourceRead",
  "remoteSyncWorkspaceResourceWriteReadDelete"
]);
export const installedSmokeAllowedErrorIds = Object.freeze([
  ...installedSmokeRequiredChecks,
  installedSmokeHarnessError
]);
export const installedSmokePackagedCheck = "packagedApp";

export function findMissingInstalledSmokeEnvironment({
  environment = process.env,
  groups = installedSmokeEnvironmentGroups
} = {}) {
  return findMissingEnvironmentGroups({ environment, groups });
}

export function formatInstalledSmokeEnvironmentGroup(group) {
  return formatEnvironmentGroup(group);
}

export function findInvalidInstalledSmokeEnvironment({ environment = process.env } = {}) {
  const issues = [];
  const appPath = readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.appPath);
  const userDataDir = readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.userDataDir);
  const workspaceDir = readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.workspaceDir);
  const timeoutMs = readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.timeoutMs);

  if (appPath !== undefined) {
    const appPathIssue = validateInstalledSmokePath(appPath, "installed app path");

    if (appPathIssue) {
      issues.push(appPathIssue);
    }
  }

  if (userDataDir !== undefined) {
    const userDataDirIssue = validateInstalledSmokePath(userDataDir, "user data directory");

    if (userDataDirIssue) {
      issues.push(userDataDirIssue);
    }
  }

  if (workspaceDir !== undefined) {
    const workspaceDirIssue = validateInstalledSmokePath(workspaceDir, "workspace directory");

    if (workspaceDirIssue) {
      issues.push(workspaceDirIssue);
    }
  }

  if (timeoutMs !== undefined) {
    const timeoutIssue = validateInstalledSmokeTimeout(timeoutMs);

    if (timeoutIssue) {
      issues.push(timeoutIssue);
    }
  }

  return issues;
}

export async function runInstalledSmokeCli({
  cleanupDirectory = rm,
  createSmokeWorkspace = createInstalledSmokeWorkspace,
  createTemporaryDirectory = createInstalledSmokeTemporaryDirectory,
  directoryExists = installedSmokeDirectoryExists,
  environment = process.env,
  pathExists = installedSmokePathExists,
  readResultFile = readFile,
  spawnProcess = spawn,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  const missing = findMissingInstalledSmokeEnvironment({ environment });

  if (missing.length > 0) {
    writeError("Installed app smoke test environment is incomplete.");
    writeError("Set one variable from each required group before running the smoke test:");

    for (const group of missing) {
      writeError(`- ${formatInstalledSmokeEnvironmentGroup(group)}`);
    }

    return 1;
  }

  const invalid = findInvalidInstalledSmokeEnvironment({ environment });

  if (invalid.length > 0) {
    writeError("Installed app smoke test environment is invalid.");
    writeError("Fix these environment variables before running the smoke test:");

    for (const issue of invalid) {
      writeError(`- ${issue}`);
    }

    return 1;
  }

  const appPath = readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.appPath);

  if (!appPath) {
    writeError("Installed app smoke test environment is incomplete.");
    return 1;
  }

  if (!await pathExists(appPath)) {
    writeError("Installed app smoke test environment is invalid.");
    writeError("Fix these environment variables before running the smoke test:");
    writeError("- installed app path must point to an existing file or app bundle");
    return 1;
  }

  const configuredWorkspaceDir =
    readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.workspaceDir);

  if (configuredWorkspaceDir && !await directoryExists(configuredWorkspaceDir)) {
    writeError("Installed app smoke test environment is invalid.");
    writeError("Fix these environment variables before running the smoke test:");
    writeError("- workspace directory must point to an existing directory");
    return 1;
  }

  const configuredUserDataDir =
    readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.userDataDir);
  const temporaryRoot = await createTemporaryDirectory("typora-plus-installed-smoke-");
  const userDataDir = configuredUserDataDir ?? join(temporaryRoot, "user-data");
  const workspaceDir = configuredWorkspaceDir ?? join(temporaryRoot, "workspace");
  const resultPath = join(temporaryRoot, "result.json");
  const timeoutMs = readInstalledSmokeTimeout(environment);

  try {
    if (!configuredWorkspaceDir) {
      await createSmokeWorkspace(workspaceDir);
    }

    const exitCode = await runInstalledSmokeProcess({
      appPath,
      environment: {
        ...environment,
        [installedSmokeEnvironmentNames.userDataDir]: userDataDir,
        [installedSmokeEnvironmentNames.workspaceDir]: workspaceDir
      },
      readResultFile,
      resultPath,
      spawnProcess,
      timeoutMs,
      userDataDir,
      workspaceDir,
      writeError
    });

    if (exitCode === 0) {
      writeOutput("Installed app smoke test passed.");
    }

    return exitCode;
  } finally {
    await cleanupDirectory(temporaryRoot, { force: true, recursive: true });
  }
}

export async function runInstalledSmokeProcess({
  appPath,
  environment,
  processArgsPrefix = [],
  readResultFile = readFile,
  requirePackaged = true,
  resultPath,
  spawnProcess = spawn,
  timeoutMs,
  userDataDir,
  workspaceDir,
  writeError = console.error
}) {
  const args = [
    ...processArgsPrefix,
    installedSmokeCliArgs.enabled,
    `${installedSmokeCliArgs.userDataDir}${userDataDir}`,
    `${installedSmokeCliArgs.workspaceDir}${workspaceDir}`,
    `${installedSmokeCliArgs.resultPath}${resultPath}`
  ];

  return new Promise((resolveExitCode) => {
    let child;

    try {
      child = spawnProcess(appPath, args, {
        env: environment,
        stdio: ["ignore", "ignore", "pipe"]
      });
    } catch (error) {
      writeError(formatInstalledSmokeSpawnError(error));
      resolveExitCode(1);
      return;
    }

    if (!isInstalledSmokeChildProcess(child)) {
      writeError("Installed app smoke command did not return a child process");
      resolveExitCode(1);
      return;
    }

    let resolved = false;
    const timeout = setTimeout(() => {
      if (resolved) {
        return;
      }

      resolved = true;
      child.kill?.();
      writeError("Installed app smoke test timed out.");
      resolveExitCode(1);
    }, timeoutMs);

    const resolveOnce = async (exitCode) => {
      if (resolved) {
        return;
      }

      resolved = true;
      clearTimeout(timeout);
      resolveExitCode(await readInstalledSmokeResultExitCode({
        exitCode,
        readResultFile,
        requirePackaged,
        resultPath,
        writeError
      }));
    };

    child.once("error", (error) => {
      if (resolved) {
        return;
      }

      resolved = true;
      clearTimeout(timeout);
      writeError(formatInstalledSmokeSpawnError(error));
      resolveExitCode(1);
    });
    child.once("close", (code) => {
      void resolveOnce(typeof code === "number" ? code : 1);
    });
  });
}

export async function readInstalledSmokeResultExitCode({
  exitCode,
  readResultFile = readFile,
  requirePackaged = true,
  resultPath,
  writeError = console.error
}) {
  if (exitCode !== 0) {
    writeError(`Installed app smoke process exited with code ${exitCode}.`);
    return 1;
  }

  let result;

  try {
    result = parseInstalledSmokeResult(await readResultFile(resultPath, "utf8"));
  } catch {
    writeError("Installed app smoke output did not contain a valid smoke result.");
    return 1;
  }

  const failedChecks = findFailedInstalledSmokeRequiredChecks(result);
  const failedMetadataChecks = findFailedInstalledSmokeMetadataChecks(result, { requirePackaged });
  const smokeErrors = result.errors;
  const allFailedChecks = [...failedMetadataChecks, ...failedChecks];

  if (!result.passed || allFailedChecks.length > 0 || smokeErrors.length > 0) {
    writeError("Installed app smoke test failed.");

    if (allFailedChecks.length > 0) {
      writeError(`Failed checks: ${allFailedChecks.join(", ")}`);
    }

    if (smokeErrors.length > 0) {
      writeError(`Smoke errors: ${smokeErrors.join(", ")}`);
    }

    return 1;
  }

  return 0;
}

export function parseInstalledSmokeResult(value) {
  const parsed = JSON.parse(value);

  if (
    !isRecord(parsed) ||
    parsed.kind !== installedSmokeResultKind ||
    typeof parsed.packaged !== "boolean" ||
    typeof parsed.passed !== "boolean"
  ) {
    throw new Error("Invalid installed smoke result");
  }

  return {
    checks: isRecord(parsed.checks) ? parsed.checks : {},
    errors: readInstalledSmokeResultErrors(parsed.errors),
    kind: parsed.kind,
    packaged: parsed.packaged,
    passed: parsed.passed
  };
}

export function findFailedInstalledSmokeRequiredChecks(result) {
  const checks = isRecord(result?.checks) ? result.checks : {};

  return installedSmokeRequiredChecks.filter((check) => checks[check] !== true);
}

export function findFailedInstalledSmokeMetadataChecks(result, { requirePackaged = true } = {}) {
  return requirePackaged && result?.packaged !== true ? [installedSmokePackagedCheck] : [];
}

function readInstalledSmokeEnvironmentValue(environment, name) {
  const value = environment[name];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function validateInstalledSmokePath(value, label) {
  if (
    value.length > installedSmokeEnvironmentLimits.pathLength ||
    value.includes("\0") ||
    /[\r\n]/.test(value) ||
    !isAbsolute(value)
  ) {
    return `${label} must be an absolute path at most ${installedSmokeEnvironmentLimits.pathLength} characters and must not contain line breaks`;
  }

  return undefined;
}

function validateInstalledSmokeTimeout(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed >= installedSmokeEnvironmentLimits.timeoutMsMin &&
    parsed <= installedSmokeEnvironmentLimits.timeoutMsMax
    ? undefined
    : `timeout must be an integer from ${installedSmokeEnvironmentLimits.timeoutMsMin} to ${installedSmokeEnvironmentLimits.timeoutMsMax} milliseconds`;
}

function readInstalledSmokeTimeout(environment) {
  const value = readInstalledSmokeEnvironmentValue(environment, installedSmokeEnvironmentNames.timeoutMs);

  return value === undefined ? 30_000 : Number(value);
}

export async function createInstalledSmokeTemporaryDirectory(prefix) {
  return mkdtemp(join(tmpdir(), prefix));
}

export async function createInstalledSmokeWorkspace(workspaceDir) {
  await mkdir(join(workspaceDir, "assets"), { recursive: true });
  await writeFile(
    join(workspaceDir, "installed-smoke.md"),
    [
      "# Installed Smoke",
      "",
      "Initial installed smoke workspace content.",
      "",
      "![Smoke](assets/smoke.png)",
      ""
    ].join("\n"),
    "utf8"
  );
  await writeFile(
    join(workspaceDir, "assets", "smoke.png"),
    Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMB/akF3iQAAAAASUVORK5CYII=", "base64")
  );
}

export async function installedSmokePathExists(value) {
  try {
    const stats = await stat(value);
    return stats.isFile() || stats.isDirectory();
  } catch {
    return false;
  }
}

export async function installedSmokeDirectoryExists(value) {
  try {
    return (await stat(value)).isDirectory();
  } catch {
    return false;
  }
}

function isInstalledSmokeChildProcess(value) {
  return typeof value === "object" &&
    value !== null &&
    typeof value.once === "function";
}

function formatInstalledSmokeSpawnError(error) {
  return error instanceof Error ? error.message : String(error);
}

function readInstalledSmokeResultErrors(value) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || value.some((entry) => !installedSmokeAllowedErrorIds.includes(entry))) {
    throw new Error("Invalid installed smoke result errors");
  }

  return value;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function runCli() {
  process.exitCode = await runInstalledSmokeCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
