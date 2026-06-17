import { describe, expect, it } from "vitest";
import { resolve } from "node:path";
import {
  findDocumentationFiles,
  findDocumentationScopeMismatches,
  isDocumentationFile,
  runMaintainedDocsCheckCli,
  shouldSkipDirectory
} from "./check-maintained-docs.mjs";

function createDirent(name, kind) {
  return {
    isDirectory: () => kind === "directory",
    isFile: () => kind === "file",
    name
  };
}

function createReadDir(tree) {
  return async (path) => {
    const normalizedPath = normalizeFakePath(path);
    const entries = tree.get(normalizedPath);

    if (!entries) {
      throw new Error(`Unexpected readdir path: ${normalizedPath}`);
    }

    return entries;
  };
}

function normalizeFakePath(path) {
  return String(path).replaceAll("\\", "/").replace(/^\.$/, "").replace(/^\.\//, "");
}

const fakeWorkspaceRoot = normalizeFakePath(resolve("fake-workspace"));

function workspacePath(path = "") {
  return path ? `${fakeWorkspaceRoot}/${path}` : fakeWorkspaceRoot;
}

describe("maintained documentation check", () => {
  it("recognizes Markdown documentation extensions case-insensitively", () => {
    expect(isDocumentationFile("README.md")).toBe(true);
    expect(isDocumentationFile("guide.MDX")).toBe(true);
    expect(isDocumentationFile("notes.txt")).toBe(false);
  });

  it("skips generated and dependency directories", () => {
    expect(shouldSkipDirectory(".vite")).toBe(true);
    expect(shouldSkipDirectory("coverage")).toBe(true);
    expect(shouldSkipDirectory("node_modules")).toBe(true);
    expect(shouldSkipDirectory("out")).toBe(true);
    expect(shouldSkipDirectory("dist")).toBe(true);
    expect(shouldSkipDirectory("docs")).toBe(false);
  });

  it("finds documentation files recursively in deterministic order", async () => {
    const tree = new Map([
      [workspacePath(), [
        createDirent("packages", "directory"),
        createDirent("README.md", "file"),
        createDirent("docs", "directory"),
        createDirent("node_modules", "directory")
      ]],
      [workspacePath("docs"), [
        createDirent("DEVELOPMENT_LOG.md", "file"),
        createDirent("ARCHITECTURE.md", "file")
      ]],
      [workspacePath("packages"), [
        createDirent("editor", "directory")
      ]],
      [workspacePath("packages/editor"), [
        createDirent("NOTES.mdx", "file")
      ]]
    ]);

    await expect(findDocumentationFiles({
      readDir: createReadDir(tree),
      workspaceRoot: fakeWorkspaceRoot
    })).resolves.toEqual([
      "docs/ARCHITECTURE.md",
      "docs/DEVELOPMENT_LOG.md",
      "packages/editor/NOTES.mdx",
      "README.md"
    ]);
  });

  it("ignores documentation files inside generated directories", async () => {
    const tree = new Map([
      [workspacePath(), [
        createDirent("README.md", "file"),
        createDirent("coverage", "directory"),
        createDirent("docs", "directory"),
        createDirent("out", "directory")
      ]],
      [workspacePath("docs"), [
        createDirent("ARCHITECTURE.md", "file"),
        createDirent("DEVELOPMENT_LOG.md", "file")
      ]]
    ]);

    await expect(findDocumentationFiles({
      readDir: createReadDir(tree),
      workspaceRoot: fakeWorkspaceRoot
    })).resolves.toEqual([
      "docs/ARCHITECTURE.md",
      "docs/DEVELOPMENT_LOG.md",
      "README.md"
    ]);
  });

  it("passes when only maintained docs exist", async () => {
    const tree = new Map([
      [workspacePath(), [
        createDirent("README.md", "file"),
        createDirent("docs", "directory")
      ]],
      [workspacePath("docs"), [
        createDirent("ARCHITECTURE.md", "file"),
        createDirent("DEVELOPMENT_LOG.md", "file")
      ]]
    ]);

    await expect(findDocumentationScopeMismatches({
      readDir: createReadDir(tree),
      workspaceRoot: fakeWorkspaceRoot
    })).resolves.toEqual([]);
  });

  it("reports unexpected docs outside the maintained set", async () => {
    const tree = new Map([
      [workspacePath(), [
        createDirent("README.md", "file"),
        createDirent("docs", "directory"),
        createDirent("CHANGELOG.md", "file")
      ]],
      [workspacePath("docs"), [
        createDirent("ARCHITECTURE.md", "file"),
        createDirent("DEVELOPMENT_LOG.md", "file"),
        createDirent("AI.md", "file")
      ]]
    ]);

    await expect(findDocumentationScopeMismatches({
      readDir: createReadDir(tree),
      workspaceRoot: fakeWorkspaceRoot
    })).resolves.toEqual([
      "Unexpected documentation file: CHANGELOG.md. Keep maintained docs limited to README.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT_LOG.md.",
      "Unexpected documentation file: docs/AI.md. Keep maintained docs limited to README.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT_LOG.md."
    ]);
  });

  it("reports missing maintained docs before unexpected docs", async () => {
    const tree = new Map([
      [workspacePath(), [
        createDirent("README.md", "file"),
        createDirent("docs", "directory"),
        createDirent("CHANGELOG.md", "file")
      ]],
      [workspacePath("docs"), [
        createDirent("ARCHITECTURE.md", "file")
      ]]
    ]);

    await expect(findDocumentationScopeMismatches({
      readDir: createReadDir(tree),
      workspaceRoot: fakeWorkspaceRoot
    })).resolves.toEqual([
      "Missing maintained documentation file: docs/DEVELOPMENT_LOG.md.",
      "Unexpected documentation file: CHANGELOG.md. Keep maintained docs limited to README.md, docs/ARCHITECTURE.md, docs/DEVELOPMENT_LOG.md."
    ]);
  });

  it("reports cli success through injected output", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runMaintainedDocsCheckCli({
      findMismatches: async () => [],
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual(["Maintained documentation presence/scope check passed."]);
    expect(errors).toEqual([]);
  });

  it("reports cli failure with unexpected doc details", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runMaintainedDocsCheckCli({
      findMismatches: async () => ["Unexpected documentation file: docs/AI.md."],
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual([
      "Maintained documentation presence/scope check failed:",
      "- Unexpected documentation file: docs/AI.md."
    ]);
  });
});
