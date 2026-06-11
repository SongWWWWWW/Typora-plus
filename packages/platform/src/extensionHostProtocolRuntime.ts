import { Disposable, DisposableStore, toDisposable, URI, type IDisposable } from "@typora-plus/base";
import type { AiProvider, AiTextRequest } from "./ai";
import type { CommandMetadata } from "./commands";
import type { ContextKeyValue } from "./contextKeys";
import type {
  ExtensionActivationHandler,
  ExtensionActivationRequest,
  ExtensionCommandHandler,
  ExtensionContext,
  ExtensionRuntimeCommandMetadata,
  RegisteredExtension
} from "./extensions";
import type { ExportProvider } from "./exports";
import type {
  MarkdownRendererProvider,
  MarkdownRendererRuntimeMetadata,
  RegisteredMarkdownRenderer
} from "./markdownRenderers";
import type { RemoteSyncPlan, RemoteSyncPlanRequest, RemoteSyncProvider, RemoteSyncResult } from "./remoteSync";
import {
  createExtensionHostActivationErrorMessage,
  createExtensionHostActivationResultMessage,
  createExtensionHostAiProviderRegisterRequestMessage,
  createExtensionHostAiProviderUnregisterRequestMessage,
  createExtensionHostAiTextResultMessage,
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostCommandRegisterRequestMessage,
  createExtensionHostCommandUnregisterRequestMessage,
  createExtensionHostContextKeySetRequestMessage,
  createExtensionHostExportDocumentResultMessage,
  createExtensionHostExportDocumentRequestMessage,
  createExtensionHostExportProviderRegisterRequestMessage,
  createExtensionHostExportProviderUnregisterRequestMessage,
  createExtensionHostHandshakeResultMessage,
  createExtensionHostMarkdownRendererRegisterRequestMessage,
  createExtensionHostMarkdownRendererRenderResultMessage,
  createExtensionHostMarkdownRendererUnregisterRequestMessage,
  createExtensionHostRemoteSyncCreatePlanResultMessage,
  createExtensionHostRemoteSyncExecutePlanResultMessage,
  createExtensionHostRemoteSyncProviderRegisterRequestMessage,
  createExtensionHostRemoteSyncProviderUnregisterRequestMessage,
  extensionHostProtocolVersion,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostActivationRequestMessage,
  type ExtensionHostAiTextRequestMessage,
  type ExtensionHostApiErrorMessage,
  type ExtensionHostApiResultMessage,
  type ExtensionHostExportDocumentResultMessage,
  type ExtensionHostHandshakeRequestMessage,
  type ExtensionHostMarkdownRendererRenderResultMessage,
  type ExtensionHostProtocolRemoteSyncPlan,
  type ExtensionHostProtocolRemoteSyncPlanRequest,
  type ExtensionHostProtocolRemoteSyncResult,
  type ExtensionHostRemoteSyncCreatePlanRequestMessage,
  type ExtensionHostRemoteSyncExecutePlanRequestMessage,
  type ExtensionHostProtocolError,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import type { ExtensionHostProtocolTransport } from "./extensionHostProtocolSession";
import {
  defaultExtensionHostProtocolRequestTimer,
  readExtensionHostProtocolRequestTimeoutMs,
  type ExtensionHostProtocolRequestTimer
} from "./extensionHostProtocolRequestTimer";

export type ExtensionHostProtocolRuntimeRequestKind =
  | "aiProviderRegister"
  | "aiProviderUnregister"
  | "commandExecute"
  | "commandRegister"
  | "commandUnregister"
  | "contextKeySet"
  | "exportProviderRegister"
  | "exportProviderUnregister"
  | "markdownRendererRegister"
  | "markdownRendererUnregister"
  | "remoteSyncProviderRegister"
  | "remoteSyncProviderUnregister";

export interface ExtensionHostProtocolRuntimeOptions {
  readonly activate: ExtensionActivationHandler;
  readonly createRequestId?: (kind: ExtensionHostProtocolRuntimeRequestKind) => string;
  readonly onError?: (error: Error, message?: ExtensionHostProtocolMessage) => void;
  readonly requestTimer?: ExtensionHostProtocolRequestTimer;
  readonly requestTimeoutMs?: number;
}

interface PendingRuntimeRequest {
  readonly extensionId: string;
  timeout?: IDisposable;
  resolve(message: ExtensionHostProtocolMessage): void;
  reject(error: Error): void;
}

interface RuntimeExtensionRecord {
  readonly extension: RegisteredExtension;
  readonly context: ExtensionContext;
  readonly disposables: DisposableStore;
  readonly aiProviders: Map<string, AiProvider>;
  readonly commandHandlers: Map<string, RuntimeCommandRegistration>;
  readonly contextValues: Map<string, ContextKeyValue>;
  readonly exportProviders: Map<string, ExportProvider>;
  readonly markdownProviders: Map<string, RuntimeMarkdownRendererRegistration>;
  readonly remoteSyncProviders: Map<string, RemoteSyncProvider>;
}

interface RuntimeCommandRegistration {
  readonly metadata: CommandMetadata;
  readonly handler: ExtensionCommandHandler;
}

interface RuntimeMarkdownRendererRegistration {
  readonly provider: MarkdownRendererProvider;
  readonly metadata?: MarkdownRendererRuntimeMetadata;
}

export class ExtensionHostProtocolRuntime extends Disposable {
  private readonly pendingRequests = new Map<string, PendingRuntimeRequest>();
  private readonly extensions = new Map<string, RuntimeExtensionRecord>();
  private readonly requestTimer: ExtensionHostProtocolRequestTimer;
  private readonly requestTimeoutMs: number | undefined;
  private requestCounter = 0;
  private disposed = false;

  constructor(
    private readonly transport: ExtensionHostProtocolTransport,
    private readonly options: ExtensionHostProtocolRuntimeOptions
  ) {
    super();

    if (typeof options.activate !== "function") {
      throw new Error("Extension host protocol runtime must provide an activation handler");
    }

    this.requestTimer = options.requestTimer ?? defaultExtensionHostProtocolRequestTimer;
    this.requestTimeoutMs = readExtensionHostProtocolRequestTimeoutMs(
      options.requestTimeoutMs,
      "Extension host protocol runtime request timeout"
    );
    this.store.add(transport.onMessage((message) => {
      void this.handleIncomingMessage(message);
    }));
    this.store.add(toDisposable(() => this.rejectPendingRequests(
      new Error("Extension host protocol runtime disposed")
    )));
  }

  override dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;

    for (const record of this.extensions.values()) {
      record.disposables.dispose();
    }

    this.extensions.clear();
    super.dispose();
  }

  private async handleIncomingMessage(value: unknown): Promise<void> {
    let message: ExtensionHostProtocolMessage;

    try {
      message = readExtensionHostProtocolMessage(value);
    } catch (error) {
      this.reportError(toErrorLike(error));
      return;
    }

    const pending = this.pendingRequests.get(message.requestId);

    if (pending) {
      this.resolvePendingRequest(message, pending);
      return;
    }

    try {
      switch (message.type) {
        case extensionHostProtocolMessageTypes.handshakeRequest:
          await this.respondToHandshake(message);
          return;
        case extensionHostProtocolMessageTypes.activate:
          await this.activateExtension(message);
          return;
        case extensionHostProtocolMessageTypes.aiTextRequest:
          await this.requestRegisteredAiText(message);
          return;
        case extensionHostProtocolMessageTypes.commandExecute:
          await this.executeRegisteredCommand(message.requestId, message.extensionId, message.command, message.args);
          return;
        case extensionHostProtocolMessageTypes.commandList:
          await this.sendRuntimeApiResult(message.requestId, message.extensionId, this.getCommandMetadata(message.extensionId));
          return;
        case extensionHostProtocolMessageTypes.exportDocument:
          await this.exportRegisteredDocument(message);
          return;
        case extensionHostProtocolMessageTypes.markdownRendererRender:
          await this.renderRegisteredMarkdown(message);
          return;
        case extensionHostProtocolMessageTypes.remoteSyncCreatePlan:
          await this.createRegisteredRemoteSyncPlan(message);
          return;
        case extensionHostProtocolMessageTypes.remoteSyncExecutePlan:
          await this.executeRegisteredRemoteSyncPlan(message);
          return;
        default:
          this.reportError(
            new Error(`Extension host protocol runtime received unhandled message: ${message.type}`),
            message
          );
      }
    } catch (error) {
      this.reportError(toErrorLike(error), message);
    }
  }

  private async respondToHandshake(message: ExtensionHostHandshakeRequestMessage): Promise<void> {
    if (message.protocolVersion !== extensionHostProtocolVersion) {
      await this.sendRuntimeApiError(
        message.requestId,
        message.extensionId,
        new Error(
          `Unsupported extension host protocol version: expected ${extensionHostProtocolVersion}, got ${message.protocolVersion}`
        )
      );
      return;
    }

    await this.transport.send(createExtensionHostHandshakeResultMessage(message.requestId, message.extensionId));
  }

  private async activateExtension(message: ExtensionHostActivationRequestMessage): Promise<void> {
    const record = this.getOrCreateExtensionRecord(message.extension);
    const request: ExtensionActivationRequest = {
      activationEvent: message.activationEvent,
      context: record.context,
      extension: record.extension
    };

    try {
      await this.options.activate(request);
      await this.transport.send(createExtensionHostActivationResultMessage(message.requestId, message.extension.id));
    } catch (error) {
      this.disposeExtensionRecord(message.extension.id, record);
      await this.transport.send(createExtensionHostActivationErrorMessage(message.requestId, message.extension.id, error));
    }
  }

  private async requestRegisteredAiText(message: ExtensionHostAiTextRequestMessage): Promise<void> {
    try {
      const record = this.requireExtensionRecord(message.extensionId);
      const provider = record.aiProviders.get(message.providerId);

      if (!provider) {
        throw new Error(`No extension host runtime AI provider registered: ${message.providerId}`);
      }

      await this.transport.send(createExtensionHostAiTextResultMessage(
        message.requestId,
        message.extensionId,
        message.providerId,
        await provider.requestText(toRuntimeAiTextRequest(message.request))
      ));
    } catch (error) {
      await this.sendRuntimeApiError(message.requestId, message.extensionId, error);
    }
  }

  private async executeRegisteredCommand(
    requestId: string,
    extensionId: string,
    command: string,
    args: readonly unknown[]
  ): Promise<void> {
    try {
      const record = this.requireExtensionRecord(extensionId);
      const registration = record.commandHandlers.get(command);

      if (!registration) {
        throw new Error(`No extension host runtime command registered: ${command}`);
      }

      await this.sendRuntimeApiResult(requestId, extensionId, await registration.handler(...args));
    } catch (error) {
      await this.sendRuntimeApiError(requestId, extensionId, error);
    }
  }

  private async exportRegisteredDocument(message: Extract<ExtensionHostProtocolMessage, {
    readonly type: typeof extensionHostProtocolMessageTypes.exportDocument;
  }>): Promise<void> {
    try {
      const record = this.requireExtensionRecord(message.extensionId);
      const provider = record.exportProviders.get(message.format);

      if (!provider) {
        throw new Error(`No extension host runtime export provider registered: ${message.format}`);
      }

      await this.transport.send(createExtensionHostExportDocumentResultMessage(
        message.requestId,
        message.extensionId,
        await provider.exportDocument({
          uri: URI.parse(message.input.uri),
          name: message.input.name,
          value: message.input.value,
          ...(message.input.assetMode ? { assetMode: message.input.assetMode } : {})
        })
      ));
    } catch (error) {
      await this.sendRuntimeApiError(message.requestId, message.extensionId, error);
    }
  }

  private async renderRegisteredMarkdown(message: Extract<ExtensionHostProtocolMessage, {
    readonly type: typeof extensionHostProtocolMessageTypes.markdownRendererRender;
  }>): Promise<void> {
    try {
      const record = this.requireExtensionRecord(message.extensionId);
      const registration = record.markdownProviders.get(message.rendererId);

      if (!registration) {
        throw new Error(`No extension host runtime Markdown renderer registered: ${message.rendererId}`);
      }

      await this.transport.send(createExtensionHostMarkdownRendererRenderResultMessage(
        message.requestId,
        message.extensionId,
        message.rendererId,
        await registration.provider.render({
          value: message.input.value,
          ...(message.input.language ? { language: message.input.language } : {}),
          ...(message.input.uri ? { uri: URI.parse(message.input.uri) } : {})
        })
      ));
    } catch (error) {
      await this.sendRuntimeApiError(message.requestId, message.extensionId, error);
    }
  }

  private async createRegisteredRemoteSyncPlan(message: ExtensionHostRemoteSyncCreatePlanRequestMessage): Promise<void> {
    try {
      const record = this.requireExtensionRecord(message.extensionId);
      const provider = record.remoteSyncProviders.get(message.providerId);

      if (!provider) {
        throw new Error(`No extension host runtime remote sync provider registered: ${message.providerId}`);
      }

      await this.transport.send(createExtensionHostRemoteSyncCreatePlanResultMessage(
        message.requestId,
        message.extensionId,
        message.providerId,
        toProtocolRemoteSyncPlan(await provider.createPlan(toRuntimeRemoteSyncPlanRequest(message.request)))
      ));
    } catch (error) {
      await this.sendRuntimeApiError(message.requestId, message.extensionId, error);
    }
  }

  private async executeRegisteredRemoteSyncPlan(
    message: ExtensionHostRemoteSyncExecutePlanRequestMessage
  ): Promise<void> {
    try {
      const record = this.requireExtensionRecord(message.extensionId);
      const provider = record.remoteSyncProviders.get(message.providerId);

      if (!provider) {
        throw new Error(`No extension host runtime remote sync provider registered: ${message.providerId}`);
      }

      await this.transport.send(createExtensionHostRemoteSyncExecutePlanResultMessage(
        message.requestId,
        message.extensionId,
        message.providerId,
        toProtocolRemoteSyncResult(await provider.executePlan(
          toRuntimeRemoteSyncPlan(message.plan),
          toRuntimeRemoteSyncPlanRequest(message.request)
        ))
      ));
    } catch (error) {
      await this.sendRuntimeApiError(message.requestId, message.extensionId, error);
    }
  }

  private createContext(record: Omit<RuntimeExtensionRecord, "context">): ExtensionContext {
    return {
      extension: record.extension,
      subscriptions: {
        add: (disposable) => record.disposables.add(disposable)
      },
      commands: {
        registerCommand: (command, handler, metadata) =>
          this.registerCommand(record, command, handler, metadata),
        executeCommand: async <T = unknown>(command: string, ...args: unknown[]) =>
          await this.executeMainCommand<T>(record.extension.id, command, args),
        getCommands: () => [...record.commandHandlers.values()].map((registration) => registration.metadata)
      },
      contextKeys: {
        setValue: (key, value) => {
          this.setContextKey(record, key, value);
        },
        getValue: (key) => record.contextValues.get(key)
      },
      ai: {
        registerProvider: (provider) => this.registerAiProvider(record, provider),
        getProviders: () => [...record.aiProviders.values()]
          .map((provider) => ({ id: provider.id, title: provider.title }))
          .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id))
      },
      exports: {
        registerProvider: (provider) => this.registerExportProvider(record, provider),
        getProviders: () => [...record.exportProviders.values()]
      },
      markdown: {
        registerRendererProvider: (provider, metadata) => this.registerMarkdownRendererProvider(record, provider, metadata),
        getRenderers: () => getRegisteredMarkdownRenderers(record.markdownProviders)
      },
      remoteSync: {
        registerProvider: (provider) => this.registerRemoteSyncProvider(record, provider),
        getProviders: () => [...record.remoteSyncProviders.values()]
          .map((provider) => ({ id: provider.id, title: provider.title }))
          .sort((first, second) => first.title.localeCompare(second.title) || first.id.localeCompare(second.id))
      }
    };
  }

  private registerCommand(
    record: Omit<RuntimeExtensionRecord, "context">,
    command: string,
    handler: ExtensionCommandHandler,
    metadata: ExtensionRuntimeCommandMetadata = {}
  ): IDisposable {
    const request = createExtensionHostCommandRegisterRequestMessage(this.nextRequestId("commandRegister"), record.extension.id, {
      id: command,
      ...(metadata.title ? { title: metadata.title } : {}),
      ...(metadata.category ? { category: metadata.category } : {})
    });
    const commandId = request.command.id;

    if (record.commandHandlers.has(commandId)) {
      throw new Error(`Extension host runtime command already registered: ${commandId}`);
    }

    if (!request.command.title) {
      throw new Error(`Extension host runtime command title must be provided: ${commandId}`);
    }

    record.commandHandlers.set(commandId, {
      metadata: {
        id: commandId,
        title: request.command.title,
        ...(request.command.category ? { category: request.command.category } : {})
      },
      handler
    });
    this.sendAndReport(request);

    return record.disposables.add(toDisposable(() => {
      if (!record.commandHandlers.delete(commandId)) {
        return;
      }

      this.sendAndReport(createExtensionHostCommandUnregisterRequestMessage(
        this.nextRequestId("commandUnregister"),
        record.extension.id,
        commandId
      ));
    }));
  }

  private registerAiProvider(
    record: Omit<RuntimeExtensionRecord, "context">,
    provider: AiProvider
  ): IDisposable {
    const request = createExtensionHostAiProviderRegisterRequestMessage(
      this.nextRequestId("aiProviderRegister"),
      record.extension.id,
      provider
    );
    const providerId = request.provider.id;

    if (record.aiProviders.has(providerId)) {
      throw new Error(`Extension host runtime AI provider already registered: ${providerId}`);
    }

    const normalizedProvider = {
      ...provider,
      id: providerId,
      title: request.provider.title
    };
    record.aiProviders.set(providerId, normalizedProvider);
    this.sendAndReport(request);

    return record.disposables.add(toDisposable(() => {
      if (!record.aiProviders.delete(providerId)) {
        return;
      }

      this.sendAndReport(createExtensionHostAiProviderUnregisterRequestMessage(
        this.nextRequestId("aiProviderUnregister"),
        record.extension.id,
        providerId
      ));
    }));
  }

  private async executeMainCommand<T>(
    extensionId: string,
    command: string,
    args: readonly unknown[]
  ): Promise<T> {
    const response = await this.sendRequest(createExtensionHostCommandExecuteRequestMessage(
      this.nextRequestId("commandExecute"),
      extensionId,
      command,
      args
    ));

    return readApiResponseValue(response, extensionId) as T;
  }

  private setContextKey(
    record: Omit<RuntimeExtensionRecord, "context">,
    key: string,
    value: ContextKeyValue | undefined
  ): void {
    const request = createExtensionHostContextKeySetRequestMessage(
      this.nextRequestId("contextKeySet"),
      record.extension.id,
      key,
      value
    );

    if (value === undefined) {
      record.contextValues.delete(request.key);
    } else {
      record.contextValues.set(request.key, value);
    }

    this.sendAndReport(request);
  }

  private registerExportProvider(
    record: Omit<RuntimeExtensionRecord, "context">,
    provider: ExportProvider
  ): IDisposable {
    const request = createExtensionHostExportProviderRegisterRequestMessage(
      this.nextRequestId("exportProviderRegister"),
      record.extension.id,
      provider
    );
    const format = request.provider.format;

    if (record.exportProviders.has(format)) {
      throw new Error(`Extension host runtime export provider already registered: ${format}`);
    }

    const normalizedProvider = {
      ...provider,
      format,
      title: request.provider.title
    };
    record.exportProviders.set(format, normalizedProvider);
    this.sendAndReport(request);

    return record.disposables.add(toDisposable(() => {
      if (!record.exportProviders.delete(format)) {
        return;
      }

      this.sendAndReport(createExtensionHostExportProviderUnregisterRequestMessage(
        this.nextRequestId("exportProviderUnregister"),
        record.extension.id,
        format
      ));
    }));
  }

  private registerMarkdownRendererProvider(
    record: Omit<RuntimeExtensionRecord, "context">,
    provider: MarkdownRendererProvider,
    metadata?: MarkdownRendererRuntimeMetadata
  ): IDisposable {
    const request = createExtensionHostMarkdownRendererRegisterRequestMessage(
      this.nextRequestId("markdownRendererRegister"),
      record.extension.id,
      {
        id: provider.id,
        ...(metadata ? { metadata } : {})
      }
    );
    const rendererId = request.renderer.id;

    if (record.markdownProviders.has(rendererId)) {
      throw new Error(`Extension host runtime Markdown renderer already registered: ${rendererId}`);
    }

    record.markdownProviders.set(rendererId, {
      provider: {
        ...provider,
        id: rendererId
      },
      ...(request.renderer.metadata ? { metadata: request.renderer.metadata } : {})
    });
    this.sendAndReport(request);

    return record.disposables.add(toDisposable(() => {
      if (!record.markdownProviders.delete(rendererId)) {
        return;
      }

      this.sendAndReport(createExtensionHostMarkdownRendererUnregisterRequestMessage(
        this.nextRequestId("markdownRendererUnregister"),
        record.extension.id,
        rendererId
      ));
    }));
  }

  private registerRemoteSyncProvider(
    record: Omit<RuntimeExtensionRecord, "context">,
    provider: RemoteSyncProvider
  ): IDisposable {
    const request = createExtensionHostRemoteSyncProviderRegisterRequestMessage(
      this.nextRequestId("remoteSyncProviderRegister"),
      record.extension.id,
      provider
    );
    const providerId = request.provider.id;

    if (record.remoteSyncProviders.has(providerId)) {
      throw new Error(`Extension host runtime remote sync provider already registered: ${providerId}`);
    }

    const normalizedProvider = {
      ...provider,
      id: providerId,
      title: request.provider.title
    };
    record.remoteSyncProviders.set(providerId, normalizedProvider);
    this.sendAndReport(request);

    return record.disposables.add(toDisposable(() => {
      if (!record.remoteSyncProviders.delete(providerId)) {
        return;
      }

      this.sendAndReport(createExtensionHostRemoteSyncProviderUnregisterRequestMessage(
        this.nextRequestId("remoteSyncProviderUnregister"),
        record.extension.id,
        providerId
      ));
    }));
  }

  private getOrCreateExtensionRecord(extension: RegisteredExtension): RuntimeExtensionRecord {
    const existing = this.extensions.get(extension.id);

    if (existing) {
      return existing;
    }

    const partialRecord: Omit<RuntimeExtensionRecord, "context"> = {
      extension,
      disposables: new DisposableStore(),
      aiProviders: new Map(),
      commandHandlers: new Map(),
      contextValues: new Map(),
      exportProviders: new Map(),
      markdownProviders: new Map(),
      remoteSyncProviders: new Map()
    };
    const record: RuntimeExtensionRecord = {
      ...partialRecord,
      context: this.createContext(partialRecord)
    };
    this.extensions.set(extension.id, record);
    return record;
  }

  private requireExtensionRecord(extensionId: string): RuntimeExtensionRecord {
    const record = this.extensions.get(extensionId);

    if (!record) {
      throw new Error(`No extension host protocol runtime activated: ${extensionId}`);
    }

    return record;
  }

  private disposeExtensionRecord(extensionId: string, expectedRecord: RuntimeExtensionRecord): void {
    const record = this.extensions.get(extensionId);

    if (record !== expectedRecord) {
      return;
    }

    this.extensions.delete(extensionId);
    record.disposables.dispose();
  }

  private async sendRequest(message: ExtensionHostProtocolMessage): Promise<ExtensionHostProtocolMessage> {
    const normalizedMessage = readExtensionHostProtocolMessage(message);
    const requestId = normalizedMessage.requestId;

    if (this.disposed) {
      throw new Error("Extension host protocol runtime is disposed");
    }

    if (this.pendingRequests.has(requestId)) {
      throw new Error(`Extension host protocol runtime request id is already pending: ${requestId}`);
    }

    return await new Promise<ExtensionHostProtocolMessage>((resolve, reject) => {
      const pending: PendingRuntimeRequest = {
        extensionId: getMessageExtensionId(normalizedMessage),
        resolve,
        reject
      };

      this.pendingRequests.set(requestId, pending);

      try {
        this.armPendingRequestTimeout(requestId, pending);
        Promise.resolve(this.transport.send(normalizedMessage)).catch((error: unknown) => {
          if (!this.deletePendingRequest(requestId, pending)) {
            return;
          }

          reject(toErrorLike(error));
        });
      } catch (error) {
        this.deletePendingRequest(requestId, pending);
        reject(toErrorLike(error));
      }
    });
  }

  private sendAndReport(message: ExtensionHostProtocolMessage): void {
    void this.sendRequest(message)
      .then((response) => {
        readApiResponseValue(response, getMessageExtensionId(message));
      })
      .catch((error: unknown) => {
        this.reportError(toErrorLike(error), message);
      });
  }

  private resolvePendingRequest(message: ExtensionHostProtocolMessage, pending: PendingRuntimeRequest): void {
    this.deletePendingRequest(message.requestId, pending);

    try {
      assertResponseIdentity(message, message.requestId, pending.extensionId);
      pending.resolve(message);
    } catch (error) {
      pending.reject(toErrorLike(error));
    }
  }

  private armPendingRequestTimeout(requestId: string, pending: PendingRuntimeRequest): void {
    if (this.requestTimeoutMs === undefined) {
      return;
    }

    pending.timeout = this.requestTimer.schedule(() => {
      if (!this.deletePendingRequest(requestId, pending)) {
        return;
      }

      pending.reject(new Error(
        `Extension host protocol runtime request timed out after ${this.requestTimeoutMs}ms: ${requestId} (${pending.extensionId})`
      ));
    }, this.requestTimeoutMs);
  }

  private deletePendingRequest(requestId: string, pending: PendingRuntimeRequest): boolean {
    if (this.pendingRequests.get(requestId) !== pending) {
      return false;
    }

    this.pendingRequests.delete(requestId);
    pending.timeout?.dispose();
    return true;
  }

  private async sendRuntimeApiResult(requestId: string, extensionId: string, value?: unknown): Promise<void> {
    await this.transport.send(createExtensionHostApiResultMessage(requestId, extensionId, value));
  }

  private async sendRuntimeApiError(requestId: string, extensionId: string, error: unknown): Promise<void> {
    await this.transport.send(createExtensionHostApiErrorMessage(requestId, extensionId, error));
  }

  private getCommandMetadata(extensionId: string): readonly CommandMetadata[] {
    return [...this.requireExtensionRecord(extensionId).commandHandlers.values()].map((registration) => registration.metadata);
  }

  private nextRequestId(kind: ExtensionHostProtocolRuntimeRequestKind): string {
    return this.options.createRequestId?.(kind) ?? `extension-runtime-${kind}-${++this.requestCounter}`;
  }

  private rejectPendingRequests(error: Error): void {
    const pendingRequests = [...this.pendingRequests.values()];
    this.pendingRequests.clear();

    for (const pending of pendingRequests) {
      pending.timeout?.dispose();
      pending.reject(error);
    }
  }

  private reportError(error: Error, message?: ExtensionHostProtocolMessage): void {
    this.options.onError?.(error, message);
  }
}

