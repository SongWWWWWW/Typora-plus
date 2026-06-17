import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

export const larkGatewayDefaultHost = "127.0.0.1";
export const larkGatewayDefaultPort = 41573;
export const larkGatewayDefaultAuthScopes = Object.freeze([
  "space:document:retrieve",
  "drive:file:upload",
  "drive:file:download",
  "space:folder:create",
  "space:document:delete"
]);
export const larkGatewayRawMirrorPaths = Object.freeze({
  list: "/mirror/list",
  upload: "/mirror/upload",
  download: "/mirror/download",
  delete: "/mirror/delete"
});

export const larkGatewayFolderPaths = Object.freeze({
  list: "/folders/list",
  create: "/folders/create"
});

const larkGatewayLimits = Object.freeze({
  authValueLength: 4096,
  cliOutputBytes: 4 * 1024 * 1024,
  driveNameBytes: 255,
  fileBytes: 8 * 1024 * 1024,
  headerValueBytes: 8192,
  maxListEntries: 20_000,
  maxPathLength: 1000,
  maxRequestBodyBytes: 10 * 1024 * 1024,
  maxTraversalDepth: 32,
  pageSize: 200,
  profileLength: 128,
  scopeLength: 512
});

const folderTokenParameter = ["folder", "token"].join("_");
const pageTokenParameter = ["page", "token"].join("_");
const pageSizeParameter = ["page", "size"].join("_");

export function readLarkGatewayEnvironment(environment = process.env) {
  return {
    cliCommand: readOptionalEnvironmentText(environment, "TYPORA_PLUS_LARK_CLI_PATH") ??
      resolveDefaultLarkCliCommand(process.platform, environment),
    host: readOptionalEnvironmentText(environment, "TYPORA_PLUS_LARK_GATEWAY_HOST") ?? larkGatewayDefaultHost,
    port: readOptionalPort(environment.TYPORA_PLUS_LARK_GATEWAY_PORT) ?? larkGatewayDefaultPort,
    profile: readOptionalEnvironmentText(environment, "TYPORA_PLUS_LARK_CLI_PROFILE"),
    identity: readOptionalIdentity(environment.TYPORA_PLUS_LARK_GATEWAY_IDENTITY) ?? "user",
    authScope: readOptionalBoundedText(environment.TYPORA_PLUS_LARK_AUTH_SCOPE, larkGatewayLimits.scopeLength) ??
      larkGatewayDefaultAuthScopes.join(" "),
    sharedSecret: readOptionalBoundedText(
      environment.TYPORA_PLUS_LARK_GATEWAY_SHARED_SECRET,
      larkGatewayLimits.authValueLength
    ),
    maxFileBytes: readOptionalPositiveInteger(environment.TYPORA_PLUS_LARK_GATEWAY_MAX_FILE_BYTES) ??
      larkGatewayLimits.fileBytes
  };
}

export function resolveDefaultLarkCliCommand(
  platform = process.platform,
  environment = process.env,
  pathExists = existsSync
) {
  if (platform !== "win32") {
    return "lark-cli";
  }

  const appData = typeof environment.APPDATA === "string" ? environment.APPDATA.trim() : "";
  const npmCliRoot = appData
    ? join(appData, "npm", "node_modules", "@larksuite", "cli")
    : undefined;
  const npmCliBinary = npmCliRoot ? join(npmCliRoot, "bin", "lark-cli.exe") : undefined;
  const npmCliScript = npmCliRoot ? join(npmCliRoot, "scripts", "run.js") : undefined;

  if (npmCliBinary && pathExists(npmCliBinary)) {
    return npmCliBinary;
  }

  return npmCliScript && pathExists(npmCliScript) ? npmCliScript : "lark-cli.cmd";
}

export function createLarkRawMirrorProviderProfile({
  baseUrl,
  providerId,
  providerTitle,
  remoteScopeId,
  secretName,
  secretRef
}) {
  const profile = {
    id: providerId,
    title: providerTitle,
    kind: "native-request",
    baseUrl,
    ...(remoteScopeId ? { remoteScopeId } : {}),
    metadata: {
      "rawMirror.adapter": "raw-mirror",
      "rawMirror.listPath": pathWithoutLeadingSlash(larkGatewayRawMirrorPaths.list),
      "rawMirror.uploadPath": pathWithoutLeadingSlash(larkGatewayRawMirrorPaths.upload),
      "rawMirror.downloadPath": pathWithoutLeadingSlash(larkGatewayRawMirrorPaths.download),
      "rawMirror.deletePath": pathWithoutLeadingSlash(larkGatewayRawMirrorPaths.delete)
    },
    secrets: []
  };

  if (secretName && secretRef) {
    profile.metadata["rawMirror.headerBinding"] = secretName;
    profile.metadata["rawMirror.headerName"] = "Authorization";
    profile.metadata["rawMirror.headerScheme"] = "Bearer";
    profile.secrets = [{ name: secretName, secretRef }];
  }

  return profile;
}

