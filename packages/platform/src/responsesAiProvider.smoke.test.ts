import { describe, expect, it } from "vitest";
import { createResponsesAiProvider, type ResponsesAiProviderTransportRequest } from "./responsesAiProvider";
import type { AiProviderConfiguration } from "./configuration";

interface LocalAiSmokeEnvironment {
  readonly endpointUrl: string;
  readonly apiKey: string;
  readonly model: string;
}

type LocalAiSmokeEnvironmentSource = Record<string, string | undefined>;

const localAiSmokeEnvironmentLimits = {
  apiKeyBytes: 64 * 1024,
  endpointUrlLength: 2000,
  modelLength: 120
} as const;

const environment = readLocalAiSmokeEnvironment();
const localAiSmokeRequired = isEnabledEnvironmentFlag("TYPORA_PLUS_AI_SMOKE_REQUIRED");
const describeLocalAiSmoke = environment || localAiSmokeRequired ? describe : describe.skip;

describeLocalAiSmoke("Responses AI provider local smoke", () => {
  it("requests an environment-configured local Responses-compatible provider", async () => {
    if (!environment) {
      throw new Error("Local AI smoke environment was not configured");
    }

    const provider = createResponsesAiProvider(createSmokeProviderConfiguration(environment), {
      readSecret: (secretRef) => secretRef === "typora-plus.ai.local-smoke"
        ? environment.apiKey
        : undefined,
      transport: fetchJson
    });

    const response = await provider.requestText({
      instruction: "Reply with a short plain-text health check for Typora Plus.",
      input: "This is a local AI provider smoke test. Do not include secrets or configuration values.",
      metadata: {
        action: "local-smoke",
        source: "platform-test"
      }
    });

    expect(response.value.trim().length).toBeGreaterThan(0);
    expect((response.model ?? environment.model).trim().length).toBeGreaterThan(0);
  });
});

describe("Responses AI provider local smoke environment", () => {
  it("returns undefined when the smoke environment is incomplete", () => {
    expect(readLocalAiSmokeEnvironment({
      CODEX_URL: "http://127.0.0.1:11434/v1/responses",
      CODEX_MODEL: "local-model"
    })).toBeUndefined();
  });

  it("accepts HTTPS or loopback HTTP endpoint URLs", () => {
    expect(readLocalAiSmokeEnvironment({
      CODEX_URL: "http://127.0.0.1:11434/v1/responses",
      CODEX_KEY: "local-key",
      CODEX_MODEL: "local-model"
    })).toEqual({
      endpointUrl: "http://127.0.0.1:11434/v1/responses",
      apiKey: "local-key",
      model: "local-model"
    });
    expect(readLocalAiSmokeEnvironment({
      TYPORA_PLUS_AI_SMOKE_ENDPOINT_URL: "https://localhost/v1/responses",
      TYPORA_PLUS_AI_SMOKE_API_KEY: "local-key",
      TYPORA_PLUS_AI_SMOKE_MODEL: "local-model"
    })?.endpointUrl).toBe("https://localhost/v1/responses");
  });

  it("rejects invalid endpoint values before creating the provider", () => {
    expect(() => readLocalAiSmokeEnvironment({
      CODEX_URL: "not-a-url",
      CODEX_KEY: "local-key",
      CODEX_MODEL: "local-model"
    })).toThrow("Local AI smoke endpoint URL must be HTTPS or loopback HTTP and at most 2000 characters");
    expect(() => readLocalAiSmokeEnvironment({
      CODEX_URL: ["http://workspace.example", "/v1/responses"].join(""),
      CODEX_KEY: "local-key",
      CODEX_MODEL: "local-model"
    })).toThrow("Local AI smoke endpoint URL must be HTTPS or loopback HTTP and at most 2000 characters");
  });

  it("rejects oversized key and model values without echoing configured values", () => {
    const apiKey = "k".repeat(localAiSmokeEnvironmentLimits.apiKeyBytes + 1);
    const model = "m".repeat(localAiSmokeEnvironmentLimits.modelLength + 1);

    expect(() => readLocalAiSmokeEnvironment({
      CODEX_URL: "http://localhost:11434/v1/responses",
      CODEX_KEY: apiKey,
      CODEX_MODEL: "local-model"
    })).toThrow(`Local AI smoke API key must be at most ${localAiSmokeEnvironmentLimits.apiKeyBytes} UTF-8 bytes`);
    expect(() => readLocalAiSmokeEnvironment({
      CODEX_URL: "http://localhost:11434/v1/responses",
      CODEX_KEY: "local-key",
      CODEX_MODEL: model
    })).toThrow(`Local AI smoke model must be at most ${localAiSmokeEnvironmentLimits.modelLength} characters`);
  });
});

