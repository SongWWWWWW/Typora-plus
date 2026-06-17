import { toDisposable } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import { aiProviderRegistrationLimits, aiTextRequestLimits } from "./ai";
import {
  configurationMaxRemoteSyncProviderIdLength,
  configurationMaxRemoteSyncProviderTitleLength
} from "./configuration";
import type { ExtensionActivationRequest, ExtensionContext, RegisteredExtension } from "./extensions";
import {
  createExtensionHostActivationErrorMessage,
  createExtensionHostActivationRequestMessage,
  createExtensionHostActivationResultMessage,
  createExtensionHostAiProviderRegisterRequestMessage,
  createExtensionHostAiProviderUnregisterRequestMessage,
  createExtensionHostAiTextCancelMessage,
  createExtensionHostAiTextRequestMessage,
  createExtensionHostAiTextResultMessage,
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
  createExtensionHostRemoteSyncCreatePlanCancelMessage,
  createExtensionHostRemoteSyncCreatePlanRequestMessage,
  createExtensionHostRemoteSyncCreatePlanResultMessage,
  createExtensionHostRemoteSyncExecutePlanCancelMessage,
  createExtensionHostRemoteSyncExecutePlanProgressMessage,
  createExtensionHostRemoteSyncExecutePlanRequestMessage,
  createExtensionHostRemoteSyncExecutePlanResultMessage,
  createExtensionHostRemoteSyncProviderRegisterRequestMessage,
  createExtensionHostRemoteSyncProviderUnregisterRequestMessage,
  deserializeExtensionHostProtocolMessage,
  extensionHostProtocolLimits,
  extensionHostProtocolMessageTypes,
  readExtensionHostProtocolMessage,
  serializeExtensionHostProtocolMessage
} from "./extensionHostProtocol";
import { remoteSyncPayloadLimits, remoteSyncRequestMetadataLimits } from "./remoteSync";

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

  it("serializes AI provider broker messages", () => {
    expect(extensionHostProtocolLimits.aiProviderIdLength).toBe(aiProviderRegistrationLimits.idLength);
    expect(extensionHostProtocolLimits.aiProviderTitleLength).toBe(aiProviderRegistrationLimits.titleLength);
    expect(extensionHostProtocolLimits.aiOutputFormatKindLength).toBe(aiTextRequestLimits.outputFormatKindLength);

    const register = createExtensionHostAiProviderRegisterRequestMessage("request-ai-1", "notes.main", {
      id: " notes.main.ai ",
      title: " Notes AI "
    });
    const request = createExtensionHostAiTextRequestMessage("request-ai-2", "notes.main", " notes.main.ai ", {
      instruction: " Summarize ",
      input: "# A",
      context: [
        {
          kind: " note ",
          title: " A ",
          uri: " file://C:/Notes/A.md ",
          value: "Context"
        }
      ],
      metadata: {
        surface: "command"
      },
      outputFormat: {
        kind: "jsonSchema",
        name: "summary_result",
        schema: {
          type: "object",
          properties: {
            summary: {
              type: "string"
            }
          },
          required: ["summary"],
          additionalProperties: false
        },
        strict: true
      }
    });
    const result = createExtensionHostAiTextResultMessage("request-ai-3", "notes.main", "notes.main.ai", {
      value: "Summary",
      model: " test-model ",
      usage: {
        inputTokens: 2,
        outputTokens: 3,
        totalTokens: 5
      }
    });
    const unregister = createExtensionHostAiProviderUnregisterRequestMessage(
      "request-ai-4",
      "notes.main",
      "notes.main.ai"
    );
    const cancel = createExtensionHostAiTextCancelMessage(
      "request-ai-2",
      "notes.main",
      "notes.main.ai"
    );

    expect(register).toEqual({
      type: extensionHostProtocolMessageTypes.aiProviderRegister,
      requestId: "request-ai-1",
      extensionId: "notes.main",
      provider: {
        id: "notes.main.ai",
        title: "Notes AI"
      }
    });
    expect(request).toEqual({
      type: extensionHostProtocolMessageTypes.aiTextRequest,
      requestId: "request-ai-2",
      extensionId: "notes.main",
      providerId: "notes.main.ai",
      request: {
        instruction: "Summarize",
        input: "# A",
        context: [
          {
            kind: "note",
            title: "A",
            uri: "file://C:/Notes/A.md",
            value: "Context"
          }
        ],
        metadata: {
          surface: "command"
        },
        outputFormat: {
          kind: "jsonSchema",
          name: "summary_result",
          schema: {
            type: "object",
            properties: {
              summary: {
                type: "string"
              }
            },
            required: ["summary"],
            additionalProperties: false
          },
          strict: true
        }
      }
    });
    expect(result).toEqual({
      type: extensionHostProtocolMessageTypes.aiTextResult,
      requestId: "request-ai-3",
      extensionId: "notes.main",
      providerId: "notes.main.ai",
      result: {
        value: "Summary",
        model: "test-model",
        usage: {
          inputTokens: 2,
          outputTokens: 3,
          totalTokens: 5
        }
      }
    });
    expect(unregister).toEqual({
      type: extensionHostProtocolMessageTypes.aiProviderUnregister,
      requestId: "request-ai-4",
      extensionId: "notes.main",
      providerId: "notes.main.ai"
    });
    expect(cancel).toEqual({
      type: extensionHostProtocolMessageTypes.aiTextCancel,
      requestId: "request-ai-2",
      extensionId: "notes.main",
      providerId: "notes.main.ai"
    });
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(register))).toEqual(register);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(request))).toEqual(request);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(result))).toEqual(result);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(unregister))).toEqual(unregister);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(cancel))).toEqual(cancel);
    expect(() => createExtensionHostAiProviderRegisterRequestMessage("request-ai-5", "notes.main", {
      id: "bad provider",
      title: "Bad Provider"
    })).toThrow("AI provider id is invalid");
    expect(() => createExtensionHostAiTextRequestMessage("request-ai-6", "notes.main", "notes.main.ai", {
      instruction: "Summarize",
      input: "# A",
      context: new Array(extensionHostProtocolLimits.aiContextItemCount + 1).fill({
        kind: "note",
        value: "Context"
      })
    })).toThrow("must contain at most");
    expect(() => createExtensionHostAiTextRequestMessage("request-ai-6b", "notes.main", "notes.main.ai", {
      instruction: "Summarize",
      input: "# A",
      outputFormat: {
        kind: "jsonSchema",
        name: "bad",
        schema: [],
        strict: true
      } as never
    })).toThrow("schema must be a JSON object");
    expect(() => createExtensionHostAiTextRequestMessage("request-ai-6c", "notes.main", "notes.main.ai", {
      instruction: "Summarize",
      input: "# A",
      outputFormat: {
        kind: "x".repeat(extensionHostProtocolLimits.aiOutputFormatKindLength + 1)
      } as never
    })).toThrow(
      `Extension host AI text request output format kind must be at most ${extensionHostProtocolLimits.aiOutputFormatKindLength} characters`
    );
    expect(() => createExtensionHostAiTextResultMessage("request-ai-7", "notes.main", "notes.main.ai", {
      value: "Summary",
      usage: {
        totalTokens: -1
      }
    })).toThrow("between");
    expect(() => createExtensionHostAiTextCancelMessage("request-ai-8", "notes.main", "bad provider"))
      .toThrow("AI text cancel provider id is invalid");
  });

  it("serializes remote sync provider broker messages", () => {
    expect(extensionHostProtocolLimits.remoteSyncProviderIdLength)
      .toBe(configurationMaxRemoteSyncProviderIdLength);
    expect(extensionHostProtocolLimits.remoteSyncProviderTitleLength)
      .toBe(configurationMaxRemoteSyncProviderTitleLength);
    expect(extensionHostProtocolLimits.remoteSyncMetadataEntries)
      .toBe(remoteSyncRequestMetadataLimits.entries);
    expect(extensionHostProtocolLimits.remoteSyncMetadataKeyLength)
      .toBe(remoteSyncRequestMetadataLimits.keyLength);
    expect(extensionHostProtocolLimits.remoteSyncMetadataValueLength)
      .toBe(remoteSyncRequestMetadataLimits.valueLength);
    expect(extensionHostProtocolLimits.remoteSyncCompletedAtMax)
      .toBe(remoteSyncPayloadLimits.completedAtMax);
    expect(extensionHostProtocolLimits.remoteSyncMessageLength)
      .toBe(remoteSyncPayloadLimits.messageLength);
    expect(extensionHostProtocolLimits.remoteSyncOperationCount)
      .toBe(remoteSyncPayloadLimits.operationCount);
    expect(extensionHostProtocolLimits.remoteSyncRelativePathLength)
      .toBe(remoteSyncPayloadLimits.relativePathLength);
    expect(extensionHostProtocolLimits.remoteSyncRemoteIdLength)
      .toBe(remoteSyncPayloadLimits.remoteIdLength);
    expect(extensionHostProtocolLimits.remoteSyncResourceCount)
      .toBe(remoteSyncPayloadLimits.resourceCount);
    expect(extensionHostProtocolLimits.remoteSyncUriLength)
      .toBe(remoteSyncPayloadLimits.uriLength);

    const register = createExtensionHostRemoteSyncProviderRegisterRequestMessage("request-sync-1", "notes.main", {
      id: " notes.main.sync ",
      title: " Notes Sync "
    });
    const request = createExtensionHostRemoteSyncCreatePlanRequestMessage(
      "request-sync-2",
      "notes.main",
      " notes.main.sync ",
      {
        workspaceUri: " file://C:/Notes ",
        resources: [
          {
            uri: " file://C:/Notes/A.md ",
            relativePath: " ./A.md ",
            kind: "file",
            name: " A.md ",
            size: 10,
            mtime: 20,
            contentHash: " hash-a "
          }
        ],
        direction: "push",
        dryRun: true,
        remoteScopeId: " folder-token ",
        metadata: {
          surface: "command"
        }
      }
    );
    const plan = {
      operations: [{
        kind: "create" as const,
        target: "remote" as const,
        relativePath: "A.md",
        localUri: "file://C:/Notes/A.md",
        remoteId: "remote-a",
        message: "Upload"
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    };
    const createResult = createExtensionHostRemoteSyncCreatePlanResultMessage(
      "request-sync-3",
      "notes.main",
      "notes.main.sync",
      plan
    );
    const createCancel = createExtensionHostRemoteSyncCreatePlanCancelMessage(
      "request-sync-2",
      "notes.main",
      "notes.main.sync"
    );
    const execute = createExtensionHostRemoteSyncExecutePlanRequestMessage(
      "request-sync-4",
      "notes.main",
      "notes.main.sync",
      plan,
      request.request
    );
    const executeCancel = createExtensionHostRemoteSyncExecutePlanCancelMessage(
      "request-sync-4",
      "notes.main",
      "notes.main.sync"
    );
    const executeProgress = createExtensionHostRemoteSyncExecutePlanProgressMessage(
      "request-sync-4",
      "notes.main",
      "notes.main.sync",
      {
        message: " Uploading ",
        completed: 1,
        total: 3,
        operation: {
          kind: "create",
          target: "remote",
          relativePath: " ./A.md ",
          localUri: " file://C:/Notes/A.md ",
          message: " Sent "
        }
      }
    );
    const executeResult = createExtensionHostRemoteSyncExecutePlanResultMessage(
      "request-sync-5",
      "notes.main",
      "notes.main.sync",
      {
        ...plan,
        completedAt: 123
      }
    );
    const unregister = createExtensionHostRemoteSyncProviderUnregisterRequestMessage(
      "request-sync-6",
      "notes.main",
      "notes.main.sync"
    );

    expect(register).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncProviderRegister,
      requestId: "request-sync-1",
      extensionId: "notes.main",
      provider: {
        id: "notes.main.sync",
        title: "Notes Sync"
      }
    });
    expect(request).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncCreatePlan,
      requestId: "request-sync-2",
      extensionId: "notes.main",
      providerId: "notes.main.sync",
      request: {
        workspaceUri: "file://C:/Notes",
        resources: [
          {
            uri: "file://C:/Notes/A.md",
            relativePath: "A.md",
            kind: "file",
            name: "A.md",
            size: 10,
            mtime: 20,
            contentHash: "hash-a"
          }
        ],
        direction: "push",
        remoteScopeId: "folder-token",
        dryRun: true,
        metadata: {
          surface: "command"
        }
      }
    });
    expect(createResult).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncCreatePlanResult,
      requestId: "request-sync-3",
      extensionId: "notes.main",
      providerId: "notes.main.sync",
      plan
    });
    expect(createCancel).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncCreatePlanCancel,
      requestId: "request-sync-2",
      extensionId: "notes.main",
      providerId: "notes.main.sync"
    });
    expect(execute).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncExecutePlan,
      requestId: "request-sync-4",
      extensionId: "notes.main",
      providerId: "notes.main.sync",
      plan,
      request: request.request
    });
    expect(executeCancel).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncExecutePlanCancel,
      requestId: "request-sync-4",
      extensionId: "notes.main",
      providerId: "notes.main.sync"
    });
    expect(executeProgress).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncExecutePlanProgress,
      requestId: "request-sync-4",
      extensionId: "notes.main",
      providerId: "notes.main.sync",
      progress: {
        message: "Uploading",
        completed: 1,
        total: 3,
        operation: {
          kind: "create",
          target: "remote",
          relativePath: "A.md",
          localUri: "file://C:/Notes/A.md",
          message: "Sent"
        }
      }
    });
    expect(executeResult).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncExecutePlanResult,
      requestId: "request-sync-5",
      extensionId: "notes.main",
      providerId: "notes.main.sync",
      result: {
        ...plan,
        completedAt: 123
      }
    });
    expect(unregister).toEqual({
      type: extensionHostProtocolMessageTypes.remoteSyncProviderUnregister,
      requestId: "request-sync-6",
      extensionId: "notes.main",
      providerId: "notes.main.sync"
    });
    expect("signal" in request.request).toBe(false);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(register))).toEqual(register);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(request))).toEqual(request);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(createCancel))).toEqual(createCancel);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(createResult))).toEqual(createResult);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(execute))).toEqual(execute);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(executeCancel))).toEqual(executeCancel);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(executeProgress))).toEqual(executeProgress);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(executeResult))).toEqual(executeResult);
    expect(deserializeExtensionHostProtocolMessage(serializeExtensionHostProtocolMessage(unregister))).toEqual(unregister);
    expect(() => createExtensionHostRemoteSyncProviderRegisterRequestMessage("request-sync-7", "notes.main", {
      id: "bad provider",
      title: "Bad Provider"
    })).toThrow("remote sync provider id is invalid");
    expect(() => createExtensionHostRemoteSyncCreatePlanRequestMessage(
      "request-sync-8",
      "notes.main",
      "notes.main.sync",
      {
        workspaceUri: "file://C:/Notes",
        resources: new Array(extensionHostProtocolLimits.remoteSyncResourceCount + 1).fill({
          uri: "file://C:/Notes/A.md",
          relativePath: "A.md",
          kind: "file"
        }),
        direction: "push"
      }
    )).toThrow("must contain at most");
    expect(() => createExtensionHostRemoteSyncCreatePlanResultMessage(
      "request-sync-9",
      "notes.main",
      "notes.main.sync",
      {
        operations: [{
          kind: "create",
          target: "remote",
          relativePath: "../secret.md"
        }],
        summary: {
          creates: 1,
          updates: 0,
          deletes: 0,
          skips: 0,
          conflicts: 0
        }
      }
    )).toThrow("parent traversal");
    expect(() => createExtensionHostRemoteSyncCreatePlanCancelMessage(
      "request-sync-10",
      "notes.main",
      "bad provider"
    )).toThrow("remote sync create plan cancel provider id is invalid");
    expect(() => createExtensionHostRemoteSyncExecutePlanProgressMessage(
      "request-sync-11",
      "notes.main",
      "notes.main.sync",
      {
        message: "Uploading",
        completed: 2,
        total: 1
      }
    )).toThrow("remote sync progress completed must not exceed total");
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
    ai: {
      getProviders: () => [],
      registerProvider: () => toDisposable(() => undefined)
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
    remoteSync: {
      getProviders: () => [],
      registerProvider: () => toDisposable(() => undefined)
    },
    subscriptions: {
      add(disposable) {
        return disposable;
      }
    }
  };
}
