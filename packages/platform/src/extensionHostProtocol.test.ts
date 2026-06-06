import { toDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { ExtensionActivationRequest, ExtensionContext, RegisteredExtension } from "./extensions";
import {
  createExtensionHostActivationErrorMessage,
  createExtensionHostActivationRequestMessage,
  createExtensionHostActivationResultMessage,
  createExtensionHostApiErrorMessage,
  createExtensionHostApiResultMessage,
  createExtensionHostCommandExecuteRequestMessage,
  createExtensionHostCommandListRequestMessage,
  createExtensionHostCommandRegisterRequestMessage,
  createExtensionHostContextKeyGetRequestMessage,
  createExtensionHostContextKeySetRequestMessage,
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

  it("serializes command runtime broker messages", () => {
    const register = createExtensionHostCommandRegisterRequestMessage("request-8", "notes.main", {
      id: " notes.open ",
      title: " Open Note ",
      category: " Notes "
    });
    const execute = createExtensionHostCommandExecuteRequestMessage("request-9", "notes.main", " notes.open ", [
      "file://notes/a.md",
      2,
      true,
      { preview: "A" }
    ]);
    const list = createExtensionHostCommandListRequestMessage("request-10", "notes.main");

    expect(register).toEqual({
      type: extensionHostProtocolMessageTypes.commandRegister,
      requestId: "request-8",
      extensionId: "notes.main",
      command: {
        id: "notes.open",
        title: "Open Note",
        category: "Notes"
      }
    });
    expect(execute).toEqual({
      type: extensionHostProtocolMessageTypes.commandExecute,
      requestId: "request-9",
      extensionId: "notes.main",
      command: "notes.open",
      args: [
        "file://notes/a.md",
        2,
        true,
        { preview: "A" }
      ]
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(register))).toEqual(register);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(execute))).toEqual(execute);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(list))).toEqual(list);
  });

  it("serializes context key broker messages with extension-owned keys only", () => {
    const set = createExtensionHostContextKeySetRequestMessage("request-11", "notes.main", "notes.main.ready", true);
    const clear = createExtensionHostContextKeySetRequestMessage("request-12", "notes.main", "notes.main.ready", undefined);
    const get = createExtensionHostContextKeyGetRequestMessage("request-13", "notes.main", "notes.main.ready");

    expect(set).toEqual({
      type: extensionHostProtocolMessageTypes.contextKeySet,
      requestId: "request-11",
      extensionId: "notes.main",
      key: "notes.main.ready",
      clear: false,
      value: true
    });
    expect(clear).toEqual({
      type: extensionHostProtocolMessageTypes.contextKeySet,
      requestId: "request-12",
      extensionId: "notes.main",
      key: "notes.main.ready",
      clear: true
    });
    expect(get).toEqual({
      type: extensionHostProtocolMessageTypes.contextKeyGet,
      requestId: "request-13",
      extensionId: "notes.main",
      key: "notes.main.ready"
    });
    expect(() => createExtensionHostContextKeySetRequestMessage(
      "request-14",
      "notes.main",
      "other.ready",
      true
    )).toThrow("must start with");
  });

  it("serializes runtime API result and error broker messages", () => {
    const result = createExtensionHostApiResultMessage("request-15", "notes.main", {
      commands: ["notes.open"]
    });
    const emptyResult = createExtensionHostApiResultMessage("request-16", "notes.main");
    const error = createExtensionHostApiErrorMessage("request-17", "notes.main", new Error("failed"));

    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(result))).toEqual(result);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(emptyResult))).toEqual(emptyResult);
    expect(error).toEqual({
      type: extensionHostProtocolMessageTypes.apiError,
      requestId: "request-17",
      extensionId: "notes.main",
      error: {
        message: "failed",
        name: "Error",
        stack: error.error.stack
      }
    });
  });

  it("rejects non-serializable command arguments and invalid context values", () => {
    expect(() => createExtensionHostCommandExecuteRequestMessage("request-18", "notes.main", "notes.open", [
      () => undefined
    ])).toThrow("must be JSON serializable");
    expect(() => createExtensionHostCommandExecuteRequestMessage("request-19", "notes.main", "notes.open", [
      Number.POSITIVE_INFINITY
    ])).toThrow("finite number");
    expect(() => readExtensionHostProtocolMessage({
      type: extensionHostProtocolMessageTypes.contextKeySet,
      requestId: "request-20",
      extensionId: "notes.main",
      key: "notes.main.ready",
      clear: false,
      value: { nested: true }
    })).toThrow("primitive context key value");
    expect(() => createExtensionHostCommandExecuteRequestMessage(
      "request-21",
      "notes.main",
      "notes.open",
      new Array(extensionHostProtocolLimits.commandArgumentCount + 1).fill("x")
    )).toThrow("must contain at most");
    expect(() => createExtensionHostApiResultMessage("request-22", "notes.main", new Date())).toThrow(
      "plain JSON object"
    );
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
