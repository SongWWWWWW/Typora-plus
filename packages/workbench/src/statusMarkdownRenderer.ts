import type { MarkdownRendererProvider } from "@typora-plus/platform";

export const workbenchStatusRendererId = "typora-plus.renderer.status";
export const workbenchStatusRendererLanguage = "status";

type StatusRendererTone = "danger" | "info" | "neutral" | "success" | "warning";

interface StatusRendererState {
  readonly aliases: readonly string[];
  readonly label: string;
  readonly tone: StatusRendererTone;
}

const statusRendererStates = [
  {
    aliases: ["done", "complete", "completed", "ok", "success", "yes"],
    label: "Done",
    tone: "success"
  },
  {
    aliases: ["doing", "in-progress", "progress", "wip", "active"],
    label: "In Progress",
    tone: "info"
  },
  {
    aliases: ["review", "pending", "waiting", "hold"],
    label: "Pending",
    tone: "warning"
  },
  {
    aliases: ["blocked", "error", "failed", "failure", "risk"],
    label: "Blocked",
    tone: "danger"
  },
  {
    aliases: ["todo", "open", "planned", "draft"],
    label: "Todo",
    tone: "neutral"
  }
] as const satisfies readonly StatusRendererState[];

export function createStatusMarkdownRendererProvider(): MarkdownRendererProvider {
  return {
    id: workbenchStatusRendererId,
    render(input) {
      const status = parseStatusRendererValue(input.value);

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

function parseStatusRendererValue(value: string): {
  readonly label: string;
  readonly source: string;
  readonly tone: StatusRendererTone;
} {
  const source = normalizeStatusText(value);

  if (!source) {
    return {
      label: "Status",
      source: "",
      tone: "neutral"
    };
  }

  const parsed = splitStatusText(source);
  const state = findStatusRendererState(parsed.key);

  return {
    label: parsed.label || state?.label || source,
    source,
    tone: state?.tone ?? "neutral"
  };
}

function splitStatusText(source: string): { readonly key: string; readonly label: string } {
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

    if (findStatusRendererState(key)) {
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

function findStatusRendererState(value: string): StatusRendererState | undefined {
  const normalized = normalizeStatusKey(value);
  return statusRendererStates.find((state) => (state.aliases as readonly string[]).includes(normalized));
}

function normalizeStatusText(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStatusKey(value: string): string {
  return normalizeStatusText(value).toLowerCase();
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
