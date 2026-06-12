import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { FileTreeEntry, WorkspaceFileTree } from "./files";
import {
  createRemoteSyncManifestResourcesFromExecution,
  createRemoteSyncManifestStorageKey,
  createRemoteSyncPlanFromDiff,
  createRemoteSyncPlanFromManifest,
  createRemoteSyncResourcesFromWorkspace,
  defaultRemoteSyncManifestStoreOptions,
  remoteSyncManifestSnapshotVersion,
  RemoteSyncManifestStore,
  RemoteSyncService,
  type RemoteSyncManifestStorage,
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
    service.registerProvider({
      id: "bad.presence",
      title: "Bad Presence",
      createPlan() {
        return {
          operations: [{
            kind: "conflict",
            target: "both",
            relativePath: "a.md",
            localPresence: "nearby"
          }],
          summary: {
            creates: 0,
            updates: 0,
            deletes: 0,
            skips: 0,
            conflicts: 1
          }
        } as never;
      },
      executePlan() {
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
    await expect(service.createPlan("bad.presence", request())).rejects
      .toThrow("Remote sync operation 0 local presence must be present, missing, or unknown");
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
          localPresence: "present",
          localUri: URI.file("C:/Notes/changed.md"),
          remotePresence: "present",
          remoteId: "changed",
          message: "Resource differs on both sides"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "kind.md",
          localPresence: "present",
          localUri: URI.file("C:/Notes/kind.md"),
          remotePresence: "present",
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
          localPresence: "present",
          localUri: URI.file("C:/Notes/unknown.md"),
          remotePresence: "present",
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
          localPresence: "present",
          localUri: URI.file("C:/Notes/both-changed.md"),
          remotePresence: "present",
          remoteId: "both-changed",
          message: "Resource changed on both sides"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "local-changed-remote-missing.md",
          localPresence: "present",
          localUri: URI.file("C:/Notes/local-changed-remote-missing.md"),
          remotePresence: "missing",
          remoteId: "remote-missing",
          message: "Remote resource is missing and local resource changed"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "local-missing-remote-changed.md",
          localPresence: "missing",
          remotePresence: "present",
          remoteId: "local-missing",
          message: "Local resource is missing and remote resource changed"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "no-baseline.md",
          localPresence: "present",
          localUri: URI.file("C:/Notes/no-baseline.md"),
          remotePresence: "present",
          remoteId: "no-baseline",
          message: "Resource has no synced baseline"
        },
        {
          kind: "conflict",
          target: "both",
          relativePath: "unknown.md",
          localPresence: "present",
          localUri: URI.file("C:/Notes/unknown.md"),
          remotePresence: "present",
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

  it("updates manifests from executed create and update operations with verified snapshots", () => {
    const resources = createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [
        manifestResource("conflict.md", { remoteId: "conflict", contentHash: "old-conflict" }),
        manifestResource("skipped.md", { remoteId: "skipped", contentHash: "old-skipped" }),
        manifestResource("untouched.md", { remoteId: "untouched", contentHash: "untouched" }),
        manifestResource("updated-local.md", { remoteId: "updated-local", contentHash: "old-local" }),
        manifestResource("updated-remote.md", { remoteId: "updated-remote", contentHash: "old-remote" })
      ],
      localResources: [
        localResource("created-remote.md", { contentHash: "created", size: 10, mtime: 1 }),
        localResource("updated-local.md", { contentHash: "remote-v2", size: 20, mtime: 2 }),
        localResource("updated-remote.md", { contentHash: "local-v2", size: 30, mtime: 3 })
      ],
      remoteResources: [
        remoteResource("created-remote.md", { remoteId: "created-from-snapshot", contentHash: "created", size: 10, mtime: 1 }),
        remoteResource("updated-local.md", { remoteId: "updated-local", contentHash: "remote-v2", size: 20, mtime: 2 }),
        remoteResource("updated-remote.md", { remoteId: "updated-remote", contentHash: "local-v2", size: 30, mtime: 3 })
      ],
      operations: [
        { kind: "create", target: "remote", relativePath: "created-remote.md", remoteId: "created-from-result" },
        { kind: "update", target: "local", relativePath: "updated-local.md" },
        { kind: "update", target: "remote", relativePath: "updated-remote.md" },
        { kind: "skip", target: "none", relativePath: "skipped.md" },
        { kind: "conflict", target: "both", relativePath: "conflict.md" }
      ]
    });

    expect(resources).toEqual([
      manifestResource("conflict.md", { remoteId: "conflict", contentHash: "old-conflict" }),
      manifestResource("created-remote.md", {
        remoteId: "created-from-result",
        contentHash: "created",
        size: 10,
        mtime: 1
      }),
      manifestResource("skipped.md", { remoteId: "skipped", contentHash: "old-skipped" }),
      manifestResource("untouched.md", { remoteId: "untouched", contentHash: "untouched" }),
      manifestResource("updated-local.md", {
        remoteId: "updated-local",
        contentHash: "remote-v2",
        size: 20,
        mtime: 2
      }),
      manifestResource("updated-remote.md", {
        remoteId: "updated-remote",
        contentHash: "local-v2",
        size: 30,
        mtime: 3
      })
    ]);
  });

  it("refreshes manifests from verified skip operations", () => {
    const resources = createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [
        manifestResource("missing-snapshot.md", { remoteId: "missing-snapshot", contentHash: "old" }),
        manifestResource("remote-id-drift.md", { remoteId: "old-remote-id", contentHash: "same" })
      ],
      localResources: [
        localResource("new-baseline.md", { contentHash: "same", size: 10, mtime: 1 }),
        localResource("remote-id-drift.md", { contentHash: "same" })
      ],
      remoteResources: [
        remoteResource("new-baseline.md", { remoteId: "new-baseline", contentHash: "same", size: 10, mtime: 1 }),
        remoteResource("remote-id-drift.md", { remoteId: "new-remote-id", contentHash: "same" })
      ],
      operations: [
        {
          kind: "skip",
          target: "none",
          relativePath: "missing-snapshot.md"
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "new-baseline.md",
          localUri: URI.file("C:/Notes/new-baseline.md"),
          remoteId: "new-baseline"
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "remote-id-drift.md",
          localUri: URI.file("C:/Notes/remote-id-drift.md"),
          remoteId: "new-remote-id"
        }
      ]
    });

    expect(resources).toEqual([
      manifestResource("missing-snapshot.md", { remoteId: "missing-snapshot", contentHash: "old" }),
      manifestResource("new-baseline.md", {
        remoteId: "new-baseline",
        contentHash: "same",
        size: 10,
        mtime: 1
      }),
      manifestResource("remote-id-drift.md", { remoteId: "new-remote-id", contentHash: "same" })
    ]);
  });

  it("removes manifest baselines for executed delete operations", () => {
    expect(createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [
        manifestResource("delete-both.md", { remoteId: "delete-both", contentHash: "base" }),
        manifestResource("delete-local.md", { remoteId: "delete-local", contentHash: "base" }),
        manifestResource("delete-none.md", { remoteId: "delete-none", contentHash: "base" }),
        manifestResource("delete-remote.md", { remoteId: "delete-remote", contentHash: "base" }),
        manifestResource("keep.md", { remoteId: "keep", contentHash: "base" })
      ],
      localResources: [],
      remoteResources: [],
      operations: [
        { kind: "delete", target: "both", relativePath: "delete-both.md" },
        { kind: "delete", target: "local", relativePath: "delete-local.md" },
        { kind: "delete", target: "none", relativePath: "delete-none.md" },
        { kind: "delete", target: "remote", relativePath: "delete-remote.md" }
      ]
    })).toEqual([
      manifestResource("delete-none.md", { remoteId: "delete-none", contentHash: "base" }),
      manifestResource("keep.md", { remoteId: "keep", contentHash: "base" })
    ]);
  });

  it("rejects manifest execution updates that are ambiguous or not proven synchronized", () => {
    expect(() => createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [
        manifestResource("same.md"),
        manifestResource("same.md")
      ],
      localResources: [],
      remoteResources: [],
      operations: []
    })).toThrow("Duplicate manifest remote sync resource: same.md");

    expect(() => createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [],
      localResources: [
        localResource("same.md"),
        localResource("same.md")
      ],
      remoteResources: [],
      operations: []
    })).toThrow("Duplicate local remote sync resource: same.md");

    expect(() => createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [],
      localResources: [
        localResource("target-both.md", { contentHash: "same" })
      ],
      remoteResources: [
        remoteResource("target-both.md", { contentHash: "same" })
      ],
      operations: [
        { kind: "update", target: "both", relativePath: "target-both.md" }
      ]
    })).toThrow("Remote sync manifest update target-both.md must target local or remote");

    expect(() => createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [],
      localResources: [
        localResource("missing-remote.md", { contentHash: "same" })
      ],
      remoteResources: [],
      operations: [
        { kind: "update", target: "remote", relativePath: "missing-remote.md" }
      ]
    })).toThrow("Remote sync manifest update missing-remote.md requires local and remote resources");

    expect(() => createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [],
      localResources: [
        localResource("kind.md", { kind: "file", contentHash: "same" })
      ],
      remoteResources: [
        remoteResource("kind.md", { kind: "directory", contentHash: "same" })
      ],
      operations: [
        { kind: "update", target: "remote", relativePath: "kind.md" }
      ]
    })).toThrow("Remote sync manifest update kind.md resource kind differs");

    expect(() => createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [],
      localResources: [
        localResource("changed.md", { contentHash: "local" })
      ],
      remoteResources: [
        remoteResource("changed.md", { contentHash: "remote" })
      ],
      operations: [
        { kind: "update", target: "remote", relativePath: "changed.md" }
      ]
    })).toThrow("Remote sync manifest update changed.md resources are not synchronized");

    expect(() => createRemoteSyncManifestResourcesFromExecution({
      manifestResources: [],
      localResources: [
        localResource("unknown.md")
      ],
      remoteResources: [
        remoteResource("unknown.md")
      ],
      operations: [
        { kind: "update", target: "remote", relativePath: "unknown.md" }
      ]
    })).toThrow("Remote sync manifest update unknown.md resource state cannot be compared");
  });

  it("persists and restores normalized manifest resources", () => {
    const storage = manifestStorage();
    const scope = {
      workspaceUri: URI.file("C:/Notes"),
      providerId: " sync.provider ",
      remoteScopeId: " folder "
    };
    const store = new RemoteSyncManifestStore({ storage });

    store.setScope(scope);
    store.writeResources([
      manifestResource(" z\\later.md ", { remoteId: " remote-z ", size: 12, mtime: 2, contentHash: " hash-z " }),
      manifestResource("a.md", { remoteId: "remote-a", size: 4, mtime: 1, contentHash: "hash-a" })
    ]);

    const restored = new RemoteSyncManifestStore({ storage });
    restored.setScope({
      workspaceUri: URI.file("C:/Notes"),
      providerId: "sync.provider",
      remoteScopeId: "folder"
    });

    expect(restored.readResources()).toEqual([
      manifestResource("a.md", { remoteId: "remote-a", size: 4, mtime: 1, contentHash: "hash-a" }),
      manifestResource("z/later.md", { remoteId: "remote-z", size: 12, mtime: 2, contentHash: "hash-z" })
    ]);

    restored.clear();
    expect(store.readResources()).toEqual([]);
  });

  it("scopes persisted manifests by workspace, provider, and remote scope", () => {
    const storage = manifestStorage();
    const store = new RemoteSyncManifestStore({ storage });
    const workspaceScope = {
      workspaceUri: URI.file("C:/Notes"),
      providerId: "sync.provider",
      remoteScopeId: "folder-a"
    };
    const sameScopeWithTrimmedValues = {
      workspaceUri: URI.file("C:/Notes"),
      providerId: " sync.provider ",
      remoteScopeId: " folder-a "
    };
    const otherWorkspaceScope = {
      workspaceUri: URI.file("C:/Other"),
      providerId: "sync.provider",
      remoteScopeId: "folder-a"
    };
    const otherProviderScope = {
      workspaceUri: URI.file("C:/Notes"),
      providerId: "other.provider",
      remoteScopeId: "folder-a"
    };
    const otherRemoteScope = {
      workspaceUri: URI.file("C:/Notes"),
      providerId: "sync.provider",
      remoteScopeId: "folder-b"
    };

    expect(createRemoteSyncManifestStorageKey("manifest", workspaceScope))
      .toBe(createRemoteSyncManifestStorageKey("manifest", sameScopeWithTrimmedValues));
    expect(createRemoteSyncManifestStorageKey("manifest", workspaceScope))
      .not.toBe(createRemoteSyncManifestStorageKey("manifest", otherWorkspaceScope));
    expect(createRemoteSyncManifestStorageKey("manifest", workspaceScope))
      .not.toBe(createRemoteSyncManifestStorageKey("manifest", otherProviderScope));
    expect(createRemoteSyncManifestStorageKey("manifest", workspaceScope))
      .not.toBe(createRemoteSyncManifestStorageKey("manifest", otherRemoteScope));

    store.setScope(workspaceScope);
    store.writeResources([manifestResource("a.md", { remoteId: "a" })]);

    store.setScope(otherWorkspaceScope);
    expect(store.readResources()).toEqual([]);
    store.writeResources([manifestResource("b.md", { remoteId: "b" })]);

    store.setScope(otherProviderScope);
    expect(store.readResources()).toEqual([]);

    store.setScope(otherRemoteScope);
    expect(store.readResources()).toEqual([]);

    store.setScope(workspaceScope);
    expect(store.readResources()).toEqual([manifestResource("a.md", { remoteId: "a" })]);

    store.setScope(otherWorkspaceScope);
    expect(store.readResources()).toEqual([manifestResource("b.md", { remoteId: "b" })]);
  });

  it("ignores malformed, old-version, and mismatched manifest snapshots", () => {
    const storage = manifestStorage();
    const scope = {
      workspaceUri: URI.file("C:/Notes"),
      providerId: "sync.provider",
      remoteScopeId: "folder"
    };
    const key = createRemoteSyncManifestStorageKey(defaultRemoteSyncManifestStoreOptions.storageKey, scope);
    const store = new RemoteSyncManifestStore({ storage });

    store.setScope(scope);
    storage.values.set(key, "{bad json");
    expect(store.readResources()).toEqual([]);

    storage.values.set(key, JSON.stringify({
      version: remoteSyncManifestSnapshotVersion + 1,
      resources: [manifestResource("a.md")]
    }));
    expect(store.readResources()).toEqual([]);

    storage.values.set(key, JSON.stringify({
      version: remoteSyncManifestSnapshotVersion,
      scope: "other",
      resources: [manifestResource("a.md")]
    }));
    expect(store.readResources()).toEqual([]);

    storage.values.set(key, JSON.stringify({
      version: remoteSyncManifestSnapshotVersion,
      resources: [manifestResource("a.md")]
    }));
    expect(store.readResources()).toEqual([]);
  });

  it("rejects ambiguous manifest store writes and ignores unsafe stored snapshots", () => {
    const storage = manifestStorage();
    const store = new RemoteSyncManifestStore({ storage });

    expect(() => store.writeResources([
      manifestResource("../escape.md")
    ])).toThrow("Remote sync manifest resource 0 relative path must not contain parent traversal");

    expect(() => store.writeResources([
      manifestResource("same.md"),
      manifestResource("same.md")
    ])).toThrow("Duplicate manifest store remote sync resource: same.md");

    storage.values.set(defaultRemoteSyncManifestStoreOptions.storageKey, JSON.stringify({
      version: remoteSyncManifestSnapshotVersion,
      resources: [manifestResource("../escape.md")]
    }));
    expect(store.readResources()).toEqual([]);

    storage.values.set(defaultRemoteSyncManifestStoreOptions.storageKey, JSON.stringify({
      version: remoteSyncManifestSnapshotVersion,
      resources: [
        manifestResource("same.md"),
        manifestResource("same.md")
      ]
    }));
    expect(store.readResources()).toEqual([]);
  });

  it("clears oversized manifest snapshots and write failures without throwing", () => {
    const storage = manifestStorage();
    const store = new RemoteSyncManifestStore({
      storage,
      maxSnapshotBytes: 10
    });

    store.writeResources([
      manifestResource("large.md", { remoteId: "large", contentHash: "x".repeat(64) })
    ]);

    expect(store.readResources()).toEqual([]);

    const failingStorage = manifestStorage();
    let shouldFail = true;
    const recoveringStorage: RemoteSyncManifestStorage = {
      read: (key) => failingStorage.read(key),
      write(key, value) {
        if (shouldFail) {
          shouldFail = false;
          throw new Error("quota exhausted");
        }

        failingStorage.write(key, value);
      }
    };
    const recoveringStore = new RemoteSyncManifestStore({ storage: recoveringStorage });

    expect(() => recoveringStore.writeResources([
      manifestResource("a.md", { remoteId: "a" })
    ])).not.toThrow();
    expect(recoveringStore.readResources()).toEqual([]);
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

function manifestStorage(): RemoteSyncManifestStorage & { readonly values: Map<string, string> } {
  const values = new Map<string, string>();

  return {
    values,
    read(key) {
      return values.get(key);
    },
    write(key, value) {
      values.set(key, value);
    }
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
