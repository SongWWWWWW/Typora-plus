import { toDisposable, type IDisposable, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type ExportFormat = string;
export type ExportImageSourceResolver = (source: string) => Promise<string | undefined>;
export type ExportAssetMode = "inline" | "file";

export interface ExportDocumentInput {
  readonly uri: URIType;
  readonly name: string;
  readonly value: string;
  readonly resolveImageSource?: ExportImageSourceResolver;
  readonly assetMode?: ExportAssetMode;
}

export interface ExportedDocument {
  readonly format: ExportFormat;
  readonly defaultFileName: string;
  readonly mimeType: string;
  readonly value: string;
  readonly assets?: readonly ExportedDocumentAsset[];
}

export interface ExportedDocumentAsset {
  readonly relativePath: string;
  readonly mimeType: string;
  readonly base64: string;
}

export interface SerializedExportedDocument {
  readonly format: ExportFormat;
  readonly defaultFileName: string;
  readonly mimeType: string;
  readonly value: string;
  readonly assets?: readonly ExportedDocumentAsset[];
}

export interface ExportProvider {
  readonly format: ExportFormat;
  readonly title: string;
  exportDocument(input: ExportDocumentInput): ExportedDocument | Promise<ExportedDocument>;
}

export interface NativeExportBridge {
  readonly isAvailable: boolean;
  saveDocument(document: SerializedExportedDocument): Promise<boolean>;
}

export interface ExportResourceService {
  isAvailable(): boolean;
  resolveImageSource(noteUri: URIType, source: string): Promise<string | undefined>;
}

export interface ExportServiceOptions {
  readonly nativeBridge?: NativeExportBridge;
  readonly browserSave?: (document: ExportedDocument) => boolean;
  readonly resourceService?: ExportResourceService;
}

export interface IExportService {
  registerProvider(provider: ExportProvider): IDisposable;
  getProviders(): readonly ExportProvider[];
  exportDocument(input: ExportDocumentInput, format: ExportFormat): Promise<ExportedDocument>;
  saveExportedDocument(document: ExportedDocument): Promise<boolean>;
  exportAndSave(input: ExportDocumentInput, format: ExportFormat): Promise<boolean>;
}

export const IExportService = createServiceIdentifier<IExportService>("export");

export class ExportService implements IExportService {
  private readonly providers = new Map<ExportFormat, ExportProvider>();
  private readonly nativeBridge: NativeExportBridge | undefined;
  private readonly browserSave: (document: ExportedDocument) => boolean;
  private readonly resourceService: ExportResourceService | undefined;

  constructor(options: ExportServiceOptions = {}) {
    this.nativeBridge = options.nativeBridge ?? createNativeExportBridge();
    this.browserSave = options.browserSave ?? saveExportedDocumentInBrowser;
    this.resourceService = options.resourceService;
  }

  registerProvider(provider: ExportProvider): IDisposable {
    const normalizedProvider = normalizeExportProvider(provider);

    if (this.providers.has(normalizedProvider.format)) {
      throw new Error(`Export provider already registered for ${normalizedProvider.format}`);
    }

    this.providers.set(normalizedProvider.format, normalizedProvider);
    return toDisposable(() => {
      if (this.providers.get(normalizedProvider.format) === normalizedProvider) {
        this.providers.delete(normalizedProvider.format);
      }
    });
  }

  getProviders(): readonly ExportProvider[] {
    return [...this.providers.values()];
  }

  async exportDocument(input: ExportDocumentInput, format: ExportFormat): Promise<ExportedDocument> {
    const provider = this.providers.get(format);

    if (!provider) {
      throw new Error(`No export provider registered for ${format}`);
    }

    return provider.exportDocument(this.withResourceContext(input));
  }

  async saveExportedDocument(document: ExportedDocument): Promise<boolean> {
    if (this.nativeBridge?.isAvailable) {
      return this.nativeBridge.saveDocument(document);
    }

    return this.browserSave(document);
  }

  async exportAndSave(input: ExportDocumentInput, format: ExportFormat): Promise<boolean> {
    const document = await this.exportDocument(input, format);
    return this.saveExportedDocument(document);
  }

  private withResourceContext(input: ExportDocumentInput): ExportDocumentInput {
    const resourceService = this.resourceService;
    const assetMode = input.assetMode ?? (this.nativeBridge?.isAvailable ? "file" : "inline");

    if (input.resolveImageSource) {
      return { ...input, assetMode };
    }

    if (resourceService?.isAvailable()) {
      return {
        ...input,
        assetMode,
        resolveImageSource: (source) => resourceService.resolveImageSource(input.uri, source)
      };
    }

    return { ...input, assetMode };
  }
}

function normalizeExportProvider(provider: ExportProvider): ExportProvider {
  const format = readRequiredString(provider.format, "Export provider format");
  const title = readRequiredString(provider.title, `Export provider title for ${format}`);

  if (typeof provider.exportDocument !== "function") {
    throw new Error(`Export provider for ${format} must provide exportDocument`);
  }

  return {
    format,
    title,
    exportDocument: (input) => provider.exportDocument(input)
  };
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}

function saveExportedDocumentInBrowser(document: ExportedDocument): boolean {
  if (typeof window === "undefined" || typeof Blob === "undefined" || typeof URL === "undefined") {
    return false;
  }

  if ((document.assets?.length ?? 0) > 0) {
    return false;
  }

  const body = window.document?.body;

  if (!body) {
    return false;
  }

  const blob = new Blob([document.value], { type: document.mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");

  anchor.href = objectUrl;
  anchor.download = document.defaultFileName;
  anchor.style.display = "none";
  body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(objectUrl);
  return true;
}

function createNativeExportBridge(): NativeExportBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly documentExport?: NativeExportBridge;
    };
  };
  const bridge = candidate.typoraPlus?.documentExport;

  return bridge?.isAvailable ? bridge : undefined;
}
