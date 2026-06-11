import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import {
  createRemoteSyncContentHash,
  createRemoteSyncResourcesWithContentHashes,
  NativeRemoteSyncWorkspaceResourceService,
  type NativeRemoteSyncWorkspaceResourceBridge
} from "./remoteSyncWorkspaceResources";

describe("remote sync workspace resources", () => {
  it("reads workspace resources through the native bridge", async () => {
    const bridge = createBridge({
      readResource: vi.fn(async (request) => ({
        workspaceUri: request.workspaceUri,
        relativePath: request.relativePath,
        value: "IyBOb3RlCg==",
        encoding: "base64" as const,
        size: 7,
        mtime: 20,
        contentHash: " sha256:c2f92031c1bdc84166a86e6003926514861b838b5cda62775be8cc6fd066caac "
      }))
    });
    const service = new NativeRemoteSyncWorkspaceResourceService(bridge);

    const result = await service.readResource({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "./daily\\today.md"
    });

    expect(bridge.readResource).toHaveBeenCalledWith({
      workspaceUri: "file://C:/Notes",
      relativePath: "daily/today.md"
    });
    expect(result).toEqual({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "daily/today.md",
      value: "IyBOb3RlCg==",
      encoding: "base64",
      size: 7,
      mtime: 20,
      contentHash: "sha256:c2f92031c1bdc84166a86e6003926514861b838b5cda62775be8cc6fd066caac"
    });
  });

  it("writes and deletes workspace resources through the native bridge", async () => {
    const bridge = createBridge({
      writeResource: vi.fn(async (request) => ({
        workspaceUri: request.workspaceUri,
        relativePath: request.relativePath,
        size: 7,
        mtime: 30
      })),
      deleteResource: vi.fn(async () => true)
    });
    const service = new NativeRemoteSyncWorkspaceResourceService(bridge);

    await expect(service.writeResource({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "assets/note.png",
      value: "iVBORw0KGgo=",
      encoding: "base64",
      expectedMtime: 10,
      overwrite: false
    })).resolves.toEqual({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "assets/note.png",
      size: 7,
      mtime: 30
    });
    await expect(service.deleteResource({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "assets/note.png",
      expectedMtime: 30,
      overwrite: true
    })).resolves.toBe(true);

    expect(bridge.writeResource).toHaveBeenCalledWith({
      workspaceUri: "file://C:/Notes",
      relativePath: "assets/note.png",
      value: "iVBORw0KGgo=",
      encoding: "base64",
      expectedMtime: 10,
      overwrite: false
    });
    expect(bridge.deleteResource).toHaveBeenCalledWith({
      workspaceUri: "file://C:/Notes",
      relativePath: "assets/note.png",
      expectedMtime: 30,
      overwrite: true
    });
  });

  it.each([
    "../secret.md",
    "/absolute.md",
    "https://example.test/file.md"
  ])("rejects unsafe workspace-relative paths before native calls: %s", async (relativePath) => {
    const bridge = createBridge();
    const service = new NativeRemoteSyncWorkspaceResourceService(bridge);

    await expect(service.readResource({
      workspaceUri: URI.file("C:/Notes"),
      relativePath
    })).rejects.toThrow("Remote sync workspace resource relative path");
    expect(bridge.readResource).not.toHaveBeenCalled();
  });

  it("requires an available native bridge", async () => {
    const service = new NativeRemoteSyncWorkspaceResourceService({
      ...createBridge(),
      isAvailable: false
    });

    await expect(service.readResource({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "daily/today.md"
    })).rejects.toThrow("Native remote sync workspace resource bridge is not available");
  });

  it("creates stable SHA-256 content hashes from base64 resource content", async () => {
    await expect(createRemoteSyncContentHash("IyBOb3RlCg==", "base64")).resolves.toBe(
      "sha256:c2f92031c1bdc84166a86e6003926514861b838b5cda62775be8cc6fd066caac"
    );
  });

  it("enriches file resources with content hashes through the resource service", async () => {
    const readResource = vi.fn(async () => ({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "A.md",
      value: "IyBB",
      encoding: "base64" as const,
      size: 3,
      mtime: 40
    }));
    const progress = vi.fn();

    await expect(createRemoteSyncResourcesWithContentHashes({
      workspaceUri: URI.file("C:/Notes"),
      resources: [
        {
          uri: URI.file("C:/Notes/docs"),
          relativePath: "docs",
          kind: "directory" as const,
          name: "docs"
        },
        {
          uri: URI.file("C:/Notes/A.md"),
          relativePath: "A.md",
          kind: "file" as const,
          name: "A.md",
          size: 1,
          mtime: 10
        }
      ],
      resourceService: { readResource },
      onProgress: progress
    })).resolves.toEqual([
      {
        uri: URI.file("C:/Notes/docs"),
        relativePath: "docs",
        kind: "directory",
        name: "docs"
      },
      {
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file",
        name: "A.md",
        size: 3,
        mtime: 40,
        contentHash: "sha256:327f031b25e00b1a7cd9b0c18f05948b60f55d09f9b3d177d21083f83a3cb6df"
      }
    ]);
    expect(readResource).toHaveBeenCalledWith({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "A.md"
    });
    expect(progress).toHaveBeenLastCalledWith({
      message: "Hashed workspace resource",
      completed: 2,
      total: 2
    });
  });

  it("uses native-provided content hashes without decoding resource content", async () => {
    const readResource = vi.fn(async () => ({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "A.md",
      value: "not base64",
      encoding: "base64" as const,
      size: 3,
      contentHash: "sha256:native"
    }));

    const resources = await createRemoteSyncResourcesWithContentHashes({
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file" as const
      }],
      resourceService: { readResource }
    });

    expect(resources[0]?.contentHash).toBe("sha256:native");
  });

  it("does not reread resources that already have content hashes", async () => {
    const readResource = vi.fn();

    await expect(createRemoteSyncResourcesWithContentHashes({
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file" as const,
        contentHash: "sha256:existing"
      }],
      resourceService: { readResource }
    })).resolves.toEqual([{
      uri: URI.file("C:/Notes/A.md"),
      relativePath: "A.md",
      kind: "file",
      contentHash: "sha256:existing"
    }]);
    expect(readResource).not.toHaveBeenCalled();
  });

  it("aborts resource hashing before native reads", async () => {
    const controller = new AbortController();
    const readResource = vi.fn();
    controller.abort();

    await expect(createRemoteSyncResourcesWithContentHashes({
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/A.md"),
        relativePath: "A.md",
        kind: "file" as const
      }],
      resourceService: { readResource },
      signal: controller.signal
    })).rejects.toThrow("Remote sync workspace resource hashing was aborted");
    expect(readResource).not.toHaveBeenCalled();
  });
});

function createBridge(overrides: Partial<NativeRemoteSyncWorkspaceResourceBridge> = {}):
  NativeRemoteSyncWorkspaceResourceBridge & {
    readonly readResource: ReturnType<typeof vi.fn>;
    readonly writeResource: ReturnType<typeof vi.fn>;
    readonly deleteResource: ReturnType<typeof vi.fn>;
  } {
  return {
    isAvailable: true,
    readResource: vi.fn(overrides.readResource ?? (async () => ({
      workspaceUri: "file://C:/Notes",
      relativePath: "daily/today.md",
      value: "",
      encoding: "base64" as const,
      size: 0
    }))),
    writeResource: vi.fn(overrides.writeResource ?? (async () => ({
      workspaceUri: "file://C:/Notes",
      relativePath: "daily/today.md",
      size: 0
    }))),
    deleteResource: vi.fn(overrides.deleteResource ?? (async () => false))
  };
}
