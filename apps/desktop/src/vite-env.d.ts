/// <reference types="vite/client" />

interface Window {
  readonly typoraPlus?: {
    readonly platform: string;
    readonly fileSystem?: {
      readonly isAvailable: boolean;
      openWorkspace(): Promise<unknown>;
      readFile(uri: string): Promise<unknown>;
      writeFile(uri: string, value: string): Promise<unknown>;
      saveFileAs(defaultName: string, value: string): Promise<unknown>;
    };
    readonly attachments?: {
      readonly isAvailable: boolean;
      saveImage(noteUri: string, image: { readonly name: string; readonly mimeType: string; readonly base64: string }, assetFolder: string): Promise<unknown>;
    };
  };
}
