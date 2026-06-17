import { URI } from "@typora-plus/base";
import type { WorkspaceIndexStatus, WorkspaceSearchResult } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchWorkspaceAiContext,
  createWorkbenchWorkspaceAiContextQueries
} from "./workbenchAiWorkspaceContext";

describe("workbench AI workspace context", () => {
  it("creates bounded workspace-search context from indexed query results", () => {
    const query = vi.fn((value: string, options?: { readonly maxPreviewLength?: number; readonly maxResults?: number }) => {
      if (value === "current plan") {
        return [
          searchResult("C:/Notes/current.md", "current.md", 1, "Current note match"),
          searchResult("C:/Notes/related.md", "related.md", 7, "Related implementation detail"),
          searchResult("C:/Notes/related.md", "related.md", 7, "Duplicate line")
        ];
      }

      if (value === "sync design") {
        return [
          searchResult("C:/Notes/sync.md", "sync.md", 3, "Sync design note"),
          searchResult("C:/Notes/overflow.md", "overflow.md", 4, "Overflow")
        ];
      }

      return [];
    });

    expect(createWorkbenchWorkspaceAiContext({
      indexService: {
        getStatus: () => status("ready"),
        query
      }
    }, {
      name: "Current Plan.md",
      uri: URI.file("C:/Notes/current.md"),
      value: "# Sync Design\n\n#todo"
    }, {
      maxPreviewLength: 120,
      maxResults: 2
    })).toEqual([
      {
        kind: "workspace-search",
        title: "related.md:7",
        uri: URI.file("C:/Notes/related.md"),
        value: [
          "Path: related.md",
          "Line: 7",
          "Related implementation detail"
        ].join("\n")
      },
      {
        kind: "workspace-search",
        title: "sync.md:3",
        uri: URI.file("C:/Notes/sync.md"),
        value: [
          "Path: sync.md",
          "Line: 3",
          "Sync design note"
        ].join("\n")
      }
    ]);

    expect(query).toHaveBeenCalledWith("current plan", {
      maxPreviewLength: 120,
      maxResults: 3
    });
    expect(query).toHaveBeenCalledWith("sync design", {
      maxPreviewLength: 120,
      maxResults: 3
    });
  });

  it("returns no workspace context when disabled or the index is not ready", () => {
    const query = vi.fn(() => []);
    const services = {
      indexService: {
        getStatus: () => status("indexing"),
        query
      }
    };
    const model = {
      name: "Current.md",
      uri: URI.file("C:/Notes/current.md"),
      value: "# Current"
    };

    expect(createWorkbenchWorkspaceAiContext(services, model, {
      maxPreviewLength: 120,
      maxResults: 3
    })).toEqual([]);
    expect(createWorkbenchWorkspaceAiContext({
      indexService: {
        getStatus: () => status("ready"),
        query
      }
    }, model, {
      maxPreviewLength: 120,
      maxResults: 0
    })).toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it("uses injected labels when formatting workspace-search context details", () => {
    expect(createWorkbenchWorkspaceAiContext({
      indexService: {
        getStatus: () => status("ready"),
        query: () => [searchResult("C:/Notes/related.md", "related.md", 7, "Related implementation detail")]
      }
    }, {
      name: "Current Plan.md",
      uri: URI.file("C:/Notes/current.md"),
      value: "# Current Plan"
    }, {
      maxPreviewLength: 120,
      maxResults: 1,
      messages: {
        detailList: (details) => details.join("\n"),
        line: (line) => `行：${line}`,
        path: (relativePath) => `路径：${relativePath}`
      }
    })).toEqual([{
      kind: "workspace-search",
      title: "related.md:7",
      uri: URI.file("C:/Notes/related.md"),
      value: [
        "路径：related.md",
        "行：7",
        "Related implementation detail"
      ].join("\n")
    }]);
  });

  it("derives stable search queries from note name, headings, and tags", () => {
    expect(createWorkbenchWorkspaceAiContextQueries({
      name: "Launch Plan.md",
      value: [
        "# Launch Plan",
        "## Sync API ###",
        "Discuss #Feishu/drive and #AI."
      ].join("\n")
    }, 4)).toEqual([
      "launch plan",
      "sync api",
      "feishu drive",
      "ai"
    ]);
  });
});

function searchResult(
  path: string,
  relativePath: string,
  line: number,
  preview: string
): WorkspaceSearchResult {
  return {
    uri: URI.file(path),
    name: path.split("/").at(-1) ?? relativePath,
    relativePath,
    line,
    preview,
    score: 10
  };
}

function status(state: WorkspaceIndexStatus["state"]): WorkspaceIndexStatus {
  return {
    state,
    indexedFiles: 0,
    totalFiles: 0,
    skippedFiles: 0,
    updatedAt: 1
  };
}
