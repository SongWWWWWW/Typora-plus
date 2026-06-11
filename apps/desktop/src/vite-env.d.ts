/// <reference types="vite/client" />

interface Window {
  readonly typoraPlus?: {
    readonly platform: string;
    readonly configuration?: {
      readonly isAvailable: boolean;
      read(key: string): string | undefined;
      write(key: string, value: string): boolean;
    };
    readonly ai?: {
      readonly isAvailable: boolean;
      setSecret(secretRef: string, value: string): Promise<boolean>;
      deleteSecret(secretRef: string): Promise<boolean>;
      cancelResponses(requestId: string): void;
      requestResponses(request: {
        readonly requestId: string;
        readonly endpointUrl: string;
        readonly secretRef: string;
        readonly body: string;
      }): Promise<unknown>;
    };
    readonly indexSnapshots?: {
      readonly isAvailable: boolean;
      read(key: string): string | undefined;
      write(key: string, value: string): boolean;
    };
    readonly remoteSyncManifests?: {
      readonly isAvailable: boolean;
      read(key: string): string | undefined;
      write(key: string, value: string): boolean;
    };
    readonly remoteSyncSecrets?: {
      readonly isAvailable: boolean;
      setSecret(secretRef: string, value: string): Promise<boolean>;
      deleteSecret(secretRef: string): Promise<boolean>;
    };
    readonly remoteSyncRequests?: {
      readonly isAvailable: boolean;
      request(request: unknown): Promise<unknown>;
      cancel(requestId: string): void;
    };
    readonly remoteSyncWorkspaceResources?: {
      readonly isAvailable: boolean;
      readResource(request: unknown): Promise<unknown>;
      writeResource(request: unknown): Promise<unknown>;
      deleteResource(request: unknown): Promise<boolean>;
    };
    readonly documentExport?: {
      readonly isAvailable: boolean;
      saveDocument(document: unknown): Promise<boolean>;
    };
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
