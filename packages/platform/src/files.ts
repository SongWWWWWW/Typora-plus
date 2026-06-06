import { Emitter, type Event, type URI } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type FileKind = "file" | "directory";

export interface FileTreeEntry {
  readonly uri: URI;
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
  readonly uri: URI;
  readonly name: string;
  readonly value: string;
  readonly mtime?: number;
}

export interface NativeFileSystemHost {
  readonly isAvailable: boolean;
  openWorkspace(): Promise<WorkspaceFileTree | undefined>;
  readFile(uri: string): Promise<TextFileContent>;
  writeFile(uri: string, value: string): Promise<TextFileContent>;
  saveFileAs(defaultName: string, value: string): Promise<TextFileContent | undefined>;
}

export interface IFileService {
  readonly onDidChangeWorkspaceFiles: Event<WorkspaceFileTree | undefined>;
  isAvailable(): boolean;
  getWorkspaceFiles(): WorkspaceFileTree | undefined;
  openWorkspace(): Promise<WorkspaceFileTree | undefined>;
  openFile(uri: URI): Promise<TextFileContent>;
  saveFile(uri: URI, value: string): Promise<TextFileContent>;
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
      readonly fileSystem?: NativeFileSystemHost;
    };
  };

  return candidate.typoraPlus?.fileSystem;
}
