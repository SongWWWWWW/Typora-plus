import type { MenuItem } from "@typora-plus/platform";
import {
  Command as CommandIcon,
  FileDown,
  FilePlus,
  FileText,
  FolderOpen,
  Hash,
  Link2,
  ListTree,
  Moon,
  RefreshCw,
  Save,
  Search,
  Settings as SettingsIcon,
  Sun,
  Target,
  Type,
  type LucideIcon
} from "lucide-react";
import type { ReactNode } from "react";
import {
  resolveWorkbenchMenuIconName,
  type WorkbenchMenuIconConfiguration,
  type WorkbenchMenuIconName
} from "./workbenchMenuIconModel";

const workbenchMenuIconComponents = {
  command: CommandIcon,
  "file-down": FileDown,
  "file-plus": FilePlus,
  "file-text": FileText,
  "folder-open": FolderOpen,
  hash: Hash,
  link: Link2,
  "list-tree": ListTree,
  moon: Moon,
  "refresh-cw": RefreshCw,
  save: Save,
  search: Search,
  settings: SettingsIcon,
  sun: Sun,
  target: Target,
  type: Type
} satisfies Record<WorkbenchMenuIconName, LucideIcon>;

export function renderWorkbenchMenuIcon(
  item: Pick<MenuItem, "icon">,
  configuration: WorkbenchMenuIconConfiguration,
  size: number
): ReactNode {
  const Icon = workbenchMenuIconComponents[resolveWorkbenchMenuIconName(item.icon, configuration)];

  return <Icon size={size} />;
}
