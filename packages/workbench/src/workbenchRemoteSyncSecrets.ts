import {
  remoteSyncMaxSecretRefLength,
  type NativeRemoteSyncSecretBridge
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchActionRunnerMessages,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchRemoteSyncSecretCallbacks {
  readonly actionRunnerMessages?: WorkbenchActionRunnerMessages;
  readonly messages?: WorkbenchRemoteSyncSecretMessages;
  readonly setOperationError: WorkbenchOperationErrorSetter;
}

export interface WorkbenchRemoteSyncSecretMessages {
  readonly referenceInvalid: string;
  readonly storageUnavailable: string;
  readonly valueEmpty: string;
}

export const defaultWorkbenchRemoteSyncSecretMessages: WorkbenchRemoteSyncSecretMessages = {
  referenceInvalid: "Remote sync secret reference is invalid",
  storageUnavailable: "Remote sync secret storage is unavailable",
  valueEmpty: "Remote sync secret value must not be empty"
};

export interface WorkbenchRemoteSyncSecretBridge {
  readonly isAvailable: boolean;
  setSecret(secretRef: string, value: string): Promise<boolean>;
  deleteSecret(secretRef: string): Promise<boolean>;
}

export function createWorkbenchRemoteSyncSecretActions(
  callbacks: WorkbenchRemoteSyncSecretCallbacks,
  bridge: WorkbenchRemoteSyncSecretBridge | undefined = createNativeWorkbenchRemoteSyncSecretBridge()
): {
  readonly isAvailable: boolean;
  readonly setSecret: (secretRef: string, value: string) => Promise<boolean>;
  readonly deleteSecret: (secretRef: string) => Promise<boolean>;
} {
  return {
    isAvailable: !!bridge?.isAvailable,
    setSecret: (secretRef, value) => runWorkbenchAction(
      () => setWorkbenchRemoteSyncSecret(bridge, secretRef, value, callbacks.messages).then(() => true),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ).then(Boolean),
    deleteSecret: (secretRef) => runWorkbenchAction(
      () => deleteWorkbenchRemoteSyncSecret(bridge, secretRef, callbacks.messages).then(() => true),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ).then(Boolean)
  };
}

export async function setWorkbenchRemoteSyncSecret(
  bridge: WorkbenchRemoteSyncSecretBridge | undefined,
  secretRef: string,
  value: string,
  messages: WorkbenchRemoteSyncSecretMessages = defaultWorkbenchRemoteSyncSecretMessages
): Promise<void> {
  const availableBridge = requireWorkbenchRemoteSyncSecretBridge(bridge, messages);
  const normalizedSecretRef = normalizeWorkbenchRemoteSyncSecretRef(secretRef, messages);
  const normalizedValue = normalizeWorkbenchRemoteSyncSecretValue(value, messages);
  await availableBridge.setSecret(normalizedSecretRef, normalizedValue);
}

export async function deleteWorkbenchRemoteSyncSecret(
  bridge: WorkbenchRemoteSyncSecretBridge | undefined,
  secretRef: string,
  messages: WorkbenchRemoteSyncSecretMessages = defaultWorkbenchRemoteSyncSecretMessages
): Promise<void> {
  const availableBridge = requireWorkbenchRemoteSyncSecretBridge(bridge, messages);
  await availableBridge.deleteSecret(normalizeWorkbenchRemoteSyncSecretRef(secretRef, messages));
}

export function createNativeWorkbenchRemoteSyncSecretBridge(): WorkbenchRemoteSyncSecretBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly remoteSyncSecrets?: NativeRemoteSyncSecretBridge;
    };
  };
  const bridge = candidate.typoraPlus?.remoteSyncSecrets;

  if (!bridge?.isAvailable) {
    return undefined;
  }

  return {
    isAvailable: bridge.isAvailable,
    deleteSecret: (secretRef) => bridge.deleteSecret(secretRef),
    setSecret: (secretRef, value) => bridge.setSecret(secretRef, value)
  };
}

function requireWorkbenchRemoteSyncSecretBridge(
  bridge: WorkbenchRemoteSyncSecretBridge | undefined,
  messages: WorkbenchRemoteSyncSecretMessages
): WorkbenchRemoteSyncSecretBridge {
  if (!bridge?.isAvailable) {
    throw new Error(messages.storageUnavailable);
  }

  return bridge;
}

function normalizeWorkbenchRemoteSyncSecretRef(
  value: string,
  messages: WorkbenchRemoteSyncSecretMessages
): string {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > remoteSyncMaxSecretRefLength ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)
  ) {
    throw new Error(messages.referenceInvalid);
  }

  return normalized;
}

function normalizeWorkbenchRemoteSyncSecretValue(
  value: string,
  messages: WorkbenchRemoteSyncSecretMessages
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(messages.valueEmpty);
  }

  return normalized;
}
