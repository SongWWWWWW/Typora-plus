export type ThemeName = "light" | "dark";

export const themeAttribute = "data-theme";

export function resolveThemeName(preference: "light" | "dark" | "system", prefersDark: boolean): ThemeName {
  if (preference === "system") {
    return prefersDark ? "dark" : "light";
  }

  return preference;
}

export function applyTheme(target: HTMLElement, theme: ThemeName): void {
  target.setAttribute(themeAttribute, theme);
}
