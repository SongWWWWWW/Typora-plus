import { Emitter, type Event, type IDisposable } from "@typora-plus/base";
import {
  deserializeExtensionHostProtocolMessage,
  serializeExtensionHostProtocolMessage,
  type ExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import type { ExtensionHostProtocolTransport } from "./extensionHostProtocolSession";

export interface LinkedExtensionHostProtocolTransport extends ExtensionHostProtocolTransport, IDisposable {
  readonly label: string;
  readonly isDisposed: boolean;
}

export interface LinkedExtensionHostProtocolTransports extends IDisposable {
  readonly main: LinkedExtensionHostProtocolTransport;
  readonly extensionHost: LinkedExtensionHostProtocolTransport;
}

export interface LinkedExtensionHostProtocolTransportOptions {
  readonly schedule?: (deliver: () => void) => void;
}

export function createLinkedExtensionHostProtocolTransports(
  options: LinkedExtensionHostProtocolTransportOptions = {}
): LinkedExtensionHostProtocolTransports {
  let main: LinkedExtensionHostProtocolTransportEndpoint;
  let extensionHost: LinkedExtensionHostProtocolTransportEndpoint;
  const schedule = options.schedule ?? ((deliver) => deliver());

  main = new LinkedExtensionHostProtocolTransportEndpoint(
    "main",
    () => extensionHost,
    schedule
  );
  extensionHost = new LinkedExtensionHostProtocolTransportEndpoint(
    "extensionHost",
    () => main,
    schedule
  );

  return {
    main,
    extensionHost,
    dispose() {
      main.dispose();
      extensionHost.dispose();
    }
  };
}

class LinkedExtensionHostProtocolTransportEndpoint implements LinkedExtensionHostProtocolTransport {
  private readonly onMessageEmitter = new Emitter<unknown>();
  private disposed = false;

  readonly onMessage: Event<unknown> = this.onMessageEmitter.event;

  constructor(
    readonly label: string,
    private readonly getPeer: () => LinkedExtensionHostProtocolTransportEndpoint,
    private readonly schedule: (deliver: () => void) => void
  ) {}

  get isDisposed(): boolean {
    return this.disposed;
  }

  send(message: ExtensionHostProtocolMessage): void {
    if (this.disposed) {
      throw new Error(`Extension host protocol linked transport is disposed: ${this.label}`);
    }

    const peer = this.getPeer();

    if (peer.disposed) {
      throw new Error(`Extension host protocol linked transport peer is disposed: ${peer.label}`);
    }

    const wireMessage = deserializeExtensionHostProtocolMessage(
      serializeExtensionHostProtocolMessage(message)
    );

    this.schedule(() => {
      if (!peer.disposed) {
        peer.onMessageEmitter.fire(wireMessage);
      }
    });
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.onMessageEmitter.dispose();
  }
}
