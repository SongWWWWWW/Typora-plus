import type { CommandMetadata } from "./commands";
import type { ContextKeyValue } from "./contextKeys";
import type { ExtensionActivationRequest, ExtensionActivationState, RegisteredExtension } from "./extensions";
import type { ExportAssetMode, ExportedDocument, ExportedDocumentAsset, ExportProvider } from "./exports";
import type {
  MarkdownRendererInput,
  MarkdownRendererKind,
  MarkdownRendererOutput,
  MarkdownRendererRuntimeMetadata
} from "./markdownRenderers";

export const extensionHostProtocolMessageTypes = {
  activate: "extensionHost/activate",
  activationError: "extensionHost/activationError",
  activationResult: "extensionHost/activationResult",
  apiError: "extensionHost/api/error",
  apiResult: "extensionHost/api/result",
  commandExecute: "extensionHost/command/execute",
  commandList: "extensionHost/command/list",
  commandRegister: "extensionHost/command/register",
  commandUnregister: "extensionHost/command/unregister",
  contextKeyGet: "extensionHost/contextKey/get",
  contextKeySet: "extensionHost/contextKey/set",
  exportDocument: "extensionHost/export/document",
  exportDocumentResult: "extensionHost/export/documentResult",
  exportProviderRegister: "extensionHost/export/providerRegister",
  exportProviderUnregister: "extensionHost/export/providerUnregister",
  markdownRendererRegister: "extensionHost/markdownRenderer/register",
  markdownRendererRender: "extensionHost/markdownRenderer/render",
  markdownRendererRenderResult: "extensionHost/markdownRenderer/renderResult",
  markdownRendererUnregister: "extensionHost/markdownRenderer/unregister"
} as const;

export const extensionHostProtocolLimits = {
  activationEventLength: 256,
  activationEvents: 200,
  commandArgumentCount: 20,
  commandIdLength: 256,
  commandTitleLength: 160,
  contextKeyLength: 256,
  displayNameLength: 120,
  errorMessageLength: 4000,
  errorNameLength: 120,
  errorStackLength: 20000,
  exportAssetBase64Length: 10000000,
  exportAssetCount: 500,
  exportAssetRelativePathLength: 320,
  exportDefaultFileNameLength: 240,
  exportDocumentNameLength: 240,
  exportDocumentUriLength: 2000,
  exportDocumentValueLength: 5000000,
  exportFormatLength: 80,
  exportMimeTypeLength: 120,
  exportTitleLength: 160,
  extensionIdLength: 256,
  jsonArrayItems: 100,
  jsonDepth: 8,
  jsonObjectProperties: 100,
  jsonPropertyNameLength: 120,
  jsonStringLength: 20000,
  markdownRendererHtmlLength: 2000000,
  markdownRendererIdLength: 256,
  markdownRendererLabelLength: 160,
  markdownRendererLanguageLength: 80,
  markdownRendererPriorityMax: 100000,
  markdownRendererPriorityMin: -100000,
  markdownRendererValueLength: 1000000,
  requestIdLength: 120
} as const;

export type ExtensionHostProtocolMessage =
  | ExtensionHostActivationErrorMessage
  | ExtensionHostActivationRequestMessage
  | ExtensionHostActivationResultMessage
  | ExtensionHostApiErrorMessage
  | ExtensionHostApiResultMessage
  | ExtensionHostCommandExecuteRequestMessage
  | ExtensionHostCommandListRequestMessage
  | ExtensionHostCommandRegisterRequestMessage
  | ExtensionHostCommandUnregisterRequestMessage
  | ExtensionHostContextKeyGetRequestMessage
  | ExtensionHostContextKeySetRequestMessage
  | ExtensionHostExportDocumentRequestMessage
  | ExtensionHostExportDocumentResultMessage
  | ExtensionHostExportProviderRegisterRequestMessage
  | ExtensionHostExportProviderUnregisterRequestMessage
  | ExtensionHostMarkdownRendererRegisterRequestMessage
  | ExtensionHostMarkdownRendererRenderRequestMessage
  | ExtensionHostMarkdownRendererRenderResultMessage
  | ExtensionHostMarkdownRendererUnregisterRequestMessage;

export type ExtensionHostProtocolJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly ExtensionHostProtocolJsonValue[]
  | { readonly [key: string]: ExtensionHostProtocolJsonValue };

export interface ExtensionHostActivationRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.activate;
  readonly requestId: string;
  readonly activationEvent: string;
  readonly extension: ExtensionHostProtocolExtension;
}

export interface ExtensionHostActivationResultMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.activationResult;
  readonly requestId: string;
  readonly extensionId: string;
}

export interface ExtensionHostActivationErrorMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.activationError;
  readonly requestId: string;
  readonly extensionId: string;
  readonly error: ExtensionHostProtocolError;
}

export interface ExtensionHostApiResultMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.apiResult;
  readonly requestId: string;
  readonly extensionId: string;
  readonly value?: ExtensionHostProtocolJsonValue;
}

export interface ExtensionHostApiErrorMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.apiError;
  readonly requestId: string;
  readonly extensionId: string;
  readonly error: ExtensionHostProtocolError;
}

export interface ExtensionHostCommandRegisterRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.commandRegister;
  readonly requestId: string;
  readonly extensionId: string;
  readonly command: ExtensionHostProtocolCommandRegistration;
}

export interface ExtensionHostCommandExecuteRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.commandExecute;
  readonly requestId: string;
  readonly extensionId: string;
  readonly command: string;
  readonly args: readonly ExtensionHostProtocolJsonValue[];
}

export interface ExtensionHostCommandListRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.commandList;
  readonly requestId: string;
  readonly extensionId: string;
}

export interface ExtensionHostCommandUnregisterRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.commandUnregister;
  readonly requestId: string;
  readonly extensionId: string;
  readonly command: string;
}

export interface ExtensionHostContextKeySetRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.contextKeySet;
  readonly requestId: string;
  readonly extensionId: string;
  readonly key: string;
  readonly clear: boolean;
  readonly value?: ContextKeyValue;
}

export interface ExtensionHostContextKeyGetRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.contextKeyGet;
  readonly requestId: string;
  readonly extensionId: string;
  readonly key: string;
}

export interface ExtensionHostExportProviderRegisterRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.exportProviderRegister;
  readonly requestId: string;
  readonly extensionId: string;
  readonly provider: ExtensionHostProtocolExportProviderRegistration;
}

export interface ExtensionHostExportProviderUnregisterRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.exportProviderUnregister;
  readonly requestId: string;
  readonly extensionId: string;
  readonly format: string;
}

export interface ExtensionHostExportDocumentRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.exportDocument;
  readonly requestId: string;
  readonly extensionId: string;
  readonly format: string;
  readonly input: ExtensionHostProtocolExportDocumentInput;
}

export interface ExtensionHostExportDocumentResultMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.exportDocumentResult;
  readonly requestId: string;
  readonly extensionId: string;
  readonly document: ExtensionHostProtocolExportedDocument;
}

export interface ExtensionHostMarkdownRendererRegisterRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.markdownRendererRegister;
  readonly requestId: string;
  readonly extensionId: string;
  readonly renderer: ExtensionHostProtocolMarkdownRendererRegistration;
}

export interface ExtensionHostMarkdownRendererRenderRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.markdownRendererRender;
  readonly requestId: string;
  readonly extensionId: string;
  readonly rendererId: string;
  readonly input: ExtensionHostProtocolMarkdownRendererInput;
}

export interface ExtensionHostMarkdownRendererRenderResultMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.markdownRendererRenderResult;
  readonly requestId: string;
  readonly extensionId: string;
  readonly rendererId: string;
  readonly output: ExtensionHostProtocolMarkdownRendererOutput;
}

export interface ExtensionHostMarkdownRendererUnregisterRequestMessage {
  readonly type: typeof extensionHostProtocolMessageTypes.markdownRendererUnregister;
  readonly requestId: string;
  readonly extensionId: string;
  readonly rendererId: string;
}

export interface ExtensionHostProtocolCommandRegistration extends Pick<CommandMetadata, "id"> {
  readonly title?: string;
  readonly category?: string;
}

export interface ExtensionHostProtocolExportProviderRegistration extends Pick<ExportProvider, "format" | "title"> {}

export interface ExtensionHostProtocolExportDocumentInput {
  readonly uri: string;
  readonly name: string;
  readonly value: string;
  readonly assetMode?: ExportAssetMode;
}

export interface ExtensionHostProtocolExportedDocument extends Omit<ExportedDocument, "assets"> {
  readonly assets?: readonly ExtensionHostProtocolExportedDocumentAsset[];
}

export interface ExtensionHostProtocolExportedDocumentAsset extends ExportedDocumentAsset {}

export interface ExtensionHostProtocolMarkdownRendererRegistration {
  readonly id: string;
  readonly metadata?: ExtensionHostProtocolMarkdownRendererRuntimeMetadata;
}

export interface ExtensionHostProtocolMarkdownRendererRuntimeMetadata extends MarkdownRendererRuntimeMetadata {}

export interface ExtensionHostProtocolMarkdownRendererInput extends Omit<MarkdownRendererInput, "uri"> {
  readonly uri?: string;
}

export interface ExtensionHostProtocolMarkdownRendererOutput extends MarkdownRendererOutput {}

export interface ExtensionHostProtocolExtension {
  readonly id: string;
  readonly displayName?: string;
  readonly activationEvents: readonly string[];
  readonly activationState: ExtensionActivationState;
}

export interface ExtensionHostProtocolError {
  readonly message: string;
  readonly name?: string;
  readonly stack?: string;
}

type UnknownRecord = Record<string, unknown>;

export function createExtensionHostActivationRequestMessage(
  request: ExtensionActivationRequest,
  requestId: string
): ExtensionHostActivationRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.activate,
    requestId: normalizeRequiredProtocolString(
      requestId,
      "Extension host activation request id",
      extensionHostProtocolLimits.requestIdLength
    ),
    activationEvent: normalizeRequiredProtocolString(
      request.activationEvent,
      "Extension host activation event",
      extensionHostProtocolLimits.activationEventLength
    ),
    extension: toProtocolExtension(request.extension)
  };
}

export function createExtensionHostActivationResultMessage(
  requestId: string,
  extensionId: string
): ExtensionHostActivationResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.activationResult,
    requestId: normalizeRequiredProtocolString(
      requestId,
      "Extension host activation result request id",
      extensionHostProtocolLimits.requestIdLength
    ),
    extensionId: normalizeRequiredProtocolString(
      extensionId,
      "Extension host activation result extension id",
      extensionHostProtocolLimits.extensionIdLength
    )
  };
}

export function createExtensionHostActivationErrorMessage(
  requestId: string,
  extensionId: string,
  error: unknown
): ExtensionHostActivationErrorMessage {
  return {
    type: extensionHostProtocolMessageTypes.activationError,
    requestId: normalizeRequiredProtocolString(
      requestId,
      "Extension host activation error request id",
      extensionHostProtocolLimits.requestIdLength
    ),
    extensionId: normalizeRequiredProtocolString(
      extensionId,
      "Extension host activation error extension id",
      extensionHostProtocolLimits.extensionIdLength
    ),
    error: toProtocolError(error)
  };
}

export function createExtensionHostApiResultMessage(
  requestId: string,
  extensionId: string,
  value?: unknown
): ExtensionHostApiResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.apiResult,
    requestId: normalizeRequestId(requestId, "Extension host API result request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host API result extension id"),
    ...(value !== undefined ? { value: normalizeProtocolJsonValue(value, "Extension host API result value") } : {})
  };
}

export function createExtensionHostApiErrorMessage(
  requestId: string,
  extensionId: string,
  error: unknown
): ExtensionHostApiErrorMessage {
  return {
    type: extensionHostProtocolMessageTypes.apiError,
    requestId: normalizeRequestId(requestId, "Extension host API error request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host API error extension id"),
    error: toProtocolError(error)
  };
}

