import type { RemoteSyncProviderConfiguration } from "./configuration";
import type {
  RemoteSyncOperation,
  RemoteSyncProgress,
  RemoteSyncRemoteResource,
  RemoteSyncResource
} from "./remoteSync";
import {
  createDefaultRemoteSyncManifestStorage,
  RemoteSyncManifestStore,
  type RemoteSyncManifestStorage
} from "./remoteSync";
import type { RemoteSyncConfiguredProviderFactory } from "./remoteSyncConfiguredProviders";
import type { RemoteSyncNativeResponse } from "./remoteSyncNativeRequest";
import type { RemoteSyncProfileRequestInput, RemoteSyncProfileRequestTransport } from "./remoteSyncProfileRequest";
import {
  createRemoteSyncRawMirrorProvider,
  type RemoteSyncRawMirrorExecuteRequest,
  type RemoteSyncRawMirrorListRequest
} from "./remoteSyncRawMirrorProvider";
import {
  applyRemoteSyncRawMirrorLocalResourceChanges,
  createRemoteSyncRawMirrorExecutedLocalResources,
  readRemoteSyncRawMirrorUploadFileContents,
  type RemoteSyncRawMirrorLocalFileContent,
  type RemoteSyncRawMirrorUploadFileContent
} from "./remoteSyncRawMirrorWorkspaceResources";
import type { IRemoteSyncWorkspaceResourceService } from "./remoteSyncWorkspaceResources";

export const remoteSyncConfiguredRawMirrorAdapterName = "raw-mirror";

export const remoteSyncConfiguredRawMirrorMetadataKeys = {
  adapter: "rawMirror.adapter",
  listPath: "rawMirror.listPath",
  listPageSize: "rawMirror.listPageSize",
  deleteMissing: "rawMirror.deleteMissing",
  uploadPath: "rawMirror.uploadPath",
  downloadPath: "rawMirror.downloadPath",
  deletePath: "rawMirror.deletePath",
  headerBinding: "rawMirror.headerBinding",
  headerName: "rawMirror.headerName",
  headerScheme: "rawMirror.headerScheme",
  retryDelayMs: "rawMirror.retryDelayMs",
  retryMaxRetries: "rawMirror.retryMaxRetries",
  retryStatusCodes: "rawMirror.retryStatusCodes"
} as const;

export const remoteSyncConfiguredRawMirrorRetryLimits = {
  defaultDelayMs: 250,
  defaultMaxRetries: 2,
  maxDelayMs: 30_000,
  maxRetries: 5,
  maxStatusCodes: 16
} as const;

export const remoteSyncConfiguredRawMirrorListLimits = {
  maxCursorLength: 1024,
  maxPages: 200,
  maxPageSize: 1000,
  maxResources: 20_000,
  minPageSize: 1
} as const;

export const remoteSyncConfiguredRawMirrorMetadataIssueCodes = {
  incompleteHeader: "incomplete-header",
  incompleteRetry: "incomplete-retry",
  invalidHeaderName: "invalid-header-name",
  invalidHeaderScheme: "invalid-header-scheme",
  invalidDeleteMissing: "invalid-delete-missing",
  invalidListPageSize: "invalid-list-page-size",
  invalidPath: "invalid-path",
  invalidRetryDelayMs: "invalid-retry-delay-ms",
  invalidRetryMaxRetries: "invalid-retry-max-retries",
  invalidRetryStatusCodes: "invalid-retry-status-codes",
  missingPath: "missing-path",
  unboundHeader: "unbound-header"
} as const;

export type RemoteSyncConfiguredRawMirrorMetadataIssueCode =
  typeof remoteSyncConfiguredRawMirrorMetadataIssueCodes[
    keyof typeof remoteSyncConfiguredRawMirrorMetadataIssueCodes
  ];

export type RemoteSyncConfiguredRawMirrorMetadataKey =
  typeof remoteSyncConfiguredRawMirrorMetadataKeys[keyof typeof remoteSyncConfiguredRawMirrorMetadataKeys];

export interface RemoteSyncConfiguredRawMirrorMetadataIssue {
  readonly code: RemoteSyncConfiguredRawMirrorMetadataIssueCode;
  readonly key?: RemoteSyncConfiguredRawMirrorMetadataKey;
}

export interface RemoteSyncConfiguredRawMirrorProviderFactoryOptions {
  readonly manifestStorage?: RemoteSyncManifestStorage;
}

interface RemoteSyncConfiguredRawMirrorProfile {
  readonly listPath: string;
  readonly listPageSize?: number;
  readonly deleteMissing?: boolean;
  readonly uploadPath: string;
  readonly downloadPath: string;
  readonly deletePath: string;
  readonly secretHeader?: {
    readonly name: string;
    readonly secretName: string;
    readonly prefix?: string;
  };
  readonly retry?: {
    readonly delayMs: number;
    readonly maxRetries: number;
    readonly statusCodes: readonly number[];
  };
}

interface RemoteSyncConfiguredRawMirrorRequestContext {
  readonly profile: RemoteSyncProviderConfiguration;
  readonly request: RemoteSyncProfileRequestTransport;
  readonly rawMirror: RemoteSyncConfiguredRawMirrorProfile;
}

