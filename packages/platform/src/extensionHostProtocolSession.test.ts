import { Emitter, toDisposable, URI, type Event, type IDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { AiProvider } from "./ai";
import type { CommandMetadata } from "./commands";
import type { ExtensionCommandHandler, ExtensionContext } from "./extensions";
import type { ExportProvider } from "./exports";
import type { MarkdownRendererProvider, MarkdownRendererRuntimeMetadata } from "./markdownRenderers";
import type { RemoteSyncProvider } from "./remoteSync";
import {
  createExtensionHostActivationErrorMessage,
  createExtensionHostActivationResultMessage,
  createExtensionHostAiProviderRegisterRequestMessage,
  createExtensionHostAiTextCancelMessage,
  createExtensionHostAiTextRequestMessage,
  createExtensionHostAiTextResultMessage,
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostCommandRegisterRequestMessage,
  createExtensionHostHandshakeResultMessage,
  createExtensionHostRemoteSyncCreatePlanRequestMessage,
  createExtensionHostRemoteSyncCreatePlanResultMessage,
  createExtensionHostRemoteSyncProviderRegisterRequestMessage,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import {
  ExtensionHostProtocolSession,
  type ExtensionHostProtocolSessionRequestKind,
  type ExtensionHostProtocolTransport
} from "./extensionHostProtocolSession";
import type { ExtensionHostProtocolRequestTimer } from "./extensionHostProtocolRequestTimer";

describe("extension host protocol session", () => {
  it("sends activation requests and resolves activation responses", async () => {
    const transport = createMemoryTransport();
    const { context } = createSessionTestContext();
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId()
    });

    const activation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });

    expect(transport.sent).toEqual([{
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "activate-1",
      activationEvent: "onStartup",
      extension: {
        activationEvents: ["onStartup"],
        activationState: "activated",
        displayName: "Remote Notes",
        id: "notes.remote"
      }
    }]);

    transport.receive(createExtensionHostActivationResultMessage("activate-1", "notes.remote"));

    await expect(activation).resolves.toBeUndefined();
  });

  it("rejects activation errors and response identity mismatches", async () => {
    const transport = createMemoryTransport();
    const { context } = createSessionTestContext();
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId()
    });
    const failedActivation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });

    transport.receive(createExtensionHostActivationErrorMessage("activate-1", "notes.remote", new Error("failed")));

    await expect(failedActivation).rejects.toThrow("failed");

    const mismatchedActivation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });

    transport.receive(createExtensionHostActivationResultMessage("activate-2", "other.remote"));

    await expect(mismatchedActivation).rejects.toThrow("extension id mismatch");
  });

  it("performs protocol handshakes and reuses successful results", async () => {
    const transport = createMemoryTransport();
    const { context } = createSessionTestContext();
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId()
    });
    const handshake = session.handshake();

    expect(transport.sent).toEqual([{
      type: extensionHostProtocolMessageTypes.handshakeRequest,
      requestId: "handshake-1",
      extensionId: "notes.remote",
      protocolVersion: 1,
      capabilities: [
        "activation",
        "aiProviders",
        "commands",
        "contextKeys",
        "exports",
        "markdownRenderers",
        "remoteSyncProviders",
        "remoteCallbacks",
        "unregister"
      ]
    }]);

    transport.receive(createExtensionHostHandshakeResultMessage("handshake-1", "notes.remote"));

    await expect(handshake).resolves.toMatchObject({
      type: extensionHostProtocolMessageTypes.handshakeResult,
      requestId: "handshake-1",
      extensionId: "notes.remote"
    });
    await expect(session.handshake()).resolves.toMatchObject({
      requestId: "handshake-1"
    });
    expect(transport.sent).toHaveLength(1);
  });

  it("requires handshake before activation when configured", async () => {
    const transport = createMemoryTransport();
    const { context } = createSessionTestContext();
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId(),
      requireHandshake: true
    });
    const activation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });

    expect(transport.sent[0]).toMatchObject({
      type: extensionHostProtocolMessageTypes.handshakeRequest,
      requestId: "handshake-1"
    });
    transport.receive(createExtensionHostHandshakeResultMessage("handshake-1", "notes.remote"));
    await flushPromises();
    await flushPromises();

    expect(transport.sent[1]).toMatchObject({
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "activate-2"
    });
    transport.receive(createExtensionHostActivationResultMessage("activate-2", "notes.remote"));

    await expect(activation).resolves.toBeUndefined();
  });

  it("rejects incompatible handshake responses and can retry after failure", async () => {
    const transport = createMemoryTransport();
    const { context } = createSessionTestContext();
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId()
    });
    const firstHandshake = session.handshake();

    transport.receive(createExtensionHostHandshakeResultMessage("handshake-1", "notes.remote", 2));

    await expect(firstHandshake).rejects.toThrow("protocol version mismatch");

    const missingCapabilityHandshake = session.handshake();
    transport.receive(createExtensionHostHandshakeResultMessage("handshake-2", "notes.remote", 1, ["commands"]));

    await expect(missingCapabilityHandshake).rejects.toThrow("missing required capability");

    const secondHandshake = session.handshake();
    transport.receive(createExtensionHostHandshakeResultMessage("handshake-3", "notes.remote"));

    await expect(secondHandshake).resolves.toMatchObject({
      requestId: "handshake-3"
    });
  });

  it("rejects activation requests that miss the configured timeout", async () => {
    const transport = createMemoryTransport();
    const timer = createManualRequestTimer();
    const { context } = createSessionTestContext();
    const errors: string[] = [];
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId(),
      onError: (error) => errors.push(error.message),
      requestTimer: timer,
      requestTimeoutMs: 50
    });

    const activation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });

    expect(timer.scheduled).toHaveLength(1);
    expect(timer.scheduled[0]?.delayMs).toBe(50);

    timer.scheduled[0]?.fire();

    await expect(activation).rejects.toThrow(
      "Extension host protocol session request timed out after 50ms: activate-1 (notes.remote)"
    );
    expect(timer.scheduled[0]?.disposed).toBe(true);

    transport.receive(createExtensionHostActivationResultMessage("activate-1", "notes.remote"));
    await flushPromises();

    expect(errors).toEqual([
      "Extension host protocol session received unhandled message: extensionHost/activationResult"
    ]);
    session.dispose();
  });

  it("cleans timed out activation requests so request ids can be reused", async () => {
    const transport = createMemoryTransport();
    const timer = createManualRequestTimer();
    const { context } = createSessionTestContext();
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: () => "activate-fixed",
      requestTimer: timer,
      requestTimeoutMs: 25
    });

    const firstActivation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });
    timer.scheduled[0]?.fire();

    await expect(firstActivation).rejects.toThrow("activate-fixed");

    const secondActivation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });

    expect(transport.sent).toHaveLength(2);
    transport.receive(createExtensionHostActivationResultMessage("activate-fixed", "notes.remote"));

    await expect(secondActivation).resolves.toBeUndefined();
    expect(timer.scheduled[1]?.disposed).toBe(true);
    session.dispose();
  });

  it("dispatches inbound runtime API messages through the broker", async () => {
    const transport = createMemoryTransport();
    const { context, controls } = createSessionTestContext();
    new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId()
    });

    transport.receive(createExtensionHostCommandRegisterRequestMessage("remote-1", "notes.remote", {
      id: "notes.remote.run",
      title: "Run Remote"
    }));
    await flushPromises();

    expect(controls.commandRegistrations).toHaveLength(1);
    expect(transport.sent[0]).toEqual(createExtensionHostApiResultMessage("remote-1", "notes.remote"));

    const commandExecution = controls.commandRegistrations[0]?.handler("alpha");
    await flushPromises();

    expect(transport.sent[1]).toEqual(createExtensionHostCommandExecuteRequestMessage(
      "commandExecute-1",
      "notes.remote",
      "notes.remote.run",
      ["alpha"]
    ));

    transport.receive(createExtensionHostApiResultMessage("commandExecute-1", "notes.remote", {
      ok: true
    }));

    await expect(commandExecution).resolves.toEqual({ ok: true });

    transport.receive(createExtensionHostAiProviderRegisterRequestMessage("remote-ai-1", "notes.remote", {
      id: "notes.remote.ai",
      title: "Remote AI"
    }));
    await flushPromises();

    expect(controls.aiProviders).toHaveLength(1);
    expect(transport.sent[2]).toEqual(createExtensionHostApiResultMessage("remote-ai-1", "notes.remote"));

    const aiExecution = controls.aiProviders[0]?.requestText({
      instruction: "Summarize",
      input: "# A"
    });
    await flushPromises();

    expect(transport.sent[3]).toEqual(createExtensionHostAiTextRequestMessage(
      "aiTextRequest-2",
      "notes.remote",
      "notes.remote.ai",
      {
        instruction: "Summarize",
        input: "# A"
      }
    ));

    transport.receive(createExtensionHostAiTextResultMessage("aiTextRequest-2", "notes.remote", "notes.remote.ai", {
      value: "Summary"
    }));

    await expect(aiExecution).resolves.toEqual({ value: "Summary" });

    transport.receive(createExtensionHostRemoteSyncProviderRegisterRequestMessage("remote-sync-1", "notes.remote", {
      id: "notes.remote.sync",
      title: "Remote Sync"
    }));
    await flushPromises();

    expect(controls.remoteSyncProviders).toHaveLength(1);
    expect(transport.sent[4]).toEqual(createExtensionHostApiResultMessage("remote-sync-1", "notes.remote"));

    const syncPlan = controls.remoteSyncProviders[0]!.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file"
      }],
      direction: "push"
    });
    await flushPromises();

    expect(transport.sent[5]).toEqual(createExtensionHostRemoteSyncCreatePlanRequestMessage(
      "remoteSyncCreatePlan-3",
      "notes.remote",
      "notes.remote.sync",
      {
        workspaceUri: "file://C:/Notes",
        resources: [{
          uri: "file://C:/Notes/A.md",
          relativePath: "A.md",
          kind: "file"
        }],
        direction: "push"
      }
    ));

    transport.receive(createExtensionHostRemoteSyncCreatePlanResultMessage(
      "remoteSyncCreatePlan-3",
      "notes.remote",
      "notes.remote.sync",
      {
        operations: [{
          kind: "create",
          target: "remote",
          relativePath: "A.md",
          localUri: "file://C:/Notes/A.md"
        }],
        summary: {
          creates: 1,
          updates: 0,
          deletes: 0,
          skips: 0,
          conflicts: 0
        }
      }
    ));

    await expect(syncPlan).resolves.toEqual({
      operations: [{
        kind: "create",
        target: "remote",
        relativePath: "A.md",
        localUri: URI.file("C:/Notes/A.md")
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });
  });

  it("sends AI text cancellation notifications through the session transport", async () => {
    const transport = createMemoryTransport();
    const { context, controls } = createSessionTestContext();
    new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId()
    });

    transport.receive(createExtensionHostAiProviderRegisterRequestMessage("remote-ai-1", "notes.remote", {
      id: "notes.remote.ai",
      title: "Remote AI"
    }));
    await flushPromises();

    const controller = new AbortController();
    const aiExecution = controls.aiProviders[0]!.requestText({
      instruction: "Summarize",
      input: "# A",
      signal: controller.signal
    });
    await flushPromises();

    expect(transport.sent[1]).toEqual(createExtensionHostAiTextRequestMessage(
      "aiTextRequest-1",
      "notes.remote",
      "notes.remote.ai",
      {
        instruction: "Summarize",
        input: "# A"
      }
    ));

    controller.abort();
    await flushPromises();

    expect(transport.sent[2]).toEqual(createExtensionHostAiTextCancelMessage(
      "aiTextRequest-1",
      "notes.remote",
      "notes.remote.ai"
    ));

    transport.receive(createExtensionHostApiErrorMessage(
      "aiTextRequest-1",
      "notes.remote",
      new Error("Extension host AI text request cancelled")
    ));

    await expect(aiExecution).rejects.toThrow("Extension host AI text request cancelled");
  });

  it("rejects proxy callback requests that miss the configured timeout", async () => {
    const transport = createMemoryTransport();
    const timer = createManualRequestTimer();
    const { context, controls } = createSessionTestContext();
    const errors: string[] = [];
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId(),
      onError: (error) => errors.push(error.message),
      requestTimer: timer,
      requestTimeoutMs: 40
    });

    transport.receive(createExtensionHostCommandRegisterRequestMessage("remote-1", "notes.remote", {
      id: "notes.remote.run",
      title: "Run Remote"
    }));
    await flushPromises();

    const commandExecution = controls.commandRegistrations[0]?.handler("alpha");
    await flushPromises();

    expect(transport.sent[1]).toEqual(createExtensionHostCommandExecuteRequestMessage(
      "commandExecute-1",
      "notes.remote",
      "notes.remote.run",
      ["alpha"]
    ));
    expect(timer.scheduled[0]?.delayMs).toBe(40);

    timer.scheduled[0]?.fire();

    await expect(commandExecution).rejects.toThrow(
      "Extension host protocol session request timed out after 40ms: commandExecute-1 (notes.remote)"
    );

    transport.receive(createExtensionHostApiResultMessage("commandExecute-1", "notes.remote", {
      ok: true
    }));
    await flushPromises();

    expect(errors).toEqual([
      "Extension host protocol session received unhandled message: extensionHost/api/result"
    ]);
    session.dispose();
  });

  it("executes inbound main-thread command requests and returns API results", async () => {
    const transport = createMemoryTransport();
    const { context, controls } = createSessionTestContext();
    new ExtensionHostProtocolSession(transport, context);

    controls.executeCommand = async (command, args) => ({ command, args });
    transport.receive(createExtensionHostCommandExecuteRequestMessage(
      "remote-2",
      "notes.remote",
      "workbench.open",
      ["file://notes/a.md"]
    ));
    await flushPromises();

    expect(transport.sent).toEqual([
      createExtensionHostApiResultMessage("remote-2", "notes.remote", {
        args: ["file://notes/a.md"],
        command: "workbench.open"
      })
    ]);
  });

  it("correlates proxy export and renderer provider callbacks through transport responses", async () => {
    const transport = createMemoryTransport();
    const { context, controls } = createSessionTestContext();
    new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId()
    });

    transport.receive({
      type: extensionHostProtocolMessageTypes.exportProviderRegister,
      requestId: "remote-3",
      extensionId: "notes.remote",
      provider: {
        format: "html",
        title: "HTML"
      }
    });
    transport.receive({
      type: extensionHostProtocolMessageTypes.markdownRendererRegister,
      requestId: "remote-4",
      extensionId: "notes.remote",
      renderer: {
        id: "notes.remote.diagram",
        metadata: {
          kind: "block",
          label: "Diagram"
        }
      }
    });
    await flushPromises();

    const exportDocument = controls.exportProviders[0]?.exportDocument({
      assetMode: "file",
      name: "A.md",
      uri: URI.file("C:/Notes/A.md"),
      value: "# A"
    });
    const render = controls.markdownProviders[0]?.provider.render({
      value: "graph TD\nA-->B"
    });
    await flushPromises();

    expect(transport.sent[2]).toMatchObject({
      type: extensionHostProtocolMessageTypes.exportDocument,
      requestId: "exportDocument-1"
    });
    expect(transport.sent[3]).toMatchObject({
      type: extensionHostProtocolMessageTypes.markdownRendererRender,
      requestId: "markdownRendererRender-2"
    });

    transport.receive({
      type: extensionHostProtocolMessageTypes.exportDocumentResult,
      requestId: "exportDocument-1",
      extensionId: "notes.remote",
      document: {
        defaultFileName: "A.html",
        format: "html",
        mimeType: "text/html",
        value: "<main>A</main>"
      }
    });
    transport.receive({
      type: extensionHostProtocolMessageTypes.markdownRendererRenderResult,
      requestId: "markdownRendererRender-2",
      extensionId: "notes.remote",
      rendererId: "notes.remote.diagram",
      output: {
        html: "<span>Rendered</span>"
      }
    });

    await expect(exportDocument).resolves.toEqual({
      defaultFileName: "A.html",
      format: "html",
      mimeType: "text/html",
      value: "<main>A</main>"
    });
    await expect(render).resolves.toEqual({
      html: "<span>Rendered</span>"
    });
  });

  it("reports unhandled inbound messages and rejects pending requests on dispose", async () => {
    const transport = createMemoryTransport();
    const timer = createManualRequestTimer();
    const { context } = createSessionTestContext();
    const errors: string[] = [];
    const session = new ExtensionHostProtocolSession(transport, context, {
      createRequestId: createSequentialRequestId(),
      onError: (error) => errors.push(error.message),
      requestTimer: timer,
      requestTimeoutMs: 100
    });

    transport.receive(createExtensionHostApiResultMessage("missing", "notes.remote"));
    transport.receive({ type: "bad" });
    await flushPromises();

    expect(errors).toEqual([
      "Extension host protocol session received unhandled message: extensionHost/api/result",
      "Unknown extension host protocol message type: bad"
    ]);

    const activation = session.activate({
      activationEvent: "onStartup",
      context,
      extension: context.extension
    });

    session.dispose();

    await expect(activation).rejects.toThrow("session disposed");
    expect(timer.scheduled[0]?.disposed).toBe(true);
  });
});

