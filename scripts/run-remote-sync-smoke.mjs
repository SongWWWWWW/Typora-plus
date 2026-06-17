import { spawn } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findMissingEnvironmentGroups,
  formatEnvironmentGroup,
  hasEnvironmentGroupValue,
  runVitestSmokeTest
} from "./smoke-runner.mjs";

export const defaultWorkspaceRoot = fileURLToPath(new URL("..", import.meta.url));
export const defaultVitestEntryPath = join(defaultWorkspaceRoot, "node_modules", "vitest", "vitest.mjs");
export const defaultRemoteSyncSmokeTestPath =
  "packages/platform/src/remoteSyncConfiguredRawMirrorProvider.smoke.test.ts";
export const remoteSyncSmokeLocalResourcesEnvironmentName =
  "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON";
export const remoteSyncSmokeEnvironmentLimits = Object.freeze({
  baseUrlLength: 2000,
  headerSchemeLength: 128,
  listPageSizeMax: 1000,
  listPageSizeMin: 1,
  providerIdLength: 256,
  providerTitleLength: 160,
  rawMirrorPathLength: 512,
  remoteScopeIdLength: 256,
  secretNameLength: 64,
  secretRefLength: 256,
  secretValueBytes: 64 * 1024,
  workspaceUriLength: 2000
});

const remoteSyncSmokeEnvironmentNames = Object.freeze({
  baseUrl: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL",
  deletePath: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH",
  direction: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_DIRECTION",
  downloadPath: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH",
  headerName: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME",
  headerScheme: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_SCHEME",
  listPageSize: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PAGE_SIZE",
  listPath: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH",
  providerId: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID",
  providerTitle: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE",
  remoteScopeId: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_REMOTE_SCOPE_ID",
  secretName: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME",
  secretRef: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF",
  secretValue: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE",
  uploadPath: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH",
  workspaceUri: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI"
});

export const remoteSyncSmokeEnvironmentGroups = Object.freeze([
  {
    label: "provider id",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID"])
  },
  {
    label: "provider title",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE"])
  },
  {
    label: "base URL",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL"])
  },
  {
    label: "workspace URI",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI"])
  },
  {
    label: "list path",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH"])
  },
  {
    label: "upload path",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH"])
  },
  {
    label: "download path",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH"])
  },
  {
    label: "delete path",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH"])
  }
]);

export const remoteSyncSmokeSecretEnvironmentGroups = Object.freeze([
  {
    label: "secret binding name",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME"])
  },
  {
    label: "secret reference",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF"])
  },
  {
    label: "secret value",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE"])
  },
  {
    label: "secret header name",
    names: Object.freeze(["TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME"])
  }
]);

export function findMissingRemoteSyncSmokeEnvironment({
  environment = process.env,
  groups = remoteSyncSmokeEnvironmentGroups,
  secretGroups = remoteSyncSmokeSecretEnvironmentGroups
} = {}) {
  return [
    ...findMissingEnvironmentGroups({ environment, groups }),
    ...findMissingPartialRemoteSyncSmokeSecretEnvironment({ environment, secretGroups })
  ];
}

export function formatRemoteSyncSmokeEnvironmentGroup(group) {
  return formatEnvironmentGroup(group);
}

export function findInvalidRemoteSyncSmokeEnvironment({ environment = process.env } = {}) {
  return [
    ...findInvalidRemoteSyncSmokeProfileEnvironment(environment),
    ...findInvalidRemoteSyncSmokeLocalResources(environment[remoteSyncSmokeLocalResourcesEnvironmentName])
  ];
}

