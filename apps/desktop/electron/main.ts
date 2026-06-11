import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow } from "electron";
import { registerNativeAiIpc } from "./nativeAiIpc.js";
import { registerNativeConfigurationIpc } from "./nativeConfigurationIpc.js";
import { registerNativeExportIpc } from "./nativeExportIpc.js";
import { registerNativeFileIpc } from "./nativeFileIpc.js";
import { registerNativeIndexSnapshotIpc } from "./nativeIndexSnapshotIpc.js";
import { registerNativeRemoteSyncManifestIpc } from "./nativeRemoteSyncManifestIpc.js";
import { registerNativeRemoteSyncRequestIpc } from "./nativeRemoteSyncRequestIpc.js";
import { registerNativeRemoteSyncSecretIpc } from "./nativeRemoteSyncSecretIpc.js";
import { desktopShellConfig } from "./shellConfig.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));

registerNativeAiIpc(desktopShellConfig.ai);
registerNativeConfigurationIpc(desktopShellConfig.configuration);
registerNativeExportIpc(desktopShellConfig.exportDocuments);
registerNativeIndexSnapshotIpc(desktopShellConfig.indexSnapshots);
registerNativeRemoteSyncManifestIpc(desktopShellConfig.remoteSyncManifests);
registerNativeRemoteSyncRequestIpc({
  ...desktopShellConfig.remoteSyncSecrets,
  ...desktopShellConfig.remoteSyncRequests
});
registerNativeRemoteSyncSecretIpc(desktopShellConfig.remoteSyncSecrets);
registerNativeFileIpc(desktopShellConfig.workspace);

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    ...desktopShellConfig.window,
    webPreferences: {
      preload: path.join(currentDir, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    await window.loadFile(path.resolve(currentDir, "../dist/renderer/index.html"));
  } else {
    await window.loadURL(desktopShellConfig.devServerUrl);
  }
}

app.whenReady().then(async () => {
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
