import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu } from "electron";
import {
  configureInstalledSmokeUserData,
  readInstalledSmokeOptions,
  runInstalledSmoke
} from "./installedSmoke.js";
import { registerNativeAiIpc } from "./nativeAiIpc.js";
import { registerNativeConfigurationIpc } from "./nativeConfigurationIpc.js";
import { registerNativeExportIpc } from "./nativeExportIpc.js";
import { registerNativeFileIpc } from "./nativeFileIpc.js";
import { registerNativeIndexSnapshotIpc } from "./nativeIndexSnapshotIpc.js";
import { registerNativeRemoteSyncManifestIpc } from "./nativeRemoteSyncManifestIpc.js";
import { registerNativeRemoteSyncRequestIpc } from "./nativeRemoteSyncRequestIpc.js";
import { registerNativeRemoteSyncSecretIpc } from "./nativeRemoteSyncSecretIpc.js";
import { registerNativeWindowIpc } from "./nativeWindowIpc.js";
import { stopNativeLarkGatewayProcess } from "./nativeLarkGatewayProcess.js";
import { desktopShellConfig } from "./shellConfig.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const installedSmokeOptions = readInstalledSmokeOptions(process.argv);

configureInstalledSmokeUserData(app, installedSmokeOptions);

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
registerNativeWindowIpc();

Menu.setApplicationMenu(null);

async function createWindow({ show = true }: { readonly show?: boolean } = {}): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    ...desktopShellConfig.window,
    show,
    webPreferences: {
      preload: path.join(currentDir, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  if (app.isPackaged) {
    await window.loadFile(
      path.resolve(currentDir, "../dist/renderer/index.html"),
      installedSmokeOptions.enabled ? { query: { typoraPlusInstalledSmoke: "1" } } : undefined
    );
  } else {
    await window.loadURL(createRendererUrl(desktopShellConfig.devServerUrl));
  }

  return window;
}

function createRendererUrl(baseUrl: string): string {
  if (!installedSmokeOptions.enabled) {
    return baseUrl;
  }

  const url = new URL(baseUrl);
  url.searchParams.set("typoraPlusInstalledSmoke", "1");
  return url.toString();
}

app.whenReady().then(async () => {
  if (installedSmokeOptions.enabled) {
    await runInstalledSmoke({
      app,
      createWindow,
      options: installedSmokeOptions,
      trustedWorkspacesStorageFile: desktopShellConfig.workspace.trustedWorkspacesStorageFile
    });
    return;
  }

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

app.on("before-quit", () => {
  stopNativeLarkGatewayProcess();
});
