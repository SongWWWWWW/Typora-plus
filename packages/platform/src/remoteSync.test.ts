import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { FileTreeEntry, WorkspaceFileTree } from "./files";
import {
  createRemoteSyncPlanFromDiff,
  createRemoteSyncPlanFromManifest,
  createRemoteSyncResourcesFromWorkspace,
  RemoteSyncService,
  type RemoteSyncManifestResource,
  type RemoteSyncPlan,
  type RemoteSyncPlanRequest,
  type RemoteSyncProgress,
  type RemoteSyncProvider,
  type RemoteSyncRemoteResource,
  type RemoteSyncResource
} from "./remoteSync";

describe("remote sync service", () => {
  it("registers providers and delegates normalized planning and execution requests", async () => {
    const service = new RemoteSyncService();
    const signal = new AbortController().signal;
    const workspaceUri = URI.file("C:/Notes");
    const fileUri = URI.file("C:/Notes/daily/today.md");
    const planRequests: RemoteSyncPlanRequest[] = [];
    const executeRequests: RemoteSyncPlanRequest[] = [];
    const executedPlans: RemoteSyncPlan[] = [];

    service.registerProvider({
      id: " feishu.drive ",
      title: " Feishu Drive ",
      createPlan(request) {
        planRequests.push(request);
        return {
          operations: [{
            kind: "create",
            target: "remote",
            relativePath: " daily\\today.md ",
            localUri: fileUri,
            remoteId: " remote-1 ",
            message: " Upload note "
          }],
          summary: {
            creates: 1,
            updates: 0,
            deletes: 0,
            skips: 0,
            conflicts: 0
          }
        };
      },
      executePlan(plan, request) {
        executedPlans.push(plan);
        executeRequests.push(request);
        return {
          operations: plan.operations,
          summary: plan.summary,
          completedAt: 100
        };
      }
    });

    const request: RemoteSyncPlanRequest = {
      workspaceUri,
      direction: "push",
      resources: [{
        uri: fileUri,
        relativePath: " daily\\today.md ",
        kind: "file",
        name: " today.md ",
        size: 128,
        mtime: 20,
        contentHash: " hash "
      }],
      remoteScopeId: " folder-token ",
      dryRun: true,
      metadata: {
        " surface ": "settings"
      },
      signal
    };

    const plan = await service.createPlan(" feishu.drive ", request);
    const result = await service.executePlan("feishu.drive", plan, request);

    expect(plan).toEqual({
      operations: [{
        kind: "create",
        target: "remote",
        relativePath: "daily/today.md",
        localUri: fileUri,
        remoteId: "remote-1",
        message: "Upload note"
      }],
      summary: {
        creates: 1,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });
    expect(result).toEqual({
      operations: plan.operations,
      summary: plan.summary,
      completedAt: 100
    });
    expect(planRequests).toEqual([{
      workspaceUri,
      direction: "push",
      resources: [{
        uri: fileUri,
        relativePath: "daily/today.md",
        kind: "file",
        name: "today.md",
        size: 128,
        mtime: 20,
        contentHash: "hash"
      }],
      remoteScopeId: "folder-token",
      dryRun: true,
      metadata: {
        surface: "settings"
      },
      signal
    }]);
    expect(executedPlans).toEqual([plan]);
    expect(executeRequests).toEqual(planRequests);
  });

  it("normalizes provider progress callbacks before they reach callers", async () => {
    const service = new RemoteSyncService();
    const fileUri = URI.file("C:/Notes/daily/today.md");
    const progressEvents: RemoteSyncProgress[] = [];

    service.registerProvider({
      id: "sync.progress",
      title: "Sync Progress",
      createPlan() {
        return plan("update");
      },
      executePlan(nextPlan, nextRequest) {
        nextRequest.onProgress?.({
          message: " Uploading note ",
          completed: 1,
          total: 2,
          operation: {
            kind: "update",
            target: "remote",
            relativePath: " daily\\today.md ",
            localUri: fileUri,
            message: " Sent "
          }
        });

        return {
          operations: nextPlan.operations,
          summary: nextPlan.summary
        };
      }
    });

    await service.executePlan("sync.progress", plan("update"), request({
      onProgress: (progress) => progressEvents.push(progress)
    }));

    expect(progressEvents).toEqual([{
      message: "Uploading note",
      completed: 1,
      total: 2,
      operation: {
        kind: "update",
        target: "remote",
        relativePath: "daily/today.md",
        localUri: fileUri,
        message: "Sent"
      }
    }]);
  });

  it("returns provider metadata sorted by title and id", () => {
    const service = new RemoteSyncService();
    service.registerProvider(provider("z.provider", "Workspace Mirror"));
    service.registerProvider(provider("a.provider", "Cloud Drive"));
    service.registerProvider(provider("b.provider", "Cloud Drive"));

    expect(service.getProviders()).toEqual([
      { id: "a.provider", title: "Cloud Drive" },
      { id: "b.provider", title: "Cloud Drive" },
      { id: "z.provider", title: "Workspace Mirror" }
    ]);
  });

  it("fires provider change events when providers are registered and unregistered", () => {
    const service = new RemoteSyncService();
    const snapshots: string[][] = [];
    const listener = service.onDidChangeRemoteSyncProviders(() => {
      snapshots.push(service.getProviders().map((registeredProvider) => registeredProvider.id));
    });

    const disposable = service.registerProvider(provider("feishu.drive", "Feishu Drive"));
    expect(() => service.registerProvider(provider(" feishu.drive ", "Duplicate")))
      .toThrow("Remote sync provider already registered: feishu.drive");

    disposable.dispose();
    disposable.dispose();
    listener.dispose();
    service.registerProvider(provider("local.folder", "Local Folder"));

    expect(snapshots).toEqual([
      ["feishu.drive"],
      []
    ]);
  });

  it("rejects duplicate providers, missing providers, and unregisters through disposables", async () => {
    const service = new RemoteSyncService();
    const disposable = service.registerProvider(provider("feishu.drive", "Feishu Drive"));

    expect(() => service.registerProvider(provider(" feishu.drive ", "Duplicate")))
      .toThrow("Remote sync provider already registered: feishu.drive");

    disposable.dispose();
    expect(service.getProviders()).toEqual([]);

    await expect(service.createPlan("feishu.drive", request())).rejects
      .toThrow("No remote sync provider registered: feishu.drive");
  });

  it("validates provider shape, resource paths, directions, operations, and summaries", async () => {
    const service = new RemoteSyncService();

    expect(() => service.registerProvider(provider("", "Feishu Drive")))
      .toThrow("Remote sync provider id must not be empty");
    expect(() => service.registerProvider({
      id: "feishu.drive",
      title: "Feishu Drive",
      executePlan: () => result()
    } as never)).toThrow("Remote sync provider for feishu.drive must provide createPlan");
    expect(() => service.registerProvider({
      id: "feishu.drive",
      title: "Feishu Drive",
      createPlan: () => plan()
    } as never)).toThrow("Remote sync provider for feishu.drive must provide executePlan");

    service.registerProvider({
      id: "bad.result",
      title: "Bad Result",
      createPlan() {
        return {
          operations: [{
            kind: "create",
            target: "remote",
            relativePath: "/absolute.md"
          }],
          summary: {
            creates: 1,
            updates: 0,
            deletes: 0,
            skips: 0,
            conflicts: 0
          }
        };
      },
      executePlan() {
        return {
          operations: [],
          summary: {
            creates: -1,
            updates: 0,
            deletes: 0,
            skips: 0,
            conflicts: 0
          }
        };
      }
    });
    service.registerProvider({
      id: "missing.target",
      title: "Missing Target",
      createPlan() {
        return {
          operations: [{
            kind: "skip",
            relativePath: "a.md"
          }],
          summary: {
            creates: 0,
            updates: 0,
            deletes: 0,
            skips: 1,
            conflicts: 0
          }
        } as never;
      },
      executePlan() {
        return result();
      }
    });
    service.registerProvider({
      id: "bad.summary",
      title: "Bad Summary",
      createPlan() {
        return {
          operations: [{
            kind: "skip",
            target: "none",
            relativePath: "a.md"
          }],
          summary: {
            creates: 1,
            updates: 0,
            deletes: 0,
            skips: 0,
            conflicts: 0
          }
        };
      },
      executePlan() {
        return {
          operations: [{
            kind: "update",
            target: "remote",
            relativePath: "a.md"
          }],
          summary: {
            creates: 0,
            updates: 0,
            deletes: 0,
            skips: 1,
            conflicts: 0
          }
        };
      }
    });
    service.registerProvider({
      id: "bad.progress",
      title: "Bad Progress",
      createPlan() {
        return plan();
      },
      executePlan(_plan, nextRequest) {
        nextRequest.onProgress?.({
          message: "Uploading",
          completed: 3,
          total: 2
        });

        return result();
      }
    });

    await expect(service.createPlan("bad.result", request({
      direction: "sideways" as never
    }))).rejects.toThrow("Remote sync direction must be push, pull, or bidirectional");
    await expect(service.createPlan("bad.result", request({
      resources: [{
        uri: URI.file("C:/Notes/escape.md"),
        relativePath: "../escape.md",
        kind: "file"
      }]
    }))).rejects.toThrow("Remote sync resource 0 relative path must not contain parent traversal");
    await expect(service.createPlan("bad.result", request())).rejects
      .toThrow("Remote sync operation 0 relative path must be workspace-relative");
    await expect(service.createPlan("missing.target", request())).rejects
      .toThrow("Remote sync operation target must be local, remote, both, or none");
    await expect(service.executePlan("bad.result", plan(), request())).rejects
      .toThrow("Remote sync summary creates must be a non-negative integer");
    await expect(service.createPlan("bad.summary", request())).rejects
      .toThrow("Remote sync plan summary creates must match operation count");
    await expect(service.executePlan("bad.summary", plan(), request())).rejects
      .toThrow("Remote sync result summary updates must match operation count");
    await expect(service.executePlan("bad.result", plan(), request({
      onProgress: "not a callback" as never
    }))).rejects.toThrow("Remote sync progress callback must be a function");
    await expect(service.executePlan("bad.progress", plan(), request({
      onProgress: () => undefined
    }))).rejects.toThrow("Remote sync progress completed must not exceed total");
  });

  it("creates normalized sync resources from workspace files", () => {
    const workspace = workspaceTree([
      file("daily\\today.md", { size: 128, mtime: 20 }),
      file("archive/yesterday.md")
    ]);

    expect(createRemoteSyncResourcesFromWorkspace(workspace)).toEqual([
      {
        uri: URI.file("C:/Notes/daily/today.md"),
        relativePath: "daily/today.md",
        kind: "file",
        name: "today.md",
        size: 128,
        mtime: 20
      },
      {
        uri: URI.file("C:/Notes/archive/yesterday.md"),
        relativePath: "archive/yesterday.md",
        kind: "file",
        name: "yesterday.md"
      }
    ]);
  });

  it("can include directory resources from the workspace tree without including the root", () => {
    const today = file("daily/today.md");
    const folder = directory("daily", [today]);
    const workspace: WorkspaceFileTree = {
      root: {
        uri: URI.file("C:/Notes"),
        relativePath: "",
        kind: "directory",
        name: "Notes",
        children: [folder]
      },
      files: [today]
    };

    expect(createRemoteSyncResourcesFromWorkspace(workspace, { includeDirectories: true })).toEqual([
      {
        uri: URI.file("C:/Notes/daily"),
        relativePath: "daily",
        kind: "directory",
        name: "daily"
      },
      {
        uri: URI.file("C:/Notes/daily/today.md"),
        relativePath: "daily/today.md",
        kind: "file",
        name: "today.md"
      }
    ]);
  });

  it("rejects unsafe workspace resource paths before providers see them", () => {
    const workspace = workspaceTree([
      {
        uri: URI.file("C:/Notes/escape.md"),
        relativePath: "../escape.md",
        kind: "file",
        name: "escape.md"
      }
    ]);

    expect(() => createRemoteSyncResourcesFromWorkspace(workspace))
      .toThrow("Remote sync resource 0 relative path must not contain parent traversal");
  });

  it("creates stable push diff plans without deleting missing remote resources by default", () => {
    const plan = createRemoteSyncPlanFromDiff({
      direction: "push",
      localResources: [
        localResource("same.md", { contentHash: "same" }),
        localResource("changed.md", { contentHash: "local" }),
        localResource("local-only.md", { contentHash: "local" })
      ],
      remoteResources: [
        remoteResource("remote-only.md", { remoteId: "remote-only", contentHash: "remote" }),
        remoteResource("same.md", { remoteId: "same", contentHash: "same" }),
        remoteResource("changed.md", { remoteId: "changed", contentHash: "remote" })
      ]
    });

    expect(plan).toEqual({
      operations: [
        {
          kind: "update",
          target: "remote",
          relativePath: "changed.md",
          localUri: URI.file("C:/Notes/changed.md"),
          remoteId: "changed"
        },
        {
          kind: "create",
          target: "remote",
          relativePath: "local-only.md",
          localUri: URI.file("C:/Notes/local-only.md")
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "remote-only.md",
          remoteId: "remote-only",
          message: "Local resource is missing"
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "same.md",
          localUri: URI.file("C:/Notes/same.md"),
          remoteId: "same"
        }
      ],
      summary: {
        creates: 1,
        updates: 1,
        deletes: 0,
        skips: 2,
        conflicts: 0
      }
    });
  });

  it("creates delete operations only when missing resources are explicitly deleted", () => {
    expect(createRemoteSyncPlanFromDiff({
      direction: "push",
      deleteMissing: true,
      localResources: [],
      remoteResources: [
        remoteResource("remote-only.md", { remoteId: "remote-only" })
      ]
    })).toEqual({
      operations: [{
        kind: "delete",
        target: "remote",
        relativePath: "remote-only.md",
        remoteId: "remote-only",
        message: "Local resource is missing"
      }],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 1,
        skips: 0,
        conflicts: 0
      }
    });
  });

  it("creates pull diff plans from remote snapshots", () => {
    const plan = createRemoteSyncPlanFromDiff({
      direction: "pull",
      deleteMissing: true,
      localResources: [
        localResource("changed.md", { size: 20, mtime: 2 }),
        localResource("local-only.md")
      ],
      remoteResources: [
        remoteResource("changed.md", { remoteId: "changed", size: 22, mtime: 3 }),
        remoteResource("remote-only.md", { remoteId: "remote-only", size: 10, mtime: 1 })
      ]
    });

    expect(plan).toEqual({
      operations: [
        {
          kind: "update",
          target: "local",
          relativePath: "changed.md",
          localUri: URI.file("C:/Notes/changed.md"),
          remoteId: "changed"
        },
        {
          kind: "delete",
          target: "local",
          relativePath: "local-only.md",
          localUri: URI.file("C:/Notes/local-only.md"),
          message: "Remote resource is missing"
        },
        {
          kind: "create",
          target: "local",
          relativePath: "remote-only.md",
          remoteId: "remote-only"
        }
      ],
      summary: {
        creates: 1,
        updates: 1,
        deletes: 1,
        skips: 0,
        conflicts: 0
      }
    });
  });

  it("keeps bidirectional diff plans conservative for changed or unknown resources", () => {
    const plan = createRemoteSyncPlanFromDiff({
      direction: "bidirectional",
      localResources: [
        localResource("changed.md", { contentHash: "local" }),
        localResource("kind.md", { kind: "file", contentHash: "same" }),
        localResource("local-only.md"),
        localResource("same.md", { size: 10, mtime: 1 }),
        localResource("unknown.md")
      ],
      remoteResources: [
        remoteResource("changed.md", { remoteId: "changed", contentHash: "remote" }),
        remoteResource("kind.md", { kind: "directory", remoteId: "kind", contentHash: "same" }),
        remoteResource("remote-only.md", { remoteId: "remote-only" }),
        remoteResource("same.md", { remoteId: "same", size: 10, mtime: 1 }),
        remoteResource("unknown.md", { remoteId: "unknown" })
      ]
    });

    expect(plan).toEqual({
      operations: [
        {
          kind: "conflict",
          target: "both",
          relativePath: "changed.md",
          localUri: URI.file("C:/Notes/changed.md"),
          remoteId: "changed",
          message: "Resource differs on both sides"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "kind.md",
          localUri: URI.file("C:/Notes/kind.md"),
          remoteId: "kind",
          message: "Resource kind differs"
        },
        {
          kind: "create",
          target: "remote",
          relativePath: "local-only.md",
          localUri: URI.file("C:/Notes/local-only.md")
        },
        {
          kind: "create",
          target: "local",
          relativePath: "remote-only.md",
          remoteId: "remote-only"
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "same.md",
          localUri: URI.file("C:/Notes/same.md"),
          remoteId: "same"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "unknown.md",
          localUri: URI.file("C:/Notes/unknown.md"),
          remoteId: "unknown",
          message: "Resource state cannot be compared"
        }
      ],
      summary: {
        creates: 2,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 3
      }
    });
  });

  it("uses sync manifests to resolve single-sided bidirectional changes", () => {
    const plan = createRemoteSyncPlanFromManifest({
      direction: "bidirectional",
      localResources: [
        localResource("local-changed.md", { contentHash: "local-v2" }),
        localResource("local-only.md", { contentHash: "local-new" }),
        localResource("remote-changed.md", { contentHash: "base" }),
        localResource("same.md", { contentHash: "same" })
      ],
      remoteResources: [
        remoteResource("local-changed.md", { remoteId: "local-changed", contentHash: "base" }),
        remoteResource("remote-changed.md", { remoteId: "remote-changed", contentHash: "remote-v2" }),
        remoteResource("remote-only.md", { remoteId: "remote-only", contentHash: "remote-new" }),
        remoteResource("same.md", { remoteId: "same", contentHash: "same" })
      ],
      manifestResources: [
        manifestResource("local-changed.md", { remoteId: "local-changed", contentHash: "base" }),
        manifestResource("remote-changed.md", { remoteId: "remote-changed", contentHash: "base" }),
        manifestResource("same.md", { remoteId: "same", contentHash: "same" })
      ]
    });

    expect(plan).toEqual({
      operations: [
        {
          kind: "update",
          target: "remote",
          relativePath: "local-changed.md",
          localUri: URI.file("C:/Notes/local-changed.md"),
          remoteId: "local-changed"
        },
        {
          kind: "create",
          target: "remote",
          relativePath: "local-only.md",
          localUri: URI.file("C:/Notes/local-only.md")
        },
        {
          kind: "update",
          target: "local",
          relativePath: "remote-changed.md",
          localUri: URI.file("C:/Notes/remote-changed.md"),
          remoteId: "remote-changed"
        },
        {
          kind: "create",
          target: "local",
          relativePath: "remote-only.md",
          remoteId: "remote-only"
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "same.md",
          localUri: URI.file("C:/Notes/same.md"),
          remoteId: "same"
        }
      ],
      summary: {
        creates: 2,
        updates: 2,
        deletes: 0,
        skips: 1,
        conflicts: 0
      }
    });
  });

  it("keeps manifest-backed deletions non-destructive unless explicitly enabled", () => {
    const input = {
      direction: "bidirectional" as const,
      localResources: [
        localResource("remote-deleted.md", { contentHash: "base" })
      ],
      remoteResources: [
        remoteResource("local-deleted.md", { remoteId: "local-deleted", contentHash: "base" })
      ],
      manifestResources: [
        manifestResource("local-deleted.md", { remoteId: "local-deleted", contentHash: "base" }),
        manifestResource("remote-deleted.md", { remoteId: "remote-deleted", contentHash: "base" })
      ]
    };

    expect(createRemoteSyncPlanFromManifest(input).operations).toEqual([
      {
        kind: "skip",
        target: "none",
        relativePath: "local-deleted.md",
        remoteId: "local-deleted",
        message: "Local resource is missing"
      },
      {
        kind: "skip",
        target: "none",
        relativePath: "remote-deleted.md",
        localUri: URI.file("C:/Notes/remote-deleted.md"),
        remoteId: "remote-deleted",
        message: "Remote resource is missing"
      }
    ]);

    expect(createRemoteSyncPlanFromManifest({ ...input, deleteMissing: true }).operations).toEqual([
      {
        kind: "delete",
        target: "remote",
        relativePath: "local-deleted.md",
        remoteId: "local-deleted",
        message: "Local resource is missing"
      },
      {
        kind: "delete",
        target: "local",
        relativePath: "remote-deleted.md",
        localUri: URI.file("C:/Notes/remote-deleted.md"),
        remoteId: "remote-deleted",
        message: "Remote resource is missing"
      }
    ]);
  });

  it("uses manifests to surface bidirectional conflicts instead of guessing", () => {
    const plan = createRemoteSyncPlanFromManifest({
      direction: "bidirectional",
      localResources: [
        localResource("both-changed.md", { contentHash: "local" }),
        localResource("local-changed-remote-missing.md", { contentHash: "local" }),
        localResource("no-baseline.md", { contentHash: "local" }),
        localResource("unknown.md")
      ],
      remoteResources: [
        remoteResource("both-changed.md", { remoteId: "both-changed", contentHash: "remote" }),
        remoteResource("local-missing-remote-changed.md", { remoteId: "local-missing", contentHash: "remote" }),
        remoteResource("no-baseline.md", { remoteId: "no-baseline", contentHash: "remote" }),
        remoteResource("unknown.md", { remoteId: "unknown" })
      ],
      manifestResources: [
        manifestResource("both-changed.md", { remoteId: "both-changed", contentHash: "base" }),
        manifestResource("local-changed-remote-missing.md", { remoteId: "remote-missing", contentHash: "base" }),
        manifestResource("local-missing-remote-changed.md", { remoteId: "local-missing", contentHash: "base" }),
        manifestResource("unknown.md", { remoteId: "unknown", contentHash: "base" })
      ]
    });

    expect(plan).toEqual({
      operations: [
        {
          kind: "conflict",
          target: "both",
          relativePath: "both-changed.md",
          localUri: URI.file("C:/Notes/both-changed.md"),
          remoteId: "both-changed",
          message: "Resource changed on both sides"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "local-changed-remote-missing.md",
          localUri: URI.file("C:/Notes/local-changed-remote-missing.md"),
          remoteId: "remote-missing",
          message: "Remote resource is missing and local resource changed"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "local-missing-remote-changed.md",
          remoteId: "local-missing",
          message: "Local resource is missing and remote resource changed"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "no-baseline.md",
          localUri: URI.file("C:/Notes/no-baseline.md"),
          remoteId: "no-baseline",
          message: "Resource has no synced baseline"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "unknown.md",
          localUri: URI.file("C:/Notes/unknown.md"),
          remoteId: "unknown",
          message: "Resource state cannot be compared"
        }
      ],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 5
      }
    });
  });

  it("rejects ambiguous diff inputs", () => {
    expect(() => createRemoteSyncPlanFromDiff({
      direction: "push",
      localResources: [
        localResource("same.md"),
        localResource("same.md")
      ],
      remoteResources: []
    })).toThrow("Duplicate local remote sync resource: same.md");
    expect(() => createRemoteSyncPlanFromDiff({
      direction: "push",
      localResources: [],
      remoteResources: [
        remoteResource("same.md"),
        remoteResource("same.md")
      ]
    })).toThrow("Duplicate remote remote sync resource: same.md");
    expect(() => createRemoteSyncPlanFromDiff({
      direction: "push",
      localResources: [],
      remoteResources: [
        remoteResource("../escape.md")
      ]
    })).toThrow("Remote sync remote resource 0 relative path must not contain parent traversal");
  });

  it("rejects ambiguous manifest inputs", () => {
    expect(() => createRemoteSyncPlanFromManifest({
      direction: "bidirectional",
      localResources: [],
      remoteResources: [],
      manifestResources: [
        manifestResource("same.md"),
        manifestResource("same.md")
      ]
    })).toThrow("Duplicate manifest remote sync resource: same.md");
    expect(() => createRemoteSyncPlanFromManifest({
      direction: "bidirectional",
      localResources: [],
      remoteResources: [],
      manifestResources: [
        manifestResource("../escape.md")
      ]
    })).toThrow("Remote sync manifest resource 0 relative path must not contain parent traversal");
  });
});

