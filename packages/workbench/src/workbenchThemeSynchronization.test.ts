import type { IThemeService, RegisteredTheme, TyporaPlusConfiguration } from "@typora-plus/platform";
import { themeAttribute } from "@typora-plus/theme";
import { describe, expect, it, vi } from "vitest";
import {
  createWorkbenchThemeSynchronizationEnvironment,
  registerWorkbenchThemeSynchronization,
  workbenchDarkThemeMediaQuery,
  type WorkbenchThemeMediaQueryList,
  type WorkbenchThemeSynchronizationEnvironment
} from "./workbenchThemeSynchronization";
import type { WorkbenchThemeApplicationServices } from "./workbenchThemeApplication";

describe("workbench theme synchronization", () => {
  it("creates a theme environment from browser and document boundaries", () => {
    const target = createThemeTarget();
    const media = createMediaQueryList(false);
    const setTitleBarTheme = vi.fn(async () => true);
    const browser = {
      typoraPlus: {
        windowControls: {
          isAvailable: true,
          setTitleBarTheme
        }
      },
      matchMedia: vi.fn(() => media)
    };

    const environment = createWorkbenchThemeSynchronizationEnvironment(browser, {
      documentElement: target.element
    });
    const result = environment.matchMedia(workbenchDarkThemeMediaQuery);

    expect(environment.target).toBe(target.element);
    expect(result).toBe(media);
    expect(browser.matchMedia).toHaveBeenCalledWith(workbenchDarkThemeMediaQuery);

    environment.syncNativeTheme?.("light");

    expect(setTitleBarTheme).toHaveBeenCalledWith("light");
  });

  it("applies the current media theme and listens for system changes", () => {
    const target = createThemeTarget();
    const media = createMediaQueryList(true);
    const nativeThemeUpdates: string[] = [];
    const environment = createEnvironment(target.element, media, (theme) => nativeThemeUpdates.push(theme));

    const disposable = registerWorkbenchThemeSynchronization(
      environment,
      configuration({ colorScheme: "system" }),
      createServices()
    );

    expect(environment.matchMedia).toHaveBeenCalledWith(workbenchDarkThemeMediaQuery);
    expect(target.attributes.get(themeAttribute)).toBe("dark");
    expect(nativeThemeUpdates).toEqual(["dark"]);

    media.setMatches(false);

    expect(target.attributes.get(themeAttribute)).toBe("light");
    expect(nativeThemeUpdates).toEqual(["dark", "light"]);

    disposable.dispose();
    media.setMatches(true);

    expect(target.attributes.get(themeAttribute)).toBe("light");
  });

  it("applies selected theme token overlays through the theme application boundary", () => {
    const target = createThemeTarget();
    const media = createMediaQueryList(false);
    const focusTheme: RegisteredTheme = {
      id: "typora-plus.theme.focus",
      label: "Focus",
      colorScheme: "dark",
      tokens: {
        "--tp-color-canvas": "#111"
      }
    };

    registerWorkbenchThemeSynchronization(
      createEnvironment(target.element, media),
      configuration({
        colorScheme: "light",
        themeId: focusTheme.id
      }),
      createServices([focusTheme])
    );

    expect(target.attributes.get(themeAttribute)).toBe("dark");
    expect(target.properties.get("--tp-color-canvas")).toBe("#111");
  });
});

function createEnvironment(
  target: HTMLElement,
  media: WorkbenchThemeMediaQueryList,
  syncNativeTheme?: WorkbenchThemeSynchronizationEnvironment["syncNativeTheme"]
): WorkbenchThemeSynchronizationEnvironment & {
  readonly matchMedia: ReturnType<typeof vi.fn>;
} {
  return {
    target,
    matchMedia: vi.fn(() => media),
    ...(syncNativeTheme ? { syncNativeTheme } : {})
  };
}

function createMediaQueryList(initialMatches: boolean): WorkbenchThemeMediaQueryList & {
  setMatches(matches: boolean): void;
} {
  let matches = initialMatches;
  const listeners: Array<() => void> = [];

  return {
    get matches() {
      return matches;
    },
    addEventListener: (_type, listener) => listeners.push(listener),
    removeEventListener: (_type, listener) => {
      const index = listeners.indexOf(listener);

      if (index !== -1) {
        listeners.splice(index, 1);
      }
    },
    setMatches(nextMatches: boolean) {
      matches = nextMatches;
      for (const listener of [...listeners]) {
        listener();
      }
    }
  };
}

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
