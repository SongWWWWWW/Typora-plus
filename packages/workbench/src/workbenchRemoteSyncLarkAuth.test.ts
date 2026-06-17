import { describe, expect, it, vi } from "vitest";
import type {
  RemoteSyncNativeRequestInput,
  RemoteSyncNativeRequestTransport,
  RemoteSyncProviderConfiguration
} from "@typora-plus/platform";
import {
  checkWorkbenchRemoteSyncLarkAuthorization,
  completeWorkbenchRemoteSyncLarkAuthorization,
  createWorkbenchRemoteSyncLarkFolder,
  createWorkbenchRemoteSyncLarkAuthActions,
  listWorkbenchRemoteSyncLarkFolders,
  startWorkbenchRemoteSyncLarkAuthorization
} from "./workbenchRemoteSyncLarkAuth";

describe("workbench remote sync Lark auth", () => {
  it("checks authorization through the profile gateway", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const transport = createTransport(requests, [{
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        ok: true,
        output: "logged in"
      }
    }]);

    await expect(checkWorkbenchRemoteSyncLarkAuthorization(profile(), { transport })).resolves.toEqual({
      authorized: true,
      message: "logged in"
    });
    expect(requests).toEqual([{
      method: "GET",
      responseType: "json",
      url: "http://127.0.0.1:41573/auth/status?verify=true"
    }]);
  });

  it("starts authorization and extracts nested device flow values", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const transport = createTransport(requests, [{
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        data: {
          device_code: "device-123",
          user_code: "ABCD-EFGH",
          verification_uri: "https://accounts.example.test/device"
        }
      }
    }]);

    await expect(startWorkbenchRemoteSyncLarkAuthorization(profile(), { transport })).resolves.toEqual({
      deviceCode: "device-123",
      userCode: "ABCD-EFGH",
      verificationUrl: "https://accounts.example.test/device"
    });
    expect(requests).toEqual([{
      method: "POST",
      responseType: "json",
      url: "http://127.0.0.1:41573/auth/login/start"
    }]);
  });

  it("completes authorization with the active device code and profile secret header", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const transport = createTransport(requests, [{
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        ok: true
      }
    }]);

    await expect(completeWorkbenchRemoteSyncLarkAuthorization(
      profile({
        metadata: {
          "rawMirror.headerBinding": "session",
          "rawMirror.headerName": "Authorization",
          "rawMirror.headerScheme": "Bearer"
        },
        secrets: [{
          name: "session",
          secretRef: "typora-plus.remote-sync.lark.gateway"
        }]
      }),
      "device-123",
      { transport }
    )).resolves.toEqual({
      authorized: true
    });
    expect(requests).toEqual([{
      body: JSON.stringify({ deviceCode: "device-123" }),
      bodyEncoding: "utf8",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      responseType: "json",
      secretHeaders: [{
        name: "Authorization",
        prefix: "Bearer ",
        secretRef: "typora-plus.remote-sync.lark.gateway"
      }],
      url: "http://127.0.0.1:41573/auth/login/complete"
    }]);
  });

  it("wraps authorization failures in UI actions", async () => {
    const setOperationError = vi.fn();
    const actions = createWorkbenchRemoteSyncLarkAuthActions({
      setOperationError
    }, createTransport([], [{
      status: 500,
      statusText: "Internal Server Error",
      headers: {},
      body: {
        ok: false,
        error: "not logged in"
      }
    }]));

    await expect(actions.checkAuthorization(profile())).resolves.toBeUndefined();
    expect(actions.isAvailable).toBe(true);
    expect(setOperationError).toHaveBeenLastCalledWith(
      "Lark authorization gateway failed: 500 Internal Server Error: not logged in"
    );
  });

  it("lists folders through the profile gateway for remote scope selection", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const transport = createTransport(requests, [{
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        ok: true,
        folders: [
          { name: "Notes", token: "folder-notes" }
        ]
      }
    }]);

    await expect(listWorkbenchRemoteSyncLarkFolders(profile(), "root", { transport })).resolves.toEqual([
      {
        name: "Notes",
        token: "folder-notes"
      }
    ]);
    expect(requests).toEqual([{
      method: "GET",
      responseType: "json",
      url: "http://127.0.0.1:41573/folders/list?remoteScopeId=root"
    }]);
  });

  it("creates folders through the profile gateway and returns the selected token", async () => {
    const requests: RemoteSyncNativeRequestInput[] = [];
    const transport = createTransport(requests, [{
      status: 200,
      statusText: "OK",
      headers: {},
      body: {
        ok: true,
        name: "Typora Plus",
        token: "created-folder"
      }
    }]);

    await expect(createWorkbenchRemoteSyncLarkFolder(profile(), {
      name: "Typora Plus",
      parentToken: "root"
    }, { transport })).resolves.toEqual({
      name: "Typora Plus",
      token: "created-folder"
    });
    expect(requests).toEqual([{
      body: JSON.stringify({
        name: "Typora Plus",
        parentToken: "root"
      }),
      bodyEncoding: "utf8",
      headers: {
        "Content-Type": "application/json"
      },
      method: "POST",
      responseType: "json",
      url: "http://127.0.0.1:41573/folders/create"
    }]);
  });
});

function profile(
  overrides: Partial<RemoteSyncProviderConfiguration> = {}
): RemoteSyncProviderConfiguration {
  return {
    id: "lark.raw-mirror",
    title: "Lark Raw Mirror",
    kind: "native-request",
    baseUrl: "http://127.0.0.1:41573/",
    secrets: [],
    metadata: {
      "rawMirror.adapter": "raw-mirror",
      "rawMirror.listPath": "mirror/list",
      "rawMirror.uploadPath": "mirror/upload",
      "rawMirror.downloadPath": "mirror/download",
      "rawMirror.deletePath": "mirror/delete"
    },
    ...overrides
  };
}

function createTransport(
  requests: RemoteSyncNativeRequestInput[],
  responses: readonly {
    readonly status: number;
    readonly statusText: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly body?: unknown;
  }[]
): RemoteSyncNativeRequestTransport {
  const responseQueue = [...responses];

  return vi.fn(async (request) => {
    requests.push(request);
    const response = responseQueue.shift();

    if (!response) {
      throw new Error("unexpected Lark auth request");
    }

    return response;
  });
}
