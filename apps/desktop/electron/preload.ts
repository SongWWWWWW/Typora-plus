import { contextBridge, ipcRenderer, type IpcRendererEvent } from "electron";
import { nativeFileIpcChannels } from "./nativeFileIpc.js";

contextBridge.exposeInMainWorld("typoraPlus", {
  platform: process.platform,
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
