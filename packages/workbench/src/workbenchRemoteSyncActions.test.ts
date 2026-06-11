import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { WorkspaceFileTree, WorkspaceState } from "@typora-plus/platform";
import { runWorkbenchPlanWorkspaceRemoteSyncAction } from "./workbenchRemoteSyncActions";

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
        }))
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
        createPlan: vi.fn()
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
});

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
