import type {
  AiTextContextItem,
  IIndexService,
  TextFileModel,
  WorkspaceSearchResult
} from "@typora-plus/platform";

export interface WorkbenchAiWorkspaceContextServices {
  readonly indexService: Pick<IIndexService, "getStatus" | "query">;
}

export interface WorkbenchAiWorkspaceContextOptions {
  readonly maxPreviewLength: number;
  readonly maxResults: number;
}

export function createWorkbenchWorkspaceAiContext(
  services: WorkbenchAiWorkspaceContextServices,
  model: Pick<TextFileModel, "name" | "uri" | "value">,
  options: WorkbenchAiWorkspaceContextOptions
): readonly AiTextContextItem[] {
  const maxResults = normalizePositiveInteger(options.maxResults);

  if (maxResults === 0 || services.indexService.getStatus().state !== "ready") {
    return [];
  }

  const maxPreviewLength = normalizePositiveInteger(options.maxPreviewLength);
  const seenResults = new Set<string>();
  const context: AiTextContextItem[] = [];

  for (const query of createWorkbenchWorkspaceAiContextQueries(model, maxResults)) {
    for (const result of services.indexService.query(query, {
      maxPreviewLength,
      maxResults: maxResults + 1
    })) {
      if (isActiveModelSearchResult(result, model)) {
        continue;
      }

      const key = `${result.uri.toString()}:${result.line}`;

      if (seenResults.has(key)) {
        continue;
      }

      seenResults.add(key);
      context.push(toWorkspaceSearchContextItem(result));

      if (context.length >= maxResults) {
        return context;
      }
    }
  }

  return context;
}

export function createWorkbenchWorkspaceAiContextQueries(
  model: Pick<TextFileModel, "name" | "value">,
  maxResults: number
): readonly string[] {
  const queryLimit = normalizePositiveInteger(maxResults);

  if (queryLimit === 0) {
    return [];
  }

  const queries: string[] = [];
  const seenQueries = new Set<string>();
  const candidates = [
    stripMarkdownExtension(model.name),
    ...readMarkdownHeadings(model.value),
    ...readMarkdownTags(model.value)
  ];

  for (const candidate of candidates) {
    const query = createSearchQuery(candidate, queryLimit);

    if (!query || seenQueries.has(query)) {
      continue;
    }

    seenQueries.add(query);
    queries.push(query);

    if (queries.length >= queryLimit) {
      return queries;
    }
  }

  return queries;
}

function toWorkspaceSearchContextItem(result: WorkspaceSearchResult): AiTextContextItem {
  return {
    kind: "workspace-search",
    title: `${result.relativePath}:${result.line}`,
    uri: result.uri,
    value: [
      `Path: ${result.relativePath}`,
      `Line: ${result.line}`,
      result.preview
    ].join("\n")
  };
}

function isActiveModelSearchResult(
  result: WorkspaceSearchResult,
  model: Pick<TextFileModel, "uri">
): boolean {
  return result.uri.toString() === model.uri.toString();
}

function createSearchQuery(value: string, maxTerms: number): string {
  return [...value.matchAll(/[\p{Letter}\p{Number}_-]+/gu)]
    .map((match) => match[0].trim().toLowerCase())
    .filter(Boolean)
    .slice(0, normalizePositiveInteger(maxTerms))
    .join(" ");
}

function readMarkdownHeadings(value: string): readonly string[] {
  return value
    .split(/\r?\n/)
    .flatMap((line) => {
      const match = /^(#{1,6})\s+(.+?)\s*$/.exec(line);
      const text = match?.[2]?.replace(/\s+#+\s*$/, "").trim();
      return text ? [text] : [];
    });
}

function readMarkdownTags(value: string): readonly string[] {
  const tags: string[] = [];
  const seenTags = new Set<string>();
  const tagPattern = /(^|[\s([{])#([\p{Letter}\p{Number}_][\p{Letter}\p{Number}_/-]*)/gu;

  for (const match of value.matchAll(tagPattern)) {
    const tag = match[2]?.trim();

    if (!tag || seenTags.has(tag)) {
      continue;
    }

    seenTags.add(tag);
    tags.push(tag);
  }

  return tags;
}

function stripMarkdownExtension(value: string): string {
  return value.replace(/\.md$/i, "");
}

function normalizePositiveInteger(value: number): number {
  if (!Number.isFinite(value) || value <= 0) {
    return 0;
  }

  return Math.floor(value);
}
