import { Emitter, URI, type Event, type URI as URIType } from "@typora-plus/base";
import { configurationBytesPerMegabyte, defaultConfiguration } from "./configuration";
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

export interface WorkspaceIndexedResource {
  readonly uri: URIType;
  readonly name: string;
  readonly relativePath: string;
  readonly line: number;
}

export interface WorkspaceIndexedHeading extends WorkspaceIndexedResource {
  readonly level: number;
  readonly text: string;
}

export interface WorkspaceIndexedTag extends WorkspaceIndexedResource {
  readonly tag: string;
}

export interface WorkspaceIndexedTagSummary {
  readonly tag: string;
  readonly count: number;
}

export type WorkspaceIndexedLinkKind = "markdown" | "wiki";

export interface WorkspaceIndexedLink extends WorkspaceIndexedResource {
  readonly kind: WorkspaceIndexedLinkKind;
  readonly label: string;
  readonly target: string;
}

export interface WorkspaceIndexMetadata {
  readonly headings: readonly WorkspaceIndexedHeading[];
  readonly links: readonly WorkspaceIndexedLink[];
  readonly tags: readonly WorkspaceIndexedTag[];
}

export interface WorkspaceIndexServiceOptions {
  readonly maxFileSizeBytes: number;
  readonly maxResults: number;
  readonly maxPreviewLength: number;
  readonly yieldEveryFiles: number;
  readonly now?: () => number;
}

export interface WorkspaceIndexConfiguration {
  readonly maxFileSizeBytes: number;
  readonly maxResults: number;
}

export interface WorkspaceIndexQueryOptions {
  readonly maxResults: number;
  readonly maxPreviewLength: number;
}

export const defaultWorkspaceIndexServiceOptions: WorkspaceIndexServiceOptions = {
  maxFileSizeBytes: defaultConfiguration.workspace.searchMaxFileSizeBytes,
  maxResults: defaultConfiguration.workspace.searchMaxResults,
  maxPreviewLength: 160,
  yieldEveryFiles: 12
};

export interface IIndexService {
  readonly onDidChangeStatus: Event<WorkspaceIndexStatus>;
  configure(configuration: WorkspaceIndexConfiguration): void;
  getStatus(): WorkspaceIndexStatus;
  indexWorkspace(workspace: WorkspaceFileTree): Promise<void>;
  indexFile(file: FileTreeEntry, value?: string): Promise<void>;
  query(value: string): readonly WorkspaceSearchResult[];
  getMetadata(): WorkspaceIndexMetadata;
  getTags(): readonly WorkspaceIndexedTagSummary[];
  getTaggedResources(tag: string): readonly WorkspaceIndexedTag[];
  getBacklinks(uri: URIType): readonly WorkspaceIndexedLink[];
  clear(): void;
}

export const IIndexService = createServiceIdentifier<IIndexService>("index");

export interface WorkspaceIndexProvider {
  setSnapshotScope?(scope: string | undefined): void;
  beginBatch?(): void;
  endBatch?(): void;
  clear(): void;
  getDocumentCount(): number;
  upsertDocument(document: WorkspaceIndexedDocument): void;
  removeDocument(uri: URIType): void;
  query(value: string, options: WorkspaceIndexQueryOptions): readonly WorkspaceSearchResult[];
  getMetadata(): WorkspaceIndexMetadata;
  getTags(): readonly WorkspaceIndexedTagSummary[];
  getTaggedResources(tag: string): readonly WorkspaceIndexedTag[];
  getBacklinks(uri: URIType): readonly WorkspaceIndexedLink[];
}

export const workspaceIndexProviderSnapshotVersion = 1;

export interface WorkspaceIndexProviderSnapshot {
  readonly version: typeof workspaceIndexProviderSnapshotVersion;
  readonly scope?: string;
  readonly documents: readonly WorkspaceIndexedDocumentSnapshot[];
}

export interface WorkspaceIndexedDocumentSnapshot {
  readonly uri: string;
  readonly name: string;
  readonly relativePath: string;
  readonly content: string;
}

export interface WorkspaceIndexSnapshotStorage {
  read(key: string): string | undefined;
  write(key: string, value: string): void;
}

export interface PersistedWorkspaceIndexProviderOptions {
  readonly storage: WorkspaceIndexSnapshotStorage;
  readonly storageKey?: string;
  readonly maxSnapshotBytes?: number;
}

