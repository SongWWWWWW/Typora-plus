import { Disposable, toDisposable, type Event } from "@typora-plus/base";
import type { ExtensionActivationRequest, ExtensionContext } from "./extensions";
import {
  createExtensionHostActivationRequestMessage,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  type ExtensionHostActivationErrorMessage,
  type ExtensionHostProtocolError,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import {
  ExtensionHostRuntimeBroker,
  type ExtensionHostRuntimeBrokerRequestKind
} from "./extensionHostRuntimeBroker";

export type ExtensionHostProtocolSessionRequestKind =
  | "activate"
  | ExtensionHostRuntimeBrokerRequestKind;

export interface ExtensionHostProtocolTransport {
  readonly onMessage: Event<unknown>;
  send(message: ExtensionHostProtocolMessage): void | Promise<void>;
}

export interface ExtensionHostProtocolSessionOptions {
  readonly createRequestId?: (kind: ExtensionHostProtocolSessionRequestKind) => string;
  readonly onError?: (error: Error, message?: ExtensionHostProtocolMessage) => void;
}

interface PendingProtocolRequest {
  readonly extensionId: string;
  resolve(message: ExtensionHostProtocolMessage): void;
  reject(error: Error): void;
}

export class ExtensionHostProtocolSession extends Disposable {
  private readonly broker: ExtensionHostRuntimeBroker;
  private readonly pendingRequests = new Map<string, PendingProtocolRequest>();
  private requestCounter = 0;
  private disposed = false;

  constructor(
    private readonly transport: ExtensionHostProtocolTransport,
    private readonly context: ExtensionContext,
    private readonly options: ExtensionHostProtocolSessionOptions = {}
  ) {
    super();

    this.broker = this.store.add(new ExtensionHostRuntimeBroker(context, {
      createRequestId: (kind) => this.nextRequestId(kind),
      request: (message) => this.sendRequest(message)
    }));
    this.store.add(transport.onMessage((message) => {
      void this.handleIncomingMessage(message);
    }));
    this.store.add(toDisposable(() => this.rejectPendingRequests(
      new Error(`Extension host protocol session disposed: ${context.extension.id}`)
    )));
  }

  async activate(request: ExtensionActivationRequest): Promise<void> {
    if (request.extension.id !== this.context.extension.id) {
      throw new Error(
        `Extension host activation request extension mismatch: expected ${this.context.extension.id}, got ${request.extension.id}`
      );
    }

    const requestId = this.nextRequestId("activate");
    const response = await this.sendRequest(createExtensionHostActivationRequestMessage(request, requestId));

    assertResponseIdentity(response, requestId, this.context.extension.id);

    switch (response.type) {
      case extensionHostProtocolMessageTypes.activationResult:
        return;
      case extensionHostProtocolMessageTypes.activationError:
        throw toError((response as ExtensionHostActivationErrorMessage).error);
      default:
        throw new Error(`Expected extension host activation response but received: ${response.type}`);
    }
  }

  override dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
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

    if (!isRuntimeBrokerRequest(message)) {
      this.reportError(
        new Error(`Extension host protocol session received unhandled message: ${message.type}`),
        message
      );
      return;
    }

    try {
      await this.transport.send(await this.broker.handleMessage(message));
    } catch (error) {
      this.reportError(toErrorLike(error), message);
    }
  }

  private resolvePendingRequest(message: ExtensionHostProtocolMessage, pending: PendingProtocolRequest): void {
    this.pendingRequests.delete(message.requestId);

    try {
      assertResponseIdentity(message, message.requestId, pending.extensionId);
      pending.resolve(message);
    } catch (error) {
      pending.reject(toErrorLike(error));
    }
  }

  private async sendRequest(message: ExtensionHostProtocolMessage): Promise<ExtensionHostProtocolMessage> {
    if (this.disposed) {
      throw new Error(`Extension host protocol session is disposed: ${this.context.extension.id}`);
    }

    const normalizedMessage = readExtensionHostProtocolMessage(message);
    const requestId = normalizedMessage.requestId;

    if (this.pendingRequests.has(requestId)) {
      throw new Error(`Extension host protocol request id is already pending: ${requestId}`);
    }

    return await new Promise<ExtensionHostProtocolMessage>((resolve, reject) => {
      this.pendingRequests.set(requestId, {
        extensionId: getMessageExtensionId(normalizedMessage),
        resolve,
        reject
      });

      Promise.resolve(this.transport.send(normalizedMessage)).catch((error: unknown) => {
        this.pendingRequests.delete(requestId);
        reject(toErrorLike(error));
      });
    });
  }

  private nextRequestId(kind: ExtensionHostProtocolSessionRequestKind): string {
    return this.options.createRequestId?.(kind) ?? `extension-host-${kind}-${++this.requestCounter}`;
  }

  private rejectPendingRequests(error: Error): void {
    const pendingRequests = [...this.pendingRequests.values()];
    this.pendingRequests.clear();

    for (const pending of pendingRequests) {
      pending.reject(error);
    }
  }

  private reportError(error: Error, message?: ExtensionHostProtocolMessage): void {
    this.options.onError?.(error, message);
  }
}

function isRuntimeBrokerRequest(message: ExtensionHostProtocolMessage): boolean {
  switch (message.type) {
    case extensionHostProtocolMessageTypes.commandRegister:
    case extensionHostProtocolMessageTypes.commandExecute:
    case extensionHostProtocolMessageTypes.commandList:
    case extensionHostProtocolMessageTypes.contextKeySet:
    case extensionHostProtocolMessageTypes.contextKeyGet:
    case extensionHostProtocolMessageTypes.exportProviderRegister:
    case extensionHostProtocolMessageTypes.markdownRendererRegister:
      return true;
    default:
      return false;
  }
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
    throw new Error(`Extension host protocol response request id mismatch: expected ${requestId}`);
  }

  if (getMessageExtensionId(message) !== extensionId) {
    throw new Error(`Extension host protocol response extension id mismatch: expected ${extensionId}`);
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
