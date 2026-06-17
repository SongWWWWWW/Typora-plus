import { spawn } from "node:child_process";

export function findMissingEnvironmentGroups({
  environment = process.env,
  groups
}) {
  return groups.filter((group) => !hasEnvironmentGroupValue(environment, group));
}

export function formatEnvironmentGroup(group) {
  return `${group.label}: ${group.names.join(" or ")}`;
}

export function hasEnvironmentGroupValue(environment, group) {
  return group.names.some((name) => hasEnvironmentValue(environment, name));
}

export function hasEnvironmentValue(environment, name) {
  return typeof environment[name] === "string" && environment[name].trim().length > 0;
}

export async function runVitestSmokeTest({
  environment = process.env,
  nodeExecutable = process.execPath,
  requiredEnvironmentFlag,
  smokeTestPath,
  spawnProcess = spawn,
  vitestEntryPath,
  writeError = console.error
}) {
  return runSpawnedCommand({
    args: [
      vitestEntryPath,
      "run",
      smokeTestPath
    ],
    command: nodeExecutable,
    environment: {
      ...environment,
      [requiredEnvironmentFlag]: "1"
    },
    spawnProcess,
    writeError
  });
}

export function runSpawnedCommand({
  args,
  command,
  environment,
  spawnProcess,
  writeError
}) {
  return new Promise((resolveExitCode) => {
    let child;

    try {
      child = spawnProcess(command, args, {
        env: environment,
        stdio: "inherit"
      });
    } catch (error) {
      writeError(formatSpawnError(error));
      resolveExitCode(1);
      return;
    }

    if (!isSpawnedChildProcess(child)) {
      writeError("Smoke command did not return a child process");
      resolveExitCode(1);
      return;
    }

    let resolved = false;
    const resolveOnce = (exitCode) => {
      if (resolved) {
        return;
      }

      resolved = true;
      resolveExitCode(exitCode);
    };

    child.once("error", (error) => {
      if (resolved) {
        return;
      }

      writeError(formatSpawnError(error));
      resolveOnce(1);
    });
    child.once("close", (code) => resolveOnce(typeof code === "number" ? code : 1));
  });
}

function isSpawnedChildProcess(value) {
  return typeof value === "object" &&
    value !== null &&
    typeof value.once === "function";
}

function formatSpawnError(error) {
  return error instanceof Error ? error.message : String(error);
}
