import { Disposable, toDisposable, type Event, type IDisposable } from "@typora-plus/base";
import type { ExtensionActivationRequest, ExtensionContext } from "./extensions";
import {
  createExtensionHostActivationRequestMessage,
  createExtensionHostHandshakeRequestMessage,
  extensionHostProtocolMessageTypes,
  extensionHostProtocolVersion,
  requiredExtensionHostProtocolCapabilities,
  readExtensionHostProtocolMessage,
  type ExtensionHostActivationErrorMessage,
  type ExtensionHostApiErrorMessage,
  type ExtensionHostHandshakeResultMessage,
  type ExtensionHostProtocolError,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import {
  ExtensionHostRuntimeBroker,
  type ExtensionHostRuntimeBrokerRequestKind
} from "./extensionHostRuntimeBroker";
import {
  defaultExtensionHostProtocolRequestTimer,
  readExtensionHostProtocolRequestTimeoutMs,
  type ExtensionHostProtocolRequestTimer
} from "./extensionHostProtocolRequestTimer";

export type ExtensionHostProtocolSessionRequestKind =
  | "activate"
  | "handshake"
  | ExtensionHostRuntimeBrokerRequestKind;

export interface ExtensionHostProtocolTransport {
  readonly onMessage: Event<unknown>;
  send(message: ExtensionHostProtocolMessage): void | Promise<void>;
}

export interface ExtensionHostProtocolSessionOptions {
  readonly createRequestId?: (kind: ExtensionHostProtocolSessionRequestKind) => string;
  readonly onError?: (error: Error, message?: ExtensionHostProtocolMessage) => void;
  readonly requireHandshake?: boolean;
  readonly requestTimer?: ExtensionHostProtocolRequestTimer;
  readonly requestTimeoutMs?: number;
}

interface PendingProtocolRequest {
  readonly extensionId: string;
  timeout?: IDisposable;
  resolve(message: ExtensionHostProtocolMessage): void;
  reject(error: Error): void;
}

export class ExtensionHostProtocolSession extends Disposable {
  private readonly broker: ExtensionHostRuntimeBroker;
  private readonly pendingRequests = new Map<string, PendingProtocolRequest>();
  private readonly requestTimer: ExtensionHostProtocolRequestTimer;
  private readonly requestTimeoutMs: number | undefined;
  private handshakePromise: Promise<ExtensionHostHandshakeResultMessage> | undefined;
  private requestCounter = 0;
  private disposed = false;

  constructor(
    private readonly transport: ExtensionHostProtocolTransport,
    private readonly context: ExtensionContext,
    private readonly options: ExtensionHostProtocolSessionOptions = {}
  ) {
    super();

    this.requestTimer = options.requestTimer ?? defaultExtensionHostProtocolRequestTimer;
    this.requestTimeoutMs = readExtensionHostProtocolRequestTimeoutMs(
      options.requestTimeoutMs,
      "Extension host protocol session request timeout"
    );
    this.broker = this.store.add(new ExtensionHostRuntimeBroker(context, {
      createRequestId: (kind) => this.nextRequestId(kind),
      notify: (message) => this.sendNotification(message),
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

    if (this.options.requireHandshake) {
      await this.handshake();
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

  async handshake(): Promise<ExtensionHostHandshakeResultMessage> {
    if (!this.handshakePromise) {
      this.handshakePromise = this.performHandshake().catch((error: unknown) => {
        this.handshakePromise = undefined;
        throw error;
      });
    }

    return await this.handshakePromise;
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
    this.deletePendingRequest(message.requestId, pending);

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
      const pending: PendingProtocolRequest = {
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

  private async sendNotification(message: ExtensionHostProtocolMessage): Promise<void> {
    if (this.disposed) {
      return;
    }

    await this.transport.send(readExtensionHostProtocolMessage(message));
  }

  private async performHandshake(): Promise<ExtensionHostHandshakeResultMessage> {
    const requestId = this.nextRequestId("handshake");
    const response = await this.sendRequest(createExtensionHostHandshakeRequestMessage(
      requestId,
      this.context.extension.id
    ));

    assertResponseIdentity(response, requestId, this.context.extension.id);

    switch (response.type) {
      case extensionHostProtocolMessageTypes.handshakeResult:
        return this.readHandshakeResult(response);
      case extensionHostProtocolMessageTypes.apiError:
        throw toError((response as ExtensionHostApiErrorMessage).error);
      default:
        throw new Error(`Expected extension host handshake response but received: ${response.type}`);
    }
  }

  private readHandshakeResult(message: ExtensionHostHandshakeResultMessage): ExtensionHostHandshakeResultMessage {
    if (message.protocolVersion !== extensionHostProtocolVersion) {
      throw new Error(
        `Extension host protocol version mismatch: expected ${extensionHostProtocolVersion}, got ${message.protocolVersion}`
      );
    }

    for (const capability of requiredExtensionHostProtocolCapabilities) {
      if (!message.capabilities.includes(capability)) {
        throw new Error(`Extension host protocol missing required capability: ${capability}`);
      }
    }

    return message;
  }

  private armPendingRequestTimeout(requestId: string, pending: PendingProtocolRequest): void {
    if (this.requestTimeoutMs === undefined) {
      return;
    }

    pending.timeout = this.requestTimer.schedule(() => {
      if (!this.deletePendingRequest(requestId, pending)) {
        return;
      }

      pending.reject(new Error(
        `Extension host protocol session request timed out after ${this.requestTimeoutMs}ms: ${requestId} (${pending.extensionId})`
      ));
    }, this.requestTimeoutMs);
  }

  private deletePendingRequest(requestId: string, pending: PendingProtocolRequest): boolean {
    if (this.pendingRequests.get(requestId) !== pending) {
      return false;
    }

    this.pendingRequests.delete(requestId);
    pending.timeout?.dispose();
    return true;
  }

  private nextRequestId(kind: ExtensionHostProtocolSessionRequestKind): string {
    return this.options.createRequestId?.(kind) ?? `extension-host-${kind}-${++this.requestCounter}`;
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

function isRuntimeBrokerRequest(message: ExtensionHostProtocolMessage): boolean {
  switch (message.type) {
    case extensionHostProtocolMessageTypes.aiProviderRegister:
    case extensionHostProtocolMessageTypes.aiProviderUnregister:
    case extensionHostProtocolMessageTypes.commandRegister:
    case extensionHostProtocolMessageTypes.commandExecute:
    case extensionHostProtocolMessageTypes.commandList:
    case extensionHostProtocolMessageTypes.commandUnregister:
    case extensionHostProtocolMessageTypes.contextKeySet:
    case extensionHostProtocolMessageTypes.contextKeyGet:
    case extensionHostProtocolMessageTypes.exportProviderRegister:
    case extensionHostProtocolMessageTypes.exportProviderUnregister:
    case extensionHostProtocolMessageTypes.markdownRendererRegister:
    case extensionHostProtocolMessageTypes.markdownRendererUnregister:
    case extensionHostProtocolMessageTypes.remoteSyncProviderRegister:
    case extensionHostProtocolMessageTypes.remoteSyncProviderUnregister:
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
