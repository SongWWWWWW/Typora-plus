import {
  configurationMaxAiProviderSecretRefLength,
  type NativeResponsesAiBridge
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchActionRunnerMessages,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchAiSecretCallbacks {
  readonly actionRunnerMessages?: WorkbenchActionRunnerMessages;
  readonly messages?: WorkbenchAiSecretMessages;
  readonly setOperationError: WorkbenchOperationErrorSetter;
}

export interface WorkbenchAiSecretMessages {
  readonly referenceInvalid: string;
  readonly storageUnavailable: string;
  readonly valueEmpty: string;
}

export const defaultWorkbenchAiSecretMessages: WorkbenchAiSecretMessages = {
  referenceInvalid: "AI secret reference is invalid",
  storageUnavailable: "AI secret storage is unavailable",
  valueEmpty: "AI secret value must not be empty"
};

export interface WorkbenchAiSecretBridge {
  readonly isAvailable: boolean;
  setSecret(secretRef: string, value: string): Promise<boolean>;
  deleteSecret(secretRef: string): Promise<boolean>;
}

export function createWorkbenchAiSecretActions(
  callbacks: WorkbenchAiSecretCallbacks,
  bridge: WorkbenchAiSecretBridge | undefined = createNativeWorkbenchAiSecretBridge()
): {
  readonly isAvailable: boolean;
  readonly setSecret: (secretRef: string, value: string) => Promise<boolean>;
  readonly deleteSecret: (secretRef: string) => Promise<boolean>;
} {
  return {
    isAvailable: !!bridge?.isAvailable,
    setSecret: (secretRef, value) => runWorkbenchAction(
      () => setWorkbenchAiProviderSecret(bridge, secretRef, value, callbacks.messages).then(() => true),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ).then(Boolean),
    deleteSecret: (secretRef) => runWorkbenchAction(
      () => deleteWorkbenchAiProviderSecret(bridge, secretRef, callbacks.messages).then(() => true),
      callbacks.setOperationError,
      undefined,
      callbacks.actionRunnerMessages
    ).then(Boolean)
  };
}

export async function setWorkbenchAiProviderSecret(
  bridge: WorkbenchAiSecretBridge | undefined,
  secretRef: string,
  value: string,
  messages: WorkbenchAiSecretMessages = defaultWorkbenchAiSecretMessages
): Promise<void> {
  const availableBridge = requireWorkbenchAiSecretBridge(bridge, messages);
  const normalizedSecretRef = normalizeWorkbenchAiSecretRef(secretRef, messages);
  const normalizedValue = normalizeWorkbenchAiSecretValue(value, messages);
  await availableBridge.setSecret(normalizedSecretRef, normalizedValue);
}

export async function deleteWorkbenchAiProviderSecret(
  bridge: WorkbenchAiSecretBridge | undefined,
  secretRef: string,
  messages: WorkbenchAiSecretMessages = defaultWorkbenchAiSecretMessages
): Promise<void> {
  const availableBridge = requireWorkbenchAiSecretBridge(bridge, messages);
  await availableBridge.deleteSecret(normalizeWorkbenchAiSecretRef(secretRef, messages));
}

export function createNativeWorkbenchAiSecretBridge(): WorkbenchAiSecretBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly ai?: Pick<NativeResponsesAiBridge, "deleteSecret" | "isAvailable" | "setSecret">;
    };
  };
  const bridge = candidate.typoraPlus?.ai;

  if (!bridge?.isAvailable) {
    return undefined;
  }

  return {
    isAvailable: bridge.isAvailable,
    deleteSecret: (secretRef) => bridge.deleteSecret(secretRef),
    setSecret: (secretRef, value) => bridge.setSecret(secretRef, value)
  };
}

function requireWorkbenchAiSecretBridge(
  bridge: WorkbenchAiSecretBridge | undefined,
  messages: WorkbenchAiSecretMessages
): WorkbenchAiSecretBridge {
  if (!bridge?.isAvailable) {
    throw new Error(messages.storageUnavailable);
  }

  return bridge;
}

function normalizeWorkbenchAiSecretRef(value: string, messages: WorkbenchAiSecretMessages): string {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > configurationMaxAiProviderSecretRefLength ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)
  ) {
    throw new Error(messages.referenceInvalid);
  }

  return normalized;
}

function normalizeWorkbenchAiSecretValue(value: string, messages: WorkbenchAiSecretMessages): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(messages.valueEmpty);
  }

  return normalized;
}