export function createLarkGatewayContext(options = {}) {
  return {
    ...readLarkGatewayEnvironment(options.environment),
    ...options,
    runCli: options.runCli ?? runLarkCliJson
  };
}

export async function startLarkRawMirrorGateway(options = {}) {
  const context = createLarkGatewayContext(options);
  const server = createServer((request, response) => {
    void handleLarkGatewayRequest(context, request, response).catch((error) => {
      writeJsonResponse(response, 500, {
        ok: false,
        error: sanitizeErrorMessage(error)
      });
    });
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(context.port, context.host, () => {
      server.off("error", reject);
      resolve(undefined);
    });
  });

  return {
    context,
    server,
    url: `http://${context.host}:${server.address().port}/`
  };
}

export async function handleLarkGatewayRequest(context, request, response) {
  const url = new URL(request.url ?? "/", `http://${context.host}:${context.port}`);

  if (request.method === "OPTIONS") {
    writeCorsPreflightResponse(response);
    return;
  }

  if (request.method === "GET" && url.pathname === "/health") {
    writeJsonResponse(response, 200, { ok: true });
    return;
  }

  requireSharedSecret(context, request);

  if (request.method === "GET" && url.pathname === "/auth/status") {
    writeJsonResponse(response, 200, await runLarkAuthStatus(context, url.searchParams.get("verify") === "true"));
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/login/start") {
    writeJsonResponse(response, 200, await runLarkAuthLoginStart(context));
    return;
  }

  if (request.method === "POST" && url.pathname === "/auth/login/complete") {
    const body = await readJsonRequestBody(request);
    writeJsonResponse(response, 200, await runLarkAuthLoginComplete(context, body));
    return;
  }

  if (request.method === "GET" && url.pathname === larkGatewayFolderPaths.list) {
    writeJsonResponse(response, 200, await listLarkDriveFolders(context, url.searchParams));
    return;
  }

  if (request.method === "POST" && url.pathname === larkGatewayFolderPaths.create) {
    const body = await readJsonRequestBody(request);
    writeJsonResponse(response, 200, await createLarkDriveFolder(context, body));
    return;
  }

  if (request.method === "GET" && url.pathname === larkGatewayRawMirrorPaths.list) {
    writeJsonResponse(response, 200, await listLarkRawMirrorPage(context, url.searchParams));
    return;
  }

  if (request.method === "PUT" && url.pathname === larkGatewayRawMirrorPaths.upload) {
    const body = await readJsonRequestBody(request);
    writeJsonResponse(response, 200, await uploadLarkRawMirrorFile(context, url.searchParams, body));
    return;
  }

  if (request.method === "GET" && url.pathname === larkGatewayRawMirrorPaths.download) {
    writeJsonResponse(response, 200, await downloadLarkRawMirrorFile(context, url.searchParams));
    return;
  }

  if (request.method === "DELETE" && url.pathname === larkGatewayRawMirrorPaths.delete) {
    writeJsonResponse(response, 200, await deleteLarkRawMirrorFile(context, url.searchParams));
    return;
  }

  writeJsonResponse(response, 404, { ok: false, error: "Unknown Lark raw mirror route" });
}

export async function runLarkAuthStatus(context, verify = false) {
  const args = ["auth", "status"];

  if (verify) {
    args.push("--verify");
  }

  return context.runCli(context, args, { parseJson: false });
}

export async function runLarkAuthLoginStart(context) {
  const args = ["auth", "login", "--no-wait", "--json"];

  if (context.authScope) {
    args.push("--scope", context.authScope);
  } else {
    args.push("--domain", "drive");
  }

  return context.runCli(context, args);
}

export async function runLarkAuthLoginComplete(context, value) {
  const deviceCode = readObjectText(value, "deviceCode", larkGatewayLimits.authValueLength);
  return context.runCli(context, ["auth", "login", "--json", "--device-code", deviceCode]);
}

export async function listLarkRawMirrorPage(context, searchParams) {
  const remoteScopeId = readRemoteScopeId(searchParams);
  const pageSize = readMirrorPageSize(searchParams);
  const cursor = readMirrorCursor(searchParams);
  const allResources = await listLarkRawMirrorResources(context, remoteScopeId);
  const start = cursor ? Number(cursor) : 0;
  const end = Math.min(start + pageSize, allResources.length);

  return {
    resources: allResources.slice(start, end),
    ...(end < allResources.length ? { nextCursor: String(end) } : {})
  };
}