export function createExtensionHostCommandRegisterRequestMessage(
  requestId: string,
  extensionId: string,
  command: ExtensionHostProtocolCommandRegistration
): ExtensionHostCommandRegisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandRegister,
    requestId: normalizeRequestId(requestId, "Extension host command registration request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host command registration extension id"),
    command: normalizeProtocolCommandRegistration(command)
  };
}

export function createExtensionHostCommandExecuteRequestMessage(
  requestId: string,
  extensionId: string,
  command: string,
  args: readonly unknown[] = []
): ExtensionHostCommandExecuteRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandExecute,
    requestId: normalizeRequestId(requestId, "Extension host command execution request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host command execution extension id"),
    command: normalizeCommandId(command, "Extension host command execution command id"),
    args: normalizeProtocolJsonArray(
      args,
      "Extension host command execution arguments",
      extensionHostProtocolLimits.commandArgumentCount
    )
  };
}

export function createExtensionHostCommandListRequestMessage(
  requestId: string,
  extensionId: string
): ExtensionHostCommandListRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandList,
    requestId: normalizeRequestId(requestId, "Extension host command list request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host command list extension id")
  };
}

export function createExtensionHostCommandUnregisterRequestMessage(
  requestId: string,
  extensionId: string,
  command: string
): ExtensionHostCommandUnregisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandUnregister,
    requestId: normalizeRequestId(requestId, "Extension host command unregister request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host command unregister extension id"),
    command: normalizeCommandId(command, "Extension host command unregister command id")
  };
}

export function createExtensionHostContextKeySetRequestMessage(
  requestId: string,
  extensionId: string,
  key: string,
  value: ContextKeyValue | undefined
): ExtensionHostContextKeySetRequestMessage {
  const normalizedExtensionId = normalizeExtensionId(extensionId, "Extension host context key set extension id");
  const normalizedKey = normalizeExtensionOwnedContextKey(normalizedExtensionId, key);

  return {
    type: extensionHostProtocolMessageTypes.contextKeySet,
    requestId: normalizeRequestId(requestId, "Extension host context key set request id"),
    extensionId: normalizedExtensionId,
    key: normalizedKey,
    clear: value === undefined,
    ...(value !== undefined ? { value: normalizeContextKeyValue(value, "Extension host context key value") } : {})
  };
}

export function createExtensionHostContextKeyGetRequestMessage(
  requestId: string,
  extensionId: string,
  key: string
): ExtensionHostContextKeyGetRequestMessage {
  const normalizedExtensionId = normalizeExtensionId(extensionId, "Extension host context key get extension id");

  return {
    type: extensionHostProtocolMessageTypes.contextKeyGet,
    requestId: normalizeRequestId(requestId, "Extension host context key get request id"),
    extensionId: normalizedExtensionId,
    key: normalizeExtensionOwnedContextKey(normalizedExtensionId, key)
  };
}

export function createExtensionHostExportProviderRegisterRequestMessage(
  requestId: string,
  extensionId: string,
  provider: ExtensionHostProtocolExportProviderRegistration
): ExtensionHostExportProviderRegisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportProviderRegister,
    requestId: normalizeRequestId(requestId, "Extension host export provider registration request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host export provider registration extension id"),
    provider: normalizeProtocolExportProviderRegistration(provider)
  };
}

export function createExtensionHostExportDocumentRequestMessage(
  requestId: string,
  extensionId: string,
  format: string,
  input: ExtensionHostProtocolExportDocumentInput
): ExtensionHostExportDocumentRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportDocument,
    requestId: normalizeRequestId(requestId, "Extension host export document request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host export document extension id"),
    format: normalizeExportFormat(format, "Extension host export document format"),
    input: normalizeProtocolExportDocumentInput(input)
  };
}

export function createExtensionHostExportProviderUnregisterRequestMessage(
  requestId: string,
  extensionId: string,
  format: string
): ExtensionHostExportProviderUnregisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportProviderUnregister,
    requestId: normalizeRequestId(requestId, "Extension host export provider unregister request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host export provider unregister extension id"),
    format: normalizeExportFormat(format, "Extension host export provider unregister format")
  };
}

export function createExtensionHostExportDocumentResultMessage(
  requestId: string,
  extensionId: string,
  document: ExtensionHostProtocolExportedDocument
): ExtensionHostExportDocumentResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportDocumentResult,
    requestId: normalizeRequestId(requestId, "Extension host export document result request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host export document result extension id"),
    document: normalizeProtocolExportedDocument(document)
  };
}

export function createExtensionHostMarkdownRendererRegisterRequestMessage(
  requestId: string,
  extensionId: string,
  renderer: ExtensionHostProtocolMarkdownRendererRegistration
): ExtensionHostMarkdownRendererRegisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererRegister,
    requestId: normalizeRequestId(requestId, "Extension host Markdown renderer registration request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host Markdown renderer registration extension id"),
    renderer: normalizeProtocolMarkdownRendererRegistration(renderer)
  };
}

export function createExtensionHostMarkdownRendererRenderRequestMessage(
  requestId: string,
  extensionId: string,
  rendererId: string,
  input: ExtensionHostProtocolMarkdownRendererInput
): ExtensionHostMarkdownRendererRenderRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererRender,
    requestId: normalizeRequestId(requestId, "Extension host Markdown renderer render request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host Markdown renderer render extension id"),
    rendererId: normalizeMarkdownRendererId(rendererId, "Extension host Markdown renderer render id"),
    input: normalizeProtocolMarkdownRendererInput(input)
  };
}

export function createExtensionHostMarkdownRendererRenderResultMessage(
  requestId: string,
  extensionId: string,
  rendererId: string,
  output: ExtensionHostProtocolMarkdownRendererOutput
): ExtensionHostMarkdownRendererRenderResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererRenderResult,
    requestId: normalizeRequestId(requestId, "Extension host Markdown renderer render result request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host Markdown renderer render result extension id"),
    rendererId: normalizeMarkdownRendererId(rendererId, "Extension host Markdown renderer render result id"),
    output: normalizeProtocolMarkdownRendererOutput(output)
  };
}

