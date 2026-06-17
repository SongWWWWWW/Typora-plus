import { spawn } from "node:child_process";
import { rm, readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { isAbsolute, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  createInstalledSmokeTemporaryDirectory,
  createInstalledSmokeWorkspace,
  installedSmokeDirectoryExists,
  installedSmokeEnvironmentLimits,
  installedSmokePathExists,
  runInstalledSmokeProcess
} from "./run-installed-smoke.mjs";

const requireFromScript = createRequire(import.meta.url);

export const defaultWorkspaceRoot = fileURLToPath(new URL("..", import.meta.url));
export const defaultElectronSmokeMainPath = join(defaultWorkspaceRoot, "apps", "desktop", "dist-electron", "main.js");
export const defaultElectronSmokeDevServerUrl = "http://127.0.0.1:5173";
export const electronSmokeEnvironmentNames = Object.freeze({
  timeoutMs: "TYPORA_PLUS_ELECTRON_SMOKE_TIMEOUT_MS",
  userDataDir: "TYPORA_PLUS_ELECTRON_SMOKE_USER_DATA_DIR",
  workspaceDir: "TYPORA_PLUS_ELECTRON_SMOKE_WORKSPACE_DIR"
});

export function findInvalidElectronSmokeEnvironment({ environment = process.env } = {}) {
  const issues = [];
  const userDataDir = readElectronSmokeEnvironmentValue(environment, electronSmokeEnvironmentNames.userDataDir);
  const workspaceDir = readElectronSmokeEnvironmentValue(environment, electronSmokeEnvironmentNames.workspaceDir);
  const timeoutMs = readElectronSmokeEnvironmentValue(environment, electronSmokeEnvironmentNames.timeoutMs);

  if (userDataDir !== undefined) {
    const userDataDirIssue = validateElectronSmokePath(userDataDir, "user data directory");

    if (userDataDirIssue) {
      issues.push(userDataDirIssue);
    }
  }

  if (workspaceDir !== undefined) {
    const workspaceDirIssue = validateElectronSmokePath(workspaceDir, "workspace directory");

    if (workspaceDirIssue) {
      issues.push(workspaceDirIssue);
    }
  }

  if (timeoutMs !== undefined) {
    const timeoutIssue = validateElectronSmokeTimeout(timeoutMs);

    if (timeoutIssue) {
      issues.push(timeoutIssue);
    }
  }

  return issues;
}

export function readDefaultElectronExecutablePath(requirePackage = requireFromScript) {
  const electronExecutablePath = requirePackage("electron");

  if (typeof electronExecutablePath !== "string" || electronExecutablePath.trim().length === 0) {
    throw new Error("Electron executable path is unavailable");
  }

  return electronExecutablePath;
}

export async function runElectronSmokeCli({
  cleanupDirectory = rm,
  createSmokeWorkspace = createInstalledSmokeWorkspace,
  createTemporaryDirectory = createInstalledSmokeTemporaryDirectory,
  devServerAvailable = isElectronSmokeDevServerAvailable,
  devServerUrl = defaultElectronSmokeDevServerUrl,
  directoryExists = installedSmokeDirectoryExists,
  electronExecutablePath,
  environment = process.env,
  mainPath = defaultElectronSmokeMainPath,
  pathExists = installedSmokePathExists,
  readResultFile = readFile,
  spawnProcess = spawn,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  const invalid = findInvalidElectronSmokeEnvironment({ environment });

  if (invalid.length > 0) {
    writeError("Source-built Electron smoke test environment is invalid.");
    writeError("Fix these environment variables before running the smoke test:");

    for (const issue of invalid) {
      writeError(`- ${issue}`);
    }

    return 1;
  }

  let resolvedElectronExecutablePath = electronExecutablePath;

  if (!resolvedElectronExecutablePath) {
    try {
      resolvedElectronExecutablePath = readDefaultElectronExecutablePath();
    } catch {
      writeError("Source-built Electron smoke test could not resolve the Electron executable.");
      writeError("Run `npm install` before `npm run test:electron:smoke`.");
      return 1;
    }
  }

  if (!await pathExists(resolvedElectronExecutablePath)) {
    writeError("Source-built Electron smoke test could not find the Electron executable.");
    writeError("Run `npm install` before `npm run test:electron:smoke`.");
    return 1;
  }

  if (!await pathExists(mainPath)) {
    writeError("Source-built Electron smoke test could not find the desktop Electron build output.");
    writeError("Run `npm run build -w @typora-plus/desktop` before `npm run test:electron:smoke`.");
    return 1;
  }

  if (!await devServerAvailable(devServerUrl)) {
    writeError("Source-built Electron smoke test could not reach the renderer dev server.");
    writeError("Run `npm run dev` in another terminal before `npm run test:electron:smoke`.");
    return 1;
  }

  const configuredWorkspaceDir =
    readElectronSmokeEnvironmentValue(environment, electronSmokeEnvironmentNames.workspaceDir);

  if (configuredWorkspaceDir && !await directoryExists(configuredWorkspaceDir)) {
    writeError("Source-built Electron smoke test environment is invalid.");
    writeError("Fix these environment variables before running the smoke test:");
    writeError("- workspace directory must point to an existing directory");
    return 1;
  }

  const configuredUserDataDir =
    readElectronSmokeEnvironmentValue(environment, electronSmokeEnvironmentNames.userDataDir);
  const temporaryRoot = await createTemporaryDirectory("typora-plus-electron-smoke-");
  const userDataDir = configuredUserDataDir ?? join(temporaryRoot, "user-data");
  const workspaceDir = configuredWorkspaceDir ?? join(temporaryRoot, "workspace");
  const resultPath = join(temporaryRoot, "result.json");
  const timeoutMs = readElectronSmokeTimeout(environment);

  try {
    if (!configuredWorkspaceDir) {
      await createSmokeWorkspace(workspaceDir);
    }

    const exitCode = await runInstalledSmokeProcess({
      appPath: resolvedElectronExecutablePath,
      environment: {
        ...environment,
        [electronSmokeEnvironmentNames.userDataDir]: userDataDir,
        [electronSmokeEnvironmentNames.workspaceDir]: workspaceDir
      },
      processArgsPrefix: [mainPath],
      readResultFile,
      requirePackaged: false,
      resultPath,
      spawnProcess,
      timeoutMs,
      userDataDir,
      workspaceDir,
      writeError
    });

    if (exitCode === 0) {
      writeOutput("Source-built Electron smoke test passed.");
    }

    return exitCode;
  } finally {
    await cleanupDirectory(temporaryRoot, { force: true, recursive: true });
  }
}

export async function isElectronSmokeDevServerAvailable(url, {
  fetchUrl = globalThis.fetch,
  timeoutMs = 1_000
} = {}) {
  if (typeof fetchUrl !== "function") {
    return false;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchUrl(url, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function readElectronSmokeEnvironmentValue(environment, name) {
  const value = environment[name];

  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
}

function validateElectronSmokePath(value, label) {
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

function validateElectronSmokeTimeout(value) {
  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed >= installedSmokeEnvironmentLimits.timeoutMsMin &&
    parsed <= installedSmokeEnvironmentLimits.timeoutMsMax
    ? undefined
    : `timeout must be an integer from ${installedSmokeEnvironmentLimits.timeoutMsMin} to ${installedSmokeEnvironmentLimits.timeoutMsMax} milliseconds`;
}

function readElectronSmokeTimeout(environment) {
  const value = readElectronSmokeEnvironmentValue(environment, electronSmokeEnvironmentNames.timeoutMs);

  return value === undefined ? 30_000 : Number(value);
}

async function runCli() {
  process.exitCode = await runElectronSmokeCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