export async function runRemoteSyncSmokeCli({
  environment = process.env,
  nodeExecutable = process.execPath,
  smokeTestPath = defaultRemoteSyncSmokeTestPath,
  spawnProcess = spawn,
  vitestEntryPath = defaultVitestEntryPath,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  const missing = findMissingRemoteSyncSmokeEnvironment({ environment });

  if (missing.length > 0) {
    writeError("Remote sync smoke test environment is incomplete.");
    writeError("Set one variable from each required group before running the smoke test:");

    for (const group of missing) {
      writeError(`- ${formatRemoteSyncSmokeEnvironmentGroup(group)}`);
    }

    return 1;
  }

  const invalid = findInvalidRemoteSyncSmokeEnvironment({ environment });

  if (invalid.length > 0) {
    writeError("Remote sync smoke test environment is invalid.");
    writeError("Fix these environment variables before running the smoke test:");

    for (const issue of invalid) {
      writeError(`- ${issue}`);
    }

    return 1;
  }

  writeOutput("Running provider-neutral raw mirror remote sync smoke test.");

  return runVitestSmokeTest({
    environment,
    nodeExecutable,
    requiredEnvironmentFlag: "TYPORA_PLUS_REMOTE_SYNC_SMOKE_REQUIRED",
    smokeTestPath,
    spawnProcess,
    vitestEntryPath,
    writeError
  });
}

function findMissingPartialRemoteSyncSmokeSecretEnvironment({ environment, secretGroups }) {
  if (!secretGroups.some((group) => hasEnvironmentGroupValue(environment, group))) {
    return [];
  }

  return secretGroups.filter((group) => !hasEnvironmentGroupValue(environment, group));
}

function findInvalidRemoteSyncSmokeProfileEnvironment(environment) {
  const issues = [];

  addOptionalIssue(issues, validateRemoteSyncSmokeProviderId(
    readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.providerId)
  ));
  addOptionalIssue(issues, validateRemoteSyncSmokeBoundedText(
    readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.providerTitle),
    "provider title",
    remoteSyncSmokeEnvironmentLimits.providerTitleLength
  ));
  addOptionalIssue(issues, validateRemoteSyncSmokeBaseUrl(
    readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.baseUrl)
  ));
  addOptionalIssue(issues, validateRemoteSyncSmokeWorkspaceUri(
    readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.workspaceUri)
  ));

  for (const [label, name] of [
    ["list path", remoteSyncSmokeEnvironmentNames.listPath],
    ["upload path", remoteSyncSmokeEnvironmentNames.uploadPath],
    ["download path", remoteSyncSmokeEnvironmentNames.downloadPath],
    ["delete path", remoteSyncSmokeEnvironmentNames.deletePath]
  ]) {
    addOptionalIssue(issues, validateRemoteSyncSmokeRawMirrorPath(
      readRemoteSyncSmokeEnvironmentValue(environment, name),
      label
    ));
  }

  addOptionalIssue(issues, validateRemoteSyncSmokeDirection(
    readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.direction)
  ));
  addOptionalIssue(issues, validateRemoteSyncSmokeListPageSize(
    readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.listPageSize)
  ));
  addOptionalIssue(issues, validateRemoteSyncSmokeBoundedText(
    readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.remoteScopeId),
    "remote scope id",
    remoteSyncSmokeEnvironmentLimits.remoteScopeIdLength
  ));
  issues.push(...findInvalidRemoteSyncSmokeSecretEnvironment(environment));

  return issues;
}

function findInvalidRemoteSyncSmokeSecretEnvironment(environment) {
  const issues = [];
  const secretName = readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.secretName);
  const secretRef = readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.secretRef);
  const secretValue = readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.secretValue);
  const headerName = readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.headerName);
  const headerScheme = readRemoteSyncSmokeEnvironmentValue(environment, remoteSyncSmokeEnvironmentNames.headerScheme);
  const hasAnyRequiredSecretValue = [secretName, secretRef, secretValue, headerName]
    .some((value) => value !== undefined);

  if (!hasAnyRequiredSecretValue && headerScheme !== undefined) {
    issues.push("secret header scheme requires a complete secret header configuration");
    addOptionalIssue(issues, validateRemoteSyncSmokeHeaderScheme(headerScheme));
    return issues;
  }

  addOptionalIssue(issues, validateRemoteSyncSmokeSecretName(secretName));
  addOptionalIssue(issues, validateRemoteSyncSmokeSecretRef(secretRef));
  addOptionalIssue(issues, validateRemoteSyncSmokeSecretValue(secretValue));
  addOptionalIssue(issues, validateRemoteSyncSmokeHeaderName(headerName));
  addOptionalIssue(issues, validateRemoteSyncSmokeHeaderScheme(headerScheme));

  return issues;
}

