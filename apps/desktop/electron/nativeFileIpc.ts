import { createHash } from "node:crypto";
import { watch, type FSWatcher, type Stats } from "node:fs";
import fs from "node:fs/promises";
import path from "node:path";
import { TextDecoder } from "node:util";
import { app, BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions } from "electron";

export const nativeFileIpcChannels = {
  openWorkspace: "typora-plus:workspace:open",
  openRecentWorkspace: "typora-plus:workspace:openRecent",
  refreshWorkspace: "typora-plus:workspace:refresh",
  workspaceChanged: "typora-plus:workspace:changed",
  createDirectory: "typora-plus:workspace:createDirectory",
  createFile: "typora-plus:workspace:createFile",
  renameEntry: "typora-plus:workspace:renameEntry",
  deleteEntry: "typora-plus:workspace:deleteEntry",
  readFile: "typora-plus:file:read",
  resolveImageResource: "typora-plus:resource:image",
  writeFile: "typora-plus:file:write",
  saveFileAs: "typora-plus:file:saveAs",
  saveAttachment: "typora-plus:attachment:save",
  remoteSyncReadResource: "typora-plus:remote-sync-resource:read",
  remoteSyncWriteResource: "typora-plus:remote-sync-resource:write",
  remoteSyncDeleteResource: "typora-plus:remote-sync-resource:delete"
} as const;

export interface NativeWorkspaceConfig {
  readonly maxDepth: number;
  readonly maxFiles: number;
  readonly maxImagePreviewBytes: number;
  readonly maxRemoteSyncResourceBytes: number;
  readonly maxTrustedWorkspaces: number;
  readonly defaultAssetFolder: string;
  readonly imagePreviewExtensions: readonly string[];
  readonly trustedWorkspacesStorageFile: string;
  readonly markdownExtensions: readonly string[];
  readonly ignoredDirectories: readonly string[];
}

interface SerializedFileTreeEntry {
  readonly uri: string;
  readonly name: string;
  readonly relativePath: string;
  readonly kind: "file" | "directory";
  readonly size?: number;
  readonly mtime?: number;
  readonly children?: readonly SerializedFileTreeEntry[];
}

interface SerializedWorkspaceFileTree {
  readonly root: SerializedFileTreeEntry;
  readonly files: readonly SerializedFileTreeEntry[];
}

interface SerializedTextFileContent {
  readonly uri: string;
  readonly name: string;
  readonly value: string;
  readonly mtime?: number;
}

interface SerializedSaveFileOptions {
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

interface SerializedCreateWorkspaceEntryRequest {
  readonly parentUri: string;
  readonly name: string;
}

interface SerializedRenameWorkspaceEntryRequest {
  readonly uri: string;
  readonly name: string;
}

interface SerializedCreatedWorkspaceFile {
  readonly entry: SerializedFileTreeEntry;
  readonly workspace: SerializedWorkspaceFileTree;
}

interface SerializedRenamedWorkspaceEntry {
  readonly entry: SerializedFileTreeEntry;
  readonly workspace: SerializedWorkspaceFileTree;
}

interface SerializedFileSaveConflict {
  readonly uri: string;
  readonly expectedMtime?: number;
  readonly diskMtime: number;
}

type SerializedWriteFileResult =
  | { readonly kind: "saved"; readonly content: SerializedTextFileContent }
  | { readonly kind: "conflict"; readonly conflict: SerializedFileSaveConflict };

interface SerializedSavedAttachment {
  readonly uri: string;
  readonly relativePath: string;
  readonly markdown: string;
}

interface SerializedResolvedImageResource {
  readonly dataUrl: string;
  readonly mimeType: string;
  readonly source: string;
}

interface SerializedRemoteSyncWorkspaceResourceReadRequest {
  readonly workspaceUri: string;
  readonly relativePath: string;
}

interface SerializedRemoteSyncWorkspaceResourceWriteRequest {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly value: string;
  readonly encoding: "base64";
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

interface SerializedRemoteSyncWorkspaceResourceDeleteRequest {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

interface SerializedRemoteSyncWorkspaceResourceReadResult {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly value: string;
  readonly encoding: "base64";
  readonly size: number;
  readonly mtime?: number;
  readonly contentHash?: string;
}

interface SerializedRemoteSyncWorkspaceResourceWriteResult {
  readonly workspaceUri: string;
  readonly relativePath: string;
  readonly size: number;
  readonly mtime?: number;
}

const workspaceWatchDebounceMs = 180;
const fileMtimeConflictToleranceMs = 2;

export function registerNativeFileIpc(config: NativeWorkspaceConfig): void {
  let workspaceRoot: string | undefined;
  let workspaceWatcher: FSWatcher | undefined;
  let workspaceRefreshTimer: ReturnType<typeof setTimeout> | undefined;
  let trustedWorkspaceRoots: readonly string[] | undefined;
  const allowedFiles = new Set<string>();

  const loadWorkspace = async () => {
    if (!workspaceRoot) {
      return undefined;
    }

    allowedFiles.clear();

    const workspace = await buildWorkspaceFileTree(workspaceRoot, config);
    for (const file of workspace.files) {
      allowedFiles.add(pathFromFileUri(file.uri));
    }

    return workspace;
  };

  const loadActiveWorkspace = async () => {
    const workspace = await loadWorkspace();

    if (!workspace) {
      throw new Error("No active workspace");
    }

    return workspace;
  };

  const openWorkspaceRoot = async (rootPath: string) => {
    workspaceRoot = await resolveExistingWorkspaceRoot(rootPath);
    const workspace = await loadWorkspace();
    startWorkspaceWatcher();
    return workspace;
  };

  const publishWorkspaceChange = async () => {
    let workspace: SerializedWorkspaceFileTree | undefined;

    try {
      workspace = await loadWorkspace();
    } catch {
      workspace = undefined;
    }

    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(nativeFileIpcChannels.workspaceChanged, workspace);
    }
  };

