import { DisposableStore, type IDisposable } from "@typora-plus/base";
import type {
  RecentResource,
  RegisteredTheme,
  TextFileModel,
  TyporaPlusConfiguration,
  WorkspaceIndexStatus,
  WorkspaceState
} from "@typora-plus/platform";
import type { WorkbenchServices } from "./services";
import { applyWorkbenchConfigurationToServices } from "./workbenchConfigurationSync";
import { workspaceStateFromFiles } from "./workbenchWorkspaceOpening";

export interface WorkbenchStateSubscriptionCallbacks {
  readonly setConfiguration: (configuration: TyporaPlusConfiguration) => void;
  readonly setIndexStatus: (status: WorkspaceIndexStatus) => void;
  readonly setModel: (model: TextFileModel) => void;
  readonly setRecents: (recents: readonly RecentResource[]) => void;
  readonly setThemes: (themes: readonly RegisteredTheme[]) => void;
  readonly setWorkspace: (workspace: WorkspaceState) => void;
  readonly bumpMarkdownRendererRevision: () => void;
}

export function registerWorkbenchStateSubscriptions(
  services: WorkbenchServices,
  callbacks: WorkbenchStateSubscriptionCallbacks
): IDisposable {
  const disposables = new DisposableStore();

  disposables.add(services.configurationService.onDidChangeConfiguration((nextConfiguration) => {
    applyWorkbenchConfigurationToServices(services, nextConfiguration);
    callbacks.setConfiguration(nextConfiguration);
  }));
  disposables.add(services.textFileService.onDidChangeModel(callbacks.setModel));
  disposables.add(services.workspaceService.onDidChangeWorkspace(callbacks.setWorkspace));
  disposables.add(services.fileService.onDidChangeWorkspaceFiles((workspaceFiles) => {
    if (!workspaceFiles) {
      return;
    }

    services.workspaceService.setWorkspace(workspaceStateFromFiles(workspaceFiles));
  }));
  disposables.add(services.recentService.onDidChangeRecents(callbacks.setRecents));
  disposables.add(services.themeService.onDidChangeThemes(() => {
    callbacks.setThemes(services.themeService.getThemes());
  }));
  disposables.add(services.indexService.onDidChangeStatus(callbacks.setIndexStatus));
  disposables.add(services.markdownRendererService.onDidChangeMarkdownRenderers(
    callbacks.bumpMarkdownRendererRevision
  ));

  return disposables;
}
