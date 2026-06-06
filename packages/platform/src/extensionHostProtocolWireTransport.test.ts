import { Emitter, toDisposable, URI, type Event, type IDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { CommandMetadata } from "./commands";
import type { ExtensionCommandHandler, ExtensionContext, RegisteredExtension } from "./extensions";
import type { ExportProvider } from "./exports";
import {
  createExtensionHostApiResultMessage,
  extensionHostProtocolMessageTypes,
  serializeExtensionHostProtocolMessage,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import { ExtensionHostProtocolHost } from "./extensionHostProtocolHost";
import { ExtensionHostProtocolRuntime } from "./extensionHostProtocolRuntime";
import type { MarkdownRendererProvider, MarkdownRendererRuntimeMetadata } from "./markdownRenderers";
import {
  ExtensionHostProtocolWireTransport,
  type ExtensionHostProtocolWireChannel
} from "./extensionHostProtocolWireTransport";

describe("extension host protocol wire transport", () => {
  it("serializes outgoing protocol messages onto the raw channel", async () => {
    const channel = createMemoryWireChannel();
    const transport = new ExtensionHostProtocolWireTransport(channel, {
      label: " main "
    });

    await transport.send(createExtensionHostApiResultMessage(" request-1 ", " notes.remote ", {
      nested: ["A"]
    }));

    expect(channel.sent).toHaveLength(1);
    expect(JSON.parse(channel.sent[0] ?? "")).toEqual({
      type: extensionHostProtocolMessageTypes.apiResult,
      requestId: "request-1",
      extensionId: "notes.remote",
      value: {
        nested: ["A"]
      }
    });
    transport.dispose();
  });

  it("deserializes raw wire messages from the channel", async () => {
    const channel = createMemoryWireChannel();
    const transport = new ExtensionHostProtocolWireTransport(channel);
    const received: unknown[] = [];

    transport.onMessage((message) => {
      received.push(message);
    });
    channel.receive(JSON.stringify({
      type: extensionHostProtocolMessageTypes.apiResult,
      requestId: " request-1 ",
      extensionId: " notes.remote "
    }));

    await flushPromises();

    expect(received).toEqual([createExtensionHostApiResultMessage("request-1", "notes.remote")]);
    transport.dispose();
  });

  it("reports invalid inbound wire messages without firing transport messages", async () => {
    const channel = createMemoryWireChannel();
    const errors: string[] = [];
    const received: unknown[] = [];
    const transport = new ExtensionHostProtocolWireTransport(channel, {
      label: "main",
      onError: (error) => errors.push(error.message)
    });

    transport.onMessage((message) => {
      received.push(message);
    });
    channel.receive({ type: extensionHostProtocolMessageTypes.apiResult });
    channel.receive(JSON.stringify({ type: "bad" }));

    await flushPromises();

    expect(received).toEqual([]);
    expect(errors).toEqual([
      "Extension host protocol wire transport received non-string message: main",
      "Unknown extension host protocol message type: bad"
    ]);
    transport.dispose();
  });

  it("enforces optional wire message length limits on send and receive", async () => {
    const channel = createMemoryWireChannel();
    const errors: string[] = [];
    const transport = new ExtensionHostProtocolWireTransport(channel, {
      label: "limited",
      maxMessageLength: 10,
      onError: (error) => errors.push(error.message)
    });
    const message = createExtensionHostApiResultMessage("request-1", "notes.remote");

    await expect(transport.send(message)).rejects.toThrow("message exceeded max length");
    expect(channel.sent).toEqual([]);

    channel.receive(serializeExtensionHostProtocolMessage(message));
    await flushPromises();

    expect(errors).toEqual([
      expect.stringContaining("Extension host protocol wire transport message exceeded max length for limited:")
    ]);
    transport.dispose();
  });

  it("stops receiving and rejects sends after disposal", async () => {
    const channel = createMemoryWireChannel();
    const received: unknown[] = [];
    const transport = new ExtensionHostProtocolWireTransport(channel, {
      label: "main"
    });

    transport.onMessage((message) => {
      received.push(message);
    });
    transport.dispose();

    channel.receive(serializeExtensionHostProtocolMessage(
      createExtensionHostApiResultMessage("request-1", "notes.remote")
    ));
    await flushPromises();

    expect(received).toEqual([]);
    await expect(transport.send(createExtensionHostApiResultMessage("request-2", "notes.remote"))).rejects.toThrow(
      "Extension host protocol wire transport is disposed: main"
    );
  });

  it("connects protocol host and runtime through a string wire channel pair", async () => {
    const channels = createWireChannelPair();
    const mainTransport = new ExtensionHostProtocolWireTransport(channels.main, {
      label: "main"
    });
    const runtimeTransport = new ExtensionHostProtocolWireTransport(channels.extensionHost, {
      label: "extensionHost"
    });
    const main = createMainContext("notes.remote");
    const host = new ExtensionHostProtocolHost({
      id: "wire.host",
      canActivate: (extension) => extension.id === "notes.remote",
      createTransport: () => mainTransport
    });
    const runtime = new ExtensionHostProtocolRuntime(runtimeTransport, {
      activate(request) {
        request.context.commands.registerCommand("notes.remote.run", (value) => ({
          echoed: value
        }), {
          title: "Run Remote"
        });
        request.context.exports.registerProvider({
          format: "html",
          title: "HTML",
          exportDocument(input) {
            return {
              defaultFileName: `${input.name}.html`,
              format: "html",
              mimeType: "text/html",
              value: `<main>${input.value}</main>`
            };
          }
        });
      }
    });

    await host.activate({
      activationEvent: "onStartup",
      context: main.context,
      extension: main.context.extension
    });
    await flushPromises();

    expect(channels.main.sent.every((raw) => typeof raw === "string")).toBe(true);
    expect(channels.extensionHost.sent.every((raw) => typeof raw === "string")).toBe(true);
    expect(main.controls.commandRegistrations).toHaveLength(1);
    expect(main.controls.exportProviders).toHaveLength(1);

    await expect(main.controls.commandRegistrations[0]?.handler("alpha")).resolves.toEqual({
      echoed: "alpha"
    });
    await expect(main.controls.exportProviders[0]?.exportDocument({
      name: "A",
      uri: URI.file("C:/Notes/A.md"),
      value: "# A"
    })).resolves.toEqual({
      defaultFileName: "A.html",
      format: "html",
      mimeType: "text/html",
      value: "<main># A</main>"
    });

    host.dispose();
    runtime.dispose();
    mainTransport.dispose();
    runtimeTransport.dispose();
  });

  it("validates wire transport options", () => {
    const channel = createMemoryWireChannel();

    expect(() => new ExtensionHostProtocolWireTransport(channel, {
      label: " "
    })).toThrow("label must not be empty");
    expect(() => new ExtensionHostProtocolWireTransport(channel, {
      maxMessageLength: Number.NaN
    })).toThrow("max message length must be a non-negative finite number");
  });
});

interface MemoryWireChannel extends ExtensionHostProtocolWireChannel {
  readonly sent: string[];
  receive(raw: unknown): void;
}

interface WireChannelPair {
  readonly main: MemoryWireChannel;
  readonly extensionHost: MemoryWireChannel;
}

interface MainContextControls {
  readonly commandRegistrations: {
    readonly command: string;
    readonly handler: ExtensionCommandHandler;
    readonly metadata?: CommandMetadata;
  }[];
  readonly exportProviders: ExportProvider[];
  readonly markdownProviders: {
    readonly provider: MarkdownRendererProvider;
    readonly metadata?: MarkdownRendererRuntimeMetadata;
  }[];
}

function createMemoryWireChannel(sendRaw?: (raw: string) => void | Promise<void>): MemoryWireChannel {
  const emitter = new Emitter<unknown>();
  const sent: string[] = [];

  return {
    onMessage: emitter.event as Event<unknown>,
    sent,
    receive(raw) {
      emitter.fire(raw);
    },
    async send(raw) {
      sent.push(raw);
      await sendRaw?.(raw);
    }
  };
}

function createWireChannelPair(): WireChannelPair {
  let main: MemoryWireChannel;
  let extensionHost: MemoryWireChannel;

  main = createMemoryWireChannel((raw) => {
    extensionHost.receive(raw);
  });
  extensionHost = createMemoryWireChannel((raw) => {
    main.receive(raw);
  });

  return { main, extensionHost };
}

function createMainContext(extensionId: string): {
  readonly context: ExtensionContext;
  readonly controls: MainContextControls;
} {
  const controls: MainContextControls = {
    commandRegistrations: [],
    exportProviders: [],
    markdownProviders: []
  };
  const extension: RegisteredExtension = {
    activationEvents: ["onStartup"],
    activationState: "activating",
    id: extensionId
  };

  return {
    controls,
    context: {
      commands: {
        executeCommand: async <T = unknown>() => undefined as T,
        getCommands: () => controls.commandRegistrations.flatMap((registration) =>
          registration.metadata ? [registration.metadata] : []
        ),
        registerCommand(command, handler, metadata) {
          const registration = {
            command,
            handler,
            ...(metadata ? {
              metadata: {
                id: command,
                title: metadata.title ?? command,
                ...(metadata.category ? { category: metadata.category } : {})
              }
            } : {})
          };
          controls.commandRegistrations.push(registration);
          return removeFromArrayDisposable(controls.commandRegistrations, registration);
        }
      },
      contextKeys: {
        getValue: () => undefined,
        setValue: () => undefined
      },
      exports: {
        getProviders: () => controls.exportProviders,
        registerProvider(provider) {
          controls.exportProviders.push(provider);
          return removeFromArrayDisposable(controls.exportProviders, provider);
        }
      },
      extension,
      markdown: {
        getRenderers: () => [],
        registerRendererProvider(provider, metadata) {
          const registration = { provider, ...(metadata ? { metadata } : {}) };
          controls.markdownProviders.push(registration);
          return removeFromArrayDisposable(controls.markdownProviders, registration);
        }
      },
      subscriptions: {
        add(disposable) {
          return disposable;
        }
      }
    }
  };
}

function removeFromArrayDisposable<T>(array: T[], item: T): IDisposable {
  return toDisposable(() => {
    const index = array.indexOf(item);

    if (index !== -1) {
      array.splice(index, 1);
    }
  });
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}
