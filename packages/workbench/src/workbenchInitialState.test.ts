import { URI } from "@typora-plus/base";
import {
  defaultConfiguration,
  type RecentResource,
  type RegisteredTheme,
  type TextFileModel,
  type WorkspaceIndexStatus,
  type WorkspaceState
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchInitialState,
  type WorkbenchInitialStateServices
} from "./workbenchInitialState";

describe("workbench initial state", () => {
  it("captures the startup snapshot from public service state", () => {
    const model = createModel();
    const workspace: WorkspaceState = {
      name: "Notes",
      rootUri: URI.file("/workspace")
    };
    const recents: readonly RecentResource[] = [{
      kind: "file",
      uri: URI.file("/workspace/a.md"),
      name: "a.md",
      lastOpenedAt: 1
    }];
    const themes: readonly RegisteredTheme[] = [{
      id: "ink-dark",
      label: "Ink Dark",
      tokens: {
        "--tp-bg": "#111"
      }
    }];
    const indexStatus: WorkspaceIndexStatus = {
      state: "indexing",
      indexedFiles: 2,
      totalFiles: 4,
      skippedFiles: 1,
      updatedAt: 10
    };
    const services = createServices({
      indexStatus,
      model,
      recents,
      themes,
      workspace
    });

    expect(createWorkbenchInitialState(services)).toEqual({
      configuration: defaultConfiguration,
      indexStatus,
      model,
      recents,
      themes,
      workspace
    });
    expect(services.configurationService.getValue).toHaveBeenCalledOnce();
    expect(services.indexService.getStatus).toHaveBeenCalledOnce();
    expect(services.textFileService.openDefault).toHaveBeenCalledOnce();
    expect(services.recentService.getRecents).toHaveBeenCalledOnce();
    expect(services.themeService.getThemes).toHaveBeenCalledOnce();
    expect(services.workspaceService.getWorkspace).toHaveBeenCalledOnce();
  });
});

function createServices(overrides: {
  readonly indexStatus?: WorkspaceIndexStatus;
  readonly model?: TextFileModel;
  readonly recents?: readonly RecentResource[];
  readonly themes?: readonly RegisteredTheme[];
  readonly workspace?: WorkspaceState;
} = {}): WorkbenchInitialStateServices & {
  readonly configurationService: {
    readonly getValue: ReturnType<typeof vi.fn>;
  };
  readonly indexService: {
    readonly getStatus: ReturnType<typeof vi.fn>;
  };
  readonly recentService: {
    readonly getRecents: ReturnType<typeof vi.fn>;
  };
  readonly textFileService: {
    readonly openDefault: ReturnType<typeof vi.fn>;
  };
  readonly themeService: {
    readonly getThemes: ReturnType<typeof vi.fn>;
  };
  readonly workspaceService: {
    readonly getWorkspace: ReturnType<typeof vi.fn>;
  };
} {
  const fallbackIndexStatus: WorkspaceIndexStatus = {
    state: "idle",
    indexedFiles: 0,
    totalFiles: 0,
    skippedFiles: 0,
    updatedAt: 0
  };

  return {
    configurationService: {
      getValue: vi.fn(() => defaultConfiguration)
    },
    indexService: {
      getStatus: vi.fn(() => overrides.indexStatus ?? fallbackIndexStatus)
    },
    recentService: {
      getRecents: vi.fn(() => overrides.recents ?? [])
    },
    textFileService: {
      openDefault: vi.fn(() => overrides.model ?? createModel())
    },
    themeService: {
      getThemes: vi.fn(() => overrides.themes ?? [])
    },
    workspaceService: {
      getWorkspace: vi.fn(() => overrides.workspace ?? { name: "Typora Plus" })
    }
  };
}

function createModel(): TextFileModel {
  return {
    uri: URI.parse("untitled://default"),
    name: "Untitled.md",
    languageId: "markdown",
    value: "",
    dirty: false,
    version: 1
  };
}
