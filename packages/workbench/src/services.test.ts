import { describe, expect, it } from "vitest";
import { IAiService, IRemoteSyncService } from "@typora-plus/platform";
import { createWorkbenchServices } from "./services";

describe("createWorkbenchServices", () => {
  it("registers AI and remote sync services in the service collection", () => {
    const services = createWorkbenchServices();

    expect(services.serviceCollection.get(IAiService)).toBe(services.aiService);
    expect(services.serviceCollection.get(IRemoteSyncService)).toBe(services.remoteSyncService);
    expect(services.aiService.getProviders()).toEqual([]);
    expect(services.remoteSyncService.getProviders()).toEqual([]);
  });
});
