import { describe, expect, it } from "vitest";
import type {
  ExtensionActivationRequest,
  ExtensionContext,
  MarkdownRendererProvider,
  RegisteredExtension
} from "@typora-plus/platform";
import { defaultConfiguration } from "@typora-plus/platform";
import { toDisposable, type IDisposable } from "@typora-plus/base";
import {
  workbenchMermaidRendererId
} from "./mermaidMarkdownRenderer";
import {
  workbenchStatusRendererId
} from "./statusMarkdownRenderer";
import { createWorkbenchExtensionActivationHandler } from "./workbenchExtensionActivation";
import { defaultWorkbenchExtensionManifest } from "./workbenchContributions";

describe("Workbench extension activation", () => {
  it("registers the built-in Mermaid provider on renderer activation", async () => {
    const subscriptions: IDisposable[] = [];
    let providerId: string | undefined;
    const handler = createWorkbenchExtensionActivationHandler();

    await handler({
      activationEvent: `onMarkdownRenderer:${workbenchMermaidRendererId}`,
      context: createActivationContext({
        addSubscription(disposable) {
          subscriptions.push(disposable);
        },
        registerRendererProvider(provider) {
          providerId = provider.id;
          return toDisposable(() => undefined);
        }
      }),
      extension: createRegisteredExtension(defaultWorkbenchExtensionManifest.id)
    });

    expect(providerId).toBe(workbenchMermaidRendererId);
    expect(subscriptions).toHaveLength(1);
  });

  it("registers the built-in Status provider on renderer activation", async () => {
    const subscriptions: IDisposable[] = [];
    let provider: MarkdownRendererProvider | undefined;
    const handler = createWorkbenchExtensionActivationHandler({
      getConfiguration: () => ({
        ...defaultConfiguration,
        markdown: {
          statusBadges: [
            {
              key: "shipped",
              label: "Shipped",
              tone: "success",
              aliases: ["released"]
            }
          ]
        }
      })
    });

    await handler({
      activationEvent: `onMarkdownRenderer:${workbenchStatusRendererId}`,
      context: createActivationContext({
        addSubscription(disposable) {
          subscriptions.push(disposable);
        },
        registerRendererProvider(registeredProvider) {
          provider = registeredProvider;
          return toDisposable(() => undefined);
        }
      }),
      extension: createRegisteredExtension(defaultWorkbenchExtensionManifest.id)
    });

    expect(provider?.id).toBe(workbenchStatusRendererId);
    await expect(Promise.resolve(provider?.render({
      language: "status",
      value: "released"
    }))).resolves.toEqual({
      html: [
        `<span class="tp-renderer-status tp-renderer-status-success" title="released">`,
        `Shipped`,
        `</span>`
      ].join("")
    });
    expect(subscriptions).toHaveLength(1);
  });

  it("rejects unknown extension activation through the Workbench runtime", async () => {
    const handler = createWorkbenchExtensionActivationHandler();

    await expect(handler({
      activationEvent: `onMarkdownRenderer:${workbenchMermaidRendererId}`,
      context: createActivationContext({}),
      extension: createRegisteredExtension("notes.external")
    })).rejects.toThrow("No Workbench activation runtime registered");
  });
});

function createRegisteredExtension(id: string): RegisteredExtension {
  return {
    activationEvents: [],
    activationState: "activating",
    id
  };
}

function createActivationContext(options: {
  readonly addSubscription?: (disposable: IDisposable) => void;
  readonly registerRendererProvider?: (provider: MarkdownRendererProvider) => IDisposable;
}): ExtensionContext {
  const extension = createRegisteredExtension(defaultWorkbenchExtensionManifest.id);

  return {
    commands: {
      executeCommand: async <T = unknown>() => undefined as T,
      getCommands: () => [],
      registerCommand: () => toDisposable(() => undefined)
    },
    contextKeys: {
      getValue: () => undefined,
      setValue: () => undefined
    },
    exports: {
      getProviders: () => [],
      registerProvider: () => toDisposable(() => undefined)
    },
    extension,
    markdown: {
      getRenderers: () => [],
      registerRendererProvider(provider) {
        return options.registerRendererProvider?.(provider) ?? toDisposable(() => undefined);
      }
    },
    subscriptions: {
      add(disposable) {
        options.addSubscription?.(disposable);
        return disposable;
      }
    }
  };
}