function provider(id: string, title: string): RemoteSyncProvider {
  return {
    id,
    title,
    createPlan() {
      return plan();
    },
    executePlan() {
      return result();
    }
  };
}

function request(overrides: Partial<RemoteSyncPlanRequest> = {}): RemoteSyncPlanRequest {
  return {
    workspaceUri: URI.file("C:/Notes"),
    direction: "push",
    resources: [{
      uri: URI.file("C:/Notes/a.md"),
      relativePath: "a.md",
      kind: "file"
    }],
    ...overrides
  };
}

function workspaceTree(files: readonly FileTreeEntry[]): WorkspaceFileTree {
  return {
    root: {
      uri: URI.file("C:/Notes"),
      relativePath: "",
      kind: "directory",
      name: "Notes",
      children: files
    },
    files
  };
}

function file(relativePath: string, metadata: { readonly size?: number; readonly mtime?: number } = {}): FileTreeEntry {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  const name = normalizedPath.split("/").at(-1) ?? normalizedPath;

  return {
    uri: URI.file(`C:/Notes/${normalizedPath}`),
    relativePath,
    kind: "file",
    name,
    ...metadata
  };
}

function directory(relativePath: string, children: readonly FileTreeEntry[]): FileTreeEntry {
  const name = relativePath.split("/").at(-1) ?? relativePath;

  return {
    uri: URI.file(`C:/Notes/${relativePath}`),
    relativePath,
    kind: "directory",
    name,
    children
  };
}

