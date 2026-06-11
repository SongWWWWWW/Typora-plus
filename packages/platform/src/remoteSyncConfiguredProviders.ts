import type { RemoteSyncProviderConfiguration } from "./configuration";
import { normalizeRemoteSyncProviderConfiguration } from "./configuration";
import type { RemoteSyncProvider } from "./remoteSync";
import {
  createNativeRemoteSyncRequestTransport,
  type RemoteSyncNativeRequestTransport
} from "./remoteSyncNativeRequest";
import {
  createRemoteSyncProfileRequestTransport,
  type RemoteSyncProfileRequestTransport
} from "./remoteSyncProfileRequest";

export interface RemoteSyncConfiguredProviderFactoryContext {
  readonly profile: RemoteSyncProviderConfiguration;
  readonly request: RemoteSyncProfileRequestTransport;
}

export type RemoteSyncConfiguredProviderFactory =
  (context: RemoteSyncConfiguredProviderFactoryContext) => RemoteSyncProvider | undefined;

export interface RemoteSyncConfiguredProviderFactoryOptions {
  readonly transport: RemoteSyncNativeRequestTransport;
  readonly createProvider: RemoteSyncConfiguredProviderFactory;
}

export function createConfiguredRemoteSyncProviders(
  configurations: readonly RemoteSyncProviderConfiguration[],
  options: RemoteSyncConfiguredProviderFactoryOptions
): readonly RemoteSyncProvider[] {
  const providers: RemoteSyncProvider[] = [];

  for (const configuration of configurations) {
    const profile = normalizeRemoteSyncProviderConfiguration(configuration);

    if (!profile) {
      throw new Error("Remote sync provider profile is invalid");
    }

    const request = createRemoteSyncProfileRequestTransport(profile, options.transport);

    if (!request) {
      continue;
    }

    const provider = options.createProvider({
      profile,
      request
    });

    if (provider) {
      providers.push(provider);
    }
  }

  return providers;
}

export function createNativeRemoteSyncConfiguredProviderFactoryOptions(
  createProvider: RemoteSyncConfiguredProviderFactory,
  transport: RemoteSyncNativeRequestTransport | undefined = createNativeRemoteSyncRequestTransport()
): RemoteSyncConfiguredProviderFactoryOptions | undefined {
  if (!transport) {
    return undefined;
  }

  return {
    transport,
    createProvider
  };
}