interface RemoteSyncConfiguredRawMirrorRequestProgressContext {
  readonly onProgress?: (progress: RemoteSyncProgress) => void;
  readonly operation?: RemoteSyncOperation;
  readonly retryMessage: string;
}

const configuredRawMirrorLimits = {
  maxBodyBytes: 8 * 1024 * 1024,
  maxPathLength: 512
} as const;

const configuredRawMirrorPathMetadataKeys = [
  remoteSyncConfiguredRawMirrorMetadataKeys.listPath,
  remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath,
  remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath,
  remoteSyncConfiguredRawMirrorMetadataKeys.deletePath
] as const satisfies readonly RemoteSyncConfiguredRawMirrorMetadataKey[];

export function createRemoteSyncConfiguredRawMirrorProviderFactory(
  options: RemoteSyncConfiguredRawMirrorProviderFactoryOptions = {}
): RemoteSyncConfiguredProviderFactory {
  return ({ profile, request, workspaceResources }) => {
    const rawMirror = readConfiguredRawMirrorProfile(profile);
    const manifestStorage = options.manifestStorage ?? createDefaultRemoteSyncManifestStorage();

    if (!rawMirror || !manifestStorage || !workspaceResources) {
      return undefined;
    }

    const context = {
      profile,
      request,
      rawMirror
    };

    return createRemoteSyncRawMirrorProvider({
      id: profile.id,
      title: profile.title,
      deleteMissing: rawMirror.deleteMissing === true,
      manifestStore: new RemoteSyncManifestStore({ storage: manifestStorage }),
      adapter: {
        listResources: (listRequest) => listConfiguredRawMirrorResources(context, listRequest),
        executeOperations: async (executeRequest) => executeConfiguredRawMirrorOperations(
          context,
          workspaceResources,
          executeRequest
        )
      }
    });
  };
}

export function diagnoseRemoteSyncConfiguredRawMirrorMetadata(
  profile: RemoteSyncProviderConfiguration
): readonly RemoteSyncConfiguredRawMirrorMetadataIssue[] {
  const metadata = profile.metadata ?? {};

  if (metadata[remoteSyncConfiguredRawMirrorMetadataKeys.adapter] !== remoteSyncConfiguredRawMirrorAdapterName) {
    return [];
  }

  const issues: RemoteSyncConfiguredRawMirrorMetadataIssue[] = [];

  for (const key of configuredRawMirrorPathMetadataKeys) {
    const issue = diagnoseConfiguredRawMirrorMetadataPath(metadata, key);

    if (issue) {
      issues.push(issue);
    }
  }

  const headerIssue = diagnoseConfiguredRawMirrorSecretHeaderMetadata(profile, metadata);

  if (headerIssue) {
    issues.push(headerIssue);
  }

  const listIssue = diagnoseConfiguredRawMirrorListMetadata(metadata);

  if (listIssue) {
    issues.push(listIssue);
  }

  const deleteIssue = diagnoseConfiguredRawMirrorDeleteMetadata(metadata);

  if (deleteIssue) {
    issues.push(deleteIssue);
  }

  const retryIssue = diagnoseConfiguredRawMirrorRetryMetadata(metadata);

  if (retryIssue) {
    issues.push(retryIssue);
  }

  return issues;
}

async function listConfiguredRawMirrorResources(
  context: RemoteSyncConfiguredRawMirrorRequestContext,
  listRequest: RemoteSyncRawMirrorListRequest
): Promise<readonly RemoteSyncRemoteResource[]> {
  const resources: RemoteSyncRemoteResource[] = [];
  const seenCursors = new Set<string>();
  let cursor: string | undefined;

  for (let pageIndex = 0; pageIndex < remoteSyncConfiguredRawMirrorListLimits.maxPages; pageIndex += 1) {
    throwIfConfiguredRawMirrorAborted(listRequest.signal);

    if (cursor !== undefined) {
      if (seenCursors.has(cursor)) {
        throw new Error("Configured raw mirror resource list response repeated a cursor");
      }

      seenCursors.add(cursor);
    }

    const response = await requestConfiguredRawMirror(
      context,
      {
        path: context.rawMirror.listPath,
        method: "GET",
        query: createConfiguredRawMirrorListQuery(context.profile, context.rawMirror, listRequest.direction, cursor),
        responseType: "json",
        ...createConfiguredRawMirrorSecretRequest(context.rawMirror),
        ...(listRequest.signal !== undefined ? { signal: listRequest.signal } : {})
      },
      {
        ...(listRequest.onProgress !== undefined ? { onProgress: listRequest.onProgress } : {}),
        retryMessage: "Retrying remote sync list request"
      }
    );

    ensureConfiguredRawMirrorResponseOk(response, "list");
    const page = readConfiguredRawMirrorResourceListPage(response.body);
    resources.push(...page.resources);
    reportConfiguredRawMirrorProgress(listRequest, {
      message: "Listed remote sync page",
      completed: pageIndex + 1
    });

    if (resources.length > remoteSyncConfiguredRawMirrorListLimits.maxResources) {
      throw new Error("Configured raw mirror resource list response is too large");
    }

    if (!page.nextCursor) {
      return resources
        .filter((resource) => resource.kind === "file")
        .sort((first, second) => first.relativePath.localeCompare(second.relativePath));
    }

    cursor = page.nextCursor;
  }

  throw new Error("Configured raw mirror resource list response has too many pages");
}

