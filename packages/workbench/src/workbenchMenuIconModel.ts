import type { MenuIconId, TyporaPlusConfiguration } from "@typora-plus/platform";

export const workbenchMenuIconIds = {
  command: "command",
  fileDown: "file-down",
  filePlus: "file-plus",
  fileText: "file-text",
  folderOpen: "folder-open",
  hash: "hash",
  link: "link",
  listTree: "list-tree",
  save: "save",
  search: "search",
  settings: "settings",
  target: "target",
  theme: "theme",
  type: "type"
} as const satisfies Record<string, MenuIconId>;

export type WorkbenchMenuIconName =
  | "command"
  | "file-down"
  | "file-plus"
  | "file-text"
  | "folder-open"
  | "hash"
  | "link"
  | "list-tree"
  | "moon"
  | "save"
  | "search"
  | "settings"
  | "sun"
  | "target"
  | "type";

export interface WorkbenchMenuIconConfiguration {
  readonly appearance: Pick<TyporaPlusConfiguration["appearance"], "colorScheme">;
}

const workbenchMenuIconNamesById: Readonly<Record<string, WorkbenchMenuIconName | undefined>> = {
  [workbenchMenuIconIds.command]: "command",
  [workbenchMenuIconIds.fileDown]: "file-down",
  [workbenchMenuIconIds.filePlus]: "file-plus",
  [workbenchMenuIconIds.fileText]: "file-text",
  [workbenchMenuIconIds.folderOpen]: "folder-open",
  [workbenchMenuIconIds.hash]: "hash",
  [workbenchMenuIconIds.link]: "link",
  [workbenchMenuIconIds.listTree]: "list-tree",
  [workbenchMenuIconIds.save]: "save",
  [workbenchMenuIconIds.search]: "search",
  [workbenchMenuIconIds.settings]: "settings",
  [workbenchMenuIconIds.target]: "target",
  [workbenchMenuIconIds.type]: "type"
};

export function isKnownWorkbenchMenuIconId(icon: MenuIconId | undefined): boolean {
  return Boolean(icon && (icon === workbenchMenuIconIds.theme || workbenchMenuIconNamesById[icon]));
}

export function resolveWorkbenchMenuIconName(
  icon: MenuIconId | undefined,
  configuration: WorkbenchMenuIconConfiguration
): WorkbenchMenuIconName {
  if (icon === workbenchMenuIconIds.theme) {
    return configuration.appearance.colorScheme === "dark" ? "sun" : "moon";
  }

  return icon ? workbenchMenuIconNamesById[icon] ?? "command" : "command";
}