export function createExtensionHostMarkdownRendererUnregisterRequestMessage(
  requestId: string,
  extensionId: string,
  rendererId: string
): ExtensionHostMarkdownRendererUnregisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererUnregister,
    requestId: normalizeRequestId(requestId, "Extension host Markdown renderer unregister request id"),
    extensionId: normalizeExtensionId(extensionId, "Extension host Markdown renderer unregister extension id"),
    rendererId: normalizeMarkdownRendererId(rendererId, "Extension host Markdown renderer unregister id")
  };
}

export function serializeExtensionHostProtocolMessage(message: ExtensionHostProtocolMessage): string {
  return JSON.stringify(readExtensionHostProtocolMessage(message));
}

export function deserializeExtensionHostProtocolMessage(raw: string): ExtensionHostProtocolMessage {
  return readExtensionHostProtocolMessage(JSON.parse(raw));
}

export function readExtensionHostProtocolMessage(value: unknown): ExtensionHostProtocolMessage {
  const record = expectRecord(value, "Extension host protocol message");
  const type = normalizeRequiredProtocolString(record.type, "Extension host protocol message type", 120);

  switch (type) {
    case extensionHostProtocolMessageTypes.activate:
      return readActivationRequestMessage(record);
    case extensionHostProtocolMessageTypes.activationResult:
      return readActivationResultMessage(record);
    case extensionHostProtocolMessageTypes.activationError:
      return readActivationErrorMessage(record);
    case extensionHostProtocolMessageTypes.apiResult:
      return readApiResultMessage(record);
    case extensionHostProtocolMessageTypes.apiError:
      return readApiErrorMessage(record);
    case extensionHostProtocolMessageTypes.commandRegister:
      return readCommandRegisterRequestMessage(record);
    case extensionHostProtocolMessageTypes.commandExecute:
      return readCommandExecuteRequestMessage(record);
    case extensionHostProtocolMessageTypes.commandList:
      return readCommandListRequestMessage(record);
    case extensionHostProtocolMessageTypes.commandUnregister:
      return readCommandUnregisterRequestMessage(record);
    case extensionHostProtocolMessageTypes.contextKeySet:
      return readContextKeySetRequestMessage(record);
    case extensionHostProtocolMessageTypes.contextKeyGet:
      return readContextKeyGetRequestMessage(record);
    case extensionHostProtocolMessageTypes.exportProviderRegister:
      return readExportProviderRegisterRequestMessage(record);
    case extensionHostProtocolMessageTypes.exportProviderUnregister:
      return readExportProviderUnregisterRequestMessage(record);
    case extensionHostProtocolMessageTypes.exportDocument:
      return readExportDocumentRequestMessage(record);
    case extensionHostProtocolMessageTypes.exportDocumentResult:
      return readExportDocumentResultMessage(record);
    case extensionHostProtocolMessageTypes.markdownRendererRegister:
      return readMarkdownRendererRegisterRequestMessage(record);
    case extensionHostProtocolMessageTypes.markdownRendererRender:
      return readMarkdownRendererRenderRequestMessage(record);
    case extensionHostProtocolMessageTypes.markdownRendererRenderResult:
      return readMarkdownRendererRenderResultMessage(record);
    case extensionHostProtocolMessageTypes.markdownRendererUnregister:
      return readMarkdownRendererUnregisterRequestMessage(record);
    default:
      throw new Error(`Unknown extension host protocol message type: ${type}`);
  }
}

function readActivationRequestMessage(record: UnknownRecord): ExtensionHostActivationRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.activate,
    requestId: normalizeRequiredProtocolString(
      record.requestId,
      "Extension host activation request id",
      extensionHostProtocolLimits.requestIdLength
    ),
    activationEvent: normalizeRequiredProtocolString(
      record.activationEvent,
      "Extension host activation event",
      extensionHostProtocolLimits.activationEventLength
    ),
    extension: readProtocolExtension(record.extension)
  };
}

function readActivationResultMessage(record: UnknownRecord): ExtensionHostActivationResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.activationResult,
    requestId: normalizeRequiredProtocolString(
      record.requestId,
      "Extension host activation result request id",
      extensionHostProtocolLimits.requestIdLength
    ),
    extensionId: normalizeRequiredProtocolString(
      record.extensionId,
      "Extension host activation result extension id",
      extensionHostProtocolLimits.extensionIdLength
    )
  };
}

function readActivationErrorMessage(record: UnknownRecord): ExtensionHostActivationErrorMessage {
  return {
    type: extensionHostProtocolMessageTypes.activationError,
    requestId: normalizeRequiredProtocolString(
      record.requestId,
      "Extension host activation error request id",
      extensionHostProtocolLimits.requestIdLength
    ),
    extensionId: normalizeRequiredProtocolString(
      record.extensionId,
      "Extension host activation error extension id",
      extensionHostProtocolLimits.extensionIdLength
    ),
    error: readProtocolError(record.error)
  };
}

function readApiResultMessage(record: UnknownRecord): ExtensionHostApiResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.apiResult,
    requestId: normalizeRequestId(record.requestId, "Extension host API result request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host API result extension id"),
    ...("value" in record ? {
      value: normalizeProtocolJsonValue(record.value, "Extension host API result value")
    } : {})
  };
}

function readApiErrorMessage(record: UnknownRecord): ExtensionHostApiErrorMessage {
  return {
    type: extensionHostProtocolMessageTypes.apiError,
    requestId: normalizeRequestId(record.requestId, "Extension host API error request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host API error extension id"),
    error: readProtocolError(record.error)
  };
}

function readCommandRegisterRequestMessage(record: UnknownRecord): ExtensionHostCommandRegisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandRegister,
    requestId: normalizeRequestId(record.requestId, "Extension host command registration request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host command registration extension id"),
    command: normalizeProtocolCommandRegistration(record.command)
  };
}