async function executeConfiguredRawMirrorOperations(
  context: RemoteSyncConfiguredRawMirrorRequestContext,
  workspaceResources: Pick<IRemoteSyncWorkspaceResourceService, "deleteResource" | "readResource" | "writeResource">,
  executeRequest: RemoteSyncRawMirrorExecuteRequest
) {
  const uploadContents = await readRemoteSyncRawMirrorUploadFileContents({
    workspaceUri: executeRequest.workspaceUri,
    operations: executeRequest.operations,
    localResources: executeRequest.localResources,
    resourceService: workspaceResources,
    ...(executeRequest.onProgress !== undefined ? { onProgress: executeRequest.onProgress } : {}),
    ...(executeRequest.signal !== undefined ? { signal: executeRequest.signal } : {})
  });
  const uploadedByPath = new Map(uploadContents.map((content) => [content.operation.relativePath, content]));
  const downloadedContents: RemoteSyncRawMirrorLocalFileContent[] = [];

  for (const [operationIndex, operation] of executeRequest.operations.entries()) {
    throwIfConfiguredRawMirrorAborted(executeRequest.signal);

    if (operation.target === "remote") {
      await executeConfiguredRawMirrorRemoteOperation(context, executeRequest, operation, uploadedByPath.get(
        operation.relativePath
      ));
      reportConfiguredRawMirrorOperationProgress(executeRequest, operation, operationIndex + 1);
      continue;
    }

    if (operation.target === "local" && (operation.kind === "create" || operation.kind === "update")) {
      downloadedContents.push(await downloadConfiguredRawMirrorFile(context, executeRequest, operation));
      reportConfiguredRawMirrorOperationProgress(executeRequest, operation, operationIndex + 1);
    }
  }

  const localApplyResults = await applyRemoteSyncRawMirrorLocalResourceChanges({
    workspaceUri: executeRequest.workspaceUri,
    operations: executeRequest.operations,
    localResources: executeRequest.localResources,
    fileContents: downloadedContents,
    resourceService: workspaceResources,
    ...(executeRequest.onProgress !== undefined ? { onProgress: executeRequest.onProgress } : {}),
    ...(executeRequest.signal !== undefined ? { signal: executeRequest.signal } : {})
  });
  const remoteResources = await listConfiguredRawMirrorResources(context, executeRequest);

  return {
    localResources: createRemoteSyncRawMirrorExecutedLocalResources({
      localResources: executeRequest.localResources,
      uploadFileContents: uploadContents,
      localApplyResults
    }),
    remoteResources,
    operations: executeRequest.operations
  };
}

async function executeConfiguredRawMirrorRemoteOperation(
  context: RemoteSyncConfiguredRawMirrorRequestContext,
  executeRequest: RemoteSyncRawMirrorExecuteRequest,
  operation: RemoteSyncOperation,
  uploadContent: RemoteSyncRawMirrorUploadFileContent | undefined
): Promise<void> {
  if (operation.kind === "delete") {
    await requestConfiguredRawMirrorDelete(context, executeRequest, operation);
    return;
  }

  if (operation.kind !== "create" && operation.kind !== "update") {
    return;
  }

  const resource = executeRequest.localResources.find((candidate) => candidate.relativePath === operation.relativePath);

  if (!resource) {
    throw new Error(`Configured raw mirror upload ${operation.relativePath} requires a local resource`);
  }

  if (resource.kind !== "file") {
    throw new Error(`Configured raw mirror upload ${operation.relativePath} only supports files`);
  }

  if (!uploadContent) {
    throw new Error(`Configured raw mirror upload ${operation.relativePath} requires file content`);
  }

  await requestConfiguredRawMirrorUpload(context, executeRequest, operation, resource, uploadContent);
}

async function requestConfiguredRawMirrorUpload(
  context: RemoteSyncConfiguredRawMirrorRequestContext,
  executeRequest: RemoteSyncRawMirrorExecuteRequest,
  operation: RemoteSyncOperation,
  resource: RemoteSyncResource,
  uploadContent: RemoteSyncRawMirrorUploadFileContent
): Promise<void> {
  ensureConfiguredRawMirrorResponseOk(await requestConfiguredRawMirror(
    context,
    {
      path: context.rawMirror.uploadPath,
      method: "PUT",
      query: createConfiguredRawMirrorOperationQuery(context.profile, operation),
      headers: {
        "Content-Type": "application/json"
      },
      body: createConfiguredRawMirrorJsonBody({
        operation: createConfiguredRawMirrorOperationPayload(operation),
        resource: createConfiguredRawMirrorResourcePayload(resource),
        content: {
          value: uploadContent.content.value,
          encoding: uploadContent.content.encoding,
          size: uploadContent.content.size,
          ...(uploadContent.content.mtime !== undefined ? { mtime: uploadContent.content.mtime } : {}),
          ...(uploadContent.content.contentHash !== undefined
            ? { contentHash: uploadContent.content.contentHash }
            : {})
        }
      }),
      bodyEncoding: "utf8",
      responseType: "json",
      ...createConfiguredRawMirrorSecretRequest(context.rawMirror),
      ...(executeRequest.signal !== undefined ? { signal: executeRequest.signal } : {})
    },
    createConfiguredRawMirrorOperationRetryProgressContext(
      executeRequest,
      operation,
      "Retrying remote sync upload request"
    )
  ), "upload");
}

