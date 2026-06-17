import fs from "node:fs/promises";
import path from "node:path";
import type { App, BrowserWindow } from "electron";

export const installedSmokeResultKind = "typora-plus.installedSmoke.result";
export const installedSmokeCliArgs = {
  enabled: "--typora-plus-installed-smoke",
  resultPath: "--typora-plus-installed-smoke-result-path=",
  userDataDir: "--typora-plus-installed-smoke-user-data-dir=",
  workspaceDir: "--typora-plus-installed-smoke-workspace-dir="
} as const;
export const installedSmokeHarnessError = "installedSmokeHarness";
export const installedSmokeRequiredChecks = [
  "isolatedUserData",
  "resultPath",
  "workspaceArgument",
  "rendererMounted",
  "preloadBridge",
  "bridge.ai",
  "bridge.attachments",
  "bridge.configuration",
  "bridge.documentExport",
  "bridge.fileSystem",
  "bridge.indexSnapshots",
  "bridge.remoteSyncManifests",
  "bridge.remoteSyncRequests",
  "bridge.remoteSyncSecrets",
  "bridge.remoteSyncWorkspaceResources",
  "bridge.resources",
  "configurationRoundTrip",
  "indexSnapshotRoundTrip",
  "remoteSyncManifestRoundTrip",
  "aiSecretSetDelete",
  "remoteSyncSecretSetDelete",
  "workspaceOpenRecent",
  "workspaceCreateDirectory",
  "workspaceCreateFile",
  "workspaceRenameEntry",
  "workspaceDeleteEntry",
  "workspaceUiCreateDirectory",
  "workspaceUiCreateFile",
  "workspaceUiSyncDirectoryMenu",
  "workspaceUiRenameEntry",
  "workspaceReadWriteFile",
  "workspaceImageResource",
  "remoteSyncWorkspaceResourceRead",
  "remoteSyncWorkspaceResourceWriteReadDelete"
] as const;

export interface InstalledSmokeOptions {
  readonly enabled: boolean;
  readonly resultPath?: string;
  readonly userDataDir?: string;
  readonly workspaceDir?: string;
}

export interface InstalledSmokeRunOptions {
  readonly app: App;
  readonly createWindow: (options?: { readonly show?: boolean }) => Promise<BrowserWindow>;
  readonly options: InstalledSmokeOptions;
  readonly trustedWorkspacesStorageFile: string;
}

interface InstalledSmokeRendererResult {
  readonly checks?: Record<string, boolean>;
  readonly errors?: readonly string[];
  readonly rootChildren?: number;
  readonly title?: string;
}

interface InstalledSmokeResult {
  readonly checks: Record<string, boolean>;
  readonly errors: readonly string[];
  readonly kind: typeof installedSmokeResultKind;
  readonly packaged: boolean;
  readonly passed: boolean;
  readonly platform: NodeJS.Platform;
  readonly title?: string;
}

export function readInstalledSmokeOptions(argv: readonly string[]): InstalledSmokeOptions {
  const options: InstalledSmokeOptions = {
    enabled: argv.includes(installedSmokeCliArgs.enabled)
  };
  const resultPath = readInstalledSmokeArgValue(argv, installedSmokeCliArgs.resultPath);
  const userDataDir = readInstalledSmokeArgValue(argv, installedSmokeCliArgs.userDataDir);
  const workspaceDir = readInstalledSmokeArgValue(argv, installedSmokeCliArgs.workspaceDir);
  const values = {
    ...(resultPath ? { resultPath } : {}),
    ...(userDataDir ? { userDataDir } : {}),
    ...(workspaceDir ? { workspaceDir } : {})
  };

  return { ...options, ...values };
}

export function configureInstalledSmokeUserData(app: App, options: InstalledSmokeOptions): void {
  if (options.enabled && options.userDataDir) {
    app.setPath("userData", options.userDataDir);
  }
}

export async function runInstalledSmoke({
  app,
  createWindow,
  options,
  trustedWorkspacesStorageFile
}: InstalledSmokeRunOptions): Promise<void> {
  const result = await createInstalledSmokeResult({
    app,
    createWindow,
    options,
    trustedWorkspacesStorageFile
  });

  if (options.resultPath) {
    await fs.mkdir(path.dirname(options.resultPath), { recursive: true });
    await fs.writeFile(options.resultPath, JSON.stringify(result, null, 2), "utf8");
  } else {
    console.error("Installed smoke result path was not provided");
  }

  app.exit(result.passed ? 0 : 1);
}

