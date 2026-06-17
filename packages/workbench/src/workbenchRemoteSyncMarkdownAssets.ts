import { URI, type URI as URIType } from "@typora-plus/base";
import {
  collectMarkdownLocalResourceReferences,
  isMarkdownLocalResourceDocumentPath
} from "@typora-plus/markdown";
import type {
  IRemoteSyncWorkspaceResourceService,
  RemoteSyncResource,
  RemoteSyncWorkspaceResourceReadResult
} from "@typora-plus/platform";

export interface WorkbenchRemoteSyncMarkdownAssetInput {
  readonly messages?: WorkbenchRemoteSyncMarkdownAssetMessages;
  readonly workspaceUri: URIType;
  readonly resources: readonly RemoteSyncResource[];
  readonly resourceService: Pick<IRemoteSyncWorkspaceResourceService, "readResource">;
  readonly signal?: AbortSignal;
}

export interface WorkbenchRemoteSyncMarkdownAssetMessages {
  readonly aborted: string;
  readonly contentEncodingInvalid: string;
  readonly contentEncodingRequired: string;
}

export const defaultWorkbenchRemoteSyncMarkdownAssetMessages: WorkbenchRemoteSyncMarkdownAssetMessages = {
  aborted: "Remote sync Markdown asset discovery was aborted",
  contentEncodingInvalid: "Remote sync Markdown asset discovery requires valid base64 content",
  contentEncodingRequired: "Remote sync Markdown asset discovery requires base64 content"
};

export async function createWorkbenchRemoteSyncResourcesWithMarkdownAssets(
  input: WorkbenchRemoteSyncMarkdownAssetInput
): Promise<readonly RemoteSyncResource[]> {
  const messages = input.messages ?? defaultWorkbenchRemoteSyncMarkdownAssetMessages;
  const resources = [...input.resources];
  const resourcesByPath = new Map(resources.map((resource) => [resource.relativePath, resource]));

  for (const resource of input.resources) {
    throwIfWorkbenchRemoteSyncMarkdownAssetDiscoveryAborted(input.signal, messages);

    if (resource.kind !== "file" || !isMarkdownLocalResourceDocumentPath(resource.relativePath)) {
      continue;
    }

    const markdownContent = await input.resourceService.readResource({
      workspaceUri: input.workspaceUri,
      relativePath: resource.relativePath
    });

    resourcesByPath.set(resource.relativePath, {
      ...resource,
      size: markdownContent.size,
      ...(markdownContent.mtime !== undefined ? { mtime: markdownContent.mtime } : {}),
      ...(markdownContent.contentHash !== undefined ? { contentHash: markdownContent.contentHash } : {})
    });

    const references = collectMarkdownLocalResourceReferences(
      decodeWorkbenchRemoteSyncMarkdownContent(markdownContent, messages),
      { sourcePath: resource.relativePath }
    );

    for (const reference of references) {
      throwIfWorkbenchRemoteSyncMarkdownAssetDiscoveryAborted(input.signal, messages);

      if (resourcesByPath.has(reference.relativePath)) {
        continue;
      }

      const assetContent = await readOptionalWorkbenchRemoteSyncMarkdownAsset(
        input.resourceService,
        input.workspaceUri,
        reference.relativePath
      );

      if (!assetContent) {
        continue;
      }

      const assetResource = createWorkbenchRemoteSyncResourceFromReadResult(
        input.workspaceUri,
        reference.relativePath,
        assetContent
      );

      resourcesByPath.set(assetResource.relativePath, assetResource);
      resources.push(assetResource);
    }
  }

  return resources.map((resource) => resourcesByPath.get(resource.relativePath) ?? resource);
}

async function readOptionalWorkbenchRemoteSyncMarkdownAsset(
  resourceService: Pick<IRemoteSyncWorkspaceResourceService, "readResource">,
  workspaceUri: URIType,
  relativePath: string
): Promise<RemoteSyncWorkspaceResourceReadResult | undefined> {
  try {
    return await resourceService.readResource({
      workspaceUri,
      relativePath
    });
  } catch {
    return undefined;
  }
}

function createWorkbenchRemoteSyncResourceFromReadResult(
  workspaceUri: URIType,
  relativePath: string,
  content: RemoteSyncWorkspaceResourceReadResult,
  name = readWorkbenchRemoteSyncResourceName(relativePath)
): RemoteSyncResource {
  return {
    uri: createWorkbenchRemoteSyncResourceUri(workspaceUri, relativePath),
    relativePath,
    kind: "file",
    name,
    size: content.size,
    ...(content.mtime !== undefined ? { mtime: content.mtime } : {}),
    ...(content.contentHash !== undefined ? { contentHash: content.contentHash } : {})
  };
}

function createWorkbenchRemoteSyncResourceUri(workspaceUri: URIType, relativePath: string): URIType {
  const workspacePath = workspaceUri.path.replace(/\/+$/, "");
  const resourcePath = `${workspacePath}/${relativePath}`;

  return workspaceUri.scheme === "file"
    ? URI.file(resourcePath)
    : URI.parse(`${workspaceUri.scheme}:${resourcePath}`);
}

function readWorkbenchRemoteSyncResourceName(relativePath: string): string {
  return relativePath.split("/").at(-1) ?? relativePath;
}

function decodeWorkbenchRemoteSyncMarkdownContent(
  content: RemoteSyncWorkspaceResourceReadResult,
  messages: WorkbenchRemoteSyncMarkdownAssetMessages
): string {
  if (content.encoding !== "base64") {
    throw new Error(messages.contentEncodingRequired);
  }

  const normalized = content.value.trim();

  if (
    normalized !== content.value ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalized)
  ) {
    throw new Error(messages.contentEncodingInvalid);
  }

  const decoded = atob(normalized);
  const bytes = new Uint8Array(decoded.length);

  for (let index = 0; index < decoded.length; index += 1) {
    bytes[index] = decoded.charCodeAt(index);
  }

  return new TextDecoder().decode(bytes);
}

function throwIfWorkbenchRemoteSyncMarkdownAssetDiscoveryAborted(
  signal: AbortSignal | undefined,
  messages: WorkbenchRemoteSyncMarkdownAssetMessages
): void {
  if (signal?.aborted) {
    throw new Error(messages.aborted);
  }
}
