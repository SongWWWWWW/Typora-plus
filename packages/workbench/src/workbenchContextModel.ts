import type {
  ContextKeyValue,
  IAttachmentService,
  IContextKeyService,
  IFileService,
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
  workspaceOpen: "workspace.open"
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
  readonly contextKeyService: Pick<IContextKeyService, "setValue">;
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
  workspace: Pick<WorkspaceState, "files">
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
    }
  ];
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
    createWorkbenchStateContextValues(configuration, model, sideView, workspace)
  );
}
