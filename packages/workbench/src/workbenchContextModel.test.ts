import { URI } from "@typora-plus/base";
import type { ContextKeyValue, FileTreeEntry, WorkspaceState } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  applyWorkbenchContextValues,
  applyWorkbenchCapabilityContext,
  applyWorkbenchStateContext,
  createWorkbenchCapabilityContext,
  createWorkbenchCapabilityContextValues,
  createWorkbenchProviderAvailabilityContext,
  createWorkbenchStateContextValues,
  workbenchContextKeys
} from "./workbenchContextModel";

describe("workbench context model", () => {
  it("creates initial capability context values", () => {
    expect(createWorkbenchCapabilityContextValues({
      fileSystemAvailable: true,
      attachmentAvailable: false,
      resourceAvailable: true
    })).toEqual([
      {
        key: workbenchContextKeys.fileSystemAvailable,
        value: true
      },
      {
        key: workbenchContextKeys.attachmentAvailable,
        value: false
      },
      {
        key: workbenchContextKeys.resourceAvailable,
        value: true
      }
    ]);
  });

  it("captures capability context through service availability boundaries", () => {
    const services = createCapabilityServices({
      attachmentAvailable: false,
      fileSystemAvailable: true,
      resourceAvailable: true
    });

    expect(createWorkbenchCapabilityContext(services)).toEqual({
      attachmentAvailable: false,
      fileSystemAvailable: true,
      resourceAvailable: true
    });
    expect(services.attachmentService.isAvailable).toHaveBeenCalledOnce();
    expect(services.fileService.isAvailable).toHaveBeenCalledOnce();
    expect(services.resourceService.isAvailable).toHaveBeenCalledOnce();
  });

  it("creates Workbench state context values", () => {
    expect(createWorkbenchStateContextValues({
      editor: {
        focusMode: true,
        typewriterMode: false
      }
    }, {
      uri: URI.file("/workspace/README.md")
    }, "tags", workspace(true), providers(true, false))).toEqual([
      {
        key: workbenchContextKeys.activeResourceScheme,
        value: "file"
      },
      {
        key: workbenchContextKeys.editorFocusMode,
        value: true
      },
      {
        key: workbenchContextKeys.editorTypewriterMode,
        value: false
      },
      {
        key: workbenchContextKeys.sideView,
        value: "tags"
      },
      {
        key: workbenchContextKeys.workspaceOpen,
        value: true
      },
      {
        key: workbenchContextKeys.aiProviderAvailable,
        value: true
      },
      {
        key: workbenchContextKeys.remoteSyncProviderAvailable,
        value: false
      }
    ]);
  });

  it("represents closed sidebars and unopened workspaces", () => {
    const values = createWorkbenchStateContextValues({
      editor: {
        focusMode: false,
        typewriterMode: true
      }
    }, {
      uri: URI.parse("untitled://default")
    }, null, workspace(false), providers(false, true));

    expect(values.find((entry) => entry.key === workbenchContextKeys.activeResourceScheme)?.value)
      .toBe("untitled");
    expect(values.find((entry) => entry.key === workbenchContextKeys.sideView)?.value)
      .toBeNull();
    expect(values.find((entry) => entry.key === workbenchContextKeys.workspaceOpen)?.value)
      .toBe(false);
    expect(values.find((entry) => entry.key === workbenchContextKeys.aiProviderAvailable)?.value)
      .toBe(false);
    expect(values.find((entry) => entry.key === workbenchContextKeys.remoteSyncProviderAvailable)?.value)
      .toBe(true);
  });

  it("captures provider availability through service boundaries", () => {
    const services = createProviderAvailabilityServices({
      aiProviderCount: 1,
      remoteSyncProviderCount: 0
    });

    expect(createWorkbenchProviderAvailabilityContext(services)).toEqual({
      aiProviderAvailable: true,
      remoteSyncProviderAvailable: false
    });
    expect(services.aiService.getProviders).toHaveBeenCalledOnce();
    expect(services.remoteSyncService.getProviders).toHaveBeenCalledOnce();
  });

  it("applies context values through the context key service boundary", () => {
    const setValue = vi.fn<(key: string, value: ContextKeyValue | undefined) => void>();
    const entries = createWorkbenchCapabilityContextValues({
      fileSystemAvailable: true,
      attachmentAvailable: true,
      resourceAvailable: false
    });

    applyWorkbenchContextValues({ setValue }, entries);

    expect(setValue.mock.calls).toEqual([
      [workbenchContextKeys.fileSystemAvailable, true],
      [workbenchContextKeys.attachmentAvailable, true],
      [workbenchContextKeys.resourceAvailable, false]
    ]);
  });

  it("applies capability context through the service boundary", () => {
    const services = {
      ...createCapabilityServices({
        attachmentAvailable: true,
        fileSystemAvailable: false,
        resourceAvailable: true
      }),
      contextKeyService: {
        setValue: vi.fn<(key: string, value: ContextKeyValue | undefined) => void>()
      }
    };

    applyWorkbenchCapabilityContext(services);

    expect(services.contextKeyService.setValue.mock.calls).toEqual([
      [workbenchContextKeys.fileSystemAvailable, false],
      [workbenchContextKeys.attachmentAvailable, true],
      [workbenchContextKeys.resourceAvailable, true]
    ]);
  });

  it("applies Workbench state context through the service boundary", () => {
    const setValue = vi.fn<(key: string, value: ContextKeyValue | undefined) => void>();

    applyWorkbenchStateContext({
      ...createProviderAvailabilityServices({
        aiProviderCount: 0,
        remoteSyncProviderCount: 1
      }),
      contextKeyService: {
        setValue
      }
    }, {
      editor: {
        focusMode: true,
        typewriterMode: true
      }
    }, {
      uri: URI.file("/workspace/note.md")
    }, "search", workspace(true));

    expect(setValue.mock.calls).toEqual([
      [workbenchContextKeys.activeResourceScheme, "file"],
      [workbenchContextKeys.editorFocusMode, true],
      [workbenchContextKeys.editorTypewriterMode, true],
      [workbenchContextKeys.sideView, "search"],
      [workbenchContextKeys.workspaceOpen, true],
      [workbenchContextKeys.aiProviderAvailable, false],
      [workbenchContextKeys.remoteSyncProviderAvailable, true]
    ]);
  });
});