async function requestConfiguredRawMirrorDelete(
  context: RemoteSyncConfiguredRawMirrorRequestContext,
  executeRequest: RemoteSyncRawMirrorExecuteRequest,
  operation: RemoteSyncOperation
): Promise<void> {
  ensureConfiguredRawMirrorResponseOk(await requestConfiguredRawMirror(
    context,
    {
      path: context.rawMirror.deletePath,
      method: "DELETE",
      query: createConfiguredRawMirrorOperationQuery(context.profile, operation),
      responseType: "json",
      ...createConfiguredRawMirrorSecretRequest(context.rawMirror),
      ...(executeRequest.signal !== undefined ? { signal: executeRequest.signal } : {})
    },
    createConfiguredRawMirrorOperationRetryProgressContext(
      executeRequest,
      operation,
      "Retrying remote sync delete request"
    )
  ), "delete");
}

async function downloadConfiguredRawMirrorFile(
  context: RemoteSyncConfiguredRawMirrorRequestContext,
  executeRequest: RemoteSyncRawMirrorExecuteRequest,
  operation: RemoteSyncOperation
): Promise<RemoteSyncRawMirrorLocalFileContent> {
  const remoteResource = executeRequest.remoteResources.find((resource) =>
    resource.relativePath === operation.relativePath
  );

  if (!remoteResource) {
    throw new Error(`Configured raw mirror download ${operation.relativePath} requires a remote resource`);
  }

  if (remoteResource.kind !== "file") {
    throw new Error(`Configured raw mirror download ${operation.relativePath} only supports files`);
  }

  const response = await requestConfiguredRawMirror(
    context,
    {
      path: context.rawMirror.downloadPath,
      method: "GET",
      query: createConfiguredRawMirrorOperationQuery(context.profile, operation),
      responseType: "json",
      ...createConfiguredRawMirrorSecretRequest(context.rawMirror),
      ...(executeRequest.signal !== undefined ? { signal: executeRequest.signal } : {})
    },
    createConfiguredRawMirrorOperationRetryProgressContext(
      executeRequest,
      operation,
      "Retrying remote sync download request"
    )
  );

  ensureConfiguredRawMirrorResponseOk(response, "download");
  return readConfiguredRawMirrorFileContent(response.body, operation.relativePath);
}

function reportConfiguredRawMirrorOperationProgress(
  request: RemoteSyncRawMirrorExecuteRequest,
  operation: RemoteSyncOperation,
  completed: number
): void {
  const action = operation.target === "local"
    ? "Downloaded remote sync resource"
    : operation.kind === "delete"
      ? "Deleted remote sync resource"
      : "Uploaded remote sync resource";

  reportConfiguredRawMirrorProgress(request, {
    message: action,
    completed,
    total: request.operations.length,
    operation
  });
}

function createConfiguredRawMirrorOperationRetryProgressContext(
  request: RemoteSyncRawMirrorExecuteRequest,
  operation: RemoteSyncOperation,
  retryMessage: string
): RemoteSyncConfiguredRawMirrorRequestProgressContext {
  return {
    ...(request.onProgress !== undefined ? { onProgress: request.onProgress } : {}),
    operation,
    retryMessage
  };
}

function reportConfiguredRawMirrorProgress(
  request: { readonly onProgress?: (progress: RemoteSyncProgress) => void },
  progress: RemoteSyncProgress
): void {
  request.onProgress?.(progress);
}

function reportConfiguredRawMirrorRetryProgress(
  progress: RemoteSyncConfiguredRawMirrorRequestProgressContext | undefined,
  completed: number,
  total: number
): void {
  if (!progress?.onProgress) {
    return;
  }

  progress.onProgress({
    message: progress.retryMessage,
    completed,
    total,
    ...(progress.operation !== undefined ? { operation: progress.operation } : {})
  });
}

function createConfiguredRawMirrorBaseQuery(
  profile: RemoteSyncProviderConfiguration,
  direction?: string
): Readonly<Record<string, string | undefined>> {
  return {
    ...(profile.remoteScopeId !== undefined ? { remoteScopeId: profile.remoteScopeId } : {}),
    ...(direction !== undefined ? { direction } : {})
  };
}

function createConfiguredRawMirrorListQuery(
  profile: RemoteSyncProviderConfiguration,
  rawMirror: RemoteSyncConfiguredRawMirrorProfile,
  direction: RemoteSyncRawMirrorListRequest["direction"],
  cursor: string | undefined
): Readonly<Record<string, string | undefined>> {
  return {
    ...createConfiguredRawMirrorBaseQuery(profile, direction),
    ...(rawMirror.listPageSize !== undefined ? { pageSize: String(rawMirror.listPageSize) } : {}),
    ...(cursor !== undefined ? { cursor } : {})
  };
}

