import { readFile } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultPackageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));

export async function readNodeEngineRange(packageJsonPath = defaultPackageJsonPath) {
  const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
  const range = packageJson.engines?.node;

  if (typeof range !== "string" || range.trim().length === 0) {
    throw new Error("package.json must define engines.node.");
  }

  return range;
}

export function parseMinimumNodeEngine(range) {
  const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(range.trim());

  if (!match) {
    throw new Error(`Unsupported engines.node range: ${range}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function parseNodeVersion(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version.trim());

  if (!match) {
    throw new Error(`Unsupported Node version: ${version}`);
  }

  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3])
  };
}

export function compareNodeVersions(left, right) {
  const majorOrder = left.major - right.major;

  if (majorOrder !== 0) {
    return majorOrder;
  }

  const minorOrder = left.minor - right.minor;

  if (minorOrder !== 0) {
    return minorOrder;
  }

  return left.patch - right.patch;
}

export function isNodeVersionCompatible(version, range) {
  return compareNodeVersions(parseNodeVersion(version), parseMinimumNodeEngine(range)) >= 0;
}

export async function runNodeVersionCheckCli({
  nodeVersion = process.version,
  packageJsonPath = defaultPackageJsonPath,
  readRange = readNodeEngineRange,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  let range;

  try {
    range = await readRange(packageJsonPath);
  } catch (error) {
    writeError(error instanceof Error ? error.message : String(error));

    return 1;
  }

  let compatible;

  try {
    compatible = isNodeVersionCompatible(nodeVersion, range);
  } catch (error) {
    writeError(error instanceof Error ? error.message : String(error));

    return 1;
  }

  if (!compatible) {
    writeError(`Node ${nodeVersion} does not satisfy engines.node ${range}.`);

    return 1;
  }

  writeOutput(`Node ${nodeVersion} satisfies engines.node ${range}.`);

  return 0;
}

async function runCli() {
  process.exitCode = await runNodeVersionCheckCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
