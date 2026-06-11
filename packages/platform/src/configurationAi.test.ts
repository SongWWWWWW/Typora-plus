import { describe, expect, it } from "vitest";
import {
  ConfigurationService,
  defaultConfiguration,
  mergeConfiguration,
  normalizeAiProviderConfiguration
} from "./configuration";

describe("AI provider configuration", () => {
  it("persists sanitized configured AI providers", () => {
    const storage = createMemoryStorage();
    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    service.updateValue({
      ai: {
        providers: [
          {
            id: " notes.responses ",
            title: " Notes Assistant ",
            kind: "responses",
            endpointUrl: "https://api.example.test/v1/responses",
            model: "notes-model",
            secretRef: "typora-plus.ai.notes",
            store: false
          }
        ]
      }
    });

    const restored = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    expect(restored.getValue().ai.providers).toEqual([
      {
        id: "notes.responses",
        title: "Notes Assistant",
        kind: "responses",
        endpointUrl: "https://api.example.test/v1/responses",
        model: "notes-model",
        secretRef: "typora-plus.ai.notes",
        store: false
      }
    ]);
    expect(restored.getValue().ai.workspaceContextMaxResults).toBe(defaultConfiguration.ai.workspaceContextMaxResults);
    expect(restored.getValue().ai.workspaceContextMaxPreviewLength)
      .toBe(defaultConfiguration.ai.workspaceContextMaxPreviewLength);
  });

  it("drops invalid or duplicate configured AI providers without changing other configuration", () => {
    const storage = createMemoryStorage();
    storage.write("configuration", JSON.stringify({
      appearance: {
        density: "compact"
      },
      ai: {
        providers: [
          {
            id: "notes.responses",
            title: "Notes Assistant",
            kind: "responses",
            endpointUrl: "https://api.example.test/v1/responses",
            model: "notes-model",
            secretRef: "typora-plus.ai.notes"
          },
          {
            id: "notes.responses",
            title: "Duplicate",
            kind: "responses",
            endpointUrl: "https://api.example.test/v1/responses",
            model: "notes-model",
            secretRef: "typora-plus.ai.notes.duplicate"
          },
          {
            id: "bad endpoint",
            title: "Bad Endpoint",
            kind: "responses",
            endpointUrl: "file://C:/secret",
            model: "notes-model",
            secretRef: "typora-plus.ai.bad"
          },
          {
            id: "bad.http",
            title: "Bad HTTP",
            kind: "responses",
            endpointUrl: "http://api.example.test/v1/responses",
            model: "notes-model",
            secretRef: "typora-plus.ai.badHttp"
          },
          {
            id: "bad.kind",
            title: "Bad Kind",
            kind: "chat",
            endpointUrl: "https://api.example.test/v1/responses",
            model: "notes-model",
            secretRef: "typora-plus.ai.badKind"
          }
        ]
      }
    }));

    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    expect(service.getValue().appearance.density).toBe("compact");
    expect(service.getValue().ai.providers).toEqual([
      {
        id: "notes.responses",
        title: "Notes Assistant",
        kind: "responses",
        endpointUrl: "https://api.example.test/v1/responses",
        model: "notes-model",
        secretRef: "typora-plus.ai.notes"
      }
    ]);
    expect(service.getValue().ai.workspaceContextMaxResults).toBe(defaultConfiguration.ai.workspaceContextMaxResults);
  });

  it("sanitizes workspace context limits for AI requests", () => {
    const storage = createMemoryStorage();
    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    service.updateValue({
      ai: {
        workspaceContextMaxPreviewLength: 999,
        workspaceContextMaxResults: 99
      }
    });

    expect(service.getValue().ai.workspaceContextMaxPreviewLength).toBe(320);
    expect(service.getValue().ai.workspaceContextMaxResults).toBe(12);

    service.updateValue({
      ai: {
        workspaceContextMaxPreviewLength: 20,
        workspaceContextMaxResults: 0
      }
    });

    expect(service.getValue().ai.workspaceContextMaxPreviewLength).toBe(80);
    expect(service.getValue().ai.workspaceContextMaxResults).toBe(0);
  });

  it("allows loopback HTTP endpoints for local compatible providers", () => {
    const storage = createMemoryStorage();
    const service = new ConfigurationService({
      storageKey: "configuration",
      storage
    });

    service.updateValue({
      ai: {
        providers: [
          {
            id: "local.responses",
            title: "Local Responses",
            kind: "responses",
            endpointUrl: "http://127.0.0.1:11434/v1/responses",
            model: "local-model",
            secretRef: "typora-plus.ai.local"
          }
        ]
      }
    });

    expect(service.getValue().ai.providers).toEqual([
      {
        id: "local.responses",
        title: "Local Responses",
        kind: "responses",
        endpointUrl: "http://127.0.0.1:11434/v1/responses",
        model: "local-model",
        secretRef: "typora-plus.ai.local"
      }
    ]);
  });

  it("normalizes a single AI provider configuration for UI callers", () => {
    expect(normalizeAiProviderConfiguration({
      id: " notes.responses ",
      title: " Notes ",
      kind: "responses",
      endpointUrl: "https://api.example.test/v1/responses",
      model: " notes-model ",
      secretRef: " typora-plus.ai.notes ",
      store: true
    })).toEqual({
      id: "notes.responses",
      title: "Notes",
      kind: "responses",
      endpointUrl: "https://api.example.test/v1/responses",
      model: "notes-model",
      secretRef: "typora-plus.ai.notes",
      store: true
    });

    expect(normalizeAiProviderConfiguration({
      id: "public.http",
      title: "Public HTTP",
      kind: "responses",
      endpointUrl: "http://api.example.test/v1/responses",
      model: "notes-model",
      secretRef: "typora-plus.ai.public"
    })).toBeUndefined();
  });

  it("keeps AI configuration isolated during partial merges", () => {
    const base = {
      ...defaultConfiguration,
      ai: {
        providers: [
          {
            id: "notes.responses",
            title: "Notes Assistant",
            kind: "responses" as const,
            endpointUrl: "https://api.example.test/v1/responses",
            model: "notes-model",
            secretRef: "typora-plus.ai.notes"
          }
        ],
        workspaceContextMaxPreviewLength: defaultConfiguration.ai.workspaceContextMaxPreviewLength,
        workspaceContextMaxResults: defaultConfiguration.ai.workspaceContextMaxResults
      }
    };

    expect(mergeConfiguration(base, {
      editor: {
        focusMode: true
      }
    }).ai.providers).toEqual(base.ai.providers);
    expect(mergeConfiguration(base, {
      ai: {
        providers: []
      }
    }).ai.providers).toEqual([]);
    expect(mergeConfiguration(base, {
      ai: {
        workspaceContextMaxResults: 3
      }
    }).ai).toEqual({
      ...base.ai,
      workspaceContextMaxResults: 3
    });
  });
});

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    read(key: string) {
      return values.get(key);
    },
    write(key: string, value: string) {
      values.set(key, value);
    }
  };
}
