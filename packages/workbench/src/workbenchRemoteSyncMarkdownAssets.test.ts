import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { RemoteSyncResource } from "@typora-plus/platform";
import { createWorkbenchRemoteSyncResourcesWithMarkdownAssets } from "./workbenchRemoteSyncMarkdownAssets";

describe("workbench remote sync Markdown assets", () => {
  it("adds existing Markdown-linked local resources with native metadata", async () => {
    const readResource = vi.fn(async ({ relativePath }: { readonly relativePath: string }) => {
      switch (relativePath) {
        case "notes/A.md":
          return resourceContent(relativePath, [
            "![Chart](assets/chart.png)",
            "",
            "![Reference][diagram]",
            "",
            "[diagram]: ../shared/diagram.svg",
            "",
            "[Spec](../files/spec.pdf?download=1)",
            "![Remote](https://example.test/remote.png)",
            "![Missing](missing.png)"
          ].join("\n"), 100, 10, "sha256:note");
        case "notes/assets/chart.png":
          return resourceContent(relativePath, "", 200, 20, "sha256:chart");
        case "shared/diagram.svg":
          return resourceContent(relativePath, "", 300, 30, "sha256:diagram");
        case "files/spec.pdf":
          return resourceContent(relativePath, "", 400, 40, "sha256:spec");
        default:
          throw new Error("missing resource");
      }
    });

    const resources = await createWorkbenchRemoteSyncResourcesWithMarkdownAssets({
      workspaceUri: URI.file("C:/Notes"),
      resources: [{
        uri: URI.file("C:/Notes/notes/A.md"),
        relativePath: "notes/A.md",
        kind: "file",
        name: "A.md",
        size: 1,
        mtime: 1
      }],
      resourceService: { readResource }
    });

    expect(resources).toEqual([
      {
        uri: URI.file("C:/Notes/notes/A.md"),
        relativePath: "notes/A.md",
        kind: "file",
        name: "A.md",
        size: 100,
        mtime: 10,
        contentHash: "sha256:note"
      },
      {
        uri: URI.file("C:/Notes/notes/assets/chart.png"),
        relativePath: "notes/assets/chart.png",
        kind: "file",
        name: "chart.png",
        size: 200,
        mtime: 20,
        contentHash: "sha256:chart"
      },
      {
        uri: URI.file("C:/Notes/shared/diagram.svg"),
        relativePath: "shared/diagram.svg",
        kind: "file",
        name: "diagram.svg",
        size: 300,
        mtime: 30,
        contentHash: "sha256:diagram"
      },
      {
        uri: URI.file("C:/Notes/files/spec.pdf"),
        relativePath: "files/spec.pdf",
        kind: "file",
        name: "spec.pdf",
        size: 400,
        mtime: 40,
        contentHash: "sha256:spec"
      }
    ]);
    expect(readResource).toHaveBeenCalledWith({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "notes/A.md"
    });
    expect(readResource).toHaveBeenCalledWith({
      workspaceUri: URI.file("C:/Notes"),
      relativePath: "notes/missing.png"
    });
  });

  it("deduplicates resources already present in the workspace plan", async () => {
    const readResource = vi.fn(async ({ relativePath }: { readonly relativePath: string }) =>
      relativePath === "A.md"
        ? resourceContent(relativePath, "![Chart](assets/chart.png)", 10, 1, "sha256:note")
        : resourceContent(relativePath, "", 20, 2, "sha256:chart")
    );

    const resources = await createWorkbenchRemoteSyncResourcesWithMarkdownAssets({
      workspaceUri: URI.file("C:/Notes"),
      resources: [
        syncResource("A.md"),
        syncResource("assets/chart.png")
      ],
      resourceService: { readResource }
    });

    expect(resources.map((resource) => resource.relativePath)).toEqual(["A.md", "assets/chart.png"]);
    expect(readResource).toHaveBeenCalledTimes(1);
  });

  it("aborts before reading resources", async () => {
    const controller = new AbortController();
    const readResource = vi.fn();
    controller.abort();

    await expect(createWorkbenchRemoteSyncResourcesWithMarkdownAssets({
      workspaceUri: URI.file("C:/Notes"),
      resources: [syncResource("A.md")],
      resourceService: { readResource },
      signal: controller.signal
    })).rejects.toThrow("Remote sync Markdown asset discovery was aborted");
    expect(readResource).not.toHaveBeenCalled();
  });
});

function syncResource(relativePath: string): RemoteSyncResource {
  return {
    uri: URI.file(`C:/Notes/${relativePath}`),
    relativePath,
    kind: "file",
    name: relativePath.split("/").at(-1) ?? relativePath
  };
}

function resourceContent(
  relativePath: string,
  value: string,
  size: number,
  mtime: number,
  contentHash: string
) {
  return {
    workspaceUri: URI.file("C:/Notes"),
    relativePath,
    value: btoa(value),
    encoding: "base64" as const,
    size,
    mtime,
    contentHash
  };
}
