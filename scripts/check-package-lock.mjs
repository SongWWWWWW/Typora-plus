import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultPackageJsonPath = fileURLToPath(new URL("../package.json", import.meta.url));
export const defaultPackageLockPath = fileURLToPath(new URL("../package-lock.json", import.meta.url));
export const packageLockTopLevelFields = Object.freeze([
  "name",
  "version"
]);
export const packageLockRootFields = Object.freeze([
  "name",
  "version",
  "workspaces",
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "engines"
]);
export const packageLockWorkspaceFields = Object.freeze([
  "name",
  "version",
  "dependencies",
  "devDependencies",
  "optionalDependencies",
  "peerDependencies",
  "engines"
]);

export async function readJsonFile(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function readDirEntries(path) {
  return readdir(path, { withFileTypes: true });
}

export async function findPackageLockMismatches({
  packageJsonPath = defaultPackageJsonPath,
  packageLockPath = defaultPackageLockPath,
  readJson = readJsonFile,
  readDir = readDirEntries,
  findWorkspaces = findWorkspacePackages,
  workspaceRootPath = dirname(packageJsonPath)
} = {}) {
  const [packageJson, packageLock] = await Promise.all([readJson(packageJsonPath), readJson(packageLockPath)]);
  const lockRootPackage = packageLock.packages?.[""];

  if (!lockRootPackage || typeof lockRootPackage !== "object") {
    return ["package-lock.json is missing packages[\"\"] root metadata."];
  }

  const mismatches = [
    ...comparePackageMetadata({
      fields: packageLockTopLevelFields,
      lockPackage: packageLock,
      lockPackageLabel: "package-lock.json",
      packageJson,
      packageJsonLabel: "package.json"
    }),
    ...comparePackageMetadata({
      fields: packageLockRootFields,
      lockPackage: lockRootPackage,
      lockPackageLabel: 'package-lock.json packages[""]',
      packageJson,
      packageJsonLabel: "package.json"
    })
  ];
  const workspacePackages = await findWorkspaces({
    packageJson,
    readDir,
    readJson,
    workspaceRootPath
  });
  const workspacePackagePaths = new Set(workspacePackages.map((workspacePackage) => workspacePackage.path));

  for (const workspacePackage of workspacePackages) {
    const lockWorkspacePackage = packageLock.packages?.[workspacePackage.path];

    if (!lockWorkspacePackage || typeof lockWorkspacePackage !== "object") {
      mismatches.push(`package-lock.json is missing packages["${workspacePackage.path}"] workspace metadata.`);
      continue;
    }

    mismatches.push(
      ...comparePackageMetadata({
        fields: packageLockWorkspaceFields,
        lockPackage: lockWorkspacePackage,
        lockPackageLabel: `package-lock.json packages["${workspacePackage.path}"]`,
        packageJson: workspacePackage.packageJson,
        packageJsonLabel: `${workspacePackage.path}/package.json`
      })
    );
  }

  mismatches.push(
    ...findStaleWorkspaceLockPackageMismatches({
      packageJson,
      packageLock,
      workspacePackagePaths
    })
  );

  return mismatches;
}

export async function findWorkspacePackages({
  packageJson,
  readDir = readDirEntries,
  readJson = readJsonFile,
  workspaceRootPath = dirname(defaultPackageJsonPath)
} = {}) {
  const workspacePackagesByPath = new Map();

  for (const pattern of getWorkspacePatterns(packageJson)) {
    const patternInfo = parseSupportedWorkspacePattern(pattern);
    const candidatePaths =
      patternInfo.kind === "direct"
        ? [patternInfo.path]
        : await findSingleSegmentWorkspacePackagePaths({
            patternBasePath: patternInfo.basePath,
            readDir,
            workspaceRootPath
          });

    for (const workspacePath of candidatePaths) {
      if (workspacePackagesByPath.has(workspacePath)) {
        continue;
      }

      const workspacePackageJson = await readOptionalWorkspacePackageJson({
        readJson,
        workspacePath,
        workspaceRootPath
      });

      if (workspacePackageJson) {
        workspacePackagesByPath.set(workspacePath, {
          packageJson: workspacePackageJson,
          path: workspacePath
        });
      }
    }
  }

  return [...workspacePackagesByPath.values()].sort((left, right) => left.path.localeCompare(right.path));
}

export function getWorkspacePatterns(packageJson) {
  if (Array.isArray(packageJson?.workspaces)) {
    return packageJson.workspaces;
  }

  if (Array.isArray(packageJson?.workspaces?.packages)) {
    return packageJson.workspaces.packages;
  }

  return [];
}

export function parseSupportedWorkspacePattern(pattern) {
  if (typeof pattern !== "string" || pattern.trim() === "") {
    throw new Error(`Unsupported workspace pattern ${JSON.stringify(pattern)}.`);
  }

  const normalizedPattern = normalizeLockPath(pattern);

  if (normalizedPattern.includes("**") || normalizedPattern.startsWith("!") || normalizedPattern.includes("*")) {
    if (normalizedPattern.endsWith("/*") && normalizedPattern.indexOf("*") === normalizedPattern.length - 1) {
      return {
        basePath: normalizedPattern.slice(0, -2),
        kind: "single-segment"
      };
    }

    throw new Error(
      `Unsupported workspace pattern "${pattern}". Only direct package paths and single-segment wildcard patterns are supported.`
    );
  }

  return {
    kind: "direct",
    path: trimSlashes(normalizedPattern)
  };
}

function comparePackageMetadata({ fields, lockPackage, lockPackageLabel, packageJson, packageJsonLabel }) {
  const mismatches = [];

  for (const field of fields) {
    const packageValue = packageJson[field];
    const lockValue = lockPackage[field];

    if (packageValue === undefined && lockValue === undefined) {
      continue;
    }

    if (stableJson(packageValue) !== stableJson(lockValue)) {
      mismatches.push(`${lockPackageLabel}.${field} does not match ${packageJsonLabel} ${field}.`);
    }
  }

  return mismatches;
}

function findStaleWorkspaceLockPackageMismatches({ packageJson, packageLock, workspacePackagePaths }) {
  if (!packageLock.packages || typeof packageLock.packages !== "object") {
    return [];
  }

  return Object.keys(packageLock.packages)
    .map((path) => trimSlashes(normalizeLockPath(path)))
    .filter((path) => isWorkspaceLockPackagePath(packageJson, path))
    .filter((path) => !workspacePackagePaths.has(path))
    .sort((left, right) => left.localeCompare(right))
    .map((path) =>
      `package-lock.json contains stale packages["${path}"] workspace metadata with no matching workspace package.`
    );
}

function isWorkspaceLockPackagePath(packageJson, path) {
  if (
    !path ||
    path === "node_modules" ||
    path.startsWith("node_modules/") ||
    path.includes("/node_modules/")
  ) {
    return false;
  }

  return getWorkspacePatterns(packageJson).some((pattern) => {
    const patternInfo = parseSupportedWorkspacePattern(pattern);

    if (patternInfo.kind === "direct") {
      return path === patternInfo.path;
    }

    return isSingleSegmentWorkspacePackagePath(path, patternInfo.basePath);
  });
}

function isSingleSegmentWorkspacePackagePath(path, basePath) {
  const normalizedBasePath = trimSlashes(basePath);

  if (!normalizedBasePath || !path.startsWith(`${normalizedBasePath}/`)) {
    return false;
  }

  const candidate = path.slice(normalizedBasePath.length + 1);

  return candidate.length > 0 && !candidate.includes("/");
}

async function findSingleSegmentWorkspacePackagePaths({ patternBasePath, readDir, workspaceRootPath }) {
  const normalizedBasePath = trimSlashes(patternBasePath);
  const entries = await readDir(resolveWorkspacePath(workspaceRootPath, normalizedBasePath));

  return entries
    .filter((entry) => typeof entry.isDirectory === "function" && entry.isDirectory())
    .map((entry) => joinLockPath(normalizedBasePath, entry.name))
    .sort((left, right) => left.localeCompare(right));
}

async function readOptionalWorkspacePackageJson({ readJson, workspacePath, workspaceRootPath }) {
  try {
    return await readJson(resolveWorkspacePath(workspaceRootPath, workspacePath, "package.json"));
  } catch (error) {
    if (isNotFoundError(error)) {
      return undefined;
    }

    throw error;
  }
}

function resolveWorkspacePath(rootPath, ...relativeParts) {
  return join(rootPath, ...joinLockPath(...relativeParts).split("/").filter(Boolean));
}

function joinLockPath(...parts) {
  return trimSlashes(parts.filter(Boolean).map((part) => normalizeLockPath(part)).join("/"));
}

function normalizeLockPath(path) {
  return path.replaceAll("\\", "/");
}

function trimSlashes(path) {
  return path.replace(/^\/+|\/+$/g, "");
}

function isNotFoundError(error) {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "ENOENT");
}

export function stableJson(value) {
  return JSON.stringify(normalizeJson(value));
}

function normalizeJson(value) {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJson(item));
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, normalizeJson(value[key])])
    );
  }

  return value;
}

export async function runPackageLockCheckCli({
  findMismatches = findPackageLockMismatches,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  let mismatches;

  try {
    mismatches = await findMismatches();
  } catch (error) {
    writeError(error instanceof Error ? error.message : String(error));

    return 1;
  }

  if (mismatches.length > 0) {
    writeError("package-lock.json is out of sync with package.json:");

    for (const mismatch of mismatches) {
      writeError(`- ${mismatch}`);
    }

    return 1;
  }

  writeOutput("package-lock.json package metadata matches package.json files.");

  return 0;
}

async function runCli() {
  process.exitCode = await runPackageLockCheckCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
