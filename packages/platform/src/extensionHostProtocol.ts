import type { ExtensionActivationRequest, ExtensionActivationState, RegisteredExtension } from "./extensions";

export const extensionHostProtocolMessageTypes = {
  activate: "extensionHost/activate",
  activationError: "extensionHost/activationError",
  activationResult: "extensionHost/activationResult"
} as const;

export const extensionHostProtocolLimits = {
  activationEventLength: 256,
  activationEvents: 200,
  displayNameLength: 120,
  errorMessageLength: 4000,
  errorNameLength: 120,
  errorStackLength: 20000,
  extensionIdLength: 256,
  requestIdLength: 120
} as const;

export type ExtensionHostProtocolMessage =
  | ExtensionHostActivationErrorMessage
  | ExtensionHostActivationRequestMessage
  | ExtensionHostActivationResultMessage;

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
