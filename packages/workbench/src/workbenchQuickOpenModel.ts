import type { FileTreeEntry } from "@typora-plus/platform";

export interface QuickOpenModelOptions {
  readonly maxResults: number;
}

export function filterQuickOpenFiles(
  files: readonly FileTreeEntry[],
  query: string,
  options: QuickOpenModelOptions
): readonly FileTreeEntry[] {
  const maxResults = normalizeQuickOpenMaxResults(options.maxResults);
  const normalizedQuery = query.trim().toLowerCase();

  if (maxResults === 0) {
    return [];
  }

  if (!normalizedQuery) {
    return files.slice(0, maxResults);
  }

  return files
    .map((file) => ({
      file,
      score: scoreQuickOpenFile(file, normalizedQuery)
    }))
    .filter((result) => result.score > 0)
    .sort((first, second) =>
      second.score - first.score ||
      first.file.relativePath.localeCompare(second.file.relativePath)
    )
    .slice(0, maxResults)
    .map((result) => result.file);
}

function normalizeQuickOpenMaxResults(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}

function scoreQuickOpenFile(file: FileTreeEntry, query: string): number {
  const path = file.relativePath.toLowerCase();
  const name = file.name.toLowerCase();

  if (name === query) {
    return 100;
  }

  if (name.startsWith(query)) {
    return 80;
  }

  if (path.includes(query)) {
    return 60;
  }

  let cursor = 0;
  for (const character of query) {
    cursor = path.indexOf(character, cursor);
    if (cursor === -1) {
      return 0;
    }
    cursor += 1;
  }

  return 30;
}