function readCommandExecuteRequestMessage(record: UnknownRecord): ExtensionHostCommandExecuteRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandExecute,
    requestId: normalizeRequestId(record.requestId, "Extension host command execution request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host command execution extension id"),
    command: normalizeCommandId(record.command, "Extension host command execution command id"),
    args: normalizeProtocolJsonArray(
      record.args,
      "Extension host command execution arguments",
      extensionHostProtocolLimits.commandArgumentCount
    )
  };
}

function readCommandListRequestMessage(record: UnknownRecord): ExtensionHostCommandListRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandList,
    requestId: normalizeRequestId(record.requestId, "Extension host command list request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host command list extension id")
  };
}

function readCommandUnregisterRequestMessage(record: UnknownRecord): ExtensionHostCommandUnregisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.commandUnregister,
    requestId: normalizeRequestId(record.requestId, "Extension host command unregister request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host command unregister extension id"),
    command: normalizeCommandId(record.command, "Extension host command unregister command id")
  };
}

function readContextKeySetRequestMessage(record: UnknownRecord): ExtensionHostContextKeySetRequestMessage {
  const extensionId = normalizeExtensionId(record.extensionId, "Extension host context key set extension id");
  const key = normalizeExtensionOwnedContextKey(extensionId, record.key);
  const clear = normalizeBoolean(record.clear, "Extension host context key set clear flag");

  if (clear) {
    return {
      type: extensionHostProtocolMessageTypes.contextKeySet,
      requestId: normalizeRequestId(record.requestId, "Extension host context key set request id"),
      extensionId,
      key,
      clear
    };
  }

  return {
    type: extensionHostProtocolMessageTypes.contextKeySet,
    requestId: normalizeRequestId(record.requestId, "Extension host context key set request id"),
    extensionId,
    key,
    clear,
    value: normalizeContextKeyValue(record.value, "Extension host context key value")
  };
}

function readContextKeyGetRequestMessage(record: UnknownRecord): ExtensionHostContextKeyGetRequestMessage {
  const extensionId = normalizeExtensionId(record.extensionId, "Extension host context key get extension id");

  return {
    type: extensionHostProtocolMessageTypes.contextKeyGet,
    requestId: normalizeRequestId(record.requestId, "Extension host context key get request id"),
    extensionId,
    key: normalizeExtensionOwnedContextKey(extensionId, record.key)
  };
}

function readExportProviderRegisterRequestMessage(record: UnknownRecord): ExtensionHostExportProviderRegisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportProviderRegister,
    requestId: normalizeRequestId(record.requestId, "Extension host export provider registration request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host export provider registration extension id"),
    provider: normalizeProtocolExportProviderRegistration(record.provider)
  };
}

function readExportDocumentRequestMessage(record: UnknownRecord): ExtensionHostExportDocumentRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportDocument,
    requestId: normalizeRequestId(record.requestId, "Extension host export document request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host export document extension id"),
    format: normalizeExportFormat(record.format, "Extension host export document format"),
    input: normalizeProtocolExportDocumentInput(record.input)
  };
}

function readExportProviderUnregisterRequestMessage(
  record: UnknownRecord
): ExtensionHostExportProviderUnregisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportProviderUnregister,
    requestId: normalizeRequestId(record.requestId, "Extension host export provider unregister request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host export provider unregister extension id"),
    format: normalizeExportFormat(record.format, "Extension host export provider unregister format")
  };
}

function readExportDocumentResultMessage(record: UnknownRecord): ExtensionHostExportDocumentResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.exportDocumentResult,
    requestId: normalizeRequestId(record.requestId, "Extension host export document result request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host export document result extension id"),
    document: normalizeProtocolExportedDocument(record.document)
  };
}

function readMarkdownRendererRegisterRequestMessage(
  record: UnknownRecord
): ExtensionHostMarkdownRendererRegisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererRegister,
    requestId: normalizeRequestId(record.requestId, "Extension host Markdown renderer registration request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host Markdown renderer registration extension id"),
    renderer: normalizeProtocolMarkdownRendererRegistration(record.renderer)
  };
}

function readMarkdownRendererRenderRequestMessage(
  record: UnknownRecord
): ExtensionHostMarkdownRendererRenderRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererRender,
    requestId: normalizeRequestId(record.requestId, "Extension host Markdown renderer render request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host Markdown renderer render extension id"),
    rendererId: normalizeMarkdownRendererId(record.rendererId, "Extension host Markdown renderer render id"),
    input: normalizeProtocolMarkdownRendererInput(record.input)
  };
}

function readMarkdownRendererRenderResultMessage(
  record: UnknownRecord
): ExtensionHostMarkdownRendererRenderResultMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererRenderResult,
    requestId: normalizeRequestId(record.requestId, "Extension host Markdown renderer render result request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host Markdown renderer render result extension id"),
    rendererId: normalizeMarkdownRendererId(record.rendererId, "Extension host Markdown renderer render result id"),
    output: normalizeProtocolMarkdownRendererOutput(record.output)
  };
}

function readMarkdownRendererUnregisterRequestMessage(
  record: UnknownRecord
): ExtensionHostMarkdownRendererUnregisterRequestMessage {
  return {
    type: extensionHostProtocolMessageTypes.markdownRendererUnregister,
    requestId: normalizeRequestId(record.requestId, "Extension host Markdown renderer unregister request id"),
    extensionId: normalizeExtensionId(record.extensionId, "Extension host Markdown renderer unregister extension id"),
    rendererId: normalizeMarkdownRendererId(record.rendererId, "Extension host Markdown renderer unregister id")
  };
}

function toProtocolExtension(extension: RegisteredExtension): ExtensionHostProtocolExtension {
  return {
    id: normalizeRequiredProtocolString(
      extension.id,
      "Extension host protocol extension id",
      extensionHostProtocolLimits.extensionIdLength
    ),
    ...(extension.displayName ? {
      displayName: normalizeRequiredProtocolString(
        extension.displayName,
        "Extension host protocol extension display name",
        extensionHostProtocolLimits.displayNameLength
      )
    } : {}),
    activationEvents: normalizeProtocolStringArray(
      extension.activationEvents,
      "Extension host protocol extension activation events",
      extensionHostProtocolLimits.activationEvents,
      extensionHostProtocolLimits.activationEventLength
    ),
    activationState: normalizeExtensionActivationState(extension.activationState)
  };
}

