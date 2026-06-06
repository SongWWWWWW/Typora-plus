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
  };
}
