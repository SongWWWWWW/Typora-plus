import fs from "node:fs/promises";
import path from "node:path";
import { BrowserWindow, dialog, ipcMain, type SaveDialogOptions } from "electron";

export const nativeExportIpcChannels = {
  saveDocument: "typora-plus:export:saveDocument"
} as const;

export interface NativeExportConfig {
  readonly maxValueBytes: number;
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

  await fs.writeFile(result.filePath, document.value, "utf8");
  return true;
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
