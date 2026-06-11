import { URI, type URI as URIType } from "@typora-plus/base";
import type {
  RemoteSyncOperation,
  RemoteSyncProgress,
  RemoteSyncResource
} from "./remoteSync";
import type {
  IRemoteSyncWorkspaceResourceService,
  RemoteSyncWorkspaceResourceReadResult,
  RemoteSyncWorkspaceResourceWriteResult
} from "./remoteSyncWorkspaceResources";

export interface RemoteSyncRawMirrorUploadFileContent {
  readonly operation: RemoteSyncOperation;
  readonly resource: RemoteSyncResource;
  readonly content: RemoteSyncWorkspaceResourceReadResult;
}

export interface RemoteSyncRawMirrorUploadFileContentInput {
  readonly workspaceUri: URIType;
  readonly operations: readonly RemoteSyncOperation[];
  readonly localResources: readonly RemoteSyncResource[];
  readonly resourceService: Pick<IRemoteSyncWorkspaceResourceService, "readResource">;
  readonly onProgress?: (progress: RemoteSyncProgress) => void;
  readonly signal?: AbortSignal;
}

export interface RemoteSyncRawMirrorLocalFileContent {
  readonly relativePath: string;
  readonly value: string;
  readonly encoding: RemoteSyncWorkspaceResourceReadResult["encoding"];
  readonly size?: number;
  readonly mtime?: number;
  readonly contentHash?: string;
}

export interface RemoteSyncRawMirrorLocalApplyResult {
  readonly operation: RemoteSyncOperation;
  readonly resource?: RemoteSyncResource;
  readonly deleted?: boolean;
}

export interface RemoteSyncRawMirrorLocalApplyInput {
  readonly workspaceUri: URIType;
  readonly operations: readonly RemoteSyncOperation[];
  readonly localResources: readonly RemoteSyncResource[];
  readonly fileContents: readonly RemoteSyncRawMirrorLocalFileContent[];
  readonly resourceService: Pick<IRemoteSyncWorkspaceResourceService, "deleteResource" | "writeResource">;
  readonly onProgress?: (progress: RemoteSyncProgress) => void;
  readonly signal?: AbortSignal;
}

export interface RemoteSyncRawMirrorExecutedLocalResourceInput {
  readonly localResources: readonly RemoteSyncResource[];
  readonly localApplyResults?: readonly RemoteSyncRawMirrorLocalApplyResult[];
  readonly uploadFileContents?: readonly RemoteSyncRawMirrorUploadFileContent[];
}

interface RemoteSyncRawMirrorUploadFileOperation {
  readonly operation: RemoteSyncOperation;
  readonly resource: RemoteSyncResource;
}

interface RemoteSyncRawMirrorLocalApplyStep {
  readonly operation: RemoteSyncOperation;
  readonly localResource?: RemoteSyncResource;
  readonly fileContent?: RemoteSyncRawMirrorLocalFileContent;
}

export async function readRemoteSyncRawMirrorUploadFileContents(
  input: RemoteSyncRawMirrorUploadFileContentInput
): Promise<readonly RemoteSyncRawMirrorUploadFileContent[]> {
  const uploadFiles = collectRemoteSyncRawMirrorUploadFileOperations(input.operations, input.localResources);
  const contents: RemoteSyncRawMirrorUploadFileContent[] = [];
  let completed = 0;

  for (const uploadFile of uploadFiles) {
    throwIfRemoteSyncRawMirrorUploadReadAborted(input.signal);

    const content = await input.resourceService.readResource({
      workspaceUri: input.workspaceUri,
      relativePath: uploadFile.resource.relativePath
    });

    throwIfRemoteSyncRawMirrorUploadReadAborted(input.signal);
    validateRemoteSyncRawMirrorUploadContent(uploadFile.resource, content);
    completed += 1;
    contents.push({
      operation: uploadFile.operation,
      resource: createRemoteSyncRawMirrorUploadResourceFromContent(uploadFile.resource, content),
      content
    });
    input.onProgress?.({
      message: "Read local remote sync upload resource",
      completed,
      total: uploadFiles.length,
      operation: uploadFile.operation
    });
  }

  return contents;
}

