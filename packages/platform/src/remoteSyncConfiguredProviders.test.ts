import { URI } from "@typora-plus/base";
import { describe, expect, it, vi } from "vitest";
import type { RemoteSyncProviderConfiguration } from "./configuration";
import {
  createConfiguredRemoteSyncProviders,
  createNativeRemoteSyncConfiguredProviderFactoryOptions
} from "./remoteSyncConfiguredProviders";
import type { RemoteSyncNativeRequestInput, RemoteSyncNativeRequestTransport } from "./remoteSyncNativeRequest";

describe("configured remote sync providers", () => {
  it("creates profile-backed providers through an injected factory", async () => {
    const nativeRequests: RemoteSyncNativeRequestInput[] = [];
    const transport = createNativeTransport(nativeRequests);
    const providers = createConfiguredRemoteSyncProviders([
      configuration("notes.primary", "Primary")
    ], {
      transport,
      createProvider: ({ profile, request }) => ({
        id: profile.id,
        title: profile.title,
        async createPlan(planRequest) {
          await request({
            path: "snapshot/list",
            query: {
              scope: profile.remoteScopeId,
              dryRun: planRequest.dryRun ?? false
            },
            method: "GET",
            secretHeaders: [
              {
                name: "Authorization",
                secretName: "session",
                prefix: "Bearer "
              }
            ],
            ...(planRequest.signal !== undefined ? { signal: planRequest.signal } : {})
          });

          return {
            operations: [],
            summary: {
              creates: 0,
              updates: 0,
              deletes: 0,
              skips: 0,
              conflicts: 0
            }
          };
        },
        async executePlan(plan) {
          return {
            operations: plan.operations,
            summary: plan.summary
          };
        }
      })
    });

    expect(providers.map((provider) => ({ id: provider.id, title: provider.title }))).toEqual([
      { id: "notes.primary", title: "Primary" }
    ]);

    const signal = new AbortController().signal;
    await expect(providers[0]?.createPlan({
      workspaceUri: URI.file("C:/Notes"),
      resources: [],
      direction: "push",
      dryRun: true,
      signal
    })).resolves.toEqual({
      operations: [],
      summary: {
        creates: 0,
        updates: 0,
        deletes: 0,
        skips: 0,
        conflicts: 0
      }
    });
    expect(nativeRequests).toEqual([
      {
        url: "https://sync.example.test/api/snapshot/list?scope=workspace-root&dryRun=true",
        method: "GET",
        secretHeaders: [
          {
            name: "Authorization",
            prefix: "Bearer ",
            secretRef: "typora-plus.remote-sync.notes.primary"
          }
        ],
        signal
      }
    ]);
  });

  it("lets provider factories skip unsupported profiles", () => {
    const providers = createConfiguredRemoteSyncProviders([
      configuration("notes.primary", "Primary")
    ], {
      transport: createNativeTransport(),
      createProvider: () => undefined
    });

    expect(providers).toEqual([]);
  });

  it("rejects invalid profile configuration", () => {
    expect(() => createConfiguredRemoteSyncProviders([
      {
        ...configuration("notes.primary", "Primary"),
        baseUrl: "http://not-loopback.example.test"
      }
    ], {
      transport: createNativeTransport(),
      createProvider: () => undefined
    })).toThrow("Remote sync provider profile is invalid");
  });

  it("creates native factory options only when a native transport is available", () => {
    const createProvider = vi.fn();
    const transport = createNativeTransport();

    expect(createNativeRemoteSyncConfiguredProviderFactoryOptions(createProvider, undefined)).toBeUndefined();
    expect(createNativeRemoteSyncConfiguredProviderFactoryOptions(createProvider, transport)).toEqual({
      transport,
      createProvider
    });
  });
});

function configuration(id: string, title: string): RemoteSyncProviderConfiguration {
  return {
    id,
    title,
    kind: "native-request",
    baseUrl: "https://sync.example.test/api/",
    remoteScopeId: "workspace-root",
    secrets: [
      {
        name: "session",
        secretRef: `typora-plus.remote-sync.${id}`
      }
    ]
  };
}

function createNativeTransport(
  requests: RemoteSyncNativeRequestInput[] = []
): RemoteSyncNativeRequestTransport {
  return vi.fn(async (request) => {
    requests.push(request);
    return {
      status: 200,
      statusText: "OK",
      headers: {},
      body: { ok: true }
    };
  });
}
