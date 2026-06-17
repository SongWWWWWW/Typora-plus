import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  findInvalidAiSmokeEnvironment,
  findMissingAiSmokeEnvironment,
  formatAiSmokeEnvironmentGroup,
  runAiSmokeCli
} from "./run-ai-smoke.mjs";

describe("AI smoke runner", () => {
  it("reports missing environment groups without exposing configured values", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runAiSmokeCli({
      environment: {
        CODEX_URL: "configured-endpoint",
        CODEX_API_KEY: "configured-key"
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
      "AI smoke test environment is incomplete.",
      "Set one variable from each required group before running the smoke test:",
      "- model: TYPORA_PLUS_AI_SMOKE_MODEL or CODEX_MODEL"
    ]);
    expect(errors.join("\n")).not.toContain("configured-key");
    expect(errors.join("\n")).not.toContain("configured-endpoint");
  });

  it("runs the Responses smoke test when endpoint, key, and model are configured", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const exitCode = await runAiSmokeCli({
      environment: {
        CODEX_URL: "http://127.0.0.1:11434/v1/responses",
        CODEX_KEY: "configured-key",
        CODEX_MODEL: "configured-model"
      },
      nodeExecutable: "node",
      smokeTestPath: "packages/platform/src/responsesAiProvider.smoke.test.ts",
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      vitestEntryPath: "node_modules/vitest/vitest.mjs",
      writeError: (message) => errors.push(message),
      writeOutput: (message) => output.push(message)
    });

    expect(exitCode).toBe(0);
    expect(output).toEqual(["Running local Responses-compatible AI smoke test."]);
    expect(errors).toEqual([]);
    expect(spawnCalls).toEqual([
      [
        "node",
        [
          "node_modules/vitest/vitest.mjs",
          "run",
          "packages/platform/src/responsesAiProvider.smoke.test.ts"
        ],
        {
          env: {
            CODEX_URL: "http://127.0.0.1:11434/v1/responses",
            CODEX_KEY: "configured-key",
            CODEX_MODEL: "configured-model",
            TYPORA_PLUS_AI_SMOKE_REQUIRED: "1"
          },
          stdio: "inherit"
        }
      ]
    ]);
  });

  it("propagates the spawned smoke test exit code", async () => {
    const exitCode = await runAiSmokeCli({
      environment: {
        TYPORA_PLUS_AI_SMOKE_ENDPOINT_URL: "http://localhost:11434/v1/responses",
        TYPORA_PLUS_AI_SMOKE_API_KEY: "configured-key",
        TYPORA_PLUS_AI_SMOKE_MODEL: "configured-model"
      },
      spawnProcess: () => createClosingChildProcess(7),
      writeError: () => undefined,
      writeOutput: () => undefined
    });

    expect(exitCode).toBe(7);
  });

  it("stops before spawning when configured AI smoke values are invalid", async () => {
    const output = [];
    const errors = [];
    const spawnCalls = [];
    const secret = "k".repeat(64 * 1024 + 1);
    const model = "m".repeat(121);
    const exitCode = await runAiSmokeCli({
      environment: {
        TYPORA_PLUS_AI_SMOKE_ENDPOINT_URL: "http://api.example.test/v1/responses",
        TYPORA_PLUS_AI_SMOKE_API_KEY: secret,
        TYPORA_PLUS_AI_SMOKE_MODEL: model
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
      "AI smoke test environment is invalid.",
      "Fix these environment variables before running the smoke test:",
      "- Responses endpoint URL must be HTTPS or loopback HTTP and at most 2000 characters",
      "- API key must be at most 65536 UTF-8 bytes",
      "- model must be at most 120 characters"
    ]);
    expect(errors.join("\n")).not.toContain("api.example.test");
    expect(errors.join("\n")).not.toContain(secret);
    expect(errors.join("\n")).not.toContain(model);
  });

  it("keeps environment group formatting deterministic", () => {
    const missing = findMissingAiSmokeEnvironment({
      environment: {
        CODEX_MODEL: "configured-model"
      }
    });

    expect(missing.map(formatAiSmokeEnvironmentGroup)).toEqual([
      "Responses endpoint URL: TYPORA_PLUS_AI_SMOKE_ENDPOINT_URL or CODEX_RESPONSES_URL or CODEX_URL",
      "API key: TYPORA_PLUS_AI_SMOKE_API_KEY or CODEX_API_KEY or CODEX_KEY"
    ]);
  });

  it("keeps AI smoke preflight issue ordering deterministic", () => {
    const invalid = findInvalidAiSmokeEnvironment({
      environment: {
        CODEX_URL: "ftp://provider.example.test/v1/responses",
        CODEX_API_KEY: "secret",
        CODEX_MODEL: "m".repeat(121)
      }
    });

    expect(invalid).toEqual([
      "Responses endpoint URL must be HTTPS or loopback HTTP and at most 2000 characters",
      "model must be at most 120 characters"
    ]);
  });
});

function createClosingChildProcess(exitCode) {
  const child = new EventEmitter();

  queueMicrotask(() => child.emit("close", exitCode));

  return child;
}
