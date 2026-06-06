import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

type WorkspacePackage =
  | "@typora-plus/base"
  | "@typora-plus/platform"
  | "@typora-plus/markdown"
  | "@typora-plus/theme"
  | "@typora-plus/editor"
  | "@typora-plus/workbench"
  | "@typora-plus/desktop";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const packageByDirectory: readonly (readonly [string, WorkspacePackage])[] = [
  ["packages/base", "@typora-plus/base"],
  ["packages/platform", "@typora-plus/platform"],
  ["packages/markdown", "@typora-plus/markdown"],
  ["packages/theme", "@typora-plus/theme"],
  ["packages/editor", "@typora-plus/editor"],
  ["packages/workbench", "@typora-plus/workbench"],
  ["apps/desktop", "@typora-plus/desktop"]
];

const allowedWorkspaceImports: Readonly<Record<WorkspacePackage, readonly WorkspacePackage[]>> = {
  "@typora-plus/base": [],
  "@typora-plus/platform": ["@typora-plus/base"],
  "@typora-plus/markdown": [],
  "@typora-plus/theme": [],
  "@typora-plus/editor": ["@typora-plus/markdown"],
  "@typora-plus/workbench": [
    "@typora-plus/base",
    "@typora-plus/editor",
    "@typora-plus/markdown",
    "@typora-plus/platform",
    "@typora-plus/theme"
  ],
  "@typora-plus/desktop": [
    "@typora-plus/base",
    "@typora-plus/editor",
    "@typora-plus/markdown",
    "@typora-plus/platform",
    "@typora-plus/theme",
    "@typora-plus/workbench"
  ]
};

const sourceFileExtensions = new Set([".ts", ".tsx"]);
const sourceImportPattern = /(?:from\s+|import\s*\(\s*|import\s+)["'](@typora-plus\/[^"']+)["']/g;

describe("architecture boundaries", () => {
  it("keeps source imports inside the documented package dependency direction", () => {
    const violations: string[] = [];

    for (const filePath of listSourceFiles(repoRoot)) {
      const ownerPackage = readOwnerPackage(filePath);

      if (!ownerPackage) {
        continue;
      }

      const source = fs.readFileSync(filePath, "utf8");

      for (const importedPackage of readWorkspaceImports(source)) {
        if (isWorkspaceImportAllowed(ownerPackage, importedPackage)) {
          continue;
        }

        violations.push(`${relativePath(filePath)} imports ${importedPackage}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps package dependency declarations aligned with package boundaries", () => {
    const violations: string[] = [];

    for (const [directory, ownerPackage] of packageByDirectory) {
      const packageJsonPath = path.join(repoRoot, directory, "package.json");
      const packageJson = readJsonFile<PackageJson>(packageJsonPath);
      const dependencies = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies
      };

      for (const dependencyName of Object.keys(dependencies)) {
        const dependencyPackage = readWorkspacePackageName(dependencyName);

        if (!dependencyPackage || isWorkspaceImportAllowed(ownerPackage, dependencyPackage)) {
          continue;
        }

        violations.push(`${relativePath(packageJsonPath)} declares ${dependencyPackage}`);
      }
    }

    expect(violations).toEqual([]);
  });

  it("keeps TypeScript project references aligned with package boundaries", () => {
    const violations: string[] = [];

    for (const [directory, ownerPackage] of packageByDirectory) {
      const tsconfigPath = path.join(repoRoot, directory, "tsconfig.json");

      if (!fs.existsSync(tsconfigPath)) {
        continue;
      }

      const tsconfig = readJsonFile<TsConfig>(tsconfigPath);

      for (const reference of tsconfig.references ?? []) {
        const referencedPackage = readReferencedPackage(tsconfigPath, reference.path);

        if (!referencedPackage || isWorkspaceImportAllowed(ownerPackage, referencedPackage)) {
          continue;
        }

        violations.push(`${relativePath(tsconfigPath)} references ${referencedPackage}`);
      }
    }

    expect(violations).toEqual([]);
  });
});

interface PackageJson {
  readonly dependencies?: Readonly<Record<string, string>>;
  readonly devDependencies?: Readonly<Record<string, string>>;
  readonly peerDependencies?: Readonly<Record<string, string>>;
}

interface TsConfig {
  readonly references?: readonly TsConfigReference[];
}

interface TsConfigReference {
  readonly path: string;
}

function listSourceFiles(root: string): readonly string[] {
  const files: string[] = [];
  const ignoredDirectories = new Set([".git", "dist", "dist-electron", "node_modules"]);
  const visitDirectory = (directory: string): void => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const entryPath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) {
          visitDirectory(entryPath);
        }
        continue;
      }

      if (entry.isFile() && sourceFileExtensions.has(path.extname(entry.name))) {
        files.push(entryPath);
      }
    }
  };

  visitDirectory(root);
  return files;
}

function readWorkspaceImports(source: string): readonly WorkspacePackage[] {
  const imports: WorkspacePackage[] = [];

  for (const match of source.matchAll(sourceImportPattern)) {
    const packageName = readWorkspacePackageName(match[1] ?? "");

    if (packageName) {
      imports.push(packageName);
    }
  }

  return imports;
}

function readOwnerPackage(filePath: string): WorkspacePackage | undefined {
  const normalizedPath = normalizePath(path.relative(repoRoot, filePath));
  const owningEntry = packageByDirectory.find(([directory]) =>
    normalizedPath === directory || normalizedPath.startsWith(`${directory}/`)
  );

  return owningEntry?.[1];
}

function readReferencedPackage(tsconfigPath: string, referencePath: string): WorkspacePackage | undefined {
  const resolvedPath = normalizePath(path.relative(repoRoot, path.resolve(path.dirname(tsconfigPath), referencePath)));
  const owningEntry = packageByDirectory.find(([directory]) => resolvedPath === directory);

  return owningEntry?.[1];
}

function readWorkspacePackageName(value: string): WorkspacePackage | undefined {
  const [, packageName] = /^(@typora-plus\/[^/]+)/.exec(value) ?? [];

  if (isWorkspacePackage(packageName)) {
    return packageName;
  }

  return undefined;
}

function isWorkspacePackage(value: string | undefined): value is WorkspacePackage {
  return packageByDirectory.some(([, packageName]) => packageName === value);
}

function isWorkspaceImportAllowed(ownerPackage: WorkspacePackage, importedPackage: WorkspacePackage): boolean {
  return importedPackage === ownerPackage || allowedWorkspaceImports[ownerPackage].includes(importedPackage);
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function relativePath(filePath: string): string {
  return normalizePath(path.relative(repoRoot, filePath));
}

function normalizePath(value: string): string {
  return value.replaceAll(path.sep, "/");
}
