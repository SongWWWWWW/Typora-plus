import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchKeybindingDispatchTarget,
  dispatchWorkbenchKeybinding,
  registerWorkbenchKeybindingDispatch,
  type WorkbenchKeybindingDispatchServices,
  type WorkbenchKeydownEvent
} from "./workbenchKeybindingDispatch";

describe("workbench keybinding dispatch", () => {
  it("creates a dispatch target from a browser keydown target", () => {
    const browserTarget = {
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    const target = createWorkbenchKeybindingDispatchTarget(browserTarget);
    const listener = vi.fn();

    target.addEventListener("keydown", listener);
    target.removeEventListener("keydown", listener);

    expect(browserTarget.addEventListener).toHaveBeenCalledWith("keydown", listener);
    expect(browserTarget.removeEventListener).toHaveBeenCalledWith("keydown", listener);
  });

  it("does not prevent default or execute a command when no keybinding resolves", () => {
    const services = createServices();
    const event = createEvent();
    const callbacks = {
      setOperationError: vi.fn(),
      setSaveConflict: vi.fn()
    };

    expect(dispatchWorkbenchKeybinding(services, event, callbacks)).toBe(false);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(services.commandService.executeCommand).not.toHaveBeenCalled();
    expect(callbacks.setOperationError).not.toHaveBeenCalled();
  });

  it("prevents default and executes the resolved command through the action runner", async () => {
    const services = createServices({
      resolve: () => "file.save"
    });
    const event = createEvent({ key: "s", ctrlKey: true });
    const callbacks = {
      setOperationError: vi.fn(),
      setSaveConflict: vi.fn()
    };

    expect(dispatchWorkbenchKeybinding(services, event, callbacks)).toBe(true);
    await Promise.resolve();

    expect(event.preventDefault).toHaveBeenCalledOnce();
    expect(services.commandService.executeCommand).toHaveBeenCalledWith("file.save");
    expect(callbacks.setOperationError).toHaveBeenCalledWith(undefined);
  });

  it("registers and disposes one keydown listener", () => {
    const services = createServices({
      resolve: () => "workbench.quickOpen"
    });
    const callbacks = {
      setOperationError: vi.fn(),
      setSaveConflict: vi.fn()
    };
    const target = createTarget();

    const disposable = registerWorkbenchKeybindingDispatch(target, services, callbacks);

    expect(target.listeners).toHaveLength(1);
    target.listeners[0]?.(createEvent({ key: "p", ctrlKey: true }));
    expect(services.commandService.executeCommand).toHaveBeenCalledWith("workbench.quickOpen");

    disposable.dispose();

    expect(target.listeners).toHaveLength(0);
  });
});

function createServices(overrides: {
  readonly resolve?: WorkbenchKeybindingDispatchServices["keybindingService"]["resolve"];
  readonly executeCommand?: WorkbenchKeybindingDispatchServices["commandService"]["executeCommand"];
} = {}): WorkbenchKeybindingDispatchServices {
  const executeCommand = vi.fn(overrides.executeCommand ?? (async <T = unknown>() => undefined as T)) as unknown as
    WorkbenchKeybindingDispatchServices["commandService"]["executeCommand"];

  return {
    commandService: {
      executeCommand
    },
    keybindingService: {
      resolve: vi.fn(overrides.resolve ?? (() => undefined))
    }
  };
}

function createTarget(): {
  readonly listeners: Array<(event: WorkbenchKeydownEvent) => void>;
  readonly addEventListener: (type: "keydown", listener: (event: WorkbenchKeydownEvent) => void) => void;
  readonly removeEventListener: (type: "keydown", listener: (event: WorkbenchKeydownEvent) => void) => void;
} {
  const listeners: Array<(event: WorkbenchKeydownEvent) => void> = [];

  return {
    listeners,
    addEventListener: (_type, listener) => listeners.push(listener),
    removeEventListener: (_type, listener) => {
      const index = listeners.indexOf(listener);

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    }
  };
}

function createEvent(overrides: Partial<WorkbenchKeydownEvent> = {}): WorkbenchKeydownEvent {
  return {
    key: "x",
    preventDefault: vi.fn(),
    ...overrides
  };
}
