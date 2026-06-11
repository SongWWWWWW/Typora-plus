import type {
  IAttachmentService,
  IIndexService,
  IKeybindingService,
  TyporaPlusConfiguration
} from "@typora-plus/platform";

export interface WorkbenchConfigurationSyncServices {
  readonly attachmentService: Pick<IAttachmentService, "configure">;
  readonly indexService: Pick<IIndexService, "configure">;
  readonly keybindingService: Pick<IKeybindingService, "setUserKeybindings">;
}

export function applyWorkbenchConfigurationToServices(
  services: WorkbenchConfigurationSyncServices,
  configuration: TyporaPlusConfiguration
): void {
  services.attachmentService.configure({
    assetFolder: configuration.workspace.defaultAssetFolder
  });
  services.indexService.configure({
    maxFileSizeBytes: configuration.workspace.searchMaxFileSizeBytes,
    maxResults: configuration.workspace.searchMaxResults
  });
  services.keybindingService.setUserKeybindings(configuration.keybindings.overrides);
}
