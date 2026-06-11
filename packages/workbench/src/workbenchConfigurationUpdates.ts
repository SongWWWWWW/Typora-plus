import type {
  IConfigurationService,
  PartialConfiguration
} from "@typora-plus/platform";
import {
  runWorkbenchAction,
  type WorkbenchOperationErrorSetter
} from "./workbenchActionRunner";

export interface WorkbenchConfigurationUpdateServices {
  readonly configurationService: Pick<IConfigurationService, "updateValue">;
}

export interface WorkbenchConfigurationUpdateCallbacks {
  readonly setOperationError: WorkbenchOperationErrorSetter;
}

export function updateWorkbenchConfiguration(
  services: WorkbenchConfigurationUpdateServices,
  value: PartialConfiguration
): void {
  services.configurationService.updateValue(value);
}

export function updateWorkbenchConfigurationAction(
  services: WorkbenchConfigurationUpdateServices,
  value: PartialConfiguration,
  callbacks: WorkbenchConfigurationUpdateCallbacks
): Promise<void | undefined> {
  return runWorkbenchAction(
    () => updateWorkbenchConfiguration(services, value),
    callbacks.setOperationError
  );
}
