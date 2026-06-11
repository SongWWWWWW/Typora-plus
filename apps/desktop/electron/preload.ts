import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { nativeAiIpcChannels } from "./nativeAiIpc.js";
import { nativeConfigurationIpcChannels } from "./nativeConfigurationIpc.js";
import { nativeExportIpcChannels } from "./nativeExportIpc.js";
import { nativeFileIpcChannels } from "./nativeFileIpc.js";
import { nativeIndexSnapshotIpcChannels } from "./nativeIndexSnapshotIpc.js";
import { nativeRemoteSyncManifestIpcChannels } from "./nativeRemoteSyncManifestIpc.js";

contextBridge.exposeInMainWorld("typoraPlus", {
  platform: process.platform,
  ai: {
    isAvailable: true,
    setSecret: (secretRef: string, value: string) =>
      ipcRenderer.invoke(nativeAiIpcChannels.setSecret, secretRef, value),
    deleteSecret: (secretRef: string) =>
      ipcRenderer.invoke(nativeAiIpcChannels.deleteSecret, secretRef),
    cancelResponses: (requestId: string) =>
      ipcRenderer.send(nativeAiIpcChannels.cancelResponses, requestId),
    requestResponses: (request: {
      readonly requestId: string;
      readonly endpointUrl: string;
      readonly secretRef: string;
      readonly body: string;
    }) => ipcRenderer.invoke(nativeAiIpcChannels.requestResponses, request)
  },
  configuration: {
    isAvailable: true,
    read: (key: string) => ipcRenderer.sendSync(nativeConfigurationIpcChannels.read, key),
    write: (key: string, value: string) => ipcRenderer.sendSync(nativeConfigurationIpcChannels.write, key, value)
  },
  indexSnapshots: {
    isAvailable: true,
    read: (key: string) => ipcRenderer.sendSync(nativeIndexSnapshotIpcChannels.read, key),
    write: (key: string, value: string) => ipcRenderer.sendSync(nativeIndexSnapshotIpcChannels.write, key, value)
  },
  remoteSyncManifests: {
    isAvailable: true,
    read: (key: string) => ipcRenderer.sendSync(nativeRemoteSyncManifestIpcChannels.read, key),
    write: (key: string, value: string) =>
      ipcRenderer.sendSync(nativeRemoteSyncManifestIpcChannels.write, key, value)
  },
  documentExport: {
    isAvailable: true,
    saveDocument: (document: unknown) => ipcRenderer.invoke(nativeExportIpcChannels.saveDocument, document)
  },
  fileSystem: {
    isAvailable: true,
    onDidChangeWorkspaceFiles: (listener: (workspace: unknown) => void) => {
      const wrappedListener = (_event: IpcRendererEvent, workspace: unknown) => listener(workspace);
      ipcRenderer.on(nativeFileIpcChannels.workspaceChanged, wrappedListener);
      return () => ipcRenderer.removeListener(nativeFileIpcChannels.workspaceChanged, wrappedListener);
    },
    openWorkspace: () => ipcRenderer.invoke(nativeFileIpcChannels.openWorkspace),
    openRecentWorkspace: (uri: string) => ipcRenderer.invoke(nativeFileIpcChannels.openRecentWorkspace, uri),
    refreshWorkspace: () => ipcRenderer.invoke(nativeFileIpcChannels.refreshWorkspace),
    readFile: (uri: string) => ipcRenderer.invoke(nativeFileIpcChannels.readFile, uri),
    writeFile: (uri: string, value: string, options?: { readonly expectedMtime?: number; readonly overwrite?: boolean }) =>
      ipcRenderer.invoke(nativeFileIpcChannels.writeFile, uri, value, options),
    saveFileAs: (defaultName: string, value: string) => ipcRenderer.invoke(nativeFileIpcChannels.saveFileAs, defaultName, value)
  },
  attachments: {
    isAvailable: true,
    saveImage: (noteUri: string, image: { readonly name: string; readonly mimeType: string; readonly base64: string }, assetFolder: string) =>
      ipcRenderer.invoke(nativeFileIpcChannels.saveAttachment, noteUri, image, assetFolder)
  },
  resources: {
    isAvailable: true,
    resolveImage: (noteUri: string, source: string) =>
      ipcRenderer.invoke(nativeFileIpcChannels.resolveImageResource, noteUri, source)
  }
});
