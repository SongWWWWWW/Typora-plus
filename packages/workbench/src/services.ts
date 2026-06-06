import { createWelcomeDocument, markdownHtmlExportProvider } from "@typora-plus/markdown";
import {
  CommandService,
  ConfigurationService,
  ExportService,
  IAttachmentService,
  IConfigurationService,
  ICommandService,
  IExportService,
  IFileService,
  IIndexService,
  IKeybindingService,
  IMenuService,
  IRecentService,
  IResourceService,
  ITextFileService,
  IWorkspaceService,
  KeybindingService,
  MenuService,
  NativeAttachmentService,
  NativeFileService,
  NativeResourceService,
  PersistedWorkspaceIndexProvider,
  RecentService,
  ServiceCollection,
  WorkspaceIndexService,
  WorkspaceTextFileService,
  WorkspaceService,
  createDefaultWorkspaceIndexSnapshotStorage,
  type IAttachmentService as AttachmentServiceContract,
  type IConfigurationService as ConfigurationServiceContract,
  type ICommandService as CommandServiceContract,
  type IExportService as ExportServiceContract,
  type IFileService as FileServiceContract,
  type IIndexService as IndexServiceContract,
  type IKeybindingService as KeybindingServiceContract,
  type IMenuService as MenuServiceContract,
  type IRecentService as RecentServiceContract,
  type IResourceService as ResourceServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IWorkspaceService as WorkspaceServiceContract
} from "@typora-plus/platform";
import { defaultWorkbenchKeybindings, defaultWorkbenchMenuItems } from "./workbenchContributions";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly attachmentService: AttachmentServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly exportService: ExportServiceContract;
  readonly fileService: FileServiceContract;
  readonly indexService: IndexServiceContract;
  readonly keybindingService: KeybindingServiceContract;
  readonly menuService: MenuServiceContract;
  readonly recentService: RecentServiceContract;
  readonly resourceService: ResourceServiceContract;
  readonly textFileService: TextFileServiceContract;
  readonly workspaceService: WorkspaceServiceContract;
}

export function createWorkbenchServices(): WorkbenchServices {
  const serviceCollection = new ServiceCollection();

  const configurationService = new ConfigurationService();
  const workspaceService = new WorkspaceService({
    name: "Typora Plus"
  });
  const fileService = new NativeFileService();
  const resourceService = new NativeResourceService();
  const exportService = new ExportService({ resourceService });
  const indexSnapshotStorage = createDefaultWorkspaceIndexSnapshotStorage();
  const indexService = new WorkspaceIndexService(fileService, {
    maxFileSizeBytes: configurationService.getValue().workspace.searchMaxFileSizeBytes,
    maxResults: configurationService.getValue().workspace.searchMaxResults
  }, indexSnapshotStorage
    ? new PersistedWorkspaceIndexProvider({ storage: indexSnapshotStorage })
    : undefined);
  const keybindingService = new KeybindingService({
    primaryModifierLabel: readPrimaryModifierLabel()
  });
  const menuService = new MenuService();
  const recentService = new RecentService();
  const attachmentService = new NativeAttachmentService(
    configurationService.getValue().workspace.defaultAssetFolder
  );
  const textFileService = new WorkspaceTextFileService(fileService, {
    storageKey: "typora-plus.default-draft",
    defaultName: "Untitled.md",
    defaultContent: createWelcomeDocument()
  });

  serviceCollection.set(IAttachmentService, attachmentService);
  serviceCollection.set(IConfigurationService, configurationService);
  serviceCollection.set(IExportService, exportService);
  serviceCollection.set(IFileService, fileService);
  serviceCollection.set(IIndexService, indexService);
  serviceCollection.set(IKeybindingService, keybindingService);
  serviceCollection.set(IMenuService, menuService);
  serviceCollection.set(IRecentService, recentService);
  serviceCollection.set(IResourceService, resourceService);
  serviceCollection.set(IWorkspaceService, workspaceService);
  serviceCollection.set(ITextFileService, textFileService);

  const commandService = new CommandService(serviceCollection);
  serviceCollection.set(ICommandService, commandService);
  exportService.registerProvider(markdownHtmlExportProvider);

  for (const rule of defaultWorkbenchKeybindings) {
    keybindingService.registerKeybinding(rule);
  }
  for (const item of defaultWorkbenchMenuItems) {
    menuService.registerMenuItem(item);
  }
  keybindingService.setUserKeybindings(configurationService.getValue().keybindings.overrides);

  return {
    serviceCollection,
    commandService,
    attachmentService,
    configurationService,
    exportService,
    fileService,
    indexService,
    keybindingService,
    menuService,
    recentService,
    resourceService,
    textFileService,
    workspaceService
  };
}

function readPrimaryModifierLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    return "Cmd";
  }

  return "Ctrl";
}
