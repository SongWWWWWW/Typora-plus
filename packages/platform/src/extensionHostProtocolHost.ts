import { Disposable, toDisposable, type IDisposable } from "@typora-plus/base";
import type { ExtensionActivationRequest, RegisteredExtension } from "./extensions";
import type { ExtensionHost } from "./extensionHosts";
import {
  ExtensionHostProtocolSession,
  type ExtensionHostProtocolSessionOptions,
  type ExtensionHostProtocolTransport
} from "./extensionHostProtocolSession";

export type ExtensionHostProtocolTransportFactory =
  (request: ExtensionActivationRequest) => ExtensionHostProtocolTransport | Promise<ExtensionHostProtocolTransport>;

export interface ExtensionHostProtocolHostOptions extends ExtensionHostProtocolSessionOptions {
  readonly id: string;
  readonly canActivate: (extension: RegisteredExtension) => boolean;
  readonly createTransport: ExtensionHostProtocolTransportFactory;
}

export interface ExtensionHostProtocolSessionInfo {
  readonly extensionId: string;
}

interface ExtensionHostProtocolSessionRecord {
  readonly session: ExtensionHostProtocolSession;
  readonly subscription: IDisposable;
}

export class ExtensionHostProtocolHost extends Disposable implements ExtensionHost {
  readonly id: string;

  private readonly canActivateExtension: (extension: RegisteredExtension) => boolean;
  private readonly createTransport: ExtensionHostProtocolTransportFactory;
  private readonly sessions = new Map<string, ExtensionHostProtocolSessionRecord>();

  constructor(options: ExtensionHostProtocolHostOptions) {
    super();

    this.id = readRequiredString(options.id, "Extension host protocol host id");

    if (typeof options.canActivate !== "function") {
      throw new Error(`Extension host protocol host ${this.id} must provide canActivate`);
    }

    if (typeof options.createTransport !== "function") {
      throw new Error(`Extension host protocol host ${this.id} must provide createTransport`);
    }

    this.canActivateExtension = options.canActivate;
    this.createTransport = options.createTransport;
    this.sessionOptions = {
      ...(options.createRequestId ? { createRequestId: options.createRequestId } : {}),
      ...(options.onError ? { onError: options.onError } : {})
    };
  }

  private readonly sessionOptions: ExtensionHostProtocolSessionOptions;

  canActivate(extension: RegisteredExtension): boolean {
    return this.canActivateExtension(extension);
  }

  async activate(request: ExtensionActivationRequest): Promise<void> {
    if (!this.canActivate(request.extension)) {
      throw new Error(`Extension host protocol host ${this.id} cannot activate extension: ${request.extension.id}`);
    }

    const session = await this.getOrCreateSession(request);

    try {
      await session.activate(request);
    } catch (error) {
      this.disposeSession(request.extension.id, session);
      throw error;
    }
  }

  getSessions(): readonly ExtensionHostProtocolSessionInfo[] {
    return [...this.sessions.keys()].map((extensionId) => ({ extensionId }));
  }

  override dispose(): void {
    for (const [extensionId, record] of [...this.sessions]) {
      this.disposeSession(extensionId, record.session);
    }

    super.dispose();
  }

  private async getOrCreateSession(request: ExtensionActivationRequest): Promise<ExtensionHostProtocolSession> {
    const extensionId = readRequiredString(request.extension.id, "Extension host protocol session extension id");
    const existing = this.sessions.get(extensionId);

    if (existing) {
      return existing.session;
    }

    const transport = await this.createTransport(request);
    const session = new ExtensionHostProtocolSession(transport, request.context, this.sessionOptions);
    const subscription = request.context.subscriptions.add(toDisposable(() => {
      this.disposeSession(extensionId, session);
    }));
    const hostDisposable = this.store.add(toDisposable(() => {
      this.disposeSession(extensionId, session);
    }));

    this.sessions.set(extensionId, {
      session,
      subscription: toDisposable(() => {
        subscription.dispose();
        hostDisposable.dispose();
      })
    });

    return session;
  }

  private disposeSession(extensionId: string, session: ExtensionHostProtocolSession): void {
    const record = this.sessions.get(extensionId);

    if (!record || record.session !== session) {
      return;
    }

    this.sessions.delete(extensionId);
    session.dispose();
    record.subscription.dispose();
  }
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}
