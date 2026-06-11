import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import {
  RemoteSyncManifestStore,
  type RemoteSyncOperation,
  type RemoteSyncPlanRequest,
  type RemoteSyncRemoteResource
} from "./remoteSync";
import {
  createRemoteSyncRawMirrorProvider,
  type RemoteSyncRawMirrorExecuteRequest,
  type RemoteSyncRawMirrorListRequest
} from "./remoteSyncRawMirrorProvider";

describe("remote sync raw mirror provider", () => {
  it("plans from remote snapshots and updates the manifest after execution", async () => {
    const storage = createMemoryStorage();
    const remoteResources: RemoteSyncRemoteResource[] = [];
    const listRequests: RemoteSyncRawMirrorListRequest[] = [];
    const executeRequests: RemoteSyncRawMirrorExecuteRequest[] = [];
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage }),
      adapter: {
        listResources: vi.fn((request) => {
          listRequests.push(request);
          return remoteResources;
        }),
        executeOperations: vi.fn((request) => {
          executeRequests.push(request);
          remoteResources.push({
            relativePath: "daily/today.md",
            kind: "file",
            remoteId: "remote-1",
            size: 12,
            contentHash: "hash-1"
          });

          return {
            operations: request.operations.map((operation: RemoteSyncOperation) => ({
              ...operation,
              remoteId: "remote-1"
            })),
            remoteResources,
            completedAt: 123
          };
        })
      }
    });
    const request = planRequest();

    const plan = await provider.createPlan(request);

    expect(plan).toEqual({
      operations: [{
        kind: "create",
        target: "remote",
        relativePath: "daily/today.md",
        localUri: request.resources[0]!.uri
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });

    await expect(provider.executePlan(plan, request)).resolves.toEqual({
      operations: [{
        ...plan.operations[0]!,
        remoteId: "remote-1"
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      },
      completedAt: 123
    });

    await expect(provider.createPlan(request)).resolves.toEqual({
      operations: [{
        kind: "skip",
        target: "none",
        relativePath: "daily/today.md",
        localUri: request.resources[0]!.uri,
        remoteId: "remote-1"
      }],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 0
      }
    });
    expect(listRequests).toEqual([
      {
        workspaceUri: request.workspaceUri,
        remoteScopeId: "workspace-root",
        metadata: {
          surface: "test"
        },
        direction: "bidirectional"
      },
      {
        workspaceUri: request.workspaceUri,
        remoteScopeId: "workspace-root",
        metadata: {
          surface: "test"
        },
        direction: "bidirectional"
      },
      {
        workspaceUri: request.workspaceUri,
        remoteScopeId: "workspace-root",
        metadata: {
          surface: "test"
        },
        direction: "bidirectional"
      }
    ]);
    expect(executeRequests).toHaveLength(1);
    expect(storage.values.size).toBe(1);
    expect([...storage.values.values()][0]).toContain("\"remoteId\":\"remote-1\"");
  });

  it("does not call the execution adapter when a plan has no executable operations", async () => {
    const executeOperations = vi.fn();
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage: createMemoryStorage() }),
      adapter: {
        listResources: vi.fn(() => []),
        executeOperations
      }
    });

    const plan = {
      operations: [{
        kind: "skip",
        target: "none",
        relativePath: "daily/today.md"
      }],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 0
      }
    } as const;

    await expect(provider.executePlan(plan, planRequest())).resolves.toEqual({
      operations: plan.operations,
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 0
      }
    });
    expect(executeOperations).not.toHaveBeenCalled();
  });

  it("rejects dry-run execution requests before adapter calls", async () => {
    const adapter = {
      listResources: vi.fn(() => []),
      executeOperations: vi.fn(() => ({
        remoteResources: []
      }))
    };
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage: createMemoryStorage() }),
      adapter
    });

    await expect(provider.executePlan({
      operations: [{
        kind: "create",
        target: "remote",
        relativePath: "daily/today.md"
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    }, planRequest({
      dryRun: true
    }))).rejects.toThrow("Remote sync raw mirror execution requires a non-dry-run request");
    expect(adapter.listResources).not.toHaveBeenCalled();
    expect(adapter.executeOperations).not.toHaveBeenCalled();
  });

  it("rejects conflict plans before adapter calls", async () => {
    const adapter = {
      listResources: vi.fn(() => []),
      executeOperations: vi.fn(() => ({
        remoteResources: []
      }))
    };
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage: createMemoryStorage() }),
      adapter
    });

    await expect(provider.executePlan({
      operations: [{
        kind: "conflict",
        target: "both",
        relativePath: "daily/today.md",
        message: "changed on both sides"
      }],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 1
      }
    }, planRequest())).rejects.toThrow("Remote sync raw mirror conflicts must be resolved before execution");
    expect(adapter.listResources).not.toHaveBeenCalled();
    expect(adapter.executeOperations).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "missing planned operation",
      operations: [],
      error: "must return every planned operation exactly once"
    },
    {
      name: "extra planned operation",
      operations: [
        executableOperation("daily/today.md"),
        executableOperation("daily/tomorrow.md")
      ],
      error: "must return every planned operation exactly once"
    },
    {
      name: "non-executable operation",
      operations: [{
        kind: "skip" as const,
        target: "none" as const,
        relativePath: "daily/today.md"
      }],
      error: "returned a non-executable operation"
    },
    {
      name: "changed target",
      operations: [{
        ...executableOperation("daily/today.md"),
        target: "local" as const
      }],
      error: "returned an unplanned operation: daily/today.md"
    }
  ])("rejects adapter execution results with $name", async ({ operations, error }) => {
    const storage = createMemoryStorage();
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage }),
      adapter: {
        listResources: vi.fn(() => []),
        executeOperations: vi.fn(() => ({
          operations,
          remoteResources: []
        }))
      }
    });

    await expect(provider.executePlan({
      operations: [executableOperation("daily/today.md")],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    }, planRequest())).rejects.toThrow(error);
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("rejects duplicate adapter execution results", async () => {
    const storage = createMemoryStorage();
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage }),
      adapter: {
        listResources: vi.fn(() => []),
        executeOperations: vi.fn(() => ({
          operations: [
            executableOperation("daily/today.md"),
            executableOperation("daily/today.md")
          ],
          remoteResources: []
        }))
      }
    });

    await expect(provider.executePlan({
      operations: [
        executableOperation("daily/today.md"),
        executableOperation("daily/tomorrow.md")
      ],
      summary: {
        creates: 2,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    }, planRequest({
      resources: [
        localResource("daily/today.md"),
        localResource("daily/tomorrow.md")
      ]
    }))).rejects.toThrow("returned a duplicate operation: daily/today.md");
    expect(storage.write).not.toHaveBeenCalled();
  });

  it.each([
    {
      name: "create remote without local resource",
      planResources: [],
      remoteResources: [],
      operation: executableOperation("daily/today.md"),
      error: "create daily/today.md requires a local resource"
    },
    {
      name: "create remote over existing remote resource",
      planResources: [localResource("daily/today.md")],
      remoteResources: [remoteResource("daily/today.md")],
      operation: executableOperation("daily/today.md"),
      error: "create daily/today.md found an existing remote resource"
    },
    {
      name: "update remote without remote resource",
      planResources: [localResource("daily/today.md")],
      remoteResources: [],
      operation: {
        ...executableOperation("daily/today.md"),
        kind: "update" as const
      },
      error: "update daily/today.md requires local and remote resources"
    },
    {
      name: "delete remote without remote resource",
      planResources: [],
      remoteResources: [],
      operation: {
        ...executableOperation("daily/today.md"),
        kind: "delete" as const
      },
      error: "delete daily/today.md requires a remote resource"
    },
    {
      name: "unsupported executable target",
      planResources: [localResource("daily/today.md")],
      remoteResources: [remoteResource("daily/today.md")],
      operation: {
        ...executableOperation("daily/today.md"),
        kind: "delete" as const,
        target: "both" as const
      },
      error: "operation daily/today.md must target local or remote"
    }
  ])("rejects stale executable plans before adapter calls: $name", async ({
    planResources,
    remoteResources,
    operation,
    error
  }) => {
    const storage = createMemoryStorage();
    const adapter = {
      listResources: vi.fn(() => remoteResources),
      executeOperations: vi.fn(() => ({
        remoteResources: []
      }))
    };
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage }),
      adapter
    });

    await expect(provider.executePlan({
      operations: [operation],
      summary: summarizeOperations([operation])
    }, planRequest({
      resources: planResources
    }))).rejects.toThrow(error);
    expect(adapter.executeOperations).not.toHaveBeenCalled();
    expect(storage.write).not.toHaveBeenCalled();
  });

  it("aborts planning and execution before adapter calls", async () => {
    const controller = new AbortController();
    const adapter = {
      listResources: vi.fn(() => []),
      executeOperations: vi.fn(() => ({
        remoteResources: []
      }))
    };
    const provider = createRemoteSyncRawMirrorProvider({
      id: "raw.mirror",
      title: "Raw Mirror",
      manifestStore: new RemoteSyncManifestStore({ storage: createMemoryStorage() }),
      adapter
    });
    const request = planRequest({
      signal: controller.signal
    });

    controller.abort();

    await expect(provider.createPlan(request)).rejects.toThrow("Remote sync raw mirror request was aborted");
    await expect(provider.executePlan({
      operations: [{
        kind: "create",
        target: "remote",
        relativePath: "daily/today.md"
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    }, request)).rejects.toThrow("Remote sync raw mirror request was aborted");
    expect(adapter.listResources).not.toHaveBeenCalled();
    expect(adapter.executeOperations).not.toHaveBeenCalled();
  });
});

