import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { RemoteSyncOperation, RemoteSyncResource } from "./remoteSync";
import {
  applyRemoteSyncRawMirrorLocalResourceChanges,
  createRemoteSyncRawMirrorExecutedLocalResources,
  readRemoteSyncRawMirrorUploadFileContents
} from "./remoteSyncRawMirrorWorkspaceResources";

describe("remote sync raw mirror workspace resources", () => {
  it("reads local file content for remote create and update operations", async () => {
    const progress = vi.fn();
    const readResource = vi.fn(async ({ relativePath }: { readonly relativePath: string }) => ({
      workspaceUri: URI.file("C:/Notes"),
      relativePath,
      value: relativePath === "A.md" ? "IyBB" : "IyBC",
      encoding: "base64" as const,
      size: relativePath === "A.md" ? 3 : 4,
      mtime: relativePath === "A.md" ? 10 : 20,
      contentHash: relativePath === "A.md" ? "sha256:a" : "sha256:b"
    }));

    const contents = await readRemoteSyncRawMirrorUploadFileContents({
      workspaceUri: URI.file("C:/Notes"),
      operations: [
        operation("create", "remote", "A.md"),
        operation("update", "remote", "B.md"),
        operation("delete", "remote", "Deleted.md"),
        operation("create", "local", "Remote.md")
      ],
      localResources: [
        resource("A.md"),
        resource("B.md"),
        resource("Deleted.md")
      ],
      resourceService: { readResource },
      onProgress: progress
    });

    expect(readResource).toHaveBeenCalledTimes(2);
    expect(readResource).toHaveBeenNthCalledWith(1, {
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "A.md"
    });
    expect(readResource).toHaveBeenNthCalledWith(2, {
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "B.md"
    });
    expect(contents.map((content) => ({
      operation: content.operation.relativePath,
      resource: content.resource,
      value: content.content.value
    }))).toEqual([
      {
        operation: "A.md",
        resource: {
          ...resource("A.md"),
          size: 3,
          mtime: 10,
          contentHash: "sha256:a"
        },
        value: "IyBB"
      },
      {
        operation: "B.md",
        resource: {
          ...resource("B.md"),
          size: 4,
          mtime: 20,
          contentHash: "sha256:b"
        },
        value: "IyBC"
      }
    ]);
    expect(progress).toHaveBeenLastCalledWith({
      message: "Read local remote sync upload resource",
      completed: 2,
      total: 2,
      operation: operation("update", "remote", "B.md")
    });
  });

  it("does not read directory upload operations", async () => {
    const readResource = vi.fn();

    await expect(readRemoteSyncRawMirrorUploadFileContents({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "remote", "docs")],
      localResources: [resource("docs", "directory")],
      resourceService: { readResource }
    })).resolves.toEqual([]);
    expect(readResource).not.toHaveBeenCalled();
  });

  it("rejects missing and duplicate upload resources before native reads", async () => {
    const readResource = vi.fn();

    await expect(readRemoteSyncRawMirrorUploadFileContents({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "remote", "Missing.md")],
      localResources: [],
      resourceService: { readResource }
    })).rejects.toThrow("Remote sync raw mirror upload Missing.md requires a local resource");

    await expect(readRemoteSyncRawMirrorUploadFileContents({
      workspaceUri: URI.file("C:/Notes"),
      operations: [
        operation("create", "remote", "A.md"),
        operation("update", "remote", "A.md")
      ],
      localResources: [resource("A.md")],
      resourceService: { readResource }
    })).rejects.toThrow("Remote sync raw mirror upload file is duplicated: A.md");
    expect(readResource).not.toHaveBeenCalled();
  });

  it("rejects aborted and inconsistent upload reads", async () => {
    const controller = new AbortController();
    const readResource = vi.fn(async () => ({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "Other.md",
      value: "IyBB",
      encoding: "base64" as const,
      size: 3
    }));

    controller.abort();
    await expect(readRemoteSyncRawMirrorUploadFileContents({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "remote", "A.md")],
      localResources: [resource("A.md")],
      resourceService: { readResource },
      signal: controller.signal
    })).rejects.toThrow("Remote sync raw mirror upload resource read was aborted");
    expect(readResource).not.toHaveBeenCalled();

    await expect(readRemoteSyncRawMirrorUploadFileContents({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "remote", "A.md")],
      localResources: [resource("A.md")],
      resourceService: { readResource }
    })).rejects.toThrow("Remote sync raw mirror upload read returned a different resource path");
  });

  it("writes downloaded local files and deletes local resources through the resource service", async () => {
    const progress = vi.fn();
    const writeResource = vi.fn(async ({ relativePath }: { readonly relativePath: string }) => ({
      workspaceUri: URI.file("C:/Notes"),
      relativePath,
      size: relativePath === "A.md" ? 3 : 4,
      mtime: relativePath === "A.md" ? 10 : 20
    }));
    const deleteResource = vi.fn(async () => true);
    const operations = [
      operation("create", "local", "A.md"),
      operation("update", "local", "B.md"),
      operation("delete", "local", "Old.md"),
      operation("create", "remote", "Upload.md")
    ];

    const results = await applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations,
      localResources: [
        resource("B.md", "file", 8),
        resource("Old.md", "file", 9)
      ],
      fileContents: [
        fileContent("A.md", "IyBB", "sha256:a"),
        fileContent("B.md", "IyBC", "sha256:b")
      ],
      resourceService: { writeResource, deleteResource },
      onProgress: progress
    });

    expect(writeResource).toHaveBeenCalledTimes(2);
    expect(writeResource).toHaveBeenNthCalledWith(1, {
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "A.md",
      value: "IyBB",
      encoding: "base64",
      overwrite: false
    });
    expect(writeResource).toHaveBeenNthCalledWith(2, {
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "B.md",
      value: "IyBC",
      encoding: "base64",
      expectedMtime: 8,
      overwrite: true
    });
    expect(deleteResource).toHaveBeenCalledWith({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "Old.md",
      expectedMtime: 9,
      overwrite: true
    });
    expect(results).toEqual([
      {
        operation: operation("create", "local", "A.md"),
        resource: {
          uri: URI.file("C:/Notes/A.md"),
          relativePath: "A.md",
          kind: "file",
          name: "A.md",
          size: 3,
          mtime: 10,
          contentHash: "sha256:a"
        }
      },
      {
        operation: operation("update", "local", "B.md"),
        resource: {
          uri: URI.file("C:/Notes/B.md"),
          relativePath: "B.md",
          kind: "file",
          name: "B.md",
          size: 4,
          mtime: 20,
          contentHash: "sha256:b"
        }
      },
      {
        operation: operation("delete", "local", "Old.md"),
        deleted: true
      }
    ]);
    expect(progress).toHaveBeenLastCalledWith({
      message: "Applied local remote sync resource change",
      completed: 3,
      total: 3,
      operation: operation("delete", "local", "Old.md")
    });
  });

  it("rejects invalid local apply inputs before workspace writes", async () => {
    const writeResource = vi.fn();
    const deleteResource = vi.fn();

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "local", "Missing.md")],
      localResources: [],
      fileContents: [],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local write Missing.md requires file content");

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("update", "local", "Missing.md")],
      localResources: [],
      fileContents: [fileContent("Missing.md", "IyBB")],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local update Missing.md requires a local resource");

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("delete", "local", "Missing.md")],
      localResources: [],
      fileContents: [],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local delete Missing.md requires a local resource");

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [
        operation("create", "local", "A.md"),
        operation("update", "local", "A.md")
      ],
      localResources: [resource("A.md")],
      fileContents: [fileContent("A.md", "IyBB")],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local operation is duplicated: A.md");
    expect(writeResource).not.toHaveBeenCalled();
    expect(deleteResource).not.toHaveBeenCalled();
  });

  it("rejects local deletes that are not applied", async () => {
    const writeResource = vi.fn();
    const deleteResource = vi.fn(async () => false);

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("delete", "local", "Old.md")],
      localResources: [resource("Old.md", "file", 9)],
      fileContents: [],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local delete Old.md was not applied");
    expect(writeResource).not.toHaveBeenCalled();
  });

  it("rejects duplicate, invalid, and aborted local file content", async () => {
    const controller = new AbortController();
    const writeResource = vi.fn();
    const deleteResource = vi.fn();

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "local", "A.md")],
      localResources: [],
      fileContents: [
        fileContent("A.md", "IyBB"),
        fileContent("A.md", "IyBC")
      ],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local file content is duplicated: A.md");

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "local", "A.md")],
      localResources: [],
      fileContents: [{
        relativePath: "../A.md",
        value: "IyBB",
        encoding: "base64"
      }],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local file content path is invalid");

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "local", "A.md")],
      localResources: [],
      fileContents: [{
        relativePath: "A.md",
        value: "IyBB",
        encoding: "utf8" as "base64"
      }],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local file content must be base64");

    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "local", "A.md")],
      localResources: [],
      fileContents: [{
        relativePath: "A.md",
        value: "not base64",
        encoding: "base64"
      }],
      resourceService: { writeResource, deleteResource }
    })).rejects.toThrow("Remote sync raw mirror local file content value must be base64");

    controller.abort();
    await expect(applyRemoteSyncRawMirrorLocalResourceChanges({
      workspaceUri: URI.file("C:/Notes"),
      operations: [operation("create", "local", "A.md")],
      localResources: [],
      fileContents: [fileContent("A.md", "IyBB")],
      resourceService: { writeResource, deleteResource },
      signal: controller.signal
    })).rejects.toThrow("Remote sync raw mirror local apply was aborted");
    expect(writeResource).not.toHaveBeenCalled();
    expect(deleteResource).not.toHaveBeenCalled();
  });

  it("creates post-execution local snapshots from upload and local apply results", () => {
    const updatedUpload = {
      operation: operation("update", "remote", "Uploaded.md"),
      resource: {
        ...resource("Uploaded.md", "file", 2),
        size: 20,
        contentHash: "sha256:upload"
      },
      content: {
        workspaceUri: URI.file("C:/Notes"),
        relativePath: "Uploaded.md",
        value: "IyBVcGxvYWQ=",
        encoding: "base64" as const,
        size: 20,
        mtime: 2,
        contentHash: "sha256:upload"
      }
    };
    const writtenLocal = {
      operation: operation("update", "local", "Downloaded.md"),
      resource: {
        ...resource("Downloaded.md", "file", 5),
        size: 30,
        contentHash: "sha256:download"
      }
    };
    const deletedLocal = {
      operation: operation("delete", "local", "Deleted.md"),
      deleted: true
    };

    expect(createRemoteSyncRawMirrorExecutedLocalResources({
      localResources: [
        resource("Deleted.md"),
        resource("Downloaded.md"),
        resource("Uploaded.md")
      ],
      uploadFileContents: [updatedUpload],
      localApplyResults: [writtenLocal, deletedLocal]
    })).toEqual([
      {
        ...resource("Downloaded.md", "file", 5),
        size: 30,
        contentHash: "sha256:download"
      },
      {
        ...resource("Uploaded.md", "file", 2),
        size: 20,
        contentHash: "sha256:upload"
      }
    ]);
  });
});

function operation(
  kind: RemoteSyncOperation["kind"],
  target: RemoteSyncOperation["target"],
  relativePath: string
): RemoteSyncOperation {
  return {
    kind,
    target,
    relativePath,
    ...(target === "remote" ? { localUri: URI.file(`C:/Notes/${relativePath}`) } : {})
  };
}

function resource(
  relativePath: string,
  kind: RemoteSyncResource["kind"] = "file",
  mtime?: number
): RemoteSyncResource {
  return {
    uri: URI.file(`C:/Notes/${relativePath}`),
    relativePath,
    kind,
    name: relativePath.split("/").at(-1) ?? relativePath,
    ...(mtime !== undefined ? { mtime } : {})
  };
}

function fileContent(relativePath: string, value: string, contentHash?: string) {
  return {
    relativePath,
    value,
    encoding: "base64" as const,
    ...(contentHash !== undefined ? { contentHash } : {})
  };
}
