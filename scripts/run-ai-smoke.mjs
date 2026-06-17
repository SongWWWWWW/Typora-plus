import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  findMissingEnvironmentGroups,
  formatEnvironmentGroup,
  runVitestSmokeTest
} from "./smoke-runner.mjs";

export const defaultWorkspaceRoot = fileURLToPath(new URL("..", import.meta.url));
export const defaultVitestEntryPath = join(defaultWorkspaceRoot, "node_modules", "vitest", "vitest.mjs");
export const defaultAiSmokeTestPath = "packages/platform/src/responsesAiProvider.smoke.test.ts";
export const aiSmokeEnvironmentLimits = Object.freeze({
  apiKeyBytes: 64 * 1024,
  endpointUrlLength: 2000,
  modelLength: 120
});

export const aiSmokeEnvironmentGroups = Object.freeze([
  {
    label: "Responses endpoint URL",
    names: Object.freeze([
      "TYPORA_PLUS_AI_SMOKE_ENDPOINT_URL",
      "CODEX_RESPONSES_URL",
      "CODEX_URL"
    ])
  },
  {
    label: "API key",
    names: Object.freeze([
      "TYPORA_PLUS_AI_SMOKE_API_KEY",
      "CODEX_API_KEY",
      "CODEX_KEY"
    ])
  },
  {
    label: "model",
    names: Object.freeze([
      "TYPORA_PLUS_AI_SMOKE_MODEL",
      "CODEX_MODEL"
    ])
  }
]);

export function findMissingAiSmokeEnvironment({
  environment = process.env,
  groups = aiSmokeEnvironmentGroups
} = {}) {
  return findMissingEnvironmentGroups({ environment, groups });
}

export function formatAiSmokeEnvironmentGroup(group) {
  return formatEnvironmentGroup(group);
}

export function findInvalidAiSmokeEnvironment({ environment = process.env } = {}) {
  const issues = [];
  const endpointUrl = readFirstAiSmokeEnvironmentValue(environment, aiSmokeEnvironmentGroups[0]);
  const apiKey = readFirstAiSmokeEnvironmentValue(environment, aiSmokeEnvironmentGroups[1]);
  const model = readFirstAiSmokeEnvironmentValue(environment, aiSmokeEnvironmentGroups[2]);
  const endpointIssue = endpointUrl === undefined ? undefined : validateAiSmokeEndpointUrl(endpointUrl);
  const apiKeyIssue = apiKey === undefined ? undefined : validateAiSmokeApiKey(apiKey);
  const modelIssue = model === undefined ? undefined : validateAiSmokeModel(model);

  if (endpointIssue) {
    issues.push(endpointIssue);
  }

  if (apiKeyIssue) {
    issues.push(apiKeyIssue);
  }

  if (modelIssue) {
    issues.push(modelIssue);
  }

  return issues;
}

export async function runAiSmokeCli({
  environment = process.env,
  nodeExecutable = process.execPath,
  smokeTestPath = defaultAiSmokeTestPath,
  spawnProcess = spawn,
  vitestEntryPath = defaultVitestEntryPath,
  writeError = console.error,
  writeOutput = console.log
} = {}) {
  const missing = findMissingAiSmokeEnvironment({ environment });

  if (missing.length > 0) {
    writeError("AI smoke test environment is incomplete.");
    writeError("Set one variable from each required group before running the smoke test:");

    for (const group of missing) {
      writeError(`- ${formatAiSmokeEnvironmentGroup(group)}`);
    }

    return 1;
  }

  const invalid = findInvalidAiSmokeEnvironment({ environment });

  if (invalid.length > 0) {
    writeError("AI smoke test environment is invalid.");
    writeError("Fix these environment variables before running the smoke test:");

    for (const issue of invalid) {
      writeError(`- ${issue}`);
    }

    return 1;
  }

  writeOutput("Running local Responses-compatible AI smoke test.");

  return runVitestSmokeTest({
    environment,
    nodeExecutable,
    requiredEnvironmentFlag: "TYPORA_PLUS_AI_SMOKE_REQUIRED",
    smokeTestPath,
    spawnProcess,
    vitestEntryPath,
    writeError
  });
}

function readFirstAiSmokeEnvironmentValue(environment, group) {
  for (const name of group.names) {
    const value = environment[name];

    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return undefined;
}

function validateAiSmokeEndpointUrl(value) {
  if (value.length > aiSmokeEnvironmentLimits.endpointUrlLength) {
    return `Responses endpoint URL must be HTTPS or loopback HTTP and at most ${aiSmokeEnvironmentLimits.endpointUrlLength} characters`;
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || isLoopbackHttpUrl(url)) {
      return undefined;
    }
  } catch {
    // Fall through to the generic endpoint diagnostic below.
  }

  return `Responses endpoint URL must be HTTPS or loopback HTTP and at most ${aiSmokeEnvironmentLimits.endpointUrlLength} characters`;
}

function validateAiSmokeApiKey(value) {
  if (Buffer.byteLength(value, "utf8") > aiSmokeEnvironmentLimits.apiKeyBytes) {
    return `API key must be at most ${aiSmokeEnvironmentLimits.apiKeyBytes} UTF-8 bytes`;
  }

  return undefined;
}

function validateAiSmokeModel(value) {
  if (value.length > aiSmokeEnvironmentLimits.modelLength) {
    return `model must be at most ${aiSmokeEnvironmentLimits.modelLength} characters`;
  }

  return undefined;
}

function isLoopbackHttpUrl(url) {
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

async function runCli() {
  process.exitCode = await runAiSmokeCli();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await runCli();
}
