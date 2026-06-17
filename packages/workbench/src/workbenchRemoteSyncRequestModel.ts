import type {
  FileTreeEntry,
  RemoteSyncResource,
  RemoteSyncDirection,
  RemoteSyncPlanRequest,
  WorkspaceState
} from "@typora-plus/platform";
import { createRemoteSyncResourcesFromWorkspace } from "@typora-plus/platform";

export const workbenchRemoteSyncRequestActions = {
  executeWorkspace: "executeWorkspace",
  planWorkspace: "planWorkspace"
} as const;

export type WorkbenchRemoteSyncRequestAction =
  typeof workbenchRemoteSyncRequestActions[keyof typeof workbenchRemoteSyncRequestActions];

export interface WorkbenchRemoteSyncRequestMessages {
  readonly noWorkspaceOpen: string;
}

export const defaultWorkbenchRemoteSyncRequestMessages: WorkbenchRemoteSyncRequestMessages = {
  noWorkspaceOpen: "No workspace is open for remote sync planning"
};

export interface WorkbenchWorkspaceRemoteSyncRequestOptions {
  readonly direction?: RemoteSyncDirection;
  readonly dryRun?: boolean;
  readonly includeDirectories?: boolean;
  readonly messages?: WorkbenchRemoteSyncRequestMessages;
  readonly metadata?: Readonly<Record<string, string>>;
  readonly remoteScopeId?: string;
  readonly signal?: AbortSignal;
}

export interface WorkbenchFolderRemoteSyncRequestOptions extends WorkbenchWorkspaceRemoteSyncRequestOptions {
  readonly localFolder: FileTreeEntry;
  readonly providerId: string;
  readonly remoteScopeId: string;
}

export function createWorkbenchWorkspaceRemoteSyncPlanRequest(
  workspace: WorkspaceState,
  options: WorkbenchWorkspaceRemoteSyncRequestOptions = {}
): RemoteSyncPlanRequest {
  if (!workspace.files) {
    throw new Error((options.messages ?? defaultWorkbenchRemoteSyncRequestMessages).noWorkspaceOpen);
  }

  const workspaceUri = workspace.rootUri ?? workspace.files.root.uri;

  return {
    workspaceUri,
    resources: createRemoteSyncResourcesFromWorkspace(workspace.files, {
      ...(options.includeDirectories !== undefined ? { includeDirectories: options.includeDirectories } : {})
    }),
    direction: options.direction ?? "push",
    dryRun: options.dryRun ?? true,
    ...(options.remoteScopeId ? { remoteScopeId: options.remoteScopeId } : {}),
    metadata: {
      ...options.metadata,
      action: workbenchRemoteSyncRequestActions.planWorkspace,
      source: "workspace",
      workspaceName: workspace.name,
      workspaceScheme: workspaceUri.scheme
    },
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  };
}

export function createWorkbenchFolderRemoteSyncPlanRequest(
  workspace: WorkspaceState,
  options: WorkbenchFolderRemoteSyncRequestOptions
): RemoteSyncPlanRequest {
  if (!workspace.files) {
    throw new Error((options.messages ?? defaultWorkbenchRemoteSyncRequestMessages).noWorkspaceOpen);
  }

  if (options.localFolder.kind !== "directory") {
    throw new Error("Remote sync folder binding must target a local directory");
  }

  const resources = createRemoteSyncResourcesFromFolder(options.localFolder, {
    ...(options.includeDirectories !== undefined ? { includeDirectories: options.includeDirectories } : {})
  });

  return {
    workspaceUri: options.localFolder.uri,
    resources,
    direction: options.direction ?? "push",
    dryRun: options.dryRun ?? true,
    remoteScopeId: options.remoteScopeId,
    metadata: {
      ...options.metadata,
      action: workbenchRemoteSyncRequestActions.planWorkspace,
      source: "folder",
      providerId: options.providerId,
      workspaceName: workspace.name,
      workspaceScheme: options.localFolder.uri.scheme,
      localFolderName: options.localFolder.name,
      localFolderPath: options.localFolder.relativePath
    },
    ...(options.signal !== undefined ? { signal: options.signal } : {})
  };
}

export function createRemoteSyncResourcesFromFolder(
  folder: FileTreeEntry,
  options: {
    readonly includeDirectories?: boolean;
  } = {}
): readonly RemoteSyncResource[] {
  const prefix = folder.relativePath ? `${folder.relativePath}/` : "";
  const entries = flattenFolderSyncEntries(folder.children ?? [], options.includeDirectories === true);

  return entries.flatMap((entry) => {
    const relativePath = prefix && entry.relativePath.startsWith(prefix)
      ? entry.relativePath.slice(prefix.length)
      : entry.relativePath;

    if (!relativePath) {
      return [];
    }

    return [{
      uri: entry.uri,
      relativePath,
      kind: entry.kind,
      name: entry.name,
      ...(entry.size === undefined ? {} : { size: entry.size }),
      ...(entry.mtime === undefined ? {} : { mtime: entry.mtime })
    }];
  });
}

function flattenFolderSyncEntries(
  entries: readonly FileTreeEntry[],
  includeDirectories: boolean
): readonly FileTreeEntry[] {
  const flattened: FileTreeEntry[] = [];

  for (const entry of entries) {
    if (entry.kind === "file" || includeDirectories) {
      flattened.push(entry);
    }

    if (entry.children) {
      flattened.push(...flattenFolderSyncEntries(entry.children, includeDirectories));
    }
  }

  return flattened;
}
