import {
  defaultConfiguration,
  type IAttachmentService,
  type IIndexService,
  type IKeybindingService,
  type TyporaPlusConfiguration
} from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  applyWorkbenchConfigurationToServices,
  type WorkbenchConfigurationSyncServices
} from "./workbenchConfigurationSync";

describe("workbench configuration sync", () => {
  it("applies workspace and keybinding preferences to platform services", () => {
    const services = createServices();
    const keybindingOverride = {
      command: "file.save",
      keybinding: {
        key: "k",
        primary: true
      }
    };
    const configuration = createConfiguration({
      workspace: {
        defaultAssetFolder: "media",
        searchMaxFileSizeBytes: 5_000_000,
        searchMaxResults: 77
      },
      keybindings: {
        overrides: [keybindingOverride]
      }
    });

    applyWorkbenchConfigurationToServices(services, configuration);

    expect(services.attachmentService.configure).toHaveBeenCalledWith({
      assetFolder: "media"
    });
    expect(services.indexService.configure).toHaveBeenCalledWith({
      maxFileSizeBytes: 5_000_000,
      maxResults: 77
    });
    expect(services.keybindingService.setUserKeybindings).toHaveBeenCalledWith([keybindingOverride]);
  });
});

function createServices(): WorkbenchConfigurationSyncServices {
  return {
    attachmentService: {
      configure: vi.fn()
    } satisfies Pick<IAttachmentService, "configure">,
    indexService: {
      configure: vi.fn()
    } satisfies Pick<IIndexService, "configure">,
    keybindingService: {
      setUserKeybindings: vi.fn()
    } satisfies Pick<IKeybindingService, "setUserKeybindings">
  };
}

function createConfiguration(
  overrides: {
    readonly workspace: Pick<
      TyporaPlusConfiguration["workspace"],
      "defaultAssetFolder" | "searchMaxFileSizeBytes" | "searchMaxResults"
    >;
    readonly keybindings: Pick<TyporaPlusConfiguration["keybindings"], "overrides">;
  }
): TyporaPlusConfiguration {
  return {
    ...defaultConfiguration,
    workspace: {
      ...defaultConfiguration.workspace,
      ...overrides.workspace
    },
    keybindings: {
      ...defaultConfiguration.keybindings,
      ...overrides.keybindings
    }
  };
}