export const defaultWorkspaceIndexSnapshotProviderOptions = {
  storageKey: "typora-plus.workspaceIndex.snapshot",
  maxSnapshotBytes: 5 * configurationBytesPerMegabyte
} as const;

export class InMemoryWorkspaceIndexProvider implements WorkspaceIndexProvider {
  private documents: WorkspaceIndexedDocument[];
  private snapshotScope: string | undefined;

  constructor(documents: readonly WorkspaceIndexedDocument[] = []) {
    this.documents = [...documents];
  }

  setSnapshotScope(scope: string | undefined): void {
    this.snapshotScope = normalizeWorkspaceIndexSnapshotScope(scope);
  }

  clear(): void {
    this.documents = [];
  }

  getDocumentCount(): number {
    return this.documents.length;
  }

  upsertDocument(document: WorkspaceIndexedDocument): void {
    const index = this.documents.findIndex((entry) => entry.uri.toString() === document.uri.toString());

    if (index === -1) {
      this.documents = [...this.documents, document];
      return;
    }

    this.documents = [
      ...this.documents.slice(0, index),
      document,
      ...this.documents.slice(index + 1)
    ];
  }

  removeDocument(uri: URIType): void {
    this.documents = this.documents.filter((document) => document.uri.toString() !== uri.toString());
  }

  query(value: string, options: WorkspaceIndexQueryOptions): readonly WorkspaceSearchResult[] {
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
          preview: createPreview(line.value, options.maxPreviewLength),
          score: scoreLine(document, line.normalized, terms)
        });

        if (results.length >= options.maxResults) {
          return sortResults(results);
        }
      }
    }

    return sortResults(results);
  }

  getMetadata(): WorkspaceIndexMetadata {
    return {
      headings: this.documents.flatMap((document) => document.metadata.headings),
      links: this.documents.flatMap((document) => document.metadata.links),
      tags: this.documents.flatMap((document) => document.metadata.tags)
    };
  }

  getTags(): readonly WorkspaceIndexedTagSummary[] {
    const summaries = new Map<string, WorkspaceIndexedTagSummary>();

    for (const tag of this.documents.flatMap((document) => document.metadata.tags)) {
      const key = normalizeTagName(tag.tag);
      const existing = summaries.get(key);

      summaries.set(key, {
        tag: existing?.tag ?? tag.tag,
        count: (existing?.count ?? 0) + 1
      });
    }

    return [...summaries.values()].sort((first, second) =>
      normalizeTagName(first.tag).localeCompare(normalizeTagName(second.tag))
    );
  }

  getTaggedResources(tag: string): readonly WorkspaceIndexedTag[] {
    const normalizedTag = normalizeTagName(tag);

    if (!normalizedTag) {
      return [];
    }

    return sortIndexedTags(this.documents
      .flatMap((document) => document.metadata.tags)
      .filter((entry) => normalizeTagName(entry.tag) === normalizedTag));
  }

  getBacklinks(uri: URIType): readonly WorkspaceIndexedLink[] {
    const targetDocument = this.documents.find((document) => document.uri.toString() === uri.toString());

    if (!targetDocument) {
      return [];
    }

    return sortIndexedLinks(this.documents
      .filter((document) => document.uri.toString() !== targetDocument.uri.toString())
      .flatMap((document) => document.metadata.links
        .filter((link) => linkResolvesToDocument(link, document, targetDocument))));
  }

  toSnapshot(): WorkspaceIndexProviderSnapshot {
    return createWorkspaceIndexProviderSnapshot(this.documents, this.snapshotScope);
  }

  restoreSnapshot(snapshot: WorkspaceIndexProviderSnapshot): void {
    this.documents = snapshot.documents.map((document) => indexDocument({
      uri: URI.parse(document.uri),
      name: document.name,
      relativePath: document.relativePath,
      kind: "file"
    }, document.content));
  }
}

export class PersistedWorkspaceIndexProvider extends InMemoryWorkspaceIndexProvider {
  private readonly storage: WorkspaceIndexSnapshotStorage;
  private readonly baseStorageKey: string;
  private readonly maxSnapshotBytes: number;
  private storageKey: string;
  private currentSnapshotScope: string | undefined;
  private batchDepth = 0;
  private pendingPersist = false;

  constructor(options: PersistedWorkspaceIndexProviderOptions) {
    super();
    this.storage = options.storage;
    this.baseStorageKey = options.storageKey ?? defaultWorkspaceIndexSnapshotProviderOptions.storageKey;
    this.storageKey = this.baseStorageKey;
    this.maxSnapshotBytes = options.maxSnapshotBytes ?? defaultWorkspaceIndexSnapshotProviderOptions.maxSnapshotBytes;
    this.restorePersistedSnapshot();
  }

