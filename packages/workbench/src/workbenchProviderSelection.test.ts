import { describe, expect, it, vi } from "vitest";
import {
  selectWorkbenchDefaultAiProviderId,
  selectWorkbenchDefaultProviderId,
  selectWorkbenchDefaultRemoteSyncProviderId
} from "./workbenchProviderSelection";

describe("workbench provider selection", () => {
  it("selects the first provider by title and id without mutating the source list", () => {
    const providers = [
      { id: "z.provider", title: "Writer" },
      { id: "b.provider", title: "Assistant" },
      { id: "a.provider", title: "Assistant" }
    ];

    expect(selectWorkbenchDefaultProviderId(providers)).toBe("a.provider");
    expect(providers.map((provider) => provider.id)).toEqual([
      "z.provider",
      "b.provider",
      "a.provider"
    ]);
  });

  it("returns undefined when no provider is available", () => {
    expect(selectWorkbenchDefaultProviderId([])).toBeUndefined();
  });

  it("keeps provider selection provider-id agnostic and input-order independent", () => {
    const openAiProvider = { id: "openai.responses", title: "OpenAI Responses" };
    const feishuProvider = { id: "feishu.drive", title: "Feishu Drive" };
    const codexProvider = { id: "codex.local", title: "Codex Local" };
    const alphaProvider = { id: "alpha.provider", title: "Alpha Provider" };
    const providers = [
      openAiProvider,
      feishuProvider,
      codexProvider,
      alphaProvider
    ];

    expect(selectWorkbenchDefaultProviderId(providers)).toBe("alpha.provider");
    expect(selectWorkbenchDefaultProviderId([...providers].reverse())).toBe("alpha.provider");
    expect(selectWorkbenchDefaultProviderId([
      codexProvider,
      openAiProvider,
      alphaProvider,
      feishuProvider
    ])).toBe("alpha.provider");
  });

  it("reads AI and remote sync providers through service boundaries", () => {
    const services = {
      aiService: {
        getProviders: vi.fn(() => [
          { id: "local.model", title: "Local Model" },
          { id: "openai.responses", title: "OpenAI Responses" }
        ])
      },
      remoteSyncService: {
        getProviders: vi.fn(() => [
          { id: "feishu.drive", title: "Feishu Drive" },
          { id: "local.folder", title: "Local Folder" }
        ])
      }
    };

    expect(selectWorkbenchDefaultAiProviderId(services)).toBe("local.model");
    expect(selectWorkbenchDefaultRemoteSyncProviderId(services)).toBe("feishu.drive");
    expect(services.aiService.getProviders).toHaveBeenCalledOnce();
    expect(services.remoteSyncService.getProviders).toHaveBeenCalledOnce();
  });
});
