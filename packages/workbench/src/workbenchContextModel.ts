import type {
  ContextKeyValue,
  IAttachmentService,
  IAiService,
  IContextKeyService,
  IFileService,
  IRemoteSyncService,
  IResourceService,
  TextFileModel,
  TyporaPlusConfiguration,
  WorkspaceState
} from "@typora-plus/platform";
import type { WorkbenchSideView } from "./workbenchSideViewModel";

export const workbenchContextKeys = {
  fileSystemAvailable: "fileSystem.available",
  attachmentAvailable: "attachment.available",
  resourceAvailable: "resource.available",
  activeResourceScheme: "activeResource.scheme",
  editorFocusMode: "editor.focusMode",
  editorTypewriterMode: "editor.typewriterMode",
  sideView: "sideView",
  workspaceOpen: "workspace.open",
  aiProviderAvailable: "ai.providerAvailable",
  remoteSyncProviderAvailable: "remoteSync.providerAvailable"
} as const;

export type WorkbenchContextKey =
  typeof workbenchContextKeys[keyof typeof workbenchContextKeys];

export interface WorkbenchContextEntry {
  readonly key: WorkbenchContextKey;
  readonly value: ContextKeyValue | undefined;
}

export interface WorkbenchCapabilityContext {
  readonly fileSystemAvailable: boolean;
  readonly attachmentAvailable: boolean;
  readonly resourceAvailable: boolean;
}

export interface WorkbenchCapabilityContextServices {
  readonly attachmentService: Pick<IAttachmentService, "isAvailable">;
  readonly fileService: Pick<IFileService, "isAvailable">;
  readonly resourceService: Pick<IResourceService, "isAvailable">;
}

export interface WorkbenchCapabilityContextApplicationServices extends WorkbenchCapabilityContextServices {
  readonly contextKeyService: Pick<IContextKeyService, "setValue">;
}

export interface WorkbenchStateContextConfiguration {
  readonly editor: Pick<TyporaPlusConfiguration["editor"], "focusMode" | "typewriterMode">;
}

export interface WorkbenchStateContextServices {
  readonly aiService: Pick<IAiService, "getProviders">;
  readonly contextKeyService: Pick<IContextKeyService, "setValue">;
  readonly remoteSyncService: Pick<IRemoteSyncService, "getProviders">;
}

export interface WorkbenchProviderAvailabilityContext {
  readonly aiProviderAvailable: boolean;
  readonly remoteSyncProviderAvailable: boolean;
}

export interface WorkbenchProviderAvailabilityContextServices {
  readonly aiService: Pick<IAiService, "getProviders">;
  readonly remoteSyncService: Pick<IRemoteSyncService, "getProviders">;
}

export function createWorkbenchCapabilityContextValues(
  context: WorkbenchCapabilityContext
): readonly WorkbenchContextEntry[] {
  return [
    {
      key: workbenchContextKeys.fileSystemAvailable,
      value: context.fileSystemAvailable
    },
    {
      key: workbenchContextKeys.attachmentAvailable,
      value: context.attachmentAvailable
    },
    {
      key: workbenchContextKeys.resourceAvailable,
      value: context.resourceAvailable
    }
  ];
}

export function createWorkbenchCapabilityContext(
  services: WorkbenchCapabilityContextServices
): WorkbenchCapabilityContext {
  return {
    attachmentAvailable: services.attachmentService.isAvailable(),
    fileSystemAvailable: services.fileService.isAvailable(),
    resourceAvailable: services.resourceService.isAvailable()
  };
}

export function applyWorkbenchCapabilityContext(
  services: WorkbenchCapabilityContextApplicationServices
): void {
  applyWorkbenchContextValues(
    services.contextKeyService,
    createWorkbenchCapabilityContextValues(createWorkbenchCapabilityContext(services))
  );
}

export function createWorkbenchStateContextValues(
  configuration: WorkbenchStateContextConfiguration,
  model: Pick<TextFileModel, "uri">,
  sideView: WorkbenchSideView | null,
  workspace: Pick<WorkspaceState, "files">,
  providers: WorkbenchProviderAvailabilityContext
): readonly WorkbenchContextEntry[] {
  return [
    {
      key: workbenchContextKeys.activeResourceScheme,
      value: model.uri.scheme
    },
    {
      key: workbenchContextKeys.editorFocusMode,
      value: configuration.editor.focusMode
    },
    {
      key: workbenchContextKeys.editorTypewriterMode,
      value: configuration.editor.typewriterMode
    },
    {
      key: workbenchContextKeys.sideView,
      value: sideView
    },
    {
      key: workbenchContextKeys.workspaceOpen,
      value: workspace.files ? true : false
    },
    {
      key: workbenchContextKeys.aiProviderAvailable,
      value: providers.aiProviderAvailable
    },
    {
      key: workbenchContextKeys.remoteSyncProviderAvailable,
      value: providers.remoteSyncProviderAvailable
    }
  ];
}

export function createWorkbenchProviderAvailabilityContext(
  services: WorkbenchProviderAvailabilityContextServices
): WorkbenchProviderAvailabilityContext {
  return {
    aiProviderAvailable: services.aiService.getProviders().length > 0,
    remoteSyncProviderAvailable: services.remoteSyncService.getProviders().length > 0
  };
}

export function applyWorkbenchContextValues(
  contextKeyService: Pick<IContextKeyService, "setValue">,
  entries: readonly WorkbenchContextEntry[]
): void {
  for (const entry of entries) {
    contextKeyService.setValue(entry.key, entry.value);
  }
}

export function applyWorkbenchStateContext(
  services: WorkbenchStateContextServices,
  configuration: WorkbenchStateContextConfiguration,
  model: Pick<TextFileModel, "uri">,
  sideView: WorkbenchSideView | null,
  workspace: Pick<WorkspaceState, "files">
): void {
  applyWorkbenchContextValues(
    services.contextKeyService,
    createWorkbenchStateContextValues(
      configuration,
      model,
      sideView,
      workspace,
      createWorkbenchProviderAvailabilityContext(services)
    )
  );
}