  const scheduleWorkspaceChange = () => {
    if (workspaceRefreshTimer) {
      clearTimeout(workspaceRefreshTimer);
    }

    workspaceRefreshTimer = setTimeout(() => {
      workspaceRefreshTimer = undefined;
      void publishWorkspaceChange();
    }, workspaceWatchDebounceMs);
  };

  const startWorkspaceWatcher = () => {
    if (workspaceRefreshTimer) {
      clearTimeout(workspaceRefreshTimer);
      workspaceRefreshTimer = undefined;
    }

    workspaceWatcher?.close();
    workspaceWatcher = undefined;

    if (!workspaceRoot) {
      return;
    }

    try {
      workspaceWatcher = watch(workspaceRoot, { recursive: true }, () => {
        scheduleWorkspaceChange();
      });
      workspaceWatcher.on("error", () => {
        workspaceWatcher?.close();
        workspaceWatcher = undefined;
      });
    } catch {
      workspaceWatcher = undefined;
    }
  };

  ipcMain.handle(nativeFileIpcChannels.openWorkspace, async (event) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const options: OpenDialogOptions = {
      title: "Open Workspace",
      properties: ["openDirectory"]
    };
    const result = owner ? await dialog.showOpenDialog(owner, options) : await dialog.showOpenDialog(options);

    if (result.canceled || !result.filePaths[0]) {
      return undefined;
    }

    const selectedRoot = await resolveExistingWorkspaceRoot(result.filePaths[0]);
    const workspace = await openWorkspaceRoot(selectedRoot);

    if (workspace) {
      await rememberTrustedWorkspaceRoot(selectedRoot, config, () => trustedWorkspaceRoots, (roots) => {
        trustedWorkspaceRoots = roots;
      });
    }

    return workspace;
  });

  ipcMain.handle(nativeFileIpcChannels.openRecentWorkspace, async (_event, uri: string) => {
    const requestedRoot = await resolveExistingWorkspaceRoot(pathFromFileUri(uri));
    const trustedRoots = await readTrustedWorkspaceRoots(config, () => trustedWorkspaceRoots, (roots) => {
      trustedWorkspaceRoots = roots;
    });

    if (!trustedRoots.some((trustedRoot) => samePath(trustedRoot, requestedRoot))) {
      throw new Error("Workspace is not trusted by Typora Plus");
    }

    if (!await isDirectory(requestedRoot)) {
      throw new Error("Workspace no longer exists");
    }

    return openWorkspaceRoot(requestedRoot);
  });

  ipcMain.handle(nativeFileIpcChannels.refreshWorkspace, async () => {
    if (!workspaceRoot) {
      return undefined;
    }

    return loadWorkspace();
  });

  ipcMain.handle(nativeFileIpcChannels.createDirectory, async (_event, request: SerializedCreateWorkspaceEntryRequest) => {
    const activeWorkspaceRoot = assertActiveWorkspaceRoot(workspaceRoot);
    const parentPath = assertWritableWorkspaceDirectory(request.parentUri, activeWorkspaceRoot);
    const directoryName = normalizeWorkspaceDirectoryName(request.name, config);
    const directoryPath = path.join(parentPath, directoryName);

    await assertCreatableWorkspaceEntryPath(directoryPath, activeWorkspaceRoot);
    await fs.mkdir(directoryPath);
    scheduleWorkspaceChange();

    return await loadActiveWorkspace();
  });

  ipcMain.handle(nativeFileIpcChannels.createFile, async (_event, request: SerializedCreateWorkspaceEntryRequest) => {
    const activeWorkspaceRoot = assertActiveWorkspaceRoot(workspaceRoot);
    const parentPath = assertWritableWorkspaceDirectory(request.parentUri, activeWorkspaceRoot);
    const fileName = normalizeWorkspaceFileName(request.name, config);
    const filePath = path.join(parentPath, fileName);

    await assertCreatableWorkspaceEntryPath(filePath, activeWorkspaceRoot);
    await fs.writeFile(filePath, "", "utf8");
    allowedFiles.add(filePath);
    scheduleWorkspaceChange();

    const [workspace, stat] = await Promise.all([loadActiveWorkspace(), fs.stat(filePath)]);
    const entry = {
      uri: fileUri(filePath),
      name: path.basename(filePath),
      relativePath: normalizePath(path.relative(activeWorkspaceRoot, filePath)),
      kind: "file",
      size: stat.size,
      mtime: stat.mtimeMs
    } satisfies SerializedFileTreeEntry;

    return {
      entry,
      workspace
    } satisfies SerializedCreatedWorkspaceFile;
  });