function planRequest(overrides: Partial<RemoteSyncPlanRequest> = {}): RemoteSyncPlanRequest {
  return {
    workspaceUri: URI.file("C:/Notes"),
    resources: [localResource("daily/today.md")],
    direction: "bidirectional",
    remoteScopeId: "workspace-root",
    metadata: {
      surface: "test"
    },
    ...overrides
  };
}

function localResource(relativePath: string): RemoteSyncPlanRequest["resources"][number] {
  return {
    uri: URI.file(`C:/Notes/${relativePath}`),
    relativePath,
    kind: "file",
    size: 12,
    contentHash: "hash-1"
  };
}

function remoteResource(relativePath: string): RemoteSyncRemoteResource {
  return {
    relativePath,
    kind: "file",
    remoteId: `remote:${relativePath}`,
    size: 12,
    contentHash: "hash-1"
  };
}

function executableOperation(relativePath: string): RemoteSyncOperation {
  return {
    kind: "create",
    target: "remote",
    relativePath
  };
}

function summarizeOperations(operations: readonly RemoteSyncOperation[]) {
  return {
    creates: operations.filter((operation) => operation.kind === "create").length,
    updates: operations.filter((operation) => operation.kind === "update").length,
    deletes: operations.filter((operation) => operation.kind === "delete").length,
    skips: operations.filter((operation) => operation.kind === "skip").length,
    conflicts: operations.filter((operation) => operation.kind === "conflict").length
  };
}

function createMemoryStorage() {
  const values = new Map<string, string>();

  return {
    values,
    read: vi.fn((key: string) => values.get(key)),
    write: vi.fn((key: string, value: string) => {
      values.set(key, value);
    })
  };
}