function readApiResponseValue(message: ExtensionHostProtocolMessage, extensionId: string): unknown {
  assertResponseIdentity(message, message.requestId, extensionId);

  switch (message.type) {
    case extensionHostProtocolMessageTypes.apiResult:
      return (message as ExtensionHostApiResultMessage).value;
    case extensionHostProtocolMessageTypes.apiError:
      throw toError((message as ExtensionHostApiErrorMessage).error);
    default:
      throw new Error(`Expected extension host API response but received: ${message.type}`);
  }
}

function getRegisteredMarkdownRenderers(
  providers: ReadonlyMap<string, RuntimeMarkdownRendererRegistration>
): readonly RegisteredMarkdownRenderer[] {
  return [...providers.entries()]
    .flatMap(([id, registration]) => registration.metadata ? [{
      id,
      hasProvider: true,
      ...registration.metadata
    }] : [])
    .sort((first, second) =>
      (second.priority ?? 0) - (first.priority ?? 0) ||
      first.label.localeCompare(second.label) ||
      first.id.localeCompare(second.id)
    );
}

function toRuntimeAiTextRequest(request: Omit<AiTextRequest, "signal" | "context"> & {
  readonly context?: readonly { readonly kind: string; readonly value: string; readonly title?: string; readonly uri?: string }[];
}): AiTextRequest {
  return {
    instruction: request.instruction,
    input: request.input,
    ...(request.context ? {
      context: request.context.map((item) => ({
        kind: item.kind,
        value: item.value,
        ...(item.title ? { title: item.title } : {}),
        ...(item.uri ? { uri: URI.parse(item.uri) } : {})
      }))
    } : {}),
    ...(request.metadata ? { metadata: request.metadata } : {})
  };
}