function findInvalidRemoteSyncSmokeLocalResources(value) {
  const rawValue = typeof value === "string" ? value.trim() : "";

  if (!rawValue) {
    return [];
  }

  let parsed;

  try {
    parsed = JSON.parse(rawValue);
  } catch {
    return [`${remoteSyncSmokeLocalResourcesEnvironmentName} must be valid JSON`];
  }

  if (!Array.isArray(parsed)) {
    return [`${remoteSyncSmokeLocalResourcesEnvironmentName} must be a JSON array`];
  }

  return parsed.flatMap((resource, index) => validateRemoteSyncSmokeLocalResource(resource, index));
}

function validateRemoteSyncSmokeLocalResource(value, index) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [`${remoteSyncSmokeLocalResourcesEnvironmentName}[${index}] must be an object`];
  }

  const issues = [];
  const relativePathIssue = validateRemoteSyncSmokeLocalResourceRelativePath(value.relativePath, index);

  if (relativePathIssue) {
    issues.push(relativePathIssue);
  }

  if (value.kind !== undefined && value.kind !== "file" && value.kind !== "directory") {
    issues.push(`${remoteSyncSmokeLocalResourcesEnvironmentName}[${index}].kind must be file or directory`);
  }

  for (const key of ["size", "mtime"]) {
    if (value[key] !== undefined && !isNonNegativeFiniteNumber(value[key])) {
      issues.push(`${remoteSyncSmokeLocalResourcesEnvironmentName}[${index}].${key} must be a non-negative finite number`);
    }
  }

  for (const key of ["contentHash", "name"]) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      issues.push(`${remoteSyncSmokeLocalResourcesEnvironmentName}[${index}].${key} must be a string`);
    }
  }

  return issues;
}

function validateRemoteSyncSmokeLocalResourceRelativePath(value, index) {
  if (typeof value !== "string") {
    return `${remoteSyncSmokeLocalResourcesEnvironmentName}[${index}].relativePath must be a string`;
  }

  const normalized = value.trim().replaceAll("\\", "/");

  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized)
  ) {
    return `${remoteSyncSmokeLocalResourcesEnvironmentName}[${index}].relativePath must be workspace-relative`;
  }

  if (normalized.split("/").some((segment) => segment === "..")) {
    return `${remoteSyncSmokeLocalResourcesEnvironmentName}[${index}].relativePath must not contain parent traversal`;
  }

  return undefined;
}

function isNonNegativeFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function readRemoteSyncSmokeEnvironmentValue(environment, name) {
  const value = environment[name];

  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

function addOptionalIssue(issues, issue) {
  if (issue) {
    issues.push(issue);
  }
}

function validateRemoteSyncSmokeProviderId(value) {
  if (value === undefined) {
    return undefined;
  }

  return value.length <= remoteSyncSmokeEnvironmentLimits.providerIdLength &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
    ? undefined
    : `provider id must use provider id characters and be at most ${remoteSyncSmokeEnvironmentLimits.providerIdLength} characters`;
}

function validateRemoteSyncSmokeBoundedText(value, label, maxLength) {
  if (value === undefined) {
    return undefined;
  }

  return value.length <= maxLength ? undefined : `${label} must be at most ${maxLength} characters`;
}

function validateRemoteSyncSmokeBaseUrl(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value.length > remoteSyncSmokeEnvironmentLimits.baseUrlLength) {
    return `base URL must be HTTPS or loopback HTTP and at most ${remoteSyncSmokeEnvironmentLimits.baseUrlLength} characters`;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || isLoopbackHttpUrl(url)) {
      return undefined;
    }
  } catch {
    // Fall through to the generic URL diagnostic below.
  }

  return `base URL must be HTTPS or loopback HTTP and at most ${remoteSyncSmokeEnvironmentLimits.baseUrlLength} characters`;
}

