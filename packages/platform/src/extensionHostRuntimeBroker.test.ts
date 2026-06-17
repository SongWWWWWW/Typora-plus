import { toDisposable, URI, type IDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type {
  AiProvider,
  CommandMetadata,
  ExtensionCommandHandler,
  ExtensionContext,
  ExportProvider,
  MarkdownRendererProvider,
  MarkdownRendererRuntimeMetadata,
  RemoteSyncProgress,
  RemoteSyncProvider
} from "./index";
import {
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostAiProviderRegisterRequestMessage,
  createExtensionHostAiProviderUnregisterRequestMessage,
  createExtensionHostAiTextCancelMessage,
  createExtensionHostAiTextRequestMessage,
  createExtensionHostAiTextResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostCommandListRequestMessage,
  createExtensionHostCommandRegisterRequestMessage,
  createExtensionHostCommandUnregisterRequestMessage,
  createExtensionHostContextKeyGetRequestMessage,
  createExtensionHostContextKeySetRequestMessage,
  createExtensionHostExportDocumentResultMessage,
  createExtensionHostExportProviderRegisterRequestMessage,
  createExtensionHostExportProviderUnregisterRequestMessage,
  createExtensionHostMarkdownRendererRegisterRequestMessage,
  createExtensionHostMarkdownRendererRenderResultMessage,
  createExtensionHostMarkdownRendererUnregisterRequestMessage,
  createExtensionHostRemoteSyncCreatePlanCancelMessage,
  createExtensionHostRemoteSyncCreatePlanRequestMessage,
  createExtensionHostRemoteSyncCreatePlanResultMessage,
  createExtensionHostRemoteSyncExecutePlanCancelMessage,
  createExtensionHostRemoteSyncExecutePlanProgressMessage,
  createExtensionHostRemoteSyncExecutePlanRequestMessage,
  createExtensionHostRemoteSyncExecutePlanResultMessage,
  createExtensionHostRemoteSyncProviderRegisterRequestMessage,
  createExtensionHostRemoteSyncProviderUnregisterRequestMessage,
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

  it("registers AI provider proxies that call the remote host", async () => {
    const { context, controls } = createBrokerTestContext();
    const requests: ExtensionHostProtocolMessage[] = [];
    const broker = new ExtensionHostRuntimeBroker(context, {
      createRequestId: createSequentialRequestId(),
      request: (message) => {
        const request = readExtensionHostProtocolMessage(message);
        requests.push(request);

        if (request.type === extensionHostProtocolMessageTypes.aiTextRequest) {
          expect("signal" in request.request).toBe(false);
          return createExtensionHostAiTextResultMessage(request.requestId, request.extensionId, request.providerId, {
            value: `Remote: ${request.request.input}`,
            model: "remote-test-model",
            usage: {
              inputTokens: 2,
              outputTokens: 3,
              totalTokens: 5
            }
          });
        }

        throw new Error(`Unexpected request: ${request.type}`);
      }
    });

    await expect(broker.handleMessage(createExtensionHostAiProviderRegisterRequestMessage(
      "request-ai-1",
      "notes.remote",
      {
        id: "notes.remote.ai",
        title: "Remote AI"
      }
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-ai-1", "notes.remote"));
    expect(controls.aiProviders.map((provider) => ({ id: provider.id, title: provider.title }))).toEqual([
      { id: "notes.remote.ai", title: "Remote AI" }
    ]);

    await expect(controls.aiProviders[0]?.requestText({
      instruction: "Summarize",
      input: "# A",
      context: [
        {
          kind: "note",
          title: "A",
          uri: URI.file("C:/Notes/A.md"),
          value: "Context"
        }
      ],
      metadata: {
        surface: "command"
      },
      outputFormat: {
        kind: "json"
      }
    })).resolves.toEqual({
      value: "Remote: # A",
      model: "remote-test-model",
      usage: {
        inputTokens: 2,
        outputTokens: 3,
        totalTokens: 5
      }
    });
    expect(requests[0]).toEqual(createExtensionHostAiTextRequestMessage(
      "aiTextRequest-1",
      "notes.remote",
      "notes.remote.ai",
      {
        instruction: "Summarize",
        input: "# A",
        context: [
          {
            kind: "note",
            title: "A",
            uri: "file://C:/Notes/A.md",
            value: "Context"
          }
        ],
        metadata: {
          surface: "command"
        },
        outputFormat: {
          kind: "json"
        }
      }
    ));

    await expect(broker.handleMessage(createExtensionHostAiProviderUnregisterRequestMessage(
      "request-ai-2",
      "notes.remote",
      "notes.remote.ai"
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-ai-2", "notes.remote"));
    expect(controls.aiProviders).toEqual([]);
  });

  it("sends AI text cancellation notifications for aborted remote provider requests", async () => {
    const { context, controls } = createBrokerTestContext();
    const notifications: ExtensionHostProtocolMessage[] = [];
    let resolveRequest: (message: ExtensionHostProtocolMessage) => void = () => undefined;
    const broker = new ExtensionHostRuntimeBroker(context, {
      createRequestId: createSequentialRequestId(),
      notify: (message) => {
        notifications.push(readExtensionHostProtocolMessage(message));
      },
      request: (message) => {
        const request = readExtensionHostProtocolMessage(message);

        if (request.type !== extensionHostProtocolMessageTypes.aiTextRequest) {
          throw new Error(`Unexpected request: ${request.type}`);
        }

        return new Promise<ExtensionHostProtocolMessage>((resolve) => {
          resolveRequest = resolve;
        });
      }
    });

    await broker.handleMessage(createExtensionHostAiProviderRegisterRequestMessage(
      "request-ai-1",
      "notes.remote",
      {
        id: "notes.remote.ai",
        title: "Remote AI"
      }
    ));

    const controller = new AbortController();
    const pending = controls.aiProviders[0]!.requestText({
      instruction: "Summarize",
      input: "# A",
      signal: controller.signal
    });

    await Promise.resolve();

    controller.abort();

    expect(notifications).toEqual([
      createExtensionHostAiTextCancelMessage(
        "aiTextRequest-1",
        "notes.remote",
        "notes.remote.ai"
      )
    ]);

    resolveRequest(createExtensionHostApiErrorMessage(
      "aiTextRequest-1",
      "notes.remote",
      new Error("Extension host AI text request cancelled")
    ));

    await expect(pending).rejects.toThrow("Extension host AI text request cancelled");
  });

  it("registers remote sync provider proxies that call the remote host", async () => {
    const { context, controls } = createBrokerTestContext();
    const requests: ExtensionHostProtocolMessage[] = [];
    const progressEvents: RemoteSyncProgress[] = [];
    let broker!: ExtensionHostRuntimeBroker;
    broker = new ExtensionHostRuntimeBroker(context, {
      createRequestId: createSequentialRequestId(),
      request: async (message) => {
        const request = readExtensionHostProtocolMessage(message);
        requests.push(request);

        if (request.type === extensionHostProtocolMessageTypes.remoteSyncCreatePlan) {
          expect("signal" in request.request).toBe(false);
          const resource = request.request.resources[0];

          if (!resource) {
            throw new Error("Expected a sync resource");
          }

          return createExtensionHostRemoteSyncCreatePlanResultMessage(
            request.requestId,
            request.extensionId,
            request.providerId,
            {
              operations: [{
                kind: "create",
                target: "remote",
                relativePath: resource.relativePath,
                localPresence: "present",
                localUri: resource.uri,
                remotePresence: "missing"
              }],
              summary: {
                creates: 1,
                updates: 0,
                deletes: 0,
                skips: 0,
                conflicts: 0
              }
            }
          );
        }

        if (request.type === extensionHostProtocolMessageTypes.remoteSyncExecutePlan) {
          await broker.handleMessage(createExtensionHostRemoteSyncExecutePlanProgressMessage(
            request.requestId,
            request.extensionId,
            request.providerId,
            {
              message: "Uploading",
              completed: 1,
              total: 1,
              operation: request.plan.operations[0]!
            }
          ));

          return createExtensionHostRemoteSyncExecutePlanResultMessage(
            request.requestId,
            request.extensionId,
            request.providerId,
            {
              operations: request.plan.operations,
              summary: request.plan.summary,
              completedAt: 456
            }
          );
        }

        throw new Error(`Unexpected request: ${request.type}`);
      }
    });
    const syncRequest = {
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file" as const
      }],
      direction: "push" as const,
      onProgress: (progress: RemoteSyncProgress) => progressEvents.push(progress),
      signal: new AbortController().signal
    };

    await expect(broker.handleMessage(createExtensionHostRemoteSyncProviderRegisterRequestMessage(
      "request-sync-1",
      "notes.remote",
      {
        id: "notes.remote.sync",
        title: "Remote Sync"
      }
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-sync-1", "notes.remote"));
    expect(controls.remoteSyncProviders.map((provider) => ({ id: provider.id, title: provider.title }))).toEqual([
      { id: "notes.remote.sync", title: "Remote Sync" }
    ]);

    const plan = await controls.remoteSyncProviders[0]!.createPlan(syncRequest);

    expect(plan).toEqual({
      operations: [{
        kind: "create",
        target: "remote",
        relativePath: "A.md",
        localPresence: "present",
        localUri: URI.file("C:/Notes/A.md"),
        remotePresence: "missing"
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });
    expect(requests[0]).toEqual(createExtensionHostRemoteSyncCreatePlanRequestMessage(
      "remoteSyncCreatePlan-1",
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

    await expect(controls.remoteSyncProviders[0]!.executePlan(plan, syncRequest)).resolves.toEqual({
      operations: plan.operations,
      summary: plan.summary,
      completedAt: 456
    });
    expect(progressEvents).toEqual([{
      message: "Uploading",
      completed: 1,
      total: 1,
      operation: {
        kind: "create",
        target: "remote",
        relativePath: "A.md",
        localPresence: "present",
        localUri: URI.file("C:/Notes/A.md"),
        remotePresence: "missing"
      }
    }]);
    expect(requests[1]).toEqual(createExtensionHostRemoteSyncExecutePlanRequestMessage(
      "remoteSyncExecutePlan-2",
      "notes.remote",
      "notes.remote.sync",
      {
        operations: [{
          kind: "create",
          target: "remote",
          relativePath: "A.md",
          localPresence: "present",
          localUri: "file://C:/Notes/A.md",
          remotePresence: "missing"
        }],
        summary: plan.summary
      },
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

    await expect(broker.handleMessage(createExtensionHostRemoteSyncProviderUnregisterRequestMessage(
      "request-sync-2",
      "notes.remote",
      "notes.remote.sync"
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-sync-2", "notes.remote"));
    expect(controls.remoteSyncProviders).toEqual([]);
  });

  it("sends remote sync cancellation notifications for aborted remote provider requests", async () => {
    const { context, controls } = createBrokerTestContext();
    const notifications: ExtensionHostProtocolMessage[] = [];
    const pendingResolvers = new Map<string, (message: ExtensionHostProtocolMessage) => void>();
    const broker = new ExtensionHostRuntimeBroker(context, {
      createRequestId: createSequentialRequestId(),
      notify: (message) => {
        notifications.push(readExtensionHostProtocolMessage(message));
      },
      request: (message) => {
        const request = readExtensionHostProtocolMessage(message);

        if (
          request.type !== extensionHostProtocolMessageTypes.remoteSyncCreatePlan &&
          request.type !== extensionHostProtocolMessageTypes.remoteSyncExecutePlan
        ) {
          throw new Error(`Unexpected request: ${request.type}`);
        }

        return new Promise<ExtensionHostProtocolMessage>((resolve) => {
          pendingResolvers.set(request.requestId, resolve);
        });
      }
    });

    await broker.handleMessage(createExtensionHostRemoteSyncProviderRegisterRequestMessage(
      "request-sync-1",
      "notes.remote",
      {
        id: "notes.remote.sync",
        title: "Remote Sync"
      }
    ));

    const createController = new AbortController();
    const createPlan = controls.remoteSyncProviders[0]!.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file"
      }],
      direction: "push",
      signal: createController.signal
    });

    await Promise.resolve();

    createController.abort();

    expect(notifications[0]).toEqual(createExtensionHostRemoteSyncCreatePlanCancelMessage(
      "remoteSyncCreatePlan-1",
      "notes.remote",
      "notes.remote.sync"
    ));

    pendingResolvers.get("remoteSyncCreatePlan-1")?.(createExtensionHostApiErrorMessage(
      "remoteSyncCreatePlan-1",
      "notes.remote",
      new Error("Extension host remote sync create plan request cancelled")
    ));

    await expect(createPlan).rejects.toThrow("Extension host remote sync create plan request cancelled");

    const executeController = new AbortController();
    const executePlan = controls.remoteSyncProviders[0]!.executePlan({
      operations: [],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    }, {
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "push",
      signal: executeController.signal
    });

    await Promise.resolve();

    executeController.abort();

    expect(notifications[1]).toEqual(createExtensionHostRemoteSyncExecutePlanCancelMessage(
      "remoteSyncExecutePlan-2",
      "notes.remote",
      "notes.remote.sync"
    ));

    pendingResolvers.get("remoteSyncExecutePlan-2")?.(createExtensionHostApiErrorMessage(
      "remoteSyncExecutePlan-2",
      "notes.remote",
      new Error("Extension host remote sync execute plan request cancelled")
    ));

    await expect(executePlan).rejects.toThrow("Extension host remote sync execute plan request cancelled");
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

  it("unregisters individual runtime proxies", async () => {
    const { context, controls } = createBrokerTestContext();
    const broker = new ExtensionHostRuntimeBroker(context, {
      request: () => createExtensionHostApiResultMessage("unused", "notes.remote")
    });

    await broker.handleMessage(createExtensionHostCommandRegisterRequestMessage("request-14", "notes.remote", {
      id: "notes.remote.run",
      title: "Run"
    }));
    await broker.handleMessage(createExtensionHostExportProviderRegisterRequestMessage("request-15", "notes.remote", {
      format: "html",
      title: "HTML"
    }));
    await broker.handleMessage(createExtensionHostMarkdownRendererRegisterRequestMessage("request-16", "notes.remote", {
      id: "notes.remote.diagram",
      metadata: {
        kind: "block",
        label: "Diagram"
      }
    }));

    expect(controls.commandRegistrations).toHaveLength(1);
    expect(controls.exportProviders).toHaveLength(1);
    expect(controls.markdownProviders).toHaveLength(1);

    await expect(broker.handleMessage(createExtensionHostCommandUnregisterRequestMessage(
      "request-17",
      "notes.remote",
      "notes.remote.run"
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-17", "notes.remote"));
    await expect(broker.handleMessage(createExtensionHostExportProviderUnregisterRequestMessage(
      "request-18",
      "notes.remote",
      "html"
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-18", "notes.remote"));
    await expect(broker.handleMessage(createExtensionHostMarkdownRendererUnregisterRequestMessage(
      "request-19",
      "notes.remote",
      "notes.remote.diagram"
    ))).resolves.toEqual(createExtensionHostApiResultMessage("request-19", "notes.remote"));

    expect(controls.commandRegistrations).toHaveLength(0);
    expect(controls.exportProviders).toHaveLength(0);
    expect(controls.markdownProviders).toHaveLength(0);

    await expect(broker.handleMessage(createExtensionHostCommandUnregisterRequestMessage(
      "request-20",
      "notes.remote",
      "notes.remote.run"
    ))).resolves.toMatchObject({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "request-20",
      extensionId: "notes.remote",
      error: {
        message: expect.stringContaining("No extension host command proxy registered")
      }
    });
  });
});

interface BrokerTestControls {
  readonly aiProviders: AiProvider[];
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
  readonly remoteSyncProviders: RemoteSyncProvider[];
}

function createBrokerTestContext(): { readonly context: ExtensionContext; readonly controls: BrokerTestControls } {
  const controls: BrokerTestControls = {
    aiProviders: [],
    commandRegistrations: [],
    commandMetadata: [],
    executeCommand: async (command, args) => ({ args, command }),
    contextValues: new Map(),
    exportProviders: [],
    markdownProviders: [],
    remoteSyncProviders: []
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
