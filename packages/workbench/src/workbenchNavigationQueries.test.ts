import { URI } from "@typora-plus/base";
import type {
  FileTreeEntry,
  TextFileModel,
  WorkspaceState,
  WorkspaceIndexedLink,
  WorkspaceIndexedTag,
  WorkspaceIndexedTagSummary
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  getWorkbenchBacklinks,
  getWorkbenchSearchResults,
  getWorkbenchTaggedResources,
  getWorkbenchTags,
  type WorkbenchNavigationQueryServices
} from "./workbenchNavigationQueries";

describe("workbench navigation queries", () => {
  it("searches the active document when no workspace is open", () => {
    const services = createServices();

    expect(getWorkbenchSearchResults(
      services,
      {},
      model("untitled://default", "Alpha\nBeta\nalphabet"),
      "alpha",
      { maxDocumentResults: 1 }
    )).toEqual([
      {
        line: 1,
        preview: "Alpha"
      }
    ]);
    expect(services.indexService.query).not.toHaveBeenCalled();
  });

  it("delegates search to the workspace index when workspace files are available", () => {
    const workspaceResult = {
      uri: URI.file("C:/Notes/a.md"),
      name: "a.md",
      relativePath: "a.md",
      line: 2,
      preview: "Alpha",
      score: 10
    };
    const services = createServices({
      query: vi.fn(() => [workspaceResult])
    });

    expect(getWorkbenchSearchResults(
      services,
      workspace(),
      model("untitled://default", "local alpha"),
      "alpha",
      { maxDocumentResults: 10 }
    )).toEqual([workspaceResult]);
    expect(services.indexService.query).toHaveBeenCalledWith("alpha");
  });

  it("returns backlinks only for file resources in an open workspace", () => {
    const link = backlink("C:/Notes/source.md");
    const services = createServices({
      getBacklinks: vi.fn(() => [link])
    });

    expect(getWorkbenchBacklinks(services, workspace(), model("file:///C:/Notes/a.md", "")))
      .toEqual([link]);
    expect(getWorkbenchBacklinks(services, workspace(), model("untitled://default", "")))
      .toEqual([]);
    expect(getWorkbenchBacklinks(services, {}, model("file:///C:/Notes/a.md", "")))
      .toEqual([]);
    expect(services.indexService.getBacklinks).toHaveBeenCalledTimes(1);
  });

  it("returns tags only when a workspace is open", () => {
    const tags = [tagSummary("project", 2)];
    const services = createServices({
      getTags: vi.fn(() => tags)
    });

    expect(getWorkbenchTags(services, workspace())).toBe(tags);
    expect(getWorkbenchTags(services, {})).toEqual([]);
    expect(services.indexService.getTags).toHaveBeenCalledTimes(1);
  });

  it("returns tagged resources only for selected tags in an open workspace", () => {
    const resources = [taggedResource("C:/Notes/a.md", "project")];
    const services = createServices({
      getTaggedResources: vi.fn(() => resources)
    });

    expect(getWorkbenchTaggedResources(services, workspace(), "project")).toBe(resources);
    expect(getWorkbenchTaggedResources(services, workspace(), undefined)).toEqual([]);
    expect(getWorkbenchTaggedResources(services, {}, "project")).toEqual([]);
    expect(services.indexService.getTaggedResources).toHaveBeenCalledOnce();
    expect(services.indexService.getTaggedResources).toHaveBeenCalledWith("project");
  });
});

function createServices(overrides: Partial<WorkbenchNavigationQueryServices["indexService"]> = {}): WorkbenchNavigationQueryServices {
  return {
    indexService: {
      query: vi.fn(() => []),
      getBacklinks: vi.fn(() => []),
      getTags: vi.fn(() => []),
      getTaggedResources: vi.fn(() => []),
      ...overrides
    }
  };
}

function workspace(): Pick<WorkspaceState, "files"> {
  const root: FileTreeEntry = {
    uri: URI.file("C:/Notes"),
    name: "Notes",
    relativePath: "",
    kind: "directory",
    children: []
  };

  return {
    files: {
      root,
      files: []
    }
  };
}

function model(uri: string, value: string): Pick<TextFileModel, "uri" | "value"> {
  return {
    uri: URI.parse(uri),
    value
  };
}

function backlink(path: string): WorkspaceIndexedLink {
  return {
    uri: URI.file(path),
    name: "source.md",
    relativePath: "source.md",
    line: 1,
    kind: "markdown",
    target: "a.md",
    label: "A"
  };
}

function tagSummary(tag: string, count: number): WorkspaceIndexedTagSummary {
  return {
    tag,
    count
  };
}

function taggedResource(path: string, tag: string): WorkspaceIndexedTag {
  return {
    uri: URI.file(path),
    name: "a.md",
    relativePath: "a.md",
    line: 1,
    tag
  };
}