function createConfiguredRawMirrorOperationQuery(
  profile: RemoteSyncProviderConfiguration,
  operation: RemoteSyncOperation
): Readonly<Record<string, string | undefined>> {
  return {
    ...createConfiguredRawMirrorBaseQuery(profile),
    path: operation.relativePath,
    ...(operation.remoteId !== undefined ? { remoteId: operation.remoteId } : {})
  };
}

function createConfiguredRawMirrorSecretRequest(
  rawMirror: RemoteSyncConfiguredRawMirrorProfile
) {
  if (!rawMirror.secretHeader) {
    return {};
  }

  return {
    secretHeaders: [
      {
        name: rawMirror.secretHeader.name,
        secretName: rawMirror.secretHeader.secretName,
        ...(rawMirror.secretHeader.prefix !== undefined ? { prefix: rawMirror.secretHeader.prefix } : {})
      }
    ]
  };
}

async function requestConfiguredRawMirror(
  context: RemoteSyncConfiguredRawMirrorRequestContext,
  request: RemoteSyncProfileRequestInput,
  progress?: RemoteSyncConfiguredRawMirrorRequestProgressContext
): Promise<RemoteSyncNativeResponse> {
  const retry = context.rawMirror.retry;
  let retryCount = 0;

  for (;;) {
    const response = await context.request(request);

    if (!retry || retryCount >= retry.maxRetries || !retry.statusCodes.includes(response.status)) {
      return response;
    }

    retryCount += 1;
    reportConfiguredRawMirrorRetryProgress(progress, retryCount, retry.maxRetries);
    await waitConfiguredRawMirrorRetryDelay(
      readConfiguredRawMirrorRetryDelayMs(response) ?? retry.delayMs,
      request.signal
    );
  }
}

function readConfiguredRawMirrorRetryDelayMs(response: RemoteSyncNativeResponse): number | undefined {
  const retryAfter = readConfiguredRawMirrorHeader(response.headers, "retry-after");

  if (!retryAfter) {
    return undefined;
  }

  const seconds = Number(retryAfter);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return clampConfiguredRawMirrorRetryDelay(Math.ceil(seconds * 1000));
  }

  const retryAt = Date.parse(retryAfter);

  if (!Number.isFinite(retryAt)) {
    return undefined;
  }

  return clampConfiguredRawMirrorRetryDelay(Math.max(0, retryAt - Date.now()));
}

function readConfiguredRawMirrorHeader(
  headers: Readonly<Record<string, string>>,
  name: string
): string | undefined {
  const lowerName = name.toLowerCase();
  const entry = Object.entries(headers).find(([key]) => key.toLowerCase() === lowerName);

  return entry?.[1]?.trim() || undefined;
}

function waitConfiguredRawMirrorRetryDelay(delayMs: number, signal: AbortSignal | undefined): Promise<void> {
  throwIfConfiguredRawMirrorAborted(signal);

  const clampedDelayMs = clampConfiguredRawMirrorRetryDelay(delayMs);

  if (clampedDelayMs === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, clampedDelayMs);
    const abort = () => {
      cleanup();
      reject(new Error("Configured raw mirror request was aborted"));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", abort);
    };

    signal?.addEventListener("abort", abort, { once: true });
  });
}

function clampConfiguredRawMirrorRetryDelay(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.min(Math.ceil(value), remoteSyncConfiguredRawMirrorRetryLimits.maxDelayMs);
}

function createConfiguredRawMirrorJsonBody(value: unknown): string {
  const body = JSON.stringify(value);

  if (body.length > configuredRawMirrorLimits.maxBodyBytes) {
    throw new Error("Configured raw mirror request body is too large");
  }

  return body;
}

function ensureConfiguredRawMirrorResponseOk(
  response: { readonly status: number; readonly statusText: string },
  operation: string
): void {
  if (response.status >= 200 && response.status < 300) {
    return;
  }

  throw new Error(`Configured raw mirror ${operation} request failed: ${response.status} ${response.statusText}`);
}

function readConfiguredRawMirrorProfile(
  profile: RemoteSyncProviderConfiguration
): RemoteSyncConfiguredRawMirrorProfile | undefined {
  const metadata = profile.metadata ?? {};

  if (metadata[remoteSyncConfiguredRawMirrorMetadataKeys.adapter] !== remoteSyncConfiguredRawMirrorAdapterName) {
    return undefined;
  }

  if (diagnoseRemoteSyncConfiguredRawMirrorMetadata(profile).length > 0) {
    return undefined;
  }

  const listPath = readConfiguredRawMirrorMetadataPath(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.listPath);
  const listPageSize = readConfiguredRawMirrorListPageSize(metadata);
  const deleteMissing = readConfiguredRawMirrorBoolean(metadata[remoteSyncConfiguredRawMirrorMetadataKeys.deleteMissing]);
  const uploadPath = readConfiguredRawMirrorMetadataPath(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath);
  const downloadPath = readConfiguredRawMirrorMetadataPath(
    metadata,
    remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath
  );
  const deletePath = readConfiguredRawMirrorMetadataPath(metadata, remoteSyncConfiguredRawMirrorMetadataKeys.deletePath);
  const secretHeader = readConfiguredRawMirrorSecretHeader(metadata);
  const retry = readConfiguredRawMirrorRetryPolicy(metadata);

  if (!listPath || !uploadPath || !downloadPath || !deletePath) {
    return undefined;
  }

  return {
    listPath,
    ...(listPageSize !== undefined ? { listPageSize } : {}),
    ...(deleteMissing !== undefined ? { deleteMissing } : {}),
    uploadPath,
    downloadPath,
    deletePath,
    ...(secretHeader !== undefined ? { secretHeader } : {}),
    ...(retry !== undefined ? { retry } : {})
  };
}

