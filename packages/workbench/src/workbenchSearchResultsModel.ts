import type {
  WorkspaceIndexedLink,
  WorkspaceIndexedTag,
  WorkspaceSearchResult
} from "@typora-plus/platform";

export interface DocumentSearchResult {
  readonly line: number;
  readonly preview: string;
}

export type WorkbenchSearchResult = DocumentSearchResult | WorkspaceSearchResult;

export interface DocumentSearchOptions {
  readonly maxResults: number;
}

export function searchDocument(
  markdown: string,
  query: string,
  options: DocumentSearchOptions
): readonly DocumentSearchResult[] {
  const maxResults = normalizeSearchMaxResults(options.maxResults);
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery || maxResults === 0) {
    return [];
  }

  return markdown
    .split(/\r?\n/)
    .map((line, index) => ({
      line: index + 1,
      preview: line.trim()
    }))
    .filter((result) => result.preview.toLowerCase().includes(normalizedQuery))
    .slice(0, maxResults);
}

export function isWorkspaceSearchResult(result: WorkbenchSearchResult): result is WorkspaceSearchResult {
  return "uri" in result;
}

export function searchResultKey(result: WorkbenchSearchResult): string {
  return isWorkspaceSearchResult(result)
    ? `${result.uri.toString()}-${result.line}-${result.preview}`
    : `${result.line}-${result.preview}`;
}

export function backlinkKey(link: WorkspaceIndexedLink, index: number): string {
  return `${link.uri.toString()}-${link.line}-${link.kind}-${link.target}-${link.label}-${index}`;
}

export function formatBacklinkPreview(link: WorkspaceIndexedLink): string {
  return link.label.trim() || link.target;
}

export function tagResourceKey(tag: WorkspaceIndexedTag, index: number): string {
  return `${tag.uri.toString()}-${tag.line}-${tag.tag}-${index}`;
}

function normalizeSearchMaxResults(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}
