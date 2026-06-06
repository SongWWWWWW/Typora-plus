import { type URI as URIType } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export interface NativeResourceBridge {
  readonly isAvailable: boolean;
  resolveImage(noteUri: string, source: string): Promise<SerializedResolvedImageResource | undefined>;
}

export interface SerializedResolvedImageResource {
  readonly dataUrl: string;
  readonly mimeType: string;
  readonly source: string;
}

export interface IResourceService {
  isAvailable(): boolean;
  resolveImageSource(noteUri: URIType, source: string): Promise<string | undefined>;
}

export const IResourceService = createServiceIdentifier<IResourceService>("resource");

export class NativeResourceService implements IResourceService {
  constructor(private readonly bridge: NativeResourceBridge | undefined = createNativeResourceBridge()) {}

  isAvailable(): boolean {
    return this.bridge?.isAvailable ?? false;
  }

  async resolveImageSource(noteUri: URIType, source: string): Promise<string | undefined> {
    if (!this.bridge?.isAvailable || noteUri.scheme !== "file") {
      return undefined;
    }

    const resource = await this.bridge.resolveImage(noteUri.toString(), source);
    return resource?.dataUrl;
  }
}

export function createNativeResourceBridge(): NativeResourceBridge | undefined {
  const candidate = globalThis as {
    readonly typoraPlus?: {
      readonly resources?: NativeResourceBridge;
    };
  };

  return candidate.typoraPlus?.resources;
}