export async function applyRemoteSyncRawMirrorLocalResourceChanges(
  input: RemoteSyncRawMirrorLocalApplyInput
): Promise<readonly RemoteSyncRawMirrorLocalApplyResult[]> {
  const steps = collectRemoteSyncRawMirrorLocalApplySteps(
    input.operations,
    input.localResources,
    input.fileContents
  );
  const results: RemoteSyncRawMirrorLocalApplyResult[] = [];
  let completed = 0;

  for (const step of steps) {
    throwIfRemoteSyncRawMirrorLocalApplyAborted(input.signal);

    const result = await applyRemoteSyncRawMirrorLocalStep(input, step);

    throwIfRemoteSyncRawMirrorLocalApplyAborted(input.signal);
    completed += 1;
    results.push(result);
    input.onProgress?.({
      message: "Applied local remote sync resource change",
      completed,
      total: steps.length,
      operation: step.operation
    });
  }

  return results;
}

export function createRemoteSyncRawMirrorExecutedLocalResources(
  input: RemoteSyncRawMirrorExecutedLocalResourceInput
): readonly RemoteSyncResource[] {
  const resourcesByPath = new Map(input.localResources.map((resource) => [resource.relativePath, resource]));

  for (const uploadContent of input.uploadFileContents ?? []) {
    if (uploadContent.resource.kind === "file") {
      resourcesByPath.set(uploadContent.resource.relativePath, uploadContent.resource);
    }
  }

  for (const result of input.localApplyResults ?? []) {
    if (result.deleted === true) {
      resourcesByPath.delete(result.operation.relativePath);
      continue;
    }

    if (result.resource) {
      resourcesByPath.set(result.resource.relativePath, result.resource);
    }
  }

  return [...resourcesByPath.values()]
    .sort((first, second) => first.relativePath.localeCompare(second.relativePath));
}

function collectRemoteSyncRawMirrorUploadFileOperations(
  operations: readonly RemoteSyncOperation[],
  localResources: readonly RemoteSyncResource[]
): readonly RemoteSyncRawMirrorUploadFileOperation[] {
  const localByPath = new Map(localResources.map((resource) => [resource.relativePath, resource]));
  const uploadFiles: RemoteSyncRawMirrorUploadFileOperation[] = [];
  const seenFilePaths = new Set<string>();

  for (const operation of operations) {
    if (!isRemoteSyncRawMirrorUploadOperation(operation)) {
      continue;
    }

    const resource = localByPath.get(operation.relativePath);

    if (!resource) {
      throw new Error(`Remote sync raw mirror upload ${operation.relativePath} requires a local resource`);
    }

    if (resource.kind !== "file") {
      continue;
    }

    if (seenFilePaths.has(resource.relativePath)) {
      throw new Error(`Remote sync raw mirror upload file is duplicated: ${resource.relativePath}`);
    }

    seenFilePaths.add(resource.relativePath);
    uploadFiles.push({
      operation,
      resource
    });
  }

  return uploadFiles;
}

function isRemoteSyncRawMirrorUploadOperation(operation: RemoteSyncOperation): boolean {
  return operation.target === "remote" &&
    (operation.kind === "create" || operation.kind === "update");
}

