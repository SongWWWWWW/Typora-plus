import type {
  IAiService,
  IRemoteSyncService,
  RegisteredAiProvider,
  RegisteredRemoteSyncProvider
} from "@typora-plus/platform";

export type WorkbenchProviderMetadata = Pick<RegisteredAiProvider | RegisteredRemoteSyncProvider, "id" | "title">;

export interface WorkbenchProviderSelectionServices {
  readonly aiService: Pick<IAiService, "getProviders">;
  readonly remoteSyncService: Pick<IRemoteSyncService, "getProviders">;
}

export function selectWorkbenchDefaultAiProviderId(
  services: Pick<WorkbenchProviderSelectionServices, "aiService">
): string | undefined {
  return selectWorkbenchDefaultProviderId(services.aiService.getProviders());
}

export function selectWorkbenchDefaultRemoteSyncProviderId(
  services: Pick<WorkbenchProviderSelectionServices, "remoteSyncService">
): string | undefined {
  return selectWorkbenchDefaultProviderId(services.remoteSyncService.getProviders());
}

export function selectWorkbenchDefaultProviderId(
  providers: readonly WorkbenchProviderMetadata[]
): string | undefined {
  return [...providers]
    .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id))
    .at(0)?.id;
}