export async function listLarkRawMirrorResources(context, remoteScopeId) {
  const resources = [];
  const seenFolders = new Set();

  await visitLarkDriveFolder(context, {
    folderToken: remoteScopeId,
    relativePrefix: "",
    resources,
    seenFolders
  });

  return dedupeLarkRawMirrorResources(resources)
    .sort((first, second) => first.relativePath.localeCompare(second.relativePath));
}

export async function uploadLarkRawMirrorFile(context, searchParams, value) {
  const remoteScopeId = readRemoteScopeId(searchParams);
  const relativePath = readMirrorPath(searchParams);
  const payload = readRawMirrorUploadPayload(value, relativePath, context.maxFileBytes);
  const pathParts = splitMirrorPath(relativePath);

  if (payload.resource.kind === "directory") {
    const remoteId = await ensureLarkDriveFolderPath(context, remoteScopeId, pathParts);

    return {
      ok: true,
      remoteId
    };
  }

  const fileName = pathParts[pathParts.length - 1];
  const parentPath = pathParts.slice(0, -1);
  const parentToken = await ensureLarkDriveFolderPath(context, remoteScopeId, parentPath);
  const requestedRemoteId = searchParams.get("remoteId");
  const existingRemoteId = requestedRemoteId || await findLarkDriveChildToken(
    context,
    parentToken,
    fileName,
    "file"
  );

  const tempDirectory = await mkdtemp(join(tmpdir(), "typora-plus-lark-upload-"));
  const tempFile = join(tempDirectory, fileName);

  try {
    await writeFile(tempFile, Buffer.from(payload.content.value, "base64"));
    const uploadArgs = [
      "drive",
      "+upload",
      "--file",
      fileName,
      "--name",
      fileName
    ];
    const { uploaded, remoteId: uploadRemoteId } = await uploadLarkDriveFileWithFallback(context, {
      existingRemoteId,
      fileName,
      parentToken,
      requestedRemoteId,
      uploadArgs,
      cwd: tempDirectory
    });
    const remoteId = readUploadedTokenProperty(uploaded).remoteId ?? uploadRemoteId;

    return {
      ok: true,
      ...(remoteId ? { remoteId } : {})
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

async function uploadLarkDriveFileWithFallback(context, options) {
  try {
    return {
      uploaded: await uploadLarkDriveFile(context, options),
      remoteId: options.existingRemoteId
    };
  } catch (error) {
    if (!options.requestedRemoteId) {
      throw error;
    }

    const currentRemoteId = await findLarkDriveChildToken(context, options.parentToken, options.fileName, "file");

    if (currentRemoteId && currentRemoteId !== options.requestedRemoteId) {
      return {
        uploaded: await uploadLarkDriveFile(context, {
          ...options,
          existingRemoteId: currentRemoteId
        }),
        remoteId: currentRemoteId
      };
    }

    if (!currentRemoteId) {
      return {
        uploaded: await uploadLarkDriveFile(context, {
          ...options,
          existingRemoteId: undefined
        }),
        remoteId: undefined
      };
    }

    throw error;
  }
}

async function uploadLarkDriveFile(context, options) {
  return context.runCli(
    context,
    appendIdentityArgs(context, appendLarkDriveUploadTargetArg(options.uploadArgs, {
      existingRemoteId: options.existingRemoteId,
      parentToken: options.parentToken
    }), false),
    { cwd: options.cwd }
  );
}

export async function downloadLarkRawMirrorFile(context, searchParams) {
  const relativePath = readMirrorPath(searchParams);
  const remoteId = readRequiredSearchText(searchParams, "remoteId", larkGatewayLimits.authValueLength);
  const tempDirectory = await mkdtemp(join(tmpdir(), "typora-plus-lark-download-"));
  const tempFile = join(tempDirectory, basename(relativePath));

  try {
    await context.runCli(context, appendIdentityArgs(context, [
      "drive",
      "+download",
      "--file-token",
      remoteId,
      "--output",
      basename(relativePath),
      "--overwrite"
    ], false), { cwd: tempDirectory });

    const content = await readFile(tempFile);

    return {
      relativePath,
      value: content.toString("base64"),
      encoding: "base64",
      size: content.byteLength
    };
  } finally {
    await rm(tempDirectory, { recursive: true, force: true });
  }
}

export async function deleteLarkRawMirrorFile(context, searchParams) {
  const remoteScopeId = readRemoteScopeId(searchParams);
  const relativePath = readMirrorPath(searchParams);
  const remoteId = searchParams.get("remoteId") || await findLarkDriveTokenByPath(context, remoteScopeId, relativePath);

  if (!remoteId) {
    return { ok: true, skipped: true };
  }

  await deleteLarkDriveFileToken(context, remoteId, "file");
  return { ok: true };
}

export async function listLarkDriveFolders(context, searchParams) {
  const parentToken = readRemoteScopeId(searchParams);
  const entries = await listLarkDriveFolderEntries(context, parentToken);
  const folders = entries.flatMap((entry) => {
    const name = readLarkDriveEntryName(entry);
    const token = readLarkDriveEntryToken(entry);

    if (!name || !token || !isSafeDrivePathSegment(name) || classifyLarkDriveEntryKind(entry) !== "folder") {
      return [];
    }

    return [{
      name,
      token,
      ...readLarkDriveEntryUrlProperty(entry)
    }];
  });

  return {
    ok: true,
    folders
  };
}

export async function createLarkDriveFolder(context, value) {
  const name = normalizeLarkDriveFolderName(readObjectText(value, "name", larkGatewayLimits.driveNameBytes));
  const parentToken = readOptionalObjectText(value, "parentToken", larkGatewayLimits.authValueLength) ??
    readOptionalObjectText(value, "remoteScopeId", larkGatewayLimits.authValueLength) ??
    "";
  const created = await context.runCli(context, appendIdentityArgs(context, [
    "drive",
    "files",
    "create_folder",
    "--data",
    JSON.stringify(createLarkDriveFolderData(parentToken, name))
  ]));
  const token = readCreatedFolderToken(created);

  return {
    ok: true,
    name,
    token
  };
}

export async function ensureLarkDriveFolderPath(context, rootToken, pathParts) {
  let currentToken = rootToken;

  for (const name of pathParts) {
    const existingToken = await findLarkDriveChildToken(context, currentToken, name, "folder");

    if (existingToken) {
      currentToken = existingToken;
      continue;
    }

    const created = await context.runCli(context, appendIdentityArgs(context, [
      "drive",
      "files",
      "create_folder",
      "--data",
      JSON.stringify(createLarkDriveFolderData(currentToken, name))
    ]));
    currentToken = readCreatedFolderToken(created);
  }

  return currentToken;
}

export async function findLarkDriveTokenByPath(context, rootToken, relativePath) {
  const pathParts = splitMirrorPath(relativePath);
  let currentToken = rootToken;

  for (const [index, name] of pathParts.entries()) {
    const expectedKind = index === pathParts.length - 1 ? "file" : "folder";
    const token = await findLarkDriveChildToken(context, currentToken, name, expectedKind);

    if (!token) {
      return undefined;
    }

    currentToken = token;
  }

  return currentToken;
}

export async function findLarkDriveChildToken(context, folderToken, name, expectedKind) {
  const entries = await listLarkDriveFolderEntries(context, folderToken);
  const child = entries.find((entry) =>
    entry.name === name && classifyLarkDriveEntryKind(entry) === expectedKind
  );

  return readLarkDriveEntryToken(child);
}

async function visitLarkDriveFolder(context, state) {
  if (state.seenFolders.size > larkGatewayLimits.maxListEntries) {
    throw new Error("Lark raw mirror list is too large");
  }

  if (state.seenFolders.has(state.folderToken)) {
    return;
  }

  state.seenFolders.add(state.folderToken);

  if (state.relativePrefix.split("/").filter(Boolean).length > larkGatewayLimits.maxTraversalDepth) {
    throw new Error("Lark raw mirror folder depth is too large");
  }

  const entries = await listLarkDriveFolderEntries(context, state.folderToken);

  for (const entry of entries) {
    const name = readLarkDriveEntryName(entry);

    if (!name || !isSafeDrivePathSegment(name)) {
      continue;
    }

    const kind = classifyLarkDriveEntryKind(entry);
    const relativePath = state.relativePrefix ? `${state.relativePrefix}/${name}` : name;

    if (kind === "folder") {
      const childToken = readLarkDriveEntryToken(entry);

      if (childToken) {
        state.resources.push({
          relativePath,
          kind: "directory",
          remoteId: childToken
        });
        await visitLarkDriveFolder(context, {
          ...state,
          folderToken: childToken,
          relativePrefix: relativePath
        });
      }
      continue;
    }

    if (kind !== "file") {
      continue;
    }

    const remoteId = readLarkDriveEntryToken(entry);

    if (!remoteId) {
      continue;
    }

    state.resources.push({
      relativePath,
      kind: "file",
      remoteId,
      ...readLarkDriveSizeProperty(entry),
      ...readLarkDriveModifiedTimeProperty(entry)
    });
  }
}

function dedupeLarkRawMirrorResources(resources) {
  const byPath = new Map();

  for (const resource of resources) {
    const previous = byPath.get(resource.relativePath);

    if (!previous || compareLarkRawMirrorResourcePreference(resource, previous) > 0) {
      byPath.set(resource.relativePath, resource);
    }
  }

  return [...byPath.values()];
}

function compareLarkRawMirrorResourcePreference(candidate, current) {
  const candidateMtime = typeof candidate.mtime === "number" ? candidate.mtime : -1;
  const currentMtime = typeof current.mtime === "number" ? current.mtime : -1;

  if (candidateMtime !== currentMtime) {
    return candidateMtime - currentMtime;
  }

  const candidateSize = typeof candidate.size === "number" ? candidate.size : -1;
  const currentSize = typeof current.size === "number" ? current.size : -1;

  if (candidateSize !== currentSize) {
    return candidateSize - currentSize;
  }

  const candidateId = typeof candidate.remoteId === "string" ? candidate.remoteId : "";
  const currentId = typeof current.remoteId === "string" ? current.remoteId : "";

  return candidateId.localeCompare(currentId);
}

async function listLarkDriveFolderEntries(context, folderToken) {
  const entries = [];
  let nextPageToken;

  do {
    const params = {
      [pageSizeParameter]: larkGatewayLimits.pageSize,
      ...(folderToken ? { [folderTokenParameter]: folderToken } : {}),
      ...(nextPageToken ? { [pageTokenParameter]: nextPageToken } : {})
    };
    const response = await context.runCli(context, appendIdentityArgs(context, [
      "drive",
      "files",
      "list",
      "--format",
      "json",
      "--params",
      JSON.stringify(params)
    ]));
    const page = readLarkDriveListPage(response);
    entries.push(...page.files);

    if (entries.length > larkGatewayLimits.maxListEntries) {
      throw new Error("Lark raw mirror list is too large");
    }

    nextPageToken = page.nextPageToken;
  } while (nextPageToken);

  return entries;
}

function createLarkDriveFolderData(parentToken, name) {
  return {
    [folderTokenParameter]: parentToken ?? "",
    name
  };
}

function appendOptionalFolderTokenArg(args, folderToken) {
  return folderToken ? [...args, "--folder-token", folderToken] : args;
}

function appendLarkDriveUploadTargetArg(args, { existingRemoteId, parentToken }) {
  if (existingRemoteId) {
    return [...args, "--file-token", existingRemoteId];
  }

  return appendOptionalFolderTokenArg(args, parentToken);
}

async function deleteLarkDriveFileToken(context, fileToken, type) {
  await context.runCli(context, appendIdentityArgs(context, [
    "drive",
    "+delete",
    "--file-token",
    fileToken,
    "--type",
    type,
    "--yes"
  ], false));
}

export async function runLarkCliJson(context, args, options = {}) {
  const output = await runSpawnedLarkCli(context, args, options);

  if (options.parseJson === false) {
    return {
      ok: true,
      output: output.stdout.trim()
    };
  }

  return parseLarkCliJsonOutput(output.stdout);
}

export async function runSpawnedLarkCli(context, args, options = {}) {
  const fullArgs = [
    ...(context.profile ? ["--profile", context.profile] : []),
    ...args
  ];
  const spawnInvocation = createLarkCliSpawnInvocation(context.cliCommand, fullArgs);

  return new Promise((resolve, reject) => {
    const child = spawn(spawnInvocation.command, spawnInvocation.args, {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      ...spawnInvocation.options,
      windowsHide: true
    });
    const stdout = [];
    const stderr = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;

    child.stdout?.on("data", (chunk) => {
      stdoutBytes += chunk.byteLength;
      if (stdoutBytes <= larkGatewayLimits.cliOutputBytes) {
        stdout.push(chunk);
      }
    });
    child.stderr?.on("data", (chunk) => {
      stderrBytes += chunk.byteLength;
      if (stderrBytes <= larkGatewayLimits.cliOutputBytes) {
        stderr.push(chunk);
      }
    });
    child.once("error", reject);
    child.once("close", (code) => {
      const stdoutText = Buffer.concat(stdout).toString("utf8");
      const stderrText = Buffer.concat(stderr).toString("utf8");

      if (code === 0) {
        resolve({ stdout: stdoutText, stderr: stderrText });
        return;
      }

      reject(new Error(readCliErrorMessage(stdoutText, stderrText)));
    });
  });
}

export function createLarkCliSpawnInvocation(cliCommand, args, platform = process.platform) {
  if (platform === "win32" && cliCommand.toLowerCase().endsWith(".js")) {
    return {
      command: resolveDefaultNodeCommand(platform, process.env, process.execPath),
      args: [cliCommand, ...args],
      options: {}
    };
  }

  if (platform === "win32" && /\.(?:cmd|bat)$/i.test(cliCommand)) {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", quoteWindowsCommandPath(cliCommand), ...args],
      options: {}
    };
  }

  return {
    command: cliCommand,
    args,
    options: {}
  };
}

export function resolveDefaultNodeCommand(platform = process.platform, environment = process.env, executablePath = process.execPath) {
  const configured = readOptionalEnvironmentText(environment, "TYPORA_PLUS_NODE_PATH");

  if (configured) {
    return configured;
  }

  if (platform === "win32") {
    return /(?:^|[\\/])node(?:\.exe)?$/i.test(executablePath) ? executablePath : "node.exe";
  }

  return /(?:^|\/)node$/i.test(executablePath) ? executablePath : "node";
}

function quoteWindowsCommandPath(value) {
  return value.includes(" ") || value.includes("&") || value.includes("(") || value.includes(")")
    ? `"${value.replaceAll("\"", "\\\"")}"`
    : value;
}

export function parseLarkCliJsonOutput(stdout) {
  const jsonText = extractFirstJsonValue(stdout.trim());

  if (!jsonText) {
    throw new Error("Lark CLI did not return JSON");
  }

  const parsed = JSON.parse(jsonText);

  if (isRecord(parsed) && parsed.ok === false) {
    throw new Error(readLarkCliFailureMessage(parsed));
  }

  return parsed;
}

function readLarkDriveListPage(value) {
  const data = readResponseData(value);
  const files = Array.isArray(data.files)
    ? data.files
    : Array.isArray(data.items)
      ? data.items
      : [];
  const nextPageToken = typeof data.next_page_token === "string" && data.next_page_token.trim()
    ? data.next_page_token.trim()
    : undefined;
  const hasMore = data.has_more === true || !!nextPageToken;

  return {
    files: files.filter(isRecord),
    ...(hasMore && nextPageToken ? { nextPageToken } : {})
  };
}

function readResponseData(value) {
  if (!isRecord(value)) {
    return {};
  }

  if (isRecord(value.data)) {
    return value.data;
  }

  return value;
}

function readUploadedTokenProperty(value) {
  const data = readResponseData(value);
  const token = readOptionalResponseToken(data);

  return token ? { remoteId: token } : {};
}

function readCreatedFolderToken(value) {
  const data = readResponseData(value);
  const token = readOptionalResponseToken(data);

  if (!token) {
    throw new Error("Lark CLI did not return a created folder token");
  }

  return token;
}

function readOptionalResponseToken(value) {
  if (!isRecord(value)) {
    return undefined;
  }

  for (const key of ["token", "fileToken", "file_token"]) {
    const candidate = value[key];

    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  if (isRecord(value.file)) {
    return readOptionalResponseToken(value.file);
  }

  return undefined;
}

function classifyLarkDriveEntryKind(entry) {
  const type = typeof entry?.type === "string" ? entry.type.toLowerCase() : "";
  return type === "folder" ? "folder" : type === "file" ? "file" : "other";
}

function readLarkDriveEntryName(entry) {
  return typeof entry?.name === "string" ? entry.name.trim() : undefined;
}

function readLarkDriveEntryToken(entry) {
  return typeof entry?.token === "string" && entry.token.trim() ? entry.token.trim() : undefined;
}

function readLarkDriveEntryUrlProperty(entry) {
  const url = typeof entry?.url === "string" && entry.url.trim()
    ? entry.url.trim()
    : typeof entry?.link === "string" && entry.link.trim()
      ? entry.link.trim()
      : undefined;

  return url ? { url } : {};
}

function readLarkDriveModifiedTimeProperty(entry) {
  const raw = entry?.modified_time;

  if (typeof raw !== "string" && typeof raw !== "number") {
    return {};
  }

  const seconds = Number(raw);

  return Number.isFinite(seconds) && seconds >= 0
    ? { mtime: seconds * 1000 }
    : {};
}

function readLarkDriveSizeProperty(entry) {
  const raw = entry?.size ?? entry?.file_size ?? entry?.file_size_bytes;

  if (typeof raw !== "string" && typeof raw !== "number") {
    return {};
  }

  const size = Number(raw);

  return Number.isFinite(size) && size >= 0
    ? { size }
    : {};
}

function readRawMirrorUploadPayload(value, relativePath, maxFileBytes) {
  if (!isRecord(value)) {
    throw new Error("Raw mirror upload payload is invalid");
  }

  if (value.operation !== undefined && isRecord(value.operation)) {
    const operationPath = readObjectText(value.operation, "relativePath", larkGatewayLimits.maxPathLength);

    if (operationPath !== relativePath) {
      throw new Error("Raw mirror upload operation path does not match the request path");
    }
  }

  const resourceKind = value.resource !== undefined && isRecord(value.resource)
    ? readRawMirrorResourceKind(value.resource.kind)
    : "file";

  if (value.resource !== undefined && isRecord(value.resource)) {
    const resourcePath = readObjectText(value.resource, "relativePath", larkGatewayLimits.maxPathLength);

    if (resourcePath !== relativePath) {
      throw new Error("Raw mirror upload resource path does not match the request path");
    }
  }

  if (resourceKind === "directory") {
    return {
      resource: {
        kind: "directory"
      }
    };
  }

  if (!isRecord(value.content)) {
    throw new Error("Raw mirror upload payload is invalid");
  }

  const content = value.content;
  const encoding = readObjectText(content, "encoding", 16);
  const encodedValue = readObjectText(content, "value", Math.ceil(maxFileBytes * 4 / 3) + 4);

  if (encoding !== "base64" || !isBase64Value(encodedValue)) {
    throw new Error("Raw mirror upload content must be base64");
  }

  const bytes = Buffer.byteLength(encodedValue, "base64");

  if (bytes > maxFileBytes) {
    throw new Error("Raw mirror upload content is too large");
  }

  return {
    resource: {
      kind: "file"
    },
    content: {
      value: encodedValue,
      encoding
    }
  };
}

function readRawMirrorResourceKind(value) {
  if (value === undefined) {
    return "file";
  }

  if (value !== "file" && value !== "directory") {
    throw new Error("Raw mirror upload resource kind is invalid");
  }

  return value;
}

function readRemoteScopeId(searchParams) {
  const value = searchParams.get("remoteScopeId");

  if (value === null) {
    return "";
  }

  const normalized = value.trim();

  if (normalized.length > larkGatewayLimits.authValueLength) {
    throw new Error("Raw mirror remoteScopeId is invalid");
  }

  return normalized;
}

function readMirrorPath(searchParams) {
  return normalizeMirrorPath(readRequiredSearchText(searchParams, "path", larkGatewayLimits.maxPathLength));
}

function readMirrorPageSize(searchParams) {
  const rawValue = searchParams.get("pageSize");

  if (!rawValue) {
    return 1000;
  }

  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 1 || value > 1000) {
    throw new Error("Raw mirror page size is invalid");
  }

  return value;
}

function readMirrorCursor(searchParams) {
  const cursor = searchParams.get("cursor");

  if (!cursor) {
    return undefined;
  }

  if (!/^[0-9]+$/.test(cursor)) {
    throw new Error("Raw mirror cursor is invalid");
  }

  return cursor;
}

function readRequiredSearchText(searchParams, key, maxLength) {
  const value = searchParams.get(key)?.trim();

  if (!value || value.length > maxLength) {
    throw new Error(`Raw mirror ${key} is invalid`);
  }

  return value;
}

export function normalizeMirrorPath(value) {
  const normalized = value.trim().replaceAll("\\", "/");

  if (
    !normalized ||
    normalized.length > larkGatewayLimits.maxPathLength ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    throw new Error("Raw mirror path must be workspace-relative");
  }

  const parts = normalized.split("/").filter((part) => part.length > 0 && part !== ".");

  if (parts.some((part) => part === ".." || decodeSafe(part) === "..")) {
    throw new Error("Raw mirror path must not contain parent traversal");
  }

  for (const part of parts) {
    if (!isSafeDrivePathSegment(part)) {
      throw new Error("Raw mirror path contains an invalid drive segment");
    }
  }

  return parts.join("/");
}

function splitMirrorPath(value) {
  return normalizeMirrorPath(value).split("/");
}

function isSafeDrivePathSegment(value) {
  return value.length > 0 &&
    Buffer.byteLength(value, "utf8") <= larkGatewayLimits.driveNameBytes &&
    value !== "." &&
    value !== ".." &&
    !/[\\/\0-\x1f\x7f]/.test(value);
}

function normalizeLarkDriveFolderName(value) {
  if (!isSafeDrivePathSegment(value)) {
    throw new Error("Lark Drive folder name is invalid");
  }

  return value;
}

function decodeSafe(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

async function readJsonRequestBody(request) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    totalBytes += chunk.byteLength;

    if (totalBytes > larkGatewayLimits.maxRequestBodyBytes) {
      throw new Error("Request body is too large");
    }

    chunks.push(chunk);
  }

  const text = Buffer.concat(chunks).toString("utf8");

  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Request body must be JSON");
  }
}

