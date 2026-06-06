import { Emitter, toDisposable, type Event, type IDisposable } from "@typora-plus/base";
import { createServiceIdentifier } from "./instantiation";

export type ThemeColorScheme = "light" | "dark";

export interface ThemeContribution {
  readonly id: string;
  readonly label: string;
  readonly colorScheme?: ThemeColorScheme;
  readonly tokens: Readonly<Record<string, string>>;
}

export interface RegisteredTheme extends ThemeContribution {}

export interface IThemeService {
  readonly onDidChangeThemes: Event<void>;
  registerTheme(theme: ThemeContribution): IDisposable;
  getThemes(): readonly RegisteredTheme[];
  getTheme(id: string): RegisteredTheme | undefined;
}

export const IThemeService = createServiceIdentifier<IThemeService>("theme");

export class ThemeService implements IThemeService {
  private readonly themes = new Map<string, RegisteredTheme>();
  private readonly onDidChangeThemesEmitter = new Emitter<void>();

  readonly onDidChangeThemes = this.onDidChangeThemesEmitter.event;

  registerTheme(theme: ThemeContribution): IDisposable {
    const normalizedTheme = normalizeThemeContribution(theme);

    if (this.themes.has(normalizedTheme.id)) {
      throw new Error(`Theme already registered: ${normalizedTheme.id}`);
    }

    this.themes.set(normalizedTheme.id, normalizedTheme);
    this.onDidChangeThemesEmitter.fire();

    return toDisposable(() => {
      if (this.themes.get(normalizedTheme.id) === normalizedTheme) {
        this.themes.delete(normalizedTheme.id);
        this.onDidChangeThemesEmitter.fire();
      }
    });
  }

  getThemes(): readonly RegisteredTheme[] {
    return [...this.themes.values()]
      .map(cloneTheme)
      .sort((first, second) => first.label.localeCompare(second.label));
  }

  getTheme(id: string): RegisteredTheme | undefined {
    const normalizedId = readRequiredString(id, "Theme id");
    const theme = this.themes.get(normalizedId);
    return theme ? cloneTheme(theme) : undefined;
  }
}

function normalizeThemeContribution(theme: ThemeContribution): RegisteredTheme {
  const record = expectRecord(theme, "Theme contribution");
  const id = readRequiredString(record.id, "Theme id");
  const label = readRequiredString(record.label, `Theme label for ${id}`);
  const colorScheme = readOptionalThemeColorScheme(record.colorScheme, id);
  const tokens = normalizeThemeTokens(record.tokens, id);

  return {
    id,
    label,
    ...(colorScheme ? { colorScheme } : {}),
    tokens
  };
}

function normalizeThemeTokens(value: unknown, themeId: string): Readonly<Record<string, string>> {
  const record = expectRecord(value, `Theme tokens for ${themeId}`);
  const entries = Object.entries(record)
    .map(([key, tokenValue]) => [normalizeThemeTokenName(key, themeId), normalizeThemeTokenValue(tokenValue, key)] as const)
    .sort(([first], [second]) => first.localeCompare(second));

  if (entries.length === 0) {
    throw new Error(`Theme tokens for ${themeId} must not be empty`);
  }

  return Object.fromEntries(entries);
}

function normalizeThemeTokenName(value: string, themeId: string): string {
  const tokenName = readRequiredString(value, `Theme token name for ${themeId}`);

  if (!/^--tp-[a-z][a-z0-9-]*$/.test(tokenName)) {
    throw new Error(`Theme token for ${themeId} must be a Typora Plus CSS token: ${tokenName}`);
  }

  return tokenName;
}

function normalizeThemeTokenValue(value: unknown, tokenName: string): string {
  const tokenValue = readRequiredString(value, `Theme token value for ${tokenName}`);

  if (/[;{}]/.test(tokenValue)) {
    throw new Error(`Theme token value for ${tokenName} contains unsupported CSS syntax`);
  }

  return tokenValue;
}

function readOptionalThemeColorScheme(value: unknown, themeId: string): ThemeColorScheme | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value !== "light" && value !== "dark") {
    throw new Error(`Theme color scheme for ${themeId} must be light or dark`);
  }

  return value;
}

function cloneTheme(theme: RegisteredTheme): RegisteredTheme {
  return {
    id: theme.id,
    label: theme.label,
    ...(theme.colorScheme ? { colorScheme: theme.colorScheme } : {}),
    tokens: { ...theme.tokens }
  };
}

function expectRecord(value: unknown, label: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }

  return value as Record<string, unknown>;
}

function readRequiredString(value: unknown, label: string): string {
  if (typeof value !== "string") {
    throw new Error(`${label} must be a string`);
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(`${label} must not be empty`);
  }

  return normalized;
}
