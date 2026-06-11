import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { FileTreeEntry, WorkspaceFileTree } from "./files";
import {
  createRemoteSyncResourcesFromWorkspace,
  RemoteSyncService,
  type RemoteSyncPlan,
  type RemoteSyncPlanRequest,
  type RemoteSyncProvider
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
    await expect(service.executePlan("bad.result", plan(), request())).rejects
      .toThrow("Remote sync summary creates must be a non-negative integer");
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

function plan(): RemoteSyncPlan {
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
  };
}

function result() {
  const nextPlan = plan();

  return {
    operations: nextPlan.operations,
    summary: nextPlan.summary
  };
}
