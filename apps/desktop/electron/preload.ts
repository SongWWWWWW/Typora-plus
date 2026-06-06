import { contextBridge, ipcRenderer } from "electron";
import { nativeFileIpcChannels } from "./nativeFileIpc.js";

contextBridge.exposeInMainWorld("typoraPlus", {
  platform: process.platform,
  fileSystem: {
    isAvailable: true,
    openWorkspace: () => ipcRenderer.invoke(nativeFileIpcChannels.openWorkspace),
    readFile: (uri: string) => ipcRenderer.invoke(nativeFileIpcChannels.readFile, uri),
    writeFile: (uri: string, value: string) => ipcRenderer.invoke(nativeFileIpcChannels.writeFile, uri, value),
    saveFileAs: (defaultName: string, value: string) => ipcRenderer.invoke(nativeFileIpcChannels.saveFileAs, defaultName, value)
  }
});
