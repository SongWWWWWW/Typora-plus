import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceFileTree, WorkspaceState } from "@typora-plus/platform";
import {
  getWorkbenchRemoteSyncPlanExecutionBlockReason,
  getWorkbenchRemoteSyncPlanExecutionBlockReasonCode,
  resolveWorkbenchRemoteSyncPlanConflicts,
  runWorkbenchExecuteWorkspaceRemoteSyncAction,
  runWorkbenchPlanFolderRemoteSyncAction,
  runWorkbenchPlanWorkspaceRemoteSyncAction,
  workbenchRemoteSyncPlanExecutionBlockReasons,
  workbenchRemoteSyncConflictResolutions,
  type WorkbenchRemoteSyncActionMessages
} from "./workbenchRemoteSyncActions";
import type { WorkbenchRemoteSyncMarkdownAssetMessages } from "./workbenchRemoteSyncMarkdownAssets";
import { workbenchRemoteSyncRequestActions } from "./workbenchRemoteSyncRequestModel";

describe("workbench remote sync actions", () => {
  it("selects the default provider and creates a dry-run workspace plan", async () => {
    const workspace = createWorkspace();
    const services = {
      remoteSyncService: {
        getProviders: vi.fn(() => [
          { id: "z.sync", title: "Z Sync" },
          { id: "a.sync", title: "A Sync" }
        ]),
        createPlan: vi.fn(async () => ({
          operations: [{
            kind: "create" as const,
            target: "remote" as const,
            relativePath: "A.md",
            localUri: URI.file("C:/Notes/A.md")
          }],
          summary: {
            creates: 1,
            updates: 0,
            deletes: 0,
            skips: 0,
            conflicts: 0
          }
        })),
        executePlan: vi.fn()
      },
      workspaceService: {
        getWorkspace: vi.fn(() => workspace)
      }
    };

    const result = await runWorkbenchPlanWorkspaceRemoteSyncAction(services, {
      metadata: {
        surface: "command"
      }
    });

    expect(result.providerId).toBe("a.sync");
    expect(result.request).toMatchObject({
      workspaceUri: URI.file("C:/Notes"),
      direction: "push",
      dryRun: true,
      metadata: {
        surface: "command",
        action: "planWorkspace",
        source: "workspace",
        workspaceName: "Notes",
        workspaceScheme: "file"
      }
    });
    expect(services.remoteSyncService.createPlan).toHaveBeenCalledWith("a.sync", result.request);
    expect(result.plan.summary.creates).toBe(1);
  });

  it("fails before reading the workspace when no provider is available", async () => {
    const services = {
      remoteSyncService: {
        getProviders: vi.fn(() => []),
        createPlan: vi.fn(),
        executePlan: vi.fn()
      },
      workspaceService: {
        getWorkspace: vi.fn(() => createWorkspace())
      }
    };

    await expect(runWorkbenchPlanWorkspaceRemoteSyncAction(services)).rejects.toThrow(
      "No remote sync provider available"
    );
    expect(services.workspaceService.getWorkspace).not.toHaveBeenCalled();
    expect(services.remoteSyncService.createPlan).not.toHaveBeenCalled();
  });

  it("uses injected messages for no-provider plan failures", async () => {
    const services = {
      remoteSyncService: {
        getProviders: vi.fn(() => []),
        createPlan: vi.fn(),
        executePlan: vi.fn()
      },
      workspaceService: {
        getWorkspace: vi.fn(() => createWorkspace())
      }
    };

    await expect(runWorkbenchPlanWorkspaceRemoteSyncAction(services, {
      actionMessages: localizedRemoteSyncActionMessages
    })).rejects.toThrow("Localized sync provider unavailable");
  });

  it("adds content hashes to workspace plan resources when the native resource bridge is available", async () => {
    const services = {
      ...createServices(),
      remoteSyncWorkspaceResourceService: {
        isAvailable: vi.fn(() => true),
        readResource: vi.fn(async () => ({
          workspaceUri: URI.file("C:/Notes"),
          relativePath: "A.md",
          value: "",
          encoding: "base64" as const,
          size: 3,
          mtime: 30,
          contentHash: "sha256:local"
        }))
      }
    };

    const result = await runWorkbenchPlanWorkspaceRemoteSyncAction(services);

    expect(result.request.resources).toEqual([{
      uri: URI.file("C:/Notes/A.md"),
      relativePath: "A.md",
      kind: "file",
      name: "A.md",
      size: 3,
      mtime: 30,
      contentHash: "sha256:local"
    }]);
    expect(services.remoteSyncWorkspaceResourceService.readResource).toHaveBeenCalledWith({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "A.md"
    });
    expect(services.remoteSyncService.createPlan).toHaveBeenCalledWith("a.sync", result.request);
  });

  it("plans folder bindings with the selected local folder as the resource root", async () => {
    const workspace = createFolderWorkspace();
    const localFolder = workspace.files!.root.children![0]!;
    const services = {
      remoteSyncService: {
        getProviders: vi.fn(() => [
          { id: "folder.sync", title: "Folder Sync" }
        ]),
        createPlan: vi.fn(async () => ({
          operations: [],
          summary: {
            creates: 0,
            updates: 0,
            deletes: 0,
            skips: 0,
            conflicts: 0
          }
        })),
        executePlan: vi.fn()
      },
      remoteSyncWorkspaceResourceService: {
        isAvailable: vi.fn(() => true),
        readResource: vi.fn(async () => ({
          workspaceUri: URI.file("C:/Notes/projects"),
          relativePath: "Plan.md",
          value: "",
          encoding: "base64" as const,
          size: 4,
          mtime: 30,
          contentHash: "sha256:plan"
        }))
      },
      workspaceService: {
        getWorkspace: vi.fn(() => workspace)
      }
    };

    const result = await runWorkbenchPlanFolderRemoteSyncAction(services, {
      binding: {
        id: "folder-binding",
        localUri: localFolder.uri.toString(),
        localRelativePath: localFolder.relativePath,
        localName: localFolder.name,
        providerId: "folder.sync",
        remoteScopeId: "remote-folder",
        remoteName: "Remote Folder"
      },
      includeDirectories: true,
      localFolder
    });

    expect(result.providerId).toBe("folder.sync");
    expect(result.request.workspaceUri).toEqual(URI.file("C:/Notes/projects"));
    expect(result.request.remoteScopeId).toBe("remote-folder");
    expect(result.request.resources.map((resource) => ({
      relativePath: resource.relativePath,
      kind: resource.kind,
      contentHash: resource.contentHash
    }))).toEqual([
      {
        relativePath: "Plan.md",
        kind: "file",
        contentHash: "sha256:plan"
      },
      {
        relativePath: "empty",
        kind: "directory",
        contentHash: undefined
      }
    ]);
    expect(services.remoteSyncWorkspaceResourceService.readResource).toHaveBeenCalledWith({
      workspaceUri: URI.file("C:/Notes/projects"),
      relativePath: "Plan.md"
    });
    expect(services.remoteSyncService.createPlan).toHaveBeenCalledWith("folder.sync", result.request);
  });

  it("adds Markdown-linked local assets before remote sync planning", async () => {
    const services = {
      ...createServices(),
      remoteSyncWorkspaceResourceService: {
        isAvailable: vi.fn(() => true),
        readResource: vi.fn(async ({ relativePath }: { readonly relativePath: string }) => {
          if (relativePath === "A.md") {
            return {
              workspaceUri: URI.file("C:/Notes"),
              relativePath,
              value: btoa("![Chart](assets/chart.png)\n[Spec](files/spec.pdf)"),
              encoding: "base64" as const,
              size: 48,
              mtime: 30,
              contentHash: "sha256:note"
            };
          }

          return {
            workspaceUri: URI.file("C:/Notes"),
            relativePath,
            value: "",
            encoding: "base64" as const,
            size: relativePath.endsWith(".png") ? 120 : 240,
            mtime: relativePath.endsWith(".png") ? 40 : 50,
            contentHash: relativePath.endsWith(".png") ? "sha256:chart" : "sha256:spec"
          };
        })
      }
    };

    const result = await runWorkbenchPlanWorkspaceRemoteSyncAction(services);

    expect(result.request.resources.map((resource) => resource.relativePath)).toEqual([
      "A.md",
      "assets/chart.png",
      "files/spec.pdf"
    ]);
    expect(result.request.resources[1]).toMatchObject({
      uri: URI.file("C:/Notes/assets/chart.png"),
      kind: "file",
      name: "chart.png",
      size: 120,
      mtime: 40,
      contentHash: "sha256:chart"
    });
    expect(services.remoteSyncService.createPlan).toHaveBeenCalledWith("a.sync", result.request);
  });

  it("uses injected Markdown asset messages during workspace planning", async () => {
    const services = {
      ...createServices(),
      remoteSyncWorkspaceResourceService: {
        isAvailable: vi.fn(() => true),
        readResource: vi.fn(async () => ({
          workspaceUri: URI.file("C:/Notes"),
          relativePath: "A.md",
          value: "!!!!",
          encoding: "base64" as const,
          size: 4
        }))
      }
    };

    await expect(runWorkbenchPlanWorkspaceRemoteSyncAction(services, {
      markdownAssetMessages: localizedMarkdownAssetMessages
    })).rejects.toThrow("Localized valid base64 required");
    expect(services.remoteSyncService.createPlan).not.toHaveBeenCalled();
  });

  it("executes an existing workspace plan with a non-dry-run request", async () => {
    const signal = new AbortController().signal;
    const onProgress = vi.fn();
    const planResult = await runWorkbenchPlanWorkspaceRemoteSyncAction(createServices(), {
      metadata: {
        surface: "command"
      },
      remoteScopeId: "remote-folder"
    });
    const executePlan = vi.fn(async () => ({
      operations: planResult.plan.operations,
      summary: planResult.plan.summary,
      completedAt: 123
    }));
    const services = {
      remoteSyncService: {
        executePlan
      }
    };

    const execution = await runWorkbenchExecuteWorkspaceRemoteSyncAction(services, planResult, {
      metadata: {
        surface: "dialog"
      },
      onProgress,
      signal
    });

    expect(execution.providerId).toBe("a.sync");
    expect(execution.plan).toBe(planResult.plan);
    expect(execution.request).toEqual({
      workspaceUri: URI.file("C:/Notes"),
      resources: planResult.request.resources,
      direction: "push",
      remoteScopeId: "remote-folder",
      dryRun: false,
      metadata: {
        surface: "dialog",
        action: workbenchRemoteSyncRequestActions.executeWorkspace,
        source: "workspace",
        workspaceName: "Notes",
        workspaceScheme: "file"
      },
      onProgress,
      signal
    });
    expect(executePlan).toHaveBeenCalledWith("a.sync", planResult.plan, execution.request);
    expect(execution.result.completedAt).toBe(123);
  });

  it("blocks conflict and empty plans before provider execution", async () => {
    const executePlan = vi.fn();
    const services = {
      remoteSyncService: {
        executePlan
      }
    };

    await expect(runWorkbenchExecuteWorkspaceRemoteSyncAction(services, {
      providerId: "a.sync",
      request: request(),
      plan: {
        operations: [{
          kind: "conflict",
          target: "both",
          relativePath: "A.md",
          message: "changed"
        }],
        summary: {
          creates: 0,
          updates: 0,
          deletes: 0,
          skips: 0,
          conflicts: 1
        }
      }
    })).rejects.toThrow("Resolve remote sync conflicts");

    expect(getWorkbenchRemoteSyncPlanExecutionBlockReason({
      operations: [],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    })).toBe("No remote sync changes to execute");
    expect(getWorkbenchRemoteSyncPlanExecutionBlockReasonCode({
      operations: [],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    })).toBe(workbenchRemoteSyncPlanExecutionBlockReasons.empty);
    expect(executePlan).not.toHaveBeenCalled();
  });

  it("uses injected messages for execution block reasons", async () => {
    const executePlan = vi.fn();
    const services = {
      remoteSyncService: {
        executePlan
      }
    };

    await expect(runWorkbenchExecuteWorkspaceRemoteSyncAction(services, {
      providerId: "a.sync",
      request: request(),
      plan: {
        operations: [{
          kind: "conflict",
          target: "both",
          relativePath: "A.md"
        }],
        summary: {
          creates: 0,
          updates: 0,
          deletes: 0,
          skips: 0,
          conflicts: 1
        }
      }
    }, {
      actionMessages: localizedRemoteSyncActionMessages
    })).rejects.toThrow("Localized resolve conflicts");

    expect(getWorkbenchRemoteSyncPlanExecutionBlockReason({
      operations: [],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    }, localizedRemoteSyncActionMessages)).toBe("Localized no changes");
    expect(executePlan).not.toHaveBeenCalled();
  });

  it("executes skip-only plans so providers can refresh baselines", async () => {
    const plan = {
      operations: [{
        kind: "skip" as const,
        target: "none" as const,
        relativePath: "A.md"
      }],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 0
      }
    };
    const executePlan = vi.fn(async () => ({
      operations: plan.operations,
      summary: plan.summary,
      completedAt: 123
    }));
    const services = {
      remoteSyncService: {
        executePlan
      }
    };

    const execution = await runWorkbenchExecuteWorkspaceRemoteSyncAction(services, {
      providerId: "a.sync",
      request: request(),
      plan
    });

    expect(getWorkbenchRemoteSyncPlanExecutionBlockReason(plan)).toBeUndefined();
    expect(execution.result.summary.skips).toBe(1);
    expect(executePlan).toHaveBeenCalledWith("a.sync", plan, execution.request);
  });

  it("resolves executable conflicts by using local resources", () => {
    const plan = {
      operations: [
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "Changed.md",
          localUri: URI.file("C:/Notes/Changed.md"),
          remoteId: "remote-changed",
          message: "Resource changed on both sides"
        },
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "LocalOnly.md",
          localUri: URI.file("C:/Notes/LocalOnly.md"),
          remoteId: "previous-remote",
          message: "Remote resource is missing and local resource changed"
        },
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "RemoteOnly.md",
          remoteId: "remote-only",
          message: "Local resource is missing and remote resource changed"
        },
        {
          kind: "skip" as const,
          target: "none" as const,
          relativePath: "Same.md"
        }
      ],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 3
      }
    };

    const resolved = resolveWorkbenchRemoteSyncPlanConflicts(
      plan,
      workbenchRemoteSyncConflictResolutions.useLocal
    );

    expect(resolved).toEqual({
      operations: [
        {
          kind: "update",
          target: "remote",
          relativePath: "Changed.md",
          localUri: URI.file("C:/Notes/Changed.md"),
          remoteId: "remote-changed",
          message: "Resolved by using local resource"
        },
        {
          kind: "create",
          target: "remote",
          relativePath: "LocalOnly.md",
          localUri: URI.file("C:/Notes/LocalOnly.md"),
          message: "Resolved by using local resource"
        },
        {
          kind: "delete",
          target: "remote",
          relativePath: "RemoteOnly.md",
          remoteId: "remote-only",
          message: "Resolved by using local resource"
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "Same.md"
        }
      ],
      summary: {
        creates: 1,
        updates: 1,
        deletes: 1,
        skips: 1,
        conflicts: 0
      }
    });
  });

  it("uses injected messages when resolving executable conflicts", () => {
    const plan = {
      operations: [{
        kind: "conflict" as const,
        target: "both" as const,
        relativePath: "Changed.md",
        localUri: URI.file("C:/Notes/Changed.md"),
        remoteId: "remote-changed",
        message: "Resource changed on both sides"
      }],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 1
      }
    };

    const resolved = resolveWorkbenchRemoteSyncPlanConflicts(
      plan,
      workbenchRemoteSyncConflictResolutions.useLocal,
      localizedRemoteSyncActionMessages
    );

    expect(resolved.operations[0]).toMatchObject({
      kind: "update",
      target: "remote",
      message: "Localized use local"
    });
  });

  it("resolves executable conflicts by using remote resources", () => {
    const plan = {
      operations: [
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "Changed.md",
          localUri: URI.file("C:/Notes/Changed.md"),
          remoteId: "remote-changed",
          message: "Resource changed on both sides"
        },
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "LocalOnly.md",
          localUri: URI.file("C:/Notes/LocalOnly.md"),
          remoteId: "previous-remote",
          message: "Remote resource is missing and local resource changed"
        },
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "RemoteOnly.md",
          message: "Local resource is missing and remote resource changed"
        },
        {
          kind: "skip" as const,
          target: "none" as const,
          relativePath: "Same.md"
        }
      ],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 3
      }
    };

    const resolved = resolveWorkbenchRemoteSyncPlanConflicts(
      plan,
      workbenchRemoteSyncConflictResolutions.useRemote
    );

    expect(resolved).toEqual({
      operations: [
        {
          kind: "update",
          target: "local",
          relativePath: "Changed.md",
          localUri: URI.file("C:/Notes/Changed.md"),
          remoteId: "remote-changed",
          message: "Resolved by using remote resource"
        },
        {
          kind: "delete",
          target: "local",
          relativePath: "LocalOnly.md",
          localUri: URI.file("C:/Notes/LocalOnly.md"),
          message: "Resolved by using remote resource"
        },
        {
          kind: "create",
          target: "local",
          relativePath: "RemoteOnly.md",
          message: "Resolved by using remote resource"
        },
        {
          kind: "skip",
          target: "none",
          relativePath: "Same.md"
        }
      ],
      summary: {
        creates: 1,
        updates: 1,
        deletes: 1,
        skips: 1,
        conflicts: 0
      }
    });
  });

  it("keeps ambiguous conflicts unresolved so execution remains blocked", () => {
    const plan = {
      operations: [
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "Unknown.md",
          localUri: URI.file("C:/Notes/Unknown.md"),
          remoteId: "previous-remote",
          message: "Resource state cannot be compared"
        }
      ],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 1
      }
    };

    const resolved = resolveWorkbenchRemoteSyncPlanConflicts(
      plan,
      workbenchRemoteSyncConflictResolutions.useLocal
    );

    expect(resolved).toEqual(plan);
    expect(getWorkbenchRemoteSyncPlanExecutionBlockReason(resolved))
      .toBe("Resolve remote sync conflicts before execution");
  });

  it("uses explicit conflict presence before legacy provider messages", () => {
    const plan = {
      operations: [
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "UnknownButPresent.md",
          localPresence: "present" as const,
          localUri: URI.file("C:/Notes/UnknownButPresent.md"),
          remotePresence: "present" as const,
          remoteId: "remote-present",
          message: "Resource state cannot be compared"
        },
        {
          kind: "conflict" as const,
          target: "both" as const,
          relativePath: "LocalOnlyWithHistory.md",
          localPresence: "present" as const,
          localUri: URI.file("C:/Notes/LocalOnlyWithHistory.md"),
          remotePresence: "missing" as const,
          remoteId: "historical-remote",
          message: "Resource state cannot be compared"
        }
      ],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 2
      }
    };

    const resolved = resolveWorkbenchRemoteSyncPlanConflicts(
      plan,
      workbenchRemoteSyncConflictResolutions.useLocal
    );

    expect(resolved).toEqual({
      operations: [
        {
          kind: "update",
          target: "remote",
          relativePath: "UnknownButPresent.md",
          localUri: URI.file("C:/Notes/UnknownButPresent.md"),
          remoteId: "remote-present",
          message: "Resolved by using local resource"
        },
        {
          kind: "create",
          target: "remote",
          relativePath: "LocalOnlyWithHistory.md",
          localUri: URI.file("C:/Notes/LocalOnlyWithHistory.md"),
          message: "Resolved by using local resource"
        }
      ],
      summary: {
        creates: 1,
        updates: 1,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });
  });
});