function localResource(
  relativePath: string,
  metadata: Partial<Pick<RemoteSyncResource, "kind" | "size" | "mtime" | "contentHash">> = {}
): RemoteSyncResource {
  return {
    uri: URI.file(`C:/Notes/${relativePath}`),
    relativePath,
    kind: metadata.kind ?? "file",
    ...(metadata.size === undefined ? {} : { size: metadata.size }),
    ...(metadata.mtime === undefined ? {} : { mtime: metadata.mtime }),
    ...(metadata.contentHash === undefined ? {} : { contentHash: metadata.contentHash })
  };
}

function remoteResource(
  relativePath: string,
  metadata: Partial<RemoteSyncRemoteResource> = {}
): RemoteSyncRemoteResource {
  return {
    relativePath,
    kind: metadata.kind ?? "file",
    ...(metadata.remoteId === undefined ? {} : { remoteId: metadata.remoteId }),
    ...(metadata.size === undefined ? {} : { size: metadata.size }),
    ...(metadata.mtime === undefined ? {} : { mtime: metadata.mtime }),
    ...(metadata.contentHash === undefined ? {} : { contentHash: metadata.contentHash })
  };
}

function manifestResource(
  relativePath: string,
  metadata: Partial<RemoteSyncManifestResource> = {}
): RemoteSyncManifestResource {
  return {
    relativePath,
    kind: metadata.kind ?? "file",
    ...(metadata.remoteId === undefined ? {} : { remoteId: metadata.remoteId }),
    ...(metadata.size === undefined ? {} : { size: metadata.size }),
    ...(metadata.mtime === undefined ? {} : { mtime: metadata.mtime }),
    ...(metadata.contentHash === undefined ? {} : { contentHash: metadata.contentHash })
  };
}

function plan(kind: RemoteSyncPlan["operations"][number]["kind"] = "skip"): RemoteSyncPlan {
  return {
    operations: [{
      kind,
      target: kind === "conflict" ? "both" : kind === "skip" ? "none" : "remote",
      relativePath: "a.md"
    }],
    summary: {
      creates: kind === "create" ? 1 : 0,
      updates: kind === "update" ? 1 : 0,
      deletes: kind === "delete" ? 1 : 0,
      skips: kind === "skip" ? 1 : 0,
      conflicts: kind === "conflict" ? 1 : 0
    }
  };
}

function result() {
  const nextPlan = plan();

  return {
    operations: nextPlan.operations,
    summary: nextPlan.summary
  };
}