  override setSnapshotScope(scope: string | undefined): void {
    this.currentSnapshotScope = normalizeWorkspaceIndexSnapshotScope(scope);
    this.storageKey = createWorkspaceIndexSnapshotStorageKey(this.baseStorageKey, this.currentSnapshotScope);
    super.setSnapshotScope(this.currentSnapshotScope);
    this.restorePersistedSnapshot();
  }

  beginBatch(): void {
    this.batchDepth += 1;
  }

  endBatch(): void {
    this.batchDepth = Math.max(0, this.batchDepth - 1);

    if (this.batchDepth === 0 && this.pendingPersist) {
      this.pendingPersist = false;
      this.persistSnapshot();
    }
  }

  override clear(): void {
    super.clear();
    this.queuePersist();
  }

  override upsertDocument(document: WorkspaceIndexedDocument): void {
    super.upsertDocument(document);
    this.queuePersist();
  }

  override removeDocument(uri: URIType): void {
    super.removeDocument(uri);
    this.queuePersist();
  }

  private restorePersistedSnapshot(): void {
    const snapshot = readWorkspaceIndexProviderSnapshot(this.storage.read(this.storageKey));

    if (!snapshot) {
      this.restoreSnapshot(createEmptyIndexSnapshot(this.currentSnapshotScope));
      return;
    }

    if (snapshot.scope !== undefined && snapshot.scope !== this.currentSnapshotScope) {
      this.restoreSnapshot(createEmptyIndexSnapshot(this.currentSnapshotScope));
      return;
    }

    this.restoreSnapshot(snapshot);
  }

  private queuePersist(): void {
    if (this.batchDepth > 0) {
      this.pendingPersist = true;
      return;
    }

    this.persistSnapshot();
  }

  private persistSnapshot(): void {
    const value = JSON.stringify(this.toSnapshot());
    const persistedValue = value.length <= this.maxSnapshotBytes
      ? value
      : JSON.stringify(createEmptyIndexSnapshot(this.currentSnapshotScope));

    try {
      this.storage.write(this.storageKey, persistedValue);
    } catch {
      try {
        this.storage.write(this.storageKey, JSON.stringify(createEmptyIndexSnapshot(this.currentSnapshotScope)));
      } catch {
        // Storage backends such as localStorage can reject writes when quota is exhausted.
      }
    }
  }
}

export class WorkspaceIndexService implements IIndexService {
  private readonly emitter = new Emitter<WorkspaceIndexStatus>();
  private options: WorkspaceIndexServiceOptions;
  private readonly now: () => number;
  private generation = 0;
  private status: WorkspaceIndexStatus;

  readonly onDidChangeStatus = this.emitter.event;

  constructor(
    private readonly fileService: IFileService,
    options: Partial<WorkspaceIndexServiceOptions> = {},
    private readonly provider: WorkspaceIndexProvider = new InMemoryWorkspaceIndexProvider()
  ) {
    this.options = {
      ...defaultWorkspaceIndexServiceOptions,
      ...options
    };
    this.now = this.options.now ?? (() => Date.now());
    const restoredDocumentCount = this.provider.getDocumentCount();
    this.status = restoredDocumentCount > 0
      ? this.createStatus("ready", restoredDocumentCount, restoredDocumentCount, 0)
      : this.createStatus("idle", 0, 0, 0);
  }

  getStatus(): WorkspaceIndexStatus {
    return this.status;
  }

  configure(configuration: WorkspaceIndexConfiguration): void {
    this.options = {
      ...this.options,
      maxFileSizeBytes: configuration.maxFileSizeBytes,
      maxResults: configuration.maxResults
    };
  }

  async indexWorkspace(workspace: WorkspaceFileTree): Promise<void> {
    const generation = this.generation + 1;
    this.generation = generation;
    this.provider.setSnapshotScope?.(workspace.root.uri.toString());
    this.provider.beginBatch?.();

    try {
      this.provider.clear();

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

          if (generation !== this.generation) {
            return;
          }

          if (content.value.length > this.options.maxFileSizeBytes) {
            skippedFiles += 1;
          } else {
            this.provider.upsertDocument(indexDocument(file, content.value));
            indexedFiles += 1;
          }
        } catch {
          if (generation !== this.generation) {
            return;
          }

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
    } finally {
      this.provider.endBatch?.();
    }
  }