function diagnoseConfiguredRawMirrorMetadataPath(
  metadata: Readonly<Record<string, string>>,
  key: RemoteSyncConfiguredRawMirrorMetadataKey
): RemoteSyncConfiguredRawMirrorMetadataIssue | undefined {
  const normalized = normalizeConfiguredRawMirrorMetadataValue(metadata[key]);

  if (!normalized) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.missingPath,
      key
    };
  }

  if (!isConfiguredRawMirrorMetadataPath(normalized)) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidPath,
      key
    };
  }

  return undefined;
}

function diagnoseConfiguredRawMirrorSecretHeaderMetadata(
  profile: RemoteSyncProviderConfiguration,
  metadata: Readonly<Record<string, string>>
): RemoteSyncConfiguredRawMirrorMetadataIssue | undefined {
  const secretName = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]
  );
  const headerName = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerName]
  );
  const scheme = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]
  );

  if (!secretName && !headerName && !scheme) {
    return undefined;
  }

  if (!secretName || !headerName) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.incompleteHeader,
      key: !secretName
        ? remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding
        : remoteSyncConfiguredRawMirrorMetadataKeys.headerName
    };
  }

  if (!isConfiguredRawMirrorHeaderName(headerName)) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidHeaderName,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.headerName
    };
  }

  if (!isConfiguredRawMirrorHeaderScheme(scheme)) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidHeaderScheme,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme
    };
  }

  if (!profile.secrets.some((secret) => secret.name === secretName)) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.unboundHeader,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding
    };
  }

  return undefined;
}

function diagnoseConfiguredRawMirrorListMetadata(
  metadata: Readonly<Record<string, string>>
): RemoteSyncConfiguredRawMirrorMetadataIssue | undefined {
  const pageSize = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize]
  );

  if (!pageSize) {
    return undefined;
  }

  if (readConfiguredRawMirrorListPageSize(metadata) === undefined) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidListPageSize,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize
    };
  }

  return undefined;
}

function diagnoseConfiguredRawMirrorDeleteMetadata(
  metadata: Readonly<Record<string, string>>
): RemoteSyncConfiguredRawMirrorMetadataIssue | undefined {
  const deleteMissing = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.deleteMissing]
  );

  if (!deleteMissing) {
    return undefined;
  }

  if (readConfiguredRawMirrorBoolean(deleteMissing) === undefined) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidDeleteMissing,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.deleteMissing
    };
  }

  return undefined;
}

function diagnoseConfiguredRawMirrorRetryMetadata(
  metadata: Readonly<Record<string, string>>
): RemoteSyncConfiguredRawMirrorMetadataIssue | undefined {
  const statusCodes = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]
  );
  const maxRetries = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]
  );
  const delayMs = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs]
  );

  if (!statusCodes && !maxRetries && !delayMs) {
    return undefined;
  }

  if (!statusCodes) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.incompleteRetry,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes
    };
  }

  if (!readConfiguredRawMirrorRetryStatusCodes(statusCodes)) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidRetryStatusCodes,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes
    };
  }

  if (
    readConfiguredRawMirrorOptionalInteger(
      maxRetries,
      remoteSyncConfiguredRawMirrorRetryLimits.defaultMaxRetries,
      0,
      remoteSyncConfiguredRawMirrorRetryLimits.maxRetries
    ) === undefined
  ) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidRetryMaxRetries,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries
    };
  }

  if (
    readConfiguredRawMirrorOptionalInteger(
      delayMs,
      remoteSyncConfiguredRawMirrorRetryLimits.defaultDelayMs,
      0,
      remoteSyncConfiguredRawMirrorRetryLimits.maxDelayMs
    ) === undefined
  ) {
    return {
      code: remoteSyncConfiguredRawMirrorMetadataIssueCodes.invalidRetryDelayMs,
      key: remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs
    };
  }

  return undefined;
}

function readConfiguredRawMirrorListPageSize(metadata: Readonly<Record<string, string>>): number | undefined {
  const pageSize = readConfiguredRawMirrorOptionalInteger(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize],
    0,
    remoteSyncConfiguredRawMirrorListLimits.minPageSize,
    remoteSyncConfiguredRawMirrorListLimits.maxPageSize
  );

  return pageSize && pageSize > 0 ? pageSize : undefined;
}

function readConfiguredRawMirrorBoolean(value: unknown): boolean | undefined {
  const normalized = normalizeConfiguredRawMirrorMetadataValue(value)?.toLowerCase();

  if (!normalized) {
    return undefined;
  }

  if (normalized === "true") {
    return true;
  }

  if (normalized === "false") {
    return false;
  }

  return undefined;
}

