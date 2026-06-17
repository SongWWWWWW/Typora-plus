import { URI } from "@typora-plus/base";
import { describe, expect, it } from "vitest";
import type { WorkspaceFileTree, WorkspaceState } from "@typora-plus/platform";
import {
  createWorkbenchFolderRemoteSyncPlanRequest,
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

  it("builds folder plan requests with paths relative to the selected local directory", () => {
    const workspace = createFolderSyncWorkspace();
    const localFolder = workspace.files!.root.children![0]!;
    const request = createWorkbenchFolderRemoteSyncPlanRequest(workspace, {
      localFolder,
      providerId: "notes.raw",
      remoteScopeId: "remote-projects"
    });

    expect(request.workspaceUri).toEqual(URI.file("C:/Notes/projects"));
    expect(request.remoteScopeId).toBe("remote-projects");
    expect(request.metadata).toMatchObject({
      source: "folder",
      providerId: "notes.raw",
      localFolderName: "projects",
      localFolderPath: "projects"
    });
    expect(request.resources.map((resource) => ({
      relativePath: resource.relativePath,
      uri: resource.uri
    }))).toEqual([
      {
        relativePath: "a.md",
        uri: URI.file("C:/Notes/projects/a.md")
      },
      {
        relativePath: "sub/b.md",
        uri: URI.file("C:/Notes/projects/sub/b.md")
      }
    ]);
  });

  it("can include folder resources relative to the selected local directory", () => {
    const workspace = createFolderSyncWorkspace();
    const localFolder = workspace.files!.root.children![0]!;
    const request = createWorkbenchFolderRemoteSyncPlanRequest(workspace, {
      includeDirectories: true,
      localFolder,
      providerId: "notes.raw",
      remoteScopeId: "remote-projects"
    });

    expect(request.resources.map((resource) => ({
      relativePath: resource.relativePath,
      kind: resource.kind
    }))).toEqual([
      {
        relativePath: "a.md",
        kind: "file"
      },
      {
        relativePath: "sub",
        kind: "directory"
      },
      {
        relativePath: "sub/b.md",
        kind: "file"
      }
    ]);
  });

  it("builds root folder binding requests without prefixing the local root name", () => {
    const workspace = createFolderSyncWorkspace();
    const localFolder = workspace.files!.root;
    const request = createWorkbenchFolderRemoteSyncPlanRequest(workspace, {
      includeDirectories: true,
      localFolder,
      providerId: "notes.raw",
      remoteScopeId: "remote-typora-plus"
    });

    expect(request.workspaceUri).toEqual(URI.file("C:/Notes"));
    expect(request.remoteScopeId).toBe("remote-typora-plus");
    expect(request.resources.map((resource) => ({
      relativePath: resource.relativePath,
      kind: resource.kind
    }))).toEqual([
      {
        relativePath: "projects",
        kind: "directory"
      },
      {
        relativePath: "projects/a.md",
        kind: "file"
      },
      {
        relativePath: "projects/sub",
        kind: "directory"
      },
      {
        relativePath: "projects/sub/b.md",
        kind: "file"
      }
    ]);
  });

  it("uses injected messages for missing workspace errors", () => {
    expect(() => createWorkbenchWorkspaceRemoteSyncPlanRequest({
      name: "Typora Plus"
    }, {
      messages: {
        noWorkspaceOpen: "Localized missing workspace"
      }
    })).toThrow("Localized missing workspace");
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

function createFolderSyncWorkspace(): WorkspaceState {
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
                uri: URI.file("C:/Notes/projects/a.md"),
                name: "a.md",
                relativePath: "projects/a.md",
                kind: "file"
              },
              {
                uri: URI.file("C:/Notes/projects/sub"),
                name: "sub",
                relativePath: "projects/sub",
                kind: "directory",
                children: [
                  {
                    uri: URI.file("C:/Notes/projects/sub/b.md"),
                    name: "b.md",
                    relativePath: "projects/sub/b.md",
                    kind: "file"
                  }
                ]
              }
            ]
          }
        ]
      },
      files: [
        {
          uri: URI.file("C:/Notes/projects/a.md"),
          name: "a.md",
          relativePath: "projects/a.md",
          kind: "file"
        },
        {
          uri: URI.file("C:/Notes/projects/sub/b.md"),
          name: "b.md",
          relativePath: "projects/sub/b.md",
          kind: "file"
        }
      ]
    }
  };
}
