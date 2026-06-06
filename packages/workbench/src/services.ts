import { createWelcomeDocument } from "@typora-plus/markdown";
import {
  CommandService,
  ConfigurationService,
  IAttachmentService,
  IConfigurationService,
  ICommandService,
  IFileService,
  IIndexService,
  IRecentService,
  IResourceService,
  ITextFileService,
  IWorkspaceService,
  NativeAttachmentService,
  NativeFileService,
  NativeResourceService,
  RecentService,
  ServiceCollection,
  WorkspaceIndexService,
  WorkspaceTextFileService,
  WorkspaceService,
  type IAttachmentService as AttachmentServiceContract,
  type IConfigurationService as ConfigurationServiceContract,
  type ICommandService as CommandServiceContract,
  type IFileService as FileServiceContract,
  type IIndexService as IndexServiceContract,
  type IRecentService as RecentServiceContract,
  type IResourceService as ResourceServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IWorkspaceService as WorkspaceServiceContract
} from "@typora-plus/platform";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly attachmentService: AttachmentServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly fileService: FileServiceContract;
  readonly indexService: IndexServiceContract;
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
  const indexService = new WorkspaceIndexService(fileService, {
    maxFileSizeBytes: configurationService.getValue().workspace.searchMaxFileSizeBytes,
    maxResults: configurationService.getValue().workspace.searchMaxResults
  });
  const recentService = new RecentService();
  const attachmentService = new NativeAttachmentService(
    configurationService.getValue().workspace.defaultAssetFolder
  );
  const resourceService = new NativeResourceService();
  const textFileService = new WorkspaceTextFileService(fileService, {
    storageKey: "typora-plus.default-draft",
    defaultName: "Untitled.md",
    defaultContent: createWelcomeDocument()
  });

  serviceCollection.set(IAttachmentService, attachmentService);
  serviceCollection.set(IConfigurationService, configurationService);
  serviceCollection.set(IFileService, fileService);
  serviceCollection.set(IIndexService, indexService);
  serviceCollection.set(IRecentService, recentService);
  serviceCollection.set(IResourceService, resourceService);
  serviceCollection.set(IWorkspaceService, workspaceService);
  serviceCollection.set(ITextFileService, textFileService);

  const commandService = new CommandService(serviceCollection);
  serviceCollection.set(ICommandService, commandService);

  return {
    serviceCollection,
    commandService,
    attachmentService,
    configurationService,
    fileService,
    indexService,
    recentService,
    resourceService,
    textFileService,
    workspaceService
  };
}
