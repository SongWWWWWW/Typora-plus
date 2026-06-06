import {
  defaultConfiguration,
  type MarkdownRendererProvider,
  type MarkdownStatusBadgeConfiguration,
  type MarkdownStatusBadgeTone
} from "@typora-plus/platform";

export const workbenchStatusRendererId = "typora-plus.renderer.status";
export const workbenchStatusRendererLanguage = "status";

interface StatusRendererState {
  readonly aliases: readonly string[];
  readonly label: string;
  readonly tone: MarkdownStatusBadgeTone;
}

export interface StatusMarkdownRendererProviderOptions {
  readonly getStatusBadges?: () => readonly MarkdownStatusBadgeConfiguration[];
}

export function createStatusMarkdownRendererProvider(
  options: StatusMarkdownRendererProviderOptions = {}
): MarkdownRendererProvider {
  return {
    id: workbenchStatusRendererId,
    render(input) {
      const status = parseStatusRendererValue(input.value, resolveStatusRendererStates(options));

      return {
        html: [
          `<span class="tp-renderer-status tp-renderer-status-${status.tone}" title="${escapeHtmlAttribute(status.source)}">`,
          escapeHtmlText(status.label),
          `</span>`
        ].join("")
      };
    }
  };
}

function parseStatusRendererValue(value: string, states: readonly StatusRendererState[]): {
  readonly label: string;
  readonly source: string;
  readonly tone: MarkdownStatusBadgeTone;
} {
  const source = normalizeStatusText(value);

  if (!source) {
    return {
      label: "Status",
      source: "",
      tone: "neutral"
    };
  }

  const parsed = splitStatusText(source, states);
  const state = findStatusRendererState(parsed.key, states);

  return {
    label: parsed.label || state?.label || source,
    source,
    tone: state?.tone ?? "neutral"
  };
}

function splitStatusText(
  source: string,
  states: readonly StatusRendererState[]
): { readonly key: string; readonly label: string } {
  const colon = source.indexOf(":");

  if (colon >= 0) {
    return {
      key: source.slice(0, colon),
      label: normalizeStatusText(source.slice(colon + 1))
    };
  }

  const firstWhitespace = source.search(/\s/);

  if (firstWhitespace > 0) {
    const key = source.slice(0, firstWhitespace);

    if (findStatusRendererState(key, states)) {
      return {
        key,
        label: normalizeStatusText(source.slice(firstWhitespace + 1))
      };
    }
  }

  return {
    key: source,
    label: ""
  };
}

function resolveStatusRendererStates(
  options: StatusMarkdownRendererProviderOptions
): readonly StatusRendererState[] {
  return (options.getStatusBadges?.() ?? defaultConfiguration.markdown.statusBadges).map((badge) => ({
    aliases: uniqueStatusAliases([badge.key, ...badge.aliases]),
    label: badge.label,
    tone: badge.tone
  }));
}

function findStatusRendererState(
  value: string,
  states: readonly StatusRendererState[]
): StatusRendererState | undefined {
  const normalized = normalizeStatusKey(value);
  return states.find((state) => state.aliases.includes(normalized));
}

function normalizeStatusText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStatusKey(value: string): string {
  return normalizeStatusText(value).toLowerCase();
}

function uniqueStatusAliases(values: readonly string[]): readonly string[] {
  return [...new Set(values.map(normalizeStatusKey).filter((value) => value.length > 0))];
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value)
    .replaceAll("\"", "&quot;");
}

function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