  async indexFile(file: FileTreeEntry, value?: string): Promise<void> {
    const generation = this.generation;

    if (file.kind !== "file") {
      return;
    }

    if (value === undefined && shouldSkipFile(file, this.options.maxFileSizeBytes)) {
      this.provider.removeDocument(file.uri);
      this.emitIndexChanged();
      return;
    }

    let content = value;

    if (content === undefined) {
      try {
        content = (await this.fileService.openFile(file.uri)).value;
      } catch {
        this.provider.removeDocument(file.uri);
        this.emitIndexChanged();
        return;
      }
    }

    if (generation !== this.generation) {
      return;
    }

    if (content.length > this.options.maxFileSizeBytes) {
      this.provider.removeDocument(file.uri);
      this.emitIndexChanged();
      return;
    }

    this.provider.upsertDocument(indexDocument(file, content));
    this.emitIndexChanged();
  }

  query(value: string): readonly WorkspaceSearchResult[] {
    return this.provider.query(value, {
      maxPreviewLength: this.options.maxPreviewLength,
      maxResults: this.options.maxResults
    });
  }

  getMetadata(): WorkspaceIndexMetadata {
    return this.provider.getMetadata();
  }

  getTags(): readonly WorkspaceIndexedTagSummary[] {
    return this.provider.getTags();
  }

  getTaggedResources(tag: string): readonly WorkspaceIndexedTag[] {
    return this.provider.getTaggedResources(tag);
  }

  getBacklinks(uri: URIType): readonly WorkspaceIndexedLink[] {
    return this.provider.getBacklinks(uri);
  }

  clear(): void {
    this.generation += 1;
    this.provider.clear();
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

  private emitIndexChanged(): void {
    this.updateStatus(
      this.status.state === "indexing" ? "indexing" : "ready",
      this.provider.getDocumentCount(),
      Math.max(this.status.totalFiles, this.provider.getDocumentCount()),
      this.status.skippedFiles,
      this.status.message
    );
  }
}

export interface WorkspaceIndexedDocument {
  readonly uri: URIType;
  readonly name: string;
  readonly relativePath: string;
  readonly normalizedPath: string;
  readonly lines: readonly WorkspaceIndexedLine[];
  readonly metadata: WorkspaceIndexMetadata;
}

export interface WorkspaceIndexedLine {
  readonly line: number;
  readonly value: string;
  readonly normalized: string;
}

function shouldSkipFile(file: FileTreeEntry, maxFileSizeBytes: number): boolean {
  return file.size !== undefined && file.size > maxFileSizeBytes;
}

function indexDocument(file: FileTreeEntry, value: string): WorkspaceIndexedDocument {
  const lines = value.split(/\r?\n/).map((line, index) => ({
    line: index + 1,
    value: line,
    normalized: line.toLowerCase()
  }));

  return {
    uri: file.uri,
    name: file.name,
    relativePath: file.relativePath,
    normalizedPath: `${file.relativePath} ${file.name}`.toLowerCase(),
    lines,
    metadata: indexDocumentMetadata(file, lines)
  };
}

function indexDocumentMetadata(
  file: FileTreeEntry,
  lines: readonly WorkspaceIndexedLine[]
): WorkspaceIndexMetadata {
  const headings: WorkspaceIndexedHeading[] = [];
  const links: WorkspaceIndexedLink[] = [];
  const tags: WorkspaceIndexedTag[] = [];
  let fence: string | undefined;

  for (const line of lines) {
    const fenceMarker = readFenceMarker(line.value);

    if (fenceMarker) {
      fence = fence ? undefined : fenceMarker;
      continue;
    }

    if (fence) {
      continue;
    }

    const heading = readHeading(line.value);
    if (heading) {
      headings.push({
        ...createIndexedResource(file, line.line),
        level: heading.level,
        text: heading.text
      });
    }

    const searchableLine = maskInlineCodeSpans(line.value);
    for (const link of readMarkdownLinks(searchableLine)) {
      links.push({
        ...createIndexedResource(file, line.line),
        ...link
      });
    }

    for (const tag of readMarkdownTags(searchableLine)) {
      tags.push({
        ...createIndexedResource(file, line.line),
        tag
      });
    }
  }

  return { headings, links, tags };
}

function createIndexedResource(file: FileTreeEntry, line: number): WorkspaceIndexedResource {
  return {
    line,
    name: file.name,
    relativePath: file.relativePath,
    uri: file.uri
  };
}

function readFenceMarker(line: string): string | undefined {
  const match = /^\s*(`{3,}|~{3,})/.exec(line);
  return match?.[1];
}

function readHeading(line: string): { readonly level: number; readonly text: string } | undefined {
  const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
  const marker = match?.[1];
  const rawText = match?.[2];

  if (!marker || !rawText) {
    return undefined;
  }

  const text = rawText.replace(/\s+#+\s*$/, "").trim();

  return text ? { level: marker.length, text } : undefined;
}

function maskInlineCodeSpans(line: string): string {
  return line.replace(/`[^`]*`/g, (value) => " ".repeat(value.length));
}

function readMarkdownLinks(line: string): readonly Omit<WorkspaceIndexedLink, keyof WorkspaceIndexedResource>[] {
  const links: Array<Omit<WorkspaceIndexedLink, keyof WorkspaceIndexedResource>> = [];
  const markdownLinkPattern = /\[([^\]]+)]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)/g;
  const wikiLinkPattern = /\[\[([^\]|]+)(?:\|([^\]]+))?]]/g;

  for (const match of line.matchAll(markdownLinkPattern)) {
    if ((match.index ?? 0) > 0 && line[(match.index ?? 0) - 1] === "!") {
      continue;
    }

    const label = match[1]?.trim();
    const target = match[2]?.trim();

    if (label && target) {
      links.push({ kind: "markdown", label, target });
    }
  }

  for (const match of line.matchAll(wikiLinkPattern)) {
    const target = match[1]?.trim();
    const label = match[2]?.trim() || target;

    if (label && target) {
      links.push({ kind: "wiki", label, target });
    }
  }

  return links;
}

