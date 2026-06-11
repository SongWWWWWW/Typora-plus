import { describe, expect, it, vi } from "vitest";
import {
  scheduleWorkbenchOverlayFocus,
  workbenchOverlayFocusDelayMs
} from "./workbenchOverlayFocus";

describe("workbench overlay focus", () => {
  it("schedules overlay focus with the shared delay", () => {
    const scheduled: Array<() => void> = [];
    const timer = {
      setTimeout: vi.fn((callback: () => void, delayMs: number) => {
        scheduled.push(callback);
        return delayMs;
      }),
      clearTimeout: vi.fn()
    };
    const target = {
      focus: vi.fn()
    };

    scheduleWorkbenchOverlayFocus(timer, { getFocusTarget: () => target });

    expect(timer.setTimeout).toHaveBeenCalledWith(expect.any(Function), workbenchOverlayFocusDelayMs);
    expect(target.focus).not.toHaveBeenCalled();

    scheduled[0]?.();

    expect(target.focus).toHaveBeenCalledOnce();
  });

  it("does not fail when the overlay target unmounts before focus runs", () => {
    const scheduled: Array<() => void> = [];
    const timer = {
      setTimeout: vi.fn((callback: () => void) => {
        scheduled.push(callback);
        return 1;
      }),
      clearTimeout: vi.fn()
    };

    scheduleWorkbenchOverlayFocus(timer, { getFocusTarget: () => undefined });

    expect(() => scheduled[0]?.()).not.toThrow();
  });

  it("clears scheduled overlay focus work", () => {
    const timer = {
      setTimeout: vi.fn(() => "overlay-focus-handle"),
      clearTimeout: vi.fn()
    };

    const cleanup = scheduleWorkbenchOverlayFocus(timer, {
      getFocusTarget: () => ({ focus: vi.fn() })
    });
    cleanup();

    expect(timer.clearTimeout).toHaveBeenCalledWith("overlay-focus-handle");
  });
});
