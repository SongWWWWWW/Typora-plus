import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { RemoteSyncOperation, RemoteSyncResource } from "./remoteSync";
import { readRemoteSyncRawMirrorUploadFileContents } from "./remoteSyncRawMirrorWorkspaceResources";

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

function resource(relativePath: string, kind: RemoteSyncResource["kind"] = "file"): RemoteSyncResource {
  return {
    uri: URI.file(`C:/Notes/${relativePath}`),
    relativePath,
    kind,
    name: relativePath.split("/").at(-1) ?? relativePath
  };
}
