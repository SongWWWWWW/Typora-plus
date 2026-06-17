import type { IThemeService, RegisteredTheme, TyporaPlusConfiguration } from "@typora-plus/platform";
import { themeAttribute } from "@typora-plus/theme";
import { describe, expect, it, vi } from "vitest";
import {
  applyWorkbenchAppliedTheme,
  applyWorkbenchTheme,
  resolveWorkbenchAppliedTheme,
  type WorkbenchThemeApplicationServices
} from "./workbenchThemeApplication";

describe("workbench theme application", () => {
  it("resolves the configured base color scheme when no custom theme is selected", () => {
    const services = createServices();

    expect(resolveWorkbenchAppliedTheme(configuration({
      colorScheme: "system"
    }), services, true)).toEqual({
      theme: "dark"
    });
    expect(resolveWorkbenchAppliedTheme(configuration({
      colorScheme: "system"
    }), services, false)).toEqual({
      theme: "light"
    });
    expect(services.themeService.getTheme).not.toHaveBeenCalled();
  });

  it("uses selected theme tokens and color scheme when the contribution is available", () => {
    const focusTheme = theme({
      colorScheme: "dark",
      tokens: {
        "--tp-color-canvas": "#111",
        "--tp-color-text": "#eee"
      }
    });
    const services = createServices([focusTheme]);

    expect(resolveWorkbenchAppliedTheme(configuration({
      colorScheme: "light",
      themeId: focusTheme.id
    }), services, false)).toEqual({
      theme: "dark",
      tokens: focusTheme.tokens
    });
    expect(services.themeService.getTheme).toHaveBeenCalledWith(focusTheme.id);
  });

  it("falls back to the base color scheme when a selected theme omits color scheme", () => {
    const focusTheme = theme({
      tokens: {
        "--tp-color-canvas": "#fafafa"
      }
    });
    const services = createServices([focusTheme]);

    expect(resolveWorkbenchAppliedTheme(configuration({
      colorScheme: "system",
      themeId: focusTheme.id
    }), services, true)).toEqual({
      theme: "dark",
      tokens: focusTheme.tokens
    });
  });

  it("clears stale token overlays when the selected theme is unavailable", () => {
    const target = createThemeTarget();
    const services = createServices();

    applyWorkbenchAppliedTheme(target.element, {
      theme: "dark",
      tokens: {
        "--tp-color-canvas": "#111"
      }
    });
    applyWorkbenchTheme(target.element, configuration({
      colorScheme: "light",
      themeId: "missing.theme"
    }), services, false);

    expect(target.attributes.get(themeAttribute)).toBe("light");
    expect(target.properties).toEqual(new Map());
  });
});

function createServices(themes: readonly RegisteredTheme[] = []): WorkbenchThemeApplicationServices {
  return {
    themeService: {
      getTheme: vi.fn((id: string) => themes.find((theme) => theme.id === id))
    } satisfies Pick<IThemeService, "getTheme">
  };
}

function configuration(
  appearance: Partial<TyporaPlusConfiguration["appearance"]>
): Pick<TyporaPlusConfiguration, "appearance"> {
  return {
    appearance: {
      colorScheme: "system",
      density: "comfortable",
      locale: "en",
      ...appearance
    }
  };
}

function theme(overrides: Partial<RegisteredTheme> = {}): RegisteredTheme {
  return {
    id: "typora-plus.theme.focus",
    label: "Focus",
    tokens: {
      "--tp-color-text": "#222"
    },
    ...overrides
  };
}

function createThemeTarget() {
  const attributes = new Map<string, string>();
  const properties = new Map<string, string>();
  const element = {
    setAttribute(name: string, value: string) {
      attributes.set(name, value);
    },
    style: {
      setProperty(name: string, value: string) {
        properties.set(name, value);
      },
      removeProperty(name: string) {
        properties.delete(name);
        return "";
      }
    }
  } as unknown as HTMLElement;

  return { attributes, element, properties };
}
