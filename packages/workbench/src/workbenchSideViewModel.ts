export const workbenchSideViews = {
  files: "files",
  search: "search",
  outline: "outline",
  backlinks: "backlinks",
  tags: "tags"
} as const satisfies Record<string, string>;

export type WorkbenchSideView = typeof workbenchSideViews[keyof typeof workbenchSideViews];

export const workbenchFilesSideView: WorkbenchSideView = workbenchSideViews.files;
export const defaultWorkbenchSideView: WorkbenchSideView = workbenchSideViews.outline;

export function toggleWorkbenchSideView(
  view: WorkbenchSideView,
  activeView: WorkbenchSideView | null
): WorkbenchSideView | null {
  return activeView === view ? null : view;
}

export function workbenchSideViewTitle(view: WorkbenchSideView): string {
  switch (view) {
    case workbenchSideViews.files:
      return "Files";
    case workbenchSideViews.search:
      return "Search";
    case workbenchSideViews.outline:
      return "Outline";
    case workbenchSideViews.backlinks:
      return "Backlinks";
    case workbenchSideViews.tags:
      return "Tags";
  }
}