interface MemoryTransport extends ExtensionHostProtocolTransport {
  readonly sent: ExtensionHostProtocolMessage[];
  receive(message: unknown): void;
}

interface SessionTestControls {
  readonly aiProviders: AiProvider[];
  readonly commandRegistrations: {
    readonly command: string;
    readonly handler: ExtensionCommandHandler;
  }[];
  commandMetadata: CommandMetadata[];
  executeCommand(command: string, args: readonly unknown[]): Promise<unknown>;
  readonly exportProviders: ExportProvider[];
  readonly markdownProviders: {
    readonly provider: MarkdownRendererProvider;
    readonly metadata?: MarkdownRendererRuntimeMetadata;
  }[];
  readonly remoteSyncProviders: RemoteSyncProvider[];
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

function createSessionTestContext(): { readonly context: ExtensionContext; readonly controls: SessionTestControls } {
  const controls: SessionTestControls = {
    aiProviders: [],
    commandRegistrations: [],
    commandMetadata: [],
    executeCommand: async (command, args) => ({ args, command }),
    exportProviders: [],
    markdownProviders: [],
    remoteSyncProviders: []
  };
  const context: ExtensionContext = {
    commands: {
      executeCommand: async <T = unknown>(command: string, ...args: unknown[]) =>
        await controls.executeCommand(command, args) as T,
      getCommands: () => controls.commandMetadata,
      registerCommand(command, handler) {
        const registration = { command, handler };
        controls.commandRegistrations.push(registration);
        return removeFromArrayDisposable(controls.commandRegistrations, registration);
      }
    },
    contextKeys: {
      getValue: () => undefined,
      setValue: () => undefined
    },
    ai: {
      getProviders: () => controls.aiProviders.map((provider) => ({ id: provider.id, title: provider.title })),
      registerProvider(provider) {
        controls.aiProviders.push(provider);
        return removeFromArrayDisposable(controls.aiProviders, provider);
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
    remoteSync: {
      getProviders: () => controls.remoteSyncProviders.map((provider) => ({ id: provider.id, title: provider.title })),
      registerProvider(provider) {
        controls.remoteSyncProviders.push(provider);
        return removeFromArrayDisposable(controls.remoteSyncProviders, provider);
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

function createSequentialRequestId(): (kind: ExtensionHostProtocolSessionRequestKind) => string {
  let count = 0;
  return (kind) => `${kind}-${++count}`;
}

interface ManualRequestTimer extends ExtensionHostProtocolRequestTimer {
  readonly scheduled: ManualTimeout[];
}

interface ManualTimeout {
  readonly delayMs: number;
  disposed: boolean;
  fire(): void;
}

function createManualRequestTimer(): ManualRequestTimer {
  const scheduled: ManualTimeout[] = [];

  return {
    scheduled,
    schedule(callback, delayMs) {
      const timeout: ManualTimeout = {
        delayMs,
        disposed: false,
        fire() {
          if (timeout.disposed) {
            return;
          }

          callback();
        }
      };
      scheduled.push(timeout);

      return toDisposable(() => {
        timeout.disposed = true;
      });
    }
  };
}

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function removeFromArrayDisposable<T>(array: T[], item: T): IDisposable {
  return toDisposable(() => {
    const index = array.indexOf(item);

    if (index !== -1) {
      array.splice(index, 1);
    }
  });
}
