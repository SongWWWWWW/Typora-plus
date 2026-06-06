import { Emitter, URI, type Event, type IDisposable, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type FileKind = "file" | "directory";

export interface FileTreeEntry {
  readonly uri: URIType;
  readonly name: string;
  readonly relativePath: string;
  readonly kind: FileKind;
  readonly size?: number;
  readonly mtime?: number;
  readonly children?: readonly FileTreeEntry[];
}

export interface WorkspaceFileTree {
  readonly root: FileTreeEntry;
  readonly files: readonly FileTreeEntry[];
}

export interface TextFileContent {
  readonly uri: URIType;
  readonly name: string;
  readonly value: string;
  readonly mtime?: number;
}

export interface SaveFileOptions {
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

export interface FileSaveConflict {
  readonly uri: URIType;
  readonly expectedMtime?: number;
  readonly diskMtime: number;
}

export class FileSaveConflictError extends Error {
  readonly code = "FILE_SAVE_CONFLICT";

  constructor(readonly conflict: FileSaveConflict) {
    super("File changed on disk");
    this.name = "FileSaveConflictError";
  }
}

export interface NativeFileSystemHost {
  readonly isAvailable: boolean;
  readonly onDidChangeWorkspaceFiles?: Event<WorkspaceFileTree | undefined>;
  openWorkspace(): Promise<WorkspaceFileTree | undefined>;
  refreshWorkspace(): Promise<WorkspaceFileTree | undefined>;
  readFile(uri: string): Promise<TextFileContent>;
  writeFile(uri: string, value: string, options?: SaveFileOptions): Promise<TextFileContent>;
  saveFileAs(defaultName: string, value: string): Promise<TextFileContent | undefined>;
}

export interface SerializedFileTreeEntry {
  readonly uri: string;
  readonly name: string;
  readonly relativePath: string;
  readonly kind: FileKind;
  readonly size?: number;
  readonly mtime?: number;
  readonly children?: readonly SerializedFileTreeEntry[];
}

export interface SerializedWorkspaceFileTree {
  readonly root: SerializedFileTreeEntry;
  readonly files: readonly SerializedFileTreeEntry[];
}

export interface SerializedTextFileContent {
  readonly uri: string;
  readonly name: string;
  readonly value: string;
  readonly mtime?: number;
}

export interface SerializedSaveFileOptions {
  readonly expectedMtime?: number;
  readonly overwrite?: boolean;
}

export interface SerializedFileSaveConflict {
  readonly uri: string;
  readonly expectedMtime?: number;
  readonly diskMtime: number;
}

export type SerializedWriteFileResult =
  | { readonly kind: "saved"; readonly content: SerializedTextFileContent }
  | { readonly kind: "conflict"; readonly conflict: SerializedFileSaveConflict };

export interface NativeFileSystemBridge {
  readonly isAvailable: boolean;
  onDidChangeWorkspaceFiles?(listener: (workspace: SerializedWorkspaceFileTree | undefined) => void): () => void;
  openWorkspace(): Promise<SerializedWorkspaceFileTree | undefined>;
  refreshWorkspace(): Promise<SerializedWorkspaceFileTree | undefined>;
  readFile(uri: string): Promise<SerializedTextFileContent>;
  writeFile(uri: string, value: string, options?: SerializedSaveFileOptions): Promise<SerializedWriteFileResult>;
  saveFileAs(defaultName: string, value: string): Promise<SerializedTextFileContent | undefined>;
}

export interface IFileService {
  readonly onDidChangeWorkspaceFiles: Event<WorkspaceFileTree | undefined>;
  isAvailable(): boolean;
  getWorkspaceFiles(): WorkspaceFileTree | undefined;
  openWorkspace(): Promise<WorkspaceFileTree | undefined>;
  refreshWorkspace(): Promise<WorkspaceFileTree | undefined>;
  openFile(uri: URIType): Promise<TextFileContent>;
  saveFile(uri: URIType, value: string, options?: SaveFileOptions): Promise<TextFileContent>;
  saveFileAs(defaultName: string, value: string): Promise<TextFileContent | undefined>;
}

export const IFileService = createServiceIdentifier<IFileService>("file");

export class NativeFileService implements IFileService {
  private readonly emitter = new Emitter<WorkspaceFileTree | undefined>();
  private readonly workspaceChangeSubscription: IDisposable | undefined;
  private workspaceFiles: WorkspaceFileTree | undefined;

  readonly onDidChangeWorkspaceFiles = this.emitter.event;

  constructor(private readonly host: NativeFileSystemHost | undefined = createNativeFileSystemHost()) {
    this.workspaceChangeSubscription = host?.onDidChangeWorkspaceFiles?.((workspaceFiles) => {
      this.workspaceFiles = workspaceFiles;
      this.emitter.fire(workspaceFiles);
    });
  }

  isAvailable(): boolean {
    return this.host?.isAvailable ?? false;
  }

  getWorkspaceFiles(): WorkspaceFileTree | undefined {
    return this.workspaceFiles;
  }

  async openWorkspace(): Promise<WorkspaceFileTree | undefined> {
    if (!this.host?.isAvailable) {
      return undefined;
    }

    this.workspaceFiles = await this.host.openWorkspace();
    this.emitter.fire(this.workspaceFiles);
    return this.workspaceFiles;
  }

  async refreshWorkspace(): Promise<WorkspaceFileTree | undefined> {
    if (!this.host?.isAvailable) {
      return undefined;
    }

    this.workspaceFiles = await this.host.refreshWorkspace();
    this.emitter.fire(this.workspaceFiles);
    return this.workspaceFiles;
  }

  async openFile(uri: URI): Promise<TextFileContent> {
    if (!this.host?.isAvailable) {
      throw new Error("Native file system host is not available");
    }

    return this.host.readFile(uri.toString());
  }

  async saveFile(uri: URI, value: string, options: SaveFileOptions = {}): Promise<TextFileContent> {
    if (!this.host?.isAvailable) {
      throw new Error("Native file system host is not available");
    }

    return this.host.writeFile(uri.toString(), value, options);
  }

  async saveFileAs(defaultName: string, value: string): Promise<TextFileContent | undefined> {
    if (!this.host?.isAvailable) {
      return undefined;
    }

    return this.host.saveFileAs(defaultName, value);
  }

  dispose(): void {
    this.workspaceChangeSubscription?.dispose();
    this.emitter.dispose();
  }
}

export function flattenFileTree(root: FileTreeEntry): FileTreeEntry[] {
  const files: FileTreeEntry[] = [];
  const visit = (entry: FileTreeEntry) => {
    if (entry.kind === "file") {
      files.push(entry);
      return;
    }

    for (const child of entry.children ?? []) {
      visit(child);
    }
  };

  visit(root);
  return files;
}

export function createNativeFileSystemHost(): NativeFileSystemHost | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly fileSystem?: NativeFileSystemBridge;
    };
  };

  const bridge = candidate.typoraPlus?.fileSystem;

  if (!bridge) {
    return undefined;
  }

  const host: NativeFileSystemHost = {
    isAvailable: bridge.isAvailable,
    async openWorkspace() {
      const workspace = await bridge.openWorkspace();
      return workspace ? reviveWorkspaceFileTree(workspace) : undefined;
    },
    async refreshWorkspace() {
      const workspace = await bridge.refreshWorkspace();
      return workspace ? reviveWorkspaceFileTree(workspace) : undefined;
    },
    async readFile(uri) {
      return reviveTextFileContent(await bridge.readFile(uri));
    },
    async writeFile(uri, value, options) {
      return reviveWriteFileResult(await bridge.writeFile(uri, value, options));
    },
    async saveFileAs(defaultName, value) {
      const content = await bridge.saveFileAs(defaultName, value);
      return content ? reviveTextFileContent(content) : undefined;
    }
  };

  if (!bridge.onDidChangeWorkspaceFiles) {
    return host;
  }

  return {
    ...host,
    onDidChangeWorkspaceFiles(listener) {
      const dispose = bridge.onDidChangeWorkspaceFiles?.((workspace) => {
        listener(workspace ? reviveWorkspaceFileTree(workspace) : undefined);
      });

      return {
        dispose: () => dispose?.()
      };
    }
  };
}

