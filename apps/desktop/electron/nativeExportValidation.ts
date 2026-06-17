import path from "node:path";

export function isSafeNativeExportAssetPath(value: string): boolean {
  const normalized = value.trim();

  return value === normalized &&
    normalized.length > 0 &&
    !normalized.startsWith("/") &&
    !normalized.startsWith("//") &&
    !normalized.includes("\\") &&
    !normalized.split("/").some((segment) => !segment || segment === "." || segment === "..") &&
    !/^[A-Za-z][A-Za-z0-9+.-]*:/.test(normalized) &&
    !/[<>:"|?*\u0000-\u001f]/.test(normalized);
}

export function isSafeNativeExportAssetMimeType(value: string): boolean {
  return value === value.trim() && /^image\/[A-Za-z0-9+.-]+$/.test(value);
}

export function isNativeExportBase64Value(value: string): boolean {
  return value.length > 0 &&
    value === value.trim() &&
    /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value);
}

export function createNativeExportDefaultPath(fileName: string, fallbackExtension: string): string {
  const baseName = path.basename(fileName).replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").trim() || "Untitled";
  const extension = normalizeNativeExportFallbackExtension(fallbackExtension);

  if (new RegExp(`\\.${escapeRegExp(extension)}$`, "i").test(baseName)) {
    return baseName;
  }

  return `${baseName}.${extension}`;
}

export function resolveNativeExportAssetPath(exportDirectory: string, relativePath: string): string {
  if (!isSafeNativeExportAssetPath(relativePath)) {
    throw new Error("Exported asset path is invalid");
  }

  const exportRoot = path.resolve(exportDirectory);
  const assetPath = path.resolve(exportRoot, ...relativePath.split("/"));
  const relativeToExportDirectory = path.relative(exportRoot, assetPath);

  if (
    relativeToExportDirectory === "" ||
    relativeToExportDirectory.startsWith("..") ||
    path.isAbsolute(relativeToExportDirectory)
  ) {
    throw new Error("Exported asset path is outside the export directory");
  }

  return assetPath;
}

function normalizeNativeExportFallbackExtension(value: string): string {
  const normalized = value.replace(/^\./, "").replace(/[<>:"/\\|?*\u0000-\u001f.]/g, "").trim();

  return normalized || "txt";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
