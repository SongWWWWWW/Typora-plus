import type { IDisposable } from "@typora-plus/base";
import type {
  IConfigurationService,
  IRemoteSyncService,
  RemoteSyncConfiguredProviderFactoryOptions
} from "@typora-plus/platform";
import { createConfiguredRemoteSyncProviders } from "@typora-plus/platform";
import { synchronizeWorkbenchConfiguredProviders } from "./workbenchConfiguredProviders";

export interface WorkbenchConfiguredRemoteSyncProviderServices {
  readonly configurationService: Pick<IConfigurationService, "getValue" | "onDidChangeConfiguration">;
  readonly remoteSyncService: Pick<IRemoteSyncService, "getProviders" | "registerProvider">;
}

export function synchronizeWorkbenchConfiguredRemoteSyncProviders(
  services: WorkbenchConfiguredRemoteSyncProviderServices,
  options: RemoteSyncConfiguredProviderFactoryOptions | undefined
): IDisposable {
  return synchronizeWorkbenchConfiguredProviders({
    configurationService: services.configurationService,
    providerRegistry: services.remoteSyncService
  }, {
    ...(options ? {
      createProviders: (configuration) => createConfiguredRemoteSyncProviders(configuration.remoteSync.providers, options)
    } : {}),
    getProviderId: (provider) => provider.id
  });
}
