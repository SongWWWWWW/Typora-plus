import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const defaultLarkGatewayHostnames = new Set(["127.0.0.1", "localhost"]);
const defaultLarkGatewayPort = "41573";
const defaultHealthTimeoutMs = 700;
const defaultStartupTimeoutMs = 12_000;
const defaultPollIntervalMs = 250;

let larkGatewayProcess: ChildProcess | undefined;
let larkGatewayStartup: Promise<void> | undefined;

export interface NativeLarkGatewayProcessOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly executablePath?: string;
  readonly fetchUrl?: typeof fetch;
  readonly healthTimeoutMs?: number;
  readonly pathExists?: (path: string) => boolean;
  readonly scriptPath?: string;
  readonly spawnProcess?: typeof spawn;
  readonly startupTimeoutMs?: number;
}

export async function ensureNativeLarkGatewayForRequestUrl(
  requestUrl: string,
  options: NativeLarkGatewayProcessOptions = {}
): Promise<void> {
  if (!isNativeLarkGatewayRequestUrl(requestUrl)) {
    return;
  }

  const healthUrl = createNativeLarkGatewayHealthUrl(requestUrl);

  if (await isNativeLarkGatewayHealthy(healthUrl, options)) {
    return;
  }

  await startNativeLarkGatewayProcess(options);
  await waitForNativeLarkGatewayHealth(healthUrl, options);
}

export function stopNativeLarkGatewayProcess(): void {
  larkGatewayStartup = undefined;

  if (!larkGatewayProcess || larkGatewayProcess.killed) {
    larkGatewayProcess = undefined;
    return;
  }

  larkGatewayProcess.kill();
  larkGatewayProcess = undefined;
}

export function isNativeLarkGatewayRequestUrl(requestUrl: string): boolean {
  let parsed: URL;

  try {
    parsed = new URL(requestUrl);
  } catch {
    return false;
  }

  return parsed.protocol === "http:" &&
    defaultLarkGatewayHostnames.has(parsed.hostname) &&
    parsed.port === defaultLarkGatewayPort;
}

export function resolveNativeLarkGatewayScriptPath(
  options: Pick<NativeLarkGatewayProcessOptions, "pathExists" | "scriptPath"> = {}
): string | undefined {
  if (options.scriptPath) {
    return options.scriptPath;
  }

  const pathExists = options.pathExists ?? existsSync;
  const candidates = [
    path.join(currentDir, "scripts", "lark-cli-raw-mirror-gateway.mjs"),
    path.join(currentDir, "..", "scripts", "lark-cli-raw-mirror-gateway.mjs"),
    path.join(currentDir, "..", "..", "..", "scripts", "lark-cli-raw-mirror-gateway.mjs")
  ];

  return candidates.find((candidate) => pathExists(candidate));
}

async function startNativeLarkGatewayProcess(options: NativeLarkGatewayProcessOptions): Promise<void> {
  if (larkGatewayProcess && !larkGatewayProcess.killed) {
    return;
  }

  larkGatewayStartup ??= startNativeLarkGatewayProcessOnce(options).finally(() => {
    larkGatewayStartup = undefined;
  });

  await larkGatewayStartup;
}

async function startNativeLarkGatewayProcessOnce(options: NativeLarkGatewayProcessOptions): Promise<void> {
  const scriptPath = resolveNativeLarkGatewayScriptPath(options);

  if (!scriptPath) {
    throw new Error("Lark gateway script is unavailable");
  }

  const spawnProcess = options.spawnProcess ?? spawn;
  const executablePath = options.executablePath ?? process.execPath;
  const environment = {
    ...process.env,
    ...options.environment,
    ELECTRON_RUN_AS_NODE: "1"
  };

  larkGatewayProcess = spawnProcess(executablePath, [scriptPath, "serve"], {
    env: environment,
    stdio: "ignore",
    windowsHide: true
  });

  larkGatewayProcess.once("exit", () => {
    larkGatewayProcess = undefined;
  });
  larkGatewayProcess.once("error", () => {
    larkGatewayProcess = undefined;
  });
}

async function waitForNativeLarkGatewayHealth(
  healthUrl: string,
  options: NativeLarkGatewayProcessOptions
): Promise<void> {
  const deadline = Date.now() + normalizePositiveInteger(options.startupTimeoutMs, defaultStartupTimeoutMs);

  do {
    if (await isNativeLarkGatewayHealthy(healthUrl, options)) {
      return;
    }

    await delay(defaultPollIntervalMs);
  } while (Date.now() < deadline);

  throw new Error("Lark gateway did not become ready");
}

async function isNativeLarkGatewayHealthy(
  healthUrl: string,
  options: NativeLarkGatewayProcessOptions
): Promise<boolean> {
  const fetchUrl = options.fetchUrl ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), normalizePositiveInteger(
    options.healthTimeoutMs,
    defaultHealthTimeoutMs
  ));

  try {
    const response = await fetchUrl(healthUrl, { signal: controller.signal });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function createNativeLarkGatewayHealthUrl(requestUrl: string): string {
  const parsed = new URL(requestUrl);
  parsed.pathname = "/health";
  parsed.search = "";
  parsed.hash = "";
  return parsed.toString();
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return fallback;
  }

  return Math.trunc(value);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
