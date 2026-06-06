import { Disposable, toDisposable, type IDisposable } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";
import type { ExtensionActivationRequest, RegisteredExtension } from "./extensions";

export interface ExtensionHost {
  readonly id: string;
  canActivate(extension: RegisteredExtension): boolean;
  activate(request: ExtensionActivationRequest): void | Promise<void>;
}

export interface RegisteredExtensionHost {
  readonly id: string;
}

export interface IExtensionHostService {
  registerHost(host: ExtensionHost): IDisposable;
  activate(request: ExtensionActivationRequest): Promise<void>;
  getHosts(): readonly RegisteredExtensionHost[];
}

export const IExtensionHostService = createServiceIdentifier<IExtensionHostService>("extensionHost");

export class ExtensionHostService extends Disposable implements IExtensionHostService {
  private readonly hosts = new Map<string, ExtensionHost>();

  registerHost(host: ExtensionHost): IDisposable {
    const id = readRequiredString(host.id, "Extension host id");

    if (this.hosts.has(id)) {
      throw new Error(`Extension host already registered: ${id}`);
    }

    const normalizedHost = {
      ...host,
      id
    };
    this.hosts.set(id, normalizedHost);

    return toDisposable(() => {
      if (this.hosts.get(id) === normalizedHost) {
        this.hosts.delete(id);
      }
    });
  }

  async activate(request: ExtensionActivationRequest): Promise<void> {
    const hosts = [...this.hosts.values()].filter((host) => host.canActivate(request.extension));

    if (hosts.length === 0) {
      throw new Error(`No extension host registered for extension: ${request.extension.id}`);
    }

    if (hosts.length > 1) {
      throw new Error(`Multiple extension hosts can activate extension: ${request.extension.id}`);
    }

    const host = hosts[0];

    if (!host) {
      throw new Error(`No extension host registered for extension: ${request.extension.id}`);
    }

    await host.activate(request);
  }

  getHosts(): readonly RegisteredExtensionHost[] {
    return [...this.hosts.values()].map((host) => ({ id: host.id }));
  }

  override dispose(): void {
    this.hosts.clear();
    super.dispose();
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
