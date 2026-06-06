import { toDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { ExtensionActivationRequest, ExtensionContext, RegisteredExtension } from "./extensions";
import {
  createExtensionHostActivationErrorMessage,
  createExtensionHostActivationRequestMessage,
  createExtensionHostActivationResultMessage,
  deserializeExtensionHostProtocolMessage,
  extensionHostProtocolLimits,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  serializeExtensionHostProtocolMessage
} from "./extensionHostProtocol";

describe("extension host protocol", () => {
  it("serializes activation requests without runtime context functions", () => {
    const request = createActivationRequest({
      activationEvent: " onCommand:notes.open ",
      extension: {
        activationEvents: ["onCommand:notes.open"],
        activationState: "activating",
        displayName: " Notes ",
        id: " notes.main "
      }
    });

    const message = createExtensionHostActivationRequestMessage(request, " request-1 ");

    expect(message).toEqual({
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "request-1",
      activationEvent: "onCommand:notes.open",
      extension: {
        activationEvents: ["onCommand:notes.open"],
        activationState: "activating",
        displayName: "Notes",
        id: "notes.main"
      }
    });
    expect("context" in message).toBe(false);
    expect(JSON.parse(serializeExtensionHostProtocolMessage(message))).toEqual(message);
  });

  it("deserializes and normalizes activation response messages", () => {
    const result = deserializeExtensionHostProtocolMessage(JSON.stringify({
      type: extensionHostProtocolMessageTypes.activationResult,
      requestId: " request-2 ",
      extensionId: " notes.main ",
      ignored: "not part of the protocol"
    }));

    expect(result).toEqual(createExtensionHostActivationResultMessage("request-2", "notes.main"));
  });

  it("serializes activation errors with bounded error details", () => {
    const error = new Error("x".repeat(extensionHostProtocolLimits.errorMessageLength + 10));
    error.name = "ActivationError";

    const message = createExtensionHostActivationErrorMessage("request-3", "notes.main", error);

    expect(message.type).toBe(extensionHostProtocolMessageTypes.activationError);
    expect(message.error.name).toBe("ActivationError");
    expect(message.error.message).toHaveLength(extensionHostProtocolLimits.errorMessageLength);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(message))).toEqual(message);
  });

  it("reads activation request messages from unknown input", () => {
    const message = readExtensionHostProtocolMessage({
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "request-4",
      activationEvent: "onMarkdownRenderer:notes.chart",
      extension: {
        id: "notes.chart",
        activationEvents: ["onMarkdownRenderer:notes.chart"],
        activationState: "inactive"
      }
    });

    expect(message).toEqual({
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "request-4",
      activationEvent: "onMarkdownRenderer:notes.chart",
      extension: {
        id: "notes.chart",
        activationEvents: ["onMarkdownRenderer:notes.chart"],
        activationState: "inactive"
      }
    });
  });

  it("rejects invalid protocol messages", () => {
    expect(() => readExtensionHostProtocolMessage({
      type: "extensionHost/unknown",
      requestId: "request-5"
    })).toThrow("Unknown extension host protocol message type");
    expect(() => readExtensionHostProtocolMessage({
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "request-6",
      activationEvent: "onStartup",
      extension: {
        id: "notes.main",
        activationEvents: ["onStartup"],
        activationState: "starting"
      }
    })).toThrow("activation state is invalid");
    expect(() => readExtensionHostProtocolMessage({
      type: extensionHostProtocolMessageTypes.activate,
      requestId: "request-7",
      activationEvent: "onStartup",
      extension: {
        id: "notes.main",
        activationEvents: new Array(extensionHostProtocolLimits.activationEvents + 1).fill("onStartup"),
        activationState: "inactive"
      }
    })).toThrow("must contain at most");
  });
});

function createActivationRequest(options: {
  readonly activationEvent: string;
  readonly extension: RegisteredExtension;
}): ExtensionActivationRequest {
  return {
    activationEvent: options.activationEvent,
    context: createExtensionContext(options.extension),
    extension: options.extension
  };
}

function createExtensionContext(extension: RegisteredExtension): ExtensionContext {
  return {
    commands: {
      executeCommand: async <T = unknown>() => undefined as T,
      getCommands: () => [],
      registerCommand: () => toDisposable(() => undefined)
    },
    contextKeys: {
      getValue: () => undefined,
      setValue: () => undefined
    },
    exports: {
      getProviders: () => [],
      registerProvider: () => toDisposable(() => undefined)
    },
    extension,
    markdown: {
      getRenderers: () => [],
      registerRendererProvider: () => toDisposable(() => undefined)
    },
    subscriptions: {
      add(disposable) {
        return disposable;
      }
    }
  };
}
