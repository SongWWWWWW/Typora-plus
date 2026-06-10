import { URI } from "@typora-plus/base";
import type { ContextKeyValue, FileTreeEntry, WorkspaceState } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  applyWorkbenchContextValues,
  createWorkbenchCapabilityContextValues,
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

  it("creates Workbench state context values", () => {
    expect(createWorkbenchStateContextValues({
      editor: {
        focusMode: true,
        typewriterMode: false
      }
    }, {
      uri: URI.file("/workspace/README.md")
    }, "tags", workspace(true))).toEqual([
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
    }, null, workspace(false));

    expect(values.find((entry) => entry.key === workbenchContextKeys.activeResourceScheme)?.value)
      .toBe("untitled");
    expect(values.find((entry) => entry.key === workbenchContextKeys.sideView)?.value)
      .toBeNull();
    expect(values.find((entry) => entry.key === workbenchContextKeys.workspaceOpen)?.value)
      .toBe(false);
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
});

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
