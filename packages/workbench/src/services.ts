import { createWelcomeDocument } from "@typora-plus/markdown";
import {
  CommandService,
  ConfigurationService,
  IAttachmentService,
  IConfigurationService,
  ICommandService,
  IFileService,
  IRecentService,
  ITextFileService,
  IWorkspaceService,
  NativeAttachmentService,
  NativeFileService,
  RecentService,
  ServiceCollection,
  WorkspaceTextFileService,
  WorkspaceService,
  type IAttachmentService as AttachmentServiceContract,
  type IConfigurationService as ConfigurationServiceContract,
  type ICommandService as CommandServiceContract,
  type IFileService as FileServiceContract,
  type IRecentService as RecentServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IWorkspaceService as WorkspaceServiceContract
} from "@typora-plus/platform";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly attachmentService: AttachmentServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly fileService: FileServiceContract;
  readonly recentService: RecentServiceContract;
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
  serviceCollection.set(IFileService, fileService);
  serviceCollection.set(IRecentService, recentService);
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
    recentService,
    textFileService,
    workspaceService
  };
}