function readConfiguredRawMirrorRetryPolicy(
  metadata: Readonly<Record<string, string>>
): RemoteSyncConfiguredRawMirrorProfile["retry"] | undefined {
  const statusCodes = readConfiguredRawMirrorRetryStatusCodes(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]
  );

  if (!statusCodes || statusCodes.length === 0) {
    return undefined;
  }

  const maxRetries = readConfiguredRawMirrorOptionalInteger(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries],
    remoteSyncConfiguredRawMirrorRetryLimits.defaultMaxRetries,
    0,
    remoteSyncConfiguredRawMirrorRetryLimits.maxRetries
  );
  const delayMs = readConfiguredRawMirrorOptionalInteger(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs],
    remoteSyncConfiguredRawMirrorRetryLimits.defaultDelayMs,
    0,
    remoteSyncConfiguredRawMirrorRetryLimits.maxDelayMs
  );

  if (maxRetries === undefined || maxRetries <= 0 || delayMs === undefined) {
    return undefined;
  }

  return {
    delayMs,
    maxRetries,
    statusCodes
  };
}

function readConfiguredRawMirrorRetryStatusCodes(value: unknown): readonly number[] | undefined {
  const normalized = normalizeConfiguredRawMirrorMetadataValue(value);

  if (!normalized) {
    return [];
  }

  const statusCodes = new Set<number>();

  for (const part of normalized.split(/[\s,]+/)) {
    if (!part) {
      continue;
    }

    const statusCode = Number(part);

    if (
      !Number.isInteger(statusCode) ||
      statusCode < 400 ||
      statusCode > 599 ||
      statusCodes.size >= remoteSyncConfiguredRawMirrorRetryLimits.maxStatusCodes
    ) {
      return undefined;
    }

    statusCodes.add(statusCode);
  }

  return [...statusCodes].sort((first, second) => first - second);
}

function readConfiguredRawMirrorOptionalInteger(
  value: unknown,
  defaultValue: number,
  min: number,
  max: number
): number | undefined {
  const normalized = normalizeConfiguredRawMirrorMetadataValue(value);

  if (!normalized) {
    return defaultValue;
  }

  const parsed = Number(normalized);

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return undefined;
  }

  return parsed;
}

function readConfiguredRawMirrorSecretHeader(
  metadata: Readonly<Record<string, string>>
): RemoteSyncConfiguredRawMirrorProfile["secretHeader"] | undefined {
  const secretName = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]
  );
  const headerName = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerName]
  );

  if (!secretName && !headerName) {
    return undefined;
  }

  if (!secretName || !headerName) {
    return undefined;
  }

  const scheme = normalizeConfiguredRawMirrorMetadataValue(
    metadata[remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]
  );

  return {
    name: headerName,
    secretName,
    ...(scheme ? { prefix: `${scheme} ` } : {})
  };
}

function readConfiguredRawMirrorMetadataPath(
  metadata: Readonly<Record<string, string>>,
  key: string
): string | undefined {
  const normalized = normalizeConfiguredRawMirrorMetadataValue(metadata[key]);

  if (!normalized || !isConfiguredRawMirrorMetadataPath(normalized)) {
    return undefined;
  }

  return normalized;
}

