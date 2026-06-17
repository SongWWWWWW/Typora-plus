import { DisposableStore, type Event, type IDisposable } from "@typora-plus/base";

export interface WorkbenchConfiguredProviderMetadata {
  readonly id: string;
}

export interface WorkbenchConfiguredProviderRegistry<TProvider> {
  getProviders(): readonly WorkbenchConfiguredProviderMetadata[];
  registerProvider(provider: TProvider): IDisposable;
}

export interface WorkbenchConfiguredProviderConfigurationService<TConfiguration> {
  readonly onDidChangeConfiguration: Event<TConfiguration>;
  getValue(): TConfiguration;
}

export interface WorkbenchConfiguredProviderSynchronizationServices<TConfiguration, TProvider> {
  readonly configurationService: WorkbenchConfiguredProviderConfigurationService<TConfiguration>;
  readonly providerRegistry: WorkbenchConfiguredProviderRegistry<TProvider>;
}

export interface WorkbenchConfiguredProviderSynchronizationOptions<TConfiguration, TProvider> {
  readonly createProviders?: (configuration: TConfiguration) => readonly TProvider[];
  readonly getProviderId: (provider: TProvider) => string;
}

export function synchronizeWorkbenchConfiguredProviders<TConfiguration, TProvider>(
  services: WorkbenchConfiguredProviderSynchronizationServices<TConfiguration, TProvider>,
  options: WorkbenchConfiguredProviderSynchronizationOptions<TConfiguration, TProvider>
): IDisposable {
  const store = new DisposableStore();
  const providerStore = new DisposableStore();
  const applyConfiguration = (configuration: TConfiguration) => {
    providerStore.clear();

    if (!options.createProviders) {
      return;
    }

    const existingProviderIds = new Set(services.providerRegistry.getProviders().map((provider) => provider.id));

    for (const provider of options.createProviders(configuration)) {
      const id = options.getProviderId(provider);

      if (existingProviderIds.has(id)) {
        continue;
      }

      existingProviderIds.add(id);
      providerStore.add(services.providerRegistry.registerProvider(provider));
    }
  };

  applyConfiguration(services.configurationService.getValue());
  store.add(services.configurationService.onDidChangeConfiguration(applyConfiguration));
  store.add(providerStore);

  return store;
}