function requireSharedSecret(context, request) {
  if (!context.sharedSecret) {
    return;
  }

  const authorization = request.headers.authorization ?? "";
  const expected = `Bearer ${context.sharedSecret}`;

  if (authorization !== expected) {
    throw new Error("Lark raw mirror gateway authorization failed");
  }
}

function appendIdentityArgs(context, args, allowAuto = true) {
  if (!context.identity || (context.identity === "auto" && !allowAuto)) {
    return args;
  }

  return [...args, "--as", context.identity];
}

function writeJsonResponse(response, status, body) {
  const value = JSON.stringify(body);
  response.statusCode = status;
  writeCorsHeaders(response);
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Content-Length", Buffer.byteLength(value, "utf8"));
  response.end(value);
}

function writeCorsPreflightResponse(response) {
  response.statusCode = 204;
  writeCorsHeaders(response);
  response.setHeader("Content-Length", "0");
  response.end();
}

function writeCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "DELETE, GET, OPTIONS, POST, PUT");
  response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  response.setHeader("Access-Control-Max-Age", "600");
}

function extractFirstJsonValue(text) {
  const start = text.search(/[\[{]/);

  if (start < 0) {
    return undefined;
  }

  const open = text[start];
  const close = open === "{" ? "}" : "]";
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === "\"") {
        inString = false;
      }
      continue;
    }

    if (char === "\"") {
      inString = true;
      continue;
    }

    if (char === open) {
      depth += 1;
    } else if (char === close) {
      depth -= 1;

      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return undefined;
}

function readCliErrorMessage(stdout, stderr) {
  try {
    const parsed = parseLarkCliJsonOutput(stdout);
    return readLarkCliFailureMessage(parsed);
  } catch {
    const output = `${stderr}\n${stdout}`.trim();
    return output ? sanitizeErrorMessage(output) : "Lark CLI command failed";
  }
}

function readLarkCliFailureMessage(value) {
  if (isRecord(value) && isRecord(value.error) && typeof value.error.message === "string") {
    return sanitizeErrorMessage(value.error.message);
  }

  return "Lark CLI command failed";
}

function sanitizeErrorMessage(value) {
  const message = value instanceof Error ? value.message : String(value);
  return message.replace(/[A-Za-z0-9._~+/-]{48,}={0,2}/g, "[redacted]");
}

function readObjectText(value, key, maxLength) {
  if (!isRecord(value) || typeof value[key] !== "string") {
    throw new Error(`${key} is invalid`);
  }

  const normalized = value[key].trim();

  if (!normalized || normalized.length > maxLength) {
    throw new Error(`${key} is invalid`);
  }

  return normalized;
}

function readOptionalObjectText(value, key, maxLength) {
  if (!isRecord(value) || typeof value[key] !== "string") {
    return undefined;
  }

  const normalized = value[key].trim();

  if (normalized.length > maxLength) {
    throw new Error(`${key} is invalid`);
  }

  return normalized;
}

function readOptionalEnvironmentText(environment, key) {
  return readOptionalBoundedText(environment[key], larkGatewayLimits.authValueLength);
}

function readOptionalBoundedText(value, maxLength) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  return normalized && normalized.length <= maxLength ? normalized : undefined;
}

