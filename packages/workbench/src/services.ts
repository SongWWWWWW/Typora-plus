import { createWelcomeDocument, markdownHtmlExportProvider } from "@typora-plus/markdown";
import {
  AiService,
  CommandService,
  ConfigurationService,
  ContextKeyService,
  ExtensionHostService,
  ExtensionService,
  ExportService,
  IAttachmentService,
  IAiService,
  IConfigurationService,
  IContextKeyService,
  ICommandService,
  IExtensionHostService,
  IExtensionService,
  IExportService,
  IFileService,
  IIndexService,
  IKeybindingService,
  IMarkdownRendererService,
  IMenuService,
  IRecentService,
  IResourceService,
  IRemoteSyncService,
  IRemoteSyncWorkspaceResourceService,
  ITextFileService,
  IThemeService,
  IWorkspaceService,
  KeybindingService,
  MarkdownRendererService,
  MenuService,
  NativeAttachmentService,
  NativeFileService,
  NativeRemoteSyncWorkspaceResourceService,
  NativeResourceService,
  PersistedWorkspaceIndexProvider,
  RecentService,
  RemoteSyncService,
  ServiceCollection,
  ThemeService,
  WorkspaceIndexService,
  WorkspaceTextFileService,
  WorkspaceService,
  createDefaultRemoteSyncManifestStorage,
  createNativeResponsesAiProviderFactoryOptions,
  createNativeRemoteSyncConfiguredProviderFactoryOptions,
  createNativeRemoteSyncRequestTransport,
  createRemoteSyncConfiguredRawMirrorProviderFactory,
  createDefaultWorkspaceIndexSnapshotStorage,
  type IAttachmentService as AttachmentServiceContract,
  type IAiService as AiServiceContract,
  type IConfigurationService as ConfigurationServiceContract,
  type IContextKeyService as ContextKeyServiceContract,
  type ICommandService as CommandServiceContract,
  type IExtensionHostService as ExtensionHostServiceContract,
  type IExtensionService as ExtensionServiceContract,
  type IExportService as ExportServiceContract,
  type IFileService as FileServiceContract,
  type IIndexService as IndexServiceContract,
  type IKeybindingService as KeybindingServiceContract,
  type IMarkdownRendererService as MarkdownRendererServiceContract,
  type IMenuService as MenuServiceContract,
  type IRecentService as RecentServiceContract,
  type IResourceService as ResourceServiceContract,
  type IRemoteSyncService as RemoteSyncServiceContract,
  type IRemoteSyncWorkspaceResourceService as RemoteSyncWorkspaceResourceServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IThemeService as ThemeServiceContract,
  type IWorkspaceService as WorkspaceServiceContract
} from "@typora-plus/platform";
import { createWorkbenchExtensionHost } from "./workbenchExtensionActivation";
import { defaultWorkbenchExtensionManifest } from "./workbenchContributions";
import { applyWorkbenchConfigurationToServices } from "./workbenchConfigurationSync";
import {
  applyWorkbenchCapabilityContext
} from "./workbenchContextModel";
import { synchronizeWorkbenchConfiguredAiProviders } from "./workbenchConfiguredAiProviders";
import { synchronizeWorkbenchConfiguredRemoteSyncProviders } from "./workbenchConfiguredRemoteSyncProviders";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly attachmentService: AttachmentServiceContract;
  readonly aiService: AiServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly contextKeyService: ContextKeyServiceContract;
  readonly extensionHostService: ExtensionHostServiceContract;
  readonly extensionService: ExtensionServiceContract;
  readonly exportService: ExportServiceContract;
  readonly fileService: FileServiceContract;
  readonly indexService: IndexServiceContract;
  readonly keybindingService: KeybindingServiceContract;
  readonly markdownRendererService: MarkdownRendererServiceContract;
  readonly menuService: MenuServiceContract;
  readonly recentService: RecentServiceContract;
  readonly remoteSyncService: RemoteSyncServiceContract;
  readonly remoteSyncWorkspaceResourceService: RemoteSyncWorkspaceResourceServiceContract;
  readonly resourceService: ResourceServiceContract;
  readonly textFileService: TextFileServiceContract;
  readonly themeService: ThemeServiceContract;
  readonly workspaceService: WorkspaceServiceContract;
}

