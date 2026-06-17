import { Emitter, toDisposable, URI, type Event } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { ExtensionActivationRequest, ExtensionContext } from "./extensions";
import {
  createExtensionHostActivationRequestMessage,
  createExtensionHostAiTextCancelMessage,
  createExtensionHostAiTextRequestMessage,
  createExtensionHostAiTextResultMessage,
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostExportDocumentRequestMessage,
  createExtensionHostAiProviderRegisterRequestMessage,
  createExtensionHostHandshakeRequestMessage,
  createExtensionHostMarkdownRendererRenderRequestMessage,
  createExtensionHostRemoteSyncCreatePlanCancelMessage,
  createExtensionHostRemoteSyncCreatePlanRequestMessage,
  createExtensionHostRemoteSyncCreatePlanResultMessage,
  createExtensionHostRemoteSyncExecutePlanCancelMessage,
  createExtensionHostRemoteSyncExecutePlanProgressMessage,
  createExtensionHostRemoteSyncExecutePlanRequestMessage,
  createExtensionHostRemoteSyncExecutePlanResultMessage,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import {
  ExtensionHostProtocolRuntime,
  type ExtensionHostProtocolRuntimeRequestKind
} from "./extensionHostProtocolRuntime";
import type { ExtensionHostProtocolTransport } from "./extensionHostProtocolSession";
import type { ExtensionHostProtocolRequestTimer } from "./extensionHostProtocolRequestTimer";
import type { RemoteSyncPlan, RemoteSyncResult } from "./remoteSync";

describe("extension host protocol runtime", () => {
  it("responds to protocol handshake requests", async () => {
    const transport = createMemoryTransport();
    new ExtensionHostProtocolRuntime(transport, {
      activate() {
        return undefined;
      }
    });

    transport.receive(createExtensionHostHandshakeRequestMessage("handshake-1", "notes.remote"));
    await flushPromises();

    expect(transport.sent).toEqual([{
      type: extensionHostProtocolMessageTypes.handshakeResult,
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
  });

  it("rejects unsupported protocol handshake versions", async () => {
    const transport = createMemoryTransport();
    new ExtensionHostProtocolRuntime(transport, {
      activate() {
        return undefined;
      }
    });

    transport.receive(createExtensionHostHandshakeRequestMessage("handshake-2", "notes.remote", 2));
    await flushPromises();

    expect(transport.sent).toEqual([{
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "handshake-2",
      extensionId: "notes.remote",
      error: {
        message: "Unsupported extension host protocol version: expected 1, got 2",
        name: "Error",
        stack: transport.sent[0]?.type === extensionHostProtocolMessageTypes.apiError
          ? transport.sent[0].error.stack
          : undefined
      }
    }]);
  });

  it("activates with a proxy context and sends runtime contribution requests", async () => {
    const transport = createMemoryTransport();
    let activatedContext: ExtensionContext | undefined;
    new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      activate(request) {
        activatedContext = request.context;
        request.context.commands.registerCommand(
          "notes.remote.run",
          () => ({ ok: true }),
          { title: "Run Remote", category: "Remote" }
        );
        request.context.contextKeys.setValue("notes.remote.ready", true);
        request.context.ai.registerProvider({
          id: "notes.remote.ai",
          title: "Remote AI",
          requestText: () => ({ value: "AI" })
        });
        request.context.exports.registerProvider({
          format: "html",
          title: "HTML",
          exportDocument: (input) => ({
            defaultFileName: `${input.name}.html`,
            format: "html",
            mimeType: "text/html",
            value: input.value
          })
        });
        request.context.markdown.registerRendererProvider({
          id: "notes.remote.diagram",
          render: () => ({ html: "<span>Diagram</span>" })
        }, {
          kind: "block",
          label: "Diagram",
          language: "Mermaid",
          priority: 5
        });
      }
    });

    transport.receive(createActivationMessage("activate-1"));
    await flushPromises();

    expect(activatedContext?.contextKeys.getValue("notes.remote.ready")).toBe(true);
    expect(activatedContext?.commands.getCommands()).toEqual([{
      id: "notes.remote.run",
      title: "Run Remote",
      category: "Remote"
    }]);
    expect(activatedContext?.ai.getProviders()).toEqual([{
      id: "notes.remote.ai",
      title: "Remote AI"
    }]);
    expect(activatedContext?.exports.getProviders().map((provider) => provider.format)).toEqual(["html"]);
    expect(activatedContext?.markdown.getRenderers()).toEqual([{
      id: "notes.remote.diagram",
      hasProvider: true,
      kind: "block",
      label: "Diagram",
      language: "mermaid",
      priority: 5
    }]);
    expect(transport.sent).toEqual([
      {
        type: extensionHostProtocolMessageTypes.commandRegister,
        requestId: "commandRegister-1",
        extensionId: "notes.remote",
        command: {
          id: "notes.remote.run",
          title: "Run Remote",
          category: "Remote"
        }
      },
      {
        type: extensionHostProtocolMessageTypes.contextKeySet,
        requestId: "contextKeySet-2",
        extensionId: "notes.remote",
        key: "notes.remote.ready",
        clear: false,
        value: true
      },
      {
        type: extensionHostProtocolMessageTypes.aiProviderRegister,
        requestId: "aiProviderRegister-3",
        extensionId: "notes.remote",
        provider: {
          id: "notes.remote.ai",
          title: "Remote AI"
        }
      },
      {
        type: extensionHostProtocolMessageTypes.exportProviderRegister,
        requestId: "exportProviderRegister-4",
        extensionId: "notes.remote",
        provider: {
          format: "html",
          title: "HTML"
        }
      },
      {
        type: extensionHostProtocolMessageTypes.markdownRendererRegister,
        requestId: "markdownRendererRegister-5",
        extensionId: "notes.remote",
        renderer: {
          id: "notes.remote.diagram",
          metadata: {
            kind: "block",
            label: "Diagram",
            language: "mermaid",
            priority: 5
          }
        }
      },
      {
        type: extensionHostProtocolMessageTypes.activationResult,
        requestId: "activate-1",
        extensionId: "notes.remote"
      }
    ]);
  });

  it("handles main-thread command, export, and renderer callbacks", async () => {
    const transport = createMemoryTransport();
    new ExtensionHostProtocolRuntime(transport, {
      activate(request) {
        request.context.commands.registerCommand("notes.remote.run", (value) => ({
          value
        }), { title: "Run" });
        request.context.ai.registerProvider({
          id: "notes.remote.ai",
          title: "Remote AI",
          requestText: (input) => ({
            value: `${input.instruction}: ${input.outputFormat?.kind ?? "text"}: ${input.context?.[0]?.uri?.path ?? ""}: ${input.input}`,
            model: "remote-test-model",
            usage: {
              inputTokens: 1,
              outputTokens: 2,
              totalTokens: 3
            }
          })
        });
        request.context.exports.registerProvider({
          format: "html",
          title: "HTML",
          exportDocument: (input) => ({
            defaultFileName: "A.html",
            format: "html",
            mimeType: "text/html",
            value: `<main>${input.value}</main>`
          })
        });
        request.context.markdown.registerRendererProvider({
          id: "notes.remote.diagram",
          render: (input) => ({
            html: `<span>${input.value}</span>`
          })
        }, {
          kind: "block",
          label: "Diagram"
        });
      }
    });

    transport.receive(createActivationMessage("activate-2"));
    await flushPromises();
    transport.sent.length = 0;

    transport.receive(createExtensionHostCommandExecuteRequestMessage(
      "main-1",
      "notes.remote",
      "notes.remote.run",
      ["alpha"]
    ));
    transport.receive(createExtensionHostAiTextRequestMessage(
      "main-ai-1",
      "notes.remote",
      "notes.remote.ai",
      {
        instruction: "Summarize",
        input: "# A",
        context: [
          {
            kind: "note",
            uri: "file://C:/Notes/A.md",
            value: "Context"
          }
        ],
        outputFormat: {
          kind: "json"
        }
      }
    ));
    transport.receive(createExtensionHostExportDocumentRequestMessage(
      "main-2",
      "notes.remote",
      "html",
      {
        assetMode: "file",
        name: "A",
        uri: "file://C:/Notes/A.md",
        value: "# A"
      }
    ));
    transport.receive(createExtensionHostMarkdownRendererRenderRequestMessage(
      "main-3",
      "notes.remote",
      "notes.remote.diagram",
      {
        uri: "file://C:/Notes/A.md",
        value: "graph TD"
      }
    ));
    await flushPromises();

    expect(transport.sent).toEqual([
      createExtensionHostApiResultMessage("main-1", "notes.remote", {
        value: "alpha"
      }),
      createExtensionHostAiTextResultMessage("main-ai-1", "notes.remote", "notes.remote.ai", {
        value: "Summarize: json: C:/Notes/A.md: # A",
        model: "remote-test-model",
        usage: {
          inputTokens: 1,
          outputTokens: 2,
          totalTokens: 3
        }
      }),
      {
        type: extensionHostProtocolMessageTypes.exportDocumentResult,
        requestId: "main-2",
        extensionId: "notes.remote",
        document: {
          defaultFileName: "A.html",
          format: "html",
          mimeType: "text/html",
          value: "<main># A</main>"
        }
      },
      {
        type: extensionHostProtocolMessageTypes.markdownRendererRenderResult,
        requestId: "main-3",
        extensionId: "notes.remote",
        rendererId: "notes.remote.diagram",
        output: {
          html: "<span>graph TD</span>"
        }
      }
    ]);
  });

  it("cancels main-thread AI callbacks through provider abort signals", async () => {
    const transport = createMemoryTransport();
    let aiSignal: AbortSignal | undefined;
    let resolveAi: (value: { readonly value: string }) => void = () => undefined;

    new ExtensionHostProtocolRuntime(transport, {
      activate(request) {
        request.context.ai.registerProvider({
          id: "notes.remote.ai",
          title: "Remote AI",
          requestText: (input) => {
            aiSignal = input.signal;
            return new Promise((resolve) => {
              resolveAi = resolve;
            });
          }
        });
      }
    });

    transport.receive(createActivationMessage("activate-ai-cancel"));
    await flushPromises();
    transport.sent.length = 0;

    transport.receive(createExtensionHostAiTextRequestMessage(
      "main-ai-cancel-1",
      "notes.remote",
      "notes.remote.ai",
      {
        instruction: "Summarize",
        input: "# A"
      }
    ));
    await flushPromises();

    expect(aiSignal).toBeDefined();
    expect(aiSignal?.aborted).toBe(false);
    expect(transport.sent).toEqual([]);

    transport.receive(createExtensionHostAiTextCancelMessage(
      "main-ai-cancel-1",
      "notes.remote",
      "notes.remote.ai"
    ));
    await flushPromises();

    expect(aiSignal?.aborted).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "main-ai-cancel-1",
      extensionId: "notes.remote",
      error: {
        message: "Extension host AI text request cancelled",
        name: "Error"
      }
    });

    resolveAi({ value: "Late result" });
    await flushPromises();

    expect(transport.sent).toHaveLength(1);
  });

  it("handles main-thread remote sync callbacks", async () => {
    const transport = createMemoryTransport();
    new ExtensionHostProtocolRuntime(transport, {
      activate(request) {
        request.context.remoteSync.registerProvider({
          id: "notes.remote.sync",
          title: "Remote Sync",
          createPlan: (input) => {
            expect(input.workspaceUri.toString()).toBe("file://C:/Notes");
            expect(input.signal).toBeDefined();
            expect(input.signal?.aborted).toBe(false);
            const resource = input.resources[0];

            if (!resource) {
              throw new Error("Expected a sync resource");
            }

            return {
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
            };
          },
          executePlan: (plan, input) => {
            expect(input.direction).toBe("push");
            expect(input.signal).toBeDefined();
            expect(input.signal?.aborted).toBe(false);
            input.onProgress?.({
              message: "Uploading",
              completed: 1,
              total: 1,
              operation: plan.operations[0]!
            });

            return {
              operations: plan.operations,
              summary: plan.summary,
              completedAt: 789
            };
          }
        });
      }
    });

    transport.receive(createActivationMessage("activate-sync"));
    await flushPromises();

    expect(transport.sent[0]).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncProviderRegister,
      requestId: "extension-runtime-remoteSyncProviderRegister-1",
      extensionId: "notes.remote",
      provider: {
        id: "notes.remote.sync",
        title: "Remote Sync"
      }
    });
    transport.sent.length = 0;

    const syncRequest = {
      workspaceUri: "file://C:/Notes",
      resources: [{
        uri: "file://C:/Notes/A.md",
        relativePath: "A.md",
        kind: "file" as const
      }],
      direction: "push" as const
    };
    const plan = {
      operations: [{
        kind: "create" as const,
        target: "remote" as const,
        relativePath: "A.md",
        localPresence: "present" as const,
        localUri: "file://C:/Notes/A.md",
        remotePresence: "missing" as const
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    };

    transport.receive(createExtensionHostRemoteSyncCreatePlanRequestMessage(
      "main-sync-1",
      "notes.remote",
      "notes.remote.sync",
      syncRequest
    ));
    await flushPromises();

    transport.receive(createExtensionHostRemoteSyncExecutePlanRequestMessage(
      "main-sync-2",
      "notes.remote",
      "notes.remote.sync",
      plan,
      syncRequest
    ));
    await flushPromises();

    expect(transport.sent).toEqual([
      createExtensionHostRemoteSyncCreatePlanResultMessage(
        "main-sync-1",
        "notes.remote",
        "notes.remote.sync",
        plan
      ),
      createExtensionHostRemoteSyncExecutePlanProgressMessage(
        "main-sync-2",
        "notes.remote",
        "notes.remote.sync",
        {
          message: "Uploading",
          completed: 1,
          total: 1,
          operation: plan.operations[0]!
        }
      ),
      createExtensionHostRemoteSyncExecutePlanResultMessage(
        "main-sync-2",
        "notes.remote",
        "notes.remote.sync",
        {
          ...plan,
          completedAt: 789
        }
      )
    ]);

    expect(URI.parse(plan.operations[0]!.localUri).toString()).toBe("file://C:/Notes/A.md");
  });

  it("cancels main-thread remote sync callbacks through provider abort signals", async () => {
    const transport = createMemoryTransport();
    let createSignal: AbortSignal | undefined;
    let executeSignal: AbortSignal | undefined;
    let resolveCreatePlan: (value: RemoteSyncPlan) => void = () => undefined;
    let resolveExecutePlan: (value: RemoteSyncResult) => void = () => undefined;

    new ExtensionHostProtocolRuntime(transport, {
      activate(request) {
        request.context.remoteSync.registerProvider({
          id: "notes.remote.sync",
          title: "Remote Sync",
          createPlan: (input) => {
            createSignal = input.signal;
            return new Promise((resolve) => {
              resolveCreatePlan = resolve;
            });
          },
          executePlan: (_plan, input) => {
            executeSignal = input.signal;
            return new Promise((resolve) => {
              resolveExecutePlan = resolve;
            });
          }
        });
      }
    });

    transport.receive(createActivationMessage("activate-sync-cancel"));
    await flushPromises();
    transport.sent.length = 0;

    const syncRequest = {
      workspaceUri: "file://C:/Notes",
      resources: [{
        uri: "file://C:/Notes/A.md",
        relativePath: "A.md",
        kind: "file" as const
      }],
      direction: "push" as const
    };
    const plan = {
      operations: [{
        kind: "create" as const,
        target: "remote" as const,
        relativePath: "A.md" as const,
        localPresence: "present" as const,
        localUri: "file://C:/Notes/A.md",
        remotePresence: "missing" as const
      }],
      summary: {
        creates: 1 as const,
        updates: 0 as const,
        deletes: 0 as const,
        skips: 0 as const,
        conflicts: 0 as const
      }
    };
    const runtimePlan = {
      operations: [{
        kind: "create" as const,
        target: "remote" as const,
        relativePath: "A.md" as const,
        localPresence: "present" as const,
        localUri: URI.parse("file://C:/Notes/A.md"),
        remotePresence: "missing" as const
      }],
      summary: plan.summary
    };

    transport.receive(createExtensionHostRemoteSyncCreatePlanRequestMessage(
      "main-sync-cancel-1",
      "notes.remote",
      "notes.remote.sync",
      syncRequest
    ));
    await flushPromises();

    expect(createSignal).toBeDefined();
    expect(createSignal?.aborted).toBe(false);
    expect(transport.sent).toEqual([]);

    transport.receive(createExtensionHostRemoteSyncCreatePlanCancelMessage(
      "main-sync-cancel-1",
      "notes.remote",
      "notes.remote.sync"
    ));
    await flushPromises();

    expect(createSignal?.aborted).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "main-sync-cancel-1",
      extensionId: "notes.remote",
      error: {
        message: "Extension host remote sync create plan request cancelled",
        name: "Error"
      }
    });

    resolveCreatePlan(runtimePlan);
    await flushPromises();

    expect(transport.sent).toHaveLength(1);
    transport.sent.length = 0;

    transport.receive(createExtensionHostRemoteSyncExecutePlanRequestMessage(
      "main-sync-cancel-2",
      "notes.remote",
      "notes.remote.sync",
      plan,
      syncRequest
    ));
    await flushPromises();

    expect(executeSignal).toBeDefined();
    expect(executeSignal?.aborted).toBe(false);
    expect(transport.sent).toEqual([]);

    transport.receive(createExtensionHostRemoteSyncExecutePlanCancelMessage(
      "main-sync-cancel-2",
      "notes.remote",
      "notes.remote.sync"
    ));
    await flushPromises();

    expect(executeSignal?.aborted).toBe(true);
    expect(transport.sent).toHaveLength(1);
    expect(transport.sent[0]).toMatchObject({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "main-sync-cancel-2",
      extensionId: "notes.remote",
      error: {
        message: "Extension host remote sync execute plan request cancelled",
        name: "Error"
      }
    });

    resolveExecutePlan({
      ...runtimePlan,
      completedAt: 123
    });
    await flushPromises();

    expect(transport.sent).toHaveLength(1);
  });

  it("executes main-thread commands from the proxy context", async () => {
    const transport = createMemoryTransport();
    let execution: Promise<unknown> | undefined;
    new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      async activate(request) {
        execution = request.context.commands.executeCommand("workbench.open", "file://notes/a.md");
        await execution;
      }
    });

    transport.receive(createActivationMessage("activate-3"));
    await flushPromises();

    expect(transport.sent).toEqual([createExtensionHostCommandExecuteRequestMessage(
      "commandExecute-1",
      "notes.remote",
      "workbench.open",
      ["file://notes/a.md"]
    )]);

    transport.receive(createExtensionHostApiResultMessage("commandExecute-1", "notes.remote", {
      opened: true
    }));
    await flushPromises();

    await expect(execution).resolves.toEqual({ opened: true });
    expect(transport.sent[1]).toEqual({
      type: extensionHostProtocolMessageTypes.activationResult,
      requestId: "activate-3",
      extensionId: "notes.remote"
    });
  });

  it("rejects proxy context command executions that miss the configured timeout", async () => {
    const transport = createMemoryTransport();
    const timer = createManualRequestTimer();
    const errors: string[] = [];
    let execution: Promise<unknown> | undefined;
    const runtime = new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      onError: (error) => errors.push(error.message),
      requestTimer: timer,
      requestTimeoutMs: 60,
      activate(request) {
        execution = request.context.commands.executeCommand("workbench.open", "file://notes/a.md");
      }
    });

    transport.receive(createActivationMessage("activate-timeout"));
    await flushPromises();

    expect(transport.sent[0]).toEqual(createExtensionHostCommandExecuteRequestMessage(
      "commandExecute-1",
      "notes.remote",
      "workbench.open",
      ["file://notes/a.md"]
    ));
    expect(timer.scheduled[0]?.delayMs).toBe(60);

    timer.scheduled[0]?.fire();

    await expect(execution).rejects.toThrow(
      "Extension host protocol runtime request timed out after 60ms: commandExecute-1 (notes.remote)"
    );
    expect(timer.scheduled[0]?.disposed).toBe(true);

    transport.receive(createExtensionHostApiResultMessage("commandExecute-1", "notes.remote", {
      opened: true
    }));
    await flushPromises();

    expect(errors).toEqual([
      "Extension host protocol runtime received unhandled message: extensionHost/api/result"
    ]);
    runtime.dispose();
  });

  it("reports fire-and-forget registration request timeouts", async () => {
    const transport = createMemoryTransport();
    const timer = createManualRequestTimer();
    const errors: string[] = [];
    const runtime = new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      onError: (error) => errors.push(error.message),
      requestTimer: timer,
      requestTimeoutMs: 35,
      activate(request) {
        request.context.commands.registerCommand("notes.remote.run", () => undefined, {
          title: "Run"
        });
      }
    });

    transport.receive(createActivationMessage("activate-register-timeout"));
    await flushPromises();

    timer.scheduled[0]?.fire();
    await flushPromises();

    expect(errors).toEqual([
      "Extension host protocol runtime request timed out after 35ms: commandRegister-1 (notes.remote)"
    ]);
    expect(timer.scheduled[0]?.disposed).toBe(true);
    runtime.dispose();
  });

  it("rejects pending runtime requests on dispose and clears request timers", async () => {
    const transport = createMemoryTransport();
    const timer = createManualRequestTimer();
    let execution: Promise<unknown> | undefined;
    const runtime = new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      requestTimer: timer,
      requestTimeoutMs: 100,
      activate(request) {
        execution = request.context.commands.executeCommand("workbench.open", "file://notes/a.md");
      }
    });

    transport.receive(createActivationMessage("activate-dispose"));
    await flushPromises();
    runtime.dispose();

    await expect(execution).rejects.toThrow("runtime disposed");
    expect(timer.scheduled[0]?.disposed).toBe(true);
  });

  it("sends unregister messages when proxy context disposables are disposed", async () => {
    const transport = createMemoryTransport();
    const disposables: { dispose(): void }[] = [];
    new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      activate(request) {
        disposables.push(request.context.commands.registerCommand("notes.remote.run", () => undefined, {
          title: "Run"
        }));
        disposables.push(request.context.exports.registerProvider({
          format: "html",
          title: "HTML",
          exportDocument: () => ({
            defaultFileName: "A.html",
            format: "html",
            mimeType: "text/html",
            value: ""
          })
        }));
        disposables.push(request.context.markdown.registerRendererProvider({
          id: "notes.remote.diagram",
          render: () => ({ html: "" })
        }, {
          kind: "block",
          label: "Diagram"
        }));
      }
    });

    transport.receive(createActivationMessage("activate-4"));
    await flushPromises();
    transport.sent.length = 0;

    for (const disposable of disposables) {
      disposable.dispose();
    }
    await flushPromises();

    expect(transport.sent).toEqual([
      {
        type: extensionHostProtocolMessageTypes.commandUnregister,
        requestId: "commandUnregister-4",
        extensionId: "notes.remote",
        command: "notes.remote.run"
      },
      {
        type: extensionHostProtocolMessageTypes.exportProviderUnregister,
        requestId: "exportProviderUnregister-5",
        extensionId: "notes.remote",
        format: "html"
      },
      {
        type: extensionHostProtocolMessageTypes.markdownRendererUnregister,
        requestId: "markdownRendererUnregister-6",
        extensionId: "notes.remote",
        rendererId: "notes.remote.diagram"
      }
    ]);

    transport.receive(createExtensionHostCommandExecuteRequestMessage(
      "main-4",
      "notes.remote",
      "notes.remote.run",
      []
    ));
    await flushPromises();

    expect(transport.sent[3]).toMatchObject({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "main-4",
      extensionId: "notes.remote",
      error: {
        message: expect.stringContaining("No extension host runtime command registered")
      }
    });
  });

  it("sends activation errors and clears runtime records after activation failure", async () => {
    const transport = createMemoryTransport();
    new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      activate(request) {
        request.context.commands.registerCommand("notes.remote.run", () => undefined, {
          title: "Run"
        });
        throw new Error("activation failed");
      }
    });

    transport.receive(createActivationMessage("activate-5"));
    await flushPromises();

    expect(transport.sent).toEqual([
      {
        type: extensionHostProtocolMessageTypes.commandRegister,
        requestId: "commandRegister-1",
        extensionId: "notes.remote",
        command: {
          id: "notes.remote.run",
          title: "Run"
        }
      },
      {
        type: extensionHostProtocolMessageTypes.commandUnregister,
        requestId: "commandUnregister-2",
        extensionId: "notes.remote",
        command: "notes.remote.run"
      },
      {
        type: extensionHostProtocolMessageTypes.activationError,
        requestId: "activate-5",
        extensionId: "notes.remote",
        error: {
          message: "activation failed",
          name: "Error",
          stack: transport.sent[2]?.type === extensionHostProtocolMessageTypes.activationError
            ? transport.sent[2].error.stack
            : undefined
        }
      }
    ]);

    transport.receive(createExtensionHostCommandExecuteRequestMessage(
      "main-5",
      "notes.remote",
      "notes.remote.run",
      []
    ));
    await flushPromises();

    expect(transport.sent[3]).toMatchObject({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "main-5",
      extensionId: "notes.remote",
      error: {
        message: expect.stringContaining("No extension host protocol runtime activated")
      }
    });
  });

  it("reports protocol and fire-and-forget registration errors", async () => {
    const transport = createMemoryTransport();
    const errors: string[] = [];
    new ExtensionHostProtocolRuntime(transport, {
      createRequestId: createSequentialRequestId(),
      onError: (error) => errors.push(error.message),
      activate(request) {
        request.context.commands.registerCommand("notes.remote.run", () => undefined, {
          title: "Run"
        });
      }
    });

    transport.receive({ type: "bad" });
    transport.receive(createActivationMessage("activate-6"));
    await flushPromises();
    transport.receive(createExtensionHostApiErrorMessage("commandRegister-1", "notes.remote", new Error("remote failed")));
    await flushPromises();

    expect(errors).toEqual([
      "Unknown extension host protocol message type: bad",
      "remote failed"
    ]);
  });
});

interface MemoryTransport extends ExtensionHostProtocolTransport {
  readonly sent: ExtensionHostProtocolMessage[];
  receive(message: unknown): void;
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

function createActivationMessage(requestId: string): ExtensionHostProtocolMessage {
  return createExtensionHostActivationRequestMessage({
    activationEvent: "onStartup",
    context: undefined as unknown as ExtensionContext,
    extension: {
      activationEvents: ["onStartup"],
      activationState: "activating",
      displayName: "Remote Notes",
      id: "notes.remote"
    }
  } satisfies ExtensionActivationRequest, requestId);
}

function createSequentialRequestId(): (kind: ExtensionHostProtocolRuntimeRequestKind) => string {
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
