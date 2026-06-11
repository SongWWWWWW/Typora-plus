import { Emitter, toDisposable, type Event, type IDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { ExtensionActivationRequest, ExtensionContext, RegisteredExtension } from "./extensions";
import {
  createExtensionHostActivationErrorMessage,
  createExtensionHostActivationResultMessage,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import { ExtensionHostProtocolHost } from "./extensionHostProtocolHost";
import type { ExtensionHostProtocolSessionRequestKind, ExtensionHostProtocolTransport } from "./extensionHostProtocolSession";

describe("extension host protocol host", () => {
  it("activates matching extensions through protocol sessions", async () => {
    const transports: MemoryTransport[] = [];
    const host = new ExtensionHostProtocolHost({
      id: " protocol.host ",
      canActivate: (extension) => extension.id.startsWith("remote."),
      createRequestId: createSequentialRequestId(),
      createTransport: () => {
        const transport = createMemoryTransport();
        transports.push(transport);
        return transport;
      }
    });
    const request = createActivationRequest("remote.notes", "onStartup");
    const activation = host.activate(request);

    await flushPromises();

    expect(host.id).toBe("protocol.host");
    expect(host.canActivate(request.extension)).toBe(true);
    expect(host.canActivate(createRegisteredExtension("local.notes"))).toBe(false);
    expect(transports).toHaveLength(1);
    expect(transports[0]?.sent).toEqual([{
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "activate-1",
      activationEvent: "onStartup",
      extension: {
        activationEvents: [],
        activationState: "activating",
        id: "remote.notes"
      }
    }]);

    transports[0]?.receive(createExtensionHostActivationResultMessage("activate-1", "remote.notes"));

    await expect(activation).resolves.toBeUndefined();
    expect(host.getSessions()).toEqual([{ extensionId: "remote.notes" }]);
  });

  it("rejects non-matching extensions without creating transports", async () => {
    const transports: MemoryTransport[] = [];
    const host = new ExtensionHostProtocolHost({
      id: "protocol.host",
      canActivate: (extension) => extension.id.startsWith("remote."),
      createTransport: () => {
        const transport = createMemoryTransport();
        transports.push(transport);
        return transport;
      }
    });

    await expect(host.activate(createActivationRequest("local.notes", "onStartup"))).rejects.toThrow(
      "cannot activate extension"
    );
    expect(transports).toHaveLength(0);
  });

  it("reuses one session per extension", async () => {
    const transports: MemoryTransport[] = [];
    const host = new ExtensionHostProtocolHost({
      id: "protocol.host",
      canActivate: () => true,
      createRequestId: createSequentialRequestId(),
      createTransport: () => {
        const transport = createMemoryTransport();
        transports.push(transport);
        return transport;
      }
    });
    const firstRequest = createActivationRequest("remote.notes", "onStartup");
    const firstActivation = host.activate(firstRequest);

    await flushPromises();
    transports[0]?.receive(createExtensionHostActivationResultMessage("activate-1", "remote.notes"));
    await firstActivation;

    const secondRequest = createActivationRequest("remote.notes", "onCommand:notes.open");
    const secondActivation = host.activate(secondRequest);

    await flushPromises();

    expect(transports).toHaveLength(1);
    expect(transports[0]?.sent[1]).toEqual({
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "activate-2",
      activationEvent: "onCommand:notes.open",
      extension: {
        activationEvents: [],
        activationState: "activating",
        id: "remote.notes"
      }
    });

    transports[0]?.receive(createExtensionHostActivationResultMessage("activate-2", "remote.notes"));

    await secondActivation;
    expect(host.getSessions()).toEqual([{ extensionId: "remote.notes" }]);
  });

  it("cleans sessions when activation fails", async () => {
    const transports: MemoryTransport[] = [];
    const host = new ExtensionHostProtocolHost({
      id: "protocol.host",
      canActivate: () => true,
      createRequestId: createSequentialRequestId(),
      createTransport: () => {
        const transport = createMemoryTransport();
        transports.push(transport);
        return transport;
      }
    });
    const activation = host.activate(createActivationRequest("remote.notes", "onStartup"));

    await flushPromises();
    expect(host.getSessions()).toEqual([{ extensionId: "remote.notes" }]);

    transports[0]?.receive(createExtensionHostActivationErrorMessage("activate-1", "remote.notes", new Error("failed")));

    await expect(activation).rejects.toThrow("failed");
    expect(host.getSessions()).toEqual([]);
  });

  it("cleans sessions through extension subscriptions and host disposal", async () => {
    const transports: MemoryTransport[] = [];
    const firstContext = createExtensionContext(createRegisteredExtension("remote.one"));
    const secondContext = createExtensionContext(createRegisteredExtension("remote.two"));
    const host = new ExtensionHostProtocolHost({
      id: "protocol.host",
      canActivate: () => true,
      createRequestId: createSequentialRequestId(),
      createTransport: () => {
        const transport = createMemoryTransport();
        transports.push(transport);
        return transport;
      }
    });
    const firstActivation = host.activate({
      activationEvent: "onStartup",
      context: firstContext,
      extension: firstContext.extension
    });
    const secondActivation = host.activate({
      activationEvent: "onStartup",
      context: secondContext,
      extension: secondContext.extension
    });

    await flushPromises();
    transports[0]?.receive(createExtensionHostActivationResultMessage("activate-1", "remote.one"));
    transports[1]?.receive(createExtensionHostActivationResultMessage("activate-2", "remote.two"));
    await firstActivation;
    await secondActivation;

    expect(host.getSessions()).toEqual([
      { extensionId: "remote.one" },
      { extensionId: "remote.two" }
    ]);

    firstContext.disposeSubscriptions();

    expect(host.getSessions()).toEqual([{ extensionId: "remote.two" }]);

    host.dispose();

    expect(host.getSessions()).toEqual([]);
  });

  it("validates required host options", () => {
    expect(() => new ExtensionHostProtocolHost({
      id: " ",
      canActivate: () => true,
      createTransport: createMemoryTransport
    })).toThrow("must not be empty");
    expect(() => new ExtensionHostProtocolHost({
      id: "protocol.host",
      canActivate: undefined as unknown as () => boolean,
      createTransport: createMemoryTransport
    })).toThrow("must provide canActivate");
    expect(() => new ExtensionHostProtocolHost({
      id: "protocol.host",
      canActivate: () => true,
      createTransport: undefined as unknown as () => ExtensionHostProtocolTransport
    })).toThrow("must provide createTransport");
  });
});

interface MemoryTransport extends ExtensionHostProtocolTransport {
  readonly sent: ExtensionHostProtocolMessage[];
  receive(message: unknown): void;
}

interface TestExtensionContext extends ExtensionContext {
  disposeSubscriptions(): void;
}

function createMemoryTransport(): MemoryTransport {
  const emitter = new Emitter<unknown>();
  const sent: ExtensionHostProtocolMessage[] = [];

  return {
    onMessage: emitter.event as Event<unknown>,
    sent,
    receive(message) {
      emitter.fire(message);
    },
    send(message) {
      sent.push(readExtensionHostProtocolMessage(message));
    }
  };
}

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

function createExtensionContext(extension: RegisteredExtension): TestExtensionContext {
  const disposables: IDisposable[] = [];
  const context = {
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
    disposeSubscriptions() {
      for (const disposable of [...disposables]) {
        disposable.dispose();
      }
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
      add<T extends IDisposable>(disposable: T): T {
        disposables.push(disposable);
        return disposable;
      }
    }
  };

  return context;
}

function createSequentialRequestId(): (kind: ExtensionHostProtocolSessionRequestKind) => string {
  let count = 0;
  return (kind) => `${kind}-${++count}`;
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