function readLocalAiSmokeEnvironment(
  environment: LocalAiSmokeEnvironmentSource = process.env
): LocalAiSmokeEnvironment | undefined {
  const endpointUrl = readEnvironmentValue(
    environment,
    "TYPORA_PLUS_AI_SMOKE_ENDPOINT_URL",
    "CODEX_RESPONSES_URL",
    "CODEX_URL"
  );
  const apiKey = readEnvironmentValue(
    environment,
    "TYPORA_PLUS_AI_SMOKE_API_KEY",
    "CODEX_API_KEY",
    "CODEX_KEY"
  );
  const model = readEnvironmentValue(
    environment,
    "TYPORA_PLUS_AI_SMOKE_MODEL",
    "CODEX_MODEL"
  );

  if (!endpointUrl || !apiKey || !model) {
    return undefined;
  }

  validateLocalAiSmokeEndpointUrl(endpointUrl);
  validateLocalAiSmokeApiKey(apiKey);
  validateLocalAiSmokeModel(model);

  return { endpointUrl, apiKey, model };
}

function readEnvironmentValue(
  environment: LocalAiSmokeEnvironmentSource,
  ...names: readonly string[]
): string | undefined {
  for (const name of names) {
    const value = environment[name]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function validateLocalAiSmokeEndpointUrl(value: string): void {
  if (value.length > localAiSmokeEnvironmentLimits.endpointUrlLength) {
    throw new Error(
      `Local AI smoke endpoint URL must be HTTPS or loopback HTTP and at most ${localAiSmokeEnvironmentLimits.endpointUrlLength} characters`
    );
  }

  try {
    const url = new URL(value);

    if (url.protocol === "https:" || isLoopbackHttpUrl(url)) {
      return;
    }
  } catch {
    // Fall through to the redacted diagnostic below.
  }

  throw new Error(
    `Local AI smoke endpoint URL must be HTTPS or loopback HTTP and at most ${localAiSmokeEnvironmentLimits.endpointUrlLength} characters`
  );
}

function validateLocalAiSmokeApiKey(value: string): void {
  if (new TextEncoder().encode(value).length > localAiSmokeEnvironmentLimits.apiKeyBytes) {
    throw new Error(`Local AI smoke API key must be at most ${localAiSmokeEnvironmentLimits.apiKeyBytes} UTF-8 bytes`);
  }
}

function validateLocalAiSmokeModel(value: string): void {
  if (value.length > localAiSmokeEnvironmentLimits.modelLength) {
    throw new Error(`Local AI smoke model must be at most ${localAiSmokeEnvironmentLimits.modelLength} characters`);
  }
}

function isLoopbackHttpUrl(url: URL): boolean {
  return url.protocol === "http:" &&
    (url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]");
}

function isEnabledEnvironmentFlag(name: string): boolean {
  const value = process.env[name]?.trim().toLowerCase();

  return value === "1" || value === "true" || value === "yes";
}

function createSmokeProviderConfiguration(
  environment: LocalAiSmokeEnvironment
): AiProviderConfiguration {
  return {
    id: "local.smoke.responses",
    title: "Local Smoke Responses",
    kind: "responses",
    endpointUrl: environment.endpointUrl,
    maxOutputTokens: 256,
    model: environment.model,
    secretRef: "typora-plus.ai.local-smoke",
    store: false
  };
}

async function fetchJson(request: ResponsesAiProviderTransportRequest): Promise<unknown> {
  const response = await fetch(request.url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    ...(request.signal !== undefined ? { signal: request.signal } : {})
  });
  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `Local AI smoke request failed with HTTP ${response.status}: ${responseText.slice(0, 240)}`
    );
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    throw new Error("Local AI smoke response was not valid JSON");
  }
}
