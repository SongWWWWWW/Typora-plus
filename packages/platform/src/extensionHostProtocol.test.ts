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
  createExtensionHostCommandUnregisterRequestMessage,
  createExtensionHostContextKeyGetRequestMessage,
  createExtensionHostContextKeySetRequestMessage,
  createExtensionHostExportDocumentRequestMessage,
  createExtensionHostExportDocumentResultMessage,
  createExtensionHostExportProviderRegisterRequestMessage,
  createExtensionHostExportProviderUnregisterRequestMessage,
  createExtensionHostHandshakeRequestMessage,
  createExtensionHostHandshakeResultMessage,
  createExtensionHostMarkdownRendererRegisterRequestMessage,
  createExtensionHostMarkdownRendererRenderRequestMessage,
  createExtensionHostMarkdownRendererRenderResultMessage,
  createExtensionHostMarkdownRendererUnregisterRequestMessage,
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

  it("serializes handshake messages with bounded protocol capabilities", () => {
    const request = createExtensionHostHandshakeRequestMessage(" request-4 ", " notes.main ", 1, [
      "activation",
      "commands",
      "commands"
    ]);
    const result = createExtensionHostHandshakeResultMessage("request-4", "notes.main");

    expect(request).toEqual({
      type: extensionHostProtocolMessageTypes.handshakeRequest,
      requestId: "request-4",
      extensionId: "notes.main",
      protocolVersion: 1,
      capabilities: ["activation", "commands"]
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(request))).toEqual(request);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(result))).toEqual(result);

    expect(() => createExtensionHostHandshakeRequestMessage("request-5", "notes.main", 0)).toThrow("protocol version");
    expect(() => createExtensionHostHandshakeResultMessage("request-6", "notes.main", 1, ["bad capability"])).toThrow(
      "capabilities item is invalid"
    );
    expect(() => readExtensionHostProtocolMessage({
      type: extensionHostProtocolMessageTypes.handshakeRequest,
      requestId: "request-7",
      extensionId: "notes.main",
      protocolVersion: 1,
      capabilities: new Array(extensionHostProtocolLimits.capabilityCount + 1).fill("activation")
    })).toThrow("must contain at most");
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
    const unregister = createExtensionHostCommandUnregisterRequestMessage(
      "request-10b",
      "notes.main",
      " notes.open "
    );

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
    expect(unregister).toEqual({
      type: extensionHostProtocolMessageTypes.commandUnregister,
      requestId: "request-10b",
      extensionId: "notes.main",
      command: "notes.open"
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(unregister))).toEqual(unregister);
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

  it("serializes export provider broker messages", () => {
    const provider = createExtensionHostExportProviderRegisterRequestMessage("request-23", "notes.export", {
      format: " HTML ",
      title: " HTML Export "
    });
    const request = createExtensionHostExportDocumentRequestMessage("request-24", "notes.export", " HTML ", {
      assetMode: "file",
      name: " A Note.md ",
      uri: " file://notes/a.md ",
      value: "# A\n\n![Image](image.png)"
    });
    const result = createExtensionHostExportDocumentResultMessage("request-25", "notes.export", {
      assets: [{
        base64: "aGVsbG8=",
        mimeType: " image/png ",
        relativePath: "A_assets/image.png"
      }],
      defaultFileName: " A Note.html ",
      format: " HTML ",
      mimeType: " text/html;charset=utf-8 ",
      value: "<!doctype html>"
    });
    const unregister = createExtensionHostExportProviderUnregisterRequestMessage("request-25b", "notes.export", " HTML ");

    expect(provider).toEqual({
      type: extensionHostProtocolMessageTypes.exportProviderRegister,
      requestId: "request-23",
      extensionId: "notes.export",
      provider: {
        format: "html",
        title: "HTML Export"
      }
    });
    expect(request).toEqual({
      type: extensionHostProtocolMessageTypes.exportDocument,
      requestId: "request-24",
      extensionId: "notes.export",
      format: "html",
      input: {
        assetMode: "file",
        name: "A Note.md",
        uri: "file://notes/a.md",
        value: "# A\n\n![Image](image.png)"
      }
    });
    expect("resolveImageSource" in request.input).toBe(false);
    expect(result).toEqual({
      type: extensionHostProtocolMessageTypes.exportDocumentResult,
      requestId: "request-25",
      extensionId: "notes.export",
      document: {
        assets: [{
          base64: "aGVsbG8=",
          mimeType: "image/png",
          relativePath: "A_assets/image.png"
        }],
        defaultFileName: "A Note.html",
        format: "html",
        mimeType: "text/html;charset=utf-8",
        value: "<!doctype html>"
      }
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(provider))).toEqual(provider);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(request))).toEqual(request);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(result))).toEqual(result);
    expect(unregister).toEqual({
      type: extensionHostProtocolMessageTypes.exportProviderUnregister,
      requestId: "request-25b",
      extensionId: "notes.export",
      format: "html"
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(unregister))).toEqual(unregister);
  });

  it("rejects invalid export broker payloads", () => {
    expect(() => createExtensionHostExportDocumentResultMessage("request-26", "notes.export", {
      assets: [{
        base64: "aGVsbG8=",
        mimeType: "image/png",
        relativePath: "../secret.png"
      }],
      defaultFileName: "note.html",
      format: "html",
      mimeType: "text/html",
      value: "<main></main>"
    })).toThrow("relative path is invalid");
    expect(() => createExtensionHostExportDocumentResultMessage("request-27", "notes.export", {
      assets: [{
        base64: "aGVsbG8=",
        mimeType: "text/plain",
        relativePath: "assets/a.txt"
      }],
      defaultFileName: "note.html",
      format: "html",
      mimeType: "text/html",
      value: "<main></main>"
    })).toThrow("image MIME type");
    expect(() => createExtensionHostExportDocumentResultMessage("request-28", "notes.export", {
      assets: [{
        base64: "not base64!",
        mimeType: "image/png",
        relativePath: "assets/a.png"
      }],
      defaultFileName: "note.html",
      format: "html",
      mimeType: "text/html",
      value: "<main></main>"
    })).toThrow("valid base64");
    expect(() => readExtensionHostProtocolMessage({
      type: extensionHostProtocolMessageTypes.exportDocument,
      requestId: "request-29",
      extensionId: "notes.export",
      format: "html",
      input: {
        assetMode: "remote",
        name: "note.md",
        uri: "file://notes/a.md",
        value: ""
      }
    })).toThrow("inline or file");
    expect(() => createExtensionHostExportDocumentResultMessage("request-30", "notes.export", {
      assets: new Array(extensionHostProtocolLimits.exportAssetCount + 1).fill({
        base64: "aGVsbG8=",
        mimeType: "image/png",
        relativePath: "assets/a.png"
      }),
      defaultFileName: "note.html",
      format: "html",
      mimeType: "text/html",
      value: "<main></main>"
    })).toThrow("must contain at most");
  });

  it("serializes Markdown renderer broker messages", () => {
    const register = createExtensionHostMarkdownRendererRegisterRequestMessage("request-31", "notes.render", {
      id: " notes.diagram ",
      metadata: {
        kind: "block",
        label: " Diagram ",
        language: " MERMAID ",
        priority: 10
      }
    });
    const request = createExtensionHostMarkdownRendererRenderRequestMessage("request-32", "notes.render", " notes.diagram ", {
      language: " Mermaid ",
      uri: " file://notes/a.md ",
      value: "graph TD\nA-->B"
    });
    const result = createExtensionHostMarkdownRendererRenderResultMessage("request-33", "notes.render", " notes.diagram ", {
      html: "<img src=\"data:image/svg+xml,%3Csvg%3E\" alt=\"Diagram\">"
    });
    const unregister = createExtensionHostMarkdownRendererUnregisterRequestMessage(
      "request-33b",
      "notes.render",
      " notes.diagram "
    );

    expect(register).toEqual({
      type: extensionHostProtocolMessageTypes.markdownRendererRegister,
      requestId: "request-31",
      extensionId: "notes.render",
      renderer: {
        id: "notes.diagram",
        metadata: {
          kind: "block",
          label: "Diagram",
          language: "mermaid",
          priority: 10
        }
      }
    });
    expect(request).toEqual({
      type: extensionHostProtocolMessageTypes.markdownRendererRender,
      requestId: "request-32",
      extensionId: "notes.render",
      rendererId: "notes.diagram",
      input: {
        language: "mermaid",
        uri: "file://notes/a.md",
        value: "graph TD\nA-->B"
      }
    });
    expect(result).toEqual({
      type: extensionHostProtocolMessageTypes.markdownRendererRenderResult,
      requestId: "request-33",
      extensionId: "notes.render",
      rendererId: "notes.diagram",
      output: {
        html: "<img src=\"data:image/svg+xml,%3Csvg%3E\" alt=\"Diagram\">"
      }
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(register))).toEqual(register);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(request))).toEqual(request);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(result))).toEqual(result);
    expect(unregister).toEqual({
      type: extensionHostProtocolMessageTypes.markdownRendererUnregister,
      requestId: "request-33b",
      extensionId: "notes.render",
      rendererId: "notes.diagram"
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(unregister))).toEqual(unregister);
  });

  it("rejects invalid Markdown renderer broker payloads", () => {
    expect(() => createExtensionHostMarkdownRendererRegisterRequestMessage("request-34", "notes.render", {
      id: "notes.diagram",
      metadata: {
        kind: "widget" as "block",
        label: "Diagram"
      }
    })).toThrow("block or inline");
    expect(() => createExtensionHostMarkdownRendererRegisterRequestMessage("request-35", "notes.render", {
      id: "notes.diagram",
      metadata: {
        kind: "block",
        label: "Diagram",
        language: "bad language"
      }
    })).toThrow("language");
    expect(() => createExtensionHostMarkdownRendererRegisterRequestMessage("request-36", "notes.render", {
      id: "notes.diagram",
      metadata: {
        kind: "block",
        label: "Diagram",
        priority: extensionHostProtocolLimits.markdownRendererPriorityMax + 1
      }
    })).toThrow("between");
    expect(() => createExtensionHostMarkdownRendererRenderResultMessage("request-37", "notes.render", "notes.diagram", {
      html: "x".repeat(extensionHostProtocolLimits.markdownRendererHtmlLength + 1)
    })).toThrow("must be at most");
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
