import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  findInvalidRemoteSyncSmokeEnvironment,
  findMissingRemoteSyncSmokeEnvironment,
  formatRemoteSyncSmokeEnvironmentGroup,
  runRemoteSyncSmokeCli
} from "./run-remote-sync-smoke.mjs";

describe("remote sync smoke runner", () => {
  it("reports missing environment groups without exposing configured values", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runRemoteSyncSmokeCli({
      environment: {
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID: "configured-provider",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE: "configured-title",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL: "configured-base-url",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI: "configured-workspace-uri",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH: "configured-list-path",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH: "configured-upload-path",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH: "configured-download-path"
      },
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(output).toEqual([]);
    expect(errors).toEqual([
      "Remote sync smoke test environment is incomplete.",
      "Set one variable from each required group before running the smoke test:",
      "- delete path: TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH"
    ]);
    expect(errors.join("\n")).not.toContain("configured-base-url");
    expect(errors.join("\n")).not.toContain("configured-provider");
  });

  it("requires complete secret header values when any secret smoke value is configured", async () => {
    const errors = [];
    const exitCode = await runRemoteSyncSmokeCli({
      environment: {
        ...completeRemoteSyncSmokeEnvironment(),
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "configured-secret-name",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: "configured-secret-value"
      },
      spawnProcess: () => createClosingChildProcess(0),
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual([
      "Remote sync smoke test environment is incomplete.",
      "Set one variable from each required group before running the smoke test:",
      "- secret reference: TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF",
      "- secret header name: TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME"
    ]);
    expect(errors.join("\n")).not.toContain("configured-secret-value");
  });

  it("runs the raw mirror smoke test when required values are configured", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runRemoteSyncSmokeCli({
      environment: completeRemoteSyncSmokeEnvironment(),
      nodeExecutable: "node",
      smokeTestPath: "packages/platform/src/remoteSyncConfiguredRawMirrorProvider.smoke.test.ts",
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      vitestEntryPath: "node_modules/vitest/vitest.mjs",
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual(["Running provider-neutral raw mirror remote sync smoke test."]);
    expect(errors).toEqual([]);
    expect(spawnCalls).toEqual([
      [
        "node",
        [
          "node_modules/vitest/vitest.mjs",
          "run",
          "packages/platform/src/remoteSyncConfiguredRawMirrorProvider.smoke.test.ts"
        ],
        {
          env: {
            ...completeRemoteSyncSmokeEnvironment(),
            TYPORA_PLUS_REMOTE_SYNC_SMOKE_REQUIRED: "1"
          },
          stdio: "inherit"
        }
      ]
    ]);
  });

  it("accepts optional local resource snapshot JSON before running the smoke test", async () => {
    const spawnCalls = [];
    const environment = {
      ...completeRemoteSyncSmokeEnvironment(),
      TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: JSON.stringify([{
        relativePath: "notes/daily.md",
        kind: "file",
        size: 42,
        mtime: 100,
        contentHash: "sha256:daily",
        name: "daily.md"
      }])
    };
    const exitCode = await runRemoteSyncSmokeCli({
      environment,
      nodeExecutable: "node",
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      vitestEntryPath: "node_modules/vitest/vitest.mjs",
      writeError: () => undefined,
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(0);
    expect(spawnCalls[0]?.[2]).toEqual({
      env: {
        ...environment,
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_REQUIRED: "1"
      },
      stdio: "inherit"
    });
  });

  it("rejects invalid profile environment values before spawning without exposing raw values", async () => {
    const errors = [];
    const spawnCalls = [];
    const secretValue = "s".repeat(64 * 1024 + 1);
    const remoteScopeId = "r".repeat(257);
    const exitCode = await runRemoteSyncSmokeCli({
      environment: {
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID: "bad provider",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE: "Configured Provider",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL: "http://remote.example.test/raw",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI: "not-a-uri",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH: "../secret/list",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH: "/absolute/upload",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH: "download?token=secret",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH: "C:/delete",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_DIRECTION: "sideways",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PAGE_SIZE: "0",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_REMOTE_SCOPE_ID: remoteScopeId,
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_NAME: "bad secret",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_REF: "../secret",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_SECRET_VALUE: secretValue,
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_NAME: "Bad Header",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_SCHEME: "Bearer\nleak"
      },
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(errors).toEqual([
      "Remote sync smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- provider id must use provider id characters and be at most 256 characters",
      "- base URL must be HTTPS or loopback HTTP and at most 2000 characters",
      "- workspace URI must be an absolute URI and at most 2000 characters",
      "- list path must be a relative raw mirror path at most 512 characters",
      "- upload path must be a relative raw mirror path at most 512 characters",
      "- download path must be a relative raw mirror path at most 512 characters",
      "- delete path must be a relative raw mirror path at most 512 characters",
      "- sync direction must be push, pull, or bidirectional",
      "- list page size must be an integer from 1 to 1000",
      "- remote scope id must be at most 256 characters",
      "- secret binding name must use secret binding characters and be at most 64 characters",
      "- secret reference must use secret reference characters and be at most 256 characters",
      "- secret value must be at most 65536 UTF-8 bytes",
      "- secret header name must be a valid HTTP header name",
      "- secret header scheme must be at most 128 characters and must not contain line breaks"
    ]);
    expect(errors.join("\n")).not.toContain("remote.example.test");
    expect(errors.join("\n")).not.toContain("secret/list");
    expect(errors.join("\n")).not.toContain(secretValue);
    expect(errors.join("\n")).not.toContain(remoteScopeId);
  });

  it("rejects invalid optional local resource snapshots without exposing raw JSON", async () => {
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runRemoteSyncSmokeCli({
      environment: {
        ...completeRemoteSyncSmokeEnvironment(),
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: "[{\"relativePath\":\"../secret.md\",\"size\":-1}]"
      },
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      writeError: (message) => errors.push(message),
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(1);
    expect(spawnCalls).toEqual([]);
    expect(errors).toEqual([
      "Remote sync smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON[0].relativePath must not contain parent traversal",
      "- TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON[0].size must be a non-negative finite number"
    ]);
    expect(errors.join("\n")).not.toContain("secret.md");
  });

  it("propagates the spawned smoke test exit code", async () => {
    const exitCode = await runRemoteSyncSmokeCli({
      environment: completeRemoteSyncSmokeEnvironment(),
      spawnProcess: () => createClosingChildProcess(9),
      writeError: () => undefined,
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(9);
  });

  it("keeps environment group formatting deterministic", () => {
    const missing = findMissingRemoteSyncSmokeEnvironment({
      environment: {
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID: "configured-provider"
      }
    });

    expect(missing.map(formatRemoteSyncSmokeEnvironmentGroup)).toEqual([
      "provider title: TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE",
      "base URL: TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL",
      "workspace URI: TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI",
      "list path: TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH",
      "upload path: TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH",
      "download path: TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH",
      "delete path: TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH"
    ]);
  });

  it("reports local resource snapshot validation issues deterministically", () => {
    expect(findInvalidRemoteSyncSmokeEnvironment({
      environment: {
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: "{bad"
      }
    })).toEqual([
      "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON must be valid JSON"
    ]);
    expect(findInvalidRemoteSyncSmokeEnvironment({
      environment: {
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: JSON.stringify({
          relativePath: "notes/daily.md"
        })
      }
    })).toEqual([
      "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON must be a JSON array"
    ]);
    expect(findInvalidRemoteSyncSmokeEnvironment({
      environment: {
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON: JSON.stringify([{
          relativePath: "C:/Notes/daily.md",
          kind: "asset",
          mtime: "yesterday",
          contentHash: 123
        }])
      }
    })).toEqual([
      "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON[0].relativePath must be workspace-relative",
      "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON[0].kind must be file or directory",
      "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON[0].mtime must be a non-negative finite number",
      "TYPORA_PLUS_REMOTE_SYNC_SMOKE_LOCAL_RESOURCES_JSON[0].contentHash must be a string"
    ]);
  });

  it("reports profile validation issues deterministically", () => {
    expect(findInvalidRemoteSyncSmokeEnvironment({
      environment: {
        ...completeRemoteSyncSmokeEnvironment(),
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_DIRECTION: "sideways",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PAGE_SIZE: "1001",
        TYPORA_PLUS_REMOTE_SYNC_SMOKE_HEADER_SCHEME: "Bearer"
      }
    })).toEqual([
      "sync direction must be push, pull, or bidirectional",
      "list page size must be an integer from 1 to 1000",
      "secret header scheme requires a complete secret header configuration"
    ]);
  });
});

function completeRemoteSyncSmokeEnvironment() {
  return {
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_ID: "configured.provider",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_PROVIDER_TITLE: "Configured Provider",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_BASE_URL: "http://127.0.0.1:8765/raw-mirror",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_WORKSPACE_URI: "file:///C:/Workspace",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_LIST_PATH: "mirror/list",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_UPLOAD_PATH: "mirror/upload",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_DOWNLOAD_PATH: "mirror/download",
    TYPORA_PLUS_REMOTE_SYNC_SMOKE_DELETE_PATH: "mirror/delete"
  };
}

function createClosingChildProcess(exitCode) {
  const child = new EventEmitter();

  queueMicrotask(() => child.emit("close", exitCode));

  return child;
}