function readProtocolExtension(value: unknown): ExtensionHostProtocolExtension {
  const record = expectRecord(value, "Extension host protocol extension");
  const displayName = normalizeOptionalProtocolString(
    record.displayName,
    "Extension host protocol extension display name",
    extensionHostProtocolLimits.displayNameLength
  );

  return {
    id: normalizeRequiredProtocolString(
      record.id,
      "Extension host protocol extension id",
      extensionHostProtocolLimits.extensionIdLength
    ),
    ...(displayName ? { displayName } : {}),
    activationEvents: normalizeProtocolStringArray(
      record.activationEvents,
      "Extension host protocol extension activation events",
      extensionHostProtocolLimits.activationEvents,
      extensionHostProtocolLimits.activationEventLength
    ),
    activationState: normalizeExtensionActivationState(record.activationState)
  };
}

function toProtocolError(error: unknown): ExtensionHostProtocolError {
  if (error instanceof Error) {
    return {
      message: truncateProtocolString(
        error.message || error.name || "Extension host activation failed",
        extensionHostProtocolLimits.errorMessageLength
      ),
      ...(error.name ? {
        name: truncateProtocolString(error.name, extensionHostProtocolLimits.errorNameLength)
      } : {}),
      ...(error.stack ? {
        stack: truncateProtocolString(error.stack, extensionHostProtocolLimits.errorStackLength)
      } : {})
    };
  }

  return {
    message: truncateProtocolString(String(error), extensionHostProtocolLimits.errorMessageLength)
  };
}

function readProtocolError(value: unknown): ExtensionHostProtocolError {
  const record = expectRecord(value, "Extension host protocol error");
  const name = normalizeOptionalProtocolString(
    record.name,
    "Extension host protocol error name",
    extensionHostProtocolLimits.errorNameLength
  );
  const stack = normalizeOptionalProtocolString(
    record.stack,
    "Extension host protocol error stack",
    extensionHostProtocolLimits.errorStackLength
  );

  return {
    message: normalizeRequiredProtocolString(
      record.message,
      "Extension host protocol error message",
      extensionHostProtocolLimits.errorMessageLength
    ),
    ...(name ? { name } : {}),
    ...(stack ? { stack } : {})
  };
}

function normalizeProtocolCommandRegistration(value: unknown): ExtensionHostProtocolCommandRegistration {
  const record = expectRecord(value, "Extension host command registration");
  const title = normalizeOptionalProtocolString(
    record.title,
    "Extension host command registration title",
    extensionHostProtocolLimits.commandTitleLength
  );
  const category = normalizeOptionalProtocolString(
    record.category,
    "Extension host command registration category",
    extensionHostProtocolLimits.commandTitleLength
  );

  return {
    id: normalizeCommandId(record.id, "Extension host command registration id"),
    ...(title ? { title } : {}),
    ...(category ? { category } : {})
  };
}

function normalizeProtocolExportProviderRegistration(
  value: unknown
): ExtensionHostProtocolExportProviderRegistration {
  const record = expectRecord(value, "Extension host export provider registration");

  return {
    format: normalizeExportFormat(record.format, "Extension host export provider format"),
    title: normalizeRequiredProtocolString(
      record.title,
      "Extension host export provider title",
      extensionHostProtocolLimits.exportTitleLength
    )
  };
}

function normalizeProtocolExportDocumentInput(value: unknown): ExtensionHostProtocolExportDocumentInput {
  const record = expectRecord(value, "Extension host export document input");
  const assetMode = normalizeOptionalExportAssetMode(record.assetMode, "Extension host export document asset mode");

  return {
    uri: normalizeProtocolUri(record.uri, "Extension host export document URI"),
    name: normalizeExportDocumentName(record.name, "Extension host export document name"),
    value: normalizeProtocolText(
      record.value,
      "Extension host export document value",
      extensionHostProtocolLimits.exportDocumentValueLength
    ),
    ...(assetMode ? { assetMode } : {})
  };
}

function normalizeProtocolExportedDocument(value: unknown): ExtensionHostProtocolExportedDocument {
  const record = expectRecord(value, "Extension host exported document");
  const assets = normalizeOptionalProtocolExportedDocumentAssets(record.assets);

  return {
    format: normalizeExportFormat(record.format, "Extension host exported document format"),
    defaultFileName: normalizeExportDefaultFileName(record.defaultFileName),
    mimeType: normalizeExportMimeType(record.mimeType),
    value: normalizeProtocolText(
      record.value,
      "Extension host exported document value",
      extensionHostProtocolLimits.exportDocumentValueLength
    ),
    ...(assets.length > 0 ? { assets } : {})
  };
}

function normalizeOptionalProtocolExportedDocumentAssets(
  value: unknown
): readonly ExtensionHostProtocolExportedDocumentAsset[] {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new Error("Extension host exported document assets must be an array");
  }

  if (value.length > extensionHostProtocolLimits.exportAssetCount) {
    throw new Error(
      `Extension host exported document assets must contain at most ${extensionHostProtocolLimits.exportAssetCount} items`
    );
  }

  return value.map((item, index) => normalizeProtocolExportedDocumentAsset(item, index));
}

function normalizeProtocolExportedDocumentAsset(
  value: unknown,
  index: number
): ExtensionHostProtocolExportedDocumentAsset {
  const record = expectRecord(value, `Extension host exported document asset ${index + 1}`);

  return {
    relativePath: normalizeExportAssetRelativePath(record.relativePath, index),
    mimeType: normalizeImageMimeType(record.mimeType, `Extension host exported document asset ${index + 1} MIME type`),
    base64: normalizeBase64(record.base64, `Extension host exported document asset ${index + 1} base64`)
  };
}

