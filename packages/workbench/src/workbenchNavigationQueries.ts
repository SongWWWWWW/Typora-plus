import type {
  IIndexService,
  TextFileModel,
  WorkspaceIndexedLink,
  WorkspaceIndexedTag,
  WorkspaceIndexedTagSummary,
  WorkspaceState
} from "@typora-plus/platform";
import {
  searchDocument,
  type WorkbenchSearchResult
} from "./workbenchSearchResultsModel";

export interface WorkbenchNavigationQueryServices {
  readonly indexService: Pick<
    IIndexService,
    "query" | "getBacklinks" | "getTags" | "getTaggedResources"
  >;
}

export interface WorkbenchSearchQueryOptions {
  readonly maxDocumentResults: number;
}

export function getWorkbenchSearchResults(
  services: WorkbenchNavigationQueryServices,
  workspace: Pick<WorkspaceState, "files">,
  model: Pick<TextFileModel, "value">,
  query: string,
  options: WorkbenchSearchQueryOptions
): readonly WorkbenchSearchResult[] {
  return workspace.files
    ? services.indexService.query(query)
    : searchDocument(model.value, query, { maxResults: options.maxDocumentResults });
}

export function getWorkbenchBacklinks(
  services: WorkbenchNavigationQueryServices,
  workspace: Pick<WorkspaceState, "files">,
  model: Pick<TextFileModel, "uri">
): readonly WorkspaceIndexedLink[] {
  return workspace.files && model.uri.scheme === "file"
    ? services.indexService.getBacklinks(model.uri)
    : [];
}

export function getWorkbenchTags(
  services: WorkbenchNavigationQueryServices,
  workspace: Pick<WorkspaceState, "files">
): readonly WorkspaceIndexedTagSummary[] {
  return workspace.files ? services.indexService.getTags() : [];
}

export function getWorkbenchTaggedResources(
  services: WorkbenchNavigationQueryServices,
  workspace: Pick<WorkspaceState, "files">,
  selectedTag: string | undefined
): readonly WorkspaceIndexedTag[] {
  return workspace.files && selectedTag ? services.indexService.getTaggedResources(selectedTag) : [];
}
