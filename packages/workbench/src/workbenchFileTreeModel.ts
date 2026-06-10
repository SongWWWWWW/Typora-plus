import type { FileTreeEntry } from "@typora-plus/platform";

export interface WorkbenchFileTreeModelOptions {
  readonly activeUri: string;
  readonly dirty: boolean;
  readonly initialDepth?: number;
}

export interface WorkbenchFileTreeRow {
  readonly entry: FileTreeEntry;
  readonly key: string;
  readonly kind: FileTreeEntry["kind"];
  readonly depth: number;
  readonly active: boolean;
  readonly dirty: boolean;
  readonly fileEntry: WorkbenchFileTreeFileEntry | undefined;
}

export type WorkbenchFileTreeFileEntry = FileTreeEntry & { readonly kind: "file" };

export function createWorkbenchFileTreeRows(
  entries: readonly FileTreeEntry[],
  options: WorkbenchFileTreeModelOptions
): readonly WorkbenchFileTreeRow[] {
  const rows: WorkbenchFileTreeRow[] = [];
  visitWorkbenchFileTreeEntries(entries, normalizeTreeDepth(options.initialDepth ?? 0), options, rows);
  return rows;
}

export function isWorkbenchFileTreeFileEntry(
  entry: FileTreeEntry
): entry is WorkbenchFileTreeFileEntry {
  return entry.kind === "file";
}

export function workbenchFileTreeEntryKey(entry: FileTreeEntry): string {
  return entry.uri.toString();
}

export function isWorkbenchFileTreeEntryActive(
  entry: FileTreeEntry,
  activeUri: string
): boolean {
  return entry.uri.toString() === activeUri;
}

function visitWorkbenchFileTreeEntries(
  entries: readonly FileTreeEntry[],
  depth: number,
  options: WorkbenchFileTreeModelOptions,
  rows: WorkbenchFileTreeRow[]
): void {
  for (const entry of entries) {
    const active = isWorkbenchFileTreeEntryActive(entry, options.activeUri);
    const fileEntry = isWorkbenchFileTreeFileEntry(entry) ? entry : undefined;

    rows.push({
      entry,
      key: workbenchFileTreeEntryKey(entry),
      kind: entry.kind,
      depth,
      active,
      dirty: active && fileEntry !== undefined && options.dirty,
      fileEntry
    });

    if (entry.kind === "directory") {
      visitWorkbenchFileTreeEntries(entry.children ?? [], depth + 1, options, rows);
    }
  }
}

function normalizeTreeDepth(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.trunc(value));
}