function normalizeProtocolMarkdownRendererRegistration(
  value: unknown
): ExtensionHostProtocolMarkdownRendererRegistration {
  const record = expectRecord(value, "Extension host Markdown renderer registration");
  const id = normalizeMarkdownRendererId(record.id, "Extension host Markdown renderer registration id");
  const metadata = normalizeOptionalProtocolMarkdownRendererRuntimeMetadata(record.metadata, id);

  return {
    id,
    ...(metadata ? { metadata } : {})
  };
}

function normalizeOptionalProtocolMarkdownRendererRuntimeMetadata(
  value: unknown,
  rendererId: string
): ExtensionHostProtocolMarkdownRendererRuntimeMetadata | undefined {
  if (value === undefined) {
    return undefined;
  }

  const record = expectRecord(value, `Extension host Markdown renderer metadata for ${rendererId}`);
  const language = normalizeOptionalMarkdownRendererLanguage(record.language, rendererId);
  const priority = normalizeOptionalProtocolNumber(
    record.priority,
    `Extension host Markdown renderer priority for ${rendererId}`,
    extensionHostProtocolLimits.markdownRendererPriorityMin,
    extensionHostProtocolLimits.markdownRendererPriorityMax
  );

  return {
    label: normalizeRequiredProtocolString(
      record.label,
      `Extension host Markdown renderer label for ${rendererId}`,
      extensionHostProtocolLimits.markdownRendererLabelLength
    ),
    kind: normalizeMarkdownRendererKind(record.kind, rendererId),
    ...(language ? { language } : {}),
    ...(priority !== undefined ? { priority } : {})
  };
}

function normalizeProtocolMarkdownRendererInput(value: unknown): ExtensionHostProtocolMarkdownRendererInput {
  const record = expectRecord(value, "Extension host Markdown renderer input");
  const language = normalizeOptionalMarkdownRendererLanguage(record.language, "input");
  const uri = normalizeOptionalProtocolUri(record.uri, "Extension host Markdown renderer input URI");

  return {
    value: normalizeProtocolText(
      record.value,
      "Extension host Markdown renderer input value",
      extensionHostProtocolLimits.markdownRendererValueLength
    ),
    ...(language ? { language } : {}),
    ...(uri ? { uri } : {})
  };
}

function normalizeProtocolMarkdownRendererOutput(value: unknown): ExtensionHostProtocolMarkdownRendererOutput {
  const record = expectRecord(value, "Extension host Markdown renderer output");

  return {
    html: normalizeProtocolText(
      record.html,
      "Extension host Markdown renderer output HTML",
      extensionHostProtocolLimits.markdownRendererHtmlLength
    )
  };
}

function normalizeExportFormat(value: unknown, label: string): string {
  const format = normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.exportFormatLength);

  if (!/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/.test(format)) {
    throw new Error(`${label} is invalid: ${format}`);
  }

  return format.toLowerCase();
}

function normalizeExportDocumentName(value: unknown, label: string): string {
  return normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.exportDocumentNameLength);
}

function normalizeExportDefaultFileName(value: unknown): string {
  const fileName = normalizeRequiredProtocolString(
    value,
    "Extension host exported document default file name",
    extensionHostProtocolLimits.exportDefaultFileNameLength
  );

  if (/[\\/<>:"|?*\u0000-\u001f]/.test(fileName) || fileName === "." || fileName === "..") {
    throw new Error(`Extension host exported document default file name is invalid: ${fileName}`);
  }

  return fileName;
}

function normalizeExportMimeType(value: unknown): string {
  return normalizeMimeType(value, "Extension host exported document MIME type");
}

function normalizeImageMimeType(value: unknown, label: string): string {
  const mimeType = normalizeMimeType(value, label);

  if (!/^image\//i.test(mimeType)) {
    throw new Error(`${label} must be an image MIME type`);
  }

  return mimeType;
}

function normalizeMimeType(value: unknown, label: string): string {
  const mimeType = normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.exportMimeTypeLength);

  if (!/^[A-Za-z0-9][A-Za-z0-9.+-]*\/[A-Za-z0-9][A-Za-z0-9.+-]*(?:;[A-Za-z0-9_.-]+=[A-Za-z0-9_.+-]+)*$/.test(mimeType)) {
    throw new Error(`${label} is invalid: ${mimeType}`);
  }

  return mimeType;
}

function normalizeExportAssetRelativePath(value: unknown, index: number): string {
  const relativePath = normalizeRequiredProtocolString(
    value,
    `Extension host exported document asset ${index + 1} relative path`,
    extensionHostProtocolLimits.exportAssetRelativePathLength
  ).replaceAll("\\", "/");

  if (
    relativePath.startsWith("/") ||
    /^[A-Za-z]:/.test(relativePath) ||
    /^[A-Za-z][A-Za-z0-9+.-]*:/.test(relativePath) ||
    /[<>:"|?*\u0000-\u001f]/.test(relativePath)
  ) {
    throw new Error(`Extension host exported document asset ${index + 1} relative path is invalid: ${relativePath}`);
  }

  const segments = relativePath.split("/");

  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new Error(`Extension host exported document asset ${index + 1} relative path is invalid: ${relativePath}`);
  }

  return relativePath;
}

function normalizeBase64(value: unknown, label: string): string {
  const base64 = normalizeProtocolText(value, label, extensionHostProtocolLimits.exportAssetBase64Length).trim();

  if (!base64) {
    throw new Error(`${label} must not be empty`);
  }

  if (base64.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
    throw new Error(`${label} must be valid base64`);
  }

  return base64;
}

function normalizeOptionalExportAssetMode(value: unknown, label: string): ExportAssetMode | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "inline" && value !== "file") {
    throw new Error(`${label} must be inline or file`);
  }

  return value;
}

function normalizeMarkdownRendererId(value: unknown, label: string): string {
  const id = normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.markdownRendererIdLength);

  if (!/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(id)) {
    throw new Error(`${label} is invalid: ${id}`);
  }

  return id;
}