function providers(
  aiProviderAvailable: boolean,
  remoteSyncProviderAvailable: boolean
) {
  return {
    aiProviderAvailable,
    remoteSyncProviderAvailable
  };
}

function workspace(open: boolean): Pick<WorkspaceState, "files"> {
  if (!open) {
    return {};
  }

  const root: FileTreeEntry = {
    uri: URI.file("/workspace"),
    name: "workspace",
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

function createCapabilityServices(options: {
  readonly attachmentAvailable: boolean;
  readonly fileSystemAvailable: boolean;
  readonly resourceAvailable: boolean;
}) {
  return {
    attachmentService: {
      isAvailable: vi.fn(() => options.attachmentAvailable)
    },
    fileService: {
      isAvailable: vi.fn(() => options.fileSystemAvailable)
    },
    resourceService: {
      isAvailable: vi.fn(() => options.resourceAvailable)
    }
  };
}

function createProviderAvailabilityServices(options: {
  readonly aiProviderCount: number;
  readonly remoteSyncProviderCount: number;
}) {
  return {
    aiService: {
      getProviders: vi.fn(() => new Array(options.aiProviderCount).fill({
        id: "ai.provider",
        title: "AI Provider"
      }))
    },
    remoteSyncService: {
      getProviders: vi.fn(() => new Array(options.remoteSyncProviderCount).fill({
        id: "sync.provider",
        title: "Sync Provider"
      }))
    }
  };
}
