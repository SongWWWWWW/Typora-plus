import { toDisposable, URI, type IDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { CommandMetadata } from "./commands";
import type { ExtensionCommandHandler, ExtensionContext, RegisteredExtension } from "./extensions";
import type { ExportProvider } from "./exports";
import { ExtensionHostProtocolHost } from "./extensionHostProtocolHost";
import { ExtensionHostProtocolRuntime } from "./extensionHostProtocolRuntime";
import {
  createLinkedExtensionHostProtocolTransports,
  type LinkedExtensionHostProtocolTransport
} from "./extensionHostProtocolTransport";
import type { MarkdownRendererProvider, MarkdownRendererRuntimeMetadata } from "./markdownRenderers";

describe("extension host protocol linked transport", () => {
  it("connects protocol host and runtime through a wire-safe transport pair", async () => {
    const pair = createLinkedExtensionHostProtocolTransports();
    const remoteDisposables: IDisposable[] = [];
    const main = createMainContext("notes.remote");
    const host = new ExtensionHostProtocolHost({
      id: "protocol.host",
      canActivate: (extension) => extension.id === "notes.remote",
      createTransport: () => pair.main
    });
    const runtime = new ExtensionHostProtocolRuntime(pair.extensionHost, {
      activate(request) {
        remoteDisposables.push(request.context.commands.registerCommand("notes.remote.run", (value) => ({
          echoed: value
        }), {
          title: "Run Remote"
        }));
        remoteDisposables.push(request.context.exports.registerProvider({
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
        }));
        remoteDisposables.push(request.context.markdown.registerRendererProvider({
          id: "notes.remote.diagram",
          render(input) {
            return {
              html: `<span>${input.value}</span>`
            };
          }
        }, {
          kind: "block",
          label: "Diagram"
        }));
      }
    });

    await host.activate({
      activationEvent: "onStartup",
      context: main.context,
      extension: main.context.extension
    });

    expect(main.controls.commandRegistrations).toHaveLength(1);
    expect(main.controls.exportProviders).toHaveLength(1);
    expect(main.controls.markdownProviders).toHaveLength(1);

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
    await expect(main.controls.markdownProviders[0]?.provider.render({
      value: "graph TD"
    })).resolves.toEqual({
      html: "<span>graph TD</span>"
    });

    remoteDisposables[0]?.dispose();
    remoteDisposables[1]?.dispose();
    remoteDisposables[2]?.dispose();
    await flushPromises();

    expect(main.controls.commandRegistrations).toHaveLength(0);
    expect(main.controls.exportProviders).toHaveLength(0);
    expect(main.controls.markdownProviders).toHaveLength(0);

    host.dispose();
    runtime.dispose();
    pair.dispose();
  });

  it("round-trips messages as JSON instead of object references", async () => {
    const pair = createLinkedExtensionHostProtocolTransports();
    const received: unknown[] = [];

    pair.extensionHost.onMessage((message) => {
      received.push(message);
    });
    pair.main.send({
      type: "extensionHost/api/result",
      requestId: " request-1 ",
      extensionId: " notes.remote ",
      value: {
        nested: ["A"]
      }
    });

    await flushPromises();

    const sent: {
      readonly type: "extensionHost/api/result";
      readonly requestId: string;
      readonly extensionId: string;
      readonly value: {
        readonly nested: string[];
      };
    } = {
      type: "extensionHost/api/result",
      requestId: " request-2 ",
      extensionId: " notes.remote ",
      value: {
        nested: ["B"]
      }
    };
    pair.main.send(sent);
    sent.value.nested.push("mutated");

    await flushPromises();

    expect(received).toEqual([
      {
        type: "extensionHost/api/result",
        requestId: "request-1",
        extensionId: "notes.remote",
        value: {
          nested: ["A"]
        }
      },
      {
        type: "extensionHost/api/result",
        requestId: "request-2",
        extensionId: "notes.remote",
        value: {
          nested: ["B"]
        }
      }
    ]);

    pair.dispose();
  });

  it("rejects sends after either linked endpoint is disposed", () => {
    const pair = createLinkedExtensionHostProtocolTransports();

    pair.extensionHost.dispose();

    expect(() => sendEmptyResult(pair.main)).toThrow("peer is disposed");

    pair.main.dispose();

    expect(() => sendEmptyResult(pair.main)).toThrow("is disposed");
  });
});

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

function sendEmptyResult(transport: LinkedExtensionHostProtocolTransport): void {
  transport.send({
    type: "extensionHost/api/result",
    requestId: "request",
    extensionId: "notes.remote"
  });
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
