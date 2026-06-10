import type {
  CommandMetadata,
  MenuItem,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import { workbenchContextKeys } from "./workbenchContextModel";
import type { WorkbenchSideView } from "./workbenchSideViewModel";

export type WorkbenchMenuContext = Readonly<Record<string, boolean | string | null>>;

export interface WorkbenchMenuConfiguration {
  readonly editor: Pick<TyporaPlusConfiguration["editor"], "focusMode" | "typewriterMode">;
}

export function workbenchCommandTitle(
  commands: readonly Pick<CommandMetadata, "id" | "title">[],
  id: string
): string {
  return commands.find((command) => command.id === id)?.title ?? id;
}

export function workbenchMenuItemTitle(
  item: MenuItem,
  getCommandTitle: (id: string) => string
): string {
  return item.title ?? getCommandTitle(item.command);
}

export function createWorkbenchMenuContext(
  configuration: WorkbenchMenuConfiguration,
  sideView: WorkbenchSideView | null
): WorkbenchMenuContext {
  return {
    [workbenchContextKeys.sideView]: sideView,
    [workbenchContextKeys.editorFocusMode]: configuration.editor.focusMode,
    [workbenchContextKeys.editorTypewriterMode]: configuration.editor.typewriterMode
  };
}

export function isWorkbenchMenuItemActive(
  item: MenuItem,
  context: WorkbenchMenuContext
): boolean {
  return item.toggled ? context[item.toggled.context] === item.toggled.value : false;
}
