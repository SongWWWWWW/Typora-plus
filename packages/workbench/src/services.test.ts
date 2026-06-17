import { describe, expect, it } from "vitest";
import {
  IAiService,
  IRemoteSyncService,
  remoteSyncConfiguredRawMirrorAdapterName,
  remoteSyncConfiguredRawMirrorMetadataKeys
} from "@typora-plus/platform";
import { createWorkbenchServices } from "./services";

describe("createWorkbenchServices", () => {
  it("registers AI and remote sync services in the service collection", () => {
    const services = createWorkbenchServices();

    expect(services.serviceCollection.get(IAiService)).toBe(services.aiService);
    expect(services.serviceCollection.get(IRemoteSyncService)).toBe(services.remoteSyncService);
    expect(services.aiService.getProviders()).toEqual([]);
    expect(services.remoteSyncService.getProviders()).toEqual([]);
  });

  it("registers configured remote sync providers when native bridges are available", () => {
    const previousTyporaPlus = (globalThis as { typoraPlus?: unknown }).typoraPlus;

    try {
      (globalThis as {
        typoraPlus?: {
          remoteSyncManifests?: {
            isAvailable: boolean;
            read: (key: string) => string | undefined;
            write: (key: string, value: string) => void;
          };
          remoteSyncRequests?: {
            isAvailable: boolean;
            request: () => Promise<never>;
          };
          remoteSyncWorkspaceResources?: {
            isAvailable: boolean;
            readResource: () => Promise<never>;
            writeResource: () => Promise<never>;
            deleteResource: () => Promise<boolean>;
          };
        };
      }).typoraPlus = {
        remoteSyncManifests: {
          isAvailable: true,
          read: () => undefined,
          write: () => undefined
        },
        remoteSyncRequests: {
          isAvailable: true,
          request: async () => {
            throw new Error("Unexpected request");
          }
        },
        remoteSyncWorkspaceResources: {
          isAvailable: true,
          readResource: async () => {
            throw new Error("Unexpected read");
          },
          writeResource: async () => {
            throw new Error("Unexpected write");
          },
          deleteResource: async () => true
        }
      };

      const services = createWorkbenchServices();

      services.configurationService.updateValue({
        remoteSync: {
          providers: [{
            id: "lark.raw",
            title: "Lark Raw",
            kind: "native-request",
            baseUrl: "http://127.0.0.1:41573/",
            remoteScopeId: "root",
            secrets: [],
            metadata: {
              [remoteSyncConfiguredRawMirrorMetadataKeys.adapter]: remoteSyncConfiguredRawMirrorAdapterName,
              [remoteSyncConfiguredRawMirrorMetadataKeys.listPath]: "mirror/list",
              [remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath]: "mirror/upload",
              [remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath]: "mirror/download",
              [remoteSyncConfiguredRawMirrorMetadataKeys.deletePath]: "mirror/delete"
            }
          }]
        }
      });

      expect(services.remoteSyncService.getProviders()).toEqual([{
        id: "lark.raw",
        title: "Lark Raw"
      }]);
    } finally {
      (globalThis as { typoraPlus?: unknown }).typoraPlus = previousTyporaPlus;
    }
  });
});
