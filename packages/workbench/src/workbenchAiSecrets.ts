import {
  configurationMaxAiProviderSecretRefLength,
  type NativeResponsesAiBridge
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchAiSecretCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
}

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
      () => setWorkbenchAiProviderSecret(bridge, secretRef, value).then(() => true),
      callbacks.setOperationError
    ).then(Boolean),
    deleteSecret: (secretRef) => runWorkbenchAction(
      () => deleteWorkbenchAiProviderSecret(bridge, secretRef).then(() => true),
      callbacks.setOperationError
    ).then(Boolean)
  };
}

export async function setWorkbenchAiProviderSecret(
  bridge: WorkbenchAiSecretBridge | undefined,
  secretRef: string,
  value: string
): Promise<void> {
  const availableBridge = requireWorkbenchAiSecretBridge(bridge);
  const normalizedSecretRef = normalizeWorkbenchAiSecretRef(secretRef);
  const normalizedValue = normalizeWorkbenchAiSecretValue(value);
  await availableBridge.setSecret(normalizedSecretRef, normalizedValue);
}

export async function deleteWorkbenchAiProviderSecret(
  bridge: WorkbenchAiSecretBridge | undefined,
  secretRef: string
): Promise<void> {
  const availableBridge = requireWorkbenchAiSecretBridge(bridge);
  await availableBridge.deleteSecret(normalizeWorkbenchAiSecretRef(secretRef));
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
  bridge: WorkbenchAiSecretBridge | undefined
): WorkbenchAiSecretBridge {
  if (!bridge?.isAvailable) {
    throw new Error("AI secret storage is unavailable");
  }

  return bridge;
}

function normalizeWorkbenchAiSecretRef(value: string): string {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > configurationMaxAiProviderSecretRefLength ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)
  ) {
    throw new Error("AI secret reference is invalid");
  }

  return normalized;
}

function normalizeWorkbenchAiSecretValue(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("AI secret value must not be empty");
  }

  return normalized;
}
