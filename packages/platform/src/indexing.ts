import { Emitter, type Event, type URI as URIType } from "@typora-plus/base";
import type { FileTreeEntry, IFileService, WorkspaceFileTree } from "./files";
import { createServiceIdentifier } from "./instantiation";

export type WorkspaceIndexState = "idle" | "indexing" | "ready" | "error";

export interface WorkspaceIndexStatus {
  readonly state: WorkspaceIndexState;
  readonly indexedFiles: number;
  readonly totalFiles: number;
  readonly skippedFiles: number;
  readonly updatedAt: number;
  readonly message?: string;
}

export interface WorkspaceSearchResult {
  readonly uri: URIType;
  readonly name: string;
  readonly relativePath: string;
  readonly line: number;
  readonly preview: string;
  readonly score: number;
}

export interface WorkspaceIndexServiceOptions {
  readonly maxFileSizeBytes: number;
  readonly maxResults: number;
  readonly maxPreviewLength: number;
  readonly yieldEveryFiles: number;
  readonly now?: () => number;
}

export const defaultWorkspaceIndexServiceOptions: WorkspaceIndexServiceOptions = {
  maxFileSizeBytes: 2 * 1024 * 1024,
  maxResults: 120,
  maxPreviewLength: 160,
  yieldEveryFiles: 12
};

export interface IIndexService {
  readonly onDidChangeStatus: Event<WorkspaceIndexStatus>;
  getStatus(): WorkspaceIndexStatus;
  indexWorkspace(workspace: WorkspaceFileTree): Promise<void>;
  query(value: string): readonly WorkspaceSearchResult[];
  clear(): void;
}

export const IIndexService = createServiceIdentifier<IIndexService>("index");

export class WorkspaceIndexService implements IIndexService {
  private readonly emitter = new Emitter<WorkspaceIndexStatus>();
  private readonly options: WorkspaceIndexServiceOptions;
  private readonly now: () => number;
  private documents: IndexedDocument[] = [];
  private generation = 0;
  private status: WorkspaceIndexStatus;

  readonly onDidChangeStatus = this.emitter.event;

  constructor(
    private readonly fileService: IFileService,
    options: Partial<WorkspaceIndexServiceOptions> = {}
  ) {
    this.options = {
      ...defaultWorkspaceIndexServiceOptions,
      ...options
    };
    this.now = this.options.now ?? (() => Date.now());
    this.status = this.createStatus("idle", 0, 0, 0);
  }

  getStatus(): WorkspaceIndexStatus {
    return this.status;
  }

  async indexWorkspace(workspace: WorkspaceFileTree): Promise<void> {
    const generation = this.generation + 1;
    this.generation = generation;
    this.documents = [];

    const files = workspace.files.filter((file) => file.kind === "file");
    let indexedFiles = 0;
    let skippedFiles = 0;

    this.updateStatus("indexing", indexedFiles, files.length, skippedFiles);

    for (const [index, file] of files.entries()) {
      if (generation !== this.generation) {
        return;
      }

      if (shouldSkipFile(file, this.options.maxFileSizeBytes)) {
        skippedFiles += 1;
        this.updateStatus("indexing", indexedFiles, files.length, skippedFiles);
        continue;
      }

      try {
        const content = await this.fileService.openFile(file.uri);

        if (content.value.length > this.options.maxFileSizeBytes) {
          skippedFiles += 1;
        } else {
          this.documents.push(indexDocument(file, content.value));
          indexedFiles += 1;
        }
      } catch {
        skippedFiles += 1;
      }

      this.updateStatus("indexing", indexedFiles, files.length, skippedFiles);

      if ((index + 1) % this.options.yieldEveryFiles === 0) {
        await yieldToHost();
      }
    }

    if (generation !== this.generation) {
      return;
    }

    this.updateStatus("ready", indexedFiles, files.length, skippedFiles);
  }

  query(value: string): readonly WorkspaceSearchResult[] {
    const terms = normalizeQuery(value);

    if (terms.length === 0) {
      return [];
    }

    const results: WorkspaceSearchResult[] = [];

    for (const document of this.documents) {
      for (const line of document.lines) {
        if (!matchesLine(line.normalized, terms)) {
          continue;
        }

        results.push({
          uri: document.uri,
          name: document.name,
          relativePath: document.relativePath,
          line: line.line,
          preview: createPreview(line.value, this.options.maxPreviewLength),
          score: scoreLine(document, line.normalized, terms)
        });

        if (results.length >= this.options.maxResults) {
          return sortResults(results);
        }
      }
    }

    return sortResults(results);
  }

  clear(): void {
    this.generation += 1;
    this.documents = [];
    this.updateStatus("idle", 0, 0, 0);
  }

  private updateStatus(
    state: WorkspaceIndexState,
    indexedFiles: number,
    totalFiles: number,
    skippedFiles: number,
    message?: string
  ): void {
    this.status = this.createStatus(state, indexedFiles, totalFiles, skippedFiles, message);
    this.emitter.fire(this.status);
  }

  private createStatus(
    state: WorkspaceIndexState,
    indexedFiles: number,
    totalFiles: number,
    skippedFiles: number,
    message?: string
  ): WorkspaceIndexStatus {
    return {
      state,
      indexedFiles,
      totalFiles,
      skippedFiles,
      updatedAt: this.now(),
      ...(message ? { message } : {})
    };
  }
}

interface IndexedDocument {
  readonly uri: URIType;
  readonly name: string;
  readonly relativePath: string;
  readonly normalizedPath: string;
  readonly lines: readonly IndexedLine[];
}

interface IndexedLine {
  readonly line: number;
  readonly value: string;
  readonly normalized: string;
}

function shouldSkipFile(file: FileTreeEntry, maxFileSizeBytes: number): boolean {
  return file.size !== undefined && file.size > maxFileSizeBytes;
}

function indexDocument(file: FileTreeEntry, value: string): IndexedDocument {
  return {
    uri: file.uri,
    name: file.name,
    relativePath: file.relativePath,
    normalizedPath: `${file.relativePath} ${file.name}`.toLowerCase(),
    lines: value.split(/\r?\n/).map((line, index) => ({
      line: index + 1,
      value: line,
      normalized: line.toLowerCase()
    }))
  };
}

function normalizeQuery(value: string): readonly string[] {
  return value
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
}

function matchesLine(value: string, terms: readonly string[]): boolean {
  return terms.every((term) => value.includes(term));
}

function scoreLine(document: IndexedDocument, line: string, terms: readonly string[]): number {
  const firstTerm = terms[0] ?? "";
  let score = 10;

  if (line.trimStart().startsWith(firstTerm)) {
    score += 20;
  }

  if (document.normalizedPath.includes(firstTerm)) {
    score += 8;
  }

  return score;
}

function sortResults(results: WorkspaceSearchResult[]): readonly WorkspaceSearchResult[] {
  return [...results].sort((first, second) =>
    second.score - first.score ||
    first.relativePath.localeCompare(second.relativePath) ||
    first.line - second.line
  );
}

function createPreview(value: string, maxLength: number): string {
  const trimmed = value.trim();

  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, Math.max(0, maxLength - 3))}...`;
}

async function yieldToHost(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
