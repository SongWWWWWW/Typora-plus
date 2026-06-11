import type { URI as URIType } from "@typora-plus/base";
import type {
  RemoteSyncOperation,
  RemoteSyncProgress,
  RemoteSyncResource
} from "./remoteSync";
import type {
  IRemoteSyncWorkspaceResourceService,
  RemoteSyncWorkspaceResourceReadResult
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

interface RemoteSyncRawMirrorUploadFileOperation {
  readonly operation: RemoteSyncOperation;
  readonly resource: RemoteSyncResource;
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

function throwIfRemoteSyncRawMirrorUploadReadAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) {
    throw new Error("Remote sync raw mirror upload resource read was aborted");
  }
}
