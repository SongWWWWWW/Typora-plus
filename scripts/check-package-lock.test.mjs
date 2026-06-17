import { describe, expect, it } from "vitest";
import {
  findPackageLockMismatches,
  findWorkspacePackages,
  runPackageLockCheckCli,
  stableJson
} from "./check-package-lock.mjs";

function createPackageJson(overrides = {}) {
  return {
    engines: {
      node: ">=22.12.0"
    },
    name: "typora-plus",
    version: "0.1.0",
    workspaces: ["packages/*", "apps/*"],
    ...overrides
  };
}

function createWorkspacePackageJson(name, overrides = {}) {
  return {
    name,
    version: "0.1.0",
    ...overrides
  };
}

function createPackageLockRoot(packageJson = createPackageJson()) {
  return {
    name: packageJson.name,
    version: packageJson.version,
    packages: {
      "": {
        engines: packageJson.engines,
        name: packageJson.name,
        version: packageJson.version,
        workspaces: packageJson.workspaces
      }
    }
  };
}

function createWorkspaceLockPackage(packageJson) {
  const lockPackage = {};

  for (const field of [
    "name",
    "version",
    "dependencies",
    "devDependencies",
    "optionalDependencies",
    "peerDependencies",
    "engines"
  ]) {
    if (packageJson[field] !== undefined) {
      lockPackage[field] = packageJson[field];
    }
  }

  return lockPackage;
}

function createDirent(name, directory = true) {
  return {
    isDirectory: () => directory,
    name
  };
}

function createNotFoundError(path) {
  return Object.assign(new Error(`No such file: ${path}`), {
    code: "ENOENT"
  });
}

