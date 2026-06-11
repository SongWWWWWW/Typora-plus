import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { RemoteSyncProviderConfiguration } from "./configuration";
import {
  createConfiguredRemoteSyncProviders,
  type RemoteSyncNativeRequestInput,
  type RemoteSyncNativeRequestTransport,
  remoteSyncConfiguredRawMirrorAdapterName,
  remoteSyncConfiguredRawMirrorMetadataKeys,
  createRemoteSyncConfiguredRawMirrorProviderFactory
} from "./index";
import type { RemoteSyncManifestStorage } from "./remoteSync";

describe("configured raw mirror remote sync provider", () => {
  it("creates profile-backed raw mirror plans and uploads local files through native requests", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const storage = createMemoryManifestStorage();
    const workspaceResources = {
      readResource: vi.fn(async () => ({
        workspaceUri: URI.file("C:/Notes"),
        relativePath: "Daily.md",
        value: "SGVsbG8=",
        encoding: "base64" as const,
        size: 5,
        mtime: 100,
        contentHash: "sha256:local"
      })),
      writeResource: vi.fn(),
      deleteResource: vi.fn()
    };
    const providers = createConfiguredRemoteSyncProviders([
      configuration()
    ], {
      transport: createTransport(requests, [
        { resources: [] },
        { resources: [] },
        { ok: true },
        { resources: [remoteResource("Daily.md", undefined, {
          size: 5,
          mtime: 100,
          contentHash: "sha256:local"
        })] }
      ]),
      workspaceResources,
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({ manifestStorage: storage })
    });

    expect(providers.map((provider) => provider.id)).toEqual(["notes.raw"]);

    const workspaceUri = URI.file("C:/Notes");
    const localResource = {
      uri: URI.file("C:/Notes/Daily.md"),
      relativePath: "Daily.md",
      kind: "file" as const,
      name: "Daily.md",
      size: 5,
      mtime: 100,
      contentHash: "sha256:local"
    };
    const plan = await providers[0]!.createPlan({
      workspaceUri,
      resources: [localResource],
      direction: "push",
      dryRun: true
    });

    expect(plan.summary).toEqual({
      creates: 1,
      updates: 0,
      deletes: 0,
      skips: 0,
      conflicts: 0
    });
    await expect(providers[0]!.executePlan(plan, {
      workspaceUri,
      resources: [localResource],
      direction: "push",
      dryRun: false
    })).resolves.toMatchObject({
      operations: plan.operations,
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ["GET", "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=push"],
      ["GET", "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=push"],
      ["PUT", "https://sync.example.test/api/mirror/upload?remoteScopeId=workspace-root&path=Daily.md"],
      ["GET", "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=push"]
    ]);
    expect(JSON.parse(requests[2]!.body ?? "{}")).toEqual({
      operation: {
        kind: "create",
        target: "remote",
        relativePath: "Daily.md"
      },
      resource: {
        relativePath: "Daily.md",
        kind: "file",
        name: "Daily.md",
        size: 5,
        mtime: 100,
        contentHash: "sha256:local"
      },
      content: {
        value: "SGVsbG8=",
        encoding: "base64",
        size: 5,
        mtime: 100,
        contentHash: "sha256:local"
      }
    });
    expect(requests[2]!.secretHeaders).toEqual([
      {
        name: "Authorization",
        secretRef: "typora-plus.remote-sync.notes.raw",
        prefix: "Bearer "
      }
    ]);
  });

  it("downloads remote file content and applies pull plans through workspace resources", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const storage = createMemoryManifestStorage();
    const workspaceResources = {
      readResource: vi.fn(),
      writeResource: vi.fn(async () => ({
        workspaceUri: URI.file("C:/Notes"),
        relativePath: "Remote.md",
        size: 6,
        mtime: 200
      })),
      deleteResource: vi.fn()
    };
    const providers = createConfiguredRemoteSyncProviders([
      configuration()
    ], {
      transport: createTransport(requests, [
        { resources: [remoteResource("Remote.md", "remote-1")] },
        { resources: [remoteResource("Remote.md", "remote-1")] },
        {
          relativePath: "Remote.md",
          value: "UmVtb3Rl",
          encoding: "base64",
          size: 6,
          mtime: 200,
          contentHash: "sha256:remote"
        },
        { resources: [remoteResource("Remote.md", "remote-1", {
          size: 6,
          mtime: 200,
          contentHash: "sha256:remote"
        })] }
      ]),
      workspaceResources,
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({ manifestStorage: storage })
    });

    const workspaceUri = URI.file("C:/Notes");
    const plan = await providers[0]!.createPlan({
      workspaceUri,
      resources: [],
      direction: "pull",
      dryRun: true
    });

    expect(plan.summary.creates).toBe(1);
    await providers[0]!.executePlan(plan, {
      workspaceUri,
      resources: [],
      direction: "pull",
      dryRun: false
    });

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ["GET", "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=pull"],
      ["GET", "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=pull"],
      [
        "GET",
        "https://sync.example.test/api/mirror/download?remoteScopeId=workspace-root&path=Remote.md&remoteId=remote-1"
      ],
      ["GET", "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=pull"]
    ]);
    expect(workspaceResources.writeResource).toHaveBeenCalledWith({
      workspaceUri,
      relativePath: "Remote.md",
      value: "UmVtb3Rl",
      encoding: "base64",
      overwrite: false
    });
  });

  it("skips native-request profiles that do not opt into the raw mirror adapter", () => {
    const providers = createConfiguredRemoteSyncProviders([
      {
        ...configuration(),
        metadata: {}
      }
    ], {
      transport: createTransport([], []),
      workspaceResources: {
        readResource: vi.fn(),
        writeResource: vi.fn(),
        deleteResource: vi.fn()
      },
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({
        manifestStorage: createMemoryManifestStorage()
      })
    });

    expect(providers).toEqual([]);
  });

  it("keeps configured raw mirror snapshots file-only", async () => {
    const providers = createConfiguredRemoteSyncProviders([
      configuration()
    ], {
      transport: createTransport([], [
        {
          resources: [
            directoryResource("Folder"),
            remoteResource("Folder/Remote.md", "remote-1")
          ]
        }
      ]),
      workspaceResources: {
        readResource: vi.fn(),
        writeResource: vi.fn(),
        deleteResource: vi.fn()
      },
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({
        manifestStorage: createMemoryManifestStorage()
      })
    });

    await expect(providers[0]!.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "pull",
      dryRun: true
    })).resolves.toMatchObject({
      operations: [
        {
          kind: "create",
          target: "local",
          relativePath: "Folder/Remote.md"
        }
      ],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });
  });

  it("rejects failed gateway responses before parsing raw mirror payloads", async () => {
    const providers = createConfiguredRemoteSyncProviders([
      configuration()
    ], {
      transport: createStatusTransport(503, "Service Unavailable", { resources: [] }),
      workspaceResources: {
        readResource: vi.fn(),
        writeResource: vi.fn(),
        deleteResource: vi.fn()
      },
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({
        manifestStorage: createMemoryManifestStorage()
      })
    });

    await expect(providers[0]!.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "pull",
      dryRun: true
    })).rejects.toThrow("Configured raw mirror list request failed: 503 Service Unavailable");
  });

  it("retries configured gateway status codes before parsing raw mirror responses", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const providers = createConfiguredRemoteSyncProviders([
      configuration({
        metadata: {
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]: "429, 503",
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]: "2",
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs]: "0"
        }
      })
    ], {
      transport: createSequenceTransport(requests, [
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: {},
          body: {
            resources: [
              {
                relativePath: "../invalid",
                kind: "file"
              }
            ]
          }
        },
        {
          status: 200,
          statusText: "OK",
          headers: {},
          body: { resources: [] }
        }
      ]),
      workspaceResources: {
        readResource: vi.fn(),
        writeResource: vi.fn(),
        deleteResource: vi.fn()
      },
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({
        manifestStorage: createMemoryManifestStorage()
      })
    });

    await expect(providers[0]!.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "pull",
      dryRun: true
    })).resolves.toMatchObject({
      operations: [],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });
    expect(requests).toHaveLength(2);
  });

  it("stops retrying configured gateway status codes after the configured limit", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const providers = createConfiguredRemoteSyncProviders([
      configuration({
        metadata: {
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]: "503",
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]: "1",
          [remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs]: "0"
        }
      })
    ], {
      transport: createSequenceTransport(requests, [
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: {},
          body: { resources: [] }
        },
        {
          status: 503,
          statusText: "Service Unavailable",
          headers: {},
          body: { resources: [] }
        }
      ]),
      workspaceResources: {
        readResource: vi.fn(),
        writeResource: vi.fn(),
        deleteResource: vi.fn()
      },
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({
        manifestStorage: createMemoryManifestStorage()
      })
    });

    await expect(providers[0]!.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "pull",
      dryRun: true
    })).rejects.toThrow("Configured raw mirror list request failed: 503 Service Unavailable");
    expect(requests).toHaveLength(2);
  });
});