  ipcMain.handle(nativeFileIpcChannels.renameEntry, async (_event, request: SerializedRenameWorkspaceEntryRequest) => {
    const activeWorkspaceRoot = assertActiveWorkspaceRoot(workspaceRoot);
    const sourcePath = await assertMutableWorkspaceEntryPath(request.uri, activeWorkspaceRoot, config);
    const sourceStat = await fs.lstat(sourcePath);
    const targetName = sourceStat.isDirectory()
      ? normalizeWorkspaceDirectoryName(request.name, config)
      : normalizeWorkspaceFileName(request.name, config);
    const targetPath = path.join(path.dirname(sourcePath), targetName);

    await assertCreatableWorkspaceEntryPath(targetPath, activeWorkspaceRoot);
    await assertRemoteSyncWorkspaceRealPathInside(sourcePath, activeWorkspaceRoot);
    await fs.rename(sourcePath, targetPath);
    scheduleWorkspaceChange();

    const workspace = await loadActiveWorkspace();
    const entry = findWorkspaceEntryByPath(workspace.root, targetPath);

    if (!entry) {
      throw new Error("Renamed workspace entry is not visible in the active workspace");
    }

    return {
      entry,
      workspace
    } satisfies SerializedRenamedWorkspaceEntry;
  });

  ipcMain.handle(nativeFileIpcChannels.deleteEntry, async (_event, uri: string) => {
    const activeWorkspaceRoot = assertActiveWorkspaceRoot(workspaceRoot);
    const entryPath = await assertMutableWorkspaceEntryPath(uri, activeWorkspaceRoot, config);
    const stat = await fs.lstat(entryPath);

    await assertRemoteSyncWorkspaceRealPathInside(entryPath, activeWorkspaceRoot);
    await fs.rm(entryPath, { recursive: stat.isDirectory(), force: false });
    allowedFiles.delete(entryPath);
    scheduleWorkspaceChange();

    return await loadActiveWorkspace();
  });

  ipcMain.handle(nativeFileIpcChannels.readFile, async (_event, uri: string) => {
    const filePath = assertReadableFile(uri, workspaceRoot, allowedFiles, config);
    const [value, stat] = await Promise.all([fs.readFile(filePath, "utf8"), fs.stat(filePath)]);

    return {
      uri: fileUri(filePath),
      name: path.basename(filePath),
      value,
      mtime: stat.mtimeMs
    } satisfies SerializedTextFileContent;
  });

  ipcMain.handle(nativeFileIpcChannels.resolveImageResource, async (_event, noteUri: string, source: string) => {
    const notePath = assertReadableFile(noteUri, workspaceRoot, allowedFiles, config);
    const imagePath = resolveImageResourcePath(notePath, workspaceRoot, source, config);

    if (!imagePath) {
      return undefined;
    }

    try {
      const stat = await fs.stat(imagePath);
      if (!stat.isFile() || stat.size > config.maxImagePreviewBytes) {
        return undefined;
      }

      const mimeType = imageMimeType(imagePath, config);
      if (!mimeType) {
        return undefined;
      }

      const buffer = await fs.readFile(imagePath);
      return {
        dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
        mimeType,
        source
      } satisfies SerializedResolvedImageResource;
    } catch {
      return undefined;
    }
  });

  ipcMain.handle(nativeFileIpcChannels.writeFile, async (_event, uri: string, value: string, options: SerializedSaveFileOptions = {}) => {
    const filePath = assertWritableFile(uri, workspaceRoot, allowedFiles, config);
    const beforeWrite = await fs.stat(filePath);

    if (hasSaveConflict(beforeWrite.mtimeMs, options)) {
      return {
        kind: "conflict",
        conflict: {
          uri: fileUri(filePath),
          diskMtime: beforeWrite.mtimeMs,
          ...(options.expectedMtime === undefined ? {} : { expectedMtime: options.expectedMtime })
        }
      } satisfies SerializedWriteFileResult;
    }

    await fs.writeFile(filePath, value, "utf8");
    const stat = await fs.stat(filePath);

    return {
      kind: "saved",
      content: {
        uri: fileUri(filePath),
        name: path.basename(filePath),
        value,
        mtime: stat.mtimeMs
      }
    } satisfies SerializedWriteFileResult;
  });

  ipcMain.handle(nativeFileIpcChannels.saveFileAs, async (event, defaultName: string, value: string) => {
    const owner = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    const options: SaveDialogOptions = {
      title: "Save Note",
      defaultPath: defaultName,
      filters: [{ name: "Markdown", extensions: config.markdownExtensions.map((extension) => extension.slice(1)) }]
    };
    const result = owner ? await dialog.showSaveDialog(owner, options) : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath) {
      return undefined;
    }

    const filePath = path.resolve(result.filePath);
    assertMarkdownFile(filePath, config);
    await fs.writeFile(filePath, value, "utf8");
    allowedFiles.add(filePath);

    const stat = await fs.stat(filePath);
    return {
      uri: fileUri(filePath),
      name: path.basename(filePath),
      value,
      mtime: stat.mtimeMs
    } satisfies SerializedTextFileContent;
  });

