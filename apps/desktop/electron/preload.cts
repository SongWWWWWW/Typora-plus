import type { IpcRendererEvent } from "electron";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

const nativeAiIpcChannels = {
  cancelResponses: "typora-plus:ai:responses:cancel",
  deleteSecret: "typora-plus:ai:secret:delete",
  requestResponses: "typora-plus:ai:responses:request",
  setSecret: "typora-plus:ai:secret:set"
} as const;

const nativeConfigurationIpcChannels = {
  read: "typora-plus:configuration:read",
  write: "typora-plus:configuration:write"
} as const;

const nativeExportIpcChannels = {
  saveDocument: "typora-plus:export:saveDocument"
} as const;

const nativeFileIpcChannels = {
  openWorkspace: "typora-plus:workspace:open",
  openRecentWorkspace: "typora-plus:workspace:openRecent",
  refreshWorkspace: "typora-plus:workspace:refresh",
  workspaceChanged: "typora-plus:workspace:changed",
  createDirectory: "typora-plus:workspace:createDirectory",
  createFile: "typora-plus:workspace:createFile",
  renameEntry: "typora-plus:workspace:renameEntry",
  deleteEntry: "typora-plus:workspace:deleteEntry",
  readFile: "typora-plus:file:read",
  resolveImageResource: "typora-plus:resource:image",
  writeFile: "typora-plus:file:write",
  saveFileAs: "typora-plus:file:saveAs",
  saveAttachment: "typora-plus:attachment:save",
  remoteSyncReadResource: "typora-plus:remote-sync-resource:read",
  remoteSyncWriteResource: "typora-plus:remote-sync-resource:write",
  remoteSyncDeleteResource: "typora-plus:remote-sync-resource:delete"
} as const;

const nativeIndexSnapshotIpcChannels = {
  read: "typora-plus:index-snapshot:read",
  write: "typora-plus:index-snapshot:write"
} as const;

const nativeRemoteSyncManifestIpcChannels = {
  read: "typora-plus:remote-sync-manifest:read",
  write: "typora-plus:remote-sync-manifest:write"
} as const;

const nativeRemoteSyncRequestIpcChannels = {
  cancel: "typora-plus:remote-sync:request:cancel",
  request: "typora-plus:remote-sync:request"
} as const;

const nativeRemoteSyncSecretIpcChannels = {
  deleteSecret: "typora-plus:remote-sync:secret:delete",
  setSecret: "typora-plus:remote-sync:secret:set"
} as const;

const nativeWindowIpcChannels = {
  setTitleBarTheme: "typora-plus:window:setTitleBarTheme"
} as const;

contextBridge.exposeInMainWorld("typoraPlus", {
  platform: process.platform,
  windowControls: {
    isAvailable: true,
    setTitleBarTheme: (theme: "light" | "dark") =>
      ipcRenderer.invoke(nativeWindowIpcChannels.setTitleBarTheme, theme)
  },
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
  remoteSyncSecrets: {
    isAvailable: true,
    setSecret: (secretRef: string, value: string) =>
      ipcRenderer.invoke(nativeRemoteSyncSecretIpcChannels.setSecret, secretRef, value),
    deleteSecret: (secretRef: string) =>
      ipcRenderer.invoke(nativeRemoteSyncSecretIpcChannels.deleteSecret, secretRef)
  },
  remoteSyncRequests: {
    isAvailable: true,
    request: (request: unknown) => ipcRenderer.invoke(nativeRemoteSyncRequestIpcChannels.request, request),
    cancel: (requestId: string) => ipcRenderer.send(nativeRemoteSyncRequestIpcChannels.cancel, requestId)
  },
  remoteSyncWorkspaceResources: {
    isAvailable: true,
    readResource: (request: unknown) =>
      ipcRenderer.invoke(nativeFileIpcChannels.remoteSyncReadResource, request),
    writeResource: (request: unknown) =>
      ipcRenderer.invoke(nativeFileIpcChannels.remoteSyncWriteResource, request),
    deleteResource: (request: unknown) =>
      ipcRenderer.invoke(nativeFileIpcChannels.remoteSyncDeleteResource, request)
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
    createDirectory: (request: { readonly parentUri: string; readonly name: string }) =>
      ipcRenderer.invoke(nativeFileIpcChannels.createDirectory, request),
    createFile: (request: { readonly parentUri: string; readonly name: string }) =>
      ipcRenderer.invoke(nativeFileIpcChannels.createFile, request),
    renameEntry: (request: { readonly uri: string; readonly name: string }) =>
      ipcRenderer.invoke(nativeFileIpcChannels.renameEntry, request),
    deleteEntry: (uri: string) => ipcRenderer.invoke(nativeFileIpcChannels.deleteEntry, uri),
    readFile: (uri: string) => ipcRenderer.invoke(nativeFileIpcChannels.readFile, uri),
    writeFile: (
      uri: string,
      value: string,
      options?: { readonly expectedMtime?: number; readonly overwrite?: boolean }
    ) => ipcRenderer.invoke(nativeFileIpcChannels.writeFile, uri, value, options),
    saveFileAs: (defaultName: string, value: string) =>
      ipcRenderer.invoke(nativeFileIpcChannels.saveFileAs, defaultName, value)
  },
  attachments: {
    isAvailable: true,
    saveImage: (
      noteUri: string,
      image: { readonly name: string; readonly mimeType: string; readonly base64: string },
      assetFolder: string
    ) => ipcRenderer.invoke(nativeFileIpcChannels.saveAttachment, noteUri, image, assetFolder)
  },
  resources: {
    isAvailable: true,
    resolveImage: (noteUri: string, source: string) =>
      ipcRenderer.invoke(nativeFileIpcChannels.resolveImageResource, noteUri, source)
  }
});