function normalizeFakePath(path) {
  return String(path).replaceAll("\\", "/").replace(/^\.\//, "");
}

describe("package lock check", () => {
  it("normalizes object key order for stable comparisons", () => {
    expect(stableJson({ b: 1, a: { d: 4, c: 3 } })).toBe(stableJson({ a: { c: 3, d: 4 }, b: 1 }));
  });

  it("passes when lockfile root and workspace metadata matches package json files", async () => {
    const packageJson = createPackageJson({
      devDependencies: {
        typescript: "^5.8.0",
        vitest: "^4.1.8"
      }
    });
    const workspacePackageJson = createWorkspacePackageJson("@typora-plus/editor", {
      dependencies: {
        "@typora-plus/markdown": "0.1.0",
        react: "^19.0.0"
      },
      peerDependencies: {
        react: ">=19"
      }
    });
    const packageLock = createPackageLockRoot(packageJson);
    packageLock.packages[""].devDependencies = {
      vitest: "^4.1.8",
      typescript: "^5.8.0"
    };
    packageLock.packages["packages/editor"] = createWorkspaceLockPackage(workspacePackageJson);

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [
        {
          packageJson: workspacePackageJson,
          path: "packages/editor"
        }
      ],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual([]);
  });

  it("reports mismatched root dependency metadata", async () => {
    const packageJson = createPackageJson({
      devDependencies: {
        vitest: "^4.1.8"
      }
    });
    const packageLock = createPackageLockRoot(packageJson);
    packageLock.packages[""].devDependencies = {
      vitest: "^4.0.0"
    };

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual([
      'package-lock.json packages[""].devDependencies does not match package.json devDependencies.'
    ]);
  });

  it("reports mismatched top-level lockfile identity metadata", async () => {
    const packageJson = createPackageJson({
      name: "typora-plus-renamed",
      version: "0.2.0"
    });
    const packageLock = createPackageLockRoot(packageJson);
    packageLock.name = "typora-plus";
    packageLock.version = "0.1.0";

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual([
      "package-lock.json.name does not match package.json name.",
      "package-lock.json.version does not match package.json version."
    ]);
  });

  it("reports mismatched root package identity metadata", async () => {
    const packageJson = createPackageJson({
      name: "typora-plus-renamed",
      version: "0.2.0"
    });
    const packageLock = createPackageLockRoot(packageJson);
    packageLock.packages[""].name = "typora-plus";
    packageLock.packages[""].version = "0.1.0";

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual([
      'package-lock.json packages[""].name does not match package.json name.',
      'package-lock.json packages[""].version does not match package.json version.'
    ]);
  });

  it("reports missing lockfile root metadata", async () => {
    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? createPackageJson() : { packages: {} })
    });

    expect(mismatches).toEqual(['package-lock.json is missing packages[""] root metadata.']);
  });

  it("reports mismatched workspace package metadata", async () => {
    const packageJson = createPackageJson();
    const workspacePackageJson = createWorkspacePackageJson("@typora-plus/editor", {
      dependencies: {
        react: "^19.0.0"
      }
    });
    const packageLock = createPackageLockRoot(packageJson);
    packageLock.packages["packages/editor"] = {
      ...createWorkspaceLockPackage(workspacePackageJson),
      dependencies: {
        react: "^18.0.0"
      },
      name: "@typora-plus/editor-old",
      version: "0.0.0"
    };

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [
        {
          packageJson: workspacePackageJson,
          path: "packages/editor"
        }
      ],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual([
      'package-lock.json packages["packages/editor"].name does not match packages/editor/package.json name.',
      'package-lock.json packages["packages/editor"].version does not match packages/editor/package.json version.',
      'package-lock.json packages["packages/editor"].dependencies does not match packages/editor/package.json dependencies.'
    ]);
  });

  it("reports missing workspace lockfile metadata", async () => {
    const packageJson = createPackageJson();
    const workspacePackageJson = createWorkspacePackageJson("@typora-plus/editor");
    const packageLock = createPackageLockRoot(packageJson);

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [
        {
          packageJson: workspacePackageJson,
          path: "packages/editor"
        }
      ],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual(['package-lock.json is missing packages["packages/editor"] workspace metadata.']);
  });

  it("reports stale workspace lockfile metadata", async () => {
    const packageJson = createPackageJson();
    const workspacePackageJson = createWorkspacePackageJson("@typora-plus/editor");
    const packageLock = createPackageLockRoot(packageJson);
    packageLock.packages["packages/editor"] = createWorkspaceLockPackage(workspacePackageJson);
    packageLock.packages["packages/old"] = createWorkspaceLockPackage(
      createWorkspacePackageJson("@typora-plus/old")
    );

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [
        {
          packageJson: workspacePackageJson,
          path: "packages/editor"
        }
      ],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual([
      'package-lock.json contains stale packages["packages/old"] workspace metadata with no matching workspace package.'
    ]);
  });

  it("does not report dependency lockfile entries as stale workspace metadata", async () => {
    const packageJson = createPackageJson();
    const workspacePackageJson = createWorkspacePackageJson("@typora-plus/editor");
    const packageLock = createPackageLockRoot(packageJson);
    packageLock.packages["packages/editor"] = createWorkspaceLockPackage(workspacePackageJson);
    packageLock.packages["node_modules/@typora-plus/editor"] = {
      link: true,
      resolved: "packages/editor"
    };
    packageLock.packages["packages/editor/node_modules/@example/local"] = {
      version: "1.0.0"
    };

    const mismatches = await findPackageLockMismatches({
      findWorkspaces: async () => [
        {
          packageJson: workspacePackageJson,
          path: "packages/editor"
        }
      ],
      packageJsonPath: "package.json",
      packageLockPath: "package-lock.json",
      readJson: async (path) => (path === "package.json" ? packageJson : packageLock)
    });

    expect(mismatches).toEqual([]);
  });

  it("discovers workspace package json files from simple globs in sorted order", async () => {
    const packageJson = createPackageJson();
    const packageJsonByPath = new Map([
      ["apps/desktop/package.json", createWorkspacePackageJson("@typora-plus/desktop")],
      ["packages/base/package.json", createWorkspacePackageJson("@typora-plus/base")],
      ["packages/editor/package.json", createWorkspacePackageJson("@typora-plus/editor")]
    ]);
    const directoryEntriesByPath = new Map([
      ["apps", [createDirent("desktop")]],
      ["packages", [
        createDirent("z-readme.md", false),
        createDirent("editor"),
        createDirent("without-package"),
        createDirent("base")
      ]]
    ]);

    const workspacePackages = await findWorkspacePackages({
      packageJson,
      readDir: async (path) => {
        const normalizedPath = normalizeFakePath(path);
        const entries = directoryEntriesByPath.get(normalizedPath);

        if (!entries) {
          throw createNotFoundError(normalizedPath);
        }

        return entries;
      },
      readJson: async (path) => {
        const normalizedPath = normalizeFakePath(path);
        const packageFile = packageJsonByPath.get(normalizedPath);

        if (!packageFile) {
          throw createNotFoundError(normalizedPath);
        }

        return packageFile;
      },
      workspaceRootPath: "."
    });

    expect(workspacePackages).toEqual([
      {
        packageJson: packageJsonByPath.get("apps/desktop/package.json"),
        path: "apps/desktop"
      },
      {
        packageJson: packageJsonByPath.get("packages/base/package.json"),
        path: "packages/base"
      },
      {
        packageJson: packageJsonByPath.get("packages/editor/package.json"),
        path: "packages/editor"
      }
    ]);
  });

  it("reports cli success through the injected output boundary", async () => {
    const output = [];
    const errors = [];

    const exitCode = await runPackageLockCheckCli({
      findMismatches: async () => [],
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual(["package-lock.json package metadata matches package.json files."]);
    expect(errors).toEqual([]);
  });

  it("reports cli failure with workspace mismatch details", async () => {
    const output = [];
    const errors = [];
    const mismatch =
      'package-lock.json packages["packages/editor"].name does not match packages/editor/package.json name.';

    const exitCode = await runPackageLockCheckCli({
      findMismatches: async () => [mismatch],
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(1);
    expect(output).toEqual([]);
    expect(errors).toEqual(["package-lock.json is out of sync with package.json:", `- ${mismatch}`]);
  });
});