function collectRemoteSyncRawMirrorLocalApplySteps(
  operations: readonly RemoteSyncOperation[],
  localResources: readonly RemoteSyncResource[],
  fileContents: readonly RemoteSyncRawMirrorLocalFileContent[]
): readonly RemoteSyncRawMirrorLocalApplyStep[] {
  const localByPath = new Map(localResources.map((resource) => [resource.relativePath, resource]));
  const fileContentByPath = mapRemoteSyncRawMirrorLocalFileContents(fileContents);
  const steps: RemoteSyncRawMirrorLocalApplyStep[] = [];
  const seenOperationPaths = new Set<string>();

  for (const operation of operations) {
    if (!isRemoteSyncRawMirrorLocalApplyOperation(operation)) {
      continue;
    }

    if (seenOperationPaths.has(operation.relativePath)) {
      throw new Error(`Remote sync raw mirror local operation is duplicated: ${operation.relativePath}`);
    }

    seenOperationPaths.add(operation.relativePath);
    steps.push({
      operation,
      ...(localByPath.has(operation.relativePath)
        ? { localResource: localByPath.get(operation.relativePath)! }
        : {}),
      ...(fileContentByPath.has(operation.relativePath)
        ? { fileContent: fileContentByPath.get(operation.relativePath)! }
        : {})
    });
  }

  return steps;
}

function mapRemoteSyncRawMirrorLocalFileContents(
  fileContents: readonly RemoteSyncRawMirrorLocalFileContent[]
): ReadonlyMap<string, RemoteSyncRawMirrorLocalFileContent> {
  const mapped = new Map<string, RemoteSyncRawMirrorLocalFileContent>();

  for (const fileContent of fileContents) {
    validateRemoteSyncRawMirrorLocalFileContent(fileContent);

    if (mapped.has(fileContent.relativePath)) {
      throw new Error(`Remote sync raw mirror local file content is duplicated: ${fileContent.relativePath}`);
    }

    mapped.set(fileContent.relativePath, fileContent);
  }

  return mapped;
}

function isRemoteSyncRawMirrorLocalApplyOperation(operation: RemoteSyncOperation): boolean {
  return operation.target === "local" &&
    (operation.kind === "create" || operation.kind === "update" || operation.kind === "delete");
}

async function applyRemoteSyncRawMirrorLocalStep(
  input: RemoteSyncRawMirrorLocalApplyInput,
  step: RemoteSyncRawMirrorLocalApplyStep
): Promise<RemoteSyncRawMirrorLocalApplyResult> {
  switch (step.operation.kind) {
    case "create":
      return applyRemoteSyncRawMirrorLocalWrite(input, step, false);
    case "update":
      return applyRemoteSyncRawMirrorLocalWrite(input, step, true);
    case "delete":
      return applyRemoteSyncRawMirrorLocalDelete(input, step);
    case "conflict":
    case "skip":
      throw new Error("Remote sync raw mirror local apply received a non-executable operation");
  }
}

async function applyRemoteSyncRawMirrorLocalWrite(
  input: RemoteSyncRawMirrorLocalApplyInput,
  step: RemoteSyncRawMirrorLocalApplyStep,
  overwrite: boolean
): Promise<RemoteSyncRawMirrorLocalApplyResult> {
  if (!step.fileContent) {
    throw new Error(`Remote sync raw mirror local write ${step.operation.relativePath} requires file content`);
  }

  if (step.operation.kind === "create" && step.localResource) {
    throw new Error(`Remote sync raw mirror local create ${step.operation.relativePath} found an existing local resource`);
  }

  if (step.operation.kind === "update" && !step.localResource) {
    throw new Error(`Remote sync raw mirror local update ${step.operation.relativePath} requires a local resource`);
  }

  const written = await input.resourceService.writeResource({
    workspaceUri: input.workspaceUri,
    relativePath: step.operation.relativePath,
    value: step.fileContent.value,
    encoding: step.fileContent.encoding,
    ...(step.localResource?.mtime !== undefined ? { expectedMtime: step.localResource.mtime } : {}),
    overwrite
  });

  return {
    operation: step.operation,
    resource: createRemoteSyncRawMirrorLocalResourceFromWrite(step.operation.relativePath, step.fileContent, written)
  };
}