function validateRemoteSyncSmokeWorkspaceUri(value) {
  if (value === undefined) {
    return undefined;
  }

  if (value.length > remoteSyncSmokeEnvironmentLimits.workspaceUriLength) {
    return `workspace URI must be an absolute URI and at most ${remoteSyncSmokeEnvironmentLimits.workspaceUriLength} characters`;
  }

  try {
    const url = new URL(value);
    return url.protocol
      ? undefined
      : `workspace URI must be an absolute URI and at most ${remoteSyncSmokeEnvironmentLimits.workspaceUriLength} characters`;
  } catch {
    return `workspace URI must be an absolute URI and at most ${remoteSyncSmokeEnvironmentLimits.workspaceUriLength} characters`;
  }
}

function validateRemoteSyncSmokeRawMirrorPath(value, label) {
  if (value === undefined) {
    return undefined;
  }

  return isRemoteSyncSmokeRawMirrorPath(value)
    ? undefined
    : `${label} must be a relative raw mirror path at most ${remoteSyncSmokeEnvironmentLimits.rawMirrorPathLength} characters`;
}

function validateRemoteSyncSmokeDirection(value) {
  if (value === undefined) {
    return undefined;
  }

  return value === "push" || value === "pull" || value === "bidirectional"
    ? undefined
    : "sync direction must be push, pull, or bidirectional";
}

function validateRemoteSyncSmokeListPageSize(value) {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number(value);

  return Number.isInteger(parsed) &&
    parsed >= remoteSyncSmokeEnvironmentLimits.listPageSizeMin &&
    parsed <= remoteSyncSmokeEnvironmentLimits.listPageSizeMax
    ? undefined
    : `list page size must be an integer from ${remoteSyncSmokeEnvironmentLimits.listPageSizeMin} to ${remoteSyncSmokeEnvironmentLimits.listPageSizeMax}`;
}

function validateRemoteSyncSmokeSecretName(value) {
  if (value === undefined) {
    return undefined;
  }

  return value.length <= remoteSyncSmokeEnvironmentLimits.secretNameLength &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
    ? undefined
    : `secret binding name must use secret binding characters and be at most ${remoteSyncSmokeEnvironmentLimits.secretNameLength} characters`;
}

function validateRemoteSyncSmokeSecretRef(value) {
  if (value === undefined) {
    return undefined;
  }

  return value.length <= remoteSyncSmokeEnvironmentLimits.secretRefLength &&
    /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(value)
    ? undefined
    : `secret reference must use secret reference characters and be at most ${remoteSyncSmokeEnvironmentLimits.secretRefLength} characters`;
}

function validateRemoteSyncSmokeSecretValue(value) {
  if (value === undefined) {
    return undefined;
  }

  return Buffer.byteLength(value, "utf8") <= remoteSyncSmokeEnvironmentLimits.secretValueBytes
    ? undefined
    : `secret value must be at most ${remoteSyncSmokeEnvironmentLimits.secretValueBytes} UTF-8 bytes`;
}

function validateRemoteSyncSmokeHeaderName(value) {
  if (value === undefined) {
    return undefined;
  }

  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value)
    ? undefined
    : "secret header name must be a valid HTTP header name";
}

function validateRemoteSyncSmokeHeaderScheme(value) {
  if (value === undefined) {
    return undefined;
  }

  return value.length <= remoteSyncSmokeEnvironmentLimits.headerSchemeLength && !/[\r\n]/.test(value)
    ? undefined
    : `secret header scheme must be at most ${remoteSyncSmokeEnvironmentLimits.headerSchemeLength} characters and must not contain line breaks`;
}

function isRemoteSyncSmokeRawMirrorPath(value) {
  const normalized = value.trim();

  return !(
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.length > remoteSyncSmokeEnvironmentLimits.rawMirrorPathLength ||
    /[?#]/.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    hasRemoteSyncSmokeParentTraversal(normalized)
  );
}

function hasRemoteSyncSmokeParentTraversal(path) {
  return path.split("/").some((segment) => {
    if (segment === "..") {
      return true;
    }

    try {
      return decodeURIComponent(segment) === "..";
    } catch {
      return false;
    }
  });
}

function isLoopbackHttpUrl(url) {
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

async function runCli() {
  process.exitCode = await runRemoteSyncSmokeCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
