import { ipcMain } from "electron";
import {
  deleteNativeSecret,
  setNativeSecret,
  type NativeSecretStoreConfig
} from "./nativeSecretStore.js";

export const nativeRemoteSyncSecretIpcChannels = {
  deleteSecret: "typora-plus:remote-sync:secret:delete",
  setSecret: "typora-plus:remote-sync:secret:set"
} as const;

export type NativeRemoteSyncSecretConfig = NativeSecretStoreConfig;

const nativeRemoteSyncSecretLabel = "Remote sync";

export function registerNativeRemoteSyncSecretIpc(config: NativeRemoteSyncSecretConfig): void {
  ipcMain.handle(nativeRemoteSyncSecretIpcChannels.setSecret, async (_event, secretRef: string, value: string) => {
    setNativeSecret(config, nativeRemoteSyncSecretLabel, secretRef, value);
    return true;
  });

  ipcMain.handle(nativeRemoteSyncSecretIpcChannels.deleteSecret, async (_event, secretRef: string) => {
    deleteNativeSecret(config, nativeRemoteSyncSecretLabel, secretRef);
    return true;
  });
}
