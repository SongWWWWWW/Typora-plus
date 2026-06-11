import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceFileTree, WorkspaceState } from "@typora-plus/platform";
import {
  getWorkbenchRemoteSyncPlanExecutionBlockReason,
  runWorkbenchExecuteWorkspaceRemoteSyncAction,
  runWorkbenchPlanWorkspaceRemoteSyncAction
} from "./workbenchRemoteSyncActions";
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

  it("blocks conflict and no-op plans before provider execution", async () => {
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
      operations: [{
        kind: "skip",
        target: "none",
        relativePath: "A.md"
      }],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 1,
        conflicts: 0
      }
    })).toBe("No remote sync changes to execute");
    expect(executePlan).not.toHaveBeenCalled();
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