  ipcMain.handle(
    nativeFileIpcChannels.saveAttachment,
    async (_event, noteUri: string, image: { readonly name: string; readonly mimeType: string; readonly base64: string }, assetFolder: string) => {
      const notePath = assertWritableFile(noteUri, workspaceRoot, allowedFiles, config);
      const attachmentPath = await createAttachmentPath(notePath, workspaceRoot, image, assetFolder || config.defaultAssetFolder);
      await fs.writeFile(attachmentPath, Buffer.from(image.base64, "base64"));

      const relativePath = normalizePath(path.relative(path.dirname(notePath), attachmentPath));
      return {
        uri: fileUri(attachmentPath),
        relativePath,
        markdown: `![${markdownAltText(image.name)}](${encodeMarkdownPath(relativePath)})`
      } satisfies SerializedSavedAttachment;
    }
  );

  ipcMain.handle(
    nativeFileIpcChannels.remoteSyncReadResource,
    async (_event, request: SerializedRemoteSyncWorkspaceResourceReadRequest) => {
      const resource = resolveRemoteSyncWorkspaceResourcePath(request, workspaceRoot, config);
      const stat = await statRemoteSyncWorkspaceFile(resource.filePath, resource.workspaceRoot);

      if (stat.size > config.maxRemoteSyncResourceBytes) {
        throw new Error("Remote sync workspace resource is too large");
      }

      const value = await fs.readFile(resource.filePath);

      if (value.byteLength > config.maxRemoteSyncResourceBytes) {
        throw new Error("Remote sync workspace resource is too large");
      }

      return {
        workspaceUri: fileUri(resource.workspaceRoot),
        relativePath: resource.relativePath,
        value: value.toString("base64"),
        encoding: "base64",
        size: stat.size,
        mtime: stat.mtimeMs,
        contentHash: createRemoteSyncWorkspaceResourceContentHash(value)
      } satisfies SerializedRemoteSyncWorkspaceResourceReadResult;
    }
  );

  ipcMain.handle(
    nativeFileIpcChannels.remoteSyncWriteResource,
    async (_event, request: SerializedRemoteSyncWorkspaceResourceWriteRequest) => {
      const resource = resolveRemoteSyncWorkspaceResourcePath(request, workspaceRoot, config);
      const value = decodeRemoteSyncWorkspaceResourceValue(request);

      if (value.byteLength > config.maxRemoteSyncResourceBytes) {
        throw new Error("Remote sync workspace resource is too large");
      }

      const beforeWrite = await lstatIfExists(resource.filePath);

      if (beforeWrite?.isSymbolicLink()) {
        throw new Error("Remote sync workspace resource must not be a symbolic link");
      }

      if (beforeWrite?.isDirectory()) {
        throw new Error("Remote sync workspace resource must be a file");
      }

      if (beforeWrite && hasSaveConflict(beforeWrite.mtimeMs, request)) {
        throw new Error("Remote sync workspace resource changed on disk");
      }

      await fs.mkdir(path.dirname(resource.filePath), { recursive: true });
      await assertRemoteSyncWorkspaceRealPathInside(path.dirname(resource.filePath), resource.workspaceRoot);
      await fs.writeFile(resource.filePath, value);
      allowedFiles.add(resource.filePath);
      scheduleWorkspaceChange();

      const stat = await statRemoteSyncWorkspaceFile(resource.filePath, resource.workspaceRoot);
      return {
        workspaceUri: fileUri(resource.workspaceRoot),
        relativePath: resource.relativePath,
        size: stat.size,
        mtime: stat.mtimeMs
      } satisfies SerializedRemoteSyncWorkspaceResourceWriteResult;
    }
  );

  ipcMain.handle(
    nativeFileIpcChannels.remoteSyncDeleteResource,
    async (_event, request: SerializedRemoteSyncWorkspaceResourceDeleteRequest) => {
      const resource = resolveRemoteSyncWorkspaceResourcePath(request, workspaceRoot, config);
      const stat = await lstatIfExists(resource.filePath);

      if (!stat) {
        return false;
      }

      if (stat.isSymbolicLink()) {
        throw new Error("Remote sync workspace resource must not be a symbolic link");
      }

      if (!stat.isFile()) {
        throw new Error("Remote sync workspace resource must be a file");
      }

      await assertRemoteSyncWorkspaceRealPathInside(resource.filePath, resource.workspaceRoot);

      if (hasSaveConflict(stat.mtimeMs, request)) {
        throw new Error("Remote sync workspace resource changed on disk");
      }

      await fs.unlink(resource.filePath);
      allowedFiles.delete(resource.filePath);
      scheduleWorkspaceChange();
      return true;
    }
  );
}

async function rememberTrustedWorkspaceRoot(
  rootPath: string,
  config: NativeWorkspaceConfig,
  readCache: () => readonly string[] | undefined,
  writeCache: (roots: readonly string[]) => void
): Promise<void> {
  const root = path.resolve(rootPath);
  const roots = await readTrustedWorkspaceRoots(config, readCache, writeCache);
  const nextRoots = [
    root,
    ...roots.filter((trustedRoot) => !samePath(trustedRoot, root))
  ].slice(0, config.maxTrustedWorkspaces);

  writeCache(nextRoots);

  try {
    await writeTrustedWorkspaceRoots(config, nextRoots);
  } catch {
    // Persisting trust is best-effort; opening the chosen workspace should still succeed.
  }
}

