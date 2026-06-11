import { marked } from "marked";

export type MarkdownLocalResourceReferenceKind = "image" | "link";

export interface MarkdownLocalResourceReference {
  readonly kind: MarkdownLocalResourceReferenceKind;
  readonly source: string;
  readonly relativePath: string;
}

export interface MarkdownLocalResourceReferenceOptions {
  readonly includeLinks?: boolean;
  readonly maxReferences?: number;
  readonly sourcePath: string;
}

const defaultMarkdownLocalResourceReferenceLimit = 2000;
const markdownLocalResourceDocumentExtensions = new Set([".mark", ".markdown", ".md", ".mdown"]);

export function collectMarkdownLocalResourceReferences(
  markdown: string,
  options: MarkdownLocalResourceReferenceOptions
): readonly MarkdownLocalResourceReference[] {
  const includeLinks = options.includeLinks ?? true;
  const maxReferences = normalizeMarkdownLocalResourceReferenceLimit(options.maxReferences);
  const sourceDirectory = readMarkdownSourceDirectory(options.sourcePath);
  const references: MarkdownLocalResourceReference[] = [];
  const seenRelativePaths = new Set<string>();
  const tokens = marked.lexer(markdown, { gfm: true });

  collectMarkdownLocalResourceReferencesFromTokens(tokens, {
    includeLinks,
    maxReferences,
    references,
    seenRelativePaths,
    sourceDirectory
  });

  return references;
}

export function isMarkdownLocalResourceDocumentPath(value: string): boolean {
  const extension = value.trim().replaceAll("\\", "/").match(/\.([a-z0-9]+)$/i)?.[0]?.toLowerCase();
  return extension ? markdownLocalResourceDocumentExtensions.has(extension) : false;
}

interface MarkdownLocalResourceReferenceCollector {
  readonly includeLinks: boolean;
  readonly maxReferences: number;
  readonly references: MarkdownLocalResourceReference[];
  readonly seenRelativePaths: Set<string>;
  readonly sourceDirectory: string;
}

function collectMarkdownLocalResourceReferencesFromTokens(
  value: unknown,
  collector: MarkdownLocalResourceReferenceCollector
): void {
  if (collector.references.length >= collector.maxReferences) {
    return;
  }

  if (Array.isArray(value)) {
    for (const child of value) {
      collectMarkdownLocalResourceReferencesFromTokens(child, collector);
    }
    return;
  }

  if (!isRecord(value)) {
    return;
  }

  if (value.type === "image" && typeof value.href === "string") {
    addMarkdownLocalResourceReference("image", value.href, collector);
  } else if (collector.includeLinks && value.type === "link" && typeof value.href === "string") {
    addMarkdownLocalResourceReference("link", value.href, collector);
  }

  for (const child of Object.values(value)) {
    if (child && typeof child === "object") {
      collectMarkdownLocalResourceReferencesFromTokens(child, collector);
    }
  }
}

function addMarkdownLocalResourceReference(
  kind: MarkdownLocalResourceReferenceKind,
  source: string,
  collector: MarkdownLocalResourceReferenceCollector
): void {
  if (collector.references.length >= collector.maxReferences) {
    return;
  }

  const relativePath = resolveMarkdownLocalResourcePath(collector.sourceDirectory, source);

  if (!relativePath || collector.seenRelativePaths.has(relativePath)) {
    return;
  }

  collector.seenRelativePaths.add(relativePath);
  collector.references.push({
    kind,
    source,
    relativePath
  });
}

function resolveMarkdownLocalResourcePath(sourceDirectory: string, source: string): string | undefined {
  const pathSource = readMarkdownResourcePathSource(source);

  if (!pathSource) {
    return undefined;
  }

  const decodedPath = decodeMarkdownResourcePath(pathSource);

  if (!decodedPath) {
    return undefined;
  }

  return normalizeMarkdownWorkspaceRelativePath(
    sourceDirectory ? `${sourceDirectory}/${decodedPath}` : decodedPath,
    false
  );
}

function readMarkdownResourcePathSource(source: string): string | undefined {
  const normalized = source.trim();

  if (
    !normalized ||
    normalized.startsWith("#") ||
    normalized.startsWith("/") ||
    normalized.startsWith("\\") ||
    normalized.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized)
  ) {
    return undefined;
  }

  const pathSource = normalized.split(/[?#]/, 1)[0]?.trim();
  return pathSource || undefined;
}

function decodeMarkdownResourcePath(value: string): string | undefined {
  try {
    return decodeURI(value);
  } catch {
    return undefined;
  }
}

function readMarkdownSourceDirectory(sourcePath: string): string {
  const normalized = normalizeMarkdownWorkspaceRelativePath(sourcePath, true);
  const separator = normalized.lastIndexOf("/");

  return separator === -1 ? "" : normalized.slice(0, separator);
}

function normalizeMarkdownWorkspaceRelativePath(value: string, throwOnInvalid: boolean): string {
  const normalized = value.trim().replaceAll("\\", "/");
  const segments: string[] = [];

  if (
    !normalized ||
    normalized.startsWith("/") ||
    normalized.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(normalized) ||
    /[\u0000-\u001f]/.test(normalized)
  ) {
    return invalidMarkdownWorkspaceRelativePath(throwOnInvalid);
  }

  for (const segment of normalized.split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length === 0) {
        return invalidMarkdownWorkspaceRelativePath(throwOnInvalid);
      }
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.length > 0 ? segments.join("/") : invalidMarkdownWorkspaceRelativePath(throwOnInvalid);
}

function invalidMarkdownWorkspaceRelativePath(throwOnInvalid: boolean): string {
  if (throwOnInvalid) {
    throw new Error("Markdown local resource source path must be workspace-relative");
  }

  return "";
}

function normalizeMarkdownLocalResourceReferenceLimit(value: number | undefined): number {
  if (value === undefined) {
    return defaultMarkdownLocalResourceReferenceLimit;
  }

  if (!Number.isInteger(value) || value < 1) {
    throw new Error("Markdown local resource reference limit must be a positive integer");
  }

  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