function createServices() {
  return {
    remoteSyncService: {
      getProviders: vi.fn(() => [
        { id: "z.sync", title: "Z Sync" },
        { id: "a.sync", title: "A Sync" }
      ]),
      createPlan: vi.fn(async () => ({
        operations: [{
          kind: "create" as const,
          target: "remote" as const,
          relativePath: "A.md",
          localUri: URI.file("C:/Notes/A.md")
        }],
        summary: {
          creates: 1,
          updates: 0,
          deletes: 0,
          skips: 0,
          conflicts: 0
        }
      })),
      executePlan: vi.fn()
    },
    workspaceService: {
      getWorkspace: vi.fn(() => createWorkspace())
    }
  };
}

function request() {
  return {
    workspaceUri: URI.file("C:/Notes"),
    resources: [],
    direction: "push" as const,
    dryRun: true
  };
}

function createWorkspace(): WorkspaceState {
  return {
    name: "Notes",
    rootUri: URI.file("C:/Notes"),
    files: createWorkspaceFileTree()
  };
}

function createWorkspaceFileTree(): WorkspaceFileTree {
  return {
    root: {
      uri: URI.file("C:/Notes"),
      name: "Notes",
      relativePath: ".",
      kind: "directory",
      children: [{
        uri: URI.file("C:/Notes/A.md"),
        name: "A.md",
        relativePath: "A.md",
        kind: "file"
      }]
    },
    files: [{
      uri: URI.file("C:/Notes/A.md"),
      name: "A.md",
      relativePath: "A.md",
      kind: "file"
    }]
  };
}