function readMarkdownTags(line: string): readonly string[] {
  const tags: string[] = [];
  const seen = new Set<string>();
  const tagPattern = /(^|[\s([{])#([\p{Letter}\p{Number}_][\p{Letter}\p{Number}_/-]*)/gu;

  for (const match of line.matchAll(tagPattern)) {
    const tag = match[2];

    if (tag && !seen.has(tag)) {
      seen.add(tag);
      tags.push(tag);
    }
  }

  return tags;
}

function linkResolvesToDocument(
  link: WorkspaceIndexedLink,
  sourceDocument: WorkspaceIndexedDocument,
  targetDocument: WorkspaceIndexedDocument
): boolean {
  if (link.kind === "wiki") {
    return wikiLinkTargetMatchesDocument(link.target, targetDocument);
  }

  const targetPath = resolveMarkdownLinkTarget(sourceDocument.relativePath, link.target);

  if (!targetPath) {
    return false;
  }

  const normalizedTargetPath = normalizeIndexPath(targetPath);
  const normalizedDocumentPath = normalizeIndexPath(targetDocument.relativePath);
  return normalizedTargetPath === normalizedDocumentPath ||
    `${normalizedTargetPath}.md` === normalizedDocumentPath;
}

function wikiLinkTargetMatchesDocument(target: string, document: WorkspaceIndexedDocument): boolean {
  const normalizedTarget = normalizeWikiTarget(target);

  if (!normalizedTarget) {
    return false;
  }

  return normalizedTarget === normalizeWikiTarget(document.name) ||
    normalizedTarget === normalizeWikiTarget(stripMarkdownExtension(document.name)) ||
    normalizedTarget === normalizeWikiTarget(document.relativePath) ||
    normalizedTarget === normalizeWikiTarget(stripMarkdownExtension(document.relativePath));
}

function resolveMarkdownLinkTarget(sourceRelativePath: string, target: string): string | undefined {
  const cleanTarget = decodeLinkTarget(stripLinkTargetFragment(target)).trim();

  if (!cleanTarget || cleanTarget.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(cleanTarget)) {
    return undefined;
  }

  if (cleanTarget.startsWith("/")) {
    return normalizePathSegments(cleanTarget.slice(1));
  }

  return normalizePathSegments([readParentPath(sourceRelativePath), cleanTarget].filter(Boolean).join("/"));
}

function stripLinkTargetFragment(target: string): string {
  const queryIndex = target.indexOf("?");
  const hashIndex = target.indexOf("#");
  const indexes = [queryIndex, hashIndex].filter((index) => index >= 0);
  const end = indexes.length > 0 ? Math.min(...indexes) : target.length;
  return target.slice(0, end);
}

function decodeLinkTarget(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function readParentPath(relativePath: string): string {
  const normalized = normalizeIndexPath(relativePath);
  const separator = normalized.lastIndexOf("/");
  return separator >= 0 ? normalized.slice(0, separator) : "";
}

function normalizePathSegments(path: string): string {
  const segments: string[] = [];

  for (const segment of path.replaceAll("\\", "/").split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
}

function normalizeIndexPath(path: string): string {
  return normalizePathSegments(path).toLowerCase();
}

function normalizeWikiTarget(target: string): string {
  return normalizeIndexPath(target).replace(/\.md$/i, "").trim();
}

function stripMarkdownExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

function sortIndexedLinks(links: readonly WorkspaceIndexedLink[]): readonly WorkspaceIndexedLink[] {
  return [...links].sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath) ||
    first.line - second.line ||
    first.target.localeCompare(second.target)
  );
}

function sortIndexedTags(tags: readonly WorkspaceIndexedTag[]): readonly WorkspaceIndexedTag[] {
  return [...tags].sort((first, second) =>
    first.relativePath.localeCompare(second.relativePath) ||
    first.line - second.line ||
    first.tag.localeCompare(second.tag)
  );
}

function normalizeTagName(tag: string): string {
  return tag.trim().toLowerCase();
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

function scoreLine(document: WorkspaceIndexedDocument, line: string, terms: readonly string[]): number {
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

function createWorkspaceIndexProviderSnapshot(
  documents: readonly WorkspaceIndexedDocument[],
  scope: string | undefined
): WorkspaceIndexProviderSnapshot {
  return {
    version: workspaceIndexProviderSnapshotVersion,
    ...(scope === undefined ? {} : { scope }),
    documents: documents.map((document) => ({
      uri: document.uri.toString(),
      name: document.name,
      relativePath: document.relativePath,
      content: document.lines.map((line) => line.value).join("\n")
    }))
  };
}

function createEmptyIndexSnapshot(scope: string | undefined): WorkspaceIndexProviderSnapshot {
  return {
    version: workspaceIndexProviderSnapshotVersion,
    ...(scope === undefined ? {} : { scope }),
    documents: []
  };
}

function readWorkspaceIndexProviderSnapshot(value: string | undefined): WorkspaceIndexProviderSnapshot | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return sanitizeWorkspaceIndexProviderSnapshot(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function sanitizeWorkspaceIndexProviderSnapshot(value: unknown): WorkspaceIndexProviderSnapshot | undefined {
  if (!isRecord(value) || value.version !== workspaceIndexProviderSnapshotVersion || !Array.isArray(value.documents)) {
    return undefined;
  }

  return {
    version: workspaceIndexProviderSnapshotVersion,
    ...(typeof value.scope === "string" ? { scope: value.scope } : {}),
    documents: value.documents.filter(isWorkspaceIndexedDocumentSnapshot)
  };
}

function isWorkspaceIndexedDocumentSnapshot(value: unknown): value is WorkspaceIndexedDocumentSnapshot {
  return isRecord(value) &&
    isNonEmptyString(value.uri) &&
    isNonEmptyString(value.name) &&
    typeof value.relativePath === "string" &&
    typeof value.content === "string";
}

export function createBrowserWorkspaceIndexSnapshotStorage(): WorkspaceIndexSnapshotStorage | undefined {
  if (!hasLocalStorage()) {
    return undefined;
  }

  return {
    read(key) {
      return window.localStorage.getItem(key) ?? undefined;
    },
    write(key, value) {
      window.localStorage.setItem(key, value);
    }
  };
}

export function createWorkspaceIndexSnapshotStorageKey(baseKey: string, scope: string | undefined): string {
  const normalizedScope = normalizeWorkspaceIndexSnapshotScope(scope);

  if (!normalizedScope) {
    return baseKey;
  }

  return `${baseKey}.${hashWorkspaceIndexSnapshotScope(normalizedScope)}`;
}

function normalizeWorkspaceIndexSnapshotScope(scope: string | undefined): string | undefined {
  const value = scope?.trim();
  return value ? value : undefined;
}

function hashWorkspaceIndexSnapshotScope(scope: string): string {
  let hash = 2166136261;

  for (let index = 0; index < scope.length; index += 1) {
    hash ^= scope.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasLocalStorage(): boolean {
  return typeof window !== "undefined" && "localStorage" in window;
}

async function yieldToHost(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}
