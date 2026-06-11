import { describe, expect, it, vi } from "vitest";
import {
  createNativeRemoteSyncRequestTransport,
  type NativeRemoteSyncRequestBridge,
  type RemoteSyncNativeRequest,
  type RemoteSyncNativeResponse
} from "./remoteSyncNativeRequest";

describe("remote sync native request transport", () => {
  it("delegates provider-neutral requests through the native bridge", async () => {
    const bridge = createBridge();
    const transport = createNativeRemoteSyncRequestTransport(bridge);

    expect(transport).toBeDefined();

    await transport!({
      url: "https://api.example.test/resource",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: true }),
      responseType: "json",
      secretHeaders: [
        {
          name: "X-Provider-Token",
          prefix: "Token ",
          secretRef: "typora-plus.remote-sync.provider"
        }
      ],
      secretJsonFields: [
        {
          name: "provider_secret",
          secretRef: "typora-plus.remote-sync.client"
        }
      ]
    });

    expect(bridge.request).toHaveBeenCalledWith({
      requestId: expect.stringMatching(/^remote-sync:\d+$/),
      url: "https://api.example.test/resource",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ok: true }),
      responseType: "json",
      secretHeaders: [
        {
          name: "X-Provider-Token",
          prefix: "Token ",
          secretRef: "typora-plus.remote-sync.provider"
        }
      ],
      secretJsonFields: [
        {
          name: "provider_secret",
          secretRef: "typora-plus.remote-sync.client"
        }
      ]
    });
  });

  it("forwards cancellation when a request signal aborts", async () => {
    const controller = new AbortController();
    let resolveRequest: (value: RemoteSyncNativeResponse) => void = () => undefined;
    const bridge = createBridge({
      request: vi.fn((_request: RemoteSyncNativeRequest) => new Promise<RemoteSyncNativeResponse>((resolve) => {
        resolveRequest = resolve;
      })),
      cancel: vi.fn()
    });
    const transport = createNativeRemoteSyncRequestTransport(bridge)!;
    const pending = transport({
      url: "https://api.example.test/resource",
      method: "GET",
      signal: controller.signal
    });

    await Promise.resolve();

    const requestId = bridge.request.mock.calls[0]?.[0].requestId;
    expect(requestId).toEqual(expect.stringMatching(/^remote-sync:\d+$/));

    controller.abort();

    expect(bridge.cancel).toHaveBeenCalledWith(requestId);

    resolveRequest({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "done"
    });

    await expect(pending).resolves.toEqual({
      status: 200,
      statusText: "OK",
      headers: {},
      body: "done"
    });
  });

  it("does not start native requests when the signal is already aborted", async () => {
    const controller = new AbortController();
    const bridge = createBridge();
    const transport = createNativeRemoteSyncRequestTransport(bridge)!;

    controller.abort();

    await expect(transport({
      url: "https://api.example.test/resource",
      method: "GET",
      signal: controller.signal
    })).rejects.toThrow("Remote sync native request was aborted");
    expect(bridge.request).not.toHaveBeenCalled();
  });

  it("does not create a transport when the native bridge is unavailable", () => {
    expect(createNativeRemoteSyncRequestTransport(undefined)).toBeUndefined();
    expect(createNativeRemoteSyncRequestTransport({
      isAvailable: false,
      request: vi.fn()
    })).toBeUndefined();
  });

  it("reads native bridge availability from the global Typora Plus bridge", async () => {
    const previousTyporaPlus = (globalThis as { typoraPlus?: unknown }).typoraPlus;
    const bridge = createBridge();

    (globalThis as {
      typoraPlus?: {
        remoteSyncRequests?: NativeRemoteSyncRequestBridge;
      };
    }).typoraPlus = {
      remoteSyncRequests: bridge
    };

    try {
      await createNativeRemoteSyncRequestTransport()?.({
        url: "https://api.example.test/resource",
        method: "GET"
      });
      expect(bridge.request).toHaveBeenCalledOnce();
    } finally {
      (globalThis as { typoraPlus?: unknown }).typoraPlus = previousTyporaPlus;
    }
  });
});

function createBridge(overrides: {
  readonly request?: NativeRemoteSyncRequestBridge["request"];
  readonly cancel?: NativeRemoteSyncRequestBridge["cancel"];
} = {}): NativeRemoteSyncRequestBridge & {
  readonly request: ReturnType<typeof vi.fn>;
  readonly cancel: ReturnType<typeof vi.fn>;
} {
  return {
    isAvailable: true,
    request: vi.fn(overrides.request ?? (async () => ({
      status: 200,
      statusText: "OK",
      headers: {},
      body: { ok: true }
    }))),
    cancel: vi.fn(overrides.cancel ?? (() => undefined))
  };
}
