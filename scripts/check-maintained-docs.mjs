import { readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultWorkspaceRoot = fileURLToPath(new URL("..", import.meta.url));
export const maintainedDocumentationFiles = Object.freeze([
  "README.md",
  "docs/ARCHITECTURE.md",
  "docs/DEVELOPMENT_LOG.md"
]);
export const skippedDocumentationDirectories = Object.freeze([
  ".git",
  ".vite",
  "coverage",
  "dist",
  "dist-electron",
  "node_modules",
  "out"
]);
export const documentationExtensions = Object.freeze([".md", ".mdx"]);

export async function readDirEntries(path) {
  return readdir(path, { withFileTypes: true });
}

export async function findDocumentationScopeMismatches({
  allowedFiles = maintainedDocumentationFiles,
  readDir = readDirEntries,
  workspaceRoot = defaultWorkspaceRoot
} = {}) {
  const documentationFiles = await findDocumentationFiles({
    readDir,
    workspaceRoot
  });
  const allowed = new Set(allowedFiles.map(normalizeRelativePath));
  const existing = new Set(documentationFiles);

  const missing = [...allowed]
    .filter((file) => !existing.has(file))
    .map((file) => `Missing maintained documentation file: ${file}.`);
  const unexpected = documentationFiles
    .filter((file) => !allowed.has(file))
    .map((file) => `Unexpected documentation file: ${file}. Keep maintained docs limited to ${[...allowed].join(", ")}.`);

  return [...missing, ...unexpected];
}

export async function findDocumentationFiles({
  readDir = readDirEntries,
  workspaceRoot = defaultWorkspaceRoot
} = {}) {
  const root = resolve(workspaceRoot);
  const files = [];

  await walkDocumentationFiles({
    files,
    readDir,
    root,
    targetPath: root
  });

  return files.sort((left, right) => left.localeCompare(right));
}

async function walkDocumentationFiles({ files, readDir, root, targetPath }) {
  const entries = await readDir(targetPath);

  for (const entry of entries) {
    const entryPath = resolve(targetPath, entry.name);
    const relativePath = normalizeRelativePath(relative(root, entryPath));

    if (entry.isDirectory()) {
      if (!shouldSkipDirectory(entry.name)) {
        await walkDocumentationFiles({
          files,
          readDir,
          root,
          targetPath: entryPath
        });
      }

      continue;
    }

    if (entry.isFile() && isDocumentationFile(entry.name)) {
      files.push(relativePath);
    }
  }
}

export function isDocumentationFile(path) {
  return documentationExtensions.some((extension) => path.toLowerCase().endsWith(extension));
}

export function shouldSkipDirectory(name) {
  return skippedDocumentationDirectories.includes(name);
}

function normalizeRelativePath(path) {
  return path.replaceAll("\\", "/");
}

export async function runMaintainedDocsCheckCli({
  findMismatches = findDocumentationScopeMismatches,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  let mismatches;

  try {
    mismatches = await findMismatches();
  } catch (error) {
    writeError(error instanceof Error ? error.message : String(error));

    return 1;
  }

  if (mismatches.length > 0) {
    writeError("Maintained documentation presence/scope check failed:");

    for (const mismatch of mismatches) {
      writeError(`- ${mismatch}`);
    }

    return 1;
  }

  writeOutput("Maintained documentation presence/scope check passed.");

  return 0;
}

async function runCli() {
  process.exitCode = await runMaintainedDocsCheckCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
