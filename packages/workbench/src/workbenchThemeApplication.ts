import type {
  IThemeService,
  TyporaPlusConfiguration
} from "@typora-plus/platform";
import {
  applyTheme,
  applyThemeTokens,
  resolveThemeName,
  type ThemeName
} from "@typora-plus/theme";

export interface WorkbenchThemeApplicationServices {
  readonly themeService: Pick<IThemeService, "getTheme">;
}

export interface WorkbenchAppliedTheme {
  readonly theme: ThemeName;
  readonly tokens?: Readonly<Record<string, string>>;
}

export function resolveWorkbenchAppliedTheme(
  configuration: Pick<TyporaPlusConfiguration, "appearance">,
  services: WorkbenchThemeApplicationServices,
  prefersDark: boolean
): WorkbenchAppliedTheme {
  const selectedTheme = configuration.appearance.themeId
    ? services.themeService.getTheme(configuration.appearance.themeId)
    : undefined;

  return {
    theme: selectedTheme?.colorScheme
      ?? resolveThemeName(configuration.appearance.colorScheme, prefersDark),
    ...(selectedTheme ? { tokens: selectedTheme.tokens } : {})
  };
}

export function applyWorkbenchAppliedTheme(
  target: HTMLElement,
  appliedTheme: WorkbenchAppliedTheme
): void {
  applyTheme(target, appliedTheme.theme);
  applyThemeTokens(target, appliedTheme.tokens);
}

export function applyWorkbenchTheme(
  target: HTMLElement,
  configuration: Pick<TyporaPlusConfiguration, "appearance">,
  services: WorkbenchThemeApplicationServices,
  prefersDark: boolean
): WorkbenchAppliedTheme {
  const appliedTheme = resolveWorkbenchAppliedTheme(configuration, services, prefersDark);
  applyWorkbenchAppliedTheme(target, appliedTheme);
  return appliedTheme;
}
