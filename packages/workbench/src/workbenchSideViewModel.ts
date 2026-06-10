export type WorkbenchSideView = "files" | "search" | "outline" | "backlinks" | "tags";

export const defaultWorkbenchSideView: WorkbenchSideView = "outline";

export function toggleWorkbenchSideView(
  view: WorkbenchSideView,
  activeView: WorkbenchSideView | null
): WorkbenchSideView | null {
  return activeView === view ? null : view;
}

export function workbenchSideViewTitle(view: WorkbenchSideView): string {
  switch (view) {
    case "files":
      return "Files";
    case "search":
      return "Search";
    case "outline":
      return "Outline";
    case "backlinks":
      return "Backlinks";
    case "tags":
      return "Tags";
  }
}
