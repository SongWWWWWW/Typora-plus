import type { IDisposable } from "@typora-plus/base";
import type {
  IAiService,
  IConfigurationService,
  ResponsesAiProviderFactoryOptions,
} from "@typora-plus/platform";
import { createConfiguredAiProviders } from "@typora-plus/platform";
import { synchronizeWorkbenchConfiguredProviders } from "./workbenchConfiguredProviders";

export interface WorkbenchConfiguredAiProviderServices {
  readonly aiService: Pick<IAiService, "getProviders" | "registerProvider">;
  readonly configurationService: Pick<IConfigurationService, "getValue" | "onDidChangeConfiguration">;
}

export function synchronizeWorkbenchConfiguredAiProviders(
  services: WorkbenchConfiguredAiProviderServices,
  options: ResponsesAiProviderFactoryOptions | undefined
): IDisposable {
  return synchronizeWorkbenchConfiguredProviders({
    configurationService: services.configurationService,
    providerRegistry: services.aiService
  }, {
    ...(options ? {
      createProviders: (configuration) => createConfiguredAiProviders(configuration.ai.providers, options)
    } : {}),
    getProviderId: (provider) => provider.id
  });
}
