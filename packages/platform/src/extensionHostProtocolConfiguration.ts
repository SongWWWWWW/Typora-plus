import type { TyporaPlusConfiguration } from "./configuration";
import type { ExtensionHostProtocolRuntimeOptions } from "./extensionHostProtocolRuntime";
import type { ExtensionHostProtocolSessionOptions } from "./extensionHostProtocolSession";
import type { ExtensionHostProtocolWireTransportOptions } from "./extensionHostProtocolWireTransport";

export type ExtensionHostProtocolConfiguration = TyporaPlusConfiguration["extensionHost"];

export function getExtensionHostProtocolRequestTimeoutMs(
  configuration: ExtensionHostProtocolConfiguration
): number | undefined {
  return configuration.requestTimeoutMs > 0 ? configuration.requestTimeoutMs : undefined;
}

export function getExtensionHostProtocolWireMessageMaxLength(
  configuration: ExtensionHostProtocolConfiguration
): number | undefined {
  return configuration.wireMessageMaxLength > 0 ? configuration.wireMessageMaxLength : undefined;
}

export function createConfiguredExtensionHostProtocolSessionOptions(
  configuration: ExtensionHostProtocolConfiguration,
  options: ExtensionHostProtocolSessionOptions = {}
): ExtensionHostProtocolSessionOptions {
  const requestTimeoutMs = getExtensionHostProtocolRequestTimeoutMs(configuration);

  return {
    ...options,
    ...(options.requestTimeoutMs === undefined && requestTimeoutMs !== undefined ? { requestTimeoutMs } : {})
  };
}

export function createConfiguredExtensionHostProtocolRuntimeOptions(
  configuration: ExtensionHostProtocolConfiguration,
  options: ExtensionHostProtocolRuntimeOptions
): ExtensionHostProtocolRuntimeOptions {
  const requestTimeoutMs = getExtensionHostProtocolRequestTimeoutMs(configuration);

  return {
    ...options,
    ...(options.requestTimeoutMs === undefined && requestTimeoutMs !== undefined ? { requestTimeoutMs } : {})
  };
}

export function createConfiguredExtensionHostProtocolWireTransportOptions(
  configuration: ExtensionHostProtocolConfiguration,
  options: ExtensionHostProtocolWireTransportOptions = {}
): ExtensionHostProtocolWireTransportOptions {
  const maxMessageLength = getExtensionHostProtocolWireMessageMaxLength(configuration);

  return {
    ...options,
    ...(options.maxMessageLength === undefined && maxMessageLength !== undefined ? { maxMessageLength } : {})
  };
}
