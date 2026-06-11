import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { WorkspaceFileTree, WorkspaceState } from "@typora-plus/platform";
import {
  createWorkbenchWorkspaceRemoteSyncPlanRequest,
  workbenchRemoteSyncRequestActions
} from "./workbenchRemoteSyncRequestModel";

describe("workbench remote sync request model", () => {
  it("builds provider-neutral dry-run workspace plan requests", () => {
    const signal = new AbortController().signal;
    const request = createWorkbenchWorkspaceRemoteSyncPlanRequest(createWorkspace(), {
      metadata: {
        action: "ignored",
        source: "ignored",
        surface: "command"
      },
      signal
    });

    expect(request).toEqual({
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file",
        name: "A.md",
        size: 10,
        mtime: 20
      }],
      direction: "push",
      dryRun: true,
      metadata: {
        surface: "command",
        action: workbenchRemoteSyncRequestActions.planWorkspace,
        source: "workspace",
        workspaceName: "Notes",
        workspaceScheme: "file"
      },
      signal
    });
  });

  it("supports direction, remote scope, directory resources, and explicit dry-run values", () => {
    const request = createWorkbenchWorkspaceRemoteSyncPlanRequest(createWorkspace(), {
      direction: "pull",
      dryRun: false,
      includeDirectories: true,
      remoteScopeId: "remote-folder"
    });

    expect(request.direction).toBe("pull");
    expect(request.dryRun).toBe(false);
    expect(request.remoteScopeId).toBe("remote-folder");
    expect(request.resources.map((resource) => resource.relativePath)).toEqual(["docs", "A.md"]);
  });

  it("requires an open workspace", () => {
    expect(() => createWorkbenchWorkspaceRemoteSyncPlanRequest({
      name: "Typora Plus"
    })).toThrow("No workspace is open");
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
      children: [
        {
          uri: URI.file("C:/Notes/docs"),
          name: "docs",
          relativePath: "docs",
          kind: "directory"
        },
        {
          uri: URI.file("C:/Notes/A.md"),
          name: "A.md",
          relativePath: "A.md",
          kind: "file",
          size: 10,
          mtime: 20
        }
      ]
    },
    files: [{
      uri: URI.file("C:/Notes/A.md"),
      name: "A.md",
      relativePath: "A.md",
      kind: "file",
      size: 10,
      mtime: 20
    }]
  };
}
