import { DisposableStore, type IDisposable } from "@typora-plus/base";
import type {
  IConfigurationService,
  IRemoteSyncService,
  RemoteSyncConfiguredProviderFactoryOptions,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import { createConfiguredRemoteSyncProviders } from "@typora-plus/platform";

export interface WorkbenchConfiguredRemoteSyncProviderServices {
  readonly configurationService: Pick<IConfigurationService, "getValue" | "onDidChangeConfiguration">;
  readonly remoteSyncService: Pick<IRemoteSyncService, "getProviders" | "registerProvider">;
}

export function synchronizeWorkbenchConfiguredRemoteSyncProviders(
  services: WorkbenchConfiguredRemoteSyncProviderServices,
  options: RemoteSyncConfiguredProviderFactoryOptions | undefined
): IDisposable {
  const store = new DisposableStore();
  const providerStore = new DisposableStore();
  const applyConfiguration = (configuration: TyporaPlusConfiguration) => {
    providerStore.clear();

    if (!options) {
      return;
    }

    const existingProviderIds = new Set(services.remoteSyncService.getProviders().map((provider) => provider.id));

    for (const provider of createConfiguredRemoteSyncProviders(configuration.remoteSync.providers, options)) {
      if (existingProviderIds.has(provider.id)) {
        continue;
      }

      existingProviderIds.add(provider.id);
      providerStore.add(services.remoteSyncService.registerProvider(provider));
    }
  };

  applyConfiguration(services.configurationService.getValue());
  store.add(services.configurationService.onDidChangeConfiguration(applyConfiguration));
  store.add(providerStore);

  return store;
}
