export const desktopShellConfig = {
  devServerUrl: "http://127.0.0.1:5173",
  window: {
    width: 1220,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: "Typora Plus",
    autoHideMenuBar: true,
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#f8f7f2",
      symbolColor: "#676d62",
      height: 38
    },
    backgroundColor: "#f8f7f2"
  },
  ai: {
    secretsStorageFile: "ai-secrets.json",
    maxSecretBytes: 64 * 1024,
    maxRequestBytes: 5 * 1024 * 1024,
    maxResponseBytes: 5 * 1024 * 1024,
    requestTimeoutMs: 60_000
  },
  configuration: {
    storageFile: "configuration.json",
    maxValueBytes: 256 * 1024
  },
  indexSnapshots: {
    storageDirectory: "workspace-index",
    maxValueBytes: 5 * 1024 * 1024
  },
  remoteSyncManifests: {
    storageDirectory: "remote-sync-manifests",
    maxValueBytes: 1 * 1024 * 1024
  },
  remoteSyncSecrets: {
    secretsStorageFile: "remote-sync-secrets.json",
    maxSecretBytes: 64 * 1024
  },
  remoteSyncRequests: {
    maxHeaderCount: 32,
    maxHeaderValueBytes: 8 * 1024,
    maxRequestBytes: 10 * 1024 * 1024,
    maxResponseBytes: 25 * 1024 * 1024,
    maxSecretBindings: 8,
    requestTimeoutMs: 60_000
  },
  exportDocuments: {
    maxValueBytes: 10 * 1024 * 1024,
    maxAssetBytes: 5 * 1024 * 1024,
    maxAssetCount: 200,
    formats: [
      {
        format: "html",
        name: "HTML",
        extensions: ["html"]
      }
    ]
  },
  workspace: {
    maxDepth: 8,
    maxFiles: 5000,
    maxImagePreviewBytes: 5 * 1024 * 1024,
    maxRemoteSyncResourceBytes: 25 * 1024 * 1024,
    maxTrustedWorkspaces: 40,
    defaultAssetFolder: "assets",
    imagePreviewExtensions: [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"],
    trustedWorkspacesStorageFile: "trusted-workspaces.json",
    markdownExtensions: [".md", ".markdown", ".mdown"],
    ignoredDirectories: [".git", ".typora-plus", "node_modules", "dist", "dist-electron"]
  }
} as const;
