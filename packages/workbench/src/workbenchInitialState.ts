import type {
  IConfigurationService,
  IIndexService,
  IRecentService,
  ITextFileService,
  IThemeService,
  IWorkspaceService,
  RecentResource,
  RegisteredTheme,
  TextFileModel,
  TyporaPlusConfiguration,
  WorkspaceIndexStatus,
  WorkspaceState
} from "@typora-plus/platform";

export interface WorkbenchInitialStateServices {
  readonly configurationService: Pick<IConfigurationService, "getValue">;
  readonly indexService: Pick<IIndexService, "getStatus">;
  readonly recentService: Pick<IRecentService, "getRecents">;
  readonly textFileService: Pick<ITextFileService, "openDefault">;
  readonly themeService: Pick<IThemeService, "getThemes">;
  readonly workspaceService: Pick<IWorkspaceService, "getWorkspace">;
}

export interface WorkbenchInitialState {
  readonly configuration: TyporaPlusConfiguration;
  readonly indexStatus: WorkspaceIndexStatus;
  readonly model: TextFileModel;
  readonly recents: readonly RecentResource[];
  readonly themes: readonly RegisteredTheme[];
  readonly workspace: WorkspaceState;
}

export function createWorkbenchInitialState(
  services: WorkbenchInitialStateServices
): WorkbenchInitialState {
  return {
    configuration: services.configurationService.getValue(),
    indexStatus: services.indexService.getStatus(),
    model: services.textFileService.openDefault(),
    recents: services.recentService.getRecents(),
    themes: services.themeService.getThemes(),
    workspace: services.workspaceService.getWorkspace()
  };
}
