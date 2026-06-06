import fs from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, dialog, ipcMain, type SaveDialogOptions } from "electron";

export const nativeExportIpcChannels = {
  saveDocument: "typora-plus:export:saveDocument"
} as const;

export interface NativeExportConfig {
  readonly maxValueBytes: number;
  readonly maxAssetBytes: number;
  readonly maxAssetCount: number;
  readonly formats: readonly NativeExportFormatConfig[];
}

export interface NativeExportFormatConfig {
  readonly format: string;
  readonly name: string;
  readonly extensions: readonly string[];
}

export interface SerializedExportedDocument {
  readonly format: string;
  readonly defaultFileName: string;
  readonly mimeType: string;
  readonly value: string;
  readonly assets?: readonly SerializedExportedDocumentAsset[];
}

export interface SerializedExportedDocumentAsset {
  readonly relativePath: string;
  readonly mimeType: string;
  readonly base64: string;
}

export function registerNativeExportIpc(config: NativeExportConfig): void {
  ipcMain.handle(nativeExportIpcChannels.saveDocument, async (event, document: SerializedExportedDocument) => {
    return saveExportedDocument(config, BrowserWindow.fromWebContents(event.sender) ?? undefined, document);
  });
}

async function saveExportedDocument(
  config: NativeExportConfig,
  owner: BrowserWindow | undefined,
  document: SerializedExportedDocument
): Promise<boolean> {
  const format = config.formats.find((entry) => entry.format === document.format);

  if (!format) {
    throw new Error("Unsupported export format");
  }

  if (Buffer.byteLength(document.value, "utf8") > config.maxValueBytes) {
    throw new Error("Exported document is too large");
  }

  validateExportAssets(config, document.assets ?? []);

  const defaultPath = createExportDefaultPath(document.defaultFileName, format.extensions[0] ?? "txt");
  const options: SaveDialogOptions = {
    title: "Export Note",
    defaultPath,
    filters: [{
      name: format.name,
      extensions: [...format.extensions]
    }]
  };
  const result = owner
    ? await dialog.showSaveDialog(owner, options)
    : await dialog.showSaveDialog(options);

  if (result.canceled || !result.filePath) {
    return false;
  }

  await writeExportAssets(config, result.filePath, document.assets ?? []);
  await fs.writeFile(result.filePath, document.value, "utf8");
  return true;
}

function validateExportAssets(
  config: NativeExportConfig,
  assets: readonly SerializedExportedDocumentAsset[]
): void {
  if (assets.length > config.maxAssetCount) {
    throw new Error("Exported document has too many assets");
  }

  for (const asset of assets) {
    if (!isSafeExportAssetPath(asset.relativePath)) {
      throw new Error("Exported asset path is invalid");
    }

    if (!isSafeExportAssetMimeType(asset.mimeType)) {
      throw new Error("Exported asset type is invalid");
    }

    if (!isBase64Value(asset.base64)) {
      throw new Error("Exported asset content is invalid");
    }

    if (Buffer.byteLength(asset.base64, "base64") > config.maxAssetBytes) {
      throw new Error("Exported asset is too large");
    }
  }
}

async function writeExportAssets(
  config: NativeExportConfig,
  exportFilePath: string,
  assets: readonly SerializedExportedDocumentAsset[]
): Promise<void> {
  if (assets.length === 0) {
    return;
  }

  const exportDirectory = path.dirname(exportFilePath);

  for (const asset of assets) {
    const assetPath = resolveExportAssetPath(exportDirectory, asset.relativePath);
    const assetBuffer = Buffer.from(asset.base64, "base64");

    if (assetBuffer.byteLength > config.maxAssetBytes) {
      throw new Error("Exported asset is too large");
    }

    await fs.mkdir(path.dirname(assetPath), { recursive: true });
    await fs.writeFile(assetPath, assetBuffer);
  }
}

function resolveExportAssetPath(exportDirectory: string, relativePath: string): string {
  const assetPath = path.resolve(exportDirectory, relativePath);
  const relativeToExportDirectory = path.relative(exportDirectory, assetPath);

  if (relativeToExportDirectory === "" || relativeToExportDirectory.startsWith("..") || path.isAbsolute(relativeToExportDirectory)) {
    throw new Error("Exported asset path is outside the export directory");
  }

  return assetPath;
}

function isSafeExportAssetPath(value: string): boolean {
  const normalized = value.trim().replaceAll("\\", "/");

  return normalized.length > 0
    && !normalized.startsWith("/")
    && !normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
    && !/^[a-z][a-z0-9+.-]*:/i.test(normalized)
    && !/[<>:"|?*\u0000-\u001f]/.test(normalized);
}

function isSafeExportAssetMimeType(value: string): boolean {
  return /^image\/[a-z0-9+.-]+$/i.test(value.trim());
}

function isBase64Value(value: string): boolean {
  return value.trim().length > 0 && /^(?:[a-z0-9+/]{4})*(?:[a-z0-9+/]{2}==|[a-z0-9+/]{3}=)?$/i.test(value.trim());
}

function createExportDefaultPath(fileName: string, fallbackExtension: string): string {
  const baseName = path.basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "Untitled";
  const extension = fallbackExtension.replace(/^\./, "");

  if (new RegExp(`\\.${escapeRegExp(extension)}$`, "i").test(baseName)) {
    return baseName;
  }

  return `${baseName}.${extension}`;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
