import type { RemoteSyncProviderConfiguration } from "./configuration";
import { normalizeRemoteSyncProviderConfiguration } from "./configuration";
import type { RemoteSyncProvider } from "./remoteSync";
import type { IRemoteSyncWorkspaceResourceService } from "./remoteSyncWorkspaceResources";
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
  readonly workspaceResources?: Pick<
    IRemoteSyncWorkspaceResourceService,
    "deleteResource" | "readResource" | "writeResource"
  >;
}

export type RemoteSyncConfiguredProviderFactory =
  (context: RemoteSyncConfiguredProviderFactoryContext) => RemoteSyncProvider | undefined;

export interface RemoteSyncConfiguredProviderFactoryOptions {
  readonly transport: RemoteSyncNativeRequestTransport;
  readonly createProvider: RemoteSyncConfiguredProviderFactory;
  readonly workspaceResources?: Pick<
    IRemoteSyncWorkspaceResourceService,
    "deleteResource" | "readResource" | "writeResource"
  >;
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
      request,
      ...(options.workspaceResources !== undefined ? { workspaceResources: options.workspaceResources } : {})
    });

    if (provider) {
      providers.push(provider);
    }
  }

  return providers;
}

export function createNativeRemoteSyncConfiguredProviderFactoryOptions(
  createProvider: RemoteSyncConfiguredProviderFactory,
  transport: RemoteSyncNativeRequestTransport | undefined = createNativeRemoteSyncRequestTransport(),
  workspaceResources?: Pick<IRemoteSyncWorkspaceResourceService, "deleteResource" | "readResource" | "writeResource">
): RemoteSyncConfiguredProviderFactoryOptions | undefined {
  if (!transport) {
    return undefined;
  }

  return {
    transport,
    createProvider,
    ...(workspaceResources !== undefined ? { workspaceResources } : {})
  };
}
