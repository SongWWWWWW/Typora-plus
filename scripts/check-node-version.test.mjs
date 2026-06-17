import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  compareNodeVersions,
  isNodeVersionCompatible,
  parseMinimumNodeEngine,
  parseNodeVersion,
  readNodeEngineRange,
  runNodeVersionCheckCli
} from "./check-node-version.mjs";

const tempRoots = [];

afterEach(async () => {
  await Promise.all(tempRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })));
});

describe("node version check", () => {
  it("reads the node engine range from package json", async () => {
    const root = await mkdtemp(join(tmpdir(), "typora-plus-node-check-"));
    tempRoots.push(root);
    const packageJsonPath = join(root, "package.json");
    await writeFile(packageJsonPath, JSON.stringify({ engines: { node: ">=22.12.0" } }));

    await expect(readNodeEngineRange(packageJsonPath)).resolves.toBe(">=22.12.0");
  });

  it("parses supported engine ranges and node versions", () => {
    expect(parseMinimumNodeEngine(">=22.12.0")).toEqual({ major: 22, minor: 12, patch: 0 });
    expect(parseMinimumNodeEngine(">= 22.12.0")).toEqual({ major: 22, minor: 12, patch: 0 });
    expect(parseNodeVersion("v22.12.0")).toEqual({ major: 22, minor: 12, patch: 0 });
    expect(parseNodeVersion("22.13.1")).toEqual({ major: 22, minor: 13, patch: 1 });
  });

  it("compares node versions by major, minor, and patch", () => {
    expect(compareNodeVersions(parseNodeVersion("v22.12.0"), parseNodeVersion("v22.12.0"))).toBe(0);
    expect(compareNodeVersions(parseNodeVersion("v22.13.0"), parseNodeVersion("v22.12.9"))).toBeGreaterThan(0);
    expect(compareNodeVersions(parseNodeVersion("v21.99.99"), parseNodeVersion("v22.0.0"))).toBeLessThan(0);
  });

  it("checks compatibility against the package engine range", () => {
    expect(isNodeVersionCompatible("v22.12.0", ">=22.12.0")).toBe(true);
    expect(isNodeVersionCompatible("v23.0.0", ">=22.12.0")).toBe(true);
    expect(isNodeVersionCompatible("v22.11.9", ">=22.12.0")).toBe(false);
  });

  it("reports successful cli checks through the injected output boundary", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runNodeVersionCheckCli({
      nodeVersion: "v22.12.0",
      readRange: async () => ">=22.12.0",
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual(["Node v22.12.0 satisfies engines.node >=22.12.0."]);
    expect(errors).toEqual([]);
  });

  it("reports failing cli checks with a nonzero exit code", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runNodeVersionCheckCli({
      nodeVersion: "v22.11.9",
      readRange: async () => ">=22.12.0",
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual(["Node v22.11.9 does not satisfy engines.node >=22.12.0."]);
  });

  it("fails unsupported engine ranges explicitly", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runNodeVersionCheckCli({
      nodeVersion: "v22.12.0",
      readRange: async () => "^22.12.0",
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual(["Unsupported engines.node range: ^22.12.0"]);
  });
});
