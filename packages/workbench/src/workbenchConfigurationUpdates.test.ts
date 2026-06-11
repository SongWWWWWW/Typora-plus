import type { PartialConfiguration } from "@typora-plus/platform";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchConfigurationUpdateHandler,
  updateWorkbenchConfiguration,
  updateWorkbenchConfigurationAction,
  type WorkbenchConfigurationUpdateServices
} from "./workbenchConfigurationUpdates";

describe("workbench configuration updates", () => {
  it("delegates partial configuration updates to the configuration service", () => {
    const value: PartialConfiguration = {
      editor: {
        focusMode: true
      }
    };
    const services = createServices();

    updateWorkbenchConfiguration(services, value);

    expect(services.configurationService.updateValue).toHaveBeenCalledWith(value);
  });

  it("runs Settings updates through Workbench action handling", async () => {
    const operationErrors: Array<string | undefined> = ["previous"];
    const value: PartialConfiguration = {
      appearance: {
        colorScheme: "dark"
      }
    };
    const services = createServices();

    await expect(updateWorkbenchConfigurationAction(services, value, {
      setOperationError: (error) => operationErrors.push(error)
    })).resolves.toBeUndefined();

    expect(services.configurationService.updateValue).toHaveBeenCalledWith(value);
    expect(operationErrors).toEqual(["previous", undefined]);
  });

  it("creates a Settings update handler with the shared action boundary", async () => {
    const operationErrors: Array<string | undefined> = [];
    const value: PartialConfiguration = {
      editor: {
        autoSave: true
      }
    };
    const services = createServices({
      updateValue: () => {
        throw new Error("Configuration storage failed");
      }
    });
    const updateSettings = createWorkbenchConfigurationUpdateHandler(services, {
      setOperationError: (error) => operationErrors.push(error)
    });

    updateSettings(value);
    await Promise.resolve();
    await Promise.resolve();

    expect(services.configurationService.updateValue).toHaveBeenCalledWith(value);
    expect(operationErrors).toEqual([undefined, "Configuration storage failed"]);
  });

  it("maps configuration update failures to operation errors", async () => {
    const operationErrors: Array<string | undefined> = [];
    const services = createServices({
      updateValue: () => {
        throw new Error("Configuration storage failed");
      }
    });

    await expect(updateWorkbenchConfigurationAction(services, {
      workspace: {
        defaultAssetFolder: "assets"
      }
    }, {
      setOperationError: (error) => operationErrors.push(error)
    })).resolves.toBeUndefined();

    expect(operationErrors).toEqual([undefined, "Configuration storage failed"]);
  });
});

function createServices(overrides: {
  readonly updateValue?: (value: PartialConfiguration) => void;
} = {}): WorkbenchConfigurationUpdateServices & {
  readonly configurationService: {
    readonly updateValue: ReturnType<typeof vi.fn>;
  };
} {
  return {
    configurationService: {
      updateValue: vi.fn(overrides.updateValue ?? (() => undefined))
    }
  };
}
