import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createNativeExportDefaultPath,
  isNativeExportBase64Value,
  isSafeNativeExportAssetMimeType,
  isSafeNativeExportAssetPath,
  resolveNativeExportAssetPath
} from "./nativeExportValidation";

describe("native export validation", () => {
  it("accepts normalized workspace-style relative asset paths", () => {
    expect(isSafeNativeExportAssetPath("assets/note/image.png")).toBe(true);
    expect(isSafeNativeExportAssetPath("Project Notes_assets/nested/image.svg")).toBe(true);
  });

  it("rejects absolute, path-like, protocol, and malformed asset paths", () => {
    const invalidPaths = [
      "",
      " assets/image.png",
      "assets/image.png ",
      "/assets/image.png",
      "//server/share/image.png",
      "C:/assets/image.png",
      "https://example.test/image.png",
      "assets\\image.png",
      "assets//image.png",
      "assets/./image.png",
      "assets/../image.png",
      "assets/<image>.png",
      "assets/image.png\n"
    ];

    for (const assetPath of invalidPaths) {
      expect(isSafeNativeExportAssetPath(assetPath)).toBe(false);
    }
  });

  it("accepts image MIME types and rejects non-image or non-normalized MIME values", () => {
    expect(isSafeNativeExportAssetMimeType("image/png")).toBe(true);
    expect(isSafeNativeExportAssetMimeType("image/svg+xml")).toBe(true);
    expect(isSafeNativeExportAssetMimeType("image/vnd.microsoft.icon")).toBe(true);

    for (const mimeType of ["", "text/html", "application/octet-stream", " image/png", "image/png\n"]) {
      expect(isSafeNativeExportAssetMimeType(mimeType)).toBe(false);
    }
  });

  it("accepts non-empty normalized base64 asset content", () => {
    expect(isNativeExportBase64Value("AA==")).toBe(true);
    expect(isNativeExportBase64Value("SGVsbG8=")).toBe(true);

    for (const value of ["", " AA==", "AA== ", "A", "####", "AA=A"]) {
      expect(isNativeExportBase64Value(value)).toBe(false);
    }
  });

  it("creates safe default export file names with the configured extension", () => {
    expect(createNativeExportDefaultPath("<Bad>|Name", "html")).toBe("-Bad--Name.html");
    expect(createNativeExportDefaultPath("Report.HTML", "html")).toBe("Report.HTML");
    expect(createNativeExportDefaultPath("   ", "html")).toBe("Untitled.html");
  });

  it("resolves asset paths inside the chosen export directory", () => {
    const exportDirectory = path.resolve("C:/Exports/Notes");
    const resolved = resolveNativeExportAssetPath(exportDirectory, "assets/note/image.png");

    expect(resolved).toBe(path.join(exportDirectory, "assets", "note", "image.png"));
  });

  it("rejects invalid or escaping asset paths before writes", () => {
    const exportDirectory = path.resolve("C:/Exports/Notes");

    expect(() => resolveNativeExportAssetPath(exportDirectory, "../image.png"))
      .toThrow("Exported asset path is invalid");
    expect(() => resolveNativeExportAssetPath(exportDirectory, "assets\\image.png"))
      .toThrow("Exported asset path is invalid");
  });
});