function isConfiguredRawMirrorMetadataPath(normalized: string): boolean {
  return !(
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    normalized.length > configuredRawMirrorLimits.maxPathLength ||
    /[?#]/.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    hasConfiguredRawMirrorParentTraversal(normalized)
  );
}

function isConfiguredRawMirrorHeaderName(value: string): boolean {
  return /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(value);
}

function isConfiguredRawMirrorHeaderScheme(value: string | undefined): boolean {
  return value === undefined || (value.length <= 128 && !/[\r\n]/.test(value));
}

function normalizeConfiguredRawMirrorMetadataValue(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

function readConfiguredRawMirrorResourceListPage(value: unknown): {
  readonly resources: readonly RemoteSyncRemoteResource[];
  readonly nextCursor?: string;
} {
  const resources = Array.isArray(value)
    ? value
    : isRecord(value) && Array.isArray(value.resources)
      ? value.resources
      : undefined;

  if (!resources) {
    throw new Error("Configured raw mirror resource list response is invalid");
  }

  if (resources.length > remoteSyncConfiguredRawMirrorListLimits.maxResources) {
    throw new Error("Configured raw mirror resource list response is too large");
  }

  const nextCursor = Array.isArray(value) || !isRecord(value)
    ? undefined
    : readConfiguredRawMirrorOptionalCursor(value.nextCursor);

  return {
    resources: resources.map(readConfiguredRawMirrorRemoteResource),
    ...(nextCursor !== undefined ? { nextCursor } : {})
  };
}

function readConfiguredRawMirrorOptionalCursor(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error("Configured raw mirror resource list next cursor must be a string");
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (
    normalized.length > remoteSyncConfiguredRawMirrorListLimits.maxCursorLength ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    throw new Error("Configured raw mirror resource list next cursor is invalid");
  }

  return normalized;
}

function readConfiguredRawMirrorRemoteResource(value: unknown): RemoteSyncRemoteResource {
  const record = expectConfiguredRawMirrorRecord(value, "Configured raw mirror remote resource");
  const remoteId = readConfiguredRawMirrorOptionalString(record.remoteId, "Configured raw mirror remote id");
  const size = readConfiguredRawMirrorOptionalNonNegativeNumber(record.size, "Configured raw mirror size");
  const mtime = readConfiguredRawMirrorOptionalNonNegativeNumber(record.mtime, "Configured raw mirror mtime");
  const contentHash = readConfiguredRawMirrorOptionalString(
    record.contentHash,
    "Configured raw mirror content hash"
  );

  return {
    relativePath: readConfiguredRawMirrorRelativePath(record.relativePath),
    kind: readConfiguredRawMirrorKind(record.kind),
    ...(remoteId !== undefined ? { remoteId } : {}),
    ...(size !== undefined ? { size } : {}),
    ...(mtime !== undefined ? { mtime } : {}),
    ...(contentHash !== undefined ? { contentHash } : {})
  };
}

function readConfiguredRawMirrorFileContent(
  value: unknown,
  relativePath: string
): RemoteSyncRawMirrorLocalFileContent {
  const record = expectConfiguredRawMirrorRecord(value, "Configured raw mirror file content");
  const responsePath = record.relativePath === undefined
    ? relativePath
    : readConfiguredRawMirrorRelativePath(record.relativePath);

  if (responsePath !== relativePath) {
    throw new Error("Configured raw mirror file content path does not match the requested path");
  }

  if (record.encoding !== undefined && record.encoding !== "base64") {
    throw new Error("Configured raw mirror file content encoding must be base64");
  }

  return {
    relativePath,
    value: readConfiguredRawMirrorBase64(record.value),
    encoding: "base64",
    ...readConfiguredRawMirrorOptionalNumberProperty(record, "size", "Configured raw mirror file content size"),
    ...readConfiguredRawMirrorOptionalNumberProperty(record, "mtime", "Configured raw mirror file content mtime"),
    ...readConfiguredRawMirrorOptionalStringProperty(
      record,
      "contentHash",
      "Configured raw mirror file content hash"
    )
  };
}

function createConfiguredRawMirrorOperationPayload(operation: RemoteSyncOperation) {
  return {
    kind: operation.kind,
    target: operation.target,
    relativePath: operation.relativePath,
    ...(operation.remoteId !== undefined ? { remoteId: operation.remoteId } : {}),
    ...(operation.message !== undefined ? { message: operation.message } : {})
  };
}

function createConfiguredRawMirrorResourcePayload(resource: RemoteSyncResource) {
  return {
    relativePath: resource.relativePath,
    kind: resource.kind,
    ...(resource.name !== undefined ? { name: resource.name } : {}),
    ...(resource.size !== undefined ? { size: resource.size } : {}),
    ...(resource.mtime !== undefined ? { mtime: resource.mtime } : {}),
    ...(resource.contentHash !== undefined ? { contentHash: resource.contentHash } : {})
  };
}

function readConfiguredRawMirrorRelativePath(value: unknown): string {
  if (typeof value !== "string") {
    throw new Error("Configured raw mirror relative path must be a string");
  }

  const normalized = value.trim().replaceAll("\\", "/");

  if (
    !normalized ||
    normalized.length > configuredRawMirrorLimits.maxPathLength ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized) ||
    hasConfiguredRawMirrorParentTraversal(normalized)
  ) {
    throw new Error("Configured raw mirror relative path is invalid");
  }

  return normalized.split("/").filter(Boolean).join("/");
}

function readConfiguredRawMirrorKind(value: unknown): RemoteSyncRemoteResource["kind"] {
  if (value !== "file" && value !== "directory") {
    throw new Error("Configured raw mirror resource kind is invalid");
  }

  return value;
}

function readConfiguredRawMirrorBase64(value: unknown): string {
  if (
    typeof value !== "string" ||
    value !== value.trim() ||
    value.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(value)
  ) {
    throw new Error("Configured raw mirror file content value must be base64");
  }

  return value;
}

function readConfiguredRawMirrorOptionalNumberProperty(
  record: Record<string, unknown>,
  key: string,
  label: string
): { readonly [key: string]: number } {
  const value = readConfiguredRawMirrorOptionalNonNegativeNumber(record[key], label);
  return value !== undefined ? { [key]: value } : {};
}

function readConfiguredRawMirrorOptionalStringProperty(
  record: Record<string, unknown>,
  key: string,
  label: string
): { readonly [key: string]: string } {
  const value = readConfiguredRawMirrorOptionalString(record[key], label);
  return value !== undefined ? { [key]: value } : {};
}

function readConfiguredRawMirrorOptionalString(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    return undefined;
  }

  if (normalized.length > 512 || /[\u0000-\u001f]/.test(normalized)) {
    throw new Error(`${label} is invalid`);
  }

  return normalized;
}

function readConfiguredRawMirrorOptionalNonNegativeNumber(value: unknown, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }

  return value;
}

function expectConfiguredRawMirrorRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasConfiguredRawMirrorParentTraversal(path: string): boolean {
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

function throwIfConfiguredRawMirrorAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Configured raw mirror request was aborted");
  }
}
