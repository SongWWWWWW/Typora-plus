import { describe, expect, it, vi } from "vitest";
import type { RemoteSyncProviderConfiguration } from "./configuration";
import {
  createRemoteSyncProfileRequestTransport,
  type RemoteSyncProfileRequestTransport
} from "./remoteSyncProfileRequest";
import type {
  RemoteSyncNativeRequestInput,
  RemoteSyncNativeRequestTransport
} from "./remoteSyncNativeRequest";

describe("remote sync profile request transport", () => {
  it("does not create a transport when native requests are unavailable", () => {
    expect(createRemoteSyncProfileRequestTransport(createProfile(), undefined)).toBeUndefined();
  });

  it("resolves profile base URLs, relative paths, and structured query values", async () => {
    const nativeTransport = createNativeTransport();
    const request = createRemoteSyncProfileRequestTransport(createProfile({
      baseUrl: "https://sync.example.test/api/root"
    }), nativeTransport)!;

    await request({
      path: "folders/items",
      query: {
        q: "note",
        page: 2,
        include: true,
        skipped: undefined,
        empty: null
      },
      method: "GET"
    });

    expect(nativeTransport).toHaveBeenCalledWith({
      url: "https://sync.example.test/api/root/folders/items?q=note&page=2&include=true",
      method: "GET"
    });
  });

  it("maps named secret bindings and forwards request options", async () => {
    const nativeTransport = createNativeTransport();
    const signal = new AbortController().signal;
    const request = createRemoteSyncProfileRequestTransport(createProfile(), nativeTransport)!;

    await request({
      path: "files/content",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "note.md" }),
      bodyEncoding: "utf8",
      responseType: "json",
      secretHeaders: [
        {
          name: "Authorization",
          secretName: "session",
          prefix: "Bearer "
        }
      ],
      secretJsonFields: [
        {
          name: "client",
          secretName: "client"
        }
      ],
      signal
    });

    expect(nativeTransport).toHaveBeenCalledWith({
      url: "https://sync.example.test/api/files/content",
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ name: "note.md" }),
      bodyEncoding: "utf8",
      responseType: "json",
      secretHeaders: [
        {
          name: "Authorization",
          prefix: "Bearer ",
          secretRef: "typora-plus.remote-sync.session"
        }
      ],
      secretJsonFields: [
        {
          name: "client",
          secretRef: "typora-plus.remote-sync.client"
        }
      ],
      signal
    });
  });

  it("forwards structured multipart parts through a profile request", async () => {
    const nativeTransport = createNativeTransport();
    const request = createRemoteSyncProfileRequestTransport(createProfile(), nativeTransport)!;

    await request({
      path: "files/upload",
      method: "POST",
      multipart: [
        {
          kind: "text",
          name: "file_name",
          value: "note.md"
        },
        {
          kind: "file",
          name: "file",
          fileName: "note.md",
          value: "# Note\n",
          encoding: "utf8",
          contentType: "text/markdown"
        }
      ],
      secretHeaders: [
        {
          name: "Authorization",
          secretName: "session",
          prefix: "Bearer "
        }
      ]
    });

    expect(nativeTransport).toHaveBeenCalledWith({
      url: "https://sync.example.test/api/files/upload",
      method: "POST",
      multipart: [
        {
          kind: "text",
          name: "file_name",
          value: "note.md"
        },
        {
          kind: "file",
          name: "file",
          fileName: "note.md",
          value: "# Note\n",
          encoding: "utf8",
          contentType: "text/markdown"
        }
      ],
      secretHeaders: [
        {
          name: "Authorization",
          prefix: "Bearer ",
          secretRef: "typora-plus.remote-sync.session"
        }
      ]
    });
  });

  it.each([
    "/files",
    "//files",
    "https://sync.example.test/files",
    "../files",
    "folders/../files",
    "folders/%2e%2e/files",
    "folders\\files",
    "files?cursor=1",
    "files#section"
  ])("rejects unsafe relative path input: %s", async (path) => {
    const request = createRequest();

    await expect(request({
      path,
      method: "GET"
    })).rejects.toThrow("Remote sync profile request path");
  });

  it("rejects missing profile secret names", async () => {
    const request = createRequest();

    await expect(request({
      path: "files",
      method: "GET",
      secretHeaders: [
        {
          name: "Authorization",
          secretName: "missing"
        }
      ]
    })).rejects.toThrow("Remote sync profile secret is not configured: missing");
  });

  it("rejects invalid profile configuration before creating a transport", () => {
    expect(() => createRemoteSyncProfileRequestTransport({
      ...createProfile(),
      baseUrl: "http://not-loopback.example.test"
    }, createNativeTransport())).toThrow("Remote sync provider profile is invalid");
  });

  it.each([
    { query: [] as unknown, error: "Remote sync profile request query must be an object" },
    { query: Object.fromEntries(Array.from({ length: 65 }, (_value, index) => [`k${index}`, index])), error: "too many entries" },
    { query: { " ": "value" }, error: "query key is invalid" },
    { query: { key: Number.POSITIVE_INFINITY }, error: "query value is invalid" },
    { query: { key: "x".repeat(1025) }, error: "query value is too large" }
  ])("rejects invalid query data", async ({ query, error }) => {
    const request = createRequest();

    await expect(request({
      path: "files",
      query: query as Record<string, never>,
      method: "GET"
    })).rejects.toThrow(error);
  });
});

function createRequest(): RemoteSyncProfileRequestTransport {
  return createRemoteSyncProfileRequestTransport(createProfile(), createNativeTransport())!;
}

function createProfile(
  overrides: Partial<RemoteSyncProviderConfiguration> = {}
): RemoteSyncProviderConfiguration {
  return {
    id: "configured.sync",
    title: "Configured Sync",
    kind: "native-request",
    baseUrl: "https://sync.example.test/api/",
    remoteScopeId: "workspace-root",
    secrets: [
      {
        name: "session",
        secretRef: "typora-plus.remote-sync.session"
      },
      {
        name: "client",
        secretRef: "typora-plus.remote-sync.client"
      }
    ],
    ...overrides
  };
}

function createNativeTransport(): RemoteSyncNativeRequestTransport & {
  readonly mock: ReturnType<typeof vi.fn>["mock"];
} {
  return vi.fn(async (_request: RemoteSyncNativeRequestInput) => ({
    status: 200,
    statusText: "OK",
    headers: {},
    body: { ok: true }
  }));
}
