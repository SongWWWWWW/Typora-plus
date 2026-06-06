import { createWelcomeDocument } from "@typora-plus/markdown";
import {
  BrowserTextFileService,
  CommandService,
  ConfigurationService,
  IConfigurationService,
  ICommandService,
  ITextFileService,
  IWorkspaceService,
  ServiceCollection,
  WorkspaceService,
  type IConfigurationService as ConfigurationServiceContract,
  type ICommandService as CommandServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IWorkspaceService as WorkspaceServiceContract
} from "@typora-plus/platform";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly textFileService: TextFileServiceContract;
  readonly workspaceService: WorkspaceServiceContract;
}

export function createWorkbenchServices(): WorkbenchServices {
  const serviceCollection = new ServiceCollection();

  const configurationService = new ConfigurationService();
  const workspaceService = new WorkspaceService({
    name: "Typora Plus"
  });
  const textFileService = new BrowserTextFileService({
    storageKey: "typora-plus.default-draft",
    defaultName: "Untitled.md",
    defaultContent: createWelcomeDocument()
  });

  serviceCollection.set(IConfigurationService, configurationService);
  serviceCollection.set(IWorkspaceService, workspaceService);
  serviceCollection.set(ITextFileService, textFileService);

  const commandService = new CommandService(serviceCollection);
  serviceCollection.set(ICommandService, commandService);

  return {
    serviceCollection,
    commandService,
    configurationService,
    textFileService,
    workspaceService
  };
}
