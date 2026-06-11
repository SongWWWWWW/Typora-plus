import { Disposable, URI, type IDisposable } from "@typora-plus/base";
import type { AiTextRequest } from "./ai";
import type { ExtensionContext } from "./extensions";
import type { RemoteSyncPlan, RemoteSyncPlanRequest, RemoteSyncProgress, RemoteSyncResult } from "./remoteSync";
import {
  createExtensionHostAiTextCancelMessage,
  createExtensionHostAiTextRequestMessage,
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostExportDocumentRequestMessage,
  createExtensionHostMarkdownRendererRenderRequestMessage,
  createExtensionHostRemoteSyncCreatePlanRequestMessage,
  createExtensionHostRemoteSyncCreatePlanCancelMessage,
  createExtensionHostRemoteSyncExecutePlanCancelMessage,
  createExtensionHostRemoteSyncExecutePlanRequestMessage,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostApiErrorMessage,
  type ExtensionHostApiResultMessage,
  type ExtensionHostAiTextResultMessage,
  type ExtensionHostExportDocumentResultMessage,
  type ExtensionHostMarkdownRendererRenderResultMessage,
  type ExtensionHostRemoteSyncCreatePlanResultMessage,
  type ExtensionHostRemoteSyncExecutePlanProgressMessage,
  type ExtensionHostRemoteSyncExecutePlanResultMessage,
  type ExtensionHostProtocolRemoteSyncPlan,
  type ExtensionHostProtocolRemoteSyncPlanRequest,
  type ExtensionHostProtocolRemoteSyncProgress,
  type ExtensionHostProtocolRemoteSyncResult,
  type ExtensionHostProtocolError,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";

export type ExtensionHostRuntimeBrokerRequestKind =
  | "aiTextRequest"
  | "commandExecute"
  | "exportDocument"
  | "markdownRendererRender"
  | "remoteSyncCreatePlan"
  | "remoteSyncExecutePlan";

export type ExtensionHostRuntimeBrokerRequestHandler =
  (message: ExtensionHostProtocolMessage) => Promise<unknown> | unknown;

export type ExtensionHostRuntimeBrokerResponse =
  | ExtensionHostApiErrorMessage
  | ExtensionHostApiResultMessage;

export interface ExtensionHostRuntimeBrokerOptions {
  readonly request: ExtensionHostRuntimeBrokerRequestHandler;
  readonly notify?: ExtensionHostRuntimeBrokerRequestHandler;
  readonly createRequestId?: (kind: ExtensionHostRuntimeBrokerRequestKind) => string;
}

export class ExtensionHostRuntimeBroker extends Disposable {
  private readonly aiProviderDisposables = new Map<string, IDisposable>();
  private readonly commandDisposables = new Map<string, IDisposable>();
  private readonly exportProviderDisposables = new Map<string, IDisposable>();
  private readonly markdownRendererDisposables = new Map<string, IDisposable>();
  private readonly remoteSyncProgressCallbacks = new Map<string, {
    readonly callback: (progress: RemoteSyncProgress) => void;
    readonly providerId: string;
  }>();
  private readonly remoteSyncProviderDisposables = new Map<string, IDisposable>();
  private requestCounter = 0;

  constructor(
    private readonly context: ExtensionContext,
    private readonly options: ExtensionHostRuntimeBrokerOptions
  ) {
    super();
  }

  async handleMessage(value: unknown): Promise<ExtensionHostRuntimeBrokerResponse> {
    const message = readExtensionHostProtocolMessage(value);
    const request = getRuntimeRequestInfo(message);

    try {
      if (!request) {
        throw new Error(`Extension host runtime broker cannot handle message type: ${message.type}`);
      }

      this.assertExtensionId(request.extensionId);

      switch (message.type) {
        case extensionHostProtocolMessageTypes.aiProviderRegister:
          this.registerAiProviderProxy(message.provider.id, message.provider.title);
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.aiProviderUnregister:
          this.unregisterProxy(this.aiProviderDisposables, message.providerId, "AI provider");
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.commandRegister:
          this.registerCommandProxy(message.command.id, message.command.title, message.command.category);
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.commandExecute:
          return createExtensionHostApiResultMessage(
            message.requestId,
            message.extensionId,
            await this.context.commands.executeCommand(message.command, ...message.args)
          );
        case extensionHostProtocolMessageTypes.commandList:
          return createExtensionHostApiResultMessage(
            message.requestId,
            message.extensionId,
            this.context.commands.getCommands()
          );
        case extensionHostProtocolMessageTypes.commandUnregister:
          this.unregisterProxy(this.commandDisposables, message.command, "command");
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.contextKeySet:
          this.context.contextKeys.setValue(message.key, message.clear ? undefined : message.value);
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.contextKeyGet:
          return createExtensionHostApiResultMessage(
            message.requestId,
            message.extensionId,
            this.context.contextKeys.getValue(message.key)
          );
        case extensionHostProtocolMessageTypes.exportProviderRegister:
          this.registerExportProviderProxy(message.provider.format, message.provider.title);
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.exportProviderUnregister:
          this.unregisterProxy(this.exportProviderDisposables, message.format, "export provider");
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.markdownRendererRegister:
          this.registerMarkdownRendererProxy(message.renderer.id, message.renderer.metadata);
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.markdownRendererUnregister:
          this.unregisterProxy(this.markdownRendererDisposables, message.rendererId, "Markdown renderer");
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.remoteSyncProviderRegister:
          this.registerRemoteSyncProviderProxy(message.provider.id, message.provider.title);
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.remoteSyncProviderUnregister:
          this.unregisterProxy(this.remoteSyncProviderDisposables, message.providerId, "remote sync provider");
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        case extensionHostProtocolMessageTypes.remoteSyncExecutePlanProgress:
          this.reportRemoteSyncExecutePlanProgress(message);
          return createExtensionHostApiResultMessage(message.requestId, message.extensionId);
        default:
          throw new Error(`Extension host runtime broker cannot handle message type: ${message.type}`);
      }
    } catch (error) {
      return createExtensionHostApiErrorMessage(request?.requestId ?? this.nextRequestId("commandExecute"), this.context.extension.id, error);
    }
  }

  private registerAiProviderProxy(providerId: string, title: string): void {
    if (this.aiProviderDisposables.has(providerId)) {
      throw new Error(`Extension host AI provider proxy already registered: ${providerId}`);
    }

    const disposable = this.context.ai.registerProvider({
      id: providerId,
      title,
      requestText: async (request) => {
        const requestId = this.nextRequestId("aiTextRequest");
        const abortListener = this.createAiTextAbortListener(request, requestId, providerId);

        if (request.signal?.aborted) {
          throw new Error("Extension host AI text request was aborted");
        }

        if (abortListener) {
          request.signal?.addEventListener("abort", abortListener, { once: true });
        }

        try {
          const response = await this.sendAiTextRequest(requestId, providerId, request);
          assertResponseIdentity(response, requestId, this.context.extension.id);

          if (response.type === extensionHostProtocolMessageTypes.apiError) {
            throw toError(response.error);
          }

          if (response.type !== extensionHostProtocolMessageTypes.aiTextResult) {
            throw new Error(`Expected extension host AI text result but received: ${response.type}`);
          }

          return (response as ExtensionHostAiTextResultMessage).result;
        } finally {
          if (abortListener) {
            request.signal?.removeEventListener("abort", abortListener);
          }
        }
      }
    });
    this.aiProviderDisposables.set(providerId, disposable);
    this.addRuntimeDisposable(disposable);
  }

  private registerCommandProxy(command: string, title: string | undefined, category: string | undefined): void {
    if (this.commandDisposables.has(command)) {
      throw new Error(`Extension host command proxy already registered: ${command}`);
    }

    const disposable = this.context.commands.registerCommand(
      command,
      async (...args) => {
        const requestId = this.nextRequestId("commandExecute");
        const response = readExtensionHostProtocolMessage(await this.options.request(
          createExtensionHostCommandExecuteRequestMessage(requestId, this.context.extension.id, command, args)
        ));

        return readApiResponseValue(response, requestId, this.context.extension.id);
      },
      {
        ...(title ? { title } : {}),
        ...(category ? { category } : {})
      }
    );
    this.commandDisposables.set(command, disposable);
    this.addRuntimeDisposable(disposable);
  }

  private registerExportProviderProxy(format: string, title: string): void {
    if (this.exportProviderDisposables.has(format)) {
      throw new Error(`Extension host export provider proxy already registered: ${format}`);
    }

    const disposable = this.context.exports.registerProvider({
      format,
      title,
      exportDocument: async (input) => {
        const requestId = this.nextRequestId("exportDocument");
        const response = readExtensionHostProtocolMessage(await this.options.request(
          createExtensionHostExportDocumentRequestMessage(requestId, this.context.extension.id, format, {
            uri: input.uri.toString(),
            name: input.name,
            value: input.value,
            ...(input.assetMode ? { assetMode: input.assetMode } : {})
          })
        ));

        assertResponseIdentity(response, requestId, this.context.extension.id);

        if (response.type !== extensionHostProtocolMessageTypes.exportDocumentResult) {
          throw new Error(`Expected extension host export document result but received: ${response.type}`);
        }

        return (response as ExtensionHostExportDocumentResultMessage).document;
      }
    });
    this.exportProviderDisposables.set(format, disposable);
    this.addRuntimeDisposable(disposable);
  }

  private registerMarkdownRendererProxy(
    rendererId: string,
    metadata: Parameters<ExtensionContext["markdown"]["registerRendererProvider"]>[1]
  ): void {
    if (this.markdownRendererDisposables.has(rendererId)) {
      throw new Error(`Extension host Markdown renderer proxy already registered: ${rendererId}`);
    }

    const disposable = this.context.markdown.registerRendererProvider({
      id: rendererId,
      render: async (input) => {
        const requestId = this.nextRequestId("markdownRendererRender");
        const response = readExtensionHostProtocolMessage(await this.options.request(
          createExtensionHostMarkdownRendererRenderRequestMessage(requestId, this.context.extension.id, rendererId, {
            value: input.value,
            ...(input.language ? { language: input.language } : {}),
            ...(input.uri ? { uri: input.uri.toString() } : {})
          })
        ));

        assertResponseIdentity(response, requestId, this.context.extension.id);

        if (response.type !== extensionHostProtocolMessageTypes.markdownRendererRenderResult) {
          throw new Error(`Expected extension host Markdown renderer render result but received: ${response.type}`);
        }

        return (response as ExtensionHostMarkdownRendererRenderResultMessage).output;
      }
    }, metadata);
    this.markdownRendererDisposables.set(rendererId, disposable);
    this.addRuntimeDisposable(disposable);
  }

  private registerRemoteSyncProviderProxy(providerId: string, title: string): void {
    if (this.remoteSyncProviderDisposables.has(providerId)) {
      throw new Error(`Extension host remote sync provider proxy already registered: ${providerId}`);
    }

    const disposable = this.context.remoteSync.registerProvider({
      id: providerId,
      title,
      createPlan: async (request) => {
        const requestId = this.nextRequestId("remoteSyncCreatePlan");
        const abortListener = this.createRemoteSyncAbortListener(request, requestId, providerId, "createPlan");

        if (request.signal?.aborted) {
          throw new Error("Extension host remote sync create plan request was aborted");
        }

        if (abortListener) {
          request.signal?.addEventListener("abort", abortListener, { once: true });
        }

        try {
          const response = await this.sendRemoteSyncCreatePlanRequest(requestId, providerId, request);
          assertResponseIdentity(response, requestId, this.context.extension.id);

          if (response.type === extensionHostProtocolMessageTypes.apiError) {
            throw toError(response.error);
          }

          if (response.type !== extensionHostProtocolMessageTypes.remoteSyncCreatePlanResult) {
            throw new Error(`Expected extension host remote sync create plan result but received: ${response.type}`);
          }

          return toRuntimeRemoteSyncPlan((response as ExtensionHostRemoteSyncCreatePlanResultMessage).plan);
        } finally {
          if (abortListener) {
            request.signal?.removeEventListener("abort", abortListener);
          }
        }
      },
      executePlan: async (plan, request) => {
        const requestId = this.nextRequestId("remoteSyncExecutePlan");
        const abortListener = this.createRemoteSyncAbortListener(request, requestId, providerId, "executePlan");

        if (request.signal?.aborted) {
          throw new Error("Extension host remote sync execute plan request was aborted");
        }

        if (abortListener) {
          request.signal?.addEventListener("abort", abortListener, { once: true });
        }

        if (request.onProgress) {
          this.remoteSyncProgressCallbacks.set(requestId, {
            callback: request.onProgress,
            providerId
          });
        }

        try {
          const response = await this.sendRemoteSyncExecutePlanRequest(requestId, providerId, plan, request);
          assertResponseIdentity(response, requestId, this.context.extension.id);

          if (response.type === extensionHostProtocolMessageTypes.apiError) {
            throw toError(response.error);
          }

          if (response.type !== extensionHostProtocolMessageTypes.remoteSyncExecutePlanResult) {
            throw new Error(`Expected extension host remote sync execute plan result but received: ${response.type}`);
          }

          return toRuntimeRemoteSyncResult((response as ExtensionHostRemoteSyncExecutePlanResultMessage).result);
        } finally {
          this.remoteSyncProgressCallbacks.delete(requestId);

          if (abortListener) {
            request.signal?.removeEventListener("abort", abortListener);
          }
        }
      }
    });
    this.remoteSyncProviderDisposables.set(providerId, disposable);
    this.addRuntimeDisposable(disposable);
  }

  private addRuntimeDisposable(disposable: IDisposable): void {
    this.store.add(disposable);
  }

  private createAiTextAbortListener(
    request: AiTextRequest,
    requestId: string,
    providerId: string
  ): (() => void) | undefined {
    if (!request.signal || !this.options.notify) {
      return undefined;
    }

    return () => {
      try {
        void this.options.notify?.(createExtensionHostAiTextCancelMessage(
          requestId,
          this.context.extension.id,
          providerId
        ));
      } catch {
        // Cancellation is best-effort; the pending request response remains authoritative.
      }
    };
  }

  private async sendAiTextRequest(
    requestId: string,
    providerId: string,
    request: AiTextRequest
  ): Promise<ExtensionHostProtocolMessage> {
    return readExtensionHostProtocolMessage(await this.options.request(
      createExtensionHostAiTextRequestMessage(
        requestId,
        this.context.extension.id,
        providerId,
        toProtocolAiTextRequest(request)
      )
    ));
  }

  private createRemoteSyncAbortListener(
    request: RemoteSyncPlanRequest,
    requestId: string,
    providerId: string,
    kind: "createPlan" | "executePlan"
  ): (() => void) | undefined {
    if (!request.signal || !this.options.notify) {
      return undefined;
    }

    return () => {
      try {
        void this.options.notify?.(kind === "createPlan"
          ? createExtensionHostRemoteSyncCreatePlanCancelMessage(
              requestId,
              this.context.extension.id,
              providerId
            )
          : createExtensionHostRemoteSyncExecutePlanCancelMessage(
              requestId,
              this.context.extension.id,
              providerId
            ));
      } catch {
        // Cancellation is best-effort; the pending request response remains authoritative.
      }
    };
  }

  private async sendRemoteSyncCreatePlanRequest(
    requestId: string,
    providerId: string,
    request: RemoteSyncPlanRequest
  ): Promise<ExtensionHostProtocolMessage> {
    return readExtensionHostProtocolMessage(await this.options.request(
      createExtensionHostRemoteSyncCreatePlanRequestMessage(
        requestId,
        this.context.extension.id,
        providerId,
        toProtocolRemoteSyncPlanRequest(request)
      )
    ));
  }

  private async sendRemoteSyncExecutePlanRequest(
    requestId: string,
    providerId: string,
    plan: RemoteSyncPlan,
    request: RemoteSyncPlanRequest
  ): Promise<ExtensionHostProtocolMessage> {
    return readExtensionHostProtocolMessage(await this.options.request(
      createExtensionHostRemoteSyncExecutePlanRequestMessage(
        requestId,
        this.context.extension.id,
        providerId,
        toProtocolRemoteSyncPlan(plan),
        toProtocolRemoteSyncPlanRequest(request)
      )
    ));
  }

  private reportRemoteSyncExecutePlanProgress(
    message: ExtensionHostRemoteSyncExecutePlanProgressMessage
  ): void {
    const registration = this.remoteSyncProgressCallbacks.get(message.requestId);

    if (!registration || registration.providerId !== message.providerId) {
      return;
    }

    registration.callback(toRuntimeRemoteSyncProgress(message.progress));
  }

  private unregisterProxy(disposables: Map<string, IDisposable>, key: string, label: string): void {
    const disposable = disposables.get(key);

    if (!disposable) {
      throw new Error(`No extension host ${label} proxy registered: ${key}`);
    }

    disposables.delete(key);
    disposable.dispose();
  }

  private assertExtensionId(extensionId: string): void {
    if (extensionId !== this.context.extension.id) {
      throw new Error(
        `Extension host broker message extension id mismatch: expected ${this.context.extension.id}, got ${extensionId}`
      );
    }
  }

  private nextRequestId(kind: ExtensionHostRuntimeBrokerRequestKind): string {
    return this.options.createRequestId?.(kind) ?? `runtime-broker-${++this.requestCounter}`;
  }

  override dispose(): void {
    this.aiProviderDisposables.clear();
    this.commandDisposables.clear();
    this.exportProviderDisposables.clear();
    this.markdownRendererDisposables.clear();
    this.remoteSyncProgressCallbacks.clear();
    this.remoteSyncProviderDisposables.clear();
    super.dispose();
  }
}

function getRuntimeRequestInfo(
  message: ExtensionHostProtocolMessage
): { readonly requestId: string; readonly extensionId: string } | undefined {
  switch (message.type) {
    case extensionHostProtocolMessageTypes.aiProviderRegister:
    case extensionHostProtocolMessageTypes.aiProviderUnregister:
    case extensionHostProtocolMessageTypes.commandRegister:
    case extensionHostProtocolMessageTypes.commandExecute:
    case extensionHostProtocolMessageTypes.commandList:
    case extensionHostProtocolMessageTypes.contextKeySet:
    case extensionHostProtocolMessageTypes.contextKeyGet:
    case extensionHostProtocolMessageTypes.commandUnregister:
    case extensionHostProtocolMessageTypes.exportProviderRegister:
    case extensionHostProtocolMessageTypes.exportProviderUnregister:
    case extensionHostProtocolMessageTypes.markdownRendererRegister:
    case extensionHostProtocolMessageTypes.markdownRendererUnregister:
    case extensionHostProtocolMessageTypes.remoteSyncProviderRegister:
    case extensionHostProtocolMessageTypes.remoteSyncProviderUnregister:
    case extensionHostProtocolMessageTypes.remoteSyncExecutePlanProgress:
      return {
        requestId: message.requestId,
        extensionId: message.extensionId
      };
    default:
      return undefined;
  }
}

function toProtocolAiTextRequest(request: AiTextRequest) {
  return {
    instruction: request.instruction,
    input: request.input,
    ...(request.context ? {
      context: request.context.map((item) => ({
        kind: item.kind,
        value: item.value,
        ...(item.title ? { title: item.title } : {}),
        ...(item.uri ? { uri: item.uri.toString() } : {})
      }))
    } : {}),
    ...(request.metadata ? { metadata: request.metadata } : {})
  };
}

function toProtocolRemoteSyncPlanRequest(
  request: RemoteSyncPlanRequest
): ExtensionHostProtocolRemoteSyncPlanRequest {
  return {
    workspaceUri: request.workspaceUri.toString(),
    resources: request.resources.map((resource) => ({
      uri: resource.uri.toString(),
      relativePath: resource.relativePath,
      kind: resource.kind,
      ...(resource.name ? { name: resource.name } : {}),
      ...(resource.size !== undefined ? { size: resource.size } : {}),
      ...(resource.mtime !== undefined ? { mtime: resource.mtime } : {}),
      ...(resource.contentHash ? { contentHash: resource.contentHash } : {})
    })),
    direction: request.direction,
    ...(request.remoteScopeId ? { remoteScopeId: request.remoteScopeId } : {}),
    ...(request.dryRun !== undefined ? { dryRun: request.dryRun } : {}),
    ...(request.metadata ? { metadata: request.metadata } : {})
  };
}

function toProtocolRemoteSyncPlan(plan: RemoteSyncPlan): ExtensionHostProtocolRemoteSyncPlan {
  return {
    operations: plan.operations.map((operation) => ({
      kind: operation.kind,
      target: operation.target,
      relativePath: operation.relativePath,
      ...(operation.localUri ? { localUri: operation.localUri.toString() } : {}),
      ...(operation.remoteId ? { remoteId: operation.remoteId } : {}),
      ...(operation.message ? { message: operation.message } : {})
    })),
    summary: plan.summary
  };
}

function toRuntimeRemoteSyncPlan(plan: ExtensionHostProtocolRemoteSyncPlan): RemoteSyncPlan {
  return {
    operations: plan.operations.map((operation) => ({
      kind: operation.kind,
      target: operation.target,
      relativePath: operation.relativePath,
      ...(operation.localUri ? { localUri: URI.parse(operation.localUri) } : {}),
      ...(operation.remoteId ? { remoteId: operation.remoteId } : {}),
      ...(operation.message ? { message: operation.message } : {})
    })),
    summary: plan.summary
  };
}

function toRuntimeRemoteSyncResult(result: ExtensionHostProtocolRemoteSyncResult): RemoteSyncResult {
  return {
    operations: toRuntimeRemoteSyncPlan(result).operations,
    summary: result.summary,
    ...(result.completedAt !== undefined ? { completedAt: result.completedAt } : {})
  };
}

function toRuntimeRemoteSyncProgress(progress: ExtensionHostProtocolRemoteSyncProgress): RemoteSyncProgress {
  return {
    message: progress.message,
    ...(progress.completed !== undefined ? { completed: progress.completed } : {}),
    ...(progress.total !== undefined ? { total: progress.total } : {}),
    ...(progress.operation ? {
      operation: {
        kind: progress.operation.kind,
        target: progress.operation.target,
        relativePath: progress.operation.relativePath,
        ...(progress.operation.localUri ? { localUri: URI.parse(progress.operation.localUri) } : {}),
        ...(progress.operation.remoteId ? { remoteId: progress.operation.remoteId } : {}),
        ...(progress.operation.message ? { message: progress.operation.message } : {})
      }
    } : {})
  };
}

function readApiResponseValue(
  message: ExtensionHostProtocolMessage,
  requestId: string,
  extensionId: string
): unknown {
  assertResponseIdentity(message, requestId, extensionId);

  switch (message.type) {
    case extensionHostProtocolMessageTypes.apiResult:
      return message.value;
    case extensionHostProtocolMessageTypes.apiError:
      throw toError(message.error);
    default:
      throw new Error(`Expected extension host API response but received: ${message.type}`);
  }
}

function assertResponseIdentity(
  message: ExtensionHostProtocolMessage,
  requestId: string,
  extensionId: string
): void {
  if (!("requestId" in message) || message.requestId !== requestId) {
    throw new Error(`Extension host response request id mismatch: expected ${requestId}`);
  }

  if (!("extensionId" in message) || message.extensionId !== extensionId) {
    throw new Error(`Extension host response extension id mismatch: expected ${extensionId}`);
  }
}

function toError(error: ExtensionHostProtocolError): Error {
  const result = new Error(error.message);

  if (error.name) {
    result.name = error.name;
  }

  if (error.stack) {
    result.stack = error.stack;
  }

  return result;
}
