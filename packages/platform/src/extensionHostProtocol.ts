import type { CommandMetadata } from "./commands";
import type { ContextKeyValue } from "./contextKeys";
import type { ExtensionActivationRequest, ExtensionActivationState, RegisteredExtension } from "./extensions";

export const extensionHostProtocolMessageTypes = {
  activate: "extensionHost/activate",
  activationError: "extensionHost/activationError",
  activationResult: "extensionHost/activationResult",
  apiError: "extensionHost/api/error",
  apiResult: "extensionHost/api/result",
  commandExecute: "extensionHost/command/execute",
  commandList: "extensionHost/command/list",
  commandRegister: "extensionHost/command/register",
  contextKeyGet: "extensionHost/contextKey/get",
  contextKeySet: "extensionHost/contextKey/set"
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
  extensionIdLength: 256,
  jsonArrayItems: 100,
  jsonDepth: 8,
  jsonObjectProperties: 100,
  jsonPropertyNameLength: 120,
  jsonStringLength: 20000,
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
  | ExtensionHostContextKeyGetRequestMessage
  | ExtensionHostContextKeySetRequestMessage;

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

export interface ExtensionHostProtocolCommandRegistration extends Pick<CommandMetadata, "id"> {
  readonly title?: string;
  readonly category?: string;
}

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
    case extensionHostProtocolMessageTypes.contextKeySet:
      return readContextKeySetRequestMessage(record);
    case extensionHostProtocolMessageTypes.contextKeyGet:
      return readContextKeyGetRequestMessage(record);
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
