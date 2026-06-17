import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultWorkspaceRoot = fileURLToPath(new URL("..", import.meta.url));
export const defaultScanRoots = Object.freeze(["apps", "packages", "scripts"]);
export const defaultSkippedFiles = Object.freeze([
  "scripts/check-sensitive-hardcodes.mjs",
  "scripts/check-sensitive-hardcodes.test.mjs"
]);
export const defaultSkippedDirectories = Object.freeze([
  ".git",
  ".vite",
  "coverage",
  "dist",
  "dist-electron",
  "node_modules",
  "out"
]);
export const defaultScannedExtensions = Object.freeze([
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsx",
  ".mjs",
  ".ts",
  ".tsx"
]);
export const ignoredModelLiteralValues = Object.freeze(["Model", "\u6a21\u578b"]);

export const sensitiveHardcodePatterns = [
  {
    id: "provider-url",
    pattern: /https?:\/\/[^"'\s]*(?:openai|feishu|lark)[^"'\s]*/gi
  },
  {
    id: "openai-api-key",
    pattern: /sk-[A-Za-z0-9_-]{20,}/g
  },
  {
    id: "google-api-key",
    pattern: /\bAIza[A-Za-z0-9_-]{35}\b/g
  },
  {
    id: "npm-token",
    pattern: /\bnpm_[A-Za-z0-9]{36}\b/g
  },
  {
    id: "stripe-secret-key",
    pattern: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g
  },
  {
    id: "slack-token",
    pattern: /xox[baprs]-[A-Za-z0-9-]{20,}/g
  },
  {
    id: "github-token",
    pattern: /\b(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})\b/g
  },
  {
    id: "aws-access-key-id",
    pattern: /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g
  },
  {
    id: "azure-storage-account-key",
    pattern: /\bAccountKey=[A-Za-z0-9+/]{80,}={0,2}(?=;|["'\s]|$)/g
  },
  {
    id: "azure-storage-sas-token",
    pattern: /(?:[?&]|SharedAccessSignature=)(?=[A-Za-z0-9%._~+&=:/-]*\bsv=[A-Za-z0-9._~-]+)(?=[A-Za-z0-9%._~+&=:/-]*\bsig=[A-Za-z0-9%._~+/-]{32,})[A-Za-z0-9%._~+&=:/-]+/g
  },
  {
    id: "jwt-token",
    pattern: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
  },
  {
    id: "bearer-token",
    pattern: /\bBearer\s+(?!eyJ)[A-Za-z0-9._~+/-]{32,}={0,2}(?![A-Za-z0-9._~+/-])/g
  },
  {
    id: "basic-auth-token",
    pattern: /\bBasic\s+[A-Za-z0-9+/]{24,}={0,2}(?![A-Za-z0-9+/=])/g
  },
  {
    id: "url-embedded-credentials",
    pattern: /\b(?:https?|wss?|postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|redis):\/\/[A-Za-z0-9._~%!$&()*+,;=-]+:[A-Za-z0-9._~%!$&()*+,;=-]{12,}@[A-Za-z0-9.-]+(?::\d+)?(?:[/?#][^"'\s]*)?/g
  },
  {
    id: "secret-field-literal",
    pattern: /\b(?:apiKey|api_key|secret|password|token|accessToken|access_token|refreshToken|refresh_token|clientSecret|client_secret)\s*[:=]\s*["']([A-Za-z0-9._~+/-]{32,}={0,2})["']/g,
    shouldReport: ({ match }) => !isSpecificCredentialLiteral(match[1])
  },
  {
    id: "pem-private-key",
    pattern: /-----BEGIN (?:[A-Z0-9]+ )*PRIVATE KEY-----/g
  },
  {
    id: "provider-secret-name",
    pattern: /\b(app_secret|tenant_access_token|folder_token)\b/gi
  },
  {
    id: "provider-identifier-literal",
    pattern: /\b(?:appId|app_id|clientId|client_id|folderId|folder_id|tenantId|tenant_id|tenantKey|tenant_key)\s*[:=]\s*["']([^"'\s]+)["']/g
  },
  {
    id: "model-literal",
    pattern: /\b(?:model|modelId|model_id|defaultModel|default_model)\s*[:=]\s*["']([^"'\s]+)["']/g,
    shouldReport: ({ file, match }) => {
      if (isSensitiveHardcodeTestFile(file)) {
        return false;
      }

      return !ignoredModelLiteralValues.includes(match[1]);
    }
  }
];

export async function scanSensitiveHardcodes({
  workspaceRoot = defaultWorkspaceRoot,
  scanRoots = defaultScanRoots,
  skippedFiles = defaultSkippedFiles,
  skippedDirectories = defaultSkippedDirectories,
  scannedExtensions = defaultScannedExtensions
} = {}) {
  const findings = [];
  const context = {
    findings,
    scannedExtensions: new Set(scannedExtensions),
    skippedFiles: new Set(skippedFiles),
    skippedDirectories: new Set(skippedDirectories),
    workspaceRoot
  };

  for (const root of scanRoots) {
    await scanDirectory(join(workspaceRoot, root), context);
  }

  return sortSensitiveHardcodeFindings(findings);
}

async function scanDirectory(directory, context) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      if (!context.skippedDirectories.has(entry.name)) {
        await scanDirectory(path, context);
      }
      continue;
    }

    if (entry.isFile() && shouldScanFile(entry.name, context.scannedExtensions)) {
      await scanFile(path, context);
    }
  }
}

export function shouldScanFile(name, scannedExtensions = defaultScannedExtensions) {
  const dotIndex = name.lastIndexOf(".");

  return dotIndex >= 0 && new Set(scannedExtensions).has(name.slice(dotIndex));
}

async function scanFile(path, context) {
  const file = relative(context.workspaceRoot, path).replace(/\\/g, "/");

  if (context.skippedFiles.has(file)) {
    return;
  }

  const text = await readFile(path, "utf8");
  context.findings.push(...findSensitiveHardcodesInText(file, text));
}

export function findSensitiveHardcodesInText(file, text, patterns = sensitiveHardcodePatterns) {
  const findings = [];

  for (const { id, pattern, shouldReport = () => true } of patterns) {
    pattern.lastIndex = 0;

    for (const match of text.matchAll(pattern)) {
      if (!shouldReport({ file, match })) {
        continue;
      }

      const position = getLineColumn(text, match.index ?? 0);
      findings.push({
        column: position.column,
        file,
        id,
        line: position.line,
        match: match[0]
      });
    }
  }

  return findings;
}

export function formatSensitiveHardcodeFinding(finding) {
  return `${finding.file}:${finding.line}:${finding.column} [${finding.id}] ${finding.match}`;
}

export function sortSensitiveHardcodeFindings(findings) {
  return [...findings].sort((a, b) => {
    const fileOrder = compareText(a.file, b.file);

    if (fileOrder !== 0) {
      return fileOrder;
    }

    const lineOrder = a.line - b.line;

    if (lineOrder !== 0) {
      return lineOrder;
    }

    const columnOrder = a.column - b.column;

    if (columnOrder !== 0) {
      return columnOrder;
    }

    const idOrder = compareText(a.id, b.id);

    if (idOrder !== 0) {
      return idOrder;
    }

    return compareText(a.match, b.match);
  });
}

export function isSensitiveHardcodeTestFile(file) {
  return /\.(smoke\.)?test\.[cm]?[jt]sx?$/.test(file);
}

function isSpecificCredentialLiteral(value) {
  return /^sk-[A-Za-z0-9_-]{20,}$/.test(value) ||
    /^AIza[A-Za-z0-9_-]{35}$/.test(value) ||
    /^npm_[A-Za-z0-9]{36}$/.test(value) ||
    /^(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}$/.test(value) ||
    /^xox[baprs]-[A-Za-z0-9-]{20,}$/.test(value) ||
    /^(?:github_pat_[A-Za-z0-9_]{20,}|gh[pousr]_[A-Za-z0-9_]{20,})$/.test(value) ||
    /^(?:AKIA|ASIA)[A-Z0-9]{16}$/.test(value) ||
    /^eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}$/.test(value);
}

function compareText(left, right) {
  if (left < right) {
    return -1;
  }

  if (left > right) {
    return 1;
  }

  return 0;
}

export function getLineColumn(text, index) {
  let line = 1;
  let column = 1;

  for (let cursor = 0; cursor < index; cursor += 1) {
    if (text.charCodeAt(cursor) === 10) {
      line += 1;
      column = 1;
    } else {
      column += 1;
    }
  }

  return { column, line };
}

export async function runSensitiveHardcodeScanCli({
  scan = scanSensitiveHardcodes,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  const findings = sortSensitiveHardcodeFindings(await scan());

  if (findings.length > 0) {
    writeError("Sensitive hardcode scan failed:");

    for (const finding of findings) {
      writeError(formatSensitiveHardcodeFinding(finding));
    }

    return 1;
  }

  writeOutput("Sensitive hardcode scan passed.");

  return 0;
}

async function runCli() {
  process.exitCode = await runSensitiveHardcodeScanCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