export function createInstalledSmokeFileUri(filePath: string): string {
  return `file://${encodeInstalledSmokeFileUriPath(path.resolve(filePath).replaceAll("\\", "/"))}`;
}

function encodeInstalledSmokeFileUriPath(value: string): string {
  return value
    .split("/")
    .map((segment, index) => index === 0 && /^[A-Za-z]:$/.test(segment)
      ? segment
      : encodeURIComponent(segment))
    .join("/");
}

export function createInstalledSmokeRendererOptions(options: InstalledSmokeOptions): Record<string, string> {
  return {
    ...(options.workspaceDir ? { workspaceUri: createInstalledSmokeFileUri(options.workspaceDir) } : {}),
    ...(process.env.TYPORA_PLUS_INSTALLED_SMOKE_SCREENSHOT_PATH ? { visualCheck: "true" } : {})
  };
}

export function findFailedInstalledSmokeChecks(checks: Readonly<Record<string, unknown>>): readonly string[] {
  return installedSmokeRequiredChecks.filter((check) => checks[check] !== true);
}

function readInstalledSmokeArgValue(argv: readonly string[], prefix: string): string | undefined {
  const value = argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length).trim();

  return value ? path.resolve(value) : undefined;
}

async function createInstalledSmokeResult({
  app,
  createWindow,
  options,
  trustedWorkspacesStorageFile
}: InstalledSmokeRunOptions): Promise<InstalledSmokeResult> {
  const errors: string[] = [];
  const checks: Record<string, boolean> = {
    isolatedUserData: Boolean(options.userDataDir),
    resultPath: Boolean(options.resultPath),
    workspaceArgument: Boolean(options.workspaceDir)
  };
  let title: string | undefined;

  try {
    if (options.workspaceDir) {
      await trustInstalledSmokeWorkspace(app, trustedWorkspacesStorageFile, options.workspaceDir);
    }

    const window = await createWindow({ show: shouldShowInstalledSmokeWindowForScreenshot() });
    const rendererResult = await runInstalledSmokeRendererChecks(window, options);
    await writeInstalledSmokeScreenshot(window);
    title = rendererResult.title;
    Object.assign(checks, rendererResult.checks);
    errors.push(...(rendererResult.errors ?? []));
  } catch {
    errors.push(installedSmokeHarnessError);
  }

  const passed = findFailedInstalledSmokeChecks(checks).length === 0 && errors.length === 0;

  const result: InstalledSmokeResult = {
    checks,
    errors,
    kind: installedSmokeResultKind,
    packaged: app.isPackaged,
    passed,
    platform: process.platform
  };

  return title ? { ...result, title } : result;
}

async function writeInstalledSmokeScreenshot(window: BrowserWindow): Promise<void> {
  const screenshotPath = process.env.TYPORA_PLUS_INSTALLED_SMOKE_SCREENSHOT_PATH?.trim();

  if (!screenshotPath) {
    return;
  }

  await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
  await new Promise((resolve) => setTimeout(resolve, 250));
  const image = await window.webContents.capturePage();
  await fs.writeFile(screenshotPath, image.toPNG());
}

function shouldShowInstalledSmokeWindowForScreenshot(): boolean {
  return !!process.env.TYPORA_PLUS_INSTALLED_SMOKE_SCREENSHOT_PATH?.trim();
}

async function runInstalledSmokeRendererChecks(
  window: BrowserWindow,
  options: InstalledSmokeOptions
): Promise<InstalledSmokeRendererResult> {
  return window.webContents.executeJavaScript(
    `(${installedSmokeRendererScript})(${JSON.stringify(createInstalledSmokeRendererOptions(options))})`,
    true
  ) as Promise<InstalledSmokeRendererResult>;
}

async function trustInstalledSmokeWorkspace(
  app: App,
  trustedWorkspacesStorageFile: string,
  workspaceDir: string
): Promise<void> {
  const storagePath = path.join(app.getPath("userData"), trustedWorkspacesStorageFile);

  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(
    storagePath,
    JSON.stringify({ version: 1, roots: [path.resolve(workspaceDir)] }, null, 2),
    "utf8"
  );
}