async function readTrustedWorkspaceRoots(
  config: NativeWorkspaceConfig,
  readCache: () => readonly string[] | undefined,
  writeCache: (roots: readonly string[]) => void
): Promise<readonly string[]> {
  const cached = readCache();

  if (cached) {
    return cached;
  }

  try {
    const rawValue = await fs.readFile(trustedWorkspaceStoragePath(config), "utf8");
    const parsed = JSON.parse(rawValue) as SerializedTrustedWorkspaces;
    const normalizedRoots = normalizeTrustedWorkspaceRoots(parsed.roots, config.maxTrustedWorkspaces);
    const roots = await resolveExistingWorkspaceRoots(normalizedRoots);
    writeCache(roots);
    if (JSON.stringify(roots) !== JSON.stringify(normalizedRoots)) {
      void writeTrustedWorkspaceRoots(config, roots).catch(() => {
        // Trust-list migration is best-effort; the in-memory repaired roots are still used.
      });
    }
    return roots;
  } catch {
    writeCache([]);
    return [];
  }
}

async function writeTrustedWorkspaceRoots(
  config: NativeWorkspaceConfig,
  roots: readonly string[]
): Promise<void> {
  const storagePath = trustedWorkspaceStoragePath(config);
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify({ version: 1, roots }, null, 2), "utf8");
}

interface SerializedTrustedWorkspaces {
  readonly roots?: unknown;
}

function normalizeTrustedWorkspaceRoots(value: unknown, maxEntries: number): readonly string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const roots: string[] = [];

  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    const root = path.resolve(candidate);

    if (!roots.some((trustedRoot) => samePath(trustedRoot, root))) {
      roots.push(root);
    }

    if (roots.length >= maxEntries) {
      break;
    }
  }

  return roots;
}

function trustedWorkspaceStoragePath(config: NativeWorkspaceConfig): string {
  return path.join(app.getPath("userData"), config.trustedWorkspacesStorageFile);
}

async function isDirectory(value: string): Promise<boolean> {
  try {
    return (await fs.stat(value)).isDirectory();
  } catch {
    return false;
  }
}

async function resolveExistingWorkspaceRoots(roots: readonly string[]): Promise<readonly string[]> {
  const resolved: string[] = [];

  for (const root of roots) {
    const candidate = await resolveExistingWorkspaceRoot(root);

    if (!resolved.some((trustedRoot) => samePath(trustedRoot, candidate))) {
      resolved.push(candidate);
    }
  }

  return resolved;
}

async function resolveExistingWorkspaceRoot(rootPath: string): Promise<string> {
  const root = path.resolve(rootPath);

  if (await isDirectory(root)) {
    return root;
  }

  return await resolveUtf8AsGbkMojibakePath(root) ?? root;
}

async function resolveUtf8AsGbkMojibakePath(filePath: string): Promise<string | undefined> {
  const resolvedPath = path.resolve(filePath);
  const parsed = path.parse(resolvedPath);
  const relativeParts = path.relative(parsed.root, resolvedPath).split(path.sep).filter(Boolean);
  let currentPath = parsed.root;

  for (const part of relativeParts) {
    const directPath = path.join(currentPath, part);

    if (await exists(directPath)) {
      currentPath = directPath;
      continue;
    }

    const replacement = await findUtf8AsGbkMojibakePathSegment(currentPath, part);

    if (!replacement) {
      return undefined;
    }

    currentPath = path.join(currentPath, replacement);
  }

  return await isDirectory(currentPath) ? currentPath : undefined;
}

async function findUtf8AsGbkMojibakePathSegment(parentPath: string, segment: string): Promise<string | undefined> {
  let entries: readonly { readonly name: string; readonly isDirectory: () => boolean }[];

  try {
    entries = await fs.readdir(parentPath, { withFileTypes: true });
  } catch {
    return undefined;
  }

  return entries.find((entry) =>
    entry.isDirectory() && createUtf8AsGbkMojibakeText(entry.name) === segment
  )?.name;
}

function createUtf8AsGbkMojibakeText(value: string): string {
  try {
    return new TextDecoder("gbk").decode(Buffer.from(value, "utf8"));
  } catch {
    return value;
  }
}

async function buildWorkspaceFileTree(
  rootPath: string,
  config: NativeWorkspaceConfig
): Promise<SerializedWorkspaceFileTree> {
  let fileCount = 0;
  const root = await readDirectory(rootPath, rootPath, 0, config, () => {
    fileCount += 1;
    return fileCount <= config.maxFiles;
  });

  return {
    root,
    files: flatten(root)
  };
}

