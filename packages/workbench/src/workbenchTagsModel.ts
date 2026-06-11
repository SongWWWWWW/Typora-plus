import type { WorkspaceIndexedTagSummary } from "@typora-plus/platform";

export interface WorkbenchTagRow {
  readonly tag: WorkspaceIndexedTagSummary;
  readonly key: string;
  readonly active: boolean;
}

export interface WorkbenchTagSelectionCallbacks {
  readonly setSelectedTag: (tag: string | undefined) => void;
}

export function syncWorkbenchSelectedTag(
  tags: readonly WorkspaceIndexedTagSummary[],
  selectedTag: string | undefined,
  callbacks: WorkbenchTagSelectionCallbacks
): void {
  const nextSelectedTag = nextWorkbenchSelectedTag(tags, selectedTag);

  if (nextSelectedTag !== selectedTag) {
    callbacks.setSelectedTag(nextSelectedTag);
  }
}

export function nextWorkbenchSelectedTag(
  tags: readonly WorkspaceIndexedTagSummary[],
  selectedTag: string | undefined
): string | undefined {
  if (tags.length === 0) {
    return undefined;
  }

  const normalizedSelectedTag = normalizeWorkbenchTagName(selectedTag);

  if (!normalizedSelectedTag) {
    return tags[0]?.tag;
  }

  return tags.find((tag) => normalizeWorkbenchTagName(tag.tag) === normalizedSelectedTag)?.tag
    ?? tags[0]?.tag;
}

export function createWorkbenchTagRows(
  tags: readonly WorkspaceIndexedTagSummary[],
  selectedTag: string | undefined
): readonly WorkbenchTagRow[] {
  const normalizedSelectedTag = normalizeWorkbenchTagName(selectedTag);

  return tags.map((tag) => ({
    tag,
    key: workbenchTagKey(tag),
    active: normalizedSelectedTag !== "" && normalizeWorkbenchTagName(tag.tag) === normalizedSelectedTag
  }));
}

export function workbenchTagKey(tag: WorkspaceIndexedTagSummary): string {
  return tag.tag;
}

export function normalizeWorkbenchTagName(tag: string | undefined): string {
  return tag?.trim().toLowerCase() ?? "";
}
