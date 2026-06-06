import { Disposable, Emitter, type Event } from "@typora-plus/base";
import {
  deserializeExtensionHostProtocolMessage,
  serializeExtensionHostProtocolMessage,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import type { ExtensionHostProtocolTransport } from "./extensionHostProtocolSession";

export interface ExtensionHostProtocolWireChannel {
  readonly onMessage: Event<unknown>;
  send(raw: string): void | Promise<void>;
}

export interface ExtensionHostProtocolWireTransportOptions {
  readonly label?: string;
  readonly maxMessageLength?: number;
  readonly onError?: (error: Error, raw?: unknown) => void;
}

export class ExtensionHostProtocolWireTransport extends Disposable implements ExtensionHostProtocolTransport {
  private readonly onMessageEmitter = this.store.add(new Emitter<unknown>());
  private readonly label: string;
  private readonly maxMessageLength: number | undefined;
  private disposed = false;

  readonly onMessage: Event<unknown> = this.onMessageEmitter.event;

  constructor(
    private readonly channel: ExtensionHostProtocolWireChannel,
    private readonly options: ExtensionHostProtocolWireTransportOptions = {}
  ) {
    super();

    this.label = readWireTransportLabel(options.label);
    this.maxMessageLength = readWireTransportMaxMessageLength(options.maxMessageLength);
    this.store.add(channel.onMessage((raw) => {
      this.receiveRaw(raw);
    }));
  }

  async send(message: ExtensionHostProtocolMessage): Promise<void> {
    if (this.disposed) {
      throw new Error(`Extension host protocol wire transport is disposed: ${this.label}`);
    }

    const raw = serializeExtensionHostProtocolMessage(message);
    this.assertMessageLength(raw);
    await this.channel.send(raw);
  }

  override dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    super.dispose();
  }

  private receiveRaw(raw: unknown): void {
    if (this.disposed) {
      return;
    }

    if (typeof raw !== "string") {
      this.reportError(new Error(
        `Extension host protocol wire transport received non-string message: ${this.label}`
      ), raw);
      return;
    }

    try {
      this.assertMessageLength(raw);
      this.onMessageEmitter.fire(deserializeExtensionHostProtocolMessage(raw));
    } catch (error) {
      this.reportError(toErrorLike(error), raw);
    }
  }

  private assertMessageLength(raw: string): void {
    if (this.maxMessageLength === undefined || raw.length <= this.maxMessageLength) {
      return;
    }

    throw new Error(
      `Extension host protocol wire transport message exceeded max length for ${this.label}: ${raw.length} > ${this.maxMessageLength}`
    );
  }

  private reportError(error: Error, raw?: unknown): void {
    this.options.onError?.(error, raw);
  }
}

function readWireTransportLabel(value: string | undefined): string {
  if (value === undefined) {
    return "extension-host-wire";
  }

  if (typeof value !== "string") {
    throw new Error("Extension host protocol wire transport label must be a string");
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Extension host protocol wire transport label must not be empty");
  }

  return normalized;
}

function readWireTransportMaxMessageLength(value: number | undefined): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error("Extension host protocol wire transport max message length must be a non-negative finite number");
  }

  return value > 0 ? value : undefined;
}

function toErrorLike(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
