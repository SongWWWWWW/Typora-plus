import { toDisposable, type IDisposable } from "@typora-plus/base";
import type { TyporaPlusConfiguration } from "@typora-plus/platform";
import {
  applyWorkbenchTheme,
  type WorkbenchThemeApplicationServices
} from "./workbenchThemeApplication";

export const workbenchDarkThemeMediaQuery = "(prefers-color-scheme: dark)";

export interface WorkbenchThemeMediaQueryList {
  readonly matches: boolean;
  addEventListener(type: "change", listener: () => void): void;
  removeEventListener(type: "change", listener: () => void): void;
}

export interface WorkbenchThemeSynchronizationEnvironment {
  readonly target: HTMLElement;
  matchMedia(query: string): WorkbenchThemeMediaQueryList;
}

export interface WorkbenchThemeSynchronizationBrowser {
  matchMedia(query: string): WorkbenchThemeMediaQueryList;
}

export interface WorkbenchThemeSynchronizationDocument {
  readonly documentElement: HTMLElement;
}

export function createWorkbenchThemeSynchronizationEnvironment(
  browser: WorkbenchThemeSynchronizationBrowser,
  themeDocument: WorkbenchThemeSynchronizationDocument
): WorkbenchThemeSynchronizationEnvironment {
  return {
    target: themeDocument.documentElement,
    matchMedia: (query) => browser.matchMedia(query)
  };
}

export function registerWorkbenchThemeSynchronization(
  environment: WorkbenchThemeSynchronizationEnvironment,
  configuration: Pick<TyporaPlusConfiguration, "appearance">,
  services: WorkbenchThemeApplicationServices
): IDisposable {
  const media = environment.matchMedia(workbenchDarkThemeMediaQuery);
  const syncTheme = () => {
    applyWorkbenchTheme(environment.target, configuration, services, media.matches);
  };

  syncTheme();
  media.addEventListener("change", syncTheme);
  return toDisposable(() => media.removeEventListener("change", syncTheme));
}
