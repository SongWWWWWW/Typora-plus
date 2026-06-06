import { Disposable, type IDisposable } from "@typora-plus/base";
import type { ExtensionContext } from "./extensions";
import {
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostExportDocumentRequestMessage,
  createExtensionHostMarkdownRendererRenderRequestMessage,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostApiErrorMessage,
  type ExtensionHostApiResultMessage,
  type ExtensionHostExportDocumentResultMessage,
  type ExtensionHostMarkdownRendererRenderResultMessage,
  type ExtensionHostProtocolError,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";

export type ExtensionHostRuntimeBrokerRequestKind =
  | "commandExecute"
  | "exportDocument"
  | "markdownRendererRender";

export type ExtensionHostRuntimeBrokerRequestHandler =
  (message: ExtensionHostProtocolMessage) => Promise<unknown> | unknown;

export type ExtensionHostRuntimeBrokerResponse =
  | ExtensionHostApiErrorMessage
  | ExtensionHostApiResultMessage;

export interface ExtensionHostRuntimeBrokerOptions {
  readonly request: ExtensionHostRuntimeBrokerRequestHandler;
  readonly createRequestId?: (kind: ExtensionHostRuntimeBrokerRequestKind) => string;
}

export class ExtensionHostRuntimeBroker extends Disposable {
  private readonly commandDisposables = new Map<string, IDisposable>();
  private readonly exportProviderDisposables = new Map<string, IDisposable>();
  private readonly markdownRendererDisposables = new Map<string, IDisposable>();
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
        default:
          throw new Error(`Extension host runtime broker cannot handle message type: ${message.type}`);
      }
    } catch (error) {
      return createExtensionHostApiErrorMessage(request?.requestId ?? this.nextRequestId("commandExecute"), this.context.extension.id, error);
    }
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

  private addRuntimeDisposable(disposable: IDisposable): void {
    this.store.add(disposable);
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
    this.commandDisposables.clear();
    this.exportProviderDisposables.clear();
    this.markdownRendererDisposables.clear();
    super.dispose();
  }
}

function getRuntimeRequestInfo(
  message: ExtensionHostProtocolMessage
): { readonly requestId: string; readonly extensionId: string } | undefined {
  switch (message.type) {
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
      return {
        requestId: message.requestId,
        extensionId: message.extensionId
      };
    default:
      return undefined;
  }
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