function configuration(
  overrides: { readonly metadata?: Readonly<Record<string, string>> } = {}
): RemoteSyncProviderConfiguration {
  return {
    id: "notes.raw",
    title: "Notes Raw Mirror",
    kind: "native-request",
    baseUrl: "https://sync.example.test/api/",
    remoteScopeId: "workspace-root",
    metadata: {
      [remoteSyncConfiguredRawMirrorMetadataKeys.adapter]: remoteSyncConfiguredRawMirrorAdapterName,
      [remoteSyncConfiguredRawMirrorMetadataKeys.listPath]: "mirror/list",
      [remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath]: "mirror/upload",
      [remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath]: "mirror/download",
      [remoteSyncConfiguredRawMirrorMetadataKeys.deletePath]: "mirror/delete",
      [remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]: "session",
      [remoteSyncConfiguredRawMirrorMetadataKeys.headerName]: "Authorization",
      [remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]: "Bearer",
      ...overrides.metadata
    },
    secrets: [
      {
        name: "session",
        secretRef: "typora-plus.remote-sync.notes.raw"
      }
    ]
  };
}

function remoteResource(
  relativePath: string,
  remoteId?: string,
  overrides: { readonly size?: number; readonly mtime?: number; readonly contentHash?: string } = {}
) {
  return {
    relativePath,
    kind: "file" as const,
    ...(remoteId !== undefined ? { remoteId } : {}),
    size: overrides.size ?? 1,
    mtime: overrides.mtime ?? 1,
    contentHash: overrides.contentHash ?? "sha256:remote"
  };
}

function directoryResource(relativePath: string) {
  return {
    relativePath,
    kind: "directory" as const
  };
}

function createTransport(
  requests: RemoteSyncNativeRequestInput[],
  bodies: unknown[]
): RemoteSyncNativeRequestTransport {
  return vi.fn(async (request) => {
    requests.push(request);
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      body: bodies.shift()
    };
  });
}

function createStatusTransport(
  status: number,
  statusText: string,
  body: unknown
): RemoteSyncNativeRequestTransport {
  return vi.fn(async () => ({
    status,
    statusText,
    headers: {},
    body
  }));
}

function createSequenceTransport(
  requests: RemoteSyncNativeRequestInput[],
  responses: readonly {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body: unknown;
  }[]
): RemoteSyncNativeRequestTransport {
  const responseQueue = [...responses];

  return vi.fn(async (request) => {
    requests.push(request);

    const response = responseQueue.shift();

    if (!response) {
      throw new Error("Unexpected raw mirror request");
    }

    return response;
  });
}

function createMemoryManifestStorage(): RemoteSyncManifestStorage {
  const values = new Map<string, string>();

  return {
    read: (key) => values.get(key),
    write: (key, value) => {
      values.set(key, value);
    }
  };
}
