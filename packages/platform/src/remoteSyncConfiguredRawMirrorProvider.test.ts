import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { RemoteSyncProviderConfiguration } from "./configuration";
import {
  createConfiguredRemoteSyncProviders,
  diagnoseRemoteSyncConfiguredRawMirrorMetadata,
  type RemoteSyncNativeRequestInput,
  type RemoteSyncNativeRequestTransport,
  remoteSyncConfiguredRawMirrorAdapterName,
  remoteSyncConfiguredRawMirrorListLimits,
  remoteSyncConfiguredRawMirrorMetadataIssueCodes,
  remoteSyncConfiguredRawMirrorMetadataKeys,
  createRemoteSyncConfiguredRawMirrorProviderFactory
} from "./index";
import type { RemoteSyncManifestStorage, RemoteSyncProgress } from "./remoteSync";

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

  it("opts into manifest-backed delete plans with explicit delete-missing metadata", async () => {
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
    const syncedRemote = remoteResource("Daily.md", "remote-1", {
      size: 5,
      mtime: 100,
      contentHash: "sha256:local"
    });
    const providers = createConfiguredRemoteSyncProviders([
      configuration({
        metadata: {
          [remoteSyncConfiguredRawMirrorMetadataKeys.deleteMissing]: "true"
        }
      })
    ], {
      transport: createTransport(requests, [
        { resources: [] },
        { resources: [] },
        { ok: true },
        { resources: [syncedRemote] },
        { resources: [syncedRemote] },
        { resources: [syncedRemote] },
        { ok: true },
        { resources: [] }
      ]),
      workspaceResources,
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({ manifestStorage: storage })
    });
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
    const createPlan = await providers[0]!.createPlan({
      workspaceUri,
      resources: [localResource],
      direction: "push",
      dryRun: true
    });

    await providers[0]!.executePlan(createPlan, {
      workspaceUri,
      resources: [localResource],
      direction: "push",
      dryRun: false
    });

    const deletePlan = await providers[0]!.createPlan({
      workspaceUri,
      resources: [],
      direction: "bidirectional",
      dryRun: true
    });

    expect(deletePlan.operations).toEqual([{
      kind: "delete",
      target: "remote",
      relativePath: "Daily.md",
      remoteId: "remote-1",
      message: "Local resource is missing"
    }]);
    const progressEvents: RemoteSyncProgress[] = [];

    await expect(providers[0]!.executePlan(deletePlan, {
      workspaceUri,
      resources: [],
      direction: "bidirectional",
      dryRun: false,
      onProgress: (progress) => progressEvents.push(progress)
    })).resolves.toMatchObject({
      summary: {
        creates: 0,
        updates: 0,
        deletes: 1,
        skips: 0,
        conflicts: 0
      }
    });
    expect(requests.map((request) => [request.method, request.url])).toContainEqual([
      "DELETE",
      "https://sync.example.test/api/mirror/delete?remoteScopeId=workspace-root&path=Daily.md&remoteId=remote-1"
    ]);
    expect(progressEvents).toEqual(expect.arrayContaining([{
      message: "Deleted remote sync resource",
      completed: 1,
      total: 1,
      operation: deletePlan.operations[0]
    }]));
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

  it("diagnoses configured raw mirror metadata before provider registration", () => {
    const keys = remoteSyncConfiguredRawMirrorMetadataKeys;
    const codes = remoteSyncConfiguredRawMirrorMetadataIssueCodes;

    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration())).toEqual([]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.downloadPath]: undefined
      }
    }))).toEqual([
      {
        code: codes.missingPath,
        key: keys.downloadPath
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.uploadPath]: "../upload"
      }
    }))).toEqual([
      {
        code: codes.invalidPath,
        key: keys.uploadPath
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.headerName]: undefined
      }
    }))).toEqual([
      {
        code: codes.incompleteHeader,
        key: keys.headerName
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.headerName]: "Bad Header"
      }
    }))).toEqual([
      {
        code: codes.invalidHeaderName,
        key: keys.headerName
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.headerBinding]: "missing"
      }
    }))).toEqual([
      {
        code: codes.unboundHeader,
        key: keys.headerBinding
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.listPageSize]: "0"
      }
    }))).toEqual([
      {
        code: codes.invalidListPageSize,
        key: keys.listPageSize
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.listPageSize]: String(remoteSyncConfiguredRawMirrorListLimits.maxPageSize + 1)
      }
    }))).toEqual([
      {
        code: codes.invalidListPageSize,
        key: keys.listPageSize
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.deleteMissing]: "yes"
      }
    }))).toEqual([
      {
        code: codes.invalidDeleteMissing,
        key: keys.deleteMissing
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.retryMaxRetries]: "2"
      }
    }))).toEqual([
      {
        code: codes.incompleteRetry,
        key: keys.retryStatusCodes
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.retryStatusCodes]: "200"
      }
    }))).toEqual([
      {
        code: codes.invalidRetryStatusCodes,
        key: keys.retryStatusCodes
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.retryStatusCodes]: "503",
        [keys.retryMaxRetries]: "6"
      }
    }))).toEqual([
      {
        code: codes.invalidRetryMaxRetries,
        key: keys.retryMaxRetries
      }
    ]);
    expect(diagnoseRemoteSyncConfiguredRawMirrorMetadata(configuration({
      metadata: {
        [keys.retryStatusCodes]: "503",
        [keys.retryDelayMs]: "-1"
      }
    }))).toEqual([
      {
        code: codes.invalidRetryDelayMs,
        key: keys.retryDelayMs
      }
    ]);
  });

  it("skips raw mirror profiles with invalid metadata diagnostics", () => {
    const providers = createConfiguredRemoteSyncProviders([
      configuration({
        metadata: {
          [remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]: "missing"
        }
      })
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

  it("follows configured raw mirror list cursors before planning", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const progressEvents: RemoteSyncProgress[] = [];
    const providers = createConfiguredRemoteSyncProviders([
      configuration({
        metadata: {
          [remoteSyncConfiguredRawMirrorMetadataKeys.listPageSize]: "200"
        }
      })
    ], {
      transport: createTransport(requests, [
        {
          resources: [remoteResource("B.md", "remote-2")],
          nextCursor: "page-2"
        },
        {
          resources: [remoteResource("A.md", "remote-1")]
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

    const plan = await providers[0]!.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "pull",
      dryRun: true,
      onProgress: (progress) => progressEvents.push(progress)
    });

    expect(requests.map((request) => [request.method, request.url])).toEqual([
      ["GET", "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=pull&pageSize=200"],
      [
        "GET",
        "https://sync.example.test/api/mirror/list?remoteScopeId=workspace-root&direction=pull&pageSize=200&cursor=page-2"
      ]
    ]);
    expect(plan.operations.map((operation) => operation.relativePath)).toEqual(["A.md", "B.md"]);
    expect(plan.summary).toEqual({
      creates: 2,
      updates: 0,
      deletes: 0,
      skips: 0,
      conflicts: 0
    });
    expect(progressEvents).toEqual([
      {
        message: "Listed remote sync page",
        completed: 1
      },
      {
        message: "Listed remote sync page",
        completed: 2
      }
    ]);
  });

  it("rejects configured raw mirror list cursor loops", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const providers = createConfiguredRemoteSyncProviders([
      configuration()
    ], {
      transport: createTransport(requests, [
        {
          resources: [remoteResource("A.md", "remote-1")],
          nextCursor: "same-page"
        },
        {
          resources: [remoteResource("B.md", "remote-2")],
          nextCursor: "same-page"
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
    })).rejects.toThrow("Configured raw mirror resource list response repeated a cursor");
    expect(requests).toHaveLength(2);
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
    const progressEvents: RemoteSyncProgress[] = [];
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
      dryRun: true,
      onProgress: (progress) => progressEvents.push(progress)
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
    expect(progressEvents).toEqual([
      {
        message: "Retrying remote sync list request",
        completed: 1,
        total: 2
      },
      {
        message: "Listed remote sync page",
        completed: 1
      }
    ]);
  });

  it("reports upload retry progress with operation context", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const progressEvents: RemoteSyncProgress[] = [];
    const storage = createMemoryManifestStorage();
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
    const providers = createConfiguredRemoteSyncProviders([
      configuration({ metadata: retryMetadata() })
    ], {
      transport: createSequenceTransport(requests, [
        okResponse({ resources: [] }),
        okResponse({ resources: [] }),
        retryableResponse(),
        okResponse({ ok: true }),
        okResponse({ resources: [remoteResource("Daily.md", undefined, {
          size: 5,
          mtime: 100,
          contentHash: "sha256:local"
        })] })
      ]),
      workspaceResources: {
        readResource: vi.fn(async () => ({
          workspaceUri,
          relativePath: "Daily.md",
          value: "SGVsbG8=",
          encoding: "base64" as const,
          size: 5,
          mtime: 100,
          contentHash: "sha256:local"
        })),
        writeResource: vi.fn(),
        deleteResource: vi.fn()
      },
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({ manifestStorage: storage })
    });
    const plan = await providers[0]!.createPlan({
      workspaceUri,
      resources: [localResource],
      direction: "push",
      dryRun: true
    });

    await expect(providers[0]!.executePlan(plan, {
      workspaceUri,
      resources: [localResource],
      direction: "push",
      dryRun: false,
      onProgress: (progress) => progressEvents.push(progress)
    })).resolves.toMatchObject({
      operations: plan.operations
    });

    expect(requests.filter((request) => request.method === "PUT")).toHaveLength(2);
    expect(progressEvents).toEqual(expect.arrayContaining([{
      message: "Retrying remote sync upload request",
      completed: 1,
      total: 2,
      operation: plan.operations[0]
    }]));
  });

  it("reports download retry progress with operation context", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const progressEvents: RemoteSyncProgress[] = [];
    const storage = createMemoryManifestStorage();
    const workspaceUri = URI.file("C:/Notes");
    const providers = createConfiguredRemoteSyncProviders([
      configuration({ metadata: retryMetadata() })
    ], {
      transport: createSequenceTransport(requests, [
        okResponse({ resources: [remoteResource("Remote.md", "remote-1")] }),
        okResponse({ resources: [remoteResource("Remote.md", "remote-1")] }),
        retryableResponse(),
        okResponse({
          relativePath: "Remote.md",
          value: "UmVtb3Rl",
          encoding: "base64",
          size: 6,
          mtime: 200,
          contentHash: "sha256:remote"
        }),
        okResponse({ resources: [remoteResource("Remote.md", "remote-1", {
          size: 6,
          mtime: 200,
          contentHash: "sha256:remote"
        })] })
      ]),
      workspaceResources: {
        readResource: vi.fn(),
        writeResource: vi.fn(async () => ({
          workspaceUri,
          relativePath: "Remote.md",
          size: 6,
          mtime: 200
        })),
        deleteResource: vi.fn()
      },
      createProvider: createRemoteSyncConfiguredRawMirrorProviderFactory({ manifestStorage: storage })
    });
    const plan = await providers[0]!.createPlan({
      workspaceUri,
      resources: [],
      direction: "pull",
      dryRun: true
    });

    await expect(providers[0]!.executePlan(plan, {
      workspaceUri,
      resources: [],
      direction: "pull",
      dryRun: false,
      onProgress: (progress) => progressEvents.push(progress)
    })).resolves.toMatchObject({
      operations: plan.operations
    });

    expect(requests.filter((request) => request.url.includes("/download?"))).toHaveLength(2);
    expect(progressEvents).toEqual(expect.arrayContaining([{
      message: "Retrying remote sync download request",
      completed: 1,
      total: 2,
      operation: plan.operations[0]
    }]));
  });

  it("reports delete retry progress with operation context", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const progressEvents: RemoteSyncProgress[] = [];
    const operation = {
      kind: "delete" as const,
      target: "remote" as const,
      relativePath: "Daily.md",
      remoteId: "remote-1",
      message: "Local resource is missing"
    };
    const providers = createConfiguredRemoteSyncProviders([
      configuration({ metadata: retryMetadata() })
    ], {
      transport: createSequenceTransport(requests, [
        okResponse({ resources: [remoteResource("Daily.md", "remote-1")] }),
        retryableResponse(),
        okResponse({ ok: true }),
        okResponse({ resources: [] })
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

    await expect(providers[0]!.executePlan({
      operations: [operation],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 1,
        skips: 0,
        conflicts: 0
      }
    }, {
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "push",
      dryRun: false,
      onProgress: (progress) => progressEvents.push(progress)
    })).resolves.toMatchObject({
      operations: [operation]
    });

    expect(requests.filter((request) => request.method === "DELETE")).toHaveLength(2);
    expect(progressEvents).toEqual(expect.arrayContaining([{
      message: "Retrying remote sync delete request",
      completed: 1,
      total: 2,
      operation
    }]));
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
  overrides: { readonly metadata?: Readonly<Record<string, string | undefined>> } = {}
): RemoteSyncProviderConfiguration {
  const metadata: Record<string, string | undefined> = {
    [remoteSyncConfiguredRawMirrorMetadataKeys.adapter]: remoteSyncConfiguredRawMirrorAdapterName,
    [remoteSyncConfiguredRawMirrorMetadataKeys.listPath]: "mirror/list",
    [remoteSyncConfiguredRawMirrorMetadataKeys.uploadPath]: "mirror/upload",
    [remoteSyncConfiguredRawMirrorMetadataKeys.downloadPath]: "mirror/download",
    [remoteSyncConfiguredRawMirrorMetadataKeys.deletePath]: "mirror/delete",
    [remoteSyncConfiguredRawMirrorMetadataKeys.headerBinding]: "session",
    [remoteSyncConfiguredRawMirrorMetadataKeys.headerName]: "Authorization",
    [remoteSyncConfiguredRawMirrorMetadataKeys.headerScheme]: "Bearer",
    ...overrides.metadata
  };

  return {
    id: "notes.raw",
    title: "Notes Raw Mirror",
    kind: "native-request",
    baseUrl: "https://sync.example.test/api/",
    remoteScopeId: "workspace-root",
    metadata: Object.fromEntries(
      Object.entries(metadata).filter((entry): entry is [string, string] => entry[1] !== undefined)
    ),
    secrets: [
      {
        name: "session",
        secretRef: "typora-plus.remote-sync.notes.raw"
      }
    ]
  };
}

function retryMetadata(): Readonly<Record<string, string>> {
  return {
    [remoteSyncConfiguredRawMirrorMetadataKeys.retryStatusCodes]: "503",
    [remoteSyncConfiguredRawMirrorMetadataKeys.retryMaxRetries]: "2",
    [remoteSyncConfiguredRawMirrorMetadataKeys.retryDelayMs]: "0"
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

function okResponse(body: unknown) {
  return {
    status: 200,
    statusText: "OK",
    headers: {},
    body
  };
}

function retryableResponse() {
  return {
    status: 503,
    statusText: "Service Unavailable",
    headers: {},
    body: { retry: true }
  };
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
