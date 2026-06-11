import { toDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { ExtensionActivationRequest, ExtensionContext, RegisteredExtension } from "./extensions";
import { ExtensionHostService } from "./extensionHosts";

describe("extension hosts", () => {
  it("dispatches activation requests to the matching host", async () => {
    const service = new ExtensionHostService();
    const handledEvents: string[] = [];

    service.registerHost({
      id: "host.main",
      canActivate: (extension) => extension.id === "notes.main",
      activate(request) {
        handledEvents.push(request.activationEvent);
      }
    });

    await service.activate(createActivationRequest("notes.main", "onCommand:notes.open"));

    expect(handledEvents).toEqual(["onCommand:notes.open"]);
    expect(service.getHosts()).toEqual([{ id: "host.main" }]);
  });

  it("removes hosts through registration disposables", async () => {
    const service = new ExtensionHostService();
    const disposable = service.registerHost({
      id: "host.main",
      canActivate: (extension) => extension.id === "notes.main",
      activate() {
        return undefined;
      }
    });

    disposable.dispose();

    expect(service.getHosts()).toEqual([]);
    await expect(service.activate(createActivationRequest("notes.main", "onStartup"))).rejects.toThrow(
      "No extension host registered"
    );
  });

  it("rejects duplicate host ids", () => {
    const service = new ExtensionHostService();
    const host = {
      id: "host.main",
      canActivate: () => true,
      activate() {
        return undefined;
      }
    };

    service.registerHost(host);

    expect(() => service.registerHost(host)).toThrow("Extension host already registered");
  });

  it("rejects missing and ambiguous extension hosts", async () => {
    const service = new ExtensionHostService();

    await expect(service.activate(createActivationRequest("notes.main", "onStartup"))).rejects.toThrow(
      "No extension host registered"
    );

    service.registerHost({
      id: "host.one",
      canActivate: (extension) => extension.id === "notes.main",
      activate() {
        return undefined;
      }
    });
    service.registerHost({
      id: "host.two",
      canActivate: (extension) => extension.id === "notes.main",
      activate() {
        return undefined;
      }
    });

    await expect(service.activate(createActivationRequest("notes.main", "onStartup"))).rejects.toThrow(
      "Multiple extension hosts"
    );
  });
});

function createActivationRequest(extensionId: string, activationEvent: string): ExtensionActivationRequest {
  const extension = createRegisteredExtension(extensionId);

  return {
    activationEvent,
    context: createExtensionContext(extension),
    extension
  };
}

function createRegisteredExtension(id: string): RegisteredExtension {
  return {
    activationEvents: [],
    activationState: "activating",
    id
  };
}

function createExtensionContext(extension: RegisteredExtension): ExtensionContext {
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
    ai: {
      getProviders: () => [],
      registerProvider: () => toDisposable(() => undefined)
    },
    exports: {
      getProviders: () => [],
      registerProvider: () => toDisposable(() => undefined)
    },
    extension,
    markdown: {
      getRenderers: () => [],
      registerRendererProvider: () => toDisposable(() => undefined)
    },
    subscriptions: {
      add(disposable) {
        return disposable;
      }
    }
  };
}