function createFolderWorkspace(): WorkspaceState {
  return {
    name: "Notes",
    rootUri: URI.file("C:/Notes"),
    files: {
      root: {
        uri: URI.file("C:/Notes"),
        name: "Notes",
        relativePath: ".",
        kind: "directory",
        children: [
          {
            uri: URI.file("C:/Notes/projects"),
            name: "projects",
            relativePath: "projects",
            kind: "directory",
            children: [
              {
                uri: URI.file("C:/Notes/projects/Plan.md"),
                name: "Plan.md",
                relativePath: "projects/Plan.md",
                kind: "file"
              },
              {
                uri: URI.file("C:/Notes/projects/empty"),
                name: "empty",
                relativePath: "projects/empty",
                kind: "directory",
                children: []
              }
            ]
          }
        ]
      },
      files: [
        {
          uri: URI.file("C:/Notes/projects/Plan.md"),
          name: "Plan.md",
          relativePath: "projects/Plan.md",
          kind: "file"
        }
      ]
    }
  };
}

const localizedRemoteSyncActionMessages: WorkbenchRemoteSyncActionMessages = {
  conflictResolutionMessages: {
    [workbenchRemoteSyncConflictResolutions.useLocal]: "Localized use local",
    [workbenchRemoteSyncConflictResolutions.useRemote]: "Localized use remote"
  },
  executionBlockReasons: {
    [workbenchRemoteSyncPlanExecutionBlockReasons.conflicts]: "Localized resolve conflicts",
    [workbenchRemoteSyncPlanExecutionBlockReasons.empty]: "Localized no changes"
  },
  noProviderAvailable: "Localized sync provider unavailable"
};

const localizedMarkdownAssetMessages: WorkbenchRemoteSyncMarkdownAssetMessages = {
  aborted: "Localized asset discovery aborted",
  contentEncodingInvalid: "Localized valid base64 required",
  contentEncodingRequired: "Localized base64 required"
};
