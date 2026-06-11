import { Emitter, toDisposable, type IDisposable } from "@typora-plus/base";
import {
  defaultConfiguration,
  type AiProvider,
  type RegisteredAiProvider,
  type TyporaPlusConfiguration
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import { synchronizeWorkbenchConfiguredAiProviders } from "./workbenchConfiguredAiProviders";

describe("workbench configured AI providers", () => {
  it("registers configured providers and refreshes them when configuration changes", async () => {
    const harness = createHarness(configuration([
      providerConfiguration("notes.primary", "Primary")
    ]));
    const nativeRequests: unknown[] = [];

    const disposable = synchronizeWorkbenchConfiguredAiProviders(harness.services, {
      request: async (request) => {
        nativeRequests.push(request);
        return { output_text: "ok" };
      }
    });

    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual(["notes.primary"]);

    await expect(harness.registeredProviders[0]?.requestText({
      instruction: "Summarize.",
      input: "# Note"
    })).resolves.toEqual({
      value: "ok",
      model: "notes-model"
    });
    expect(nativeRequests).toEqual([
      {
        endpointUrl: "https://api.example.test/v1/responses",
        secretRef: "typora-plus.ai.notes.primary",
        body: JSON.stringify({
          model: "notes-model",
          instructions: "Summarize.",
          input: "# Note"
        })
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

  it("does not register configured providers when no native request options exist", () => {
    const harness = createHarness(configuration([
      providerConfiguration("notes.primary", "Primary")
    ]));

    const disposable = synchronizeWorkbenchConfiguredAiProviders(harness.services, undefined);

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

    synchronizeWorkbenchConfiguredAiProviders(harness.services, {
      request: async () => ({ output_text: "ok" })
    });

    expect(harness.registeredProviders.map((provider) => provider.id)).toEqual(["notes.primary"]);
  });
});

function createHarness(
  initialConfiguration: TyporaPlusConfiguration,
  initialProviders: readonly RegisteredAiProvider[] = []
) {
  let configuration = initialConfiguration;
  const configurationEmitter = new Emitter<TyporaPlusConfiguration>();
  const registeredProviders: AiProvider[] = [];
  const disposedProviderIds: string[] = [];
  const services = {
    aiService: {
      getProviders: vi.fn(() => [
        ...initialProviders,
        ...registeredProviders.map((provider) => ({
          id: provider.id,
          title: provider.title
        }))
      ]),
      registerProvider: vi.fn((provider: AiProvider): IDisposable => {
        registeredProviders.push(provider);

        return toDisposable(() => {
          disposedProviderIds.push(provider.id);
          const index = registeredProviders.indexOf(provider);

          if (index >= 0) {
            registeredProviders.splice(index, 1);
          }
        });
      })
    },
    configurationService: {
      getValue: vi.fn(() => configuration),
      onDidChangeConfiguration: configurationEmitter.event
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
  providers: TyporaPlusConfiguration["ai"]["providers"]
): TyporaPlusConfiguration {
  return {
    ...defaultConfiguration,
    ai: {
      ...defaultConfiguration.ai,
      providers
    }
  };
}

function providerConfiguration(
  id: string,
  title: string
): TyporaPlusConfiguration["ai"]["providers"][number] {
  return {
    id,
    title,
    kind: "responses",
    endpointUrl: "https://api.example.test/v1/responses",
    model: "notes-model",
    secretRef: `typora-plus.ai.${id}`
  };
}
