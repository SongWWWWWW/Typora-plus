import { createWelcomeDocument, markdownHtmlExportProvider } from "@typora-plus/markdown";
import {
  CommandService,
  ConfigurationService,
  ContextKeyService,
  ExtensionService,
  ExportService,
  IAttachmentService,
  IConfigurationService,
  IContextKeyService,
  ICommandService,
  IExtensionService,
  IExportService,
  IFileService,
  IIndexService,
  IKeybindingService,
  IMenuService,
  IRecentService,
  IResourceService,
  ITextFileService,
  IThemeService,
  IWorkspaceService,
  KeybindingService,
  MenuService,
  NativeAttachmentService,
  NativeFileService,
  NativeResourceService,
  PersistedWorkspaceIndexProvider,
  RecentService,
  ServiceCollection,
  ThemeService,
  WorkspaceIndexService,
  WorkspaceTextFileService,
  WorkspaceService,
  createDefaultWorkspaceIndexSnapshotStorage,
  type IAttachmentService as AttachmentServiceContract,
  type IConfigurationService as ConfigurationServiceContract,
  type IContextKeyService as ContextKeyServiceContract,
  type ICommandService as CommandServiceContract,
  type IExtensionService as ExtensionServiceContract,
  type IExportService as ExportServiceContract,
  type IFileService as FileServiceContract,
  type IIndexService as IndexServiceContract,
  type IKeybindingService as KeybindingServiceContract,
  type IMenuService as MenuServiceContract,
  type IRecentService as RecentServiceContract,
  type IResourceService as ResourceServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IThemeService as ThemeServiceContract,
  type IWorkspaceService as WorkspaceServiceContract
} from "@typora-plus/platform";
import { defaultWorkbenchExtensionManifest } from "./workbenchContributions";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly attachmentService: AttachmentServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly contextKeyService: ContextKeyServiceContract;
  readonly extensionService: ExtensionServiceContract;
  readonly exportService: ExportServiceContract;
  readonly fileService: FileServiceContract;
  readonly indexService: IndexServiceContract;
  readonly keybindingService: KeybindingServiceContract;
  readonly menuService: MenuServiceContract;
  readonly recentService: RecentServiceContract;
  readonly resourceService: ResourceServiceContract;
  readonly textFileService: TextFileServiceContract;
  readonly themeService: ThemeServiceContract;
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
  const contextKeyService = new ContextKeyService();
  const themeService = new ThemeService();
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
  const menuService = new MenuService(contextKeyService);
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
  serviceCollection.set(IContextKeyService, contextKeyService);
  serviceCollection.set(IExportService, exportService);
  serviceCollection.set(IFileService, fileService);
  serviceCollection.set(IIndexService, indexService);
  serviceCollection.set(IKeybindingService, keybindingService);
  serviceCollection.set(IMenuService, menuService);
  serviceCollection.set(IRecentService, recentService);
  serviceCollection.set(IResourceService, resourceService);
  serviceCollection.set(IThemeService, themeService);
  serviceCollection.set(IWorkspaceService, workspaceService);
  serviceCollection.set(ITextFileService, textFileService);

  let extensionService: ExtensionServiceContract | undefined;
  const commandService = new CommandService(serviceCollection, {
    activationHandler: async (command) => {
      await extensionService?.activateByEvent(`onCommand:${command}`);
    }
  });
  serviceCollection.set(ICommandService, commandService);
  extensionService = new ExtensionService(commandService, menuService, keybindingService, {
    contextKeyService,
    exportService,
    themeService
  });
  serviceCollection.set(IExtensionService, extensionService);
  exportService.registerProvider(markdownHtmlExportProvider);
  contextKeyService.setValue("fileSystem.available", fileService.isAvailable());
  contextKeyService.setValue("attachment.available", attachmentService.isAvailable());
  contextKeyService.setValue("resource.available", resourceService.isAvailable());
  extensionService.registerExtension(defaultWorkbenchExtensionManifest);
  keybindingService.setUserKeybindings(configurationService.getValue().keybindings.overrides);

  return {
    serviceCollection,
    commandService,
    attachmentService,
    configurationService,
    contextKeyService,
    extensionService,
    exportService,
    fileService,
    indexService,
    keybindingService,
    menuService,
    recentService,
    resourceService,
    textFileService,
    themeService,
    workspaceService
  };
}

function readPrimaryModifierLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    return "Cmd";
  }

  return "Ctrl";
}
