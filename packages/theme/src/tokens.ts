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

const appliedThemeTokens = new WeakMap<HTMLElement, Set<string>>();

export function applyThemeTokens(target: HTMLElement, tokens: Readonly<Record<string, string>> | undefined): void {
  const previousTokens = appliedThemeTokens.get(target);

  if (previousTokens) {
    for (const token of previousTokens) {
      target.style.removeProperty(token);
    }
  }

  if (!tokens) {
    appliedThemeTokens.delete(target);
    return;
  }

  const nextTokens = new Set<string>();

  for (const [token, value] of Object.entries(tokens)) {
    if (!isThemeTokenName(token)) {
      continue;
    }

    target.style.setProperty(token, value);
    nextTokens.add(token);
  }

  appliedThemeTokens.set(target, nextTokens);
}

function isThemeTokenName(value: string): boolean {
  return /^--tp-[a-z][a-z0-9-]*$/.test(value);
}
