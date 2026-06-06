import { Emitter, URI, type Event, type URI as URIType } from "@typora-plus/base";
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

export interface NativeFileSystemHost {
  readonly isAvailable: boolean;
  openWorkspace(): Promise<WorkspaceFileTree | undefined>;
  refreshWorkspace(): Promise<WorkspaceFileTree | undefined>;
  readFile(uri: string): Promise<TextFileContent>;
  writeFile(uri: string, value: string): Promise<TextFileContent>;
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

export interface NativeFileSystemBridge {
  readonly isAvailable: boolean;
  openWorkspace(): Promise<SerializedWorkspaceFileTree | undefined>;
  refreshWorkspace(): Promise<SerializedWorkspaceFileTree | undefined>;
  readFile(uri: string): Promise<SerializedTextFileContent>;
  writeFile(uri: string, value: string): Promise<SerializedTextFileContent>;
  saveFileAs(defaultName: string, value: string): Promise<SerializedTextFileContent | undefined>;
}

export interface IFileService {
  readonly onDidChangeWorkspaceFiles: Event<WorkspaceFileTree | undefined>;
  isAvailable(): boolean;
  getWorkspaceFiles(): WorkspaceFileTree | undefined;
  openWorkspace(): Promise<WorkspaceFileTree | undefined>;
  refreshWorkspace(): Promise<WorkspaceFileTree | undefined>;
  openFile(uri: URIType): Promise<TextFileContent>;
  saveFile(uri: URIType, value: string): Promise<TextFileContent>;
  saveFileAs(defaultName: string, value: string): Promise<TextFileContent | undefined>;
}

export const IFileService = createServiceIdentifier<IFileService>("file");

export class NativeFileService implements IFileService {
  private readonly emitter = new Emitter<WorkspaceFileTree | undefined>();
  private workspaceFiles: WorkspaceFileTree | undefined;

  readonly onDidChangeWorkspaceFiles = this.emitter.event;

  constructor(private readonly host: NativeFileSystemHost | undefined = createNativeFileSystemHost()) {}

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

  async saveFile(uri: URI, value: string): Promise<TextFileContent> {
    if (!this.host?.isAvailable) {
      throw new Error("Native file system host is not available");
    }

    return this.host.writeFile(uri.toString(), value);
  }

  async saveFileAs(defaultName: string, value: string): Promise<TextFileContent | undefined> {
    if (!this.host?.isAvailable) {
      return undefined;
    }

    return this.host.saveFileAs(defaultName, value);
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

  return {
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
    async writeFile(uri, value) {
      return reviveTextFileContent(await bridge.writeFile(uri, value));
    },
    async saveFileAs(defaultName, value) {
      const content = await bridge.saveFileAs(defaultName, value);
      return content ? reviveTextFileContent(content) : undefined;
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
