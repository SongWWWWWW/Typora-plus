import { describe, expect, it } from "vitest";
import { applyTheme, applyThemeTokens, themeAttribute } from "./tokens";

describe("theme tokens", () => {
  it("applies built-in theme attributes", () => {
    const target = createThemeTarget();

    applyTheme(target.element, "dark");

    expect(target.attributes.get(themeAttribute)).toBe("dark");
  });

  it("applies and clears custom Typora Plus theme tokens", () => {
    const target = createThemeTarget();

    applyThemeTokens(target.element, {
      "--tp-color-canvas": "#111",
      "--tp-color-text": "#eee",
      "color": "red"
    });

    expect(target.properties).toEqual(new Map([
      ["--tp-color-canvas", "#111"],
      ["--tp-color-text", "#eee"]
    ]));

    applyThemeTokens(target.element, {
      "--tp-color-canvas": "#fff"
    });

    expect(target.properties).toEqual(new Map([
      ["--tp-color-canvas", "#fff"]
    ]));

    applyThemeTokens(target.element, undefined);

    expect(target.properties).toEqual(new Map());
  });
});

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
