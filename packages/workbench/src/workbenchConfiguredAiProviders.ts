import { DisposableStore, type IDisposable } from "@typora-plus/base";
import type {
  IAiService,
  IConfigurationService,
  ResponsesAiProviderFactoryOptions,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import { createConfiguredAiProviders } from "@typora-plus/platform";

export interface WorkbenchConfiguredAiProviderServices {
  readonly aiService: Pick<IAiService, "getProviders" | "registerProvider">;
  readonly configurationService: Pick<IConfigurationService, "getValue" | "onDidChangeConfiguration">;
}

export function synchronizeWorkbenchConfiguredAiProviders(
  services: WorkbenchConfiguredAiProviderServices,
  options: ResponsesAiProviderFactoryOptions | undefined
): IDisposable {
  const store = new DisposableStore();
  const providerStore = new DisposableStore();
  const applyConfiguration = (configuration: TyporaPlusConfiguration) => {
    providerStore.clear();

    if (!options) {
      return;
    }

    const existingProviderIds = new Set(services.aiService.getProviders().map((provider) => provider.id));

    for (const provider of createConfiguredAiProviders(configuration.ai.providers, options)) {
      if (existingProviderIds.has(provider.id)) {
        continue;
      }

      existingProviderIds.add(provider.id);
      providerStore.add(services.aiService.registerProvider(provider));
    }
  };

  applyConfiguration(services.configurationService.getValue());
  store.add(services.configurationService.onDidChangeConfiguration(applyConfiguration));
  store.add(providerStore);

  return store;
}
