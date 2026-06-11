import {
  remoteSyncMaxSecretRefLength,
  type NativeRemoteSyncSecretBridge
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchRemoteSyncSecretCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
}

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
      () => setWorkbenchRemoteSyncSecret(bridge, secretRef, value).then(() => true),
      callbacks.setOperationError
    ).then(Boolean),
    deleteSecret: (secretRef) => runWorkbenchAction(
      () => deleteWorkbenchRemoteSyncSecret(bridge, secretRef).then(() => true),
      callbacks.setOperationError
    ).then(Boolean)
  };
}

export async function setWorkbenchRemoteSyncSecret(
  bridge: WorkbenchRemoteSyncSecretBridge | undefined,
  secretRef: string,
  value: string
): Promise<void> {
  const availableBridge = requireWorkbenchRemoteSyncSecretBridge(bridge);
  const normalizedSecretRef = normalizeWorkbenchRemoteSyncSecretRef(secretRef);
  const normalizedValue = normalizeWorkbenchRemoteSyncSecretValue(value);
  await availableBridge.setSecret(normalizedSecretRef, normalizedValue);
}

export async function deleteWorkbenchRemoteSyncSecret(
  bridge: WorkbenchRemoteSyncSecretBridge | undefined,
  secretRef: string
): Promise<void> {
  const availableBridge = requireWorkbenchRemoteSyncSecretBridge(bridge);
  await availableBridge.deleteSecret(normalizeWorkbenchRemoteSyncSecretRef(secretRef));
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
  bridge: WorkbenchRemoteSyncSecretBridge | undefined
): WorkbenchRemoteSyncSecretBridge {
  if (!bridge?.isAvailable) {
    throw new Error("Remote sync secret storage is unavailable");
  }

  return bridge;
}

function normalizeWorkbenchRemoteSyncSecretRef(value: string): string {
  const normalized = value.trim();

  if (
    !normalized ||
    normalized.length > remoteSyncMaxSecretRefLength ||
    !/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/.test(normalized)
  ) {
    throw new Error("Remote sync secret reference is invalid");
  }

  return normalized;
}

function normalizeWorkbenchRemoteSyncSecretValue(value: string): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Remote sync secret value must not be empty");
  }

  return normalized;
}