function toRuntimeRemoteSyncPlanRequest(
  request: ExtensionHostProtocolRemoteSyncPlanRequest
): RemoteSyncPlanRequest {
  return {
    workspaceUri: URI.parse(request.workspaceUri),
    resources: request.resources.map((resource) => ({
      uri: URI.parse(resource.uri),
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

function toProtocolRemoteSyncResult(result: RemoteSyncResult): ExtensionHostProtocolRemoteSyncResult {
  return {
    operations: toProtocolRemoteSyncPlan(result).operations,
    summary: result.summary,
    ...(result.completedAt !== undefined ? { completedAt: result.completedAt } : {})
  };
}

function getMessageExtensionId(message: ExtensionHostProtocolMessage): string {
  return message.type === extensionHostProtocolMessageTypes.activate
    ? message.extension.id
    : message.extensionId;
}

function assertResponseIdentity(
  message: ExtensionHostProtocolMessage,
  requestId: string,
  extensionId: string
): void {
  if (message.requestId !== requestId) {
    throw new Error(`Extension host protocol runtime response request id mismatch: expected ${requestId}`);
  }

  if (getMessageExtensionId(message) !== extensionId) {
    throw new Error(`Extension host protocol runtime response extension id mismatch: expected ${extensionId}`);
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

function toErrorLike(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