async function applyRemoteSyncRawMirrorLocalDelete(
  input: RemoteSyncRawMirrorLocalApplyInput,
  step: RemoteSyncRawMirrorLocalApplyStep
): Promise<RemoteSyncRawMirrorLocalApplyResult> {
  if (!step.localResource) {
    throw new Error(`Remote sync raw mirror local delete ${step.operation.relativePath} requires a local resource`);
  }

  const deleted = await input.resourceService.deleteResource({
    workspaceUri: input.workspaceUri,
    relativePath: step.operation.relativePath,
    ...(step.localResource.mtime !== undefined ? { expectedMtime: step.localResource.mtime } : {}),
    overwrite: true
  });

  if (!deleted) {
    throw new Error(`Remote sync raw mirror local delete ${step.operation.relativePath} was not applied`);
  }

  return {
    operation: step.operation,
    deleted: true
  };
}

function createRemoteSyncRawMirrorUploadResourceFromContent(
  resource: RemoteSyncResource,
  content: RemoteSyncWorkspaceResourceReadResult
): RemoteSyncResource {
  return {
    ...resource,
    size: content.size,
    ...(content.mtime !== undefined ? { mtime: content.mtime } : {}),
    ...(content.contentHash !== undefined ? { contentHash: content.contentHash } : {})
  };
}

function validateRemoteSyncRawMirrorUploadContent(
  resource: RemoteSyncResource,
  content: RemoteSyncWorkspaceResourceReadResult
): void {
  if (content.relativePath !== resource.relativePath) {
    throw new Error("Remote sync raw mirror upload read returned a different resource path");
  }

  if (content.encoding !== "base64") {
    throw new Error("Remote sync raw mirror upload content must be base64");
  }
}

function validateRemoteSyncRawMirrorLocalFileContent(content: RemoteSyncRawMirrorLocalFileContent): void {
  if (!isRemoteSyncRawMirrorWorkspaceRelativePath(content.relativePath)) {
    throw new Error("Remote sync raw mirror local file content path is invalid");
  }

  if (content.encoding !== "base64") {
    throw new Error("Remote sync raw mirror local file content must be base64");
  }

  if (!isRemoteSyncRawMirrorBase64Content(content.value)) {
    throw new Error("Remote sync raw mirror local file content value must be base64");
  }
}

function createRemoteSyncRawMirrorLocalResourceFromWrite(
  relativePath: string,
  content: RemoteSyncRawMirrorLocalFileContent,
  written: RemoteSyncWorkspaceResourceWriteResult
): RemoteSyncResource {
  return {
    uri: createRemoteSyncRawMirrorLocalResourceUri(written.workspaceUri, relativePath),
    relativePath,
    kind: "file",
    name: readRemoteSyncRawMirrorResourceName(relativePath),
    size: written.size,
    ...(written.mtime !== undefined ? { mtime: written.mtime } : {}),
    ...(content.contentHash !== undefined ? { contentHash: content.contentHash } : {})
  };
}

function createRemoteSyncRawMirrorLocalResourceUri(workspaceUri: URIType, relativePath: string): URIType {
  const workspacePath = workspaceUri.path.replace(/\/+$/, "");
  const resourcePath = `${workspacePath}/${relativePath}`;

  return workspaceUri.scheme === "file"
    ? URI.file(resourcePath)
    : URI.parse(`${workspaceUri.scheme}:${resourcePath}`);
}

function readRemoteSyncRawMirrorResourceName(relativePath: string): string {
  return relativePath.split("/").at(-1) ?? relativePath;
}

function isRemoteSyncRawMirrorWorkspaceRelativePath(value: string): boolean {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (
    !normalized ||
    normalized !== value ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    normalized.includes("\\") ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    return false;
  }

  return normalized.split("/").every((segment) => segment && segment !== "." && segment !== "..");
}

function isRemoteSyncRawMirrorBase64Content(value: string): boolean {
  return typeof value === "string" &&
    value === value.trim() &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

function throwIfRemoteSyncRawMirrorUploadReadAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Remote sync raw mirror upload resource read was aborted");
  }
}

function throwIfRemoteSyncRawMirrorLocalApplyAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Remote sync raw mirror local apply was aborted");
  }
}
