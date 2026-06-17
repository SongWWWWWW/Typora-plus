import { EventEmitter } from "node:events";
import { describe, expect, it } from "vitest";
import {
  findMissingEnvironmentGroups,
  formatEnvironmentGroup,
  hasEnvironmentGroupValue,
  runSpawnedCommand,
  runVitestSmokeTest
} from "./smoke-runner.mjs";

describe("smoke runner helpers", () => {
  it("finds missing environment groups and ignores blank values", () => {
    const groups = [
      { label: "first", names: ["FIRST_VALUE", "FIRST_FALLBACK"] },
      { label: "second", names: ["SECOND_VALUE"] }
    ];

    expect(findMissingEnvironmentGroups({
      environment: {
        FIRST_VALUE: "   ",
        FIRST_FALLBACK: "configured"
      },
      groups
    })).toEqual([
      groups[1]
    ]);
    expect(hasEnvironmentGroupValue({ FIRST_VALUE: "configured" }, groups[0])).toBe(true);
    expect(hasEnvironmentGroupValue({ FIRST_VALUE: "" }, groups[0])).toBe(false);
  });

  it("formats environment groups deterministically", () => {
    expect(formatEnvironmentGroup({
      label: "required value",
      names: ["FIRST_VALUE", "SECOND_VALUE"]
    })).toBe("required value: FIRST_VALUE or SECOND_VALUE");
  });

  it("runs a vitest smoke test with the required flag injected", async () => {
    const spawnCalls = [];
    const exitCode = await runVitestSmokeTest({
      environment: {
        CONFIGURED_VALUE: "configured"
      },
      nodeExecutable: "node",
      requiredEnvironmentFlag: "SMOKE_REQUIRED",
      smokeTestPath: "packages/example.smoke.test.ts",
      spawnProcess: (...args) => {
        spawnCalls.push(args);
        return createClosingChildProcess(0);
      },
      vitestEntryPath: "node_modules/vitest/vitest.mjs",
      writeError: () => undefined
    });

    expect(exitCode).toBe(0);
    expect(spawnCalls).toEqual([
      [
        "node",
        [
          "node_modules/vitest/vitest.mjs",
          "run",
          "packages/example.smoke.test.ts"
        ],
        {
          env: {
            CONFIGURED_VALUE: "configured",
            SMOKE_REQUIRED: "1"
          },
          stdio: "inherit"
        }
      ]
    ]);
  });

  it("propagates spawn errors as failed smoke runs", async () => {
    const errors = [];
    const exitCode = await runSpawnedCommand({
      args: [],
      command: "node",
      environment: {},
      spawnProcess: () => createErroringChildProcess(new Error("spawn failed")),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual(["spawn failed"]);
  });

  it("converts synchronous spawn failures into failed smoke runs", async () => {
    const errors = [];
    const exitCode = await runSpawnedCommand({
      args: [],
      command: "node",
      environment: {},
      spawnProcess: () => {
        throw new Error("spawn threw");
      },
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual(["spawn threw"]);
  });

  it("rejects malformed spawn results as failed smoke runs", async () => {
    const errors = [];
    const exitCode = await runSpawnedCommand({
      args: [],
      command: "node",
      environment: {},
      spawnProcess: () => ({}),
      writeError: (message) => errors.push(message)
    });

    expect(exitCode).toBe(1);
    expect(errors).toEqual(["Smoke command did not return a child process"]);
  });

  it("resolves once when child process events race", async () => {
    const errors = [];
    const child = new EventEmitter();
    const exitCodePromise = runSpawnedCommand({
      args: [],
      command: "node",
      environment: {},
      spawnProcess: () => child,
      writeError: (message) => errors.push(message)
    });

    child.emit("close", 0);
    child.emit("error", new Error("late error"));
    child.emit("close", 1);

    await expect(exitCodePromise).resolves.toBe(0);
    expect(errors).toEqual([]);
  });
});

function createClosingChildProcess(exitCode) {
  const child = new EventEmitter();

  queueMicrotask(() => child.emit("close", exitCode));

  return child;
}

function createErroringChildProcess(error) {
  const child = new EventEmitter();

  queueMicrotask(() => child.emit("error", error));

  return child;
}
