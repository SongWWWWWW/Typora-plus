import { URI, type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export interface PastedImage {
  readonly name: string;
  readonly mimeType: string;
  readonly base64: string;
}

export interface SavedAttachment {
  readonly uri: URIType;
  readonly relativePath: string;
  readonly markdown: string;
}

export interface NativeAttachmentBridge {
  readonly isAvailable: boolean;
  saveImage(noteUri: string, image: PastedImage, assetFolder: string): Promise<SerializedSavedAttachment | undefined>;
}

export interface SerializedSavedAttachment {
  readonly uri: string;
  readonly relativePath: string;
  readonly markdown: string;
}

export interface AttachmentServiceConfiguration {
  readonly assetFolder: string;
}

export interface IAttachmentService {
  configure(configuration: AttachmentServiceConfiguration): void;
  isAvailable(): boolean;
  saveImage(noteUri: URIType, image: PastedImage): Promise<SavedAttachment | undefined>;
}

export const IAttachmentService = createServiceIdentifier<IAttachmentService>("attachment");

export class NativeAttachmentService implements IAttachmentService {
  constructor(
    private assetFolder: string,
    private readonly bridge: NativeAttachmentBridge | undefined = createNativeAttachmentBridge()
  ) {}

  configure(configuration: AttachmentServiceConfiguration): void {
    this.assetFolder = configuration.assetFolder;
  }

  isAvailable(): boolean {
    return this.bridge?.isAvailable ?? false;
  }

  async saveImage(noteUri: URIType, image: PastedImage): Promise<SavedAttachment | undefined> {
    if (!this.bridge?.isAvailable || noteUri.scheme !== "file") {
      return undefined;
    }

    const saved = await this.bridge.saveImage(noteUri.toString(), image, this.assetFolder);
    return saved ? reviveSavedAttachment(saved) : undefined;
  }
}

export function createNativeAttachmentBridge(): NativeAttachmentBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly attachments?: NativeAttachmentBridge;
    };
  };

  return candidate.typoraPlus?.attachments;
}

function reviveSavedAttachment(saved: SerializedSavedAttachment): SavedAttachment {
  return {
    uri: URI.parse(saved.uri),
    relativePath: saved.relativePath,
    markdown: saved.markdown
  };
}