function reviveWorkspaceFileTree(workspace: SerializedWorkspaceFileTree): WorkspaceFileTree {
  return {
    root: reviveFileTreeEntry(workspace.root),
    files: workspace.files.map(reviveFileTreeEntry)
  };
}

function reviveFileTreeEntry(entry: SerializedFileTreeEntry): FileTreeEntry {
  return {
    uri: URI.parse(entry.uri),
    name: entry.name,
    relativePath: entry.relativePath,
    kind: entry.kind,
    ...(entry.size === undefined ? {} : { size: entry.size }),
    ...(entry.mtime === undefined ? {} : { mtime: entry.mtime }),
    ...(entry.children ? { children: entry.children.map(reviveFileTreeEntry) } : {})
  };
}

function reviveTextFileContent(content: SerializedTextFileContent): TextFileContent {
  return {
    uri: URI.parse(content.uri),
    name: content.name,
    value: content.value,
    ...(content.mtime === undefined ? {} : { mtime: content.mtime })
  };
}

function reviveWriteFileResult(result: SerializedWriteFileResult): TextFileContent {
  if (result.kind === "conflict") {
    throw new FileSaveConflictError(reviveFileSaveConflict(result.conflict));
  }

  return reviveTextFileContent(result.content);
}

function reviveFileSaveConflict(conflict: SerializedFileSaveConflict): FileSaveConflict {
  return {
    uri: URI.parse(conflict.uri),
    diskMtime: conflict.diskMtime,
    ...(conflict.expectedMtime === undefined ? {} : { expectedMtime: conflict.expectedMtime })
  };
}

export function isFileSaveConflictError(error: unknown): error is FileSaveConflictError {
  return error instanceof FileSaveConflictError
    || (typeof error === "object" && error !== null && "code" in error && error.code === "FILE_SAVE_CONFLICT");
}