function readOptionalPort(value) {
  const parsed = readOptionalPositiveInteger(value);
  return parsed && parsed <= 65535 ? parsed : undefined;
}

function readOptionalPositiveInteger(value) {
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function readOptionalIdentity(value) {
  const normalized = readOptionalBoundedText(value, 16);

  if (normalized === "user" || normalized === "bot" || normalized === "auto") {
    return normalized;
  }

  return undefined;
}

function isBase64Value(value) {
  return /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pathWithoutLeadingSlash(value) {
  return value.replace(/^\/+/, "");
}

async function runProfileCli() {
  const context = readLarkGatewayEnvironment();
  const url = `http://${context.host}:${context.port}/`;
  const profile = createLarkRawMirrorProviderProfile({
    baseUrl: url,
    providerId: process.env.TYPORA_PLUS_LARK_PROFILE_PROVIDER_ID ?? "lark.raw-mirror",
    providerTitle: process.env.TYPORA_PLUS_LARK_PROFILE_PROVIDER_TITLE ?? "Lark Raw Mirror",
    remoteScopeId: process.env.TYPORA_PLUS_LARK_PROFILE_REMOTE_SCOPE_ID,
    secretName: process.env.TYPORA_PLUS_LARK_PROFILE_SECRET_NAME,
    secretRef: process.env.TYPORA_PLUS_LARK_PROFILE_SECRET_REF
  });

  process.stdout.write(`${JSON.stringify(profile, null, 2)}\n`);
}

async function runServeCli() {
  const { server, url } = await startLarkRawMirrorGateway();
  process.stdout.write(`Lark raw mirror gateway listening at ${url}\n`);
  process.stdout.write("Use /auth/login/start, /auth/login/complete, and /mirror/* routes.\n");

  const stop = () => {
    server.close();
  };

  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

async function runCli() {
  const command = process.argv[2] ?? "serve";

  if (command === "profile") {
    await runProfileCli();
    return;
  }

  if (command === "serve") {
    await runServeCli();
    return;
  }

  throw new Error(`Unknown lark raw mirror gateway command: ${command}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCli().catch((error) => {
    process.stderr.write(`${sanitizeErrorMessage(error)}\n`);
    process.exitCode = 1;
  });
}