async function readDirectory(
  rootPath: string,
  directoryPath: string,
  depth: number,
  config: NativeWorkspaceConfig,
  acceptFile: () => boolean
): Promise<SerializedFileTreeEntry> {
  const dirents = depth >= config.maxDepth
    ? []
    : await fs.readdir(directoryPath, { withFileTypes: true });
  const children: SerializedFileTreeEntry[] = [];

  for (const dirent of dirents.sort(compareDirents)) {
    const entryPath = path.join(directoryPath, dirent.name);

    if (dirent.isDirectory()) {
      if (config.ignoredDirectories.includes(dirent.name)) {
        continue;
      }

      const directory = await readDirectory(rootPath, entryPath, depth + 1, config, acceptFile);
      children.push(directory);
      continue;
    }

    if (!dirent.isFile() || !isMarkdownFile(entryPath, config) || !acceptFile()) {
      continue;
    }

    const stat = await fs.stat(entryPath);
    children.push({
      uri: fileUri(entryPath),
      name: dirent.name,
      relativePath: normalizePath(path.relative(rootPath, entryPath)),
      kind: "file",
      size: stat.size,
      mtime: stat.mtimeMs
    });
  }

  return {
    uri: fileUri(directoryPath),
    name: path.basename(directoryPath),
    relativePath: normalizePath(path.relative(rootPath, directoryPath)),
    kind: "directory",
    children
  };
}

function compareDirents(first: { readonly isDirectory: () => boolean; readonly name: string }, second: { readonly isDirectory: () => boolean; readonly name: string }): number {
  if (first.isDirectory() !== second.isDirectory()) {
    return first.isDirectory() ? -1 : 1;
  }

  return first.name.localeCompare(second.name);
}

function flatten(root: SerializedFileTreeEntry): SerializedFileTreeEntry[] {
  if (root.kind === "file") {
    return [root];
  }

  return (root.children ?? []).flatMap((child) => flatten(child));
}

function assertReadableFile(
  uri: string,
  workspaceRoot: string | undefined,
  allowedFiles: ReadonlySet<string>,
  config: NativeWorkspaceConfig
): string {
  const filePath = pathFromFileUri(uri);

  if (!isFileAllowed(filePath, workspaceRoot, allowedFiles)) {
    throw new Error("File is outside the active workspace");
  }

  assertMarkdownFile(filePath, config);
  return filePath;
}

function assertWritableFile(
  uri: string,
  workspaceRoot: string | undefined,
  allowedFiles: ReadonlySet<string>,
  config: NativeWorkspaceConfig
): string {
  return assertReadableFile(uri, workspaceRoot, allowedFiles, config);
}

function assertActiveWorkspaceRoot(workspaceRoot: string | undefined): string {
  if (!workspaceRoot) {
    throw new Error("No active workspace");
  }

  return workspaceRoot;
}

function assertWritableWorkspaceDirectory(uri: string, workspaceRoot: string): string {
  const directoryPath = pathFromFileUri(uri);

  if (!isPathInside(directoryPath, workspaceRoot)) {
    throw new Error("Directory is outside the active workspace");
  }

  return directoryPath;
}

async function assertCreatableWorkspaceEntryPath(filePath: string, workspaceRoot: string): Promise<void> {
  if (!isPathInside(filePath, workspaceRoot)) {
    throw new Error("Workspace entry path is outside the active workspace");
  }

  const parentPath = path.dirname(filePath);
  const parentStat = await fs.lstat(parentPath);

  if (parentStat.isSymbolicLink()) {
    throw new Error("Workspace entry parent must not be a symbolic link");
  }

  if (!parentStat.isDirectory()) {
    throw new Error("Workspace entry parent must be a directory");
  }

  await assertRemoteSyncWorkspaceRealPathInside(parentPath, workspaceRoot);

  if (await exists(filePath)) {
    throw new Error("Workspace entry already exists");
  }
}

async function assertMutableWorkspaceEntryPath(
  uri: string,
  workspaceRoot: string,
  config: NativeWorkspaceConfig
): Promise<string> {
  const entryPath = pathFromFileUri(uri);

  if (samePath(entryPath, workspaceRoot)) {
    throw new Error("Workspace root cannot be renamed or deleted");
  }

  if (!isPathInside(entryPath, workspaceRoot)) {
    throw new Error("Workspace entry is outside the active workspace");
  }

  const stat = await fs.lstat(entryPath);

  if (stat.isSymbolicLink()) {
    throw new Error("Workspace entry must not be a symbolic link");
  }

  if (!stat.isFile() && !stat.isDirectory()) {
    throw new Error("Workspace entry must be a file or directory");
  }

  if (stat.isFile()) {
    assertMarkdownFile(entryPath, config);
  }

  return entryPath;
}

function findWorkspaceEntryByPath(
  entry: SerializedFileTreeEntry,
  filePath: string
): SerializedFileTreeEntry | undefined {
  if (samePath(pathFromFileUri(entry.uri), filePath)) {
    return entry;
  }

  for (const child of entry.children ?? []) {
    const found = findWorkspaceEntryByPath(child, filePath);

    if (found) {
      return found;
    }
  }

  return undefined;
}

function normalizeWorkspaceFileName(value: unknown, config: NativeWorkspaceConfig): string {
  const name = normalizeWorkspaceEntryName(value, "Workspace file name", config);
  const extension = path.extname(name);

  if (!extension) {
    return `${name}${config.markdownExtensions[0] ?? ".md"}`;
  }

  assertMarkdownFile(name, config);
  return name;
}

function normalizeWorkspaceDirectoryName(value: unknown, config: NativeWorkspaceConfig): string {
  const name = normalizeWorkspaceEntryName(value, "Workspace folder name", config);

  if (config.ignoredDirectories.includes(name)) {
    throw new Error("Workspace folder name is ignored by Typora Plus");
  }

  return name;
}

