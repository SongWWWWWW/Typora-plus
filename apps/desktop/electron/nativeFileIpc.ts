import fs from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, dialog, ipcMain, type OpenDialogOptions, type SaveDialogOptions } from "electron";

export const nativeFileIpcChannels = {
  openWorkspace: "typora-plus:workspace:open",
  readFile: "typora-plus:file:read",
  writeFile: "typora-plus:file:write",
  saveFileAs: "typora-plus:file:saveAs"
} as const;

export interface NativeWorkspaceConfig {
  readonly maxDepth: number;
  readonly maxFiles: number;
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

export function registerNativeFileIpc(config: NativeWorkspaceConfig): void {
  let workspaceRoot: string | undefined;
  const allowedFiles = new Set<string>();

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

    workspaceRoot = path.resolve(result.filePaths[0]);
    allowedFiles.clear();

    const workspace = await buildWorkspaceFileTree(workspaceRoot, config);
    for (const file of workspace.files) {
      allowedFiles.add(pathFromFileUri(file.uri));
    }

    return workspace;
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

  ipcMain.handle(nativeFileIpcChannels.writeFile, async (_event, uri: string, value: string) => {
    const filePath = assertWritableFile(uri, workspaceRoot, allowedFiles, config);
    await fs.writeFile(filePath, value, "utf8");
    const stat = await fs.stat(filePath);

    return {
      uri: fileUri(filePath),
      name: path.basename(filePath),
      value,
      mtime: stat.mtimeMs
    } satisfies SerializedTextFileContent;
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
      if ((directory.children?.length ?? 0) > 0) {
        children.push(directory);
      }
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

function assertMarkdownFile(filePath: string, config: NativeWorkspaceConfig): void {
  if (!isMarkdownFile(filePath, config)) {
    throw new Error("Only Markdown files can be opened or saved by Typora Plus");
  }
}

function isMarkdownFile(filePath: string, config: NativeWorkspaceConfig): boolean {
  return config.markdownExtensions.includes(path.extname(filePath).toLowerCase());
}

function fileUri(filePath: string): string {
  return `file://${normalizePath(path.resolve(filePath))}`;
}

function pathFromFileUri(uri: string): string {
  if (!uri.startsWith("file://")) {
    throw new Error(`Unsupported URI: ${uri}`);
  }

  return path.resolve(uri.slice("file://".length));
}

function normalizePath(value: string): string {
  return value.replaceAll("\\", "/");
}
