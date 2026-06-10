import type { FileTreeEntry, RecentResource } from "@typora-plus/platform";

export interface WorkbenchRecentResourceOptions {
  readonly maxItemsPerSection: number;
}

export interface WorkbenchRecentResourceSections {
  readonly files: readonly RecentResource[];
  readonly workspaces: readonly RecentResource[];
}

export interface WorkbenchRecentResourceRow {
  readonly resource: RecentResource;
  readonly key: string;
  readonly kind: RecentResource["kind"];
  readonly active: boolean;
  readonly fileEntry: FileTreeEntry | undefined;
}

export type WorkbenchRecentFileResource = RecentResource & { readonly kind: "file" };

export const defaultWorkbenchRecentResourceOptions: WorkbenchRecentResourceOptions = {
  maxItemsPerSection: 8
};

export function createWorkbenchRecentResourceSections(
  recents: readonly RecentResource[],
  options: WorkbenchRecentResourceOptions = defaultWorkbenchRecentResourceOptions
): WorkbenchRecentResourceSections {
  const maxItemsPerSection = normalizeRecentSectionLimit(options.maxItemsPerSection);

  return {
    files: recents
      .filter((recent) => recent.kind === "file")
      .slice(0, maxItemsPerSection),
    workspaces: recents
      .filter((recent) => recent.kind === "workspace")
      .slice(0, maxItemsPerSection)
  };
}

export function createWorkbenchRecentResourceRows(
  recents: readonly RecentResource[],
  activeUri: string | undefined
): readonly WorkbenchRecentResourceRow[] {
  return recents.map((recent) => ({
    resource: recent,
    key: workbenchRecentResourceKey(recent),
    kind: recent.kind,
    active: isWorkbenchRecentResourceActive(recent, activeUri),
    fileEntry: isWorkbenchRecentFileResource(recent) ? workbenchRecentFileEntry(recent) : undefined
  }));
}

export function isWorkbenchRecentFileResource(
  recent: RecentResource
): recent is WorkbenchRecentFileResource {
  return recent.kind === "file";
}

export function workbenchRecentResourceKey(recent: RecentResource): string {
  return `${recent.kind}-${recent.uri.toString()}`;
}

export function isWorkbenchRecentResourceActive(
  recent: RecentResource,
  activeUri: string | undefined
): boolean {
  return recent.uri.toString() === activeUri;
}

export function workbenchRecentFileEntry(recent: WorkbenchRecentFileResource): FileTreeEntry {
  return {
    uri: recent.uri,
    name: recent.name,
    relativePath: recent.name,
    kind: "file"
  };
}

function normalizeRecentSectionLimit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}
