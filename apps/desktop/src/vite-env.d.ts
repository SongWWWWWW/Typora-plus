/// <reference types="vite/client" />

interface Window {
  readonly typoraPlus?: {
    readonly platform: string;
    readonly fileSystem?: {
      readonly isAvailable: boolean;
      onDidChangeWorkspaceFiles(listener: (workspace: unknown) => void): () => void;
      openWorkspace(): Promise<unknown>;
      openRecentWorkspace(uri: string): Promise<unknown>;
      refreshWorkspace(): Promise<unknown>;
      readFile(uri: string): Promise<unknown>;
      writeFile(uri: string, value: string, options?: { readonly expectedMtime?: number; readonly overwrite?: boolean }): Promise<unknown>;
      saveFileAs(defaultName: string, value: string): Promise<unknown>;
    };
    readonly attachments?: {
      readonly isAvailable: boolean;
      saveImage(noteUri: string, image: { readonly name: string; readonly mimeType: string; readonly base64: string }, assetFolder: string): Promise<unknown>;
    };
    readonly resources?: {
      readonly isAvailable: boolean;
      resolveImage(noteUri: string, source: string): Promise<unknown>;
    };
  };
}
