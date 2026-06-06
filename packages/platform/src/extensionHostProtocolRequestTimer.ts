import { toDisposable, type IDisposable } from "@typora-plus/base";

export interface ExtensionHostProtocolRequestTimer {
  schedule(callback: () => void, delayMs: number): IDisposable;
}

export const defaultExtensionHostProtocolRequestTimer: ExtensionHostProtocolRequestTimer = {
  schedule(callback, delayMs) {
    const handle = globalThis.setTimeout(callback, delayMs);

    return toDisposable(() => {
      globalThis.clearTimeout(handle);
    });
  }
};

export function readExtensionHostProtocolRequestTimeoutMs(
  value: number | undefined,
  label: string
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }

  return value > 0 ? value : undefined;
}
