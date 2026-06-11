import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import {
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
        mtime: 20
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
      mtime: 20
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