function normalizeMarkdownRendererKind(value: unknown, rendererId: string): MarkdownRendererKind {
  if (value !== "block" && value !== "inline") {
    throw new Error(`Extension host Markdown renderer kind for ${rendererId} must be block or inline`);
  }

  return value;
}

function normalizeOptionalMarkdownRendererLanguage(value: unknown, rendererId: string): string | undefined {
  const language = normalizeOptionalProtocolString(
    value,
    `Extension host Markdown renderer language for ${rendererId}`,
    extensionHostProtocolLimits.markdownRendererLanguageLength
  );

  if (language === undefined) {
    return undefined;
  }

  if (!/^[A-Za-z0-9][A-Za-z0-9_.+-]*$/.test(language)) {
    throw new Error(`Extension host Markdown renderer language for ${rendererId} is invalid: ${language}`);
  }

  return language.toLowerCase();
}

function normalizeOptionalProtocolNumber(
  value: unknown,
  label: string,
  min: number,
  max: number
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${label} must be a finite number`);
  }

  if (value < min || value > max) {
    throw new Error(`${label} must be between ${min} and ${max}`);
  }

  return value;
}

function normalizeProtocolUri(value: unknown, label: string): string {
  return normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.exportDocumentUriLength);
}

function normalizeOptionalProtocolUri(value: unknown, label: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeProtocolUri(value, label);
}

function normalizeProtocolText(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  if (value.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }

  return value;
}

function normalizeCommandId(value: unknown, label: string): string {
  return normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.commandIdLength);
}

function normalizeExtensionId(value: unknown, label: string): string {
  return normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.extensionIdLength);
}

function normalizeRequestId(value: unknown, label: string): string {
  return normalizeRequiredProtocolString(value, label, extensionHostProtocolLimits.requestIdLength);
}

function normalizeExtensionOwnedContextKey(extensionId: string, value: unknown): string {
  const key = normalizeRequiredProtocolString(
    value,
    "Extension host context key",
    extensionHostProtocolLimits.contextKeyLength
  );
  const prefix = `${extensionId}.`;

  if (!key.startsWith(prefix) || key.length === prefix.length) {
    throw new Error(`Extension host context key must start with "${prefix}": ${key}`);
  }

  if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(key)) {
    throw new Error(`Extension host context key is invalid: ${key}`);
  }

  return key;
}

function normalizeContextKeyValue(value: unknown, label: string): ContextKeyValue {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw new Error(`${label} must be a primitive context key value`);
}

function normalizeProtocolJsonArray(
  value: unknown,
  label: string,
  maxItems: number
): readonly ExtensionHostProtocolJsonValue[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  if (value.length > maxItems) {
    throw new Error(`${label} must contain at most ${maxItems} items`);
  }

  return value.map((item, index) => normalizeProtocolJsonValue(item, `${label} item ${index + 1}`));
}

function normalizeProtocolJsonValue(
  value: unknown,
  label: string,
  depth = 0
): ExtensionHostProtocolJsonValue {
  if (depth > extensionHostProtocolLimits.jsonDepth) {
    throw new Error(`${label} exceeds maximum JSON depth`);
  }

  if (value === null || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be a finite number`);
    }

    return value;
  }

  if (typeof value === "string") {
    if (value.length > extensionHostProtocolLimits.jsonStringLength) {
      throw new Error(`${label} string must be at most ${extensionHostProtocolLimits.jsonStringLength} characters`);
    }

    return value;
  }

  if (Array.isArray(value)) {
    if (value.length > extensionHostProtocolLimits.jsonArrayItems) {
      throw new Error(`${label} array must contain at most ${extensionHostProtocolLimits.jsonArrayItems} items`);
    }

    return value.map((item, index) => normalizeProtocolJsonValue(item, `${label}[${index}]`, depth + 1));
  }

  if (typeof value === "object" && value !== null) {
    if (!isPlainProtocolObject(value)) {
      throw new Error(`${label} must be a plain JSON object`);
    }

    const entries = Object.entries(value as Record<string, unknown>);

    if (entries.length > extensionHostProtocolLimits.jsonObjectProperties) {
      throw new Error(`${label} object must contain at most ${extensionHostProtocolLimits.jsonObjectProperties} properties`);
    }

    const result: Record<string, ExtensionHostProtocolJsonValue> = {};

    for (const [key, item] of entries) {
      const normalizedKey = normalizeRequiredProtocolString(
        key,
        `${label} property name`,
        extensionHostProtocolLimits.jsonPropertyNameLength
      );
      result[normalizedKey] = normalizeProtocolJsonValue(item, `${label}.${normalizedKey}`, depth + 1);
    }

    return result;
  }

  throw new Error(`${label} must be JSON serializable`);
}

function normalizeBoolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean`);
  }

  return value;
}

function normalizeExtensionActivationState(value: unknown): ExtensionActivationState {
  if (value !== "inactive" && value !== "activating" && value !== "activated" && value !== "failed") {
    throw new Error(`Extension host protocol activation state is invalid: ${String(value)}`);
  }

  return value;
}

function normalizeProtocolStringArray(
  value: unknown,
  label: string,
  maxItems: number,
  maxLength: number
): readonly string[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }

  if (value.length > maxItems) {
    throw new Error(`${label} must contain at most ${maxItems} items`);
  }

  return value.map((item, index) =>
    normalizeRequiredProtocolString(item, `${label} item ${index + 1}`, maxLength)
  );
}

function expectRecord(value: unknown, label: string): UnknownRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as UnknownRecord;
}

function normalizeRequiredProtocolString(value: unknown, label: string, maxLength: number): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  if (normalized.length > maxLength) {
    throw new Error(`${label} must be at most ${maxLength} characters`);
  }

  return normalized;
}

function normalizeOptionalProtocolString(value: unknown, label: string, maxLength: number): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeRequiredProtocolString(value, label, maxLength);
}

function truncateProtocolString(value: string, maxLength: number): string {
  return value.length > maxLength ? value.slice(0, maxLength) : value;
}

function isPlainProtocolObject(value: object): boolean {
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
