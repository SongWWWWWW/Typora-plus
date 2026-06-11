import { Emitter, toDisposable, URI, type IDisposable } from "@typora-plus/base";
import {
  defaultConfiguration,
  type RegisteredRemoteSyncProvider,
  type RemoteSyncNativeRequestInput,
  type RemoteSyncProvider,
  type TyporaPlusConfiguration
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import { synchronizeWorkbenchConfiguredRemoteSyncProviders } from "./workbenchConfiguredRemoteSyncProviders";

describe("workbench configured remote sync providers", () => {
  it("registers configured providers and refreshes them when configuration changes", async () => {
    const harness = createHarness(configuration([
      providerConfiguration("notes.primary", "Primary")
    ]));
    const nativeRequests: RemoteSyncNativeRequestInput[] = [];

    const disposable = synchronizeWorkbenchConfiguredRemoteSyncProviders(harness.services, {
      transport: async (request) => {
        nativeRequests.push(request);
        return {
          status: 200,
          statusText: "OK",
          headers: {},
          body: { ok: true }
        };
      },
      createProvider: ({ profile, request }) => ({
        id: profile.id,
        title: profile.title,
        async createPlan(planRequest) {
          await request({
            path: "snapshot",
            method: "GET",
            secretHeaders: [
              {
                name: "Authorization",
                secretName: "session"
              }
            ],
            ...(planRequest.signal !== undefined ? { signal: planRequest.signal } : {})
          });

          return emptyPlan();
        },
        async executePlan(plan) {
          return {
            operations: plan.operations,
            summary: plan.summary
          };
        }
      })
    });

    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual(["notes.primary"]);

    const signal = new AbortController().signal;
    await expect(harness.registeredProviders[0]?.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "push",
      signal
    })).resolves.toEqual(emptyPlan());
    expect(nativeRequests).toEqual([
      {
        url: "https://sync.example.test/api/snapshot",
        method: "GET",
        secretHeaders: [
          {
            name: "Authorization",
            secretRef: "typora-plus.remote-sync.notes.primary"
          }
        ],
        signal
      }
    ]);

    harness.emitConfiguration(configuration([
      providerConfiguration("notes.secondary", "Secondary")
    ]));

    expect(harness.disposedProviderIds).toEqual(["notes.primary"]);
    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual(["notes.secondary"]);

    disposable.dispose();

    expect(harness.disposedProviderIds).toEqual(["notes.primary", "notes.secondary"]);
  });

  it("does not register configured providers when no provider factory options exist", () => {
    const harness = createHarness(configuration([
      providerConfiguration("notes.primary", "Primary")
    ]));

    const disposable = synchronizeWorkbenchConfiguredRemoteSyncProviders(harness.services, undefined);

    expect(harness.registeredProviders).toEqual([]);

    harness.emitConfiguration(configuration([
      providerConfiguration("notes.secondary", "Secondary")
    ]));

    expect(harness.registeredProviders).toEqual([]);
    disposable.dispose();
  });

  it("skips configured providers that collide with existing provider ids", () => {
    const harness = createHarness(configuration([
      providerConfiguration("extension.provider", "Configured Collision"),
      providerConfiguration("notes.primary", "Primary")
    ]), [
      { id: "extension.provider", title: "Extension Provider" }
    ]);

    synchronizeWorkbenchConfiguredRemoteSyncProviders(harness.services, {
      transport: async () => ({
        status: 200,
        statusText: "OK",
        headers: {},
        body: { ok: true }
      }),
      createProvider: ({ profile }) => ({
        id: profile.id,
        title: profile.title,
        createPlan: () => emptyPlan(),
        executePlan: (plan) => ({
          operations: plan.operations,
          summary: plan.summary
        })
      })
    });

    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual(["notes.primary"]);
  });
});

function createHarness(
  initialConfiguration: TyporaPlusConfiguration,
  initialProviders: readonly RegisteredRemoteSyncProvider[] = []
) {
  let configuration = initialConfiguration;
  const configurationEmitter = new Emitter<TyporaPlusConfiguration>();
  const registeredProviders: RemoteSyncProvider[] = [];
  const disposedProviderIds: string[] = [];
  const services = {
    configurationService: {
      getValue: vi.fn(() => configuration),
      onDidChangeConfiguration: configurationEmitter.event
    },
    remoteSyncService: {
      getProviders: vi.fn(() => [
        ...initialProviders,
        ...registeredProviders.map((provider) => ({
          id: provider.id,
          title: provider.title
        }))
      ]),
      registerProvider: vi.fn((provider: RemoteSyncProvider): IDisposable => {
        registeredProviders.push(provider);

        return toDisposable(() => {
          disposedProviderIds.push(provider.id);
          const index = registeredProviders.indexOf(provider);

          if (index >= 0) {
            registeredProviders.splice(index, 1);
          }
        });
      })
    }
  };

  return {
    disposedProviderIds,
    registeredProviders,
    services,
    emitConfiguration(nextConfiguration: TyporaPlusConfiguration) {
      configuration = nextConfiguration;
      configurationEmitter.fire(nextConfiguration);
    }
  };
}

function configuration(
  providers: TyporaPlusConfiguration["remoteSync"]["providers"]
): TyporaPlusConfiguration {
  return {
    ...defaultConfiguration,
    remoteSync: {
      ...defaultConfiguration.remoteSync,
      providers
    }
  };
}

function providerConfiguration(
  id: string,
  title: string
): TyporaPlusConfiguration["remoteSync"]["providers"][number] {
  return {
    id,
    title,
    kind: "native-request",
    baseUrl: "https://sync.example.test/api/",
    remoteScopeId: "workspace-root",
    secrets: [
      {
        name: "session",
        secretRef: `typora-plus.remote-sync.${id}`
      }
    ]
  };
}

function emptyPlan() {
  return {
    operations: [],
    summary: {
      creates: 0,
      updates: 0,
      deletes: 0,
      skips: 0,
      conflicts: 0
    }
  } as const;
}
