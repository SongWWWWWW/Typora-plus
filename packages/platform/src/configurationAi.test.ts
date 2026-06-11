import { describe, expect, it } from "vitest";
import {
  ConfigurationService,
  defaultConfiguration,
  mergeConfiguration
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
        ]
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