const installedSmokeRendererScript = String.raw`async function installedSmokeRendererScript(options = {}) {
  const checks = {};
  const errors = [];
  const bridge = window.typoraPlus;
  const record = async (id, run) => {
    try {
      checks[id] = Boolean(await run());
    } catch {
      checks[id] = false;
      errors.push(id);
    }
  };
  const waitForRenderer = () => new Promise((resolve) => {
    const startedAt = Date.now();
    const check = () => {
      if ((document.querySelector("#root")?.children.length ?? 0) > 0) {
        resolve(true);
        return;
      }

      if (Date.now() - startedAt > 5000) {
        resolve(false);
        return;
      }

      setTimeout(check, 50);
    };
    check();
  });
  const waitFor = (predicate, timeoutMs = 5000) => new Promise((resolve) => {
    const startedAt = Date.now();
    const check = async () => {
      try {
        if (await predicate()) {
          resolve(true);
          return;
        }
      } catch {
        // Keep polling until timeout; callers only need the final boolean.
      }

      if (Date.now() - startedAt > timeoutMs) {
        resolve(false);
        return;
      }

      setTimeout(check, 50);
    };
    void check();
  });
  const countWorkspaceDirectories = (entry) => {
    if (!entry || entry.kind !== "directory") {
      return 0;
    }

    return 1 + (entry.children ?? []).reduce((count, child) => count + countWorkspaceDirectories(child), 0);
  };
  const setNativeInputValue = (input, value) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  };

  await record("rendererMounted", waitForRenderer);
  await record("preloadBridge", () => Boolean(bridge));

  for (const key of [
    "ai",
    "attachments",
    "configuration",
    "documentExport",
    "fileSystem",
    "indexSnapshots",
    "remoteSyncManifests",
    "remoteSyncRequests",
    "remoteSyncSecrets",
    "remoteSyncWorkspaceResources",
    "resources"
  ]) {
    await record("bridge." + key, () => bridge?.[key]?.isAvailable === true);
  }

  await record("configurationRoundTrip", () => {
    const key = "typora-plus.installedSmoke.configuration";
    const value = JSON.stringify({ ok: true });
    bridge.configuration.write(key, value);
    return bridge.configuration.read(key) === value;
  });
  await record("indexSnapshotRoundTrip", () => {
    const key = "typora-plus.installedSmoke.index";
    const value = JSON.stringify({ indexed: true });
    bridge.indexSnapshots.write(key, value);
    return bridge.indexSnapshots.read(key) === value;
  });
  await record("remoteSyncManifestRoundTrip", () => {
    const key = "typora-plus.installedSmoke.remoteSyncManifest";
    const value = JSON.stringify({ synchronized: true });
    bridge.remoteSyncManifests.write(key, value);
    return bridge.remoteSyncManifests.read(key) === value;
  });
  await record("aiSecretSetDelete", async () => {
    const ref = "typoraPlus.installedSmoke.ai";
    await bridge.ai.setSecret(ref, "installed-smoke-secret-value");
    await bridge.ai.deleteSecret(ref);
    return true;
  });
  await record("remoteSyncSecretSetDelete", async () => {
    const ref = "typoraPlus.installedSmoke.remoteSync";
    await bridge.remoteSyncSecrets.setSecret(ref, "installed-smoke-secret-value");
    await bridge.remoteSyncSecrets.deleteSecret(ref);
    return true;
  });
  await record("workspaceOpenRecent", async () => {
    if (!options.workspaceUri) {
      return false;
    }

    const workspace = await bridge.fileSystem.openRecentWorkspace(options.workspaceUri);
    return workspace?.files?.some((file) => file.relativePath === "installed-smoke.md") === true;
  });
  await record("workspaceCreateDirectory", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const workspaceUri = workspace?.root?.uri;

    if (!workspaceUri) {
      return false;
    }

    const nextWorkspace = await bridge.fileSystem.createDirectory({
      parentUri: workspaceUri,
      name: "smoke-created-folder"
    });
    return nextWorkspace?.root?.children?.some((entry) =>
      entry.kind === "directory" && entry.relativePath === "smoke-created-folder"
    ) === true;
  });
  await record("workspaceCreateFile", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const workspaceUri = workspace?.root?.uri;

    if (!workspaceUri) {
      return false;
    }

    const folderWorkspace = await bridge.fileSystem.createDirectory({
      parentUri: workspaceUri,
      name: "smoke-file-folder"
    });
    const folder = folderWorkspace?.root?.children?.find((entry) =>
      entry.kind === "directory" && entry.relativePath === "smoke-file-folder"
    );

    if (!folder?.uri) {
      return false;
    }

    const created = await bridge.fileSystem.createFile({
      parentUri: folder.uri,
      name: "created-note"
    });
    return created?.entry?.relativePath === "smoke-file-folder/created-note.md" &&
      created.workspace?.files?.some((file) => file.relativePath === "smoke-file-folder/created-note.md") === true;
  });
  await record("workspaceRenameEntry", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const workspaceUri = workspace?.root?.uri;

    if (!workspaceUri) {
      return false;
    }

    const created = await bridge.fileSystem.createFile({
      parentUri: workspaceUri,
      name: "smoke-rename-source"
    });

    if (!created?.entry?.uri) {
      return false;
    }

    const renamed = await bridge.fileSystem.renameEntry({
      uri: created.entry.uri,
      name: "smoke-rename-target"
    });

    return renamed?.entry?.relativePath === "smoke-rename-target.md" &&
      renamed.workspace?.files?.some((file) => file.relativePath === "smoke-rename-target.md") === true;
  });
  await record("workspaceDeleteEntry", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const workspaceUri = workspace?.root?.uri;

    if (!workspaceUri) {
      return false;
    }

    const created = await bridge.fileSystem.createFile({
      parentUri: workspaceUri,
      name: "smoke-delete-target"
    });

    if (!created?.entry?.uri) {
      return false;
    }

    const nextWorkspace = await bridge.fileSystem.deleteEntry(created.entry.uri);
    return nextWorkspace?.files?.some((file) => file.relativePath === "smoke-delete-target.md") === false;
  });
  await record("workspaceUiCreateDirectory", async () => {
    const filesButton = document.querySelector('button[aria-label="Files"], button[aria-label="文件"]');
    if (!document.querySelector(".tp-file-tree-shell")) {
      filesButton?.click();
    }
    const beforeWorkspace = await bridge.fileSystem.refreshWorkspace();
    const beforeDirectoryCount = Math.max(0, countWorkspaceDirectories(beforeWorkspace?.root) - 1);

    const ready = await waitFor(() => document.querySelector(".tp-workspace-root-row .tp-tree-action-button"));

    if (!ready) {
      return false;
    }

    const originalPrompt = window.prompt;
    let promptCalled = false;
    window.prompt = () => {
      promptCalled = true;
      return "prompt-should-not-be-used";
    };
    try {
      document.querySelector(".tp-workspace-root-row .tp-tree-action-button")?.click();
      const menuReady = await waitFor(() => document.querySelectorAll(".tp-entry-menu-item").length >= 2);
      if (!menuReady) {
        return false;
      }
      document.querySelectorAll(".tp-entry-menu-item")[1]?.click();
    } finally {
      window.prompt = originalPrompt;
    }

    return await waitFor(async () => {
      const nextWorkspace = await bridge.fileSystem.refreshWorkspace();
      const nextDirectoryCount = Math.max(0, countWorkspaceDirectories(nextWorkspace?.root) - 1);
      const existsOnDisk = nextDirectoryCount === beforeDirectoryCount + 1;
      const existsInTree = document.querySelectorAll(".tp-folder-row").length >= nextDirectoryCount;

      return !promptCalled && existsOnDisk && existsInTree;
    });
  });
  await record("workspaceUiCreateFile", async () => {
    const beforeWorkspace = await bridge.fileSystem.refreshWorkspace();
    const beforeFiles = new Set((beforeWorkspace?.files ?? []).map((file) => file.relativePath));
    const toolbarReady = await waitFor(() => document.querySelector(".tp-workspace-root-row .tp-tree-action-button"));

    if (!toolbarReady) {
      return false;
    }

    const originalPrompt = window.prompt;
    let promptCalled = false;
    window.prompt = () => {
      promptCalled = true;
      return "prompt-should-not-be-used";
    };
    try {
      document.querySelector(".tp-workspace-root-row .tp-tree-action-button")?.click();
      const menuReady = await waitFor(() => document.querySelectorAll(".tp-entry-menu-item").length >= 2);
      if (!menuReady) {
        return false;
      }
      document.querySelectorAll(".tp-entry-menu-item")[0]?.click();
    } finally {
      window.prompt = originalPrompt;
    }

    return await waitFor(async () => {
      const nextWorkspace = await bridge.fileSystem.refreshWorkspace();
      const createdFile = (nextWorkspace?.files ?? []).find((file) => !beforeFiles.has(file.relativePath));
      const existsInTree = [...document.querySelectorAll(".tp-file-row")]
        .some((row) => createdFile?.name && row.textContent?.includes(createdFile.name));
      const openedInEditor = document.title.includes(createdFile?.name ?? "\u0000") ||
        document.querySelector(".tp-document-name")?.textContent?.includes(createdFile?.name ?? "\u0000") === true;

      return !promptCalled && !!createdFile && existsInTree && openedInEditor;
    });
  });
  await record("workspaceUiSyncDirectoryMenu", async () => {
    const filesButton = document.querySelector('button[aria-label="Files"], button[aria-label="文件"], button[aria-label="鏂囦欢"]');
    if (!document.querySelector(".tp-file-tree-shell")) {
      filesButton?.click();
    }
    const toolbarReady = await waitFor(() => document.querySelector(".tp-workspace-root-row .tp-tree-action-button"));

    if (!toolbarReady) {
      return false;
    }

    document.body.click();
    await waitFor(() => !document.querySelector(".tp-entry-menu"));

    document.querySelector(".tp-workspace-root-row")?.dispatchEvent(new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: true,
      clientX: 96,
      clientY: 140
    }));
    let menuReady = await waitFor(() => {
      const items = [...document.querySelectorAll(".tp-entry-menu-item")];
      return items.some((item) =>
        /sync directory|同步目录/i.test(item.textContent ?? "") ||
        item.querySelector('svg[class*="lucide-cloud"]')
      ) || items.length >= 3;
    });

    if (!menuReady) {
      document.querySelector(".tp-workspace-root-row .tp-tree-action-button")?.dispatchEvent(new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        clientX: 96,
        clientY: 140
      }));
      menuReady = await waitFor(() => {
        const items = [...document.querySelectorAll(".tp-entry-menu-item")];
        return items.some((item) =>
          /sync directory|鍚屾鐩綍/i.test(item.textContent ?? "") ||
          item.querySelector('svg[class*="lucide-cloud"]')
        ) || items.length >= 3;
      });
    }

    if (!menuReady) {
      const items = [...document.querySelectorAll(".tp-entry-menu-item")]
        .map((item) => item.textContent?.trim() ?? "");
      errors.push(
        "workspaceUiSyncDirectoryMenu items=" + items.length + ":" + items.join("|") +
        " root=" + (document.querySelector(".tp-workspace-root-row")?.textContent?.trim() ?? "missing") +
        " actionButtons=" + document.querySelectorAll(".tp-workspace-root-row .tp-tree-action-button").length +
        " tree=" + (document.querySelector(".tp-file-tree-shell") ? "yes" : "no")
      );
    }

    document.body.click();

    return menuReady;
  });
  await record("workspaceUiRenameEntry", async () => {
    const beforeWorkspace = await bridge.fileSystem.refreshWorkspace();
    const beforeFiles = new Set((beforeWorkspace?.files ?? []).map((file) => file.relativePath));
    const toolbarReady = await waitFor(() => document.querySelector(".tp-workspace-root-row .tp-tree-action-button"));

    if (!toolbarReady) {
      return false;
    }

    document.querySelector(".tp-workspace-root-row .tp-tree-action-button")?.click();
    const createMenuReady = await waitFor(() => document.querySelectorAll(".tp-entry-menu-item").length >= 2);

    if (!createMenuReady) {
      return false;
    }

    document.querySelectorAll(".tp-entry-menu-item")[0]?.click();

    let createdFile;
    const createdReady = await waitFor(async () => {
      const nextWorkspace = await bridge.fileSystem.refreshWorkspace();
      createdFile = (nextWorkspace?.files ?? []).find((file) => !beforeFiles.has(file.relativePath));
      return !!createdFile && [...document.querySelectorAll(".tp-tree-file-row")]
        .some((row) => createdFile?.name && row.textContent?.includes(createdFile.name));
    });

    if (!createdReady || !createdFile?.name) {
      return false;
    }

    const row = [...document.querySelectorAll(".tp-tree-file-row")]
      .find((candidate) => candidate.textContent?.includes(createdFile.name));
    row?.querySelector(".tp-tree-action-button")?.click();

    const renameMenuReady = await waitFor(() => document.querySelectorAll(".tp-entry-menu-item").length >= 1);

    if (!renameMenuReady) {
      return false;
    }

    document.querySelectorAll(".tp-entry-menu-item")[0]?.click();

    const inputReady = await waitFor(() => document.querySelector(".tp-tree-rename-input"));
    const input = document.querySelector(".tp-tree-rename-input");

    if (!inputReady || !(input instanceof HTMLInputElement)) {
      return false;
    }

    setNativeInputValue(input, "smoke-ui-renamed.md");
    input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter" }));

    return await waitFor(async () => {
      const nextWorkspace = await bridge.fileSystem.refreshWorkspace();
      const existsOnDisk = nextWorkspace?.files?.some((file) => file.relativePath === "smoke-ui-renamed.md") === true;
      const oldNameRemoved = nextWorkspace?.files?.some((file) => file.relativePath === createdFile.relativePath) === false;
      const existsInTree = [...document.querySelectorAll(".tp-tree-file-row")]
        .some((candidate) => candidate.textContent?.includes("smoke-ui-renamed.md"));

      return existsOnDisk && oldNameRemoved && existsInTree && !document.querySelector(".tp-tree-rename-input");
    });
  });
  await record("workspaceReadWriteFile", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const note = workspace?.files?.find((file) => file.relativePath === "installed-smoke.md");

    if (!note?.uri) {
      return false;
    }

    const content = await bridge.fileSystem.readFile(note.uri);
    const nextValue = content.value + "\nUpdated by installed smoke.\n";
    const result = await bridge.fileSystem.writeFile(note.uri, nextValue, { expectedMtime: content.mtime });
    const reread = await bridge.fileSystem.readFile(note.uri);
    return result?.kind === "saved" && result.content?.value === nextValue && reread.value === nextValue;
  });
  await record("workspaceImageResource", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const note = workspace?.files?.find((file) => file.relativePath === "installed-smoke.md");

    if (!note?.uri) {
      return false;
    }

    const resource = await bridge.resources.resolveImage(note.uri, "assets/smoke.png");
    return resource?.mimeType === "image/png" && typeof resource.dataUrl === "string" && resource.dataUrl.startsWith("data:image/png;base64,");
  });
  await record("remoteSyncWorkspaceResourceRead", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const workspaceUri = workspace?.root?.uri;

    if (!workspaceUri) {
      return false;
    }

    const resource = await bridge.remoteSyncWorkspaceResources.readResource({
      workspaceUri,
      relativePath: "installed-smoke.md"
    });
    return resource?.encoding === "base64" &&
      resource.relativePath === "installed-smoke.md" &&
      atob(resource.value).includes("Updated by installed smoke.");
  });
  await record("remoteSyncWorkspaceResourceWriteReadDelete", async () => {
    const workspace = await bridge.fileSystem.refreshWorkspace();
    const workspaceUri = workspace?.root?.uri;

    if (!workspaceUri) {
      return false;
    }

    const relativePath = "remote-sync-created.md";
    const text = "# Remote Sync Created\n\nCreated by installed smoke.\n";
    const writeResult = await bridge.remoteSyncWorkspaceResources.writeResource({
      workspaceUri,
      relativePath,
      value: btoa(text),
      encoding: "base64",
      overwrite: true
    });
    const readResult = await bridge.remoteSyncWorkspaceResources.readResource({ workspaceUri, relativePath });
    const deleted = await bridge.remoteSyncWorkspaceResources.deleteResource({
      workspaceUri,
      relativePath,
      expectedMtime: readResult.mtime
    });

    return writeResult?.relativePath === relativePath && atob(readResult.value) === text && deleted === true;
  });

  if (options.visualCheck === "true" && options.workspaceUri) {
    const smokeServices = window.typoraPlusWorkbenchSmoke;

    if (smokeServices?.fileService?.openRecentWorkspace) {
      const workspaceFiles = await smokeServices.fileService.openRecentWorkspace({
        toString: () => options.workspaceUri
      });

      if (workspaceFiles?.root && smokeServices.workspaceService?.setWorkspace) {
        smokeServices.workspaceService.setWorkspace({
          name: workspaceFiles.root.name,
          rootUri: workspaceFiles.root.uri,
          files: workspaceFiles
        });
      }
    } else {
      await bridge.fileSystem.openRecentWorkspace(options.workspaceUri);
    }
    const filesButton = document.querySelector('button[aria-label="Files"], button[aria-label="文件"], button[aria-label="鏂囦欢"]');

    if (!document.querySelector(".tp-file-tree-shell")) {
      filesButton?.click();
    }

    const visualReady = await waitFor(() =>
      document.querySelector(".tp-workspace-root-row") &&
      (document.querySelector(".tp-folder-row") || document.querySelector(".tp-tree-file-row")),
      7000
    );

    if (!visualReady) {
      errors.push("workspaceVisualTree");
    }
  }

  return {
    checks,
    errors,
    rootChildren: document.querySelector("#root")?.children.length ?? 0,
    title: document.title
  };
}`;