function normalizeWorkspaceEntryName(value: unknown, label: string, config: NativeWorkspaceConfig): string {
  const name = readRequiredString(value, label);

  if (name !== path.basename(name) || /[<>:"/\\|?*\u0000-\u001F]/.test(name)) {
    throw new Error(`${label} must be a simple file name`);
  }

  if (name === "." || name === "..") {
    throw new Error(`${label} is invalid`);
  }

  if (config.ignoredDirectories.includes(name)) {
    throw new Error(`${label} uses an ignored directory name`);
  }

  return name;
}

function resolveImageResourcePath(
  notePath: string,
  workspaceRoot: string | undefined,
  source: string,
  config: NativeWorkspaceConfig
): string | undefined {
  const relativeSource = decodeMarkdownResourcePath(source);
  if (!relativeSource || path.isAbsolute(relativeSource) || hasUriScheme(relativeSource)) {
    return undefined;
  }

  const root = workspaceRoot && isPathInside(notePath, workspaceRoot)
    ? workspaceRoot
    : path.dirname(notePath);
  const candidate = path.resolve(path.dirname(notePath), relativeSource);

  if (!isPathInside(candidate, root) || !isImagePreviewFile(candidate, config)) {
    return undefined;
  }

  return candidate;
}

function decodeMarkdownResourcePath(source: string): string | undefined {
  const pathSource = source.trim().split(/[?#]/, 1)[0];

  if (!pathSource) {
    return undefined;
  }

  try {
    return decodeURIComponent(pathSource);
  } catch {
    return pathSource;
  }
}

function hasUriScheme(value: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(value);
}

function hasSaveConflict(diskMtime: number, options: SerializedSaveFileOptions): boolean {
  return !options.overwrite
    && options.expectedMtime !== undefined
    && diskMtime > options.expectedMtime + fileMtimeConflictToleranceMs;
}

function resolveRemoteSyncWorkspaceResourcePath(
  request: SerializedRemoteSyncWorkspaceResourceReadRequest,
  workspaceRoot: string | undefined,
  config: NativeWorkspaceConfig
): {
  readonly workspaceRoot: string;
  readonly relativePath: string;
  readonly filePath: string;
} {
  if (!workspaceRoot) {
    throw new Error("No active workspace for remote sync resource access");
  }

  const requestedWorkspaceRoot = pathFromFileUri(readRequiredString(
    request.workspaceUri,
    "Remote sync workspace resource workspace URI"
  ));

  if (!isPathInside(requestedWorkspaceRoot, workspaceRoot)) {
    throw new Error("Remote sync workspace resource workspace is not active");
  }

  const relativePath = normalizeRemoteSyncWorkspaceResourceRelativePath(request.relativePath, config);
  const filePath = path.resolve(requestedWorkspaceRoot, ...relativePath.split("/"));

  if (!isPathInside(filePath, requestedWorkspaceRoot) || !isPathInside(filePath, workspaceRoot)) {
    throw new Error("Remote sync workspace resource path is outside the active workspace");
  }

  return {
    workspaceRoot: requestedWorkspaceRoot,
    relativePath,
    filePath
  };
}

function normalizeRemoteSyncWorkspaceResourceRelativePath(
  value: unknown,
  config: NativeWorkspaceConfig
): string {
  const normalized = readRequiredString(value, "Remote sync workspace resource relative path")
    .replaceAll("\\", "/");

  if (normalized.startsWith("/") || hasUriScheme(normalized)) {
    throw new Error("Remote sync workspace resource relative path must be workspace-relative");
  }

  const segments: string[] = [];

  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      throw new Error("Remote sync workspace resource relative path must not contain parent traversal");
    }

    if (config.ignoredDirectories.includes(segment)) {
      throw new Error("Remote sync workspace resource path uses an ignored directory");
    }

    segments.push(segment);
  }

  const relativePath = segments.join("/");

  if (!relativePath) {
    throw new Error("Remote sync workspace resource relative path must not be empty");
  }

  return relativePath;
}

function decodeRemoteSyncWorkspaceResourceValue(
  request: SerializedRemoteSyncWorkspaceResourceWriteRequest
): Buffer {
  if (request.encoding !== "base64") {
    throw new Error("Remote sync workspace resource encoding must be base64");
  }

  const value = readString(request.value, "Remote sync workspace resource value");

  if (!isBase64Value(value)) {
    throw new Error("Remote sync workspace resource value must be base64");
  }

  return Buffer.from(value, "base64");
}

function createRemoteSyncWorkspaceResourceContentHash(value: Buffer): string {
  return `sha256:${createHash("sha256").update(value).digest("hex")}`;
}

function isBase64Value(value: string): boolean {
  if (value === "") {
    return true;
  }

  return value === value.trim() &&
    value.length % 4 === 0 &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(value);
}

async function lstatIfExists(filePath: string): Promise<Stats | undefined> {
  try {
    return await fs.lstat(filePath);
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT") {
      return undefined;
    }

    throw error;
  }
}

async function statRemoteSyncWorkspaceFile(filePath: string, workspaceRoot: string): Promise<Stats> {
  const linkStat = await fs.lstat(filePath);

  if (linkStat.isSymbolicLink()) {
    throw new Error("Remote sync workspace resource must not be a symbolic link");
  }

  const stat = await fs.stat(filePath);

  if (!stat.isFile()) {
    throw new Error("Remote sync workspace resource must be a file");
  }

  await assertRemoteSyncWorkspaceRealPathInside(filePath, workspaceRoot);

  return stat;
}

