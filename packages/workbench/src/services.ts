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
  IRecentService,
  IResourceService,
  ITextFileService,
  IWorkspaceService,
  KeybindingService,
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
  type IRecentService as RecentServiceContract,
  type IResourceService as ResourceServiceContract,
  type ITextFileService as TextFileServiceContract,
  type IWorkspaceService as WorkspaceServiceContract,
  type KeybindingRule
} from "@typora-plus/platform";

export interface WorkbenchServices {
  readonly serviceCollection: ServiceCollection;
  readonly commandService: CommandServiceContract;
  readonly attachmentService: AttachmentServiceContract;
  readonly configurationService: ConfigurationServiceContract;
  readonly exportService: ExportServiceContract;
  readonly fileService: FileServiceContract;
  readonly indexService: IndexServiceContract;
  readonly keybindingService: KeybindingServiceContract;
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
  const exportService = new ExportService();
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
  serviceCollection.set(IExportService, exportService);
  serviceCollection.set(IFileService, fileService);
  serviceCollection.set(IIndexService, indexService);
  serviceCollection.set(IKeybindingService, keybindingService);
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
    recentService,
    resourceService,
    textFileService,
    workspaceService
  };
}

const defaultWorkbenchKeybindings: readonly KeybindingRule[] = [
  {
    command: "workbench.commandPalette.open",
    keybinding: { key: "p", primary: true, shift: true }
  },
  {
    command: "workbench.quickOpen",
    keybinding: { key: "p", primary: true }
  },
  {
    command: "workbench.settings.open",
    keybinding: { key: ",", primary: true }
  },
  {
    command: "file.save",
    keybinding: { key: "s", primary: true }
  },
  {
    command: "file.saveAs",
    keybinding: { key: "s", primary: true, shift: true }
  },
  {
    command: "file.exportHtml",
    keybinding: { key: "e", primary: true, shift: true }
  }
];

function readPrimaryModifierLabel(): string {
  if (typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform)) {
    return "Cmd";
  }

  return "Ctrl";
}
