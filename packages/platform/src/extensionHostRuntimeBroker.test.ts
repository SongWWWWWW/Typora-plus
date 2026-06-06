import { toDisposable, URI, type IDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type {
  CommandMetadata,
  ExtensionCommandHandler,
  ExtensionContext,
  ExportProvider,
  MarkdownRendererProvider,
  MarkdownRendererRuntimeMetadata
} from "./index";
import {
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostCommandListRequestMessage,
  createExtensionHostCommandRegisterRequestMessage,
  createExtensionHostContextKeyGetRequestMessage,
  createExtensionHostContextKeySetRequestMessage,
  createExtensionHostExportDocumentResultMessage,
  createExtensionHostExportProviderRegisterRequestMessage,
  createExtensionHostMarkdownRendererRegisterRequestMessage,
  createExtensionHostMarkdownRendererRenderResultMessage,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import { ExtensionHostRuntimeBroker, type ExtensionHostRuntimeBrokerRequestKind } from "./extensionHostRuntimeBroker";

describe("extension host runtime broker", () => {
  it("handles command and context-key runtime API messages", async () => {
    const { context, controls } = createBrokerTestContext();
    const requests: ExtensionHostProtocolMessage[] = [];
    const broker = new ExtensionHostRuntimeBroker(context, {
      createRequestId: createSequentialRequestId(),
      request: (message) => {
        const request = readExtensionHostProtocolMessage(message);
        requests.push(request);
        return createExtensionHostApiResultMessage(request.requestId, "notes.remote", {
          handled: true
        });
      }
    });

    expect(await broker.handleMessage(createExtensionHostCommandRegisterRequestMessage("request-1", "notes.remote", {
      id: "notes.remote.run",
      title: "Run Remote Command",
      category: "Remote"
    }))).toEqual(createExtensionHostApiResultMessage("request-1", "notes.remote"));

    expect(controls.commandRegistrations).toHaveLength(1);
    expect(controls.commandRegistrations[0]).toMatchObject({
      command: "notes.remote.run",
      metadata: {
        title: "Run Remote Command",
        category: "Remote"
      }
    });

    await expect(controls.commandRegistrations[0]?.handler("alpha", 2)).resolves.toEqual({
      handled: true
    });
    expect(requests[0]).toEqual(createExtensionHostCommandExecuteRequestMessage(
      "commandExecute-1",
      "notes.remote",
      "notes.remote.run",
      ["alpha", 2]
    ));

    controls.executeCommand = async (command, args) => ({
      args,
      command
    });
    await expect(broker.handleMessage(createExtensionHostCommandExecuteRequestMessage(
      "request-2",
      "notes.remote",
      "workbench.open",
      ["file://notes/a.md"]
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-2", "notes.remote", {
      args: ["file://notes/a.md"],
      command: "workbench.open"
    }));

    controls.commandMetadata = [{
      id: "workbench.open",
      title: "Open"
    }];
    await expect(broker.handleMessage(createExtensionHostCommandListRequestMessage(
      "request-3",
      "notes.remote"
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-3", "notes.remote", [{
      id: "workbench.open",
      title: "Open"
    }]));

    await expect(broker.handleMessage(createExtensionHostContextKeySetRequestMessage(
      "request-4",
      "notes.remote",
      "notes.remote.ready",
      true
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-4", "notes.remote"));
    expect(controls.contextValues.get("notes.remote.ready")).toBe(true);

    await expect(broker.handleMessage(createExtensionHostContextKeyGetRequestMessage(
      "request-5",
      "notes.remote",
      "notes.remote.ready"
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-5", "notes.remote", true));

    await broker.handleMessage(createExtensionHostContextKeySetRequestMessage(
      "request-6",
      "notes.remote",
      "notes.remote.ready",
      undefined
    ));
    expect(controls.contextValues.has("notes.remote.ready")).toBe(false);
  });

  it("registers export and Markdown renderer proxies that call the remote host", async () => {
    const { context, controls } = createBrokerTestContext();
    const requests: ExtensionHostProtocolMessage[] = [];
    const broker = new ExtensionHostRuntimeBroker(context, {
      createRequestId: createSequentialRequestId(),
      request: (message) => {
        const request = readExtensionHostProtocolMessage(message);
        requests.push(request);

        if (request.type === extensionHostProtocolMessageTypes.exportDocument) {
          expect("resolveImageSource" in request.input).toBe(false);
          return createExtensionHostExportDocumentResultMessage(request.requestId, request.extensionId, {
            defaultFileName: "A.html",
            format: request.format,
            mimeType: "text/html",
            value: "<main>A</main>"
          });
        }

        if (request.type === extensionHostProtocolMessageTypes.markdownRendererRender) {
          return createExtensionHostMarkdownRendererRenderResultMessage(
            request.requestId,
            request.extensionId,
            request.rendererId,
            { html: "<span>Rendered</span>" }
          );
        }

        throw new Error(`Unexpected request: ${request.type}`);
      }
    });

    await expect(broker.handleMessage(createExtensionHostExportProviderRegisterRequestMessage(
      "request-7",
      "notes.remote",
      {
        format: "html",
        title: "HTML"
      }
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-7", "notes.remote"));
    expect(controls.exportProviders).toHaveLength(1);

    await expect(controls.exportProviders[0]?.exportDocument({
      assetMode: "file",
      name: "A.md",
      resolveImageSource: async () => "data:image/png;base64,aGVsbG8=",
      uri: URI.file("C:/Notes/A.md"),
      value: "# A"
    })).resolves.toEqual({
      defaultFileName: "A.html",
      format: "html",
      mimeType: "text/html",
      value: "<main>A</main>"
    });
    expect(requests[0]).toEqual({
      type: extensionHostProtocolMessageTypes.exportDocument,
      requestId: "exportDocument-1",
      extensionId: "notes.remote",
      format: "html",
      input: {
        assetMode: "file",
        name: "A.md",
        uri: "file://C:/Notes/A.md",
        value: "# A"
      }
    });

    await expect(broker.handleMessage(createExtensionHostMarkdownRendererRegisterRequestMessage(
      "request-8",
      "notes.remote",
      {
        id: "notes.remote.diagram",
        metadata: {
          kind: "block",
          label: "Diagram",
          language: "Mermaid",
          priority: 20
        }
      }
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-8", "notes.remote"));
    expect(controls.markdownProviders).toHaveLength(1);
    expect(controls.markdownProviders[0]?.metadata).toEqual({
      kind: "block",
      label: "Diagram",
      language: "mermaid",
      priority: 20
    });

    await expect(controls.markdownProviders[0]?.provider.render({
      language: "Mermaid",
      uri: URI.file("C:/Notes/A.md"),
      value: "graph TD\nA-->B"
    })).resolves.toEqual({
      html: "<span>Rendered</span>"
    });
    expect(requests[1]).toEqual({
      type: extensionHostProtocolMessageTypes.markdownRendererRender,
      requestId: "markdownRendererRender-2",
      extensionId: "notes.remote",
      rendererId: "notes.remote.diagram",
      input: {
        language: "mermaid",
        uri: "file://C:/Notes/A.md",
        value: "graph TD\nA-->B"
      }
    });
  });

  it("returns API errors for invalid broker requests and propagates remote API errors", async () => {
    const { context, controls } = createBrokerTestContext();
    const broker = new ExtensionHostRuntimeBroker(context, {
      createRequestId: createSequentialRequestId(),
      request: (message) => {
        const request = readExtensionHostProtocolMessage(message);
        return createExtensionHostApiErrorMessage(request.requestId, "notes.remote", new Error("remote failed"));
      }
    });

    await expect(broker.handleMessage(createExtensionHostContextKeySetRequestMessage(
      "request-9",
      "other.remote",
      "other.remote.ready",
      true
    ))).resolves.toMatchObject({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "request-9",
      extensionId: "notes.remote",
      error: {
        message: expect.stringContaining("extension id mismatch")
      }
    });

    await broker.handleMessage(createExtensionHostCommandRegisterRequestMessage("request-10", "notes.remote", {
      id: "notes.remote.fail",
      title: "Fail"
    }));

    await expect(controls.commandRegistrations[0]?.handler()).rejects.toThrow("remote failed");
  });

  it("disposes registered runtime proxies", async () => {
    const { context, controls } = createBrokerTestContext();
    const broker = new ExtensionHostRuntimeBroker(context, {
      request: () => createExtensionHostApiResultMessage("unused", "notes.remote")
    });

    await broker.handleMessage(createExtensionHostCommandRegisterRequestMessage("request-11", "notes.remote", {
      id: "notes.remote.run",
      title: "Run"
    }));
    await broker.handleMessage(createExtensionHostExportProviderRegisterRequestMessage("request-12", "notes.remote", {
      format: "html",
      title: "HTML"
    }));
    await broker.handleMessage(createExtensionHostMarkdownRendererRegisterRequestMessage("request-13", "notes.remote", {
      id: "notes.remote.diagram",
      metadata: {
        kind: "block",
        label: "Diagram"
      }
    }));

    expect(controls.commandRegistrations).toHaveLength(1);
    expect(controls.exportProviders).toHaveLength(1);
    expect(controls.markdownProviders).toHaveLength(1);

    broker.dispose();

    expect(controls.commandRegistrations).toHaveLength(0);
    expect(controls.exportProviders).toHaveLength(0);
    expect(controls.markdownProviders).toHaveLength(0);
  });
});

interface BrokerTestControls {
  readonly commandRegistrations: {
    readonly command: string;
    readonly handler: ExtensionCommandHandler;
    readonly metadata?: {
      readonly title?: string;
      readonly category?: string;
    };
  }[];
  commandMetadata: CommandMetadata[];
  executeCommand(command: string, args: readonly unknown[]): Promise<unknown>;
  readonly contextValues: Map<string, boolean | number | string | null>;
  readonly exportProviders: ExportProvider[];
  readonly markdownProviders: {
    readonly provider: MarkdownRendererProvider;
    readonly metadata?: MarkdownRendererRuntimeMetadata;
  }[];
}

function createBrokerTestContext(): { readonly context: ExtensionContext; readonly controls: BrokerTestControls } {
  const controls: BrokerTestControls = {
    commandRegistrations: [],
    commandMetadata: [],
    executeCommand: async (command, args) => ({ args, command }),
    contextValues: new Map(),
    exportProviders: [],
    markdownProviders: []
  };
  const context: ExtensionContext = {
    commands: {
      executeCommand: async <T = unknown>(command: string, ...args: unknown[]) =>
        await controls.executeCommand(command, args) as T,
      getCommands: () => controls.commandMetadata,
      registerCommand(command, handler, metadata) {
        const registration = { command, handler, ...(metadata ? { metadata } : {}) };
        controls.commandRegistrations.push(registration);
        return removeFromArrayDisposable(controls.commandRegistrations, registration);
      }
    },
    contextKeys: {
      getValue: (key) => controls.contextValues.get(key),
      setValue(key, value) {
        if (value === undefined) {
          controls.contextValues.delete(key);
          return;
        }

        controls.contextValues.set(key, value);
      }
    },
    exports: {
      getProviders: () => controls.exportProviders,
      registerProvider(provider) {
        controls.exportProviders.push(provider);
        return removeFromArrayDisposable(controls.exportProviders, provider);
      }
    },
    extension: {
      activationEvents: ["onStartup"],
      activationState: "activated",
      displayName: "Remote Notes",
      id: "notes.remote"
    },
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
  };

  return { context, controls };
}

function createSequentialRequestId(): (kind: ExtensionHostRuntimeBrokerRequestKind) => string {
  let count = 0;
  return (kind) => `${kind}-${++count}`;
}

function removeFromArrayDisposable<T>(array: T[], item: T): IDisposable {
  return toDisposable(() => {
    const index = array.indexOf(item);

    if (index !== -1) {
      array.splice(index, 1);
    }
  });
}
