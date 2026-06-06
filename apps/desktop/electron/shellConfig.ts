export const desktopShellConfig = {
  devServerUrl: "http://127.0.0.1:5173",
  window: {
    width: 1220,
    height: 820,
    minWidth: 860,
    minHeight: 560,
    title: "Typora Plus",
    backgroundColor: "#f8f7f2"
  },
  workspace: {
    maxDepth: 8,
    maxFiles: 5000,
    markdownExtensions: [".md", ".markdown", ".mdown"],
    ignoredDirectories: [".git", ".typora-plus", "node_modules", "dist", "dist-electron"]
  }
} as const;