async function assertRemoteSyncWorkspaceRealPathInside(filePath: string, workspaceRoot: string): Promise<void> {
  const [realPath, realWorkspaceRoot] = await Promise.all([
    fs.realpath(filePath),
    fs.realpath(workspaceRoot)
  ]);

  if (!isPathInside(realPath, realWorkspaceRoot)) {
    throw new Error("Remote sync workspace resource path is outside the active workspace");
  }
}

function readRequiredString(value: unknown, label: string): string {
  const normalized = readString(value, label).trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}

function readString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  return value;
}

function samePath(first: string, second: string): boolean {
  return comparablePath(first) === comparablePath(second);
}

function comparablePath(value: string): string {
  const resolved = path.resolve(value);
  return process.platform === "win32" ? resolved.toLowerCase() : resolved;
}

function isFileAllowed(filePath: string, workspaceRoot: string | undefined, allowedFiles: ReadonlySet<string>): boolean {
  if (allowedFiles.has(filePath)) {
    return true;
  }

  if (!workspaceRoot) {
    return false;
  }

  const relativePath = path.relative(workspaceRoot, filePath);
  return relativePath !== "" && !relativePath.startsWith("..") && !path.isAbsolute(relativePath);
}

function isPathInside(filePath: string, rootPath: string): boolean {
  const relativePath = path.relative(rootPath, filePath);
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function assertMarkdownFile(filePath: string, config: NativeWorkspaceConfig): void {
  if (!isMarkdownFile(filePath, config)) {
    throw new Error("Only Markdown files can be opened or saved by Typora Plus");
  }
}

function imageMimeType(filePath: string, config: NativeWorkspaceConfig): string | undefined {
  if (!isImagePreviewFile(filePath, config)) {
    return undefined;
  }

  switch (path.extname(filePath).toLowerCase()) {
    case ".gif":
      return "image/gif";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".png":
      return "image/png";
    case ".svg":
      return "image/svg+xml";
    case ".webp":
      return "image/webp";
    default:
      return undefined;
  }
}

function isImagePreviewFile(filePath: string, config: NativeWorkspaceConfig): boolean {
  return config.imagePreviewExtensions.includes(path.extname(filePath).toLowerCase());
}

async function createAttachmentPath(
  notePath: string,
  workspaceRoot: string | undefined,
  image: { readonly name: string; readonly mimeType: string },
  assetFolder: string
): Promise<string> {
  const noteDirectory = path.dirname(notePath);
  const noteName = sanitizeFileSegment(path.basename(notePath, path.extname(notePath)));
  const root = workspaceRoot && isFileAllowed(notePath, workspaceRoot, new Set([notePath]))
    ? workspaceRoot
    : noteDirectory;
  const attachmentDirectory = path.join(root, sanitizeFileSegment(assetFolder), noteName);
  await fs.mkdir(attachmentDirectory, { recursive: true });

  const extension = extensionFromImage(image);
  const baseName = `image-${timestampSegment(new Date())}`;
  let candidate = path.join(attachmentDirectory, `${baseName}${extension}`);
  let counter = 2;

  while (await exists(candidate)) {
    candidate = path.join(attachmentDirectory, `${baseName}-${counter}${extension}`);
    counter += 1;
  }

  return candidate;
}

function extensionFromImage(image: { readonly name: string; readonly mimeType: string }): string {
  const extension = path.extname(image.name).toLowerCase();

  if (extension) {
    return extension;
  }

  switch (image.mimeType) {
    case "image/jpeg":
      return ".jpg";
    case "image/webp":
      return ".webp";
    case "image/gif":
      return ".gif";
    case "image/svg+xml":
      return ".svg";
    default:
      return ".png";
  }
}

function timestampSegment(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    "-",
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds())
  ].join("");
}

function sanitizeFileSegment(value: string): string {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, "-")
    .replace(/^\.+$/g, "-")
    .slice(0, 80) || "attachment";
}

function markdownAltText(value: string): string {
  return path.basename(value, path.extname(value)).replace(/[!\[\]\n\r]/g, " ").trim() || "image";
}

function encodeMarkdownPath(value: string): string {
  return value.split("/").map((part) => encodeURIComponent(part)).join("/");
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function isMarkdownFile(filePath: string, config: NativeWorkspaceConfig): boolean {
  return config.markdownExtensions.includes(path.extname(filePath).toLowerCase());
}

function fileUri(filePath: string): string {
  return `file://${encodeFileUriPath(normalizePath(path.resolve(filePath)))}`;
}

function pathFromFileUri(uri: string): string {
  if (!uri.startsWith("file://")) {
    throw new Error(`Unsupported URI: ${uri}`);
  }

  return path.resolve(decodeFileUriPath(uri.slice("file://".length)));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}

function encodeFileUriPath(value: string): string {
  return value
    .split("/")
    .map((segment, index) => index === 0 && /^[A-Za-z]:$/.test(segment)
      ? segment
      : encodeURIComponent(segment))
    .join("/");
}

function decodeFileUriPath(value: string): string {
  return value
    .split("/")
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    })
    .join("/");
}
