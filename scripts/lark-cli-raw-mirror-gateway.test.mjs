import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  createLarkGatewayContext,
  createLarkCliSpawnInvocation,
  createLarkDriveFolder,
  createLarkRawMirrorProviderProfile,
  ensureLarkDriveFolderPath,
  handleLarkGatewayRequest,
  listLarkDriveFolders,
  listLarkRawMirrorResources,
  normalizeMirrorPath,
  parseLarkCliJsonOutput,
  resolveDefaultLarkCliCommand,
  resolveDefaultNodeCommand,
  runLarkAuthLoginStart,
  uploadLarkRawMirrorFile
} from "./lark-cli-raw-mirror-gateway.mjs";

describe("lark CLI raw mirror gateway", () => {
  const tempRoots = [];

  afterEach(async () => {
    await Promise.all(tempRoots.map((path) => rm(path, { recursive: true, force: true })));
    tempRoots.length = 0;
  });

  it("creates a raw mirror provider profile without external ids or secrets", () => {
    expect(createLarkRawMirrorProviderProfile({
      baseUrl: "http://127.0.0.1:41573/",
      providerId: "local.raw",
      providerTitle: "Local Raw Mirror",
      remoteScopeId: "remote-root",
      secretName: "gateway",
      secretRef: "local.raw.gateway"
    })).toEqual({
      id: "local.raw",
      title: "Local Raw Mirror",
      kind: "native-request",
      baseUrl: "http://127.0.0.1:41573/",
      remoteScopeId: "remote-root",
      metadata: {
        "rawMirror.adapter": "raw-mirror",
        "rawMirror.listPath": "mirror/list",
        "rawMirror.uploadPath": "mirror/upload",
        "rawMirror.downloadPath": "mirror/download",
        "rawMirror.deletePath": "mirror/delete",
        "rawMirror.headerBinding": "gateway",
        "rawMirror.headerName": "Authorization",
        "rawMirror.headerScheme": "Bearer"
      },
      secrets: [
        {
          name: "gateway",
          secretRef: "local.raw.gateway"
        }
      ]
    });
  });

  it("uses sync-capable auth scopes by default", () => {
    const context = createLarkGatewayContext({
      environment: {}
    });

    expect(context.authScope.split(/\s+/)).toEqual([
      "space:document:retrieve",
      "drive:file:upload",
      "drive:file:download",
      "space:folder:create",
      "space:document:delete"
    ]);
  });

  it("responds to browser CORS preflight requests", async () => {
    const response = createResponseRecorder();

    await handleLarkGatewayRequest(createLarkGatewayContext(), {
      method: "OPTIONS",
      url: "/folders/create",
      headers: {}
    }, response);

    expect(response.statusCode).toBe(204);
    expect(response.headers).toMatchObject({
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "DELETE, GET, OPTIONS, POST, PUT",
      "Access-Control-Allow-Headers": "Authorization, Content-Type"
    });
  });

  it("uses the Windows native CLI binary before the npm script and keeps environment overrides", () => {
    const appData = join("C:", "Users", "test", "AppData", "Roaming");
    const npmCliRoot = join(appData, "npm", "node_modules", "@larksuite", "cli");
    const npmCliBinary = join(npmCliRoot, "bin", "lark-cli.exe");
    const npmCliScript = join(npmCliRoot, "scripts", "run.js");

    expect(resolveDefaultLarkCliCommand("win32", { APPDATA: appData }, (path) => path === npmCliBinary))
      .toBe(npmCliBinary);
    expect(resolveDefaultLarkCliCommand("win32", { APPDATA: appData }, (path) => path === npmCliScript))
      .toBe(npmCliScript);
    expect(resolveDefaultLarkCliCommand("win32", { APPDATA: appData }, () => false)).toBe("lark-cli.cmd");
    expect(resolveDefaultLarkCliCommand("linux")).toBe("lark-cli");
    expect(createLarkGatewayContext({
      environment: {
        TYPORA_PLUS_LARK_CLI_PATH: "custom-lark"
      }
    }).cliCommand).toBe("custom-lark");
  });

  it("spawns Windows Lark CLI commands without shell-managed visible windows", () => {
    const cliScript = join("C:", "Users", "test", "AppData", "Roaming", "npm", "node_modules", "@larksuite", "cli", "scripts", "run.js");
    const nodePath = join("C:", "Node", "node.exe");

    expect(resolveDefaultNodeCommand("win32", {}, nodePath)).toBe(nodePath);
    expect(resolveDefaultNodeCommand("win32", {}, "C:/TyporaPlus/TyporaPlus.exe")).toBe("node.exe");
    expect(createLarkCliSpawnInvocation(cliScript, ["auth", "status"], "win32")).toEqual({
      command: resolveDefaultNodeCommand("win32", process.env, process.execPath),
      args: [cliScript, "auth", "status"],
      options: {}
    });
    expect(createLarkCliSpawnInvocation("lark-cli.cmd", ["auth", "status"], "win32")).toEqual({
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", "lark-cli.cmd", "auth", "status"],
      options: {}
    });
    expect(createLarkCliSpawnInvocation("lark-cli", ["auth", "status"], "linux")).toEqual({
      command: "lark-cli",
      args: ["auth", "status"],
      options: {}
    });
  });

  it("starts auth login with explicit scopes instead of combining scope and domain flags", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      authScope: "drive:file:upload drive:file:download",
      runCli: async (_context, args, options = {}) => {
        calls.push(args);
        return {
          device_code: "device",
          verification_url: "https://example.com"
        };
      }
    });

    await expect(runLarkAuthLoginStart(context)).resolves.toEqual({
      device_code: "device",
      verification_url: "https://example.com"
    });
    expect(calls).toEqual([[
      "auth",
      "login",
      "--no-wait",
      "--json",
      "--scope",
      "drive:file:upload drive:file:download"
    ]]);
  });

  it("falls back to the Drive auth domain when no explicit scope is configured", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      authScope: "",
      runCli: async (_context, args, options = {}) => {
        calls.push(args);
        return { ok: true };
      }
    });

    await runLarkAuthLoginStart(context);
    expect(calls).toEqual([[
      "auth",
      "login",
      "--no-wait",
      "--json",
      "--domain",
      "drive"
    ]]);
  });

  it("parses JSON from CLI output while ignoring trailing notices", () => {
    expect(parseLarkCliJsonOutput('{"ok":true,"data":{"token":"created"}}\n=== Dry Run ===\n')).toEqual({
      ok: true,
      data: {
        token: "created"
      }
    });
    expect(() => parseLarkCliJsonOutput(JSON.stringify({
      ok: false,
      error: {
        message: "insufficient permissions"
      }
    }))).toThrow("insufficient permissions");
  });

  it("rejects unsafe raw mirror paths before calling the CLI", () => {
    expect(normalizeMirrorPath("notes/daily.md")).toBe("notes/daily.md");
    expect(normalizeMirrorPath("notes/./daily.md")).toBe("notes/daily.md");
    expect(() => normalizeMirrorPath("../secret.md")).toThrow("parent traversal");
    expect(() => normalizeMirrorPath("notes/%2E%2E/secret.md")).toThrow("parent traversal");
    expect(() => normalizeMirrorPath("C:/Users/file.md")).toThrow("workspace-relative");
  });

  it("lists Drive folders recursively as raw mirror resources", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      runCli: async (_context, args) => {
        calls.push(args);
        const params = readParams(args);

        if (params[folderTokenKey()] === "root") {
          return {
            data: {
              files: [
                { name: "notes", token: "folder-notes", type: "folder" },
                { name: "Root.md", token: "file-root", type: "file", modified_time: "1700000000", size: "4" },
                { name: "../skip.md", token: "file-skip", type: "file" }
              ]
            }
          };
        }

        if (params[folderTokenKey()] === "folder-notes") {
          return {
            data: {
              files: [
                { name: "Daily.md", token: "file-daily", type: "file", modified_time: "1700000001", file_size: 5 }
              ]
            }
          };
        }

        throw new Error("Unexpected folder list");
      }
    });

    await expect(listLarkRawMirrorResources(context, "root")).resolves.toEqual([
      {
        relativePath: "notes",
        kind: "directory",
        remoteId: "folder-notes"
      },
      {
        relativePath: "notes/Daily.md",
        kind: "file",
        remoteId: "file-daily",
        size: 5,
        mtime: 1700000001000
      },
      {
        relativePath: "Root.md",
        kind: "file",
        remoteId: "file-root",
        size: 4,
        mtime: 1700000000000
      }
    ]);
    expect(calls.map((args) => args.slice(0, 3))).toEqual([
      ["drive", "files", "list"],
      ["drive", "files", "list"]
    ]);
  });

  it("deduplicates Drive files by mirror path and keeps the newest token", async () => {
    const context = createLarkGatewayContext({
      runCli: async () => ({
        data: {
          files: [
            { name: "Daily.md", token: "new-file", type: "file", modified_time: "1700000002" },
            { name: "Daily.md", token: "old-file", type: "file", modified_time: "1700000001" },
            { name: "Other.md", token: "other-file", type: "file", modified_time: "1700000000" }
          ]
        }
      })
    });

    await expect(listLarkRawMirrorResources(context, "root")).resolves.toEqual([
      {
        relativePath: "Daily.md",
        kind: "file",
        remoteId: "new-file",
        mtime: 1700000002000
      },
      {
        relativePath: "Other.md",
        kind: "file",
        remoteId: "other-file",
        mtime: 1700000000000
      }
    ]);
  });

  it("treats a missing remote scope as the Drive root folder", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      runCli: async (_context, args) => {
        calls.push(args);
        const params = readParams(args);

        if (params[folderTokenKey()] === undefined) {
          return {
            data: {
              files: [
                { name: "Root.md", token: "file-root", type: "file", modified_time: "1700000000" }
              ]
            }
          };
        }

        throw new Error("Unexpected folder list");
      }
    });

    await expect(listLarkRawMirrorResources(context, "")).resolves.toEqual([
      {
        relativePath: "Root.md",
        kind: "file",
        remoteId: "file-root",
        mtime: 1700000000000
      }
    ]);
    expect(readParams(calls[0])[folderTokenKey()]).toBeUndefined();
  });

  it("lists immediate Drive folders for remote scope selection", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      runCli: async (_context, args) => {
        calls.push(args);
        const params = readParams(args);

        expect(params[folderTokenKey()]).toBe("root");
        return {
          data: {
            files: [
              { name: "Notes", token: "folder-notes", type: "folder", url: "https://example.com/folder" },
              { name: "Daily.md", token: "file-daily", type: "file" },
              { name: "../skip", token: "folder-skip", type: "folder" }
            ]
          }
        };
      }
    });

    await expect(listLarkDriveFolders(context, new URLSearchParams({ remoteScopeId: "root" }))).resolves.toEqual({
      ok: true,
      folders: [
        {
          name: "Notes",
          token: "folder-notes",
          url: "https://example.com/folder"
        }
      ]
    });
    expect(calls).toHaveLength(1);
  });

  it("creates a Drive folder under the selected remote scope", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      runCli: async (_context, args) => {
        calls.push(args);

        if (args.includes("create_folder")) {
          return { data: { token: "created-folder" } };
        }

        throw new Error("Unexpected CLI command");
      }
    });

    await expect(createLarkDriveFolder(context, {
      parentToken: "root",
      name: "Typora Plus"
    })).resolves.toEqual({
      ok: true,
      name: "Typora Plus",
      token: "created-folder"
    });
    expect(calls.map(readData)).toEqual([
      {
        [folderTokenKey()]: "root",
        name: "Typora Plus"
      }
    ]);
  });

  it("creates a Drive folder under the root scope with an empty folder token", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      runCli: async (_context, args) => {
        calls.push(args);

        if (args.includes("create_folder")) {
          return { data: { token: "created-root-folder" } };
        }

        throw new Error("Unexpected CLI command");
      }
    });

    await expect(createLarkDriveFolder(context, {
      name: "Typora Plus"
    })).resolves.toEqual({
      ok: true,
      name: "Typora Plus",
      token: "created-root-folder"
    });
    expect(calls.map(readData)).toEqual([
      {
        [folderTokenKey()]: "",
        name: "Typora Plus"
      }
    ]);
  });

  it("creates missing Drive folders one segment at a time", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      runCli: async (_context, args) => {
        calls.push(args);

        if (args.includes("list")) {
          return { data: { files: [] } };
        }

        if (args.includes("create_folder")) {
          const data = readData(args);
          return { data: { token: `created-${data.name}` } };
        }

        throw new Error("Unexpected CLI command");
      }
    });

    await expect(ensureLarkDriveFolderPath(context, "root", ["notes", "daily"])).resolves.toBe("created-daily");
    expect(calls.filter((args) => args.includes("create_folder")).map(readData)).toEqual([
      {
        [folderTokenKey()]: "root",
        name: "notes"
      },
      {
        [folderTokenKey()]: "created-notes",
        name: "daily"
      }
    ]);
  });

  it("overwrites existing Drive file content in place instead of deleting and recreating it", async () => {
    const calls = [];
    const tempRoot = await mkdtemp(join(tmpdir(), "typora-plus-lark-test-"));
    tempRoots.push(tempRoot);
    const context = createLarkGatewayContext({
      maxFileBytes: 1024,
      runCli: async (_context, args, options = {}) => {
        calls.push(args);

        if (args.includes("list")) {
          const params = readParams(args);

          if (params[folderTokenKey()] === "root") {
            return {
              data: {
                files: [
                  { name: "notes", token: "folder-notes", type: "folder" }
                ]
              }
            };
          }

          if (params[folderTokenKey()] === "folder-notes") {
            return {
              data: {
                files: [
                  { name: "Daily.md", token: "old-file", type: "file" }
                ]
              }
            };
          }
        }

        if (args.includes("+upload")) {
          const fileIndex = args.indexOf("--file");
          expect(args[fileIndex + 1]).toBe("Daily.md");
          expect(args).toContain("--file-token");
          expect(args).toContain("old-file");
          expect(args).not.toContain("--folder-token");
          expect(options.cwd).toBeTruthy();
          const uploadedContent = await readFile(join(options.cwd, args[fileIndex + 1]), "utf8");
          expect(uploadedContent).toBe("Hello");
          return { ok: true };
        }

        throw new Error(`Unexpected CLI command: ${args.join(" ")}`);
      }
    });
    const searchParams = new URLSearchParams({
      remoteScopeId: "root",
      path: "notes/Daily.md"
    });

    await expect(uploadLarkRawMirrorFile(context, searchParams, {
      operation: {
        relativePath: "notes/Daily.md"
      },
      resource: {
        relativePath: "notes/Daily.md"
      },
      content: {
        value: Buffer.from("Hello", "utf8").toString("base64"),
        encoding: "base64"
      }
    })).resolves.toEqual({
      ok: true,
      remoteId: "old-file"
    });
    expect(calls.some((args) => args.includes("+delete"))).toBe(false);
    expect(calls.some((args) => args.includes("+upload") && args.includes("--file-token") && args.includes("old-file"))).toBe(true);
  });

  it("retries stale file-token uploads against the current Drive file for the same path", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      maxFileBytes: 1024,
      runCli: async (_context, args, options = {}) => {
        calls.push(args);

        if (args.includes("list")) {
          return {
            data: {
              files: [
                { name: "Daily.md", token: "current-file", type: "file" }
              ]
            }
          };
        }

        if (args.includes("+upload")) {
          expect(options.cwd).toBeTruthy();

          if (args.includes("stale-file")) {
            throw new Error("value is invalid");
          }

          expect(args).toContain("--file-token");
          expect(args).toContain("current-file");
          return { ok: true };
        }

        throw new Error(`Unexpected CLI command: ${args.join(" ")}`);
      }
    });
    const searchParams = new URLSearchParams({
      remoteScopeId: "root",
      path: "Daily.md",
      remoteId: "stale-file"
    });

    await expect(uploadLarkRawMirrorFile(context, searchParams, {
      operation: {
        relativePath: "Daily.md",
        remoteId: "stale-file"
      },
      resource: {
        relativePath: "Daily.md"
      },
      content: {
        value: Buffer.from("Hello", "utf8").toString("base64"),
        encoding: "base64"
      }
    })).resolves.toEqual({
      ok: true,
      remoteId: "current-file"
    });
    expect(calls.filter((args) => args.includes("+upload"))).toHaveLength(2);
    expect(calls.some((args) => args.includes("+delete"))).toBe(false);
  });

  it("uploads a file below a new folder under the Drive root scope", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      maxFileBytes: 1024,
      runCli: async (_context, args) => {
        calls.push(args);

        if (args.includes("list")) {
          const params = readParams(args);

          if (params[folderTokenKey()] === undefined) {
            return { data: { files: [] } };
          }

          if (params[folderTokenKey()] === "created-root-notes") {
            return { data: { files: [] } };
          }
        }

        if (args.includes("create_folder")) {
          const data = readData(args);
          expect(data).toEqual({
            [folderTokenKey()]: "",
            name: "notes"
          });
          return { data: { token: "created-root-notes" } };
        }

        if (args.includes("+upload")) {
          return { data: { token: "uploaded-root-file" } };
        }

        throw new Error(`Unexpected CLI command: ${args.join(" ")}`);
      }
    });
    const searchParams = new URLSearchParams({
      path: "notes/Daily.md"
    });

    await expect(uploadLarkRawMirrorFile(context, searchParams, {
      operation: {
        relativePath: "notes/Daily.md"
      },
      resource: {
        relativePath: "notes/Daily.md"
      },
      content: {
        value: Buffer.from("Hello", "utf8").toString("base64"),
        encoding: "base64"
      }
    })).resolves.toEqual({
      ok: true,
      remoteId: "uploaded-root-file"
    });
    expect(calls.some((args) => args.includes("+upload") && args.includes("--folder-token") && args.includes("created-root-notes"))).toBe(true);
  });

  it("uploads nested files under the selected remote scope", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      maxFileBytes: 1024,
      runCli: async (_context, args) => {
        calls.push(args);

        if (args.includes("list")) {
          const params = readParams(args);

          if (params[folderTokenKey()] === "folder-typora-plus" || params[folderTokenKey()] === "created-bbb") {
            return { data: { files: [] } };
          }
        }

        if (args.includes("create_folder")) {
          const data = readData(args);
          expect(data).toEqual({
            [folderTokenKey()]: "folder-typora-plus",
            name: "bbb"
          });
          return { data: { token: "created-bbb" } };
        }

        if (args.includes("+upload")) {
          return { data: { token: "uploaded-bbb-file" } };
        }

        throw new Error(`Unexpected CLI command: ${args.join(" ")}`);
      }
    });
    const searchParams = new URLSearchParams({
      remoteScopeId: "folder-typora-plus",
      path: "bbb/bbb.md"
    });

    await expect(uploadLarkRawMirrorFile(context, searchParams, {
      operation: {
        relativePath: "bbb/bbb.md"
      },
      resource: {
        relativePath: "bbb/bbb.md",
        kind: "file"
      },
      content: {
        value: Buffer.from("Hello", "utf8").toString("base64"),
        encoding: "base64"
      }
    })).resolves.toEqual({
      ok: true,
      remoteId: "uploaded-bbb-file"
    });

    expect(calls.filter((args) => args.includes("create_folder")).map(readData)).toEqual([
      {
        [folderTokenKey()]: "folder-typora-plus",
        name: "bbb"
      }
    ]);
    expect(calls.some((args) =>
      args.includes("+upload") &&
      args.includes("--folder-token") &&
      args.includes("created-bbb")
    )).toBe(true);
  });

  it("uploads a file to the Drive root without sending an empty folder token", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      maxFileBytes: 1024,
      runCli: async (_context, args) => {
        calls.push(args);

        if (args.includes("list")) {
          const params = readParams(args);

          if (params[folderTokenKey()] === undefined) {
            return { data: { files: [] } };
          }
        }

        if (args.includes("+upload")) {
          return { data: { token: "uploaded-root-file" } };
        }

        throw new Error(`Unexpected CLI command: ${args.join(" ")}`);
      }
    });
    const searchParams = new URLSearchParams({
      path: "Daily.md"
    });

    await expect(uploadLarkRawMirrorFile(context, searchParams, {
      operation: {
        relativePath: "Daily.md"
      },
      resource: {
        relativePath: "Daily.md",
        kind: "file"
      },
      content: {
        value: Buffer.from("Hello", "utf8").toString("base64"),
        encoding: "base64"
      }
    })).resolves.toEqual({
      ok: true,
      remoteId: "uploaded-root-file"
    });
    const uploadCall = calls.find((args) => args.includes("+upload"));
    expect(uploadCall).toBeTruthy();
    expect(uploadCall.includes("--folder-token")).toBe(false);
  });

  it("ensures a raw mirror directory resource without requiring file content", async () => {
    const calls = [];
    const context = createLarkGatewayContext({
      maxFileBytes: 1024,
      runCli: async (_context, args) => {
        calls.push(args);

        if (args.includes("list")) {
          const params = readParams(args);

          if (params[folderTokenKey()] === "root") {
            return { data: { files: [] } };
          }
        }

        if (args.includes("create_folder")) {
          const data = readData(args);
          return { data: { token: `created-${data.name}` } };
        }

        throw new Error(`Unexpected CLI command: ${args.join(" ")}`);
      }
    });
    const searchParams = new URLSearchParams({
      remoteScopeId: "root",
      path: "notes"
    });

    await expect(uploadLarkRawMirrorFile(context, searchParams, {
      operation: {
        relativePath: "notes"
      },
      resource: {
        relativePath: "notes",
        kind: "directory"
      }
    })).resolves.toEqual({
      ok: true,
      remoteId: "created-notes"
    });
    expect(calls.some((args) => args.includes("+upload"))).toBe(false);
    expect(calls.filter((args) => args.includes("create_folder")).map(readData)).toEqual([
      {
        [folderTokenKey()]: "root",
        name: "notes"
      }
    ]);
  });
});

function readParams(args) {
  return JSON.parse(args[args.indexOf("--params") + 1]);
}

function readData(args) {
  return JSON.parse(args[args.indexOf("--data") + 1]);
}

function folderTokenKey() {
  return ["folder", "token"].join("_");
}

function createResponseRecorder() {
  return {
    statusCode: 0,
    headers: {},
    body: "",
    setHeader(name, value) {
      this.headers[name] = value;
    },
    end(value = "") {
      this.body = value;
    }
  };
}
