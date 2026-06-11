import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchSidebarCommandHandlers,
  workbenchSidebarCommandIds
} from "./workbenchSidebarCommands";

describe("workbench sidebar commands", () => {
  it("creates sidebar command handlers from a command executor", () => {
    const executeCommand = vi.fn();
    const handlers = createWorkbenchSidebarCommandHandlers(executeCommand);

    handlers.openWorkspace();
    handlers.refreshWorkspace();

    expect(executeCommand).toHaveBeenCalledWith(workbenchSidebarCommandIds.openWorkspace);
    expect(executeCommand).toHaveBeenCalledWith(workbenchSidebarCommandIds.refreshWorkspace);
    expect(executeCommand).toHaveBeenCalledTimes(2);
  });
});