export function createWorkbenchServices(): WorkbenchServices {
  const serviceCollection = new ServiceCollection();
  let extensionService: ExtensionServiceContract | undefined;

  const configurationService = new ConfigurationService();
  const aiService = new AiService();
  const configuredAiProviderOptions = createNativeResponsesAiProviderFactoryOptions();
  const workspaceService = new WorkspaceService({
    name: "Typora Plus"
  });
  const fileService = new NativeFileService();
  const resourceService = new NativeResourceService();
  const exportService = new ExportService({ resourceService });
  const contextKeyService = new ContextKeyService();
  const themeService = new ThemeService();
  const remoteSyncService = new RemoteSyncService();
  const remoteSyncWorkspaceResourceService = new NativeRemoteSyncWorkspaceResourceService();
  const remoteSyncManifestStorage = createDefaultRemoteSyncManifestStorage();
  const configuredRemoteSyncProviderOptions = createNativeRemoteSyncConfiguredProviderFactoryOptions(
    createRemoteSyncConfiguredRawMirrorProviderFactory(remoteSyncManifestStorage
      ? { manifestStorage: remoteSyncManifestStorage }
      : {}),
    createNativeRemoteSyncRequestTransport(),
    remoteSyncWorkspaceResourceService
  );
  const extensionHostService = new ExtensionHostService();
  const markdownRendererService = new MarkdownRendererService({
    activationHandler: async (rendererId) => {
      await extensionService?.activateByEvent(`onMarkdownRenderer:${rendererId}`);
    }
  });
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
  const configuredAiProviders = synchronizeWorkbenchConfiguredAiProviders({
    aiService,
    configurationService
  }, configuredAiProviderOptions);
  const configuredRemoteSyncProviders = synchronizeWorkbenchConfiguredRemoteSyncProviders({
    configurationService,
    remoteSyncService
  }, configuredRemoteSyncProviderOptions);

  serviceCollection.set(IAttachmentService, attachmentService);
  serviceCollection.set(IAiService, aiService);
  serviceCollection.set(IConfigurationService, configurationService);
  serviceCollection.set(IContextKeyService, contextKeyService);
  serviceCollection.set(IExtensionHostService, extensionHostService);
  serviceCollection.set(IExportService, exportService);
  serviceCollection.set(IFileService, fileService);
  serviceCollection.set(IIndexService, indexService);
  serviceCollection.set(IKeybindingService, keybindingService);
  serviceCollection.set(IMarkdownRendererService, markdownRendererService);
  serviceCollection.set(IMenuService, menuService);
  serviceCollection.set(IRecentService, recentService);
  serviceCollection.set(IRemoteSyncService, remoteSyncService);
  serviceCollection.set(IRemoteSyncWorkspaceResourceService, remoteSyncWorkspaceResourceService);
  serviceCollection.set(IResourceService, resourceService);
  serviceCollection.set(IThemeService, themeService);
  serviceCollection.set(IWorkspaceService, workspaceService);
  serviceCollection.set(ITextFileService, textFileService);
  applyWorkbenchCapabilityContext({
    attachmentService,
    contextKeyService,
    fileService,
    resourceService
  });

  const commandService = new CommandService(serviceCollection, {
    activationHandler: async (command) => {
      await extensionService?.activateByEvent(`onCommand:${command}`);
    }
  });
  serviceCollection.set(ICommandService, commandService);
  extensionHostService.registerHost(createWorkbenchExtensionHost({
    getConfiguration: () => configurationService.getValue()
  }));
  extensionService = new ExtensionService(commandService, menuService, keybindingService, {
    activationHandler: (request) => extensionHostService.activate(request),
    aiService,
    contextKeyService,
    exportService,
    markdownRendererService,
    remoteSyncService,
    themeService
  });
  serviceCollection.set(IExtensionService, extensionService);
  exportService.registerProvider(markdownHtmlExportProvider);
  extensionService.registerExtension(defaultWorkbenchExtensionManifest);
  void configuredAiProviders;
  void configuredRemoteSyncProviders;
  applyWorkbenchConfigurationToServices({
    attachmentService,
    indexService,
    keybindingService
  }, configurationService.getValue());

  return {
    serviceCollection,
    commandService,
    attachmentService,
    aiService,
    configurationService,
    contextKeyService,
    extensionHostService,
    extensionService,
    exportService,
    fileService,
    indexService,
    keybindingService,
    markdownRendererService,
    menuService,
    recentService,
    remoteSyncService,
    remoteSyncWorkspaceResourceService,
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
