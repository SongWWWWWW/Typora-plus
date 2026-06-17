import { Emitter, toDisposable, type IDisposable } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import { synchronizeWorkbenchConfiguredProviders } from "./workbenchConfiguredProviders";

interface TestConfiguration {
  readonly providerIds: readonly string[];
}

interface TestProvider {
  readonly id: string;
}

describe("workbench configured providers", () => {
  it("registers created providers, refreshes them on configuration changes, and disposes registrations", () => {
    const harness = createHarness({ providerIds: ["configured.one"] });

    const disposable = synchronizeWorkbenchConfiguredProviders(harness.services, {
      createProviders: (configuration) => configuration.providerIds.map((id) => ({ id })),
      getProviderId: (provider) => provider.id
    });

    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual(["configured.one"]);

    harness.emitConfiguration({ providerIds: ["configured.two", "configured.three"] });

    expect(harness.disposedProviderIds).toEqual(["configured.one"]);
    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual([
      "configured.two",
      "configured.three"
    ]);

    disposable.dispose();

    expect(harness.disposedProviderIds).toEqual([
      "configured.one",
      "configured.two",
      "configured.three"
    ]);
  });

  it("skips providers that collide with provider ids already visible in the registry", () => {
    const harness = createHarness(
      { providerIds: ["external.provider", "configured.provider"] },
      [{ id: "external.provider" }]
    );

    synchronizeWorkbenchConfiguredProviders(harness.services, {
      createProviders: (configuration) => configuration.providerIds.map((id) => ({ id })),
      getProviderId: (provider) => provider.id
    });

    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual(["configured.provider"]);
  });

  it("clears synchronized providers without new registrations when provider creation is disabled", () => {
    const harness = createHarness({ providerIds: ["configured.one"] });
    const disposable = synchronizeWorkbenchConfiguredProviders(harness.services, {
      createProviders: (configuration) => configuration.providerIds.map((id) => ({ id })),
      getProviderId: (provider) => provider.id
    });

    harness.emitConfiguration({ providerIds: ["configured.two"] });
    disposable.dispose();
    expect(harness.disposedProviderIds).toEqual(["configured.one", "configured.two"]);

    const disabledHarness = createHarness({ providerIds: ["disabled.provider"] });
    const disabledDisposable = synchronizeWorkbenchConfiguredProviders(disabledHarness.services, {
      getProviderId: (provider) => provider.id
    });

    expect(disabledHarness.registeredProviders).toEqual([]);
    disabledHarness.emitConfiguration({ providerIds: ["still.disabled"] });
    expect(disabledHarness.registeredProviders).toEqual([]);
    disabledDisposable.dispose();
  });
});

function createHarness(
  initialConfiguration: TestConfiguration,
  externalProviders: readonly { readonly id: string }[] = []
) {
  let configuration = initialConfiguration;
  const configurationEmitter = new Emitter<TestConfiguration>();
  const registeredProviders: TestProvider[] = [];
  const disposedProviderIds: string[] = [];
  const services = {
    configurationService: {
      getValue: vi.fn(() => configuration),
      onDidChangeConfiguration: configurationEmitter.event
    },
    providerRegistry: {
      getProviders: vi.fn(() => [
        ...externalProviders,
        ...registeredProviders.map((provider) => ({ id: provider.id }))
      ]),
      registerProvider: vi.fn((provider: TestProvider): IDisposable => {
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
    emitConfiguration(nextConfiguration: TestConfiguration) {
      configuration = nextConfiguration;
      configurationEmitter.fire(nextConfiguration);
    }
  };
}
