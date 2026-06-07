import { describe, expect, it } from "vitest";
import { defaultConfiguration } from "./configuration";
import {
  createConfiguredExtensionHostProtocolRuntimeOptions,
  createConfiguredExtensionHostProtocolSessionOptions,
  createConfiguredExtensionHostProtocolWireTransportOptions,
  getExtensionHostProtocolRequestTimeoutMs,
  getExtensionHostProtocolWireMessageMaxLength
} from "./extensionHostProtocolConfiguration";

describe("extension host protocol configuration", () => {
  it("maps positive configuration values into protocol options", () => {
    expect(getExtensionHostProtocolRequestTimeoutMs(defaultConfiguration.extensionHost)).toBe(15_000);
    expect(getExtensionHostProtocolWireMessageMaxLength(defaultConfiguration.extensionHost)).toBe(1024 * 1024);

    expect(createConfiguredExtensionHostProtocolSessionOptions(defaultConfiguration.extensionHost)).toEqual({
      requestTimeoutMs: 15_000
    });
    expect(createConfiguredExtensionHostProtocolWireTransportOptions(defaultConfiguration.extensionHost)).toEqual({
      maxMessageLength: 1024 * 1024
    });
  });

  it("treats zero configuration values as disabled protocol limits", () => {
    const configuration = {
      requestTimeoutMs: 0,
      wireMessageMaxLength: 0
    };

    expect(getExtensionHostProtocolRequestTimeoutMs(configuration)).toBeUndefined();
    expect(getExtensionHostProtocolWireMessageMaxLength(configuration)).toBeUndefined();
    expect(createConfiguredExtensionHostProtocolSessionOptions(configuration)).toEqual({});
    expect(createConfiguredExtensionHostProtocolWireTransportOptions(configuration)).toEqual({});
  });

  it("keeps explicit protocol options ahead of configured defaults", () => {
    const configuration = defaultConfiguration.extensionHost;
    const onError = () => undefined;
    const activate = () => undefined;

    expect(createConfiguredExtensionHostProtocolSessionOptions(configuration, {
      onError,
      requestTimeoutMs: 500
    })).toEqual({
      onError,
      requestTimeoutMs: 500
    });
    expect(createConfiguredExtensionHostProtocolRuntimeOptions(configuration, {
      activate,
      requestTimeoutMs: 750
    })).toEqual({
      activate,
      requestTimeoutMs: 750
    });
    expect(createConfiguredExtensionHostProtocolWireTransportOptions(configuration, {
      label: "main",
      maxMessageLength: 4096
    })).toEqual({
      label: "main",
      maxMessageLength: 4096
    });
  });
});
