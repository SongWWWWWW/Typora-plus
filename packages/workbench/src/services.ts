import { createWelcomeDocument } from "@typora-plus/markdown";
import {
  CommandService,
  ConfigurationService,
  IConfigurationService,
  ICommandService,
  IFileService,
  ITextFileService,
  IWorkspaceService,
  NativeFileService,
  ServiceCollection,
  WorkspaceTextFileService,
  WorkspaceService,
  type IConfigurationService as ConfigurationServiceContract,
  type ICommandService as CommandServiceContract,
  type IFileService as FileServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IWorkspaceService as WorkspaceServiceContract
} from "@typora-plus/platform";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly fileService: FileServiceContract;
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
  const textFileService = new WorkspaceTextFileService(fileService, {
    storageKey: "typora-plus.default-draft",
    defaultName: "Untitled.md",
    defaultContent: createWelcomeDocument()
  });

  serviceCollection.set(IConfigurationService, configurationService);
  serviceCollection.set(IFileService, fileService);
  serviceCollection.set(IWorkspaceService, workspaceService);
  serviceCollection.set(ITextFileService, textFileService);

  const commandService = new CommandService(serviceCollection);
  serviceCollection.set(ICommandService, commandService);

  return {
    serviceCollection,
    commandService,
    configurationService,
    fileService,
    textFileService,
    workspaceService
  };
}
